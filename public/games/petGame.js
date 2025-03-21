// Touuch Screen Controls
const joystickEnabled = true;
const buttonEnabled = true;
const hideButtons = true;
var isMobile = false;

// JOYSTICK DOCUMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/virtualjoystick/
const rexJoystickUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js";

// BUTTON DOCMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/button/
const rexButtonUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexbuttonplugin.min.js";


/*
------------------- GLOBAL CODE STARTS HERE -------------------
*/

const PLAYER_STATE = {
    SMALL: 0,
    BIG: 1,
    BULLETS: 2,
}

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    init() {
        this.cursors = null;
        this.player = null;
        this.platforms = null;
        this.enemies = null;
        this.nextEnemyTime = 0;
        this.nextCollectTime = 0;
        this.canspawnCollectibles = true;
        this.scoreText = null;
        this.powerUps = null;
        this.score = 0;
        this.width = this.game.config.width;
        this.height = this.game.config.height;
    }

    preload() {
        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }

        if (joystickEnabled) this.load.plugin('rexvirtualjoystickplugin', rexJoystickUrl, true);
        if (buttonEnabled) this.load.plugin('rexbuttonplugin', rexButtonUrl, true);

        this.load.image("heart", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/heart.png");
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
        this.load.bitmapFont('pixelfont',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.png',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.xml');
        addEventListenersPhaser.bind(this)();
        displayProgressLoader.call(this);
    }

    create() {
        this.oneTime = false;
        this.input.keyboard.disableGlobalCapture();
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        isMobile = !this.sys.game.device.os.desktop;
        this.vfx = new VFXLibrary(this);

        this.sounds.background.setVolume(2).setLoop(true).play();
        this.input.addPointer(3);
        this.score = 0;
        this.meter = 0;
        this.finishPoint = 20000;
        this.isPlayerInAir = false;

        this.bg = this.add.tileSprite(10, 0, this.finishPoint + 500, this.game.config.height, 'background').setOrigin(0, 0);
        this.bg.setScrollFactor(1);
        this.bg.postFX.addBlur(0.5, 2, 2, 0.8);
        this.endPole = this.add.sprite(this.finishPoint, 100, 'platform').setOrigin(0, 0);
        this.endPole.setScrollFactor(1);
        this.endPole.displayHeight = this.game.config.height;
        this.endPole.displayWidth = 40;
        // Add UI elements
        this.meterValue = 0;

        // Create a graphics object for the meter bar
        this.meterBar = this.add.graphics();
        this.meterBar.setScrollFactor(0).setDepth(10);

        // Create a bitmap text for displaying the meter
        this.meterText = this.add.bitmapText(500, 26, 'pixelfont', `Happiness Meter: ${this.meterValue}`, 28);
        this.meterText.setScrollFactor(0).setDepth(11);

        // Draw the initial meter bar
        this.updateMeterBar();

        this.scoreImg = this.add.image(30, 60, 'collectible').setScale(.2).setScrollFactor(0).setDepth(11)
        this.scoreText = this.add.bitmapText(60, 30, 'pixelfont', 'x 0', 28);
        this.scoreText.setScrollFactor(0).setDepth(11);
        this.powerUpText = this.add.bitmapText(this.width / 2, 200, 'pixelfont', 'POWER UP', 60).setOrigin(0.5, 0.5);
        this.powerUpText.setScrollFactor(0).setAlpha(0).setDepth(11);

        this.finishText = this.add.bitmapText(this.finishPoint - 30, 50, 'pixelfont', 'FINISH', 30).setScrollFactor(1);
        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.pauseButton = this.add.sprite(this.game.config.width - 60, 60, "pauseButton").setOrigin(0.5, 0.5);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(2).setScrollFactor(0);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        this.physics.world.bounds.setTo(0, 0, this.finishPoint + 200, this.game.config.height);
        this.physics.world.setBoundsCollision(true);


        this.player = this.physics.add.sprite(0, 0, 'player').setScale(0.3).setBounce(0.1).setCollideWorldBounds(true);
        this.player.body.setSize(this.player.body.width / 4, this.player.body.height / 1.2);
        this.player.setGravityY(500);

        this.pet = this.physics.add.sprite(0, 0, 'projectile').setScale(0.3).setBounce(0.1).setCollideWorldBounds(true);
        this.pet.body.setSize(this.pet.body.width / 1.5, this.pet.body.height / 1.5);
        this.pet.setGravityY(500).setDepth(5);


        this.petIcon = this.add.image(380, 50, 'collectible').setScale(0.3).setDepth(11).setScrollFactor(0);


        this.cursors = this.input.keyboard.createCursorKeys();

        this.bullets = this.physics.add.group({
            defaultKey: 'projectile',
            active: false,
            maxSize: 20
        });

        this.firstEnemy = this.physics.add.sprite(700, 600, 'enemy').setScale(.4);
        this.firstEnemy.body.setSize(this.firstEnemy.body.width / 3, this.firstEnemy.body.height / 2);
        this.firstEnemy.setGravityY(100);
        this.firstEnemy.setBounceX(1);

        this.ground = this.add.tileSprite(0, this.game.config.height, this.finishPoint + 200, 50, 'platform');

        // this.ground.postFX.addShine(0.5);
        this.physics.add.existing(this.ground);
        this.ground.body.immovable = true;
        this.ground.body.allowGravity = false;
        this.ground.body.setCollideWorldBounds(true);
        this.ground.setOrigin(0, 0).setDepth(10);

        this.platforms = this.physics.add.staticGroup();

        this.physics.add.collider(this.firstEnemy, this.ground);
        this.physics.add.collider(this.player, this.ground);
        this.physics.add.collider(this.player, this.firstEnemy, this.gameOver, null, this);
        this.physics.add.collider(this.pet, this.ground);

        this.enemies = this.physics.add.group();
        this.physics.add.collider(this.enemies, this.platforms);
        this.physics.add.collider(this.enemies, this.ground);

        // this.powerUps = this.physics.add.group({

        // });
        this.verticalCollectibles = this.physics.add.group({
            defaultKey: 'collectible',
            runChildUpdate: true,
            allowGravity: false
        });
        this.waveCollectibles = this.physics.add.group({
            defaultKey: 'collectible',
            runChildUpdate: true,
            allowGravity: false
        });


        this.cameras.main.setBounds(0, 0, this.finishPoint + 200, this.game.config.height);
        // this.physics.add.collider(this.powerUps, this.ground);
        // this.physics.add.collider(this.powerUps, this.platforms);

        this.cameras.main.startFollow(this.player);

        this.physics.add.overlap(this.player, this.verticalCollectibles, this.collectPowerUp, null, this);
        this.physics.add.overlap(this.player, this.waveCollectibles, this.collectPowerUp, null, this);
        this.highestX = this.player.x;
        this.physics.add.collider(this.player, this.enemies, this.gameOver, null, this);
        this.physics.add.collider(this.bullets, this.enemies, this.bulletHit, null, this);
        this.physics.add.collider(this.bullets, this.platforms);
        this.physics.add.collider(this.bullets, this.ground);

        this.playerMovedBackFrom = this.player.x;
        this.canSpawnEnemies = true;
        this.canspawnCollectibles = true;
        this.createMobileButtons();
        this.bindWalkingMovementButtons();

        this.updateMeterBar();
        this.time.addEvent({
            delay: 5000, // 0.5 seconds
            callback: this.decreaseMeter,
            args: [5],
            callbackScope: this,
            loop: true
        });


        this.emitter = this.add.particles(this.pet.x, this.pet.y, 'heart', {
            speed: { min: -100, max: 300 },
            scale: { start: 0.07, end: 0 },
            blendMode: 'NORMAL',
            lifespan: 1750,
        });

        this.emitter.stop();

    }
    // handlePlayerGroundCollision(player, ground) {
    //     if (this.isPlayerInAir && player.body.touching.down && ground.body.touching.up) {
    //         this.cameras.main.shake(350, 0.009);
    //         this.isPlayerInAir = false; // Player has landed
    //     }
    // }

    updateMeterBar() {
        // Clear previous graphics
        this.meterBar.clear();

        // Define the meter bar dimensions and position
        const barX = 400;
        const barY = 40;
        const barWidth = 450; // Total width of the bar
        const barHeight = 35; // Height of the bar

        const filledWidth = Phaser.Math.Clamp(this.meterValue / 100 * barWidth, 0, barWidth);
        console.log(this.meterValue);
        // Draw the background of the bar
        this.meterBar.fillStyle(0x000000); // Black color for background
        this.meterBar.fillRect(barX, barY, barWidth, barHeight);

        // Set the color based on the increase condition (e.g., green when increased)
        const fillColor = 0x00ff00; // Green color for increase

        // Draw the filled portion of the bar
        this.meterBar.fillStyle(fillColor);
        this.meterBar.fillRect(barX, barY, filledWidth, barHeight);

        // Draw the outline of the bar
        this.meterBar.lineStyle(2, 0xffffff); // White outline
        this.meterBar.strokeRect(barX, barY, barWidth, barHeight);
        // this.meterBar.setDepth(-5);
        // Update the text
        this.meterText.setText(`Happiness Meter: ${this.meterValue}`);

    }
    increaseMeter(value) {
        this.meterValue = Phaser.Math.Clamp(this.meterValue + value, 0, 100);
        this.updateMeterBar();
        this.checkForExplode();

    }

    decreaseMeter(value) {
        this.meterValue = Phaser.Math.Clamp(this.meterValue - value, 0, 100);
        this.updateMeterBar();
    }


    update(time, delta) {
        if (this.player.x > this.endPole.x - 20) {
            this.player.setTint(0x00ff00);
            this.physics.pause();
            this.time.delayedCall(1000, () => {
                this.gameOver();
            });
        }


        this.waveCollectibles.children.each((collectible) => {
            if (collectible.active) {
                collectible.y = collectible.initialY + collectible.waveAmplitude * Math.cos((collectible.startX - collectible.x) * collectible.waveFrequency);
            }
            if (collectible.x < 0) {
                collectible.destroy();
            }
        }, this);


        if ((this.cursors.left.isDown || this.joystickKeys.left.isDown) && this.player.x > this.cameras.main.scrollX) {
            this.player.leftShoot = true;
            if (this.canSpawnEnemies) this.canSpawnEnemies = false;
            if (!this.canspawnCollectibles) this.canspawnCollectibles = false;
            if (this.playerMovedBackFrom < this.player.x) {
                this.playerMovedBackFrom = this.player.x;
            }
            this.cameras.main.stopFollow();
            this.player.flipX = true;
            this.player.setVelocityX(-160);


        } else if (this.cursors.right.isDown || this.joystickKeys.right.isDown) {
            this.player.leftShoot = false;
            if (!this.canSpawnEnemies) this.canSpawnEnemies = true;
            if (this.canspawnCollectibles) this.canspawnCollectibles = true;

            if (this.player.x > this.playerMovedBackFrom) {
                this.cameras.main.startFollow(this.player);
            }

            this.player.setVelocityX(160);
            this.player.flipX = false;

        } else {
            this.player.setVelocityX(0);
            this.canSpawnEnemies = false;
            this.canspawnCollectibles = true;
        }

        if ((this.cursors.up.isDown || this.buttonA.button.isDown) && this.player.body.touching.down) {
            this.sounds.jump.setVolume(1).setLoop(false).play();
            this.player.setVelocityY(-650); this.isPlayerInAir = true;


            this.tweens.add({
                targets: this.pet,
                y: this.player.y,
                ease: 'Power1',
                duration: 200,
                onComplete: () => {
                    this.pet.setVelocityY(-650);
                }
            });
        }

        if (time > this.nextEnemyTime) {
            this.spawnEnemy();
            this.nextEnemyTime = time + Phaser.Math.Between(2000, 6000);
        }

        if (time > this.nextCollectTime) {
            // console.log("canSpawnCollectibles " + this.canspawnCollectibles);

            this.spawnCollectibles();
            this.nextCollectTime = time + Phaser.Math.Between(2000, 6000);
        }

        // console.log("canSpawnCollectibles " + this.canspawnCollectibles);

        const followDistance = 10; const followSpeed = 400;
        const jumpHeight = -100;
        const groundY = 700;

        const deltaX = this.player.x - this.pet.x;
        const deltaY = this.player.y - this.pet.y;

        if (Math.abs(deltaX) > followDistance) {
            this.tweens.add({
                targets: this.pet,
                x: this.player.x - (deltaX > 0 ? followDistance : -followDistance),
                ease: 'Linear',
                duration: 500,
                onComplete: () => {
                    this.pet.flipX = deltaX < 0;
                }
            });
        }

        if (this.player.y < groundY - 50 && this.pet.body.touching.down) {
            this.pet.body.velocity.y = jumpHeight;
        }

        if (this.pet.y > groundY) {
            this.pet.y = groundY;
            this.pet.body.velocity.y = 0;
        }
        this.emitter.setPosition(this.pet.x, this.pet.y);

    }

    bindWalkingMovementButtons() {
        this.input.keyboard.on('keydown-RIGHT', this.walkingAnimationStart, this);
        this.input.keyboard.on('keydown-LEFT', this.walkingAnimationStart, this);
        this.input.keyboard.on('keyup-RIGHT', this.walkingAnimationStop, this);
        this.input.keyboard.on('keyup-LEFT', this.walkingAnimationStop, this);
        this.joystickKeys.left.on('down', this.walkingAnimationStart, this)
        this.joystickKeys.right.on('down', this.walkingAnimationStart, this)
        this.joystickKeys.left.on('up', this.walkingAnimationStop, this)
        this.joystickKeys.right.on('up', this.walkingAnimationStop, this)
    }

    walkingAnimationStart() {
        this.animEvent && this.animEvent.destroy();
        this.animEvent = this.time.addEvent({
            delay: 200,
            callback: () => {
                if (this.player.leftLeg) {
                    this.player.leftLeg = false;
                    this.player.rightLeg = true;
                    this.player.setAngle(-5);
                    this.pet.setAngle(5);
                } else {
                    this.player.leftLeg = true;
                    this.player.rightLeg = false;
                    this.player.setAngle(5);
                    this.pet.setAngle(-5);
                }
            },
            loop: true
        });
    }

    walkingAnimationStop() {
        this.player.setAngle(0);
        this.pet.setAngle(0);
        this.animEvent.destroy();
    }

    spawnEnemy() {
        if (!this.canSpawnEnemies) return;
        let x = this.player.x + this.game.config.width;
        let y = this.game.config.height - 200;
        // console.log("enemy out");

        let enemy = this.enemies.create(x, y, 'enemy').setScale(.4);
        enemy.body.setSize(enemy.body.width / 3, enemy.body.height / 2);
        enemy.setGravityY(100);
        enemy.setBounceX(1);
    }

    spawnCollectibles() {
        if (!this.canSpawnCollectibles) {
            console.log("spawnCollectibles");
            let x = this.player.x + this.game.config.width;
            let y = Phaser.Math.Between(220, this.game.config.height - 300);
            let speed = -50;

            // Randomly decide which type of collectible to spawn
            let type = Phaser.Math.Between(0, 1); // 0 for vertical, 1 for wave

            if (type === 0) {
                // Vertical movement collectible
                let collectible = this.verticalCollectibles.create(x, y, 'collectible').setScale(.3);
                collectible.body.setSize(collectible.body.width / 1.2, collectible.body.height / 1.5);

                this.tweens.add({
                    targets: collectible,
                    y: y + 50,
                    yoyo: true,
                    repeat: -1,
                    duration: 1000,
                    ease: 'Sine.easeInOut'
                });

            } else {
                let collectible = this.waveCollectibles.create(x, y, 'collectible').setScale(.3);
                collectible.setVelocityX(speed);
                collectible.body.setSize(collectible.body.width / 1.2, collectible.body.height / 1.5);
                this.vfx.scaleGameObject(collectible);

                // Add custom properties to track wave movement
                collectible.initialY = 420;
                collectible.waveAmplitude = 150;
                collectible.waveFrequency = 0.005;
                collectible.startX = x;
            }
        }
    }

    collectPowerUp(player, powerUp) {
        this.vfx.addShine(powerUp);
        this.increaseMeter(10);
        powerUp.destroy();

        // emitter.setPosition(x, y);
        this.emitter.explode(3);

        if (player.power_state === PLAYER_STATE.SMALL) {
            this.powerUpText.text = "SIZE POWER UP";
            this.blinkEffect(this.powerUpText, 200, 5);
            player.power_state++;
            this.sounds.upgrade_1.setVolume(1).setLoop(false).play();

            this.tweens.add({
                targets: this.player,
                y: player.y - 30,
                scaleY: player.scaleX + 0.03,
                scaleX: player.scaleY + 0.03,
                duration: 100,
                ease: 'Power1',
            })
        } else if (player.power_state === PLAYER_STATE.BIG) {
            this.powerUpText.text = "BULLET POWER UP"
            this.blinkEffect(this.powerUpText, 200, 5);
            player.power_state++;
            this.sounds.upgrade_2.setVolume(1).setLoop(false).play();
            player.setTint(0xff00ff);
        } else {
            this.updateScore(10);
        }

    }

    checkForExplode() {
        if (this.meterValue >= 50 && this.meterValue <= 55) {
            this.emitter.setPosition(this.player.x, this.player.y);
            this.emitter.explode(7);
        } else if (this.meterValue === 100) {
            this.emitter.setPosition(this.player.x, this.player.y);
            if (!this.oneTime) {
                this.emitter.explode(100);
                this.oneTime = true;
                // Add this section to trigger game over when meter is full
                this.time.delayedCall(2000, () => {
                    this.physics.pause();
                    this.player.setTint(0x00ff00);
                    this.gameOver();
                });
            }
            else {
                this.emitter.explode(15);
            }
        }
    }



    createMobileButtons() {
        const joyStickRadius = 80;

        if (joystickEnabled) {
            this.joyStick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
                x: joyStickRadius * 1.5,
                y: this.height - (joyStickRadius * 1.6),
                radius: 80,
                base: this.add.circle(0, 0, 80, 0x888888, 0.5),
                thumb: this.add.circle(0, 0, 40, 0xcccccc, 0.5),
                // dir: '8dir',   // 'up&down'|0|'left&right'|1|'4dir'|2|'8dir'|3
                // forceMin: 16,
            });

            this.joystickKeys = this.joyStick.createCursorKeys();
        }

        if (buttonEnabled) {
            this.buttonA = this.add.rectangle(this.width - 60, this.height - 60, 100, 100, 0xcccccc, 0.5)
            this.buttonA.button = this.plugins.get('rexbuttonplugin').add(this.buttonA, {
                mode: 1,
                clickInterval: 10,
            });
            this.buttonA.setDepth(11).setScrollFactor(0);
            this.buttonB = this.add.circle(this.width - 60, this.height - 220, 60, 0xcccccc, 0.5)
            this.buttonB.button = this.plugins.get('rexbuttonplugin').add(this.buttonB, {
                mode: 1,
                clickInterval: 5,
            });
            this.buttonB.setDepth(11).setScrollFactor(0);
            // this.buttonB.button.on('down', this.shootBullet, this);
        }

        this.toggleControlsVisibility(isMobile)
    }

    toggleControlsVisibility(visibility) {
        this.joyStick.base.visible = visibility;
        this.joyStick.thumb.visible = visibility;
        this.buttonA.visible = visibility;
        this.buttonB.visible = visibility;
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(`x ${this.score}`);
    }

    gameOver() {
        this.sound.stopAll();
        // this.scene.stop();
        initiateGameOver.bind(this)({
            coins: this.score,
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
        console.log(file.src);
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
    },
    pixelArt: true,
    /* ADD CUSTOM CONFIG ELEMENTS HERE */
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 300 },
            debug: false,
        },
    },
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions,
    },
    orientation: _CONFIG.deviceOrientation === "landscape"
};