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
        this.nextBricksTime = 0;
        this.scoreText = null;
        this.powerUps = null;
        this.score = 0;
        this.width = this.game.config.width;
        this.height = this.game.config.height;
    }

    preload() {
        // Load image assets using direct URL strings, except for player and enemy

        this.load.image("background", "https://aicade-user-store.s3.amazonaws.com/1334528653/games/1EfhKOphiHv3PzOw/assets/images/Screenshot%202025-04-02%20233355-Photoroom.png?t=1743617430629");
        
        // Load player and enemy using the old method
        this.load.image("player", _CONFIG.imageLoader.player);
        this.load.image("enemy", _CONFIG.imageLoader.enemy);
    
        this.load.image("collectible", "https://aicade-user-store.s3.amazonaws.com/1334528653/games/1EfhKOphiHv3PzOw/assets/images/newAsset_12.png?t=1743665247183");
        this.load.image("collectible_1", "https://aicade-user-store.s3.amazonaws.com/1334528653/games/1EfhKOphiHv3PzOw/assets/images/newAsset_8.png?t=1743665381909");
        this.load.image("projectile", "https://aicade-user-store.s3.amazonaws.com/1334528653/games/1EfhKOphiHv3PzOw/assets/images/newAsset_10.png?t=1743668862744");
        this.load.image("platform", "https://aicade-user-store.s3.amazonaws.com/1334528653/games/1EfhKOphiHv3PzOw/assets/images/Screenshot%202025-04-02%20233410.png?t=1743617599903");
        this.load.image("platformGlow", "https://aicade-user-store.s3.amazonaws.com/1334528653/games/1EfhKOphiHv3PzOw/assets/images/Screenshot%202025-04-02%20233422.png?t=1743617757767");

        
        // Load additional UI assets
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
        this.load.bitmapFont('pixelfont',
            "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.png",
            "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.xml"
        );
        
        // Load audio assets using direct URL strings
        this.load.audio("background", ["https://aicade-user-store.s3.amazonaws.com/GameAssets/music/Super%20Mario%20Bros.%20Theme%20Song_6dcc911a-75bd-4e82-9f53-e542146ff9c9.mp3?t=1743667399595"]);
        this.load.audio("lose", ["https://aicade-user-store.s3.amazonaws.com/GameAssets/music/mario%20lose_8c4b4d4d-a4a1-4943-ada5-417b192f6ab6.mp3?t=1743675830252"]);
        this.load.audio("damage", ["https://aicade-ui-assets.s3.amazonaws.com/GameAssets/sfx/damage_1.mp3"]);
        this.load.audio("jump", ["https://aicade-user-store.s3.amazonaws.com/GameAssets/music/mario%20jump_8eec73f2-5531-4f0e-a301-f53b99846ee4.mp3?t=1743675889691"]);
        this.load.audio("destroy", ["https://aicade-ui-assets.s3.amazonaws.com/GameAssets/sfx/flap_1.wav"]);
        this.load.audio("upgrade_1", ["https://aicade-ui-assets.s3.amazonaws.com/GameAssets/sfx/upgrade_1.mp3"]);
        this.load.audio("upgrade_2", ["https://aicade-user-store.s3.amazonaws.com/GameAssets/music/mario%20upgrade_cdd0775d-ba78-4e15-b7de-26d086dc686d.mp3?t=1743675886252"]);
        this.load.audio("collect", ["https://aicade-ui-assets.s3.amazonaws.com/GameAssets/sfx/collect_3.mp3"]);
        this.load.audio("shoot", ["https://aicade-user-store.s3.amazonaws.com/GameAssets/music/mario%20fireball_be569211-d077-4267-8306-122b34da14f1.mp3?t=1743675865122"]);
        this.load.audio("stretch", ["https://aicade-ui-assets.s3.amazonaws.com/GameAssets/sfx/shoot_1.mp3"]);
        this.load.audio("success", ["https://aicade-user-store.s3.amazonaws.com/GameAssets/music/mario%20win_6f2168d3-b74c-461d-bf77-35104ec0dfff.mp3?t=1743675851396"]);
        
        // Load plugins if enabled
        if (joystickEnabled) {
            this.load.plugin('rexvirtualjoystickplugin', "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js", true);
        }
        if (buttonEnabled) {
            this.load.plugin('rexbuttonplugin', "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexbuttonplugin.min.js", true);
        }
        
        // Attach additional event listeners and display the progress loader
        addEventListenersPhaser.bind(this)();
        displayProgressLoader.call(this);
    }
    
    create() {
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }
        isMobile = !this.sys.game.device.os.desktop;
        this.vfx = new VFXLibrary(this);

        this.sounds.background.setVolume(0.1).setLoop(true).play();

        this.input.addPointer(3);
        this.score = 0;
        this.meter = 0;
        this.finishPoint = 20000;
        this.playerState = PLAYER_STATE.SMALL; // 0 : small | 1 : Big | 2 : Big + Bullets
        this.brickSize = 50;

        // Create a tileSprite that covers more vertical space so it repeats the background image
        this.bg = this.add.tileSprite(
            0,
            0,
            this.finishPoint + 200,
            this.game.config.height * 1.5,
            'background'
        ).setOrigin(0, 0.04);

        // Adjust the tile position so that the bottom of the repeated image aligns with the bottom of the screen
        this.bg.tilePositionY = this.bg.height - this.game.config.height;

        this.bg.setScrollFactor(1);

        this.endPole = this.add.sprite(this.finishPoint, 100, 'platform').setOrigin(0, 0);
        this.endPole.setScrollFactor(1);
        this.endPole.displayHeight = this.game.config.height;
        this.endPole.displayWidth = 40;
        // Add UI elements
        this.meterText = this.add.bitmapText(10, 7, 'pixelfont', 'Meter: 0m', 28);
        this.meterText.setScrollFactor(0).setDepth(11);

        this.scoreImg = this.add.image(30, 80, 'collectible_1').setScale(0.1, 0.1).setScrollFactor(0).setDepth(11);
        this.scoreText = this.add.bitmapText(60, 50, 'pixelfont', 'x 0', 28);
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

        this.player = this.physics.add.sprite(0, 500, 'player').setScale(0.15).setBounce(0.1).setCollideWorldBounds(true);

        this.player.body.setSize(this.player.body.width / 1.5, this.player.body.height);
        this.player.setGravityY(800);
        this.player.power_state = PLAYER_STATE.SMALL;

        this.cursors = this.input.keyboard.createCursorKeys();

        this.bullets = this.physics.add.group({
            defaultKey: 'projectile',
            active: false,
            maxSize: 20
        });

        // Replace the visible platform asset with an invisible ground rectangle
        this.ground = this.add.rectangle(
            0,
            this.game.config.height - 50,  // Position so that the top of the ground is at (game height - 50)
            this.finishPoint + 200,
            50
        ).setOrigin(0, 0);
        this.physics.add.existing(this.ground, true);

        this.platforms = this.physics.add.staticGroup();
        // First row y is defined as:
        let firstRowY = this.game.config.height - this.ground.displayHeight - this.player.displayHeight - 100;
        // Create initial first row platforms
        let x = this.player.x + this.game.config.width / 2 + 100;
        let platform = this.platforms.create(x, firstRowY, 'platform');
        platform.displayHeight = platform.displayWidth = this.brickSize;
        platform.refreshBody();
        let i = 5;
        while (i) {
            x = x + platform.displayWidth + 1;
            platform = this.platforms.create(x, firstRowY, 'platform');
            platform.displayHeight = platform.displayWidth = this.brickSize;
            platform.refreshBody();
            i--;
        }

        // Later, additional platforms are spawned by spawnBricks (which can be for a second row)
        this.physics.add.collider(this.player, this.platforms, this.hitBrick, null, this);
        this.physics.add.collider(this.player, this.ground);

        this.enemies = this.physics.add.group();
        this.physics.add.collider(this.enemies, this.platforms);
        this.physics.add.collider(this.enemies, this.ground);

        this.powerUps = this.physics.add.group();
        this.cameras.main.setBounds(0, 0, this.finishPoint + 200, this.game.config.height);
        this.physics.add.collider(this.powerUps, this.ground);
        this.physics.add.collider(this.powerUps, this.platforms);

        this.cameras.main.startFollow(this.player);

        this.physics.add.overlap(this.player, this.powerUps, this.collectPowerUp, null, this);
        this.highestX = this.player.x;
        this.physics.add.collider(this.player, this.enemies, this.onPlayerEnemyCollision, null, this);
        this.physics.add.collider(this.bullets, this.enemies, this.bulletHit, null, this);
        this.physics.add.collider(this.bullets, this.platforms);
        this.physics.add.collider(this.bullets, this.ground);

        this.playerMovedBackFrom = this.player.x;
        this.canSpawnEnemies = true;
        this.createMobileButtons();
        this.bindWalkingMovementButtons();
        this.input.keyboard.disableGlobalCapture();

        // In create(), add the jump key for spacebar jump
        this.jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    update(time, delta) {
        if (this.player.x > this.endPole.x - 20) {
            this.player.setTint(0x00ff00);
            this.physics.pause();
            this.time.delayedCall(1000, () => {
                this.gameOver();
            });
        }

        // Use either keyboard or our mobile left/right flags
        if ((this.cursors.left.isDown || this.leftPressed) && this.player.x > this.cameras.main.scrollX) {
            this.player.leftShoot = true;
            if (this.canSpawnEnemies) this.canSpawnEnemies = false;
            if (this.playerMovedBackFrom < this.player.x) {
                this.playerMovedBackFrom = this.player.x;
            }
            this.cameras.main.stopFollow();
            this.player.flipX = true;
            this.player.setVelocityX(-160);
        } else if ((this.cursors.right.isDown || this.rightPressed)) {
            this.player.leftShoot = false;
            if (!this.canSpawnEnemies) this.canSpawnEnemies = true;
            if (this.player.x > this.playerMovedBackFrom) {
                this.cameras.main.startFollow(this.player);
            }
            this.player.setVelocityX(160);
            this.player.flipX = false;
        } else {
            this.player.setVelocityX(0);
        }

        // Use spacebar (or buttonA) for jump
        if ((this.jumpKey.isDown || this.buttonA.button.isDown) && this.player.body.touching.down) {
            this.sounds.jump.setVolume(0.2).setLoop(false).play();
            this.player.setVelocityY(-750);
        }
        
        if (time > this.nextEnemyTime) {
            this.spawnEnemy();
            this.nextEnemyTime = time + Phaser.Math.Between(2000, 6000);
        }
        if (this.nextBricksTime && time > this.nextBricksTime && (this.cursors.right.isDown || this.rightPressed)) {
            this.nextBricksTime = time + Phaser.Math.Between(6000, 15000);
            let bricksNum = Phaser.Math.Between(2, 5);
            this.spawnBricks(bricksNum);
            if (Phaser.Math.Between(0, 5)) {
                this.spawnBricks(3, this.brickSize * bricksNum + 200, Phaser.Math.Between(150, 250));
            }
        }
        if (this.nextBricksTime == 0 && this.player.x > this.game.config.width) {
            this.nextBricksTime = time;
        }

        if (this.player.x > this.highestX) {
            this.highestX = this.player.x;
            this.meter = Math.abs(Math.round(this.player.x / 100));
            this.meterText.setText('Meter: ' + this.meter + 'm');
        }
    }

    bindWalkingMovementButtons() {
        this.input.keyboard.on('keydown-RIGHT', this.walkingAnimationStart, this);
        this.input.keyboard.on('keydown-LEFT', this.walkingAnimationStart, this);
        this.input.keyboard.on('keyup-RIGHT', this.walkingAnimationStop, this);
        this.input.keyboard.on('keyup-LEFT', this.walkingAnimationStop, this);
        // For keyboard-based controls if needed
        if (this.joystickKeys) {
            this.joystickKeys.left.on('down', this.walkingAnimationStart, this);
            this.joystickKeys.right.on('down', this.walkingAnimationStart, this);
            this.joystickKeys.left.on('up', this.walkingAnimationStop, this);
            this.joystickKeys.right.on('up', this.walkingAnimationStop, this);
        }
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
                } else {
                    this.player.leftLeg = true;
                    this.player.rightLeg = false;
                    this.player.setAngle(5);
                }
            },
            loop: true
        });
    }

    walkingAnimationStop() {
        this.player.setAngle(0);
        this.animEvent.destroy();
    }

    spawnBricks(numOfBricks = 2, XOffset = 100, YOffset = 0) {
        if (!this.canSpawnEnemies) return;
        let y = this.game.config.height - this.ground.displayHeight - 215 - YOffset;
        let x = this.player.x + this.game.config.width / 2 + 100 + XOffset;
        let platform = this.platforms.create(x, y, 'platform');
        platform.displayHeight = platform.displayWidth = this.brickSize;
        platform.refreshBody();
        let i = numOfBricks - 1;
        while (i > 0) {
            x = x + platform.displayWidth + 1;
            platform = this.platforms.create(x, y, 'platform');
            let coinProbability = Phaser.Math.Between(1, 10) % 3 === 0; // 33% chance
            let mushroomProbability = Phaser.Math.Between(1, 10) % 5 === 0; // 20% chance
            if (coinProbability) {
                platform.setTexture("platformGlow");
                platform.coin = Phaser.Math.Between(1, 5);
            } else if (mushroomProbability) {
                platform.setTexture("platformGlow");
                platform.mushroom = 1;
            }
            platform.displayHeight = platform.displayWidth = this.brickSize;
            platform.refreshBody();

            // If this is a second row (i.e. YOffset > 0) and a collectible brick was spawned,
            // spawn an extra platform in the first row (at firstRowY) with the normal asset.
            if (YOffset > 0 && (coinProbability || mushroomProbability)) {
                let firstRowY = this.game.config.height - this.ground.displayHeight - this.player.displayHeight - 100;
                let extraBrick = this.platforms.create(x, firstRowY, 'platform');
                extraBrick.displayHeight = extraBrick.displayWidth = this.brickSize;
                extraBrick.refreshBody();
            }
            i--;
        }
    }

    hitBrick(player, brick) {
        if (player.body.touching.up && brick.body.touching.down) {
            this.sounds.stretch.setVolume(0.2).setLoop(false).play();

            this.tweens.add({
                targets: this.cameras.main,
                y: this.cameras.main.worldView.y - 5,
                duration: 50,
                ease: 'Power1',
                yoyo: true,
                repeat: 0
            });
            this.tweens.add({
                targets: brick,
                y: brick.y - 10,
                duration: 50,
                ease: 'Linear',
                yoyo: true
            });
            if (brick.mushroom) {
                delete brick.mushroom;
                // Revert brick texture back to normal platform after power-up is collected
                brick.setTexture("platform");
                let powerUp = this.powerUps.create(brick.x, brick.y - 70, 'collectible').setScale(0.3);
                this.tweens.add({
                    targets: powerUp,
                    scaleY: 0.14,
                    scaleX: 0.14,
                    duration: 300,
                    ease: 'Power1',
                    onComplete: () => {
                        powerUp.setVelocityX(50);
                    }
                });
            }
            
            if (brick.coin) {
                brick.coin--;
                this.sounds.collect.setVolume(0.2).setLoop(false).play();

                this.updateScore(1);
                if (!brick.coin) {
                    // Revert brick texture back to normal platform when coins run out
                    brick.setTexture("platform");
                }
                let powerUp = this.powerUps.create(brick.x, brick.y - brick.displayHeight, 'collectible_1').setScale(0.2);
                this.tweens.add({
                    targets: powerUp,
                    scaleY: 0.07,
                    scaleX: 0.07,
                    duration: 200,
                    ease: 'Power1',
                    yoyo: true,
                    onComplete: (tween, targets) => {
                        targets[0].destroy();
                    },
                });
            }
        }
    }

    spawnEnemy() {
        if (!this.canSpawnEnemies) return;
        let x = this.player.x + this.game.config.width / 2;
        let fixedY = 650; // Set the enemy's fixed y-axis spawn position (adjust as needed)
    
        let enemy = this.enemies.create(x, fixedY, 'enemy').setScale(0.18);
        let speed = -150;
        if (this.player.power_state === PLAYER_STATE.BIG) {
            speed = -200;
        } else if (this.player.power_state === PLAYER_STATE.BULLETS) {
            speed = -250;
        }
        enemy.setVelocityX(speed);
        enemy.setGravityY(100);
        enemy.setBounceX(1);
        enemy.body.setSize(enemy.width * 0.8, enemy.height * 0.7);
        enemy.body.setOffset(enemy.width * 0.2, enemy.height * 0.1);
    }
    
    blinkEffect(object = this.powerUpText, duration = 300, blinks = 3) {
        this.blinkTween && this.blinkTween.stop();
        object.setAlpha(0);
        this.blinkTween = this.tweens.add({
            targets: object,
            alpha: 1,
            duration: duration,
            yoyo: true,
            repeat: blinks - 1,
            ease: 'Power1',
            onComplete: () => {
                object.setAlpha(0);
            },
            onStop: () => {
                object.setAlpha(0);
            }
        });
    }

    collectPowerUp(player, powerUp) {
        powerUp.destroy();

        if (player.power_state === PLAYER_STATE.SMALL) {
            this.powerUpText.text = "SIZE POWER UP";
            this.blinkEffect(this.powerUpText, 200, 5);
            player.power_state++;
            // When collecting the size power-up:
            this.sounds.upgrade_1.setVolume(0.1).setLoop(false).play();

            // When collecting the bullet power-up:
            this.sounds.upgrade_2.setVolume(0.001).setLoop(false).play();

            // Multiply the current dimensions by a factor (e.g., 1.5x increase)
            this.tweens.add({
                targets: this.player,
                y: player.y - 30,
                scaleX: this.player.scaleX * 1.5,
                scaleY: this.player.scaleY * 1.5,
                duration: 100,
                ease: 'Power1'
            });
        } else if (player.power_state === PLAYER_STATE.BIG) {
            this.powerUpText.text = "BULLET POWER UP";
            this.blinkEffect(this.powerUpText, 200, 5);
            player.power_state++;
            this.sounds.upgrade_2.setVolume(1).setLoop(false).play();
            player.setTint(0xff00ff);
            this.input.keyboard.on('keydown-Z', this.shootBullet, this);
            this.colorAnimation(true, this.player);
        } else {
            this.updateScore(10);
        }
    }

    colorAnimation(startColorAnimation, obj) {
        if (!startColorAnimation && this.colorAnimEvent) {
            this.colorAnimEvent.destroy();
            obj.setTint(0xffffff);
            return;
        }

        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        let currentIndex = 0;

        // Change color every 100 milliseconds
        this.colorAnimEvent = this.time.addEvent({
            delay: 100,
            callback: () => {
                obj.setTint(colors[currentIndex]);
                currentIndex++;
                if (currentIndex >= colors.length) {
                    currentIndex = 0;
                }
            },
            loop: true
        });
    }

    shootBullet() {
        if (this.player.power_state === PLAYER_STATE.BULLETS) {
            this.sounds.shoot.setVolume(0.2).setLoop(false).play();
            let bullet = this.bullets.get(this.player.x, this.player.y);
            if (bullet) {
                bullet.setActive(true)
                      .setVisible(true)
                      .setScale(0.08)
                      .setVelocityX(this.player.leftShoot ? -300 : 300)
                      .setVelocityY(-200)            // Initial upward velocity for bounce effect
                      .setCollideWorldBounds(true);  // Enable collision with the world bounds
                bullet.body.setBounce(0.8);         // Bounce value (adjust this value to increase or decrease the bounce)
                // Removed the delayedCall so the bullet bounces indefinitely until destroyed
            }
        }
    }
    
    bulletHit(bullet, enemy) {
        this.sounds.destroy.setVolume(0.2).setLoop(false).play();

        bullet.setActive(false);
        bullet.setVisible(false);
        bullet.body.stop();

        this.blueEmitter = this.vfx.createEmitter('enemy', enemy.x, enemy.y, 0.01, 0, 600);
        this.blueEmitter.explode(300);
        enemy.destroy();
        this.updateScore(1);
    }

    onPlayerEnemyCollision(player, enemy) {
        if (player.body.touching.down && enemy.body.touching.up) {
            // Play stomp sound
            this.sounds.destroy.setVolume(0.2).setLoop(false).play();

            // Bounce the player upward (adjust this value as desired)
            player.setVelocityY(-300);

            // Adjustable parameters for enemy movement:
            const ENEMY_BOUNCE_UP = 20;     // How far enemy moves up when stomped
            const ENEMY_FALL_DISTANCE = 150; // How far enemy falls down before destruction

            // First tween: enemy bounces upward
            this.tweens.add({
                targets: enemy,
                y: enemy.y - ENEMY_BOUNCE_UP,
                duration: 200,
                ease: 'Power1',
                onComplete: () => {
                    // Second tween: enemy falls down and then is destroyed
                    this.tweens.add({
                        targets: enemy,
                        y: enemy.y + ENEMY_FALL_DISTANCE,
                        duration: 300,
                        ease: 'Bounce.easeOut',
                        onComplete: () => {
                            enemy.destroy();
                        }
                    });
                }
            });
        } else {
            this.input.keyboard.off('keydown-SPACE', this.shootBullet, this);
            if (player.power_state === PLAYER_STATE.BULLETS) {
                this.sounds.damage.setVolume(1).setLoop(false).play();
                this.colorAnimation(false, this.player);
                player.power_state--;
                player.setAngularVelocity(-900);
                this.time.delayedCall(500, () => {
                    player.setAngle(0);
                    player.setAngularVelocity(0);
                });
                this.cameras.main.shake(50);
                enemy.destroy();
            } else if (player.power_state === PLAYER_STATE.BIG) {
                this.sounds.damage.setVolume(1).setLoop(false).play();
                player.power_state--;
                player.setAngularVelocity(-900);
                this.time.delayedCall(500, () => {
                    player.setAngle(0);
                    player.setAngularVelocity(0);
                });
                this.tweens.add({
                    targets: player,
                    scaleY: player.scaleX - 0.03,
                    scaleX: player.scaleY - 0.03,
                    duration: 100,
                    ease: 'Power1'
                });
                this.cameras.main.shake(100);
                enemy.destroy();
            } else {
                console.log("lose");
                player.setTint(0xff0000);
                this.physics.pause();
                this.cameras.main.shake(200);

                this.sound.stopAll();
                this.sounds.lose.setVolume(0.2).setLoop(false).play();

                this.sounds.lose.on('complete', () => {
                    this.gameOver();
                });
            }
        }
    }

    createMobileButtons() {
        // Remove joystick and add left/right buttons on bottom left
        // Left button
        this.leftButton = this.add.rectangle(80, this.height - 60, 100, 100, 0xcccccc, 0.5)
            .setScrollFactor(0)
            .setInteractive();
        // Right button
        this.rightButton = this.add.rectangle(200, this.height - 60, 100, 100, 0xcccccc, 0.5)
            .setScrollFactor(0)
            .setInteractive();

        // Set up pointer events to toggle movement flags
        this.leftButton.on('pointerdown', () => { this.leftPressed = true; });
        this.leftButton.on('pointerup', () => { this.leftPressed = false; });
        this.leftButton.on('pointerout', () => { this.leftPressed = false; });

        this.rightButton.on('pointerdown', () => { this.rightPressed = true; });
        this.rightButton.on('pointerup', () => { this.rightPressed = false; });
        this.rightButton.on('pointerout', () => { this.rightPressed = false; });

        // Also create the standard mobile buttons on the bottom right
        if (buttonEnabled) {
            this.buttonA = this.add.rectangle(this.width - 60, this.height - 60, 100, 100, 0xcccccc, 0.5);
            this.buttonA.button = this.plugins.get('rexbuttonplugin').add(this.buttonA, {
                mode: 1,
                clickInterval: 10,
            });
            this.buttonA.setDepth(11).setScrollFactor(0);
            this.buttonB = this.add.circle(this.width - 60, this.height - 220, 60, 0xcccccc, 0.5);
            this.buttonB.button = this.plugins.get('rexbuttonplugin').add(this.buttonB, {
                mode: 1,
                clickInterval: 5,
            });
            this.buttonB.setDepth(11).setScrollFactor(0);
            this.buttonB.button.on('down', this.shootBullet, this);
        }
        // Hide any joystick if present
        if (this.joyStick) {
            this.joyStick.destroy();
        }
        // Toggle controls visibility if needed
        this.toggleControlsVisibility(isMobile);
    }

    toggleControlsVisibility(visibility) {
        // For mobile, our buttons are always visible; if needed, you can hide them via this method.
        if(this.leftButton) this.leftButton.visible = visibility;
        if(this.rightButton) this.rightButton.visible = visibility;
        if(this.buttonA) this.buttonA.visible = visibility;
        if(this.buttonB) this.buttonB.visible = visibility;
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
            meter: this.meter,
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
    this.load.on('fileprogress', function (file) {});
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
    deviceOrientation: _CONFIG.deviceOrientation==="landscape"
};
