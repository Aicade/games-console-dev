class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        addEventListenersPhaser.bind(this)();

        this.score = 0;
        this.lives = 3;

        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }
        // Load sounds
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }

        

        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/";
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        displayProgressLoader.call(this);
    }

    create() {
        this.vfx = new VFXLibrary(this);
        this.physics.world.setFPS(120);

        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        this.sounds.background.setVolume(3).setLoop(true).play();

        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.bg = this.add.image(this.game.config.width / 2, this.game.config.height / 2, "background").setOrigin(0.5);

        // Use the larger scale factor to ensure the image covers the whole canvas
        const scale = Math.max(this.game.config.width / this.bg.displayWidth, this.game.config.height / this.bg.displayHeight);
        this.bg.setScale(scale);

        this.scoreText = this.add.bitmapText(this.width / 2, 50, 'pixelfont', '0', 40).setOrigin(0.5, 0.5);

        // Use the SDK for pause/resume functionality
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.pauseButton = this.add.sprite(this.game.config.width - 60, 60, "pauseButton").setOrigin(0.5, 0.5);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(2);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        this.vfx.addCircleTexture('red', 0xFF0000, 1, 10);
        this.vfx.addCircleTexture('orange', 0xFFA500, 1, 10);
        this.vfx.addCircleTexture('yellow', 0xFFFF00, 1, 10);

        this.addHearts(3);

        this.ground = this.physics.add.sprite(this.width / 2, this.height, 'platform')
            .setFriction(100, 100)
            .setOrigin(0.5, 1);
        this.ground.body.immovable = true;
        this.ground.body.moves = false;
        this.ground.setImmovable(true);
        this.ground.setGravity(0, 0);
        this.ground.setDisplaySize(this.width, this.height * 0.2);

        // Create three players (Mario characters)
        this.createPlayers();

        this.level = 1;
        this.boxesLeft = -1;
        this.startx = null;
        this.starty = null;
        this.canShoot = false;
        this.time.delayedCall(500, () => {
            this.canShoot = true;
        });

        this.time.addEvent({
            delay: 100,
            callback: this.addObstacles,
            callbackScope: this,
            loop: false,
            args: [this]
        });

        this.boxes = this.physics.add.group({
            allowGravity: true,
        });

        this.input.on("pointerdown", this.click, this);
        this.input.on("pointerup", this.release, this);

        // Collider setup (applies to the active player)
        this.physics.add.collider(this.player, this.ground);
        this.physics.add.collider(this.boxes, this.ground);
        this.physics.add.collider(this.player, this.boxes, this.removeBox, null, this);
        this.physics.add.collider(this.boxes, this.boxes);
        this.input.keyboard.disableGlobalCapture();
    }

    update() {
        // End the game if no more players are available
        if (this.currentPlayerIndex >= this.players.length) {
            this.gameOver();
        }
        // Level up when all obstacles are cleared
        if (this.boxesLeft == 0) {
            this.sounds.upgrade.play();
            this.centerText = this.add.bitmapText(this.width / 2, this.height / 2, 'pixelfont', "LEVEL UP!", 64)
                .setOrigin(0.5, 0.5)
                .setDepth(100);
            this.time.delayedCall(500, () => {
                this.centerText.destroy();
            });
            if (this.respawnTimer) { this.respawnTimer.remove(); }

            // Increase level and reset lives
            this.level++;
            this.lives = 3;
            this.updateLives(this.lives);
            this.boxesLeft = -1;
            this.time.addEvent({
                delay: 500,
                callback: this.addObstacles,
                callbackScope: this,
                loop: false,
                args: [this]
            });

            // Reset players for the new level by recreating the lineup
            this.resetPlayers();

            // Reset hearts
            this.hearts.clear(true, true);
            this.addHearts(3);

            // Reset shooting variables
            this.canShoot = true;
            this.startx = null;
            this.starty = null;
        }
        if (this.canShoot && this.startx && this.starty) {
            const pointerx = this.input.activePointer.x;
            const pointery = this.input.activePointer.y;
            this.arrow.setAngle(180 + Phaser.Math.Angle.Between(this.startx, this.starty, pointerx, pointery) * 180 / Math.PI);
        }
    }

    // Create three player characters. All players are spawned with gravity disabled initially.
    createPlayers() {
        this.players = [];
        const initialX = 256;
        const initialY = this.ground.y - this.ground.displayHeight - 100;
        // Main player (big Mario)
        let mainPlayer = this.physics.add.sprite(initialX, initialY, 'player');
        mainPlayer.body.setDragX(200);
        mainPlayer.setOrigin(0.5);
        mainPlayer.setScale(0.22); // full size
        mainPlayer.setMass(2);
        // Disable gravity on spawn so it stays in place
        mainPlayer.body.allowGravity = false;
        // Prevent falling off screen until thrown
        mainPlayer.setCollideWorldBounds(true);
        this.players.push(mainPlayer);

        // Two small players positioned at the same y-axis, to the left of the main player
        for (let i = 1; i < 3; i++) {
            let smallPlayer = this.physics.add.sprite(initialX - i * 50, initialY, 'player');
            smallPlayer.body.setDragX(200);
            smallPlayer.setOrigin(0.5);
            smallPlayer.setScale(0.15); // small size
            smallPlayer.setMass(2);
            // Disable gravity initially so they remain in place
            smallPlayer.body.allowGravity = false;
            smallPlayer.setCollideWorldBounds(true);
            this.players.push(smallPlayer);
        }
        this.currentPlayerIndex = 0;
        this.player = this.players[this.currentPlayerIndex];

        // Add colliders for the active player
        this.physics.add.collider(this.player, this.ground);
        this.physics.add.collider(this.player, this.boxes, this.removeBox, null, this);
    }

    // Reset the players lineup at the start of a new level
    resetPlayers() {
        if (this.players && this.players.length > 0) {
            this.players.forEach(player => {
                player.destroy();
            });
        }
        this.createPlayers();
    }

    addHearts(count) {
        if (this.hearts) {
            this.hearts.destroy(true);
        }
        this.hearts = this.add.group();
        for (var i = 0; i < count; i++) {
            var heart = this.hearts.create(50 + (i * 45), 50, 'heart')
                .setScale(0.03)
                .setOrigin(0.5, 0.5);
            this.vfx.scaleGameObject(heart, 1.2, 500, -1);
        }
    }

    click(pointer) {
        this.startx = pointer.worldX;
        this.starty = pointer.worldY;
        if (this.canShoot) {
            // Enable gravity on the active player when shooting begins
            this.player.body.allowGravity = true;
            this.arrow = this.add.sprite(
                this.player.x + this.player.displayWidth / 2,
                this.player.y - this.player.displayHeight / 2,
                'arrow'
            );
            this.sounds.stretch.play();
        }
    }

    release(pointer) {
        if (this.canShoot) {
            this.arrow.destroy();
            this.sounds.shoot.play();
            this.canShoot = false;
            let endx = pointer.worldX;
            let endy = pointer.worldY;
            let movx = endx - this.startx;
            let movy = endy - this.starty;
            this.moveplayer(movx, movy);

            // After a delay, switch to the next player (if any) with a glide tween
            this.respawnTimer = this.time.delayedCall(3000, () => {
                // Reset current player's velocity, spin, and orientation
                this.player.setVelocity(0, 0);
                this.player.body.angularVelocity = 0;
                this.player.setAngle(0);

                // Remove the current (launched) player so it disappears
                this.player.destroy();

                // Move to the next player if available and animate its arrival
                this.currentPlayerIndex++;
                if (this.currentPlayerIndex < this.players.length) {
                    let newPlayer = this.players[this.currentPlayerIndex];
                    // Animate the new player gliding to spawn position and scaling up
                    this.tweens.add({
                        targets: newPlayer,
                        x: 256,
                        y: this.ground.y - this.ground.displayHeight - 100,
                        scale: 0.22,
                        duration: 500,
                        ease: 'Linear',
                        onComplete: () => {
                            // Enable gravity on the new player
                            newPlayer.body.allowGravity = true;
                            // Re-add colliders for the new active player
                            this.physics.add.collider(newPlayer, this.ground);
                            this.physics.add.collider(newPlayer, this.boxes, this.removeBox, null, this);
                            this.player = newPlayer;
                            // Remove one heart for the lost life
                            var heartsChildren = this.hearts.getChildren();
                            heartsChildren[heartsChildren.length - 1].destroy();
                            this.addHearts(heartsChildren.length);
                            // Now allow shooting again
                            this.canShoot = true;
                            this.startx = null;
                            this.starty = null;
                        }
                    });
                } else {
                    // No more players: trigger game over.
                    this.gameOver();
                    this.canShoot = true;
                    this.startx = null;
                    this.starty = null;
                }
            });
        }
    }

    removeBox(a, b) {
        this.sounds.collect.play();
        this.vfx.createEmitter('red', b.x, b.y, 1, 0, 500).explode(10);
        this.vfx.createEmitter('yellow', b.x, b.y, 1, 0, 500).explode(10);
        this.vfx.createEmitter('orange', b.x, b.y, 1, 0, 500).explode(10);
        b.destroy();
        this.updateScore(1);
        this.boxesLeft -= 1;
    }

    addObstacles() {
        let x = parseInt(3 + this.level / 5);
        let y = parseInt(1 + this.level / 3);

        this.boxesLeft = x * y;

        const startX = this.width - x * 100 - 100;
        const startY = this.ground.y - this.ground.displayHeight - 60;

        for (var i = 0; i < y; i++) {
            for (var j = 0; j < x; j++) {
                let xPosition = startX + (j * 100) + Phaser.Math.Between(20, 60);
                let yPosition = startY - (i * 150);
                this.addBox(xPosition, yPosition);
            }
        }
    }

    addBox(x, y) {
        let box = this.boxes.getFirstDead(true, x, y, 'enemy');
        if (!box) {
            box = this.boxes.create(x, y, 'enemy').setOrigin(0.5, 1);
        }
        box.body.setBounce(0.5);
        box.setScale(0.24);
        box.checkWorldBounds = true;
        box.outOfBoundsKill = true;
    }

    moveplayer(velx, vely) {
        this.player.body.immovable = false;
        this.player.body.moves = true;
        this.player.setImmovable(false);
        velx = -1 * velx * (50 + this.level);
        vely = -1 * vely * (50 + this.level);
        let movevelocity = new Phaser.Math.Vector2(velx, vely);
        this.player.body.velocity = movevelocity.normalize().scale(1000);
        
        // Apply a constant clockwise spin (360 degrees per second)
        this.player.body.angularVelocity = 360;
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(this.score);
    }

    updateLives(lives) {
        this.lives = lives;
        this.updateLivesText();
    }

    updateLivesText() {
        // Optionally update any UI for lives here
    }

    gameOver() {
        this.sounds.background.stop();
        initiateGameOver.bind(this)({
            "score": this.score
        });
    }

    // Use the braincadeSDK to handle pause (which dispatches kPauseGame event)
    pauseGame() {
        // Dispatch the pause event as expected by your SDK.
        // Do not create a custom restart UI here.
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
    this.load.on('fileprogress', function (file) {});
    this.load.on('complete', function () {
        progressBar.destroy();
        progressBox.destroy();
        loadingText.destroy();
    });
}

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
        default: 'arcade',
        arcade: {
            gravity: { y: 800 },
            debug: false,
        },
    },
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions,
    },
    orientation: _CONFIG.deviceOrientation==="landscape"
};
