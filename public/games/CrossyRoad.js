// Touuch Screen Controls
const joystickEnabled = false;
const buttonEnabled = false;

/*
------------------- GLOBAL CODE STARTS HERE -------------------
*/


// JOYSTICK DOCUMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/virtualjoystick/
const rexJoystickUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js";

// BUTTON DOCMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/button/
const rexButtonUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexbuttonplugin.min.js";



// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        addEventListenersPhaser.bind(this)();

        this.score = 0;
        // Load In-Game Assets from assetsLoader
        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        this.load.plugin('rexvirtualjoystickplugin', rexJoystickUrl, true);
        this.load.plugin('rexbuttonplugin', rexButtonUrl, true);
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");

        this.load.bitmapFont('pixelfont',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.png',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.xml');


        displayProgressLoader.call(this);
    }

    create() {
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }
    
        this.width = this.game.config.width;
        this.height = this.game.config.height;
    
        this.bg = this.add.image(this.game.config.width / 2, this.game.config.height / 2, "background").setOrigin(0.5);
        const scale = Math.max(this.width / this.bg.displayWidth, this.height / this.bg.displayHeight);
        this.bg.setScale(scale);
        // Background music
        this.backgroundMusic = this.sounds.background.setVolume(2.5).setLoop(true);
        this.backgroundMusic.play();
    
        this.vfx = new VFXLibrary(this);
    
        // Add UI elements
        this.scoreText = this.add.bitmapText(this.width * 0.5, this.height * 0.05, 'pixelfont', 'Score: 0', 35)
                                  .setOrigin(0.5);
        this.instructionText = this.add.bitmapText(this.width * 0.5, this.height * 0.3, 'pixelfont', 'Tap to Move', 35)
                                      .setOrigin(0.5)
                                      .setDepth(11);
        this.time.delayedCall(2500, () => {
            this.instructionText.destroy();
        });
        
        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        const pauseButton = this.add.sprite(this.game.config.width * 0.9, this.game.config.height * 0.05, "pauseButton")
                                  .setOrigin(0.5, 0.5)
                                  .setScale(1.5);
        pauseButton.setInteractive({ cursor: 'pointer' });
        pauseButton.on('pointerdown', () => this.pauseGame());
    
        const joyStickRadius = 50;
        if (joystickEnabled) {
            this.joyStick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
                x: joyStickRadius * 2,
                y: this.height - (joyStickRadius * 2),
                radius: 50,
                base: this.add.circle(0, 0, 80, 0x888888, 0.5),
                thumb: this.add.circle(0, 0, 40, 0xcccccc, 0.5),
            });
        }
    
        if (buttonEnabled) {
            this.buttonA = this.add.rectangle(this.width - 80, this.height - 100, 80, 80, 0xcccccc, 0.5);
            this.buttonA.button = this.plugins.get('rexbuttonplugin').add(this.buttonA, {
                mode: 1,
                clickInterval: 100,
            });
            this.buttonA.button.on('down', function (button, gameObject) {
                console.log("button clicked");
            });
        }
    
        this.playerDestroyEmitter = this.vfx.createEmitter('collectible', 0, 0, 0.035, 0, 1000).setAlpha(0.5);
    
        this.enemySpeed = 3;
        this.playerSpeed = 10;
        this.enemyMaxY = this.game.config.width * 0.43;
        this.enemyMinY = this.game.config.height * 0.22;
    
        // Player
        this.player = this.add.sprite(40, this.game.config.height / 2, 'player');
        this.player.setScale(0.17);
    
        // Add goal
        this.treasure = this.add.sprite(this.width - 80, this.height / 2, 'collectible');
        this.treasure.setScale(0.35);
    
        // Create enemy group with only one enemy initially (repeat: 0 means one enemy)
        this.enemies = this.add.group({
            key: 'enemy',
            repeat: 0,
            setXY: {
                x: this.game.config.width * 0.17,
                y: this.game.config.height * 0.33,
                stepX: this.game.config.width * 0.2,
                stepY: this.game.config.width * 0.05
            },
            setScale: {
                x: 0.15,
                y: 0.15,
            }
        });
    
        // Set enemy speed for the spawned enemy
        Phaser.Actions.Call(this.enemies.getChildren(), function (enemy) {
            enemy.speed = this.enemySpeed;
        }, this);
    
        this.isPlayerAlive = true;
        // Initialize overlay flag to control game freezing during overlay display
        this.isOverlayActive = false;
        
        this.cameras.main.resetFX();
        this.input.keyboard.disableGlobalCapture();
    }
    

    update() {

        // How to use joystick with keyboard

        // var joystickKeys = this.joyStick.createCursorKeys();
        // var keyboardKeys = this.input.keyboard.createCursorKeys();
        // if (joystickKeys.right.isDown || keyboardKeys.right.isDown) {
        //     console.log("right");
        // }

        // How to use button

        // if (this.buttonA.button.isDown) {
        //     console.log("button pressed");
        // }

        if (!this.isPlayerAlive) {
            return;
        }

        // Freeze game logic if overlay is active:
        if (this.isOverlayActive) {
            return;
        }


        if (this.input.activePointer.isDown) {
            this.player.x += this.playerSpeed;
        }

        let enemies = this.enemies.getChildren();
        let numEnemies = enemies.length;

        for (let i = 0; i < numEnemies; i++) {

            // move enemies
            enemies[i].y += enemies[i].speed
            // reverse movement if reached the edges
            if (enemies[i].y >= this.enemyMaxY && enemies[i].speed > 0) {
                enemies[i].speed *= -1;
            } else if (enemies[i].y <= this.enemyMinY && enemies[i].speed < 0) {
                enemies[i].speed *= -1;
            }

            //enemy collision
            if (Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), enemies[i].getBounds())) {
                this.playerDestroyEmitter.explode(400, this.player.x, this.player.y);
                this.sounds.lose.setVolume(.75).setLoop(false).play();

                this.player.destroy();
                enemies[i].destroy();
                this.time.delayedCall(2000, () => {
                    this.backgroundMusic.stop();

                    this.gameOver();
                });
                break;
            }
        }

        if (Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), this.treasure.getBounds())) {
            this.resetLevel();
        };


    }

    resetLevel() {
        // If a reset is already in progress, do nothing.
        if (this.isResettingLevel) return;
        this.isResettingLevel = true;
        
        // Optionally, remove or disable the treasure so it doesn't keep colliding.
        // For example: this.treasure.destroy();
        
        // Fade out the camera before resetting level.
        this.cameras.main.fadeOut(500, 0, 0, 0);
        
        this.cameras.main.once('camerafadeoutcomplete', () => {
            // Reset player position.
            this.player.x = 40;
            this.player.y = this.game.config.height / 2;
        
            // Increase level and enemy speed.
            this.level += 1;
            this.enemySpeed += 1;
            this.sounds.collect.setVolume(1.5).setLoop(false).play();
        
            // Update enemy speed for all existing enemies.
            Phaser.Actions.Call(this.enemies.getChildren(), function (enemy) {
                enemy.speed = this.enemySpeed;
            }, this);
        
            // Increase score by 1.
            this.updateScore(1);
        
            // Determine the desired number of enemies:
            // Desired count = (score + 1) capped at 4.
            let desiredEnemyCount = Math.min(this.score + 1, 4);
            let currentEnemyCount = this.enemies.getLength();
        
            // If we need more enemies, add them.
            if (currentEnemyCount < desiredEnemyCount) {
                let numberToAdd = desiredEnemyCount - currentEnemyCount;
                for (let i = 0; i < numberToAdd; i++) {
                    let newEnemy = this.add.sprite(0, 0, 'enemy');
                    newEnemy.setScale(0.15);
                    newEnemy.speed = this.enemySpeed;
                    this.enemies.add(newEnemy);
                }
            }
        
            // Reposition enemies based on the total count.
            let enemyCount = this.enemies.getLength();
            if (enemyCount === 1) {
                let enemy = this.enemies.getChildren()[0];
                enemy.x = this.game.config.width / 2;
                enemy.y = this.game.config.height * 0.3;
            } else if (enemyCount === 2) {
                let children = this.enemies.getChildren();
                children[0].x = this.game.config.width * 0.33;
                children[1].x = this.game.config.width * 0.67;
                children[0].y = children[1].y = this.game.config.height * 0.3;
            } else if (enemyCount === 3) {
                let children = this.enemies.getChildren();
                children[0].x = this.game.config.width * 0.25;
                children[1].x = this.game.config.width * 0.5;
                children[2].x = this.game.config.width * 0.75;
                children[0].y = children[1].y = children[2].y = this.game.config.height * 0.3;
            } else if (enemyCount === 4) {
                let children = this.enemies.getChildren();
                children[0].x = this.game.config.width * 0.2;
                children[1].x = this.game.config.width * 0.4;
                children[2].x = this.game.config.width * 0.6;
                children[3].x = this.game.config.width * 0.8;
                // Randomize y-axis positions to increase difficulty.
                children.forEach(enemy => {
                    enemy.y = Phaser.Math.Between(this.enemyMinY, this.game.config.height * 0.5);
                });
            }
        
            // Fade in the camera.
            this.cameras.main.fadeIn(500, 0, 0, 0);
            this.cameras.main.once('camerafadeincomplete', () => {
                // Reset the flag so further resets can occur.
                this.isResettingLevel = false;
            });
        });
    }
    

    updateScore(points) {
        // Update the score value
        this.score += points;
        this.updateScoreText();
        
        // Create a pop-up effect near the middle of the screen
        let popUp = this.add.bitmapText(this.width / 2, this.height / 5, 'pixelfont', `+${points}`, 50)
                         .setOrigin(0.5);
        
        // Animate the pop-up: move upward and fade out
        this.tweens.add({
            targets: popUp,
            y: popUp.y - 50,    // Moves the pop-up upward by 50 pixels
            alpha: 0,           // Fades the pop-up out
            duration: 800,      // Duration of the animation in milliseconds
            ease: 'Power1',
            onComplete: () => {
                popUp.destroy(); // Clean up the pop-up after animation
            }
        });
    }
     

    updateScoreText() {
        this.scoreText.setText(`Score: ${this.score}`);
    }

    gameOver() {
        initiateGameOver.bind(this)({ score: this.score });
    }

    pauseGame() {
        handlePauseGame.bind(this)();
    }

    // New function to show the "Nice" overlay and disable game play
showNiceOverlay() {
    // Set the overlay flag and disable input
    this.isOverlayActive = true;
    this.input.enabled = false;
    
    // Create a container for the overlay
    const overlay = this.add.container(0, 0);
    
    // Add a semi-transparent rectangle covering the whole screen
    const rect = this.add.rectangle(
        this.width / 2,
        this.height / 2,
        this.width,
        this.height,
        0x000000,
        0.5
    );
    overlay.add(rect);
    
    // Add centered "Nice" text
    const niceText = this.add.bitmapText(
        this.width / 2,
        this.height / 2,
        'pixelfont',
        'Nice',
        64
    ).setOrigin(0.5);
    overlay.add(niceText);
    
    // Make sure the overlay is on top
    overlay.setDepth(1000);
    
    // After 1 second, remove the overlay and re-enable updates and input
    this.time.delayedCall(1000, () => {
        overlay.destroy();
        this.isOverlayActive = false;
        this.input.enabled = true;
    });
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
    width: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width,
    height: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].height,
    scene: [GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        orientation: Phaser.Scale.Orientation.LANDSCAPE
    },
    pixelArt: true,
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
    deviceOrientation: _CONFIG.deviceOrientation==="landscape"
};

