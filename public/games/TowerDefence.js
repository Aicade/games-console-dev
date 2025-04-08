// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.playerHealth = 100;
        this.weapons = [];
        this.enemies = [];
        this.waveCount = 1;
        this.enemiesInWave = 5;
        this.spawnDelay = 2000;
        this.lastSpawnTime = 0;
        this.enemiesSpawned = 0;
        this.killCount = 0;
    
    }

    preload() {
        // this.isGameOver = false;

        addEventListenersPhaser.bind(this)();

        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");

        this.load.image('pathTexture', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/3hUAYEeFzgiJvaRR/assets/images/road%20texture.png?t=1743839407964');
        this.load.image('heavyWeapon', 'https://play.rosebud.ai/assets/heavyWeapon.png?7M0N');
        this.load.image('rapidWeapon', 'https://play.rosebud.ai/assets/rapidWeapon.png?NEDt');
        this.load.image('superWeapon', 'https://play.rosebud.ai/assets/superWeapon.png?raYA');
        this.load.image('heavyWeaponIcon', 'https://play.rosebud.ai/assets/heavyWeaponIcon.png?Li77');
        this.load.image('rapidWeaponIcon', 'https://play.rosebud.ai/assets/rapidWeaponIcon.png?lX1z');
        this.load.image('superWeaponIcon', 'https://play.rosebud.ai/assets/superWeaponIcon.png?7ik8');
        this.load.image('enemy', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/3hUAYEeFzgiJvaRR/assets/images/newAsset_6.png?t=1743618033935');
        // this.load.image('enemy', 'https://play.rosebud.ai/assets/enemy.png?VY59');
        this.load.image('heavyProjectile', 'https://play.rosebud.ai/assets/heavyProjectile.png?meyw');
        this.load.image('rapidProjectile', 'https://play.rosebud.ai/assets/rapidProjectile.png?s5Mb');
        this.load.image('superProjectile', 'https://play.rosebud.ai/assets/superProjectile.png?y2EC');
        // this.load.image('playerBase', 'https://play.rosebud.ai/assets/playerBase.png?sdoI');
        this.load.image('playerBase', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/3hUAYEeFzgiJvaRR/assets/images/newAsset_5.png?t=1743677119761');
        this.load.image('healthBarFrame', 'https://play.rosebud.ai/assets/healthBarFrame.png?OeMt');

        this.load.image("ow", "https://aicade-user-store.s3.amazonaws.com/0306251268/games/3hUAYEeFzgiJvaRR/assets/images/newAsset_8.png?t=1743945853522");
        this.load.image("skull", "https://aicade-user-store.s3.amazonaws.com/0306251268/games/5GVig3hxQHZ44k3Z/assets/images/skull.png?t=1744047475314");
    


        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/"
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        displayProgressLoader.call(this);

    }

    resize() {
        const width = this.game.config.width;
        const height = this.game.config.height;
        const scaleX = width / 800; // 800 is the reference width
        const scaleY = height / 600; // 600 is the reference height
        const baseScale = Math.min(scaleX, scaleY); // Maintain aspect ratio

        // Background
        this.bg.setDisplaySize(width, height);

        // Pause button
        this.pauseButton.setPosition(width - 60 * scaleX, 60 * scaleY).setScale(1 * baseScale);

        // Clear existing graphics and textures
        this.children.list.forEach(child => {
            if (child.type === 'Graphics' || (child.type === 'TileSprite' && child.texture.key === 'pathTexture')) {
                child.destroy();
            }
        });

        // Define paths with scaled coordinates
        this.path1 = new Phaser.Curves.Path(300 * scaleX, 0);
        this.path1.lineTo(300 * scaleX, 550 * scaleY);

        this.path2 = new Phaser.Curves.Path(400 * scaleX, 0);
        this.path2.lineTo(400 * scaleX, 550 * scaleY);

        this.path3 = new Phaser.Curves.Path(500 * scaleX, 0);
        this.path3.lineTo(500 * scaleX, 550 * scaleY);

        // Draw debug lines
        const graphics = this.add.graphics();
        graphics.lineStyle(2, 0x00ff00);
        this.path1.draw(graphics);
        graphics.lineStyle(2, 0xff0000);
        this.path2.draw(graphics);
        graphics.lineStyle(2, 0x0000ff);
        this.path3.draw(graphics);

        // Draw textured paths
        const drawTexturePath = (path) => {
            const pathPoints = path.getPoints();
            for (let i = 0; i < pathPoints.length - 1; i++) {
                const current = pathPoints[i];
                const next = pathPoints[i + 1];
                const angle = Phaser.Math.Angle.Between(current.x, current.y, next.x, next.y);
                const distance = Phaser.Math.Distance.Between(current.x, current.y, next.x, next.y);
                this.add.tileSprite(current.x, current.y, distance, 140 * baseScale, 'pathTexture')
                    .setOrigin(0, 0.5)
                    .setRotation(angle);
            }
        };
        drawTexturePath(this.path1);
        drawTexturePath(this.path2);
        drawTexturePath(this.path3);

        // Resize enemies
        this.enemyGroup.getChildren().forEach(enemy => {
            enemy.setScale(0.3 * baseScale); // Adjust size based on screen scale
        });

        // Resize "ow" images
        this.children.list.forEach(child => {
            if (child.type === 'Image' && child.texture.key === 'ow') {
                child.setScale(0.1 * baseScale); // Match original scale from fireWeapon
            }
        });

        // Player base and health bar
        this.player.setPosition(400 * scaleX, 550 * scaleY).setScale(0.2 * baseScale);
        this.healthBar.setPosition(400 * scaleX, 500 * scaleY).setScale(baseScale, 1).setDepth(1);
        // this.add.image(400 * scaleX, 500 * scaleY, 'healthBarFrame').setScale(0.3 * baseScale);
        this.healthText.setPosition(370 * scaleX, 470 * scaleY, 'pixelfont').setFontSize(16 * baseScale).setDepth(1);

        // Wave text
        this.waveText.setPosition(600 * scaleX, 40 * scaleY).setFontSize(24 * baseScale);

        // Resize "NEW WAVE" text if it exists
        this.children.list.forEach(child => {
            if (child.type === 'BitmapText' && child.text === 'NEW WAVE') {
                child.setPosition(640 * scaleX, 300 * scaleY).setFontSize(80 * baseScale);
            }
        });

        // Resize skull and kill count
        this.skullImage.setPosition(20 * scaleX, 20 * scaleY).setScale(0.05 * baseScale);
        this.killCountText.setPosition(80 * scaleX, 40 * scaleY).setFontSize(40 * baseScale);

        // Weapons
        this.weapons.forEach((weapon, index) => {
            const y = (150 + index * 60) * scaleY;
            weapon.button.setPosition(50 * scaleX, y).setScale(0.1 * baseScale);
            weapon.cooldownBar.setPosition(50 * scaleX, y + 25 * scaleY).setScale(baseScale, 1);
            this.add.bitmapText(100 * scaleX, y - 10 * scaleY, 'pixelfont', weapon.name, 14 * baseScale)
                .setTint(0xffffff);
            // Update availability visuals during resize
            if (this.killCount < weapon.killThreshold) { // Check killCount instead of waveCount
                weapon.button.disableInteractive().setAlpha(0.5);
                weapon.cooldownBar.setFillStyle(0x444444);
            } else {
                weapon.button.setInteractive().setAlpha(1);
                weapon.cooldownBar.setFillStyle(0x888888);
            }
        });
    }

    create() {

        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        this.sounds.background.setVolume(0.1).setLoop(true).play()

        this.vfx = new VFXLibrary(this);
         
        this.add.image(0, 0, 'background').setOrigin(0, 0).setDisplaySize(this.sys.game.config.width, this.sys.game.config.height);

        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.bg = this.add.sprite(0, 0, 'background').setOrigin(0, 0);
        this.bg.setScrollFactor(0);
        this.bg.displayHeight = this.game.config.height;
        this.bg.displayWidth = this.game.config.width;

        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());

        this.pauseButton = this.add.sprite(this.game.config.width - 60, 60, "pauseButton").setOrigin(0.5, 0.5).setDepth(1);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(3);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        // Create path with texture
        const graphics = this.add.graphics();
        // First path
        this.path1 = new Phaser.Curves.Path(300, 0);
        this.path1.lineTo(300, 550);

        this.path2 = new Phaser.Curves.Path(400, 0);
        this.path2.lineTo(400, 550);

        this.path3 = new Phaser.Curves.Path(500, 0);
        this.path3.lineTo(500, 550);

        // Debug: Draw both path lines
        graphics.lineStyle(2, 0x00ff00);
        this.path1.draw(graphics);
        graphics.lineStyle(2, 0xff0000);
        this.path2.draw(graphics);
        graphics.lineStyle(2, 0x0000ff);
        this.path3.draw(graphics);

        // Draw textured paths
        const drawTexturePath = (path) => {
            const pathPoints = path.getPoints();
            for (let i = 0; i < pathPoints.length - 1; i++) {
                const current = pathPoints[i];
                const next = pathPoints[i + 1];
                const angle = Phaser.Math.Angle.Between(current.x, current.y, next.x, next.y);
                const distance = Phaser.Math.Distance.Between(current.x, current.y, next.x, next.y);
                this.add.tileSprite(current.x, current.y, distance, 40, 'pathTexture')
                    .setOrigin(0, 0.5)
                    .setRotation(angle);
            }
        };

        // Draw textures for both paths
        // drawTexturePath(this.path1);
        // drawTexturePath(this.path2);
        

        this.vfx.addCircleTexture('hitParticle', 0xff0000, 1, 10);
        // Player base
        this.player = this.add.image(400, 550, 'playerBase').setScale(0.2).setDepth(1);
        // Health bar with frame
        // this.add.image(400, 500, 'healthBarFrame').setScale(0.3).setDepth(1);
        this.healthBar = this.add.rectangle(400, 500, 100, 10, 0x00ff00);
        this.healthText = this.add.text(350, 490, 'HP: 100', {
            fontSize: '16px',
            fill: '#fff'
        });

        // Skull and kill count display
        this.skullImage = this.add.image(20, 20, 'skull').setOrigin(0).setScale(0.05).setDepth(20);
        this.killCountText = this.add.bitmapText(80, 40, 'pixelfont', `${this.killCount}`, 40)
            .setOrigin(0, 0.5)
            .setDepth(20);

        // Wave counter
        this.waveText = this.add.text(650, 40, 'Wave: 1', {
            fontSize: '24px',
            fill: '#fff',
            backgroundColor: '#000000',
            padding: {
                x: 10,
                y: 5
            }
        });

        this.createWeapons();

        // Initialize groups
        this.bullets = this.add.group();
        this.enemyGroup = this.add.group();

        // Start spawning enemies
        // this.time.addEvent({
        //     delay: 100,
        //     callback: this.updateEnemySpawner,
        //     callbackScope: this,
        //     loop: true
        // });

        // Start the first wave manually
        this.waveCount = 0;
        this.startNewWave();

        this.cursors = this.input.keyboard.createCursorKeys();
        // this.enemies = this.physics.add.group();
        this.input.keyboard.disableGlobalCapture();

        this.resize();
        this.scale.on('resize', () => this.resize(), this);

    }

    createWeapons() {
        const weaponConfigs = [{
            texture: 'heavyWeapon',
            icon: 'heavyWeaponIcon',
            projectile: 'heavyProjectile',
            damage: 30,
            cooldown: 1000,
            name: 'Heavy',
            killThreshold: 5
        }, {
            texture: 'rapidWeapon',
            icon: 'rapidWeaponIcon',
            projectile: 'rapidProjectile',
            damage: 15,
            cooldown: 500,
            name: 'Rapid',
            killThreshold: 0
        }, {
            texture: 'superWeapon',
            icon: 'superWeaponIcon',
            projectile: 'superProjectile',
            damage: 45,
            cooldown: 2000,
            name: 'Super',
            killThreshold: 10
        }];

        weaponConfigs.forEach((config, index) => {
            const y = 150 + index * 60;
            const weapon = {
                button: this.add.image(50, y, config.icon).setScale(0.1).setInteractive(),
                cooldownBar: this.add.rectangle(50, y + 25, 40, 5, 0x888888),
                damage: config.damage,
                cooldown: config.cooldown,
                lastFired: 0,
                name: config.name,
                projectileTexture: config.projectile,
                killThreshold: config.killThreshold, // Number of kills needed to unlock
                isAvailable: this.killCount >= config.killThreshold // Initially based on killCount
            };

            weapon.button.on('pointerdown', () => this.fireWeapon(weapon));
            this.weapons.push(weapon);

            // Add text for weapon name
            // this.add.bitmapText(100, y - 10, 'pixelfont', config.name, 14)
            //     .setTint(0xffffff);

            // Initially disable button if not available
            if (!weapon.isAvailable) {
                weapon.button.disableInteractive().setAlpha(0.5); // Visually indicate unavailability
                weapon.cooldownBar.setFillStyle(0x444444); // Grey out cooldown bar
            }
        });
    }

    fireWeapon(weapon) {
        if (!weapon.isAvailable) return;

        const baseScale = Math.min(this.game.config.width / 800, this.game.config.height / 600);

        const currentTime = this.time.now;
        if (currentTime - weapon.lastFired >= weapon.cooldown) {
            const bullet = this.add.image(this.player.x, this.player.y, weapon.projectileTexture).setScale(0.1);
            this.bullets.add(bullet);

            let nearestEnemy = null;
            let nearestDistance = Infinity;

            this.enemyGroup.getChildren().forEach(enemy => {
                const distance = Phaser.Math.Distance.Between(
                    bullet.x, bullet.y,
                    enemy.x, enemy.y
                );
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestEnemy = enemy;
                }
            });

            if (nearestEnemy) {
                this.tweens.add({
                    targets: bullet,
                    x: nearestEnemy.x,
                    y: nearestEnemy.y,
                    duration: 500,
                    onComplete: () => {
                        bullet.destroy();
                        nearestEnemy.health -= weapon.damage;
                        
                        // Display "ow" image above enemy when hit
                        if (nearestEnemy.active) { // Ensure enemy still exists
                            const owImage = this.add.image(nearestEnemy.x, nearestEnemy.y - 20, 'ow')
                                .setScale(0.1 * baseScale) // Adjust scale as needed
                                .setDepth(15); // Above enemy (depth 10) and paths (depth 5)
                            this.time.delayedCall(500, () => {
                                if (owImage.active) owImage.destroy(); // Remove after 0.5s
                            });

                            // Add particle burst VFX
                            const emitter = this.vfx.createEmitter('hitParticle', nearestEnemy.x, nearestEnemy.y, 0.5 * baseScale, 0, 300);
                            emitter.explode(50); // Emit 50 particles in a burst
                            this.time.delayedCall(300, () => emitter.stop()); // Stop after 300ms
                    
                        }

                        if (nearestEnemy.health <= 0) {
                            nearestEnemy.destroy();
                            this.killCount++; // Increment kill count
                            this.killCountText.setText(`${this.killCount}`);

                            // Check and unlock weapons based on kill count
                            this.weapons.forEach(w => {
                                if (this.killCount >= w.killThreshold && !w.isAvailable) {
                                    w.isAvailable = true;
                                    w.button.setInteractive().setAlpha(1);
                                    w.cooldownBar.setFillStyle(0x888888);
                                }
                            });
                        }
                    }
                });
            } else {
                bullet.destroy();
            }

            weapon.lastFired = currentTime;

            this.tweens.add({
                targets: weapon.cooldownBar,
                scaleX: 0,
                duration: weapon.cooldown,
                yoyo: false,
                repeat: 0,
                onComplete: () => {
                    weapon.cooldownBar.scaleX = 1;
                }
            });
        }
    }

    spawnEnemy() {
        const baseScale = Math.min(this.game.config.width / 800, this.game.config.height / 600);
        const enemy = this.add.image(400, 0, 'enemy').setScale(0.3 * baseScale);
        enemy.health = 50;
        enemy.setDepth(10);
        this.enemyGroup.add(enemy);

        // Randomly choose one of three paths
        const pathChoice = Math.floor(Math.random() * 3);
        const selectedPath = pathChoice === 0 ? this.path1 : (pathChoice === 1 ? this.path2 : this.path3);

        const pathFollower = {
            t: 0,
            vec: new Phaser.Math.Vector2()
        };

        this.tweens.add({
            targets: pathFollower,
            t: 1,
            duration: 10000,
            ease: 'Linear',
            onUpdate: () => {
                selectedPath.getPoint(pathFollower.t, pathFollower.vec);
                enemy.x = pathFollower.vec.x;
                enemy.y = pathFollower.vec.y;
            },
            onComplete: () => {
                if (enemy && enemy.active) {  // Check if enemy still exists
                    console.log('Enemy reached base - applying damage');
                    this.damagePlayer(10);
                    enemy.destroy();
                }
            }
        });
    }

    // updateEnemySpawner() {
    //     const currentTime = this.time.now;

    //     if (this.enemiesSpawned < this.enemiesInWave &&
    //         currentTime - this.lastSpawnTime >= this.spawnDelay) {
    //         this.spawnEnemy();
    //         this.enemiesSpawned++;
    //         this.lastSpawnTime = currentTime;
    //     }

    //     if (this.enemiesSpawned >= this.enemiesInWave &&
    //         this.enemyGroup.getChildren().length === 0) {
    //         this.startNewWave();
    //     }
    // }

    startNewWave() {
        this.waveCount++;
        this.enemiesSpawned = 0;
        this.enemiesInWave += 2;
        this.spawnDelay = Math.max(500, this.spawnDelay - 100);
        this.waveText.setText(`Wave: ${this.waveCount}`);
    
        // Only show "NEW WAVE" and delay if it's not the first wave
        if (this.waveCount > 1) {
            const newWaveText = this.add.bitmapText(640, 300, 'pixelfont', 'NEW WAVE', 80)
                .setOrigin(0.5)
                .setDepth(20);
    
            this.time.delayedCall(2000, () => {
                if (newWaveText.active) newWaveText.destroy();
                this.startWaveSpawning(); // Start spawning after delay
            });
        } else {
            this.startWaveSpawning(); // Start spawning immediately for Wave 1
        }
    }
    
    startWaveSpawning() {
        this.time.addEvent({
            delay: this.spawnDelay,
            callback: () => {
                if (!this.isGameOver && this.enemiesSpawned < this.enemiesInWave) {
                    this.spawnEnemy();
                    this.enemiesSpawned++;
                }
            },
            repeat: this.enemiesInWave - 1,
            callbackScope: this
        });
    }

    damagePlayer(damage) {
        this.playerHealth = Math.max(0, this.playerHealth - damage);
        this.healthBar.scaleX = this.playerHealth / 100;
        this.healthText.setText(`HP: ${this.playerHealth}`);

        if (this.playerHealth <= 0) {
            this.gameOver(); // Call gameOver method instead of showing text
        }
    }

    update() {
        if (this.isGameOver) return;
    
        // Check if wave is complete and start next wave
        if (this.enemiesSpawned >= this.enemiesInWave && this.enemyGroup.getChildren().length === 0) {
            this.startNewWave();
        }
    }

    // updateScore(points) {
    //     this.score += points;
    //     this.gamePoint = this.score;
    //     this.updateScoreText();
    // }

    // updateScoreText() {
    //     this.scoreText.setText(this.score);
    // }

    gameOver() {
        this.sounds.background.stop();
        initiateGameOver.bind(this)({
            killCount: this.killCount
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