class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.score = 0;
        this.health = 100;
        this.isGameOver = false;
        this.player = null;
        this.projectiles = null;
        this.enemies = null;
        this.powerups = null;
        this.background = null;
        this.scoreText = null;
        this.healthBar = null;
        this.killStreak = 0;
        this.scoreMultiplier = 1;
        this.shieldActive = false;
        this.missileActive = false;
        this.missileTimer = null;
        this.shieldTimer = null;
        this.distance = 0;
        this.distanceText = null;
        this.shieldTimerCircle = null;
        this.missileTimerCircle = null;
        this.shieldTimerText = null;
        this.missileTimerText = null;
        this.timerRadius = 35;
        this.timerTextSize = 45;

        this.healthCount = 0;
        this.missileCount = 0;
        this.shieldCount = 0;
        this.airstrikeCount = 0;

        this.healthInventoryText = null;
        this.missileInventoryText = null;
        this.shieldInventoryText = null;
        this.airstrikeInventoryText = null;

        this.width = _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width;
        this.height = _CONFIG.orientationSizes[_CONFIG.deviceOrientation].height;
    }

    preload() {
        this.isGameOver = false;

        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }
        for (const key in _CONFIG.libLoader) {
            this.load.image(key, _CONFIG.libLoader[key]);
        }
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, _CONFIG.soundsLoader[key]);
        }
        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/";
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        addEventListenersPhaser.bind(this)();
        displayProgressLoader.call(this);

        this.createSmokeTexture();
    }

    create() {
        this.vfx = new VFXLibrary(this);

        this.vfx.addCircleTexture('smoke', 0x888888, 0.4, 20);

        this.sound.play('background', { loop: true });

        this.background = this.add.tileSprite(0, 0, this.game.config.width, this.game.config.height, 'Background')
            .setOrigin(0, 0)
            .setScrollFactor(0);

        this.player = this.physics.add.sprite(200, this.height + 10, 'Player');
        this.player.setCollideWorldBounds(true);
        this.player.setBounce(0.2);
        this.player.setDrag(100);
        this.player.setMaxVelocity(200);
        this.player.setDepth(10);
        this.player.setScale(0.3);

        this.setupPlayerSmoke();

        this.projectiles = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Image,
            defaultKey: 'projectile',
            maxSize: 10
        });
        this.projectiles.setDepth(5);

        this.projectile_1 = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Image,
            defaultKey: 'projectile_1',
            maxSize: 5
        });
        this.projectile_1.setDepth(5);

        this.enemyBullets = this.physics.add.group({
             classType: Phaser.Physics.Arcade.Image,
             defaultKey: 'bullet',
             maxSize: 30
        });
        this.enemyBullets.setDepth(6);

        this.enemies = this.physics.add.group();
        this.enemies.setDepth(5);

        this.powerups = this.physics.add.group();
        this.powerups.setDepth(5);

        this.physics.add.collider(this.player, this.enemies, this.handlePlayerEnemyCollision, null, this);
        this.physics.add.collider(this.projectiles, this.enemies, this.handleBulletEnemyCollision, null, this);
        this.physics.add.collider(this.projectile_1, this.enemies, this.handleBulletEnemyCollision, null, this);
        this.physics.add.overlap(this.player, this.powerups, this.collectPowerup, null, this);
        this.physics.add.overlap(this.player, this.enemyBullets, this.handlePlayerBulletCollision, null, this);
        this.physics.add.overlap(this.projectiles, this.enemyBullets, this.handleBulletBulletCollision, null, this);
        this.physics.add.overlap(this.projectile_1, this.enemyBullets, this.handleBulletBulletCollision, null, this);

        this.createUI();

        this.cursors = this.input.keyboard.createCursorKeys();
        this.spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P).on('keydown', () => this.pauseGame());
        this.input.keyboard.disableGlobalCapture();

        this.pauseButton = this.add.sprite(this.width - 60, 60, "pauseButton")
            .setOrigin(0.5, 0.5)
            .setDepth(11)
            .setScale(3)
            .setInteractive({ cursor: 'pointer' })
            .on('pointerdown', () => this.pauseGame());

        this.createAnimations();

        this.time.addEvent({
            delay: 2000,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });

        this.time.addEvent({
            delay: 10000,
            callback: this.spawnPowerup,
            callbackScope: this,
            loop: true
        });

        this.lastShotTime = 0;
        this.isShooting = false;
    }

    createUI() {
        const scorecardWidth = 400;
        const scorecardHeight = 60;
        const scorecardX = 16;
        const scorecardY = 16;
        const cornerRadius = 10;

        this.scorecardBackground = this.add.graphics();
        this.scorecardBackground.fillStyle(0x2c3e50, 1);
        this.scorecardBackground.fillRoundedRect(scorecardX, scorecardY, scorecardWidth, scorecardHeight, cornerRadius);
        this.scorecardBackground.lineStyle(2, 0xbdc3c7, 1);
        this.scorecardBackground.strokeRoundedRect(scorecardX, scorecardY, scorecardWidth, scorecardHeight, cornerRadius);
        this.scorecardBackground.setScrollFactor(0);
        this.scorecardBackground.setDepth(10);

        const dividerX = scorecardX + scorecardWidth / 2;
        this.scorecardBackground.lineStyle(2, 0xbdc3c7, 1);
        this.scorecardBackground.beginPath();
        this.scorecardBackground.moveTo(dividerX, scorecardY);
        this.scorecardBackground.lineTo(dividerX, scorecardY + scorecardHeight);
        this.scorecardBackground.strokePath();

        const leftPadding = 2;
        const rightPadding = 10;

        this.scoreText = this.add.bitmapText(scorecardX + leftPadding, scorecardY + scorecardHeight / 2, 'pixelfont', '$0', 32)
            .setOrigin(0, 0.5)
            .setScrollFactor(0)
            .setDepth(11)
            .setTint(0x00ff00);

        this.distanceText = this.add.bitmapText(dividerX + rightPadding, scorecardY + scorecardHeight / 2, 'pixelfont', '0m', 32)
            .setOrigin(0, 0.5)
            .setScrollFactor(0)
            .setDepth(11)
            .setTint(0xffff00);

        const healthBarWidth = 100;
        const healthBarHeight = 10;

        this.healthBar = this.add.graphics();
        this.healthBar.setDepth(11);

        this.crosshair = this.add.graphics();
        this.crosshair.lineStyle(4, 0xffffff, 1);
        this.crosshair.strokeCircle(0, 0, 30);
        this.crosshair.strokeCircle(0, 0, 15);
        this.crosshair.lineBetween(-40, 0, -20, 0);
        this.crosshair.lineBetween(20, 0, 40, 0);
        this.crosshair.lineBetween(0, -40, 0, -20);
        this.crosshair.lineBetween(0, 20, 0, 40);
        this.crosshair.setDepth(12);
        this.crosshair.setScrollFactor(0);

        const centerX = this.width / 2;
        const centerY = this.height / 2;

        this.timersY = scorecardY + scorecardHeight + 35;
        this.shieldTimerCenterX = scorecardX + scorecardWidth / 4 - 10;
        this.missileTimerCenterX = scorecardX + scorecardWidth * 3 / 4 + 10;

        this.shieldTimerCircle = this.add.graphics();
        this.shieldTimerCircle.setDepth(11);
        this.shieldTimerText = this.add.bitmapText(this.shieldTimerCenterX, this.timersY, 'pixelfont', '', this.timerTextSize)
            .setDepth(12)
            .setTint(0x00ffff)
            .setOrigin(0.5);

        this.missileTimerCircle = this.add.graphics();
        this.missileTimerCircle.setDepth(11);
        this.missileTimerText = this.add.bitmapText(this.missileTimerCenterX, this.timersY, 'pixelfont', '', this.timerTextSize)
            .setDepth(12)
            .setTint(0xff0000)
            .setOrigin(0.5);

        const slotSpacing = 20;
        const slotSize = 60;
        const outerCircleSize = 80;
        const firstSlotX = scorecardX;
        const slotsY = this.timersY;

        const healthSlotX = firstSlotX;
        const healthSlotY = slotsY;
        if (this.healthSlotBackground) this.healthSlotBackground.destroy();

        this.healthSlotBackground = this.add.graphics();
        this.healthSlotBackground.fillStyle(0x2c3e50, 0.3);
        this.healthSlotBackground.fillCircle(healthSlotX + outerCircleSize/2, healthSlotY + outerCircleSize/2, outerCircleSize/2);
        this.healthSlotBackground.lineStyle(2, 0xbdc3c7, 1);
        this.healthSlotBackground.strokeCircle(healthSlotX + outerCircleSize/2, healthSlotY + outerCircleSize/2, outerCircleSize/2);
        this.healthSlotBackground.fillStyle(0x2c3e50, 1);
        this.healthSlotBackground.fillCircle(healthSlotX + outerCircleSize/2, healthSlotY + outerCircleSize/2, slotSize/2);
        this.healthSlotBackground.lineStyle(2, 0xbdc3c7, 1);
        this.healthSlotBackground.strokeCircle(healthSlotX + outerCircleSize/2, healthSlotY + outerCircleSize/2, slotSize/2);
        this.healthSlotBackground.setScrollFactor(0).setDepth(10);

        this.healthIcon = this.add.image(healthSlotX + outerCircleSize/2, healthSlotY + outerCircleSize/2, 'powerup_health')
            .setScale(0.3)
            .setScrollFactor(0).setDepth(11);
        this.healthIcon.setInteractive({ useHandCursor: true });
        this.healthIcon.on('pointerdown', () => this.activatePowerup('health'));

        const missileSlotX = firstSlotX;
        const missileSlotY = healthSlotY + outerCircleSize + slotSpacing;
        if (this.missileSlotBackground) this.missileSlotBackground.destroy();

        this.missileSlotBackground = this.add.graphics();
        this.missileSlotBackground.fillStyle(0x2c3e50, 0.3);
        this.missileSlotBackground.fillCircle(missileSlotX + outerCircleSize/2, missileSlotY + outerCircleSize/2, outerCircleSize/2);
        this.missileSlotBackground.lineStyle(2, 0xbdc3c7, 1);
        this.missileSlotBackground.strokeCircle(missileSlotX + outerCircleSize/2, missileSlotY + outerCircleSize/2, outerCircleSize/2);
        this.missileSlotBackground.fillStyle(0x2c3e50, 1);
        this.missileSlotBackground.fillCircle(missileSlotX + outerCircleSize/2, missileSlotY + outerCircleSize/2, slotSize/2);
        this.missileSlotBackground.lineStyle(2, 0xbdc3c7, 1);
        this.missileSlotBackground.strokeCircle(missileSlotX + outerCircleSize/2, missileSlotY + outerCircleSize/2, slotSize/2);
        this.missileSlotBackground.setScrollFactor(0).setDepth(10);

        this.missileIcon = this.add.image(missileSlotX + outerCircleSize/2, missileSlotY + outerCircleSize/2, 'powerup_missile')
            .setScale(0.16)
            .setScrollFactor(0).setDepth(11);
        this.missileIcon.setInteractive({ useHandCursor: true });
        this.missileIcon.on('pointerdown', () => this.activatePowerup('missile'));

        const shieldSlotX = firstSlotX;
        const shieldSlotY = missileSlotY + outerCircleSize + slotSpacing;
        if (this.shieldSlotBackground) this.shieldSlotBackground.destroy();

        this.shieldSlotBackground = this.add.graphics();
        this.shieldSlotBackground.fillStyle(0x2c3e50, 0.3);
        this.shieldSlotBackground.fillCircle(shieldSlotX + outerCircleSize/2, shieldSlotY + outerCircleSize/2, outerCircleSize/2);
        this.shieldSlotBackground.lineStyle(2, 0xbdc3c7, 1);
        this.shieldSlotBackground.strokeCircle(shieldSlotX + outerCircleSize/2, shieldSlotY + outerCircleSize/2, outerCircleSize/2);
        this.shieldSlotBackground.fillStyle(0x2c3e50, 1);
        this.shieldSlotBackground.fillCircle(shieldSlotX + outerCircleSize/2, shieldSlotY + outerCircleSize/2, slotSize/2);
        this.shieldSlotBackground.lineStyle(2, 0xbdc3c7, 1);
        this.shieldSlotBackground.strokeCircle(shieldSlotX + outerCircleSize/2, shieldSlotY + outerCircleSize/2, slotSize/2);
        this.shieldSlotBackground.setScrollFactor(0).setDepth(10);

        this.shieldIcon = this.add.image(shieldSlotX + outerCircleSize/2, shieldSlotY + outerCircleSize/2, 'powerup_shield')
            .setScale(0.15)
            .setScrollFactor(0).setDepth(11);
        this.shieldIcon.setInteractive({ useHandCursor: true });
        this.shieldIcon.on('pointerdown', () => this.activatePowerup('shield'));

        const airstrikeSlotX = firstSlotX;
        const airstrikeSlotY = shieldSlotY + outerCircleSize + slotSpacing;
        if (this.airstrikeSlotBackground) this.airstrikeSlotBackground.destroy();
        this.airstrikeSlotBackground = this.add.graphics();
        this.airstrikeSlotBackground.fillStyle(0x2c3e50, 0.3);
        this.airstrikeSlotBackground.fillCircle(airstrikeSlotX + outerCircleSize/2, airstrikeSlotY + outerCircleSize/2, outerCircleSize/2);
        this.airstrikeSlotBackground.lineStyle(2, 0xbdc3c7, 1);
        this.airstrikeSlotBackground.strokeCircle(airstrikeSlotX + outerCircleSize/2, airstrikeSlotY + outerCircleSize/2, outerCircleSize/2);
        this.airstrikeSlotBackground.fillStyle(0x2c3e50, 1);
        this.airstrikeSlotBackground.fillCircle(airstrikeSlotX + outerCircleSize/2, airstrikeSlotY + outerCircleSize/2, slotSize/2);
        this.airstrikeSlotBackground.lineStyle(2, 0xbdc3c7, 1);
        this.airstrikeSlotBackground.strokeCircle(airstrikeSlotX + outerCircleSize/2, airstrikeSlotY + outerCircleSize/2, slotSize/2);
        this.airstrikeSlotBackground.setScrollFactor(0).setDepth(10);
        this.airstrikeIcon = this.add.image(airstrikeSlotX + outerCircleSize/2, airstrikeSlotY + outerCircleSize/2, 'powerup_airstrike')
            .setScale(0.18)
            .setScrollFactor(0).setDepth(11);
        this.airstrikeIcon.setInteractive({ useHandCursor: true });
        this.airstrikeIcon.on('pointerdown', () => this.activatePowerup('airstrike'));

        const textOffsetX = outerCircleSize + 2;
        const textOffsetY = 0;

        if (this.healthInventoryText) this.healthInventoryText.destroy();
        if (this.missileInventoryText) this.missileInventoryText.destroy();
        if (this.shieldInventoryText) this.shieldInventoryText.destroy();
        if (this.airstrikeInventoryText) this.airstrikeInventoryText.destroy();

        this.healthInventoryText = this.add.bitmapText(healthSlotX + textOffsetX, healthSlotY + outerCircleSize/2 + textOffsetY, 'pixelfont', '0', 24)
            .setOrigin(0, 0.5)
            .setScrollFactor(0).setDepth(12).setTint(0xffff00);
        this.missileInventoryText = this.add.bitmapText(missileSlotX + textOffsetX, missileSlotY + outerCircleSize/2 + textOffsetY, 'pixelfont', '0', 24)
            .setOrigin(0, 0.5)
            .setScrollFactor(0).setDepth(12).setTint(0xffff00);
        this.shieldInventoryText = this.add.bitmapText(shieldSlotX + textOffsetX, shieldSlotY + outerCircleSize/2 + textOffsetY, 'pixelfont', '0', 24)
            .setOrigin(0, 0.5)
            .setScrollFactor(0).setDepth(12).setTint(0xffff00);
        this.airstrikeInventoryText = this.add.bitmapText(airstrikeSlotX + textOffsetX, airstrikeSlotY + outerCircleSize/2 + textOffsetY, 'pixelfont', '0', 24)
            .setOrigin(0, 0.5)
            .setScrollFactor(0).setDepth(12).setTint(0xffff00);

        this.hidePowerupTimers();
        this.updateInventoryDisplay();

        this.shieldTimerCenterX = shieldSlotX + outerCircleSize + 70;
        this.shieldTimerCenterY = shieldSlotY + outerCircleSize / 2;
        this.missileTimerCenterX = missileSlotX + outerCircleSize + 70;
        this.missileTimerCenterY = missileSlotY + outerCircleSize / 2;

        this.shieldTimerCircle = this.add.graphics();
        this.shieldTimerCircle.setDepth(11);
        this.shieldTimerText = this.add.bitmapText(this.shieldTimerCenterX, this.shieldTimerCenterY, 'pixelfont', '', this.timerTextSize)
            .setDepth(12)
            .setTint(0x00ffff)
            .setOrigin(0.5);

        this.missileTimerCircle = this.add.graphics();
        this.missileTimerCircle.setDepth(11);
        this.missileTimerText = this.add.bitmapText(this.missileTimerCenterX, this.missileTimerCenterY, 'pixelfont', '', this.timerTextSize)
            .setDepth(12)
            .setTint(0xff0000)
            .setOrigin(0.5);
    }

    hidePowerupTimers() {
        this.shieldTimerCircle.clear();
        this.missileTimerCircle.clear();
        this.shieldTimerText.setText('');
        this.missileTimerText.setText('');
        this.shieldTimerCircle.setVisible(false);
        this.missileTimerCircle.setVisible(false);
        this.shieldTimerText.setVisible(false);
        this.missileTimerText.setVisible(false);
    }

    updatePowerupTimer(timer, circle, text, color, x, y, duration, remaining) {
        const progress = remaining / duration;
        const angle = progress * Math.PI * 2;

        circle.clear();

        circle.fillStyle(0x000000, 0.3);
        circle.fillCircle(x, y, 40);

        circle.fillStyle(color, 0.5);
        circle.beginPath();
        circle.moveTo(x, y);
        circle.arc(x, y, 40, -Math.PI / 2, -Math.PI / 2 + angle, false);
        circle.closePath();
        circle.fillPath();

        const seconds = Math.ceil(remaining / 1000);
        text.setText(seconds.toString());
        text.setPosition(x, y);
        text.setFontSize(24);
    }

    updateHealthBar() {
        if (!this.player || !this.player.active) {
            this.healthBar.clear();
            return;
        }

        const barWidth = 100;
        const barHeight = 10;
        const barX = this.player.x - barWidth / 2;
        const barY = this.player.y - this.player.displayHeight / 2 - barHeight - 5;

        this.healthBar.clear();
        this.healthBar.fillStyle(0x000000, 0.5);
        this.healthBar.fillRect(barX, barY, barWidth, barHeight);

        const healthFillWidth = barWidth * (this.health / 100);
        this.healthBar.fillStyle(0x00ff00, 1);
        this.healthBar.fillRect(barX, barY, healthFillWidth, barHeight);
    }

    update() {
        if (this.isGameOver) {
            if (this.player.smokeEmitter) {
                this.player.smokeEmitter.stop();
                this.player.smokeEmitter.destroy();
            }
            this.enemies.getChildren().forEach(enemy => {
                if (enemy.smokeEmitter) {
                    enemy.smokeEmitter.stop();
                    enemy.smokeEmitter.destroy();
                }
            });
            return;
        }

        this.background.tilePositionX += 8;

        this.distance += 8;
        
        this.distanceText.setText(Math.floor(this.distance) + 'm');
            
        this.tweens.add({
            targets: this.distanceText,
            scale: 1.2,
            duration: 100,
            yoyo: true,
            ease: 'Power1'
        });

        if (this.player) {
            const pointer = this.input.activePointer;
            const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.x, pointer.y);

            if (!this.isShooting || this.time.now > this.lastShotTime + 100) {
                 if (this.player.active) {
                    this.shoot(angle);
                    this.lastShotTime = this.time.now;
                    this.isShooting = true;
                }
            }
        }

        if (this.killStreak > 0) {
            this.scoreMultiplier = 1 + (this.killStreak * 0.1);
        } else {
            this.scoreMultiplier = 1;
        }

        this.enemies.getChildren().forEach(enemy => {
             if (enemy.active && enemy.body) {

                if (!enemy.lastShotTime || this.time.now > enemy.lastShotTime + 800) {
                     if (enemy.body.position) {
                        this.enemyShoot(enemy);
                        enemy.lastShotTime = this.time.now;
                    }
                }
            }
        });

        this.projectiles.getChildren().forEach(projectile => {
             if (projectile.active && projectile.body && projectile.body.position) {
                if (projectile.x > this.width + 50 || projectile.x < -50 || projectile.y > this.height + 50 || projectile.y < -50) {
                    projectile.destroy();
                }
            }
        });

        this.projectile_1.getChildren().forEach(projectile1 => {
             if (projectile1.active && projectile1.body && projectile1.body.position) {
                if (projectile1.x > this.width + 50 || projectile1.x < -50 || projectile1.y > this.height + 50 || projectile1.y < -50) {
                    projectile1.destroy();
                }
            }
        });

        this.enemyBullets.getChildren().forEach(bullet => {
             if (bullet.active && bullet.body && bullet.body.position) {
                if (bullet.x > this.width + 50 || bullet.x < -50 || bullet.y > this.height + 50 || bullet.y < -50) {
                    bullet.destroy();
                }
            }
        });

        if (this.crosshair) {
            const pointer = this.input.activePointer;
            this.crosshair.setPosition(pointer.x, pointer.y);
        }

        if (this.player && this.player.active) {
            if (!this.player.smokeEmitter || !this.player.smokeEmitter.active) {
                this.setupPlayerSmoke();
            } else {
                const x = this.player.x - this.player.displayWidth * 0.4;
                const y = this.player.y;
                this.player.smokeEmitter.setPosition(x, y);
                
                if (!this.player.smokeEmitter.emitting) {
                    this.player.smokeEmitter.start();
                }
            }
        }

        this.enemies.getChildren().forEach(enemy => {
            if (enemy.active && enemy.smokeEmitter) {
                const x = enemy.x - enemy.displayWidth * 0.4;
                const y = enemy.y + enemy.displayHeight * 0.3;
                enemy.smokeEmitter.setPosition(x, y);
                
                if (!enemy.smokeEmitter.emitting) {
                    enemy.smokeEmitter.start();
                }
            }
        });

        if (this.shieldBubble && this.shieldActive) {
            this.shieldBubble.setPosition(this.player.x, this.player.y);
        }

        this.children.list.forEach(obj => {
            if (obj.texture && obj.texture.key === 'missile' && typeof obj.update === 'function') {
                obj.update();
            }
        });
    }

    shoot(angle) {
        if (!this.player || !this.player.active) return;

        if (this.missileActive) {
            this.shootProjectile1(angle);
        } else {
            this.shootProjectile(angle);
        }
    }

    shootProjectile(angle) {
         if (!this.projectiles) return;

        const projectile = this.projectiles.get(this.player.x + 50, this.player.y);
        if (projectile) {
            projectile.setActive(true);
            projectile.setVisible(true);
            projectile.setScale(0.1);
            this.physics.velocityFromRotation(angle, 1000, projectile.body.velocity);
            projectile.body.setAllowGravity(false);
            projectile.setDepth(5);
            projectile.setRotation(angle);
        }
    }

    shootProjectile1(angle) {
         if (!this.projectile_1) return;

        const projectile1 = this.projectile_1.get(this.player.x + 50, this.player.y);
        if (projectile1) {
            projectile1.setActive(true);
            projectile1.setVisible(true);
            projectile1.setScale(0.2);
            projectile1.hitCount = 0;
            this.physics.velocityFromRotation(angle, 1000, projectile1.body.velocity);
            projectile1.body.setAllowGravity(false);
            projectile1.setDepth(5);
            projectile1.setRotation(angle);
         }
         this.sound.play('shoot');
    }

    enemyShoot(enemy) {
         if (!this.enemyBullets) return;

        const bullet = this.enemyBullets.get(enemy.x - 30, enemy.y);
        if (bullet) {
            bullet.setActive(true);
            bullet.setVisible(true);
            bullet.setScale(0.1);
            const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
            this.physics.velocityFromRotation(angle, 400, bullet.body.velocity);
            bullet.body.setAllowGravity(false);
            bullet.setDepth(6);
            bullet.setRotation(angle);
        }
    }

    spawnEnemy() {
        const enemyTypes = ['enemy_bike', 'enemy_truck', 'enemy_drone'];
        const type = enemyTypes[Phaser.Math.Between(0, enemyTypes.length - 1)];
        
        let enemy;
        let startY;

        if (type === 'enemy_truck') {
            const truckLaneOffset = 26;
            startY = this.player.y - truckLaneOffset;
            enemy = this.enemies.create(this.width + 100, startY, type);
            enemy.body.setImmovable(true);
            enemy.setVelocityX(-120);
            enemy.health = 6;
            enemy.points = 30;
            enemy.setScale(0.23);

            this.setupEnemySmoke(enemy, -25, 10);

        } else if (type === 'enemy_bike') {
            const bikeLaneOffset = 18;
            startY = this.player.y + bikeLaneOffset;
            enemy = this.enemies.create(this.width + 100, startY, type);
            enemy.body.setImmovable(true);
            enemy.setVelocityX(-120);
            enemy.health = 3;
            enemy.points = 10;
            enemy.setScale(0.1);

            this.setupEnemySmoke(enemy, -15, 5);

        } else {
            startY = Phaser.Math.Between(50, 150);
            enemy = this.enemies.create(this.width + 100, startY, type);
            enemy.body.setImmovable(true);
            enemy.setVelocityX(-120);
            enemy.health = 2;
            enemy.points = 20;
            enemy.setScale(0.4);

            this.tweens.add({
                targets: enemy,
                y: { start: 50, to: this.height/2 },
                duration: 2000,
                ease: 'SineInOut',
                yoyo: true,
                repeat: -1,
            });
        }
        
        enemy.setDepth(5);
        enemy.lastShotTime = 0;
        enemy.checkWorldBounds = true;
        enemy.outOfBoundsKill = true;
        enemy.type = type;

        enemy.on('destroy', () => {
            if (enemy.smokeEmitter) {
                enemy.smokeEmitter.stop();
                enemy.smokeEmitter.destroy();
            }
        });
    }

    setupEnemySmoke(enemy, offsetX, offsetY) {
        if (enemy.smokeEmitter) {
            enemy.smokeEmitter.stop();
            enemy.smokeEmitter.destroy();
        }

        const x = enemy.x - enemy.displayWidth * 0.4;
        const y = enemy.y + enemy.displayHeight * 0.3;

        const emitter = this.vfx.createEmitter('smoke', x, y, 0.3, 0, 1200, {
            angle: { min: 180, max: 180 },
            speed: { min: 40, max: 60 },
            scale: { start: 1.2, end: 0.6 },
            scaleY: { start: 0.4, end: 0.2 },
            alpha: { start: 0.3, end: 0 },
            rotate: { min: 0, max: 0 },
            frequency: 25,
            quantity: 4,
            gravityY: 0,
            gravityX: 0
        });
        
        emitter.start();
        enemy.smokeEmitter = emitter;

        enemy.on('destroy', () => {
            if (enemy.smokeEmitter) {
                enemy.smokeEmitter.stop();
                enemy.smokeEmitter.destroy();
            }
        });
    }

    spawnPowerup() {
        const powerupTypes = ['powerup_health', 'powerup_missile', 'powerup_shield', 'powerup_airstrike'];
        const weights = [50, 10, 20, 8];
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let rand = Phaser.Math.Between(1, totalWeight);
        let type;
        for (let i = 0; i < powerupTypes.length; i++) {
            if (rand <= weights[i]) {
                type = powerupTypes[i];
                break;
            }
            rand -= weights[i];
        }
        switch (type) {
            case 'powerup_health':
                if (this.healthCount < 5) this.healthCount++;
                break;
            case 'powerup_missile':
                if (this.missileCount < 5) this.missileCount++;
                break;
            case 'powerup_shield':
                if (this.shieldCount < 5) this.shieldCount++;
                break;
            case 'powerup_airstrike':
                if (this.airstrikeCount < 5) this.airstrikeCount++;
                break;
        }
        this.updateInventoryDisplay();
    }

    handlePlayerEnemyCollision(player, enemy) {
         if (!player.active || !enemy.active) return;

        if (this.shieldActive) {
            enemy.destroy();
            this.createExplosion(enemy.x, enemy.y, enemy.type);
            this.updateScore(enemy.points);
        } else {
            this.takeDamage(20);
            enemy.destroy();
            this.createExplosion(enemy.x, enemy.y, enemy.type);
        }
    }

    handleBulletEnemyCollision(projectile, enemy) {
         if (!projectile.active || !enemy.active) return;

        projectile.destroy();
        
        if (enemy.type === 'enemy_truck') {
             if (projectile.texture.key === 'projectile_1') {
                 enemy.health -= 3;
             } else {
                 enemy.health -= 1;
             }
        } else {
             enemy.health -= 1; 
        }

        if (enemy.health <= 0) {
            if (enemy.tween) {
                enemy.tween.stop();
            } else {
                 const activeTweens = this.tweens.getTweensOf(enemy);
                 activeTweens.forEach(tween => tween.stop());
            }

            enemy.destroy();
            this.createExplosion(enemy.x, enemy.y, enemy.type);
            this.updateScore(enemy.points);
            this.killStreak++;

            const dropChance = Phaser.Math.Between(1, 100);
            if (dropChance <= 30) {
                const powerupTypes = ['health', 'missile', 'shield'];
                const type = powerupTypes[Phaser.Math.Between(0, powerupTypes.length - 1)];
                switch(type) {
                    case 'health':
                        if (this.healthCount < 5) this.healthCount++;
                        break;
                    case 'missile':
                        if (this.missileCount < 5) this.missileCount++;
                        break;
                    case 'shield':
                        if (this.shieldCount < 5) this.shieldCount++;
                        break;
                }
                this.updateInventoryDisplay();
            }
        }
    }

    handlePlayerBulletCollision(player, bullet) {
        if (!player.active || !bullet.active) return;

        bullet.destroy();
        if (!this.shieldActive) {
            this.takeDamage(10);
        }
    }

    handleBulletBulletCollision(playerProjectile, enemyBullet) {
        if (!playerProjectile.active || !enemyBullet.active) return;

        if (playerProjectile.texture.key === 'projectile_1') {
            enemyBullet.destroy();
            playerProjectile.hitCount++;

            if (playerProjectile.hitCount >= 2) {
                playerProjectile.destroy();
            }
        } else {
            playerProjectile.destroy();
            enemyBullet.destroy();
        }
    }

    collectPowerup(player, powerup) {
         if (!player.active || !powerup.active) return;

        powerup.destroy();

        this.sound.play('collect');

        switch (powerup.type) {
            case 'powerup_health':
                if (this.healthCount < 5) this.healthCount++;
                break;
            case 'powerup_missile':
                if (this.missileCount < 5) this.missileCount++;
                break;
            case 'powerup_shield':
                if (this.shieldCount < 5) this.shieldCount++;
                break;
            case 'powerup_airstrike':
                if (this.airstrikeCount < 5) this.airstrikeCount++;
                break;
        }

        this.updateInventoryDisplay();
    }

    updateInventoryDisplay() {
        if (this.healthInventoryText) {
            this.healthInventoryText.setText(`${this.healthCount}`);
            if (this.healthIcon) this.healthIcon.setAlpha(this.healthCount > 0 ? 1 : 0.3);
        }
        if (this.missileInventoryText) {
            this.missileInventoryText.setText(`${this.missileCount}`);
            if (this.missileIcon) this.missileIcon.setAlpha(this.missileCount > 0 ? 1 : 0.3);
        }
        if (this.shieldInventoryText) {
            this.shieldInventoryText.setText(`${this.shieldCount}`);
            if (this.shieldIcon) this.shieldIcon.setAlpha(this.shieldCount > 0 ? 1 : 0.3);
        }
        if (this.airstrikeInventoryText) {
            this.airstrikeInventoryText.setText(`${this.airstrikeCount}`);
            if (this.airstrikeIcon) this.airstrikeIcon.setAlpha(this.airstrikeCount > 0 ? 1 : 0.3);
        }
    }

    activatePowerup(type) {
        let activated = false;

        switch (type) {
            case 'health':
                if (this.healthCount > 0) {
                    this.healthCount--;
                    this.updateInventoryDisplay();
                    this.health = Math.min(100, this.health + 25);
                    this.updateHealthBar();
                    this.vfx.shakeCamera(300, 0.005);
                    this.vfx.addCircleTexture('healingCircle', 0x00ff00, 1.0, 30);
                    const healingEmitter = this.vfx.createEmitter('healingCircle', this.player.x, this.player.y, 1.0, 0, 500);
                    healingEmitter.explode(20);
                    this.vfx.addGlow(this.player, 1.0, 0x00ff00);
                    this.player.setAlpha(1);
                    this.time.delayedCall(1000, () => {
                        this.checkAndResetPlayerAppearance();
                    });
                    activated = true;
                }
                break;
            case 'missile':
                if (this.missileCount > 0 && !this.missileActive) {
                    this.missileCount--;
                    this.updateInventoryDisplay();
                    this.activateMissilePowerup();
                    this.vfx.shakeCamera(200, 0.008);
                    this.vfx.addGlow(this.player, 1.0, 0xff0000);
                    this.vfx.addCircleTexture('missileCircle', 0xff0000, 1.0, 25);
                    const missileEmitter = this.vfx.createEmitter('missileCircle', this.player.x, this.player.y, 1.0, 0, 400);
                    missileEmitter.explode(15);
                    this.player.setAlpha(1);
                    activated = true;
                }
                break;
            case 'shield':
                if (this.shieldCount > 0 && !this.shieldActive) {
                    this.shieldCount--;
                    this.updateInventoryDisplay();
                    this.activateShieldPowerup();
                    
                    const shieldBubble = this.add.graphics();
                    shieldBubble.lineStyle(8, 0x00ffff, 0.8);
                    shieldBubble.strokeCircle(0, 0, 80);
                    shieldBubble.setPosition(this.player.x, this.player.y);
                    shieldBubble.setDepth(9);
                    
                    shieldBubble.setScale(1.5);
                    shieldBubble.setAlpha(0);
                    this.tweens.add({
                        targets: shieldBubble,
                        alpha: 0.8,
                        duration: 300,
                        ease: 'Power2'
                    });

                    this.shieldBubble = shieldBubble;

                    this.vfx.shakeCamera(400, 0.003);
                    this.vfx.addGlow(this.player, 1.0, 0x00ffff);
                    this.vfx.addCircleTexture('shieldCircle', 0x00ffff, 1.0, 35);
                    const shieldEmitter = this.vfx.createEmitter('shieldCircle', this.player.x, this.player.y, 1.0, 0, 600);
                    shieldEmitter.explode(25);
                    this.player.setAlpha(1);
                    activated = true;
                }
                break;
            case 'airstrike':
                if (this.airstrikeCount > 0) {
                    this.airstrikeCount--;
                    this.updateInventoryDisplay();
                    this.triggerAirStrike();
                    activated = true;
                }
                break;
        }

        if (activated) {
            this.sound.play('collect');
        }
    }

    activateMissilePowerup() {
        this.missileActive = true;

        if (this.missileTimer) {
            this.missileTimer.remove();
        }

        const duration = 10000;
        const startTime = this.time.now;

        this.missileTimerCircle.setVisible(true);
        this.missileTimerText.setVisible(true);

        this.missileTimer = this.time.addEvent({
            delay: 100,
            callback: () => {
                const remaining = duration - (this.time.now - startTime);
                if (remaining <= 0) {
                    this.missileActive = false;
                    this.missileTimerCircle.clear();
                    this.missileTimerText.setText('');
                    this.missileTimer.remove();
                    this.missileTimerCircle.setVisible(false);
                    this.missileTimerText.setVisible(false);
                    this.checkAndResetPlayerAppearance();
                } else {
                    const x = this.missileIcon.x;
                    const y = this.missileIcon.y;
                    this.updatePowerupTimer(
                        this.missileTimer,
                        this.missileTimerCircle,
                        this.missileTimerText,
                        0xff0000,
                        x,
                        y,
                        duration,
                        remaining
                    );
                }
            },
            callbackScope: this,
            loop: true
        });
    }

    activateShieldPowerup() {
        this.shieldActive = true;

        if (this.shieldTimer) {
            this.shieldTimer.remove();
        }

        const duration = 5000;
        const startTime = this.time.now;

        this.shieldTimerCircle.setVisible(true);
        this.shieldTimerText.setVisible(true);

        this.shieldTimer = this.time.addEvent({
            delay: 100,
            callback: () => {
                const remaining = duration - (this.time.now - startTime);
                if (remaining <= 0) {
                    this.shieldActive = false;
                    this.shieldTimerCircle.clear();
                    this.shieldTimerText.setText('');
                    this.shieldTimer.remove();
                    this.shieldTimerCircle.setVisible(false);
                    this.shieldTimerText.setVisible(false);
                    this.checkAndResetPlayerAppearance();
                } else {
                    const x = this.shieldIcon.x;
                    const y = this.shieldIcon.y;
                    this.updatePowerupTimer(
                        this.shieldTimer,
                        this.shieldTimerCircle,
                        this.shieldTimerText,
                        0x00ffff,
                        x,
                        y,
                        duration,
                        remaining
                    );
                }
            },
            callbackScope: this,
            loop: true
        });
    }

    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        this.updateHealthBar();
        this.killStreak = 0;

        if (this.health <= 0) {
            this.gameOver();
        }
    }

    createExplosion(x, y, enemyType) {
        this.vfx.shakeCamera(200, 0.005);
        
        let particleQuantity = 80;
        let emitterScale = 1.0;
        let lifespan = { start: 600, end: 1200 };
        let speed = { min: 150, max: 450 };
        let glowRadius = 150;
        let glowDuration = 500;

        if (enemyType === 'enemy_bike' || enemyType === 'enemy_drone') {
            particleQuantity = 40;
            emitterScale = 0.5;
            lifespan = { start: 400, end: 800 };
            speed = { min: 100, max: 300 };
            glowRadius = 80;
            glowDuration = 300;
        } else if (enemyType === 'enemy_truck') {
            // Keep current larger explosion size for trucks
        }

        this.vfx.addCircleTexture('explosionCore', 0xffffff, 1.0, 50);
        
        const explosionEmitter = this.add.particles(x, y, 'explosionCore', {
            frame: 0,
            lifespan: lifespan,
            speed: speed,
            scale: { start: emitterScale, end: 0.1 },
            alpha: { start: 1, end: 0 },
            rotate: { start: 0, end: 360 },
            angle: { min: 0, max: 360 },
            quantity: particleQuantity,
            blendMode: 'ADD',
            tint: { start: 0xffffcc, end: 0xff4500 },
            emitting: false
        });

        explosionEmitter.explode(particleQuantity);
        
        const explosionFlash = this.add.graphics();
        explosionFlash.fillStyle(0xffff00, 1.0);
        explosionFlash.fillCircle(x, y, glowRadius);
        
        this.tweens.add({
            targets: explosionFlash,
            alpha: 0,
            scale: { start: 1, end: 1.6 },
            ease: 'Quad.easeOut',
            duration: glowDuration,
            onComplete: () => {
                explosionFlash.destroy();
            }
        });
    }

    updateScore(points) {
        this.score += Math.floor(points * this.scoreMultiplier);
        this.scoreText.setText(`$${this.score}`);
    }

    maybeDropItem(x, y) {
        /*
        const dropChance = Phaser.Math.Between(1, 100);
        if (dropChance <= 20) {
            this.spawnPowerupAt(x, y);
        }
        */
    }

    spawnPowerupAt(x, y) {
        // This function is intentionally left blank.
    }

    gameOver() {
        this.isGameOver = true;
        
        this.sound.play('lose');

        const gameOverText = this.add.text(this.width / 2, this.height / 2, 'GAME OVER', {
            fontSize: '64px',
            fill: '#ff0000',
            stroke: '#000',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(20);

        const finalScoreText = this.add.text(this.width / 2, this.height / 2 + 80, 
            `Final Score: ${this.score}\nDistance: ${(this.distance / 1000).toFixed(1)}km`, {
            fontSize: '32px',
            fill: '#fff',
            stroke: '#000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setDepth(20);

        const restartButton = this.add.text(this.width / 2, this.height / 2 + 160, 'RESTART', {
            fontSize: '32px',
            fill: '#fff',
            backgroundColor: '#00000080',
            padding: { x: 20, y: 10 }
        })
        .setOrigin(0.5)
        .setInteractive()
        .setDepth(20)
        .on('pointerdown', () => {
            this.scene.restart();
        });

        this.input.keyboard.once('keydown-R', () => {
            this.scene.restart();
        });

        initiateGameOver.bind(this)({
            "score": this.score
        });

       
    }

    pauseGame() {
         if (this.isGameOver) return;
        handlePauseGame.bind(this)();
    }

    createAnimations() {
        const explosionFrames = [];
        for (let i = 0; i < 6; i++) {
            explosionFrames.push({ key: 'explosion', frame: i });
        }
        
        this.anims.create({
            key: 'explosion',
            frames: explosionFrames,
            frameRate: 15,
            repeat: 0
        });
    }

    checkAndResetPlayerAppearance() {
        if (!this.shieldActive && !this.missileActive) {
            this.player.clearTint();
            this.player.setAlpha(1);
            this.player.setScale(0.3);
            this.player.setAngle(0);
            
            if (this.shieldBubble) {
                this.shieldBubble.destroy();
                this.shieldBubble = null;
            }
        }
    }

    setupPlayerSmoke() {
        if (this.player.smokeEmitter) {
            this.player.smokeEmitter.stop();
            this.player.smokeEmitter.destroy();
        }

        const x = this.player.x - this.player.displayWidth * 0.5;
        const y = this.player.y - this.player.displayHeight / 2;

        const emitter = this.vfx.createEmitter('smoke', x, y, 0.3, 0, 1200, {
            angle: { min: 180, max: 180 },
            speed: { min: 40, max: 60 },
            scale: { start: 1.2, end: 0.6 },
            scaleY: { start: 0.4, end: 0.2 },
            alpha: { start: 0.3, end: 0 },
            rotate: { min: 0, max: 0 },
            frequency: 25,
            quantity: 4,
            gravityY: 0,
            gravityX: 0
        });
        
        emitter.start();
        this.player.smokeEmitter = emitter;

        this.player.on('destroy', () => {
            if (this.player.smokeEmitter) {
                this.player.smokeEmitter.stop();
                this.player.smokeEmitter.destroy();
            }
        });
    }

    createSmokeTexture() {
        if (this.textures.exists('smoke')) {
            return;
        }

        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0x888888, 0.6);
        graphics.fillEllipse(16, 8, 32, 12);
        graphics.generateTexture('smoke', 32, 16);
        graphics.destroy();
    }

    triggerAirStrike() {
        const missileCount = Phaser.Math.Between(8, 10);
        for (let i = 0; i < missileCount; i++) {
            const x = Phaser.Math.Between(80, this.width - 80);
            const projectile1 = this.physics.add.sprite(x, -50, 'projectile_1');
            projectile1.setScale(0.18);
            projectile1.setDepth(20);
            projectile1.body.setVelocityY(600);
            projectile1.setAngle(90);
            this.physics.add.overlap(projectile1, this.enemies, (missileObj, enemy) => {
                this.createExplosion(enemy.x, enemy.y, enemy.type);
                enemy.destroy();
                missileObj.destroy();
            });
            projectile1.update = () => {
                if (projectile1.y > this.height - 30) {
                    this.createExplosion(projectile1.x, this.height - 30, 'enemy_truck');
                    projectile1.destroy();
                }
            };
        }
        if (this.sound.get('airstrike')) {
            this.sound.play('airstrike');
        }
    }
}

// Loading screen implementation
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

    this.load.on('complete', function () {
        progressBar.destroy();
        progressBox.destroy();
        loadingText.destroy();
    });
}

// Game configuration
const config = {
    type: Phaser.AUTO,
    width: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width,
    height: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].height,
    scene: [GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
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
        // sounds: _CONFIG.sounds, // Uncomment if you want to enable custom sounds
    },
    orientation: _CONFIG.deviceOrientation === "portrait"
};