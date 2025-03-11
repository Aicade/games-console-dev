var isMobile = false;
// Touuch Screen Controls
const joystickEnabled = true;
const buttonEnabled = true;

/*
------------------- GLOBAL CODE STARTS HERE -------------------
*/


// JOYSTICK DOCUMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/virtualjoystick/
const rexJoystickUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js";

// BUTTON DOCMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/button/
const rexButtonUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexbuttonplugin.min.js";

// Game Scene
class GameScene extends Phaser.Scene {
    create(data) {
        const message = data.playerWon ? 'You Win!' : 'You Lost!';
        this.add.bitmapText(this.game.config.width / 2, this.game.config.height / 2, 'pixelfont', message, 48)
            .setOrigin(0.5);
    }
    constructor() {
        super({ key: 'GameScene' });
        this.lastThrowTime = 0;
        this.score = 5;
        this.playerLives = 1;
        this.enemyLives = 5;
        this.playerWon = false;
        this.difficultyLevel = 'easy';
        this.throwCooldown = 700;
        this.lastCooldown = 0;
        this.platformHeight =100;

    }

    preload() {
        this.score = 0;

        this.load.plugin('rexvirtualjoystickplugin', rexJoystickUrl, true);
        this.load.plugin('rexbuttonplugin', rexButtonUrl, true);


        // Load In-Game Assets from assetsLoader
        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }

        this.load.image("heart", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/heart.png");
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");

        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/"
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        addEventListenersPhaser.bind(this)();

        displayProgressLoader.call(this);
    }

    create() {

        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        isMobile = !this.sys.game.device.os.desktop;
        this.sounds.background.setVolume(1).setLoop(true).play()


        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.bg = this.add.image(this.game.config.width / 2, this.game.config.height / 2, "background").setOrigin(0.5);
        const scale = Math.max(this.game.config.width / this.bg.displayWidth, this.game.config.height / this.bg.displayHeight);
        this.bg.setScale(scale);

        // Add UI elements
        this.scoreText = this.add.bitmapText(10, 10, 'pixelfont', 'Score: 0', 24);

        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());

        this.pauseButton = this.add.sprite(this.game.config.width - 60, 60, "pauseButton").setOrigin(0.5, 0.5);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(3);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        const joyStickRadius = 50;

        if (joystickEnabled) {
            this.joyStick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
                x: joyStickRadius * 2,
                y: this.height - (joyStickRadius * 2),
                radius: 50,
                base: this.add.circle(0, 0, 80, 0x888888, 0.5).setDepth(1),
                thumb: this.add.circle(0, 0, 40, 0xcccccc, 0.5).setDepth(1),
                // dir: '8dir',   // 'up&down'|0|'left&right'|1|'4dir'|2|'8dir'|3
                // forceMin: 16,
            });
        }

        if (buttonEnabled) {
            this.buttonA = this.add.rectangle(this.width - 80, this.height - 100, 80, 80, 0xcccccc, 0.5).setDepth(1)
            this.buttonA.button = this.plugins.get('rexbuttonplugin').add(this.buttonA, {
                mode: 1,
                clickInterval: 100,
            });

            this.buttonA.button.on('down', (button, gameObject) => {
                this.spawnShield(true);
            });

        }

        this.platforms = this.physics.add.staticGroup();

        let platform = this.platforms.create(0, this.height - this.platformHeight, 'platform').setOrigin(0, 0);
        platform.displayHeight = this.platformHeight;
        platform.displayWidth = this.width;
        platform.refreshBody();

        // Create the player and scale it to 0.2
        this.player = this.physics.add.sprite(100, 300, 'player').setScale(0.3);
        // this.player.setBounce(0.2); // Optional bounce
        this.player.setCollideWorldBounds(true);
        this.player.body.setGravityY(800);
        this.player.body.setSize(this.player.body.width * 0.2, this.player.body.height * 0.8);

        this.enemy = this.physics.add.sprite(this.game.config.width - 200, 300, 'enemy').setScale(0.3);
        // this.enemy.setBounce(0.2); // Optional bounce
        this.enemy.setCollideWorldBounds(true);
        this.enemy.body.setGravityY(800);
        this.enemy.body.setSize(this.enemy.body.width * 0.2, this.enemy.body.height * 0.8);

        this.projectiles = this.physics.add.group({
            defaultKey: 'projectile',
            maxSize: 1000, // Adjust as needed
        });

        // Enable collision between the player and the platform
        this.physics.add.collider(this.player, this.platforms);
        this.physics.add.collider(this.enemy, this.platforms);
        this.physics.add.overlap(this.projectiles, this.enemy, this.hitEnemy, null, this);
        this.physics.add.overlap(this.projectiles, this.player, this.hitPlayer, null, this);


        // this.playerLivesText = this.add.text(20, 80, 'Player Lives: 3', { fontSize: '24px', fill: '#ffffff' });
        // this.enemyLivesText = this.add.text(20, 110, 'Enemy Lives: 3', { fontSize: '24px', fill: '#ffffff' });
        // Input events
        this.cursors = this.input.keyboard.createCursorKeys();
        this.shield = undefined;
        this.enemyShield = undefined;

        // Setup the Space key to spawn the shield
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Bind the spawnShield method if necessary
        this.spawnShield = this.spawnShield.bind(this);
        this.offset = 20;

        this.playerHealth = 100;
        this.enemyHealth = 100;

        // Create graphics for health bars
        this.playerHealthBar = this.add.graphics();
        this.enemyHealthBar = this.add.graphics();
        this.updateHealthBars();

        // graphics.generateTexture('heart', 100, 100);
        this.toggleControlsVisibility(isMobile);
        this.input.keyboard.disableGlobalCapture();
    }

    toggleControlsVisibility(visibility) {
        this.joyStick.base.visible = visibility;
        this.joyStick.thumb.visible = visibility;
        this.buttonA.visible = visibility;

    }


    update(time) {
        this.updateHealthBars();
    
        // Make sure to clamp the health values so they don't go below 0
        this.playerHealth = Phaser.Math.Clamp(this.playerHealth, 0, 100);
        this.enemyHealth = Phaser.Math.Clamp(this.enemyHealth, 0, 100);
    
        // Player controls (unchanged)
        var joystickKeys = this.joyStick.createCursorKeys();
        if (joystickKeys.right.isDown && time > this.lastThrowTime + 700) {
            this.throw();
            this.lastThrowTime = time;
        }
        if (joystickKeys.up.isDown && this.player.body.touching.down) {
            this.sounds.jump.setVolume(1).setLoop(false).play();
            this.player.setVelocityY(-400);
        }
        if (this.cursors.up.isDown && this.player.body.touching.down) {
            this.sounds.jump.setVolume(1).setLoop(false).play();
            this.player.setVelocityY(-400);
        }
        if (this.cursors.right.isDown && time > this.lastThrowTime + 700) {
            this.sounds.shoot.setVolume(1).setLoop(false).play();
            this.throw();
            this.lastThrowTime = time;
        }
    
        // Enemy AI (unchanged)
        if (this.player.isShooting && this.difficultyLevel !== 'easy') {
            this.maybeJump(9, time);
        } else {
            this.maybeJump(10, time);
        }
        if (this.difficultyLevel === 'hard') {
            this.maybeShoot(75, time);
        } else {
            this.maybeShoot(15, time);
        }
    
        // Check for game over conditions
        if (this.playerHealth <= 0) {
            this.gameOver(false); // Player lost
        } else if (this.enemyHealth <= 0) {
            this.gameOver(true); // Player won
        }
    
        // Shield logic (unchanged)
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && time > this.lastCooldown + 3000) {
            this.spawnShield(true);
            this.lastCooldown = time;
        }
        if (this.shield && this.shield.active) {
            this.shield.x = this.player.x + this.offset;
            this.shield.y = this.player.y;
        }
        if (this.enemyShield && this.enemyShield.active) {
            this.enemyShield.x = this.enemy.x - this.offset;
            this.enemyShield.y = this.enemy.y;
        }
    }
    // respawnEnemy() {
        
    // }

    updateHealthBars() {
        this.drawHealthBar(this.playerHealthBar, this.player.x - 40, this.player.y - 80, this.playerHealth, 0x00ff00);
        this.drawHealthBar(this.enemyHealthBar, this.enemy.x - 40, this.enemy.y - 80, this.enemyHealth, 0xff0000);
    }

    drawHealthBar(graphics, x, y, health, color) {
        graphics.clear();
        // Background
        graphics.fillStyle(0x000000);
        graphics.fillRect(x, y, 80, 16);
        // Health bar
        graphics.fillStyle(color);
        const healthWidth = Phaser.Math.Clamp(health, 0, 100) / 100 * 76;
        graphics.fillRect(x + 2, y + 2, healthWidth, 12);
    }

    maybeJump(chance, time) {
        // Ensure the enemy is on the ground before jumping
        if (this.enemy.body.touching.down && Phaser.Math.Between(0, 100) < chance) {
            this.enemy.setVelocityY(-400); // Jump
            if (time > this.lastCooldown + 2000) {
                this.spawnShield(false);
            }
        }
    }

    maybeShoot(chance, time) {
        // Check if cooldown has passed
        if (time > this.lastThrowTime + this.throwCooldown && Phaser.Math.Between(0, 100) < chance) {
            this.throw(false);
            this.lastThrowTime = time; // Update last throw time
            // if (time > this.lastCooldown + 300) {
            //     this.spawnShield(false);
            // }

        }
    }
    powerupTime(shield, projectile) {
        projectile.destroy();
    }

    spawnShield(isPlayerCall = true) {
        this.sounds.collect.setVolume(1).setLoop(false).play()
        if (isPlayerCall) {
            if (!this.shield || !this.shield.active) {
                this.shield = this.physics.add.sprite(this.player.x + this.offset, this.player.y, 'avoidable');
                this.shield.setScale(0.30).setDepth(1).setAlpha(0.5);

                this.shield.body.setSize(this.shield.body.width * 0.32, this.shield.body.height * 1.2);
                this.time.delayedCall(2000, () => {
                    this.shield.destroy();
                    this.shield = undefined;
                }, [], this);
                this.physics.add.overlap(this.shield, this.projectiles, this.powerupTime, null, this);
            } else {
                console.log("Shield already active.");
            }
        }
        else {
            if (!this.enemyShield || !this.enemyShield.active) {
                this.enemyShield = this.physics.add.sprite(this.enemy.x - this.offset, this.enemy.x.y, 'avoidable');
                this.enemyShield.setScale(0.24).setDepth(1).setAlpha(0.5);

                this.enemyShield.body.setSize(this.enemyShield.body.width * 0.3, this.enemyShield.body.height * 0.8);
                this.time.delayedCall(2000, () => {
                    this.enemyShield.destroy();
                    this.enemyShield = undefined;
                }, [], this);
                this.physics.add.overlap(this.enemyShield, this.projectiles, this.powerupTime, null, this);
            } else {
                console.log("this.enemyShield already active.");
            }

        }

    }

    throw(isPlayerThrowing = true) {
        let startX, velocityX;

        if (isPlayerThrowing) {
            startX = this.player.x + 60;
            velocityX = 300;
        } else {
            startX = this.enemy.x - 60;
            velocityX = -300; // Enemy's projectile velocity
        }

        let projectile = this.projectiles.get(startX, this.player.y); // Adjust Y position as needed

        if (projectile) {
            projectile.setActive(true).setVisible(true);
            projectile.body.gravity.y = 0;
            projectile.setScale(0.12);
            projectile.setVelocityX(velocityX);

            projectile.body.setSize(projectile.body.width * 0.8, projectile.body.height * 0.6);

            // Destroy projectile after 8 seconds
            this.time.delayedCall(4000, () => {
                projectile.destroy();
            });
        }
    }
    hitEnemy(enemy, projectile) {
        this.sounds.damage.setVolume(1).setLoop(false).play()

        // this.cameras.main.shake(250, 0.01, true);
        this.updateScore(10);
        projectile.destroy();

        const bloomSprite = this.add.sprite(enemy.x, enemy.y, 'enemy');
        bloomSprite.setScale(0.3);

        const bloom = bloomSprite.postFX.addBloom(0xffffff, 1, 1, 5, 1.2);
        this.tweens.add({
            targets: bloom,
            strength: 0, // Fade out the bloom effect
            duration: 1000, // 1 second duration
            onComplete: () => {
                // Destroy the bloom effect and sprite after fading out
                bloom.destroy();
                bloomSprite.destroy();
            }
        });
        const emitter = this.add.particles(projectile.x, projectile.y, 'heart', {
            speed: { min: -100, max: 300 },
            scale: { start: 0.1, end: 0 },
            blendMode: 'NORMAL',
            lifespan: 750,
        });

        // emitter.setPosition(x, y);
        emitter.explode(5);

        let pointText = this.add.text(projectile.x, projectile.y, '-20', {
            fontSize: '48px',
            fontStyle: 'bold',
            color: '#FF0000', // Red for damage
            stroke: '#000000',
            strokeThickness: 6
        }).setShadow(2, 2, '#333333', 2, true, true);

        pointText.setScale(0.8);
        pointText.setAngle(-15); // Tilt for impact effect

        this.tweens.add({
            targets: pointText,
            scale: 1.2, // Slightly overshoot the normal size for impact
            angle: 0, // Reset angle to 0
            duration: 300, // Quick pop effect
            ease: 'Back.out', // Back easing for impact effect
            onComplete: () => {
                // Tween to move the text up and fade it out, with rotation for dramatic effect
                this.tweens.add({
                    targets: pointText,
                    y: '-=100', // Slightly less movement but more focus on the fade and rotate
                    alpha: { from: 1, to: 0 }, // Fade out
                    duration: 800, // Quicker to keep up with fast-paced action
                    ease: 'Expo.easeIn', // Fast starting, slowing down at the end
                    angle: '+=15', // Slight rotation for dynamic effect
                    onComplete: () => {
                        pointText.destroy(); // Clean up after the animation
                    }
                });
            }
        });


        this.enemyLives--;
        this.enemyHealth = this.enemyHealth - 20;

    }

    hitPlayer(player, projectile) {

        this.sounds.damage.setVolume(1).setLoop(false).play()

        this.cameras.main.shake(250, 0.01, true);
        projectile.destroy();
        // Create a sprite to hold the bloom effect for the player
        const playerBloomSprite = this.add.sprite(this.player.x, this.player.y, 'player');
        playerBloomSprite.setScale(0.3);
        const playerBloom = playerBloomSprite.postFX.addBloom(0xffffff, 1, 1, 5, 1.2);
        let pointText = this.add.text(projectile.x, projectile.y, '-20', {
            fontSize: '48px',
            fontStyle: 'bold',
            color: '#FF0000', // Red for damage
            stroke: '#000000',
            strokeThickness: 6
        }).setShadow(2, 2, '#333333', 2, true, true);

        pointText.setScale(0.8);
        pointText.setAngle(-15); // Tilt for impact effect

        // Tween for impact pop and rotation effect
        this.tweens.add({
            targets: pointText,
            scale: 1.2, // Slightly overshoot the normal size for impact
            angle: 0, // Reset angle to 0
            duration: 300, // Quick pop effect
            ease: 'Back.out',
            onComplete: () => {
                this.tweens.add({
                    targets: pointText,
                    y: '-=100', // Slightly less movement but more focus on the fade and rotate
                    alpha: { from: 1, to: 0 }, // Fade out
                    duration: 800, // Quicker to keep up with fast-paced action
                    ease: 'Expo.easeIn', // Fast starting, slowing down at the end
                    angle: '+=15', // Slight rotation for dynamic effect
                    onComplete: () => {
                        pointText.destroy(); // Clean up after the animation
                    }
                });
            }
        });

        // collectible
        const emitter = this.add.particles(projectile.x - 75, projectile.y, 'heart', {
            speed: { min: -100, max: 300 },
            scale: { start: 0.1, end: 0 },
            blendMode: 'NORMAL',
            lifespan: 750,
        });

        // emitter.setPosition(x, y);
        emitter.explode(5);

        // Tween to fade out the player's bloom effect after 1 second
        this.tweens.add({
            targets: playerBloom,
            strength: 0, // Fade out the bloom effect
            duration: 1000, // 1 second duration
            onComplete: () => {
                // Destroy the bloom effect and sprite after fading out
                playerBloom.destroy();
                playerBloomSprite.destroy();
            }
        });

        this.playerLives--;
        this.playerHealth = this.playerHealth - 20;
    }



    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(`Scorexxdxdxdx: ${this.score}`);
    }

    gameOver() {
        this.sounds.background.stop();
        initiateGameOver.bind(this)({
            playerWon: playerWon
        });
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