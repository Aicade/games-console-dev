// Game Scene
class GameScene extends Phaser.Scene {

    cardNames = ["collectible_1", "collectible_2", "collectible_3", "collectible_4", "collectible_5", "collectible_6"];
    hearts = [];
    cardScale = 0.25; // Store the card scale as a property

    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {

        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        for (const key in _CONFIG.libLoader) {
            this.load.image(key, _CONFIG.libLoader[key]);
        }
        
        this.load.bitmapFont('pixelfont',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.png',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.xml');
        addEventListenersPhaser.bind(this)();

        displayProgressLoader.call(this)
    }

    // Add this method to the GameScene class
    resize() {
        // Get current game dimensions
        const width = this.game.config.width;
        const height = this.game.config.height;
        
        // Update background scaling
        if (this.bg) {
            const scale = Math.max(width / this.bg.width, height / this.bg.height);
            this.bg.setScale(scale);
        }
        
        // Recalculate grid positioning based on current dimensions
        if (this.gridConfiguration) {
            // Update in the resize method
            this.gridConfiguration = {
                x: width * 0.28, // Move starting position more to the left
                y: height * 0.25,
                paddingX: width * 0.12, // Increase horizontal padding between cards
                paddingY: height * 0.05  // Keep vertical padding the same
            };
            
            // Update card positions if they exist
            if (this.cards && this.cards.length) {
                this.cards.forEach((card, index) => {
                    if (card.gameObject && card.gameObject.active) {
                        // Increase horizontal spacing by using a larger multiplier for the x position
                        card.gameObject.x = this.gridConfiguration.x + (120 * this.cardScale + this.gridConfiguration.paddingX) * (index % 4);
                        card.gameObject.y = this.gridConfiguration.y + (128 * this.cardScale + this.gridConfiguration.paddingY) * Math.floor(index / 4);
                    }
                });
            }
        }
        
        // Update UI elements positioning
        if (this.pauseButton) {
            this.pauseButton.x = width - width * 0.06;  // 6% from right edge
            this.pauseButton.y = height * 0.06;         // 6% from top
        }
        
        if (this.scoreText) {
            this.scoreText.x = width / 2;
            this.scoreText.y = height * 0.03;
        }
        
        // Update hearts positioning
        if (this.hearts && this.hearts.length) {
            this.hearts.forEach((heart, index) => {
                heart.x = width * 0.06 + (width * 0.035) * index; // 6% from left + spacing
                heart.y = height * 0.06;                          // 6% from top
            }); 
        }
    }

    create() {

        //for keyboard control
        this.input.keyboard.disableGlobalCapture();
        this.lives = 6;
        this.vfx = new VFXLibrary(this);
        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.score = 0;

        this.gridConfiguration = {
            x: this.width * 0.25,
            y: this.height * 0.25,
            paddingX: this.width * 0.08,
            paddingY: this.height * 0.05
        }

        this.sounds = {};

        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }


        this.bg = this.add.sprite(0, 0, 'background').setOrigin(0);
        const scale = Math.max(this.game.config.width / this.bg.displayWidth, this.game.config.height / this.bg.displayHeight);
        this.bg.setScale(scale)

        this.sounds.background.setVolume(4).setLoop(false).play()

        // Add UI elements
        this.scoreText = this.add.bitmapText(this.width / 2, 10, 'pixelfont', 'Score: 0', 35).setDepth(11).setTint(0xffa500).setOrigin(0.5, 0).setAlpha(0);

        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.pauseButton = this.add.image(this.game.config.width - 60, 60, "pauseButton");
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(2).setScrollFactor(0).setDepth(11);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        this.startGame();
        this.scale.on('resize', this.resize, this);
        this.resize();

    }

    restartGame() {
        this.cardOpened = undefined;
        this.cameras.main.fadeOut(200 * this.cards.length);
        this.cards.reverse().map((card, index) => {
            this.add.tween({
                targets: card.gameObject,
                duration: 500,
                y: 1000,
                delay: index * 100,
                onComplete: () => {
                    card.gameObject.destroy();
                }
            })
        });

        this.time.addEvent({
            delay: 200 * this.cards.length,
            callback: () => {
                this.cards = [];
                this.canMove = false;
                this.scene.restart();
                // this.sound.play("card-slide", { volume: 1.2 });
            }
        })
    }

    createGridCards() {
        // Phaser random array position
        const gridCardNames = Phaser.Utils.Array.Shuffle([...this.cardNames, ...this.cardNames]);

        return gridCardNames.map((name, index) => {
            const newCard = this.createCard({
                scene: this,
                x: this.gridConfiguration.x + (120 * this.cardScale + this.gridConfiguration.paddingX) * (index % 4),
                y: -1000,
                frontTexture: name,
                cardName: name
            });
            this.add.tween({
                targets: newCard.gameObject,
                duration: 800,
                delay: index * 100,
                // onComplete: () => {this.sounds.spawn.play()},
                y: this.gridConfiguration.y + (128 + this.gridConfiguration.paddingY) * Math.floor(index / 4)
            })
            return newCard;
        });
    }

    createHearts() {
        this.hearts = Array.from(new Array(this.lives)).map((el, index) => {
            const heart = this.add.image(this.width, 45, "heart")
                .setScale(0.032 * (this.height / 800)); // Make heart scale responsive
    
            this.add.tween({
                targets: heart,
                ease: Phaser.Math.Easing.Expo.InOut,
                duration: 1000,
                delay: 1000 + index * 200,
                x: this.width * 0.06 + (this.width * 0.035) * index // Make position responsive
            });
            return heart;
        });
        return this.hearts;
    }

    startGame() {

        // WinnerText and GameOverText
        const winnerText = this.add.bitmapText(this.width / 2, -1000, 'pixelfont', "YOU WON", 80).setOrigin(.5)
            .setDepth(3).setTint(0x8c7ae6).setInteractive({ cursor: "pointer" });

        const gameOverText = this.add.bitmapText(this.width / 2, -1000, 'pixelfont', "GAME OVER\nClick to restart", 50)
            .setName("gameOverText").setDepth(3).setOrigin(.5).setTint(0xff0000).setInteractive({ cursor: "pointer" });
        gameOverText.align = 1;

        // Start lifes images
        const hearts = this.createHearts();

        // Create a grid of cards
        this.cards = this.createGridCards();

        // Start canMove
        this.time.addEvent({
            delay: 200 * this.cards.length,
            callback: () => {
                this.canMove = true;
            }
        });

        // Game Logic
        this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer) => {
            if (this.canMove && this.cards.length) {
                const card = this.cards.find(card => card.gameObject.hasFaceAt(pointer.x, pointer.y));

                if (card) {
                    this.canMove = false;

                    // Detect if there is a card opened
                    if (this.cardOpened !== undefined) {
                        // If the card is the same that the opened not do anything
                        if (this.cardOpened.gameObject.x === card.gameObject.x && this.cardOpened.gameObject.y === card.gameObject.y) {
                            this.canMove = true;
                            return false;
                        }

                        card.flip(() => {
                            if (this.cardOpened.cardName === card.cardName) {
                                // ------- Match -------
                                this.sounds.collect.play();
                                // Destroy card selected and card opened from history
                                this.cardOpened.destroy();
                                card.destroy();

                                // remove card destroyed from array
                                this.cards = this.cards.filter(cardLocal => cardLocal.cardName !== card.cardName);
                                // reset history card opened
                                this.cardOpened = undefined;
                                this.canMove = true;

                            } else {
                                // ------- No match -------
                                this.sounds.damage.play();
                                this.cameras.main.shake(600, 0.01);
                                // remove life and heart
                                const lastHeart = hearts[hearts.length - 1];
                                this.add.tween({
                                    targets: lastHeart,
                                    ease: Phaser.Math.Easing.Expo.InOut,
                                    duration: 1000,
                                    y: - 1000,
                                    onComplete: () => {
                                        lastHeart.destroy();
                                        hearts.pop();
                                    }
                                });
                                this.lives -= 1;
                                // Flip last card selected and flip the card opened from history and reset history
                                card.flip();
                                this.cardOpened.flip(() => {
                                    this.cardOpened = undefined;
                                    this.canMove = true;

                                });
                            }

                            // Check if the game is over
                            if (this.lives === 0) {
                                // Show Game Over text
                                this.sounds.lose.play();
                                this.canMove = false;
                                this.add.tween({
                                    targets: gameOverText,
                                    ease: Phaser.Math.Easing.Bounce.Out,
                                    y: this.height / 2,
                                    onComplete: () => {
                                        this.time.delayedCall(500, () => {
                                            this.gameOver();
                                        })
                                    }
                                });
                            }

                            // Check if the game is won
                            if (this.cards.length === 0) {
                                this.sounds.success.play();

                                this.add.tween({
                                    targets: winnerText,
                                    ease: Phaser.Math.Easing.Bounce.Out,
                                    y: this.height / 2,
                                });
                                this.canMove = false;
                            }
                        });

                    } else if (this.cardOpened === undefined && this.lives > 0 && this.cards.length > 0) {
                        // If there is not a card opened save the card selected
                        card.flip(() => {
                            this.canMove = true;
                        });
                        this.cardOpened = card;
                    }
                }
            }

        });


        // Text events
        winnerText.on(Phaser.Input.Events.POINTER_OVER, () => {
            winnerText.setTint(0xFF7F50);
        });
        winnerText.on(Phaser.Input.Events.POINTER_OUT, () => {
            winnerText.setTint(0x8c7ae6);
        });
        winnerText.on(Phaser.Input.Events.POINTER_DOWN, () => {
            this.add.tween({
                targets: winnerText,
                ease: Phaser.Math.Easing.Bounce.InOut,
                y: -1000,
                onComplete: () => {
                    this.sound.stopAll();
                    this.scene.restart();
                }
            })
        });
    }

    createCard = ({
        scene,
        x,
        y,
        frontTexture,
        cardName
    }) => {

        let isFlipping = false;
        const rotation = { y: 0 };

        const backTexture = "platform";
        

        const card = scene.add.plane(x, y, backTexture)
        .setName(cardName)
        .setInteractive({ cursor: 'pointer' })
        .setScale(this.cardScale * Math.min(this.width / 1000, this.height / 700));

        // start with the card face down
        card.modelRotationY = 180;

        const flipCard = (callbackComplete) => {
            if (isFlipping) {
                return;
            }
            scene.add.tween({
                targets: [rotation],
                y: (rotation.y === 180) ? 0 : 180,
                ease: Phaser.Math.Easing.Expo.Out,
                duration: 500,
                onStart: () => {
                    isFlipping = true;
                    scene.sounds.click.play();
                    scene.tweens.chain({
                        targets: card,
                        ease: Phaser.Math.Easing.Expo.InOut,
                        tweens: [
                            {
                                duration: 200,
                                scale: this.cardScale * Math.min(this.width / 1000, this.height / 700) * 0.9, // 90% of normal size
                            },
                            {
                                duration: 300,
                                scale: this.cardScale * Math.min(this.width / 1000, this.height / 700)
                            },
                        ]
                    })
                },
                onUpdate: () => {
                    // card.modelRotation.y = Phaser.Math.DegToRad(180) + Phaser.Math.DegToRad(rotation.y);
                    card.rotateY = 180 + rotation.y;
                    const cardRotation = Math.floor(card.rotateY) % 360;
                    if ((cardRotation >= 0 && cardRotation <= 90) || (cardRotation >= 270 && cardRotation <= 359)) {
                        card.setTexture(frontTexture);
                    }
                    else {
                        card.setTexture(backTexture);
                    }
                },
                onComplete: () => {
                    isFlipping = false;
                    if (callbackComplete) {
                        callbackComplete();
                    }
                }
            });
        }

        const destroy = () => {
            scene.add.tween({
                targets: [card],
                y: card.y - 1000,
                easing: Phaser.Math.Easing.Elastic.In,
                duration: 500,
                onComplete: () => {
                    card.destroy();
                }
            })
        }

        return {
            gameObject: card,
            flip: flipCard,
            destroy,
            cardName
        }
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }


    updateScoreText() {
        this.scoreText.setText(`Score: ${this.score}`);
    }


    gameOver() {
        initiateGameOver.bind(this)({
            score: this.score
        })
    }

    pauseGame() {
        handlePauseGame.bind(this)();
    }
}

function displayProgressLoader() {
    let width = 320;
    let height = 50;
    let x = (this.game.config.width / 2) - 160;
    let y = (this.game.config.height / 2) - 50;

    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(x, y, width, height);

    const loadingText = this.make.text({
        x: this.game.config.width / 2,
        y: this.game.config.height / 2 + 20,
        text: 'Loading...',
        style: {
            font: '20px monospace',
            fill: '#ffffff'
        }
    }).setOrigin(0.5, 0.5);
    loadingText.setOrigin(0.5, 0.5);

    const progressBar = this.add.graphics();
    this.load.on('progress', (value) => {
        progressBar.clear();
        progressBar.fillStyle(0x364afe, 1);
        progressBar.fillRect(x, y, width * value, height);
    });
    this.load.on('fileprogress', function (file) {

    });
    this.load.on('complete', function () {
        progressBar.destroy();
        progressBox.destroy();
        loadingText.destroy();
    });
}

// Configuration object
const config = {
    type: Phaser.AUTO,
    width: _CONFIG.deviceOrientationSizes[_CONFIG.deviceOrientation].width,
    height: _CONFIG.deviceOrientationSizes[_CONFIG.deviceOrientation].height,
    scene: [GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: _CONFIG.deviceOrientationSizes[_CONFIG.deviceOrientation].width,
        height: _CONFIG.deviceOrientationSizes[_CONFIG.deviceOrientation].height,
        parent: 'game-container',
        expandParent: true
    },
    pixelArt: true,
    /* ADD CUSTOM CONFIG ELEMENTS HERE */
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 0 },
            debug: false,
        },
    },
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions,
    },
    deviceOrientation: _CONFIG.deviceOrientation === "portrait"
};