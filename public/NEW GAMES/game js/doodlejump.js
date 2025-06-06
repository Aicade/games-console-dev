// Touch Screen Controls Configuration
const joystickEnabled = false; // Disabled as Doodle Jump only needs left/right
const buttonEnabled = true;    
const hideButtons = true;     
var isMobile = false;


const rexButtonUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexbuttonplugin.min.js";

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    /** Initialize game variables */
    init() {
        this.cursors = null;
        this.player = null;
        this.platforms = null;
        this.springGroup = null;
        this.enemies = null;           // Group for enemies
        this.bullets = null;           // Group for bullets
        this.jetpacks = null;          // Group for jetpack power-ups
        this.scoreText = null;
        this.score = 0;
        this.highestY = 0;
        this.startingY = 0;
        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.leftPressed = false;
        this.rightPressed = false;
        this.enemySpeed = 100;         // Decreased enemy movement speed
        this.jetpackActive = false;    // Flag for jetpack power-up active
        this.defaultPlayerTexture = 'player'; // Store default texture
        this.defaultPlayerScale = 0.15;         // Constant default player scale

        // We'll store the player's default body size after creation
        this.defaultBodyWidth = 0;
        this.defaultBodyHeight = 0;

        // These variables allow manual adjustment of the jetpack player's hitbox size.
        this.jetpackBodyWidth = 0;  // will be set after default body size is known
        this.jetpackBodyHeight = 0;
    }

    /** Load game assets */
    preload() {
        // Images
        this.load.image("background", _CONFIG.imageLoader.background);
        this.load.image("player", _CONFIG.imageLoader.player);
        ;
        this.load.image("platform", _CONFIG.imageLoader.platform);
        
        this.load.bitmapFont('pixelfont', _CONFIG.fontLoader.pixelfont.png, _CONFIG.fontLoader.pixelfont.xml);
        
       
        this.load.image("enemy", _CONFIG.imageLoader.enemy);
        this.load.image("collectible", _CONFIG.imageLoader.collectible);
        

        this.load.image("playerShoot", _CONFIG.libLoader.playerShooter); // Use playerShooter for shooting animation
    this.load.image("spring", _CONFIG.libLoader.spring);
    this.load.image("pauseButton", _CONFIG.libLoader.pauseButton);
    this.load.image("crack", _CONFIG.libLoader.crack);
    this.load.image("jetpackPlayer", _CONFIG.libLoader.jetpackPlayer);

        // Audio
        this.load.audio("background", [_CONFIG.soundsLoader.background]);
        this.load.audio("lose", [_CONFIG.soundsLoader.lose]);
        this.load.audio("jump", [_CONFIG.soundsLoader.jump]);
        this.load.audio("collect", [_CONFIG.soundsLoader.collect]);
        this.load.audio("success", [_CONFIG.soundsLoader.success]);
        this.load.audio("springSound", [_CONFIG.soundsLoader.springSound]);
        this.load.audio("jetpackSound", [_CONFIG.soundsLoader.jetpackSound]);
        this.load.audio("crackSound", [_CONFIG.soundsLoader.crackSound]);
        this.load.audio("enemySound", [_CONFIG.soundsLoader.enemySound]);

        // Load button plugin for mobile controls
        if (buttonEnabled) {
            this.load.plugin('rexbuttonplugin', rexButtonUrl, true);
        }
        this.displayProgressLoader();
    }

    /** Display a loading progress bar */
    displayProgressLoader() {
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
            style: { font: '20px monospace', fill: '#ffffff' }
        }).setOrigin(0.5, 0.5);

        const progressBar = this.add.graphics();
        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0x364afe, 1);
            progressBar.fillRect(x, y, width * value, height);
        });
        this.load.on('fileprogress', (file) => {});
        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
        });
    }

    /** Set up the game world */
    create() {
        // Initialize sounds
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }
        this.sounds.springSound = this.sound.add('springSound', { loop: false, volume: 0.8 });
        this.sounds.jetpackSound = this.sound.add('jetpackSound', { loop: true, volume: 0.6 });
        this.sounds.crackSound = this.sound.add('crackSound', { loop: false, volume: 0.8 });
        this.sounds.enemySound = this.sound.add('enemySound', { loop: true, volume: 0.5 });

        isMobile = !this.sys.game.device.os.desktop;
        this.sounds.background.setVolume(0.01).setLoop(true).play();

        this.input.addPointer(3);
        this.score = 0;

        // Set up world and camera bounds for unlimited upward scrolling
        this.physics.world.setBounds(0, -1000000, this.game.config.width, 2000000);
        this.cameras.main.setBounds(0, -1000000, this.game.config.width, 2000000);

        // Background tile sprite
        this.bg = this.add.tileSprite(0, 0, this.game.config.width, this.game.config.height, 'background')
            .setOrigin(0, 0)
            .setScrollFactor(0);

        // Create a graphics object for debugging hitboxes
        this.debugGraphics = this.add.graphics();

        // Spawn the first platform at the bottom middle
        const firstPlatformX = this.game.config.width / 2;
        const firstPlatformY = this.game.config.height - 50;
        const firstPlatform = this.physics.add.staticSprite(firstPlatformX, firstPlatformY, 'platform')
            .setScale(0.5)
            .refreshBody();
        firstPlatform.displayWidth = 200;
        firstPlatform.displayHeight = 20;
        firstPlatform.body.setSize(firstPlatform.displayWidth, firstPlatform.displayHeight);
        firstPlatform.body.setOffset(-90, 0);

        // Position the player on the first platform using default scale
        this.player = this.physics.add.sprite(firstPlatformX, firstPlatformY - 50, 'player')
            .setScale(this.defaultPlayerScale)
            .setBounce(0.1);
        this.player.setGravityY(800);
        // Store the player's default physics body dimensions for later resetting
        this.defaultBodyWidth = this.player.body.width;
        this.defaultBodyHeight = this.player.body.height;
        // Define desired jetpack hitbox dimensions manually
        this.jetpackBodyWidth = this.defaultBodyWidth * 0.3;
        this.jetpackBodyHeight = this.defaultBodyHeight * 0.3;

        this.cursors = this.input.keyboard.createCursorKeys();

        // Create groups for springs, enemies, bullets and jetpacks
        this.springGroup = this.physics.add.group({ allowGravity: false, immovable: true });
        this.enemies = this.physics.add.group();
        this.bullets = this.physics.add.group();
        this.jetpacks = this.physics.add.group({ allowGravity: false, immovable: true });

        // Create bullet texture if it doesn't exist
        if (!this.textures.exists('bullet')) {
            let graphics = this.make.graphics({ x: 0, y: 0, add: false });
            graphics.lineStyle(2, 0x000000, 1);
            graphics.fillStyle(0x90ee90, 1);
            graphics.fillCircle(10, 10, 10);
            graphics.strokeCircle(10, 10, 10);
            graphics.generateTexture('bullet', 20, 20);
        }

        // Spawn additional platforms, springs, cracked platforms, jetpacks, etc.
        this.platforms = this.physics.add.staticGroup();
        this.platforms.add(firstPlatform);
        this.highestY = firstPlatformY;
        let prevY = firstPlatformY;
        let y = firstPlatformY - 100;
        while (y > -5000) {
            let x = Phaser.Math.Between(50, this.game.config.width - 50);
            const platform = this.platforms.create(x, y, 'platform').setScale(0.5).refreshBody();
            platform.displayWidth = 200;
            platform.displayHeight = 20;
            platform.body.setSize(platform.displayWidth, platform.displayHeight);
            platform.body.setOffset(-90, 0);
            
            // 20% chance for a cracked platform
            if (Phaser.Math.Between(0, 100) < 20) {
                platform.isCracked = true;
                platform.crackSprite = this.add.sprite(platform.x, platform.y, 'crack');
                platform.crackSprite.setDisplaySize(platform.displayWidth, platform.displayHeight);
                platform.crackSprite.setDepth(1);
            }
            
            // Determine if a spring should be spawned
            let gap = prevY - y;
            if (gap > 300) {
                let spring = this.springGroup.create(platform.x, platform.y - platform.displayHeight / 2 - 10, 'spring');
                spring.setScale(0.5);
            } else if (Phaser.Math.Between(0, 100) < 10) {
                let spring = this.springGroup.create(platform.x, platform.y - platform.displayHeight / 2 - 10, 'spring');
                spring.setScale(0.5);
            }
            // 10% chance to spawn a jetpack power-up on the platform
            if (Phaser.Math.Between(0, 100) < 5) {
                let jetpack = this.jetpacks.create(platform.x, platform.y - platform.displayHeight / 2 - 10, 'jetpack');
                jetpack.setScale(0.3);
            }
            prevY = y;
            y -= Phaser.Math.Between(50, 250);
            if (y < this.highestY) this.highestY = y;
        }

        // Set up collisions/overlaps
        this.physics.add.overlap(this.player, this.springGroup, this.hitSpring, null, this);
        this.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);
        this.physics.add.overlap(this.bullets, this.enemies, this.hitEnemyWithBullet, null, this);
        this.physics.add.overlap(this.player, this.jetpacks, this.collectJetpack, null, this);

        // Set initial camera position
        this.cameras.main.scrollY = this.player.y - this.game.config.height + 100;

        // Score UI: add the score text and create a bold, translucent box around it.
        this.scoreText = this.add.bitmapText(10, 10, 'pixelfont', 'Score: 0', 28).setScrollFactor(0);
        const padding = 10;
        const offsetX = 20;
        const offsetY = 15;
        const extraWidth = 100;
        const bounds = this.scoreText.getTextBounds();
        this.scoreBox = this.add.graphics();
        this.scoreBox.lineStyle(6, 0x000000, 1);
        this.scoreBox.fillStyle(0x000000, 0.5);
        this.scoreBox.strokeRect(bounds.local.x - padding + offsetX, bounds.local.y - padding + offsetY, bounds.local.width + padding * 2 + extraWidth, bounds.local.height + padding * 2);
        this.scoreBox.fillRect(bounds.local.x - padding + offsetX, bounds.local.y - padding + offsetY, bounds.local.width + padding * 2 + extraWidth, bounds.local.height + padding * 2);
        this.scoreBox.setScrollFactor(0);

        this.startingY = this.player.y;

        // Pause button
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.pauseButton = this.add.sprite(this.game.config.width - 60, 60, "pauseButton")
            .setOrigin(0.5, 0.5)
            .setInteractive({ cursor: 'pointer' })
            .setScale(2)
            .setScrollFactor(0);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        // Collision overlap for platforms
        this.physics.add.overlap(this.player, this.platforms, this.checkPlatformCollision, null, this);

        // Mobile controls
        this.createMobileButtons();
        this.input.keyboard.disableGlobalCapture();

        // Attach SDK event listeners
        if (typeof addEventListenersPhaser === "function") {
            addEventListenersPhaser.call(this);
        }
    }

    /** Handle game updates */
    update(time, delta) {
        // Left/right movement and sprite flip based on direction
        if (this.cursors.left.isDown || this.leftPressed) {
            this.player.setVelocityX(-400);
            this.player.flipX = true;
        } else if (this.cursors.right.isDown || this.rightPressed) {
            this.player.setVelocityX(400);
            this.player.flipX = false;
        } else {
            this.player.setVelocityX(0);
        }

        // Horizontal wrapping
        if (this.player.x < 0) {
            this.player.x = this.game.config.width;
        } else if (this.player.x > this.game.config.width) {
            this.player.x = 0;
        }

        // Camera scrolling
        const threshold = this.game.config.height / 2;
        if (this.player.y < this.cameras.main.scrollY + threshold) {
            this.cameras.main.scrollY = this.player.y - threshold;
        }

        // Recycle platforms and spawn new ones
        this.platforms.children.iterate((platform) => {
            if (platform.y > this.cameras.main.scrollY + this.game.config.height + 100) {
                if (platform.isCracked && platform.crackSprite) {
                    platform.crackSprite.destroy();
                }
                platform.destroy();

                let previousHighestY = this.highestY;
                let newY = previousHighestY - Phaser.Math.Between(50, 250);
                let newX = Phaser.Math.Between(50, this.game.config.width - 50);
                const newPlatform = this.platforms.create(newX, newY, 'platform').setScale(0.5).refreshBody();
                newPlatform.displayWidth = 200;
                newPlatform.displayHeight = 20;
                newPlatform.body.setSize(newPlatform.displayWidth, newPlatform.displayHeight);
                newPlatform.body.setOffset(-90, 0);

                if (Phaser.Math.Between(0, 100) < 20) {
                    newPlatform.isCracked = true;
                    newPlatform.crackSprite = this.add.sprite(newPlatform.x, newPlatform.y, 'crack');
                    newPlatform.crackSprite.setDisplaySize(newPlatform.displayWidth, newPlatform.displayHeight);
                    newPlatform.crackSprite.setDepth(1);
                }

                let gap = previousHighestY - newY;
                if (gap > 300) {
                    let spring = this.springGroup.create(newPlatform.x, newPlatform.y - newPlatform.displayHeight / 2 - 10, 'spring');
                    spring.setScale(0.5);
                } else if (Phaser.Math.Between(0, 100) < 10) {
                    let spring = this.springGroup.create(newPlatform.x, newPlatform.y - newPlatform.displayHeight / 2 - 10, 'spring');
                    spring.setScale(0.5);
                }
                if (Phaser.Math.Between(0, 100) < 10) {
                    let jetpack = this.jetpacks.create(newPlatform.x, newPlatform.y - newPlatform.displayHeight / 2 - 10, 'jetpack');
                    jetpack.setScale(0.3);
                }

                // Compute enemy spawn chance based on score
                let enemyChance = 15;
                if (this.score >= 1500) {
                    enemyChance = 40;
                } else if (this.score >= 1000) {
                    enemyChance = 25;
                }
                if (Phaser.Math.Between(0, 100) < enemyChance) {
                    let spawnLeft = Phaser.Math.Between(0, 1) === 0;
                    let enemyY = newPlatform.y;
                    let enemy;
                    if (spawnLeft) {
                        enemy = this.enemies.create(-20, enemyY, 'enemy');
                        enemy.setVelocityX(this.enemySpeed);
                    } else {
                        enemy = this.enemies.create(this.game.config.width + 20, enemyY, 'enemy');
                        enemy.setVelocityX(-this.enemySpeed);
                    }
                    enemy.setCollideWorldBounds(true);
                    enemy.setBounce(1, 0);
                    enemy.setScale(0.2);
                    enemy.body.allowGravity = false;
                }
                this.highestY = newY;
            }
        });

        // Destroy bullets that left the top of the screen
        this.bullets.children.each(bullet => {
            if (bullet.y < this.cameras.main.scrollY - bullet.height) {
                bullet.destroy();
            }
        }, this);

        // Background parallax scrolling
        this.bg.tilePositionY = -this.cameras.main.scrollY * 0.5;

        // Update score based on height
        this.score = Math.max(0, Math.floor((this.startingY - this.player.y) / 10));
        this.scoreText.setText('Score: ' + this.score);

        // Force upward movement if jetpack is active
        if (this.jetpackActive) {
            this.player.setVelocityY(-800);
        }

        // Check game over
        if (this.player.y > this.cameras.main.scrollY + this.game.config.height) {
            this.gameOver();
        }

        // Update enemy sound based on visibility
        let enemyVisible = false;
        this.enemies.children.iterate((enemy) => {
            if (enemy.active) {
                let enemyBounds = enemy.getBounds();
                let cameraBounds = this.cameras.main.worldView;
                if (Phaser.Geom.Intersects.RectangleToRectangle(enemyBounds, cameraBounds)) {
                    enemyVisible = true;
                }
            }
        });
        if (enemyVisible) {
            if (!this.sounds.enemySound.isPlaying) {
                this.sounds.enemySound.play();
            }
        } else {
            if (this.sounds.enemySound.isPlaying) {
                this.sounds.enemySound.stop();
            }
        }
    }

    /** Player shooting: changes texture briefly and fires a bullet upward */
    shootBullet() {
        this.player.setTexture('playerShoot');
        this.time.addEvent({
            delay: 100,
            callback: () => {
                this.player.setTexture(this.defaultPlayerTexture);
            }
        });
        let bullet = this.physics.add.sprite(this.player.x, this.player.y, 'bullet');
        bullet.body.setAllowGravity(false);
        bullet.setVelocityY(-500);
        this.bullets.add(bullet);
    }

    /** Custom collision for platforms (normal jump or cracked behavior) */
    checkPlatformCollision(player, platform) {
        if (this.jetpackActive) {
            return;
        }
        if (player.body.velocity.y > 0 && player.y < platform.y) {
            player.setVelocityY(-1000);
            this.sounds.jump.setVolume(1.5).setLoop(false).play();
            if (platform.isCracked) {
                this.sounds.crackSound.play();
                if (platform.crackSprite) {
                    this.tweens.add({
                        targets: platform.crackSprite,
                        y: platform.crackSprite.y + 100,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => {
                            platform.crackSprite.destroy();
                        }
                    });
                }
                this.tweens.add({
                    targets: platform,
                    y: platform.y + 100,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        platform.destroy();
                    }
                });
            }
        }
    }
    
    /** Callback for spring collision (2x jump boost) */
    hitSpring(player, spring) {
        if (player.body.velocity.y > 0 && player.y < spring.y) {
            player.setVelocityY(-2000);
            spring.destroy();
            this.sounds.springSound.play();
        }
    }
    
    /** Callback for enemy collision (game over) */
    hitEnemy(player, enemy) {
        this.gameOver();
    }

    /** Callback for bullet and enemy collision */
    hitEnemyWithBullet(bullet, enemy) {
        bullet.destroy();
        enemy.destroy();
    }
    
    /** Callback for collecting a jetpack power-up */
    collectJetpack(player, jetpack) {
        jetpack.destroy();
        this.jetpackActive = true;
        this.sounds.jetpackSound.play();
        this.player.setTexture('jetpackPlayer');
        this.player.setScale(0.4);
        this.player.body.setSize(this.jetpackBodyWidth, this.jetpackBodyHeight, true);
        this.player.body.setAllowGravity(false);

        this.time.addEvent({
            delay: 5000,
            callback: () => {
                this.jetpackActive = false;
                this.sounds.jetpackSound.stop();
                this.player.setTexture(this.defaultPlayerTexture);
                this.player.setScale(this.defaultPlayerScale);
                this.player.body.setSize(this.defaultBodyWidth, this.defaultBodyHeight, true);
                this.player.body.setAllowGravity(true);
            }
        });
    }

    /** Create mobile control buttons */
    createMobileButtons() {
        this.leftButton = this.add.rectangle(80, this.height - 60, 100, 100, 0xcccccc, 0.5)
            .setScrollFactor(0)
            .setInteractive();
        this.rightButton = this.add.rectangle(200, this.height - 60, 100, 100, 0xcccccc, 0.5)
            .setScrollFactor(0)
            .setInteractive();

        this.leftButton.on('pointerdown', () => { this.leftPressed = true; });
        this.leftButton.on('pointerup', () => { this.leftPressed = false; });
        this.leftButton.on('pointerout', () => { this.leftPressed = false; });

        this.rightButton.on('pointerdown', () => { this.rightPressed = true; });
        this.rightButton.on('pointerup', () => { this.rightPressed = false; });
        this.rightButton.on('pointerout', () => { this.rightPressed = false; });

        this.toggleControlsVisibility(isMobile);
    }

    /** Toggle mobile control visibility */
    toggleControlsVisibility(visibility) {
        if (this.leftButton) this.leftButton.visible = visibility;
        if (this.rightButton) this.rightButton.visible = visibility;
    }

    /** Pause game by triggering the SDK event which shows the default overlay */
    pauseGame() {
        handlePauseGame.call(this);
    }

    /** Game over: trigger the SDK event which shows the default game-over overlay */
    gameOver() {
        this.sound.stopAll();
        this.sounds.lose.setVolume(0.2).setLoop(false).play();
        initiateGameOver.bind(this)({ score: this.score });
    }
}

// Game Configuration
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
            gravity: { y: 800 },
            debug: false,
        },
    },
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions,
    },
    deviceOrientation: _CONFIG.deviceOrientation === "landscape"
};