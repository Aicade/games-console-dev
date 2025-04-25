const isMobile = /Mobi|Android/i.test(navigator.userAgent);
_CONFIG.deviceOrientation = isMobile ? 'portrait' : 'landscape';

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.scoreAccumulator = 0;
        this.lastPlatformX = 0;
        this.platformPool = [];
        this.minPlatformX = -1000;
        this.platformLevels = [
            70, 100, 150, 200, 300, 420, 550, 720
        ];
        this.platformImageHeights = {
            70: 610, 100: 580, 150: 533, 200: 480, 300: 380, 420: 260, 550: 130, 720: 0
        };
        this.platformImageKeys = {
            70: 'platform1', 100: 'platform2', 150: 'platform3', 200: 'platform4',
            300: 'platform5', 420: 'platform', 550: 'platform7', 720: null
        };
        this.platformDepths = {
            'platform1': 1, 'platform2': 2, 'platform3': 3, 'platform4': 4,
            'platform5': 5, 'platform': 6, 'platform7': 7
        };
        this.isUpPressed = false;
        this.isDownPressed = false;
        this.enemySpawnInterval = 3000;
        this.hasPowerUp = false;
        this.powerUpSprite = null;
        this.bossActive = false;
        this.boss = null;
        this.bossHealth = 100;
        this.bossHits = 0;
        this.bossPhase = 0;
    }

    preload() {
        this.score = 0;
        this.lives = 3;

        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
            if (key === 'bullEnemy' || key === 'bossEnemy' || key === 'enemyBullet') {
                console.log(`${key} asset loaded:`, _CONFIG.imageLoader[key]);
            }
        }
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }

        this.load.image('heart', 'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/heart.png');
        this.load.bitmapFont('pixelfont',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.png',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.xml');
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");

        if (typeof addEventListenersPhaser === 'function') {
            addEventListenersPhaser.bind(this)();
        } else {
            console.warn('addEventListenersPhaser is not defined');
        }

        displayProgressLoader.call(this);
    }

    create() {
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }
        this.sounds.background.setVolume(0.3).setLoop(true).play();

        this.width = this.game.config.width;
        this.height = this.game.config.height;

        this.scoreText = this.add.bitmapText(this.width / 2, 50, 'pixelfont', 'Score: 0', 40)
            .setOrigin(0.5).setDepth(11).setScrollFactor(0);
        this.gameOverText = this.add.bitmapText(this.width / 2, this.height / 2, 'pixelfont', 'GAME OVER!', 60)
            .setOrigin(0.5).setDepth(11).setTint(0xff0000).setAlpha(0).setScrollFactor(0);

        this.bossHealthBar = this.add.graphics()
            .setDepth(11)
            .setScrollFactor(0);
        this.bossHealthBar.visible = false;

        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.pauseButton = this.add.image(this.width - 60, 60, "pauseButton");
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(2).setScrollFactor(0).setDepth(11);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        this.hearts = [];
        for (let i = 0; i < this.lives; i++) {
            let x = 50 + (i * 35);
            this.hearts[i] = this.add.image(x, 60, "heart")
                .setScale(0.025).setDepth(11).setScrollFactor(0);
        }

        gameSceneCreate(this);

        const bgTexture = this.textures.get('background');
        this.backgroundTileWidth = bgTexture.getSourceImage().width * 2.5;

        this.input.keyboard.disableGlobalCapture();

        if (typeof VFXLibrary === 'function') {
            this.vfx = new VFXLibrary(this);
        } else {
            console.warn('VFXLibrary is not defined');
            this.vfx = {
                blinkEffect: () => {},
                shakeCamera: () => {}
            };
        }

        this.lastEnemySpawnTime = this.time.now;
        this.lastCapsuleSpawnTime = this.time.now;
        this.capsuleSpawnInterval = Phaser.Math.Between(20000, 50000);
        this.lastHealthCapsuleSpawnTime = this.time.now;
        this.healthCapsuleSpawnInterval = Phaser.Math.Between(30000, 60000);

        this.backgroundParallaxFactor = 1;

        this.testKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK);
    }

    update(time, delta) {
        if (this.bossActive) {
            this.updateBossFight(time, delta);
            return;
        }

        if (!this.player.body.onFloor()) {
            this.player.currentPlatform = null;
        }

        this.isUpPressed = this.cursors.up.isDown;
        this.isDownPressed = this.cursors.down.isDown;

        if (this.isDownPressed && this.xKey.isDown && this.player.body.onFloor() && this.player.currentPlatform && this.player.currentPlatform.y < 720) {
            this.player.setVelocityY(100);
            this.player.body.checkCollision.down = false;
            this.time.delayedCall(200, () => {
                this.player.body.checkCollision.down = true;
            });
        }

        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-160);
            this.player.setFlipX(true);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(160);
            this.player.setFlipX(false);
        } else {
            this.player.setVelocityX(0);
        }

        if (this.isUpPressed && this.xKey.isDown && this.player.body.onFloor()) {
            this.player.setVelocityY(-460);
        }

        const fireCooldown = this.hasPowerUp ? 200 : 300;
        if ((this.hasPowerUp ? this.zKey.isDown : Phaser.Input.Keyboard.JustDown(this.zKey)) && time > this.lastShotTime + fireCooldown) {
            this.shootBullet();
            this.lastShotTime = time;
        }

        if (this.player.body.velocity.x > 0) {
            const scoreRate = 10 / 1000;
            this.scoreAccumulator += scoreRate * delta;
            while (this.scoreAccumulator >= 1) {
                this.updateScore(1);
                this.scoreAccumulator -= 1;
            }
        }

        if (Phaser.Input.Keyboard.JustDown(this.testKey)) {
            this.score = 5900;
            this.scoreText.setText(`Score: ${this.score}`);
            console.log('Score set to 5900 for boss fight testing');
        }

        if (this.score >= 6000 && !this.bossActive) {
            this.startBossFight();
        }

        this.cameras.main.scrollX = this.player.x - this.width / 2;
        this.background.tilePositionX = (this.cameras.main.scrollX * this.backgroundParallaxFactor) / this.background.scaleX;
        this.background.tilePositionY = 0;

        this.enemies.getChildren().forEach(enemy => {
            if (enemy.active && time > enemy.nextShotTime) {
                this.shootEnemyBullet(enemy);
                enemy.nextShotTime = time + Phaser.Math.Between(1000, 3000);
            }
            if (enemy.x < this.player.x - 1000) {
                enemy.destroy();
            }
        });

        this.bullEnemies.getChildren().forEach(bull => {
            const direction = this.player.x < bull.x ? -1 : 1;
            bull.setVelocityX(direction * 250);
            if (bull.x < this.cameras.main.scrollX - 500) {
                bull.destroy();
            }
        });

        this.capsules.getChildren().forEach(capsule => {
            capsule.setVelocityX(-150);
            capsule.setVelocityY(0);
            capsule.y = capsule.initialY + Math.sin(time / 1000 * Math.PI) * 50;
            if (capsule.x < this.cameras.main.scrollX - 50) {
                capsule.destroy();
            }
        });

        this.powerups.getChildren().forEach(powerup => {
            if (powerup.x < this.cameras.main.scrollX - 50) {
                powerup.destroy();
            }
        });

        this.enemySpawnInterval = Math.max(1000, 3000 - Math.floor(this.score / 100) * 100);

        if (time > this.lastEnemySpawnTime + this.enemySpawnInterval && this.score < 6000) {
            this.spawnEnemy();
            this.lastEnemySpawnTime = time;
        }

        if (time > this.lastCapsuleSpawnTime + this.capsuleSpawnInterval) {
            this.spawnCapsule();
            this.lastCapsuleSpawnTime = time;
            this.capsuleSpawnInterval = Phaser.Math.Between(20000, 50000);
        }

        if (time > this.lastHealthCapsuleSpawnTime + this.healthCapsuleSpawnInterval) {
            this.spawnHealthCapsule();
            this.lastHealthCapsuleSpawnTime = time;
            this.healthCapsuleSpawnInterval = Phaser.Math.Between(30000, 60000);
        }

        this.playerBullets.getChildren().forEach(bullet => {
            if (bullet.x < this.cameras.main.scrollX - 100 || bullet.x > this.cameras.main.scrollX + this.width + 100) {
                bullet.destroy();
            }
        });
        this.enemyBullets.getChildren().forEach(bullet => {
            if (bullet.x < this.player.x - 1000 || bullet.x > this.cameras.main.scrollX + this.width + 100) {
                bullet.destroy();
            }
        });

        if (this.player.x > this.lastPlatformX - this.width * 2) {
            this.generatePlatforms();
        }

        this.platformPool = this.platformPool.filter(platform => {
            if (platform.x < this.player.x - 1500 && platform !== this.bottomPlatform) {
                if (platform.image) platform.image.destroy();
                platform.destroy();
                return false;
            }
            return true;
        });
        this.minPlatformX = this.platformPool.length > 0 ? Math.min(...this.platformPool.map(p => p.x)) : this.player.x;
    }

    updateBossFight(time, delta) {
        if (!this.player.body.onFloor()) {
            this.player.currentPlatform = null;
        }

        this.isUpPressed = this.cursors.up.isDown;
        this.isDownPressed = this.cursors.down.isDown;

        if (this.isDownPressed && this.xKey.isDown && this.player.body.onFloor() && this.player.currentPlatform && this.player.currentPlatform.y < 720) {
            this.player.setVelocityY(100);
            this.player.body.checkCollision.down = false;
            this.time.delayedCall(200, () => {
                this.player.body.checkCollision.down = true;
            });
        }

        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-160);
            this.player.setFlipX(true);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(160);
            this.player.setFlipX(false);
        } else {
            this.player.setVelocityX(0);
        }

        if (this.isUpPressed && this.xKey.isDown && this.player.body.onFloor()) {
            this.player.setVelocityY(-460);
        }

        const fireCooldown = this.hasPowerUp ? 200 : 300;
        if ((this.hasPowerUp ? this.zKey.isDown : Phaser.Input.Keyboard.JustDown(this.zKey)) && time > this.lastShotTime + fireCooldown) {
            this.shootBullet();
            this.lastShotTime = time;
        }

        // Boss shooting logic with enhanced debugging
        if (this.boss && this.boss.active) {
            console.log(`Boss shooting check - Time: ${time}, NextShotTime: ${this.boss.nextShotTime}, Active: ${this.boss.active}, Position: x=${this.boss.x}, y=${this.boss.y}`);
            if (time >= this.boss.nextShotTime) {
                console.log(`Boss attempting to shoot - Phase: ${this.bossPhase}, Time: ${time}, NextShotTime: ${this.boss.nextShotTime}`);
                this.shootEnemyBullet(this.boss);
                this.boss.nextShotTime = time + Phaser.Math.Between(1000, 3000);
                console.log(`Boss shot fired, new NextShotTime: ${this.boss.nextShotTime}`);
            } else {
                console.log(`Boss not ready to shoot - Time: ${time}, NextShotTime: ${this.boss.nextShotTime}`);
            }
        } else {
            console.warn(`Boss shooting skipped - Boss: ${this.boss ? 'exists' : 'null'}, Active: ${this.boss ? this.boss.active : 'N/A'}`);
        }

        if (this.bossActive) {
            this.updateBossHealthBar();
        }

        this.capsules.getChildren().forEach(capsule => {
            capsule.setVelocityX(-150);
            capsule.setVelocityY(0);
            capsule.y = capsule.initialY + Math.sin(time / 1000 * Math.PI) * 50;
            if (capsule.x < this.cameras.main.scrollX - 50) {
                capsule.destroy();
            }
        });

        this.powerups.getChildren().forEach(powerup => {
            if (powerup.x < this.cameras.main.scrollX - 50) {
                powerup.destroy();
            }
        });

        if (time > this.lastCapsuleSpawnTime + this.capsuleSpawnInterval) {
            this.spawnCapsule();
            this.lastCapsuleSpawnTime = time;
            this.capsuleSpawnInterval = Phaser.Math.Between(20000, 50000);
        }

        if (time > this.lastHealthCapsuleSpawnTime + this.healthCapsuleSpawnInterval) {
            this.spawnHealthCapsule();
            this.lastHealthCapsuleSpawnTime = time;
            this.healthCapsuleSpawnInterval = Phaser.Math.Between(30000, 60000);
        }

        this.playerBullets.getChildren().forEach(bullet => {
            if (bullet.x < this.cameras.main.scrollX - 100 || bullet.x > this.cameras.main.scrollX + this.width + 100) {
                bullet.destroy();
            }
        });
        this.enemyBullets.getChildren().forEach(bullet => {
            if (bullet.x < this.cameras.main.scrollX - 100 || bullet.x > this.cameras.main.scrollX + this.width + 100) {
                bullet.destroy();
            }
        });

        this.enemies.getChildren().forEach(enemy => {
            if (enemy.active && time > enemy.nextShotTime) {
                this.shootEnemyBullet(enemy);
                enemy.nextShotTime = time + Phaser.Math.Between(1000, 3000);
            }
        });

        this.bullEnemies.getChildren().forEach(bull => {
            const direction = this.player.x < bull.x ? -1 : 1;
            bull.setVelocityX(direction * 250);
        });
    }

    startBossFight() {
        this.bossActive = true;

        this.platformPool.forEach(platform => {
            if (platform !== this.bottomPlatform) {
                if (platform.image) platform.image.destroy();
                platform.destroy();
            }
        });
        this.platformPool = [this.bottomPlatform];
        this.lastPlatformX = this.player.x;

        this.enemies.getChildren().forEach(enemy => enemy.destroy());
        this.bullEnemies.getChildren().forEach(bull => bull.destroy());
        this.capsules.getChildren().forEach(capsule => capsule.destroy());
        this.powerups.getChildren().forEach(powerup => powerup.destroy());
        this.playerBullets.getChildren().forEach(bullet => bullet.destroy());
        this.enemyBullets.getChildren().forEach(bullet => bullet.destroy());

        this.hasPowerUp = false;
        this.powerUpSprite = null;

        this.player.setPosition(this.cameras.main.scrollX + this.width / 4, this.platformLevels[7] - 50);
        this.player.setVelocity(0, 0);
        this.player.body.setAllowGravity(false);
        this.physics.world.gravity.y = 0;

        const bossX = this.cameras.main.scrollX + this.width + 200;
        const bossY = this.height / 2; // Center vertically
        this.boss = this.physics.add.sprite(bossX, bossY, 'bossEnemy')
            .setScale(0.8) // Changed to 80% of original size
            .setDepth(8);
        this.boss.body.setSize(this.boss.width * 0.6, this.boss.height * 0.8);
        this.boss.body.setAllowGravity(false);
        this.boss.nextShotTime = this.time.now + 1000; // Start shooting after 1 second
        this.boss.setActive(true);
        this.boss.setVisible(true);
        console.log('Boss created - Position:', { x: bossX, y: bossY }, 'Scale: 0.8', 'Active:', this.boss.active, 'NextShotTime:', this.boss.nextShotTime);
        this.physics.add.overlap(this.boss, this.playerBullets, this.hitBoss, null, this);
        this.physics.add.overlap(this.player, this.boss, hitPlayerByBull, null, this);

        this.bossHealthBar.visible = true;
        this.updateBossHealthBar();

        this.tweens.add({
            targets: this.boss,
            x: this.cameras.main.scrollX + this.width - 200,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => {
                this.player.body.setAllowGravity(true);
                this.physics.world.gravity.y = 600;

                const platformConfigs = [
                    { y: 550, key: 'platform7', height: 130 },
                    { y: 300, key: 'platform5', height: 380 },
                    { y: 420, key: 'platform', height: 260 }
                ];

                platformConfigs.forEach(config => {
                    const x = this.cameras.main.scrollX + Phaser.Math.Between(100, this.width / 2 - 100);
                    const width = Phaser.Math.Between(150, 250);
                    const platform = this.platforms.create(x, config.y, 'blank')
                        .setSize(width, 20)
                        .setVisible(false);
                    const platformImage = this.add.image(x, config.y + 10, config.key)
                        .setDisplaySize(width, config.height)
                        .setOrigin(0.5, 0)
                        .setDepth(this.platformDepths[config.key]);
                    platform.image = platformImage;
                    this.platformPool.push(platform);

                    platform.setPosition(x, this.height + 50);
                    platformImage.setPosition(x, this.height + 50);
                    this.tweens.add({
                        targets: [platform, platformImage],
                        y: config.y,
                        duration: 1000,
                        ease: 'Power1'
                    });
                });
            }
        });

        this.cameras.main.stopFollow();
    }

    updateBossHealthBar() {
        this.bossHealthBar.clear();
        const barWidth = this.width - 40;
        const barHeight = 20;
        const barX = 20;
        const barY = 80;
        const healthRatio = this.bossHealth / 100;

        this.bossHealthBar.fillStyle(0x333333, 1);
        this.bossHealthBar.fillRect(barX, barY, barWidth, barHeight);

        this.bossHealthBar.fillStyle(0xff0000, 1);
        this.bossHealthBar.fillRect(barX, barY, barWidth * healthRatio, barHeight);

        this.bossHealthBar.lineStyle(2, 0xffffff, 1);
        this.bossHealthBar.strokeRect(barX, barY, barWidth, barHeight);
    }

    createStarExplosion(x, y) {
        const explosion = this.add.graphics({ x, y });
        explosion.setDepth(10);

        const initialRadius = 5;
        const finalRadius = 30;
        let currentRadius = initialRadius;
        const duration = 500;
        const explosionColor = 0xefa60f;

        const createStarPoints = (radius) => {
            const points = [];
            const numPoints = 8;
            for (let i = 0; i < numPoints; i++) {
                const angle = (i * 2 * Math.PI) / numPoints;
                const pointRadius = (i % 2 === 0 ? radius : radius * 0.5) * (1 + Phaser.Math.FloatBetween(-0.2, 0.2));
                points.push({
                    x: Math.cos(angle) * pointRadius,
                    y: Math.sin(angle) * pointRadius
                });
            }
            return points;
        };

        this.tweens.add({
            targets: { radius: initialRadius },
            radius: finalRadius,
            alpha: { from: 1, to: 0 },
            duration: duration,
            ease: 'Power2',
            onUpdate: (tween) => {
                currentRadius = tween.getValue();
                explosion.clear();
                explosion.fillStyle(explosionColor, 1);
                const points = createStarPoints(currentRadius);
                explosion.beginPath();
                explosion.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    explosion.lineTo(points[i].x, points[i].y);
                }
                explosion.closePath();
                explosion.fillPath();
            },
            onComplete: () => {
                explosion.destroy();
            }
        });
    }

    hitBoss(boss, bullet) {
        bullet.destroy();
        this.sounds.damage.play();
        this.bossHealth--;
        this.bossHits++;
        console.log(`Boss hit! Hits: ${this.bossHits}, Health: ${this.bossHealth}, Phase: ${this.bossPhase}`);

        boss.setVisible(false);
        this.time.delayedCall(50, () => boss.setVisible(true));

        if (this.bossHits === 20 && this.bossPhase < 1) {
            this.bossPhase = 1;
            const numExplosions = Phaser.Math.Between(2, 3);
            for (let i = 0; i < numExplosions; i++) {
                const offsetX = Phaser.Math.Between(-boss.width / 4, boss.width / 4);
                const offsetY = Phaser.Math.Between(-boss.height / 4, boss.height / 4);
                this.createStarExplosion(boss.x + offsetX, boss.y + offsetY);
            }
        } else if (this.bossHits === 50 && this.bossPhase < 2) {
            this.bossPhase = 2;
            const numExplosions = Phaser.Math.Between(2, 3);
            for (let i = 0; i < numExplosions; i++) {
                const offsetX = Phaser.Math.Between(-boss.width / 4, boss.width / 4);
                const offsetY = Phaser.Math.Between(-boss.height / 4, boss.height / 4);
                this.createStarExplosion(boss.x + offsetX, boss.y + offsetY);
            }
            this.spawnAdditionalPlatforms();
            this.spawnNormalEnemies(2);
        } else if (this.bossHits === 70 && this.bossPhase < 3) {
            this.bossPhase = 3;
            const numExplosions = Phaser.Math.Between(2, 3);
            for (let i = 0; i < numExplosions; i++) {
                const offsetX = Phaser.Math.Between(-boss.width / 4, boss.width / 4);
                const offsetY = Phaser.Math.Between(-boss.height / 4, boss.height / 4);
                this.createStarExplosion(boss.x + offsetX, boss.y + offsetY);
            }
            this.spawnNormalEnemies(5);
        } else if (this.bossHits === 90 && this.bossPhase < 4) {
            this.bossPhase = 4;
            const numExplosions = Phaser.Math.Between(2, 3);
            for (let i = 0; i < numExplosions; i++) {
                const offsetX = Phaser.Math.Between(-boss.width / 4, boss.width / 4);
                const offsetY = Phaser.Math.Between(-boss.height / 4, boss.height / 4);
                this.createStarExplosion(boss.x + offsetX, boss.y + offsetY);
            }
            this.spawnNormalEnemies(5);
            this.spawnBullEnemies(3);
        }

        if (this.bossHealth <= 0) {
            this.destroyBoss();
        }
    }

    spawnAdditionalPlatforms() {
        const bossLeftEdge = this.boss.x - (this.boss.width * 0.8) / 2;
        const platformConfigs = [
            { y: 200, key: 'platform4', height: 480 },
            { y: 150, key: 'platform3', height: 533 }
        ];

        const newPlatforms = [];

        platformConfigs.forEach(config => {
            let x;
            let attempts = 0;
            const maxAttempts = 10;
            do {
                x = this.cameras.main.scrollX + Phaser.Math.Between(this.width / 2, bossLeftEdge - 250);
                attempts++;
            } while (newPlatforms.some(p => Math.abs(p.x - x) < 100) && attempts < maxAttempts);

            if (attempts < maxAttempts) {
                const width = Phaser.Math.Between(150, 250);
                const platform = this.platforms.create(x, config.y, 'blank')
                    .setSize(width, 20)
                    .setVisible(false);
                const platformImage = this.add.image(x, config.y + 10, config.key)
                    .setDisplaySize(width, config.height)
                    .setOrigin(0.5, 0)
                    .setDepth(this.platformDepths[config.key]);
                platform.image = platformImage;
                this.platformPool.push(platform);
                newPlatforms.push({ x, y: config.y });

                platform.setPosition(x, this.height + 50);
                platformImage.setPosition(x, this.height + 50);
                this.tweens.add({
                    targets: [platform, platformImage],
                    y: config.y,
                    duration: 1000,
                    ease: 'Power1'
                });

                console.log(`Platform spawned at: x=${x}, y=${config.y}, rightHalfStart=${this.cameras.main.scrollX + this.width / 2}, bossLeftEdge=${bossLeftEdge}`);
            }
        });
    }

    spawnNormalEnemies(count) {
        const suitablePlatforms = this.platformPool.filter(p =>
            p !== this.bottomPlatform &&
            this.platformLevels.slice(0, 7).includes(p.y)
        );

        for (let i = 0; i < count; i++) {
            if (suitablePlatforms.length > 0) {
                const platform = suitablePlatforms[Phaser.Math.Between(0, suitablePlatforms.length - 1)];
                const x = platform.x;
                const y = platform.y - 20;
                const enemy = this.enemies.create(x, y, 'enemy').setScale(0.3).setDepth(8);
                enemy.nextShotTime = this.time.now + Phaser.Math.Between(1000, 3000);
                enemy.body.setAllowGravity(true);
                console.log('Normal enemy spawned at:', { x, y });
            }
        }
    }

    spawnBullEnemies(count) {
        for (let i = 0; i < count; i++) {
            const x = this.cameras.main.scrollX - 50;
            const y = this.platformLevels[7] - 20;
            const bull = this.bullEnemies.create(x, y, 'bullEnemy').setScale(0.35).setDepth(8);
            bull.body.setSize(bull.width * 0.6, bull.height * 0.8);
            bull.body.setAllowGravity(true);
            bull.setFlipX(true);
            console.log('Bull enemy spawned at:', { x, y });
        }
    }

    shootEnemyBullet(enemy) {
        if (!enemy || !enemy.active) {
            console.log('shootEnemyBullet skipped - Enemy not active or null');
            return;
        }

        const isBoss = enemy === this.boss;
        const bulletSpeed = 300;

        try {
            // Adjust bullet spawn position for boss (left side of sprite, middle y-axis)
            const bulletX = isBoss ? enemy.x - (enemy.width * enemy.scaleX) / 2 : enemy.x;
            const bulletY = enemy.y; // Middle of y-axis

            console.log(`Shooting from ${isBoss ? 'boss' : 'enemy'}, bossPhase: ${this.bossPhase}, bulletX: ${bulletX}, bulletY: ${bulletY}`);

            if (isBoss && this.bossPhase >= 1) {
                // Boss phase 1+: Shoot 3 bullets from left side with slight angle variations
                const angles = [
                    Phaser.Math.Angle.Between(bulletX, bulletY, this.player.x, this.player.y),
                    Phaser.Math.Angle.Between(bulletX, bulletY, this.player.x, this.player.y) + Phaser.Math.DegToRad(10),
                    Phaser.Math.Angle.Between(bulletX, bulletY, this.player.x, this.player.y) - Phaser.Math.DegToRad(10)
                ];
                angles.forEach((angle, index) => {
                    const bullet = this.enemyBullets.create(bulletX, bulletY, 'enemyBullet').setScale(0.5).setDepth(8);
                    bullet.setVelocityX(Math.cos(angle) * bulletSpeed);
                    bullet.setVelocityY(Math.sin(angle) * bulletSpeed);
                    bullet.body.setAllowGravity(false);
                    console.log(`Boss bullet ${index + 1} fired from x=${bulletX}, y=${bulletY}, angle=${Phaser.Math.RadToDeg(angle)}deg`);
                });
                this.sounds.shoot.play();
            } else if (isBoss) {
                // Boss phase 0: Shoot 1 bullet from left side
                const angle = Phaser.Math.Angle.Between(bulletX, bulletY, this.player.x, this.player.y);
                const bullet = this.enemyBullets.create(bulletX, bulletY, 'enemyBullet').setScale(0.5).setDepth(8);
                bullet.setVelocityX(Math.cos(angle) * bulletSpeed);
                bullet.setVelocityY(Math.sin(angle) * bulletSpeed);
                bullet.body.setAllowGravity(false);
                console.log(`Boss bullet fired from x=${bulletX}, y=${bulletY}, angle=${Phaser.Math.RadToDeg(angle)}deg`);
                this.sounds.shoot.play();
            } else {
                // Normal enemy: Shoot 1 bullet from random y within sprite height
                const height = enemy.height * enemy.scaleY;
                const yMin = enemy.y - height / 2;
                const yMax = enemy.y + height / 2;
                const bulletY = Phaser.Math.FloatBetween(yMin, yMax);
                const bullet = this.enemyBullets.create(enemy.x, bulletY, 'enemyBullet').setScale(0.5).setDepth(8);
                const angle = Phaser.Math.Angle.Between(enemy.x, bulletY, this.player.x, this.player.y);
                bullet.setVelocityX(Math.cos(angle) * bulletSpeed);
                bullet.setVelocityY(Math.sin(angle) * bulletSpeed);
                bullet.body.setAllowGravity(false);
                console.log(`Enemy bullet fired from x=${enemy.x}, y=${bulletY} (range: ${yMin} to ${yMax}), angle=${Phaser.Math.RadToDeg(angle)}deg`);
                this.sounds.shoot.play();
            }
        } catch (error) {
            console.error('Error in shootEnemyBullet:', error);
        }
    }

    destroyBoss() {
        this.boss.setVisible(false);
        this.boss.body.enable = false;
        this.bossHealthBar.visible = false;

        const explosion = this.add.graphics({ x: this.boss.x, y: this.boss.y });
        explosion.setDepth(10);

        const initialRadius = 10;
        const finalRadius = 60;
        let currentRadius = initialRadius;
        const duration = 1000;
        const explosionColor = 0xefa60f;

        const createStarPoints = (radius) => {
            const points = [];
            const numPoints = 8;
            for (let i = 0; i < numPoints; i++) {
                const angle = (i * 2 * Math.PI) / numPoints;
                const pointRadius = (i % 2 === 0 ? radius : radius * 0.5) * (1 + Phaser.Math.FloatBetween(-0.2, 0.2));
                points.push({
                    x: Math.cos(angle) * pointRadius,
                    y: Math.sin(angle) * pointRadius
                });
            }
            return points;
        };

        this.tweens.add({
            targets: { radius: initialRadius },
            radius: finalRadius,
            alpha: { from: 1, to: 0 },
            duration: duration,
            ease: 'Power2',
            onUpdate: (tween) => {
                currentRadius = tween.getValue();
                explosion.clear();
                explosion.fillStyle(explosionColor, 1);
                const points = createStarPoints(currentRadius);
                explosion.beginPath();
                explosion.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    explosion.lineTo(points[i].x, points[i].y);
                }
                explosion.closePath();
                explosion.fillPath();
            },
            onComplete: () => {
                explosion.destroy();
                this.boss.destroy();
                this.gameOver();
            }
        });

        this.updateScore(1000);
    }

    shootBullet() {
        const bulletSpeed = 500;
        let velocityX = 0;
        let velocityY = 0;

        const isUp = this.cursors.up.isDown;
        const isDown = this.cursors.down.isDown;
        const isLeft = this.cursors.left.isDown;
        const isRight = this.cursors.right.isDown;

        if (isUp && isRight) {
            velocityX = bulletSpeed / Math.sqrt(2);
            velocityY = -bulletSpeed / Math.sqrt(2);
        } else if (isUp && isLeft) {
            velocityX = -bulletSpeed / Math.sqrt(2);
            velocityY = -bulletSpeed / Math.sqrt(2);
        } else if (isDown && isRight) {
            velocityX = bulletSpeed / Math.sqrt(2);
            velocityY = bulletSpeed / Math.sqrt(2);
        } else if (isDown && isLeft) {
            velocityX = -bulletSpeed / Math.sqrt(2);
            velocityY = bulletSpeed / Math.sqrt(2);
        } else if (isUp) {
            velocityY = -bulletSpeed;
        } else if (isDown) {
            velocityY = bulletSpeed;
        } else if (isLeft) {
            velocityX = -bulletSpeed;
        } else if (isRight) {
            velocityX = bulletSpeed;
        } else {
            velocityX = this.player.flipX ? -bulletSpeed : bulletSpeed;
        }

        const bullet = this.playerBullets.create(
            this.player.x + (velocityX !== 0 ? (velocityX > 0 ? 20 : -20) : 0),
            this.player.y - 20 + (velocityY !== 0 ? (velocityY > 0 ? 20 : -20) : 0),
            'playerBullet'
        ).setScale(0.1).setDepth(8);

        bullet.setVelocity(velocityX, velocityY);
        bullet.body.setAllowGravity(false);
        this.sounds.shoot.play();
    }

    spawnCapsule() {
        const x = this.cameras.main.scrollX + this.width + 50;
        const y = Phaser.Math.Between(100, 300);
        const capsule = this.capsules.create(x, y, 'powerup_capsule').setScale(0.25).setDepth(8);
        capsule.body.setAllowGravity(false);
        capsule.initialY = y;
        capsule.isHealthCapsule = false;
        console.log('Rapid-fire capsule spawned at:', { x, y });
    }

    spawnHealthCapsule() {
        const x = this.cameras.main.scrollX + this.width + 50;
        const y = Phaser.Math.Between(100, 300);
        const capsule = this.capsules.create(x, y, 'powerup_capsule').setScale(0.25).setDepth(8);
        capsule.body.setAllowGravity(false);
        capsule.initialY = y;
        capsule.isHealthCapsule = true;
        console.log('Health capsule spawned at:', { x, y });
    }

    hitCapsule(capsule, bullet) {
        bullet.destroy();
        this.sounds.damage.play();

        capsule.setVisible(false);
        capsule.body.enable = false;

        const explosion = this.add.graphics({ x: capsule.x, y: capsule.y });
        explosion.setDepth(10);

        const initialRadius = 5;
        const finalRadius = 30;
        let currentRadius = initialRadius;
        const duration = 500;
        const explosionColor = 0xefa60f;

        const createStarPoints = (radius) => {
            const points = [];
            const numPoints = 8;
            for (let i = 0; i < numPoints; i++) {
                const angle = (i * 2 * Math.PI) / numPoints;
                const pointRadius = (i % 2 === 0 ? radius : radius * 0.5) * (1 + Phaser.Math.FloatBetween(-0.2, 0.2));
                points.push({
                    x: Math.cos(angle) * pointRadius,
                    y: Math.sin(angle) * pointRadius
                });
            }
            return points;
        };

        this.tweens.add({
            targets: { radius: initialRadius },
            radius: finalRadius,
            alpha: { from: 1, to: 0 },
            duration: duration,
            ease: 'Power2',
            onUpdate: (tween) => {
                currentRadius = tween.getValue();
                explosion.clear();
                explosion.fillStyle(explosionColor, 1);
                const points = createStarPoints(currentRadius);
                explosion.beginPath();
                explosion.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    explosion.lineTo(points[i].x, points[i].y);
                }
                explosion.closePath();
                explosion.fillPath();
            },
            onComplete: () => {
                explosion.destroy();
                capsule.destroy();
                const powerUpKey = capsule.isHealthCapsule ? 'powerup1' : 'powerup';
                const powerup = this.powerups.create(capsule.x, capsule.y, powerUpKey).setScale(0.25).setDepth(8);
                powerup.setVelocityY(-200);
                powerup.body.setAllowGravity(true);
            }
        });
    }

    collectPowerUp(player, powerup) {
        powerup.destroy();
        this.sounds.shoot.play();

        if (powerup.texture.key === 'powerup1') {
            this.lives++;
            const heartIndex = this.lives - 1;
            this.hearts[heartIndex] = this.add.image(50 + heartIndex * 35, 60, 'heart')
                .setScale(0.025)
                .setDepth(11)
                .setScrollFactor(0);
            console.log('Health power-up collected, lives:', this.lives);
        } else {
            if (this.hasPowerUp && this.powerUpSprite) {
                this.powerUpSprite.destroy();
            }
            this.hasPowerUp = true;
            this.powerUpSprite = null;
            console.log('Rapid-fire power-up collected');
        }
    }

    updateScore(points) {
        this.score += points;
        this.scoreText.setText(`Score: ${this.score}`);
    }

    gameOver() {
        this.sound.stopAll();
        this.hearts.forEach(heart => {
            if (heart && heart.visible) {
                this.tweens.add({
                    targets: heart,
                    alpha: 0,
                    duration: 500,
                    ease: 'Linear',
                    onComplete: () => {
                        heart.setVisible(false);
                        heart.destroy();
                    }
                });
            }
        });
        this.sounds.lose.setVolume(0.5).setLoop(false).play();
        this.gameOverText.setAlpha(1);
        this.vfx.blinkEffect(this.gameOverText, 400, 3);
        this.vfx.shakeCamera(300, 0.04);
        this.time.delayedCall(2500, () => {
            if (typeof initiateGameOver === 'function') {
                initiateGameOver.bind(this)({ score: this.score });
            } else {
                console.warn('initiateGameOver is not defined');
            }
        });
    }

    pauseGame() {
        if (typeof handlePauseGame === 'function') {
            handlePauseGame.bind(this)();
        } else {
            console.warn('handlePauseGame is not defined');
        }
    }

    countPlatformsInXRange(platforms, x, range = 200) {
        return platforms.filter(p => Math.abs(p.x - x) <= range).length;
    }

    generatePlatforms() {
        if (this.bossActive) return;

        const cameraRightEdge = this.cameras.main.scrollX + this.width;
        const currentTile = Math.floor((cameraRightEdge + this.width) / this.backgroundTileWidth);
        const tilesToGenerate = 3;

        for (let i = currentTile; i < currentTile + tilesToGenerate; i++) {
            const tileOffset = i * this.backgroundTileWidth;
            const platformPositions = [];

            const weightedLevels = [
                ...this.platformLevels.slice(0, -1),
                300, 300, 550, 550
            ];
            const shuffledLevels = Phaser.Utils.Array.Shuffle(weightedLevels);

            const numPlatforms = Phaser.Math.Between(3, 5);
            for (let j = 0; j < numPlatforms && j < shuffledLevels.length; j++) {
                const y = shuffledLevels[j];
                const imageHeight = this.platformImageHeights[y];
                const imageKey = this.platformImageKeys[y];

                let x;
                let attempts = 0;
                const maxAttempts = 10;
                do {
                    x = tileOffset + Phaser.Math.Between(200, this.backgroundTileWidth - 200);
                    attempts++;
                } while (this.countPlatformsInXRange(platformPositions, x, 200) > 0 && attempts < maxAttempts);

                if (attempts < maxAttempts && x > cameraRightEdge) {
                    const width = Phaser.Math.Between(150, 300);
                    platformPositions.push({ x, y, width, height: 20, imageHeight, imageKey });

                    const currentLevelIndex = this.platformLevels.indexOf(y);
                    if (currentLevelIndex < this.platformLevels.length - 2) {
                        const nextY = this.platformLevels[currentLevelIndex + 1];
                        const nextImageHeight = this.platformImageHeights[nextY];
                        const nextImageKey = this.platformImageKeys[nextY];
                        let nextX;
                        let nextAttempts = 0;
                        do {
                            nextX = x + Phaser.Math.Between(150, 250);
                            nextAttempts++;
                        } while (this.countPlatformsInXRange(platformPositions, nextX, 150) > 0 && nextAttempts < maxAttempts);

                        if (nextAttempts < maxAttempts && nextX > cameraRightEdge && nextImageKey) {
                            const nextWidth = Phaser.Math.Between(150, 300);
                            platformPositions.push({ x: nextX, y: nextY, width: nextWidth, height: 20, imageHeight: nextImageHeight, imageKey: nextImageKey });
                        }
                    }
                }
            }

            const sortedPositions = platformPositions.sort((a, b) => a.y - b.y);
            const accessiblePositions = [];
            let lastY = this.platformLevels[7];

            for (let pos of sortedPositions) {
                if (pos.y <= lastY - 50 && pos.y >= lastY - 176) {
                    accessiblePositions.push(pos);
                    lastY = pos.y;
                } else if (pos.y < lastY - 176) {
                    const intermediateY = this.platformLevels.find(ly => ly > pos.y && ly <= lastY - 50);
                    if (intermediateY) {
                        let x;
                        let attempts = 0;
                        const maxAttempts = 10;
                        do {
                            x = tileOffset + Phaser.Math.Between(200, this.backgroundTileWidth - 200);
                            attempts++;
                        } while (this.countPlatformsInXRange(accessiblePositions, x, 200) > 0 && attempts < maxAttempts);

                        if (attempts < maxAttempts && x > cameraRightEdge) {
                            const width = Phaser.Math.Between(150, 300);
                            const imageHeight = this.platformImageHeights[intermediateY];
                            const imageKey = this.platformImageKeys[intermediateY];
                            accessiblePositions.push({ x, y: intermediateY, width, height: 20, imageHeight, imageKey });
                            lastY = intermediateY;
                        }
                    }
                    accessiblePositions.push(pos);
                    lastY = pos.y;
                } else {
                    accessiblePositions.push(pos);
                    lastY = pos.y;
                }
            }

            accessiblePositions.forEach(pos => {
                const x = pos.x;
                const y = pos.y;
                const width = pos.width;
                const height = pos.height;
                const imageHeight = pos.imageHeight;
                const imageKey = pos.imageKey;

                const existingPlatform = this.platformPool.find(p => Math.abs(p.x - x) < 10 && p.y === y);
                if (!existingPlatform && imageKey) {
                    let platform = this.platforms.create(x, y, 'blank').setSize(width, height).setVisible(false);
                    let platformImage = this.add.image(x, y + height / 2, imageKey)
                        .setDisplaySize(width, imageHeight)
                        .setOrigin(0.5, 0)
                        .setDepth(this.platformDepths[imageKey]);
                    platform.image = platformImage;
                    this.platformPool.push(platform);
                }
            });

            if (platformPositions.length === 0) {
                const y = this.platformLevels[Phaser.Math.Between(0, this.platformLevels.length - 2)];
                const x = tileOffset + Phaser.Math.Between(200, this.backgroundTileWidth - 200);
                if (x > cameraRightEdge) {
                    const width = Phaser.Math.Between(150, 300);
                    const imageHeight = this.platformImageHeights[y];
                    const imageKey = this.platformImageKeys[y];
                    let platform = this.platforms.create(x, y, 'blank').setSize(width, 20).setVisible(false);
                    let platformImage = this.add.image(x, y + 10, imageKey)
                        .setDisplaySize(width, imageHeight)
                        .setOrigin(0.5, 0)
                        .setDepth(this.platformDepths[imageKey]);
                    platform.image = platformImage;
                    this.platformPool.push(platform);

                    const currentLevelIndex = this.platformLevels.indexOf(y);
                    if (currentLevelIndex < this.platformLevels.length - 2) {
                        const nextY = this.platformLevels[currentLevelIndex + 1];
                        const nextImageHeight = this.platformImageHeights[nextY];
                        const nextImageKey = this.platformImageKeys[nextY];
                        let nextX;
                        let nextAttempts = 0;
                        const maxAttempts = 10;
                        do {
                            nextX = x + Phaser.Math.Between(150, 250);
                            nextAttempts++;
                        } while (this.countPlatformsInXRange(platformPositions, nextX, 150) > 0 && nextAttempts < maxAttempts);

                        if (nextAttempts < maxAttempts && nextX > cameraRightEdge && nextImageKey) {
                            const nextWidth = Phaser.Math.Between(150, 300);
                            let nextPlatform = this.platforms.create(nextX, nextY, 'blank').setSize(nextWidth, 20).setVisible(false);
                            let nextPlatformImage = this.add.image(nextX, nextY + 10, nextImageKey)
                                .setDisplaySize(nextWidth, nextImageHeight)
                                .setOrigin(0.5, 0)
                                .setDepth(this.platformDepths[nextImageKey]);
                            nextPlatform.image = nextPlatformImage;
                            this.platformPool.push(nextPlatform);
                        }
                    }
                }
            }
        }

        this.lastPlatformX = (currentTile + tilesToGenerate) * this.backgroundTileWidth;
    }

    spawnEnemy() {
        if (this.score >= 6000) return;

        const spawnBull = Phaser.Math.Between(0, 100) < 25;

        const suitablePlatforms = this.platformPool.filter(p =>
            p.x > this.player.x &&
            p.x < this.player.x + this.width + 500 &&
            p !== this.bottomPlatform &&
            this.platformLevels.slice(0, 7).includes(p.y)
        );

        let y;
        if (suitablePlatforms.length > 0) {
            const platform = suitablePlatforms[Phaser.Math.Between(0, suitablePlatforms.length - 1)];
            y = platform.y - 20;
        } else {
            y = this.platformLevels[7] - 20;
        }

        if (spawnBull) {
            const x = this.cameras.main.scrollX - 50;
            const bull = this.bullEnemies.create(x, y, 'bullEnemy').setScale(0.35).setDepth(8);
            bull.body.setSize(bull.width * 0.6, bull.height * 0.8);
            bull.body.setAllowGravity(true);
            bull.setFlipX(true);
            console.log('Bull enemy spawned at:', { x, y });
        } else {
            const x = this.player.x + this.width + Phaser.Math.Between(200, 500);
            const enemy = this.enemies.create(x, y, 'enemy').setScale(0.3).setDepth(8);
            enemy.nextShotTime = this.time.now + Phaser.Math.Between(1000, 3000);
            enemy.body.setAllowGravity(true);
            console.log('Regular enemy spawned at:', { x, y });
        }
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

function gameSceneCreate(game) {
    const bgTexture = game.textures.get('background');
    const bgHeight = bgTexture.getSourceImage().height * 2.5;
    const yOffset = (bgHeight - game.height) / 2;
    game.background = game.add.tileSprite(0, yOffset, game.width * 4, bgHeight, 'background')
        .setOrigin(0, 0)
        .setScale(2.9);
    game.background.setScrollFactor(0);

    game.platforms = game.physics.add.staticGroup();

    game.bottomPlatform = game.platforms.create(0, game.platformLevels[7], 'blank').setSize(1000000, 20).setVisible(false);
    game.platformPool.push(game.bottomPlatform);

    const platformData = [];
    const shuffledLevels = Phaser.Utils.Array.Shuffle([...game.platformLevels.slice(0, -1)]);
    for (let j = 0; j < shuffledLevels.length; j++) {
        const y = shuffledLevels[j];
        const imageHeight = game.platformImageHeights[y];
        const imageKey = game.platformImageKeys[y];
        let x = -200 + j * 300;
        const width = Phaser.Math.Between(150, 300);
        platformData.push({ x, y, width, height: 20, imageHeight, imageKey });

        const currentLevelIndex = game.platformLevels.indexOf(y);
        if (currentLevelIndex < game.platformLevels.length - 2) {
            const nextY = game.platformLevels[currentLevelIndex + 1];
            const nextImageHeight = game.platformImageHeights[nextY];
            const nextImageKey = game.platformImageKeys[nextY];
            const nextX = x + Phaser.Math.Between(150, 250);
            const nextWidth = Phaser.Math.Between(150, 300);
            platformData.push({ x: nextX, y: nextY, width: nextWidth, height: 20, imageHeight: nextImageHeight, imageKey: nextImageKey });
        }
    }

    const sortedData = platformData.sort((a, b) => a.y - b.y);
    const accessibleData = [];
    let lastY = game.platformLevels[7];

    for (let pos of sortedData) {
        if (pos.y <= lastY - 50 && pos.y >= lastY - 176) {
            accessibleData.push(pos);
            lastY = pos.y;
        } else if (pos.y < lastY - 176) {
            const intermediateY = game.platformLevels.find(ly => ly > pos.y && ly <= lastY - 50);
            if (intermediateY) {
                const x = pos.x + Phaser.Math.Between(-100, 100);
                const width = Phaser.Math.Between(150, 300);
                const imageHeight = game.platformImageHeights[intermediateY];
                const imageKey = game.platformImageKeys[intermediateY];
                accessibleData.push({ x, y: intermediateY, width, height: 20, imageHeight, imageKey });
                lastY = intermediateY;
            }
            accessibleData.push(pos);
            lastY = pos.y;
        } else {
            accessibleData.push(pos);
            lastY = pos.y;
        }
    }

    accessibleData.forEach(data => {
        if (data.imageKey) {
            const platform = game.platforms.create(data.x, data.y, 'blank').setSize(data.width, data.height).setVisible(false);
            let platformImage = game.add.image(data.x, data.y + data.height / 2, data.imageKey)
                .setDisplaySize(data.width, data.imageHeight)
                .setOrigin(0.5, 0)
                .setDepth(game.platformDepths[data.imageKey]);
            platform.image = platformImage;
            game.platformPool.push(platform);
        }
    });

    game.lastPlatformX = Math.max(...accessibleData.map(d => d.x)) || 0;
    game.minPlatformX = Math.min(...accessibleData.map(d => d.x)) || -200;

    game.player = game.physics.add.sprite(100, 620, 'player').setScale(0.2).setDepth(8);
    game.physics.world.setBounds(-Infinity, 0, Infinity, game.height);
    game.player.body.setSize(game.player.width * 0.5, game.player.height * 0.8);
    game.cursors = game.input.keyboard.createCursorKeys();
    game.xKey = game.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    game.zKey = game.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    game.lastShotTime = 0;

    game.enemies = game.physics.add.group();
    game.bullEnemies = game.physics.add.group();
    game.playerBullets = game.physics.add.group();
    game.enemyBullets = game.physics.add.group();
    game.capsules = game.physics.add.group();
    game.powerups = game.physics.add.group();

    const enemyData = [
        { x: 600, y: game.platformLevels[6] - 20 },
        { x: 1200, y: game.platformLevels[7] - 20 },
        { x: 1800, y: game.platformLevels[5] - 20 },
        { x: 2500, y: game.platformLevels[4] - 20 }
    ];
    enemyData.forEach(data => {
        const enemy = game.enemies.create(data.x, data.y, 'enemy').setScale(0.3).setDepth(8);
        enemy.nextShotTime = game.time.now + Phaser.Math.Between(1000, 3000);
        enemy.body.setAllowGravity(true);
    });

    game.physics.add.collider(game.player, game.platforms, (player, platform) => {
        if (player.body.touching.down && platform.body.touching.up) {
            player.currentPlatform = platform;
        }
    }, (player, platform) => {
        return player.body.velocity.y >= 0;
    });

    game.physics.add.collider(game.enemies, game.platforms);
    game.physics.add.collider(game.bullEnemies, game.platforms);
    game.physics.add.collider(game.powerups, game.platforms, (powerup, platform) => {
        if (platform.y === game.platformLevels[7]) {
            powerup.setVelocityY(0);
            powerup.body.setAllowGravity(false);
            game.powerUpSprite = powerup;
        }
    }, (powerup, platform) => {
        return powerup.body.velocity.y >= 0 && platform.y === game.platformLevels[7];
    });

    game.physics.add.overlap(game.player, game.enemyBullets, hitPlayer, null, game);
    game.physics.add.overlap(game.enemies, game.playerBullets, hitEnemy, null, game);
    game.physics.add.overlap(game.bullEnemies, game.playerBullets, hitEnemy, null, game);
    game.physics.add.overlap(game.player, game.bullEnemies, hitPlayerByBull, null, game);
    game.physics.add.overlap(game.capsules, game.playerBullets, game.hitCapsule, null, game);
    game.physics.add.overlap(game.player, game.powerups, game.collectPowerUp, null, game);
}

function hitPlayer(player, bullet) {
    bullet.destroy();
    this.lives--;
    let heart = this.hearts[this.lives];
    this.tweens.add({
        targets: heart,
        y: heart.y - 20,
        alpha: 0,
        duration: 500,
        ease: 'Linear',
        onComplete: () => heart.destroy()
    });

    if (this.hasPowerUp) {
        this.hasPowerUp = false;
        if (this.powerUpSprite) {
            this.powerUpSprite.destroy();
            this.powerUpSprite = null;
        }
    }

    if (this.lives > 0) {
        this.sounds.damage.setVolume(0.5).setLoop(false).play();
        this.vfx.shakeCamera(100, 0.01);
    } else {
        this.gameOver();
    }
}

function hitPlayerByBull(player, bull) {
    bull.destroy();
    this.lives--;
    let heart = this.hearts[this.lives];
    this.tweens.add({
        targets: heart,
        y: heart.y - 20,
        alpha: 0,
        duration: 500,
        ease: 'Linear',
        onComplete: () => heart.destroy()
    });

    if (this.hasPowerUp) {
        this.hasPowerUp = false;
        if (this.powerUpSprite) {
            this.powerUpSprite.destroy();
            this.powerUpSprite = null;
        }
    }

    if (this.lives > 0) {
        this.sounds.damage.setVolume(0.5).setLoop(false).play();
        this.vfx.shakeCamera(100, 0.01);
    } else {
        this.gameOver();
    }
}

function hitEnemy(enemy, bullet) {
    bullet.destroy();
    this.sounds.damage.play();
    this.updateScore(100);

    enemy.setVisible(false);
    enemy.body.enable = false;

    const explosion = this.add.graphics({ x: enemy.x, y: enemy.y });
    explosion.setDepth(10);

    const initialRadius = 5;
    const finalRadius = 30;
    let currentRadius = initialRadius;
    const duration = 500;
    const explosionColor = 0xefa60f;

    const createStarPoints = (radius) => {
        const points = [];
        const numPoints = 8;
        for (let i = 0; i < numPoints; i++) {
            const angle = (i * 2 * Math.PI) / numPoints;
            const pointRadius = (i % 2 === 0 ? radius : radius * 0.5) * (1 + Phaser.Math.FloatBetween(-0.2, 0.2));
            points.push({
                x: Math.cos(angle) * pointRadius,
                y: Math.sin(angle) * pointRadius
            });
        }
        return points;
    };

    this.tweens.add({
        targets: { radius: initialRadius },
        radius: finalRadius,
        alpha: { from: 1, to: 0 },
        duration: duration,
        ease: 'Power2',
        onUpdate: (tween) => {
            currentRadius = tween.getValue();
            explosion.clear();
            explosion.fillStyle(explosionColor, 1);
            const points = createStarPoints(currentRadius);
            explosion.beginPath();
            explosion.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                explosion.lineTo(points[i].x, points[i].y);
            }
            explosion.closePath();
            explosion.fillPath();
        },
        onComplete: () => {
            explosion.destroy();
            enemy.destroy();
        }
    });
}

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
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 600 },
            debug: false,
        },
    },
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions,
    },
    orientation: _CONFIG.deviceOrientation === "portrait"
};