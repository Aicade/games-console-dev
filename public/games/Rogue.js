// Touch Screen Controls
const joystickEnabled = true;
var isMobile = false;

// JOYSTICK DOCUMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/virtualjoystick/
const rexJoystickUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js";

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        console.log('GameScene constructor called');
    }

    preload() {
        console.log('Preload started');
        addEventListenersPhaser.bind(this)();

        this.load.image("heart", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/heart.png");
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");

        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }

        this.load.image('plus', this.createPlusTexture());
        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/";
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        if (joystickEnabled) this.load.plugin('rexvirtualjoystickplugin', rexJoystickUrl, true);

        displayProgressLoader.call(this);
    }

    create() {
        console.log('Create method started');
        this.vfx = new VFXLibrary(this);
        this.isMobile = !this.sys.game.device.os.desktop;
        isMobile = !this.sys.game.device.os.desktop;
        this.maxCoverage = 20000;
        this.minCoverage = -this.maxCoverage / 2;

        // Setup sounds
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        this.width = this.game.config.width;
        this.height = this.game.config.height;

        this.bg = this.add.tileSprite(this.minCoverage, this.minCoverage, this.maxCoverage, this.maxCoverage, "background")
            .setOrigin(0, 0)
            .setScrollFactor(1);
        this.cameras.main.setBounds(this.minCoverage, this.minCoverage, this.maxCoverage, this.maxCoverage);

        const joyStickRadius = 50;
        if (joystickEnabled) {
            this.joyStick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
                x: this.width - (joyStickRadius * 2),
                y: this.height - (joyStickRadius * 2),
                radius: 50,
                base: this.add.circle(0, 0, 80, 0x888888, 0.5),
                thumb: this.add.circle(0, 0, 40, 0xcccccc, 0.5),
            });
            this.joystickKeys = this.joyStick.createCursorKeys();
        }

        // Input Listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.input.keyboard.on('keydown-M', () => {
            this.sound.setMute(!this.sound.mute);
        });
        this.pauseButton = this.add.sprite(this.game.config.width - 60, 60, "pauseButton")
            .setOrigin(0.5, 0.5)
            .setInteractive({ cursor: 'pointer' })
            .setScale(3)
            .setScrollFactor(0);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        if (this.sounds.background.isPlaying) {
            this.sounds.background.stop();
        }
        // Adjust background volume as needed
        this.sounds.background.setVolume(0.05).setLoop(true).play();

        // Initialize game state variables
        this.player;
        this.enemies;
        this.bullets;
        this.lastFired = 0;
        this.lastFiredDelay = 800;
        this.score = 0;
        this.scoreText;
        this.playerHealth = 100;
        this.playerSpeed = 100;
        this.healthRegenPoints = 0;
        this.healthRegenPointsRequired = 15;
        this.bulletAddPoints = 0;
        this.bulletAddPointsRequired = 10;
        this.collectibleChance = 0.8;
        this.enemySpeed = 30;
        this.gameOverTrigerred = false;

        // New variables for coin collector powerup and orbiting bullets
        this.coinCount = 0;
        this.coinRequired = 20;
        // Use an array to hold multiple orbiting bullets
        this.orbitingBullets = [];
        this.orbitBaseAngle = 0; // Global rotation base

        // Create player
        this.player = this.physics.add.sprite(this.width / 2, this.height / 2, 'player')
            .setScale(0.2);
        this.player.preFX.addShadow(0, 0, 0.1, 1, 0x000000, 6, 1);
        this.healthBar = this.add.graphics();
        this.updateHealthBar();

        // Create groups
        this.enemies = this.physics.add.group();
        this.bullets = this.physics.add.group();
        this.collectibles = this.physics.add.group();

        // Set up camera
        this.cameras.main.startFollow(this.player, true, 0.03, 0.03);

        // Set up arrow key input
        this.cursors = this.input.keyboard.createCursorKeys();

        // Display score UI
        this.scoreText = this.add.bitmapText(this.width / 2 - 30, 0, 'pixelfont', this.score, 32)
            .setScrollFactor(0)
            .setDepth(100);
        this.enemyIcon = this.add.image(this.width / 2 - 70, 30, "enemy")
            .setScale(0.12)
            .setOrigin(0.5, 0.5)
            .setScrollFactor(0)
            .setDepth(100);
        this.bulletIcon = this.add.image(this.width - 60, 30, "projectile")
            .setScale(0.08)
            .setOrigin(0.5, 0.5)
            .setScrollFactor(0)
            .setDepth(100)
            .setAngle(-50);

        // UI Bars in Top Left Corner
        // 1. Weapon Speed Bar (for bullet upgrade progress)
        this.weaponBar = this.createBar(20, 20, 200, 30, 'WEAPON SPEED', 0x0000ff);
        this.weaponBar.graphics.setScrollFactor(0);
        // 2. Health Bar (for health upgrade progress)
        this.rehealthBar = this.createBar(20, 60, 200, 30, 'HEALTH', 0x00ff00);
        this.rehealthBar.graphics.setScrollFactor(0);
        // 3. Weapon Upgrade Bar (for orbiting bullet powerup)
        this.coinBar = this.createBar(20, 100, 200, 30, 'WEAPON UPGRADE', 0xffd700);
        this.coinBar.graphics.setScrollFactor(0);

        // Create text overlays for each bar (centered on the bar)
        this.weaponBarText = this.add.text(20 + 200 / 2, 20 + 30 / 2, this.bulletAddPoints + "/" + this.bulletAddPointsRequired, { 
            fontSize: '20px', 
            fill: '#ffffff',
            fontStyle: 'bold'
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(101);
        
        this.rehealthBarText = this.add.text(20 + 200 / 2, 60 + 30 / 2, this.healthRegenPoints + "/" + this.healthRegenPointsRequired, { 
            fontSize: '20px', 
            fill: '#ffffff',
            fontStyle: 'bold'
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(101);
        
        this.coinProgressText = this.add.text(20 + 200 / 2, 100 + 30 / 2, this.coinCount + "/" + this.coinRequired, { 
            fontSize: '20px', 
            fill: '#ffffff',
            fontStyle: 'bold'
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(101);

        // Place the icons to the right of each bar (fixed to the UI)
        const margin = 10;
        this.weaponSpeedIcon = this.add.text(20 + 200 + margin, 20 + 15, "🔫", { fontSize: '32px', fill: '#ffffff' })
            .setOrigin(0, 0.5)
            .setScrollFactor(0)
            .setDepth(100);
        this.healthIconUI = this.add.text(20 + 200 + margin, 60 + 15, "❤️", { fontSize: '32px', fill: '#ffffff' })
            .setOrigin(0, 0.5)
            .setScrollFactor(0)
            .setDepth(100);
        this.weaponUpgradeIcon = this.add.text(20 + 200 + margin, 100 + 15, "🔧", { fontSize: '32px', fill: '#ffffff' })
            .setOrigin(0, 0.5)
            .setScrollFactor(0)
            .setDepth(100);

        // Spawn enemies periodically
        this.time.addEvent({
            delay: 600,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });

        this.vfx.addCircleTexture('red', 0xFF0000, 1, 10);
        this.vfx.addCircleTexture('orange', 0xFFA500, 1, 10);
        this.vfx.addCircleTexture('yellow', 0xFFFF00, 1, 10);

        // Set up collisions
        this.physics.add.collider(this.player, this.enemies, this.playerEnemyCollision, null, this);
        this.physics.add.collider(this.bullets, this.enemies, this.bulletEnemyCollision, null, this);
        this.physics.add.collider(this.player, this.collectibles, this.collectCollectible, null, this);
        this.input.keyboard.disableGlobalCapture();
        this.toggleControlsVisibility(isMobile);

        // --- Orientation Enforcement ---
        // Create an overlay text for orientation prompt (fixed to UI)
        this.orientationText = this.add.text(this.width / 2, this.height / 2, "Please rotate your device to landscape", { 
            font: '32px Arial', 
            fill: '#ffffff',
            fontStyle: 'bold'
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(200)
        .setVisible(false);

        // Listen for orientation changes
        this.scale.on('orientationchange', (orientation) => {
            if (orientation === Phaser.Scale.PORTRAIT) {
                this.orientationText.setVisible(true);
                this.scene.pause();
            } else {
                this.orientationText.setVisible(false);
                this.scene.resume();
            }
        });
    }

    createBar(x, y, width, height, label, color) {
        const bar = {};
        bar.value = 0;
        bar.graphics = this.add.graphics();
        bar.graphics.setScrollFactor(0).setDepth(10);
        bar.update = () => {
            bar.graphics.clear();
            const filledWidth = Phaser.Math.Clamp(bar.value / 100 * width, 0, width);
            bar.graphics.fillStyle(0x000000);
            bar.graphics.fillRect(x, y, width, height);
            bar.graphics.fillStyle(color);
            bar.graphics.fillRect(x, y, filledWidth, height);
            bar.graphics.lineStyle(2, 0xffffff);
            bar.graphics.strokeRect(x, y, width, height);
        };
        bar.update();
        return bar;
    }

    increaseBar(bar, value) {
        bar.value = Phaser.Math.Clamp(bar.value + value, 0, 100);
        if (bar.value === 100) {
            bar.value = 0;
        }
        bar.update();
    }

    decreaseBar(bar, value) {
        bar.value = Phaser.Math.Clamp(bar.value - value, 0, 100);
        bar.update();
    }

    toggleControlsVisibility(visibility) {
        this.joyStick.base.visible = visibility;
        this.joyStick.thumb.visible = visibility;
    }

    update() {
        // Player Movement
        if (this.cursors.left.isDown || this.joystickKeys.left.isDown) {
            this.player.setVelocityX(-this.playerSpeed);
            this.player.flipX = true;
        } else if (this.cursors.right.isDown || this.joystickKeys.right.isDown) {
            this.player.setVelocityX(this.playerSpeed);
            this.player.flipX = false;
        } else {
            this.player.setVelocityX(0);
        }
        if (this.cursors.up.isDown || this.joystickKeys.up.isDown) {
            this.player.setVelocityY(-this.playerSpeed);
        } else if (this.cursors.down.isDown || this.joystickKeys.down.isDown) {
            this.player.setVelocityY(this.playerSpeed);
        } else {
            this.player.setVelocityY(0);
        }

        // Enemies move towards the player
        this.enemies.getChildren().forEach(enemy => {
            this.physics.moveToObject(enemy, this.player, this.enemySpeed);
        });

        // Automatic shooting
        if (this.time.now > this.lastFired) {
            this.shootBullet();
            this.lastFired = this.time.now + this.lastFiredDelay;
        }

        // Update health bar position
        this.healthBar.setPosition(this.player.x - 50, this.player.y - 60);
        this.scoreText.setText(': ' + this.score);

        // Update orbiting bullets positions (if any exist)
        if (this.orbitingBullets.length > 0) {
            this.orbitBaseAngle += 0.02; // Adjust rotation speed as needed
            const radius = 50; // Distance from the player
            const total = this.orbitingBullets.length;
            this.orbitingBullets.forEach((bullet, index) => {
                const angle = this.orbitBaseAngle + (2 * Math.PI * index / total);
                bullet.x = this.player.x + radius * Math.cos(angle);
                bullet.y = this.player.y + radius * Math.sin(angle);
            });
        }
    }

    updateHealthMeterBar() {
        this.HealthMeterBar.clear();
        const barX = 100;
        const barY = 40;
        const barWidth = 250;
        const barHeight = 35;
        const filledWidth = Phaser.Math.Clamp(this.HealthMeterBarValue / 100 * barWidth, 0, barWidth);
        console.log(this.meterValue);
        this.HealthMeterBar.fillStyle(0x000000);
        this.HealthMeterBar.fillRect(barX, barY, barWidth, barHeight);
        const fillColor = 0x00ff00;
        this.HealthMeterBar.fillStyle(fillColor);
        this.HealthMeterBar.fillRect(barX, barY, filledWidth, barHeight);
        this.HealthMeterBar.lineStyle(2, 0xffffff);
        this.HealthMeterBar.strokeRect(barX, barY, barWidth, barHeight);
    }

    updateHealthBar() {
        this.healthBar.clear();
        this.healthBar.fillStyle(0x000000, 0.8);
        this.healthBar.fillRect(0, 0, 100, 10);
        this.healthBar.fillStyle(0x00ff00, 1);
        this.healthBar.fillRect(0, 0, this.playerHealth, 10);
    }

    createPlusTexture() {
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0x00ff00);
        graphics.fillRect(10, 20, 30, 10);
        graphics.fillRect(20, 10, 10, 30);
        graphics.generateTexture('plus', 50, 50);
        graphics.destroy();
        return 'plus';
    }

    spawnEnemy() {
        const edge = Phaser.Math.Between(1, 4);
        let x, y;
        switch (edge) {
            case 1:
                x = Phaser.Math.Between(this.player.x - this.width / 2, this.player.x + this.width / 2);
                y = this.player.y - this.height / 2;
                break;
            case 2:
                x = this.player.x + this.width / 2;
                y = Phaser.Math.Between(this.player.y - this.height / 2, this.player.y + this.height / 2);
                break;
            case 3:
                x = Phaser.Math.Between(this.player.x - this.width / 2, this.player.x + this.width / 2);
                y = this.player.y + this.height / 2;
                break;
            case 4:
                x = this.player.x - this.width / 2;
                y = Phaser.Math.Between(this.player.y - this.height / 2, this.player.y + this.height / 2);
                break;
        }
        const numEnemies = Phaser.Math.Between(1, 3);
        const spacing = 100;
        for (let i = 0; i < numEnemies; i++) {
            const enemy = this.enemies.create(((i + 1) * spacing) + x, y, 'enemy');
            enemy.setScale(0.1);
            this.tweens.add({
                targets: enemy,
                scale: '+=0.01',
                duration: 200,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                delay: i * 200
            });
            this.physics.moveToObject(enemy, this.player, this.enemySpeed);
        }
    }

    shootBullet() {
        const closestEnemy = this.findClosestEnemy(this.player.x, this.player.y);
        if (closestEnemy) {
            const bullet = this.bullets.create(this.player.x, this.player.y, 'projectile').setScale(0.05);
            this.physics.moveToObject(bullet, closestEnemy, 500);
            // Reduced shoot sound volume to 0.15
            this.sounds.shoot.setVolume(0.15).setLoop(false).play();
        }
    }

    findClosestEnemy(x, y) {
        let minDistance = 350;
        let closestEnemy = null;
        this.enemies.getChildren().forEach(enemy => {
            const distance = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
            if (distance < minDistance) {
                minDistance = distance;
                closestEnemy = enemy;
            }
        });
        return closestEnemy;
    }

    playerEnemyCollision(player, enemy) {
        this.sounds.damage.setVolume(1).setLoop(false).play();
        this.vfx.shakeCamera(200, 0.015);
        this.vfx.createEmitter('heart', player.x, player.y, 0.025, 0, 1000).explode(10);
        this.playerHealth -= 10;
        this.updateHealthBar();
        enemy.destroy();
        if (this.playerHealth <= 0 && !this.gameOverTrigerred) {
            this.gameOverTrigerred = true;
            this.time.delayedCall(500, () => {
                let gameOverText = this.add.bitmapText(this.cameras.main.centerX, this.cameras.main.centerY - 200, 'pixelfont', 'Game Over', 64)
                    .setOrigin(0.5)
                    .setVisible(false)
                    .setAngle(-15)
                    .setScrollFactor(0)
                    .setDepth(100);
                this.time.delayedCall(500, () => {
                    this.sounds.lose.setVolume(1).setLoop(false).play();
                    gameOverText.setVisible(true);
                    this.tweens.add({
                        targets: gameOverText,
                        y: '+=200',
                        angle: 0,
                        scale: { from: 0.5, to: 2 },
                        alpha: { from: 0, to: 1 },
                        ease: 'Elastic.easeOut',
                        duration: 1500,
                        onComplete: () => {
                            this.time.delayedCall(1000, this.gameOver, [], this);
                        }
                    });
                });
            });
        }
    }

    bulletEnemyCollision(bullet, enemy) {
        bullet.destroy();
        enemy.destroy();
        this.vfx.createEmitter('red', enemy.x, enemy.y, 1, 0, 500).explode(10);
        this.vfx.createEmitter('yellow', enemy.x, enemy.y, 1, 0, 500).explode(10);
        this.vfx.createEmitter('orange', enemy.x, enemy.y, 1, 0, 500).explode(10);
        this.score += 10;
        const chance = Phaser.Math.Between(0, 100);
        if (chance < this.collectibleChance * 100) {
            this.createCollectible(enemy.x, enemy.y);
        }
    }

    createCollectible(x, y) {
        const collectible = this.physics.add.image(x, y, 'collectible').setScale(0.1);
        this.vfx.addShine(collectible, 500);
        this.vfx.scaleGameObject(collectible);
        this.collectibles.add(collectible);
    }

    collectCollectible(player, collectible) {
        // Increase progress on bars
        this.increaseBar(this.weaponBar, 10);
        this.increaseBar(this.rehealthBar, 7);
        collectible.destroy();
        this.sounds.collect.setVolume(1).setLoop(false).play();
        
        // Increase the underlying counters
        this.healthRegenPoints += 1;
        this.bulletAddPoints += 1;
        this.coinCount += 1;
        
        // Update the coin (weapon upgrade) bar percentage and overlay text
        this.coinBar.value = (this.coinCount / this.coinRequired) * 100;
        this.coinBar.update();
        
        // Update the overlay texts for all bars
        this.weaponBarText.setText(this.bulletAddPoints + "/" + this.bulletAddPointsRequired);
        this.rehealthBarText.setText(this.healthRegenPoints + "/" + this.healthRegenPointsRequired);
        this.coinProgressText.setText(this.coinCount + "/" + this.coinRequired);
        
        // Check for health upgrade
        if (this.healthRegenPoints >= this.healthRegenPointsRequired) {
            this.sounds.upgrade.setVolume(1).setLoop(false).play();
            this.vfx.createEmitter('plus', player.x, player.y, 1, 0, 1000).explode(10);
            this.healthRegenPoints = 0;
            this.playerHealth = 100;
            this.updateHealthBar();
            this.centerTextHealth = this.add.bitmapText(this.width / 2, this.height / 2, 'pixelfont', "HEALTH REGENERATED!", 64)
                .setOrigin(0.5, 0.5)
                .setDepth(100)
                .setScrollFactor(0);
            this.time.delayedCall(1000, () => {
                this.centerTextHealth.destroy();
            });
            // Update the health bar text overlay too
            this.rehealthBarText.setText(this.healthRegenPoints + "/" + this.healthRegenPointsRequired);
        }
        
        // Check for weapon speed upgrade
        if (this.bulletAddPoints >= this.bulletAddPointsRequired) {
            this.sounds.upgrade.setVolume(1).setLoop(false).play();
            this.vfx.createEmitter('projectile', player.x, player.y, 0.025, 0, 1000).explode(10);
            this.bulletAddPoints = 0;
            this.lastFiredDelay *= 0.9;
            this.centerTextWeapon = this.add.bitmapText(this.width / 2, this.height / 2 + 100, 'pixelfont', "WEAPON SPEED UPGRADED!", 64)
                .setOrigin(0.5, 0.5)
                .setDepth(100)
                .setScrollFactor(0);
            this.time.delayedCall(1000, () => {
                this.centerTextWeapon.destroy();
            });
            // Update the weapon speed bar text overlay
            this.weaponBarText.setText(this.bulletAddPoints + "/" + this.bulletAddPointsRequired);
        }
        
        // When enough coins are collected, spawn an additional orbiting bullet and reset the coin counter/bar.
        if (this.coinCount >= this.coinRequired) {
            this.spawnOrbitingBullet();
            this.coinCount = 0;
            this.coinBar.value = 0;
            this.coinBar.update();
            this.coinProgressText.setText(this.coinCount + "/" + this.coinRequired);
        }
        
        this.score += 50;
    }
    
    spawnOrbitingBullet() {
        // Create a new orbiting bullet sprite
        const bullet = this.physics.add.sprite(this.player.x, this.player.y, 'projectile').setScale(0.05);
        // Set up collision between this bullet and enemies
        this.physics.add.overlap(bullet, this.enemies, (bullet, enemy) => {
            enemy.destroy();
            this.vfx.createEmitter('red', enemy.x, enemy.y, 1, 0, 500).explode(10);
            this.score += 10;
        }, null, this);
        // Add the new bullet to the orbiting bullets array
        this.orbitingBullets.push(bullet);
        
        // Show upgrade message
        this.centerTextWeapon = this.add.bitmapText(this.width / 2, this.height / 2 + 100, 'pixelfont', "WEAPON UPGRADE!", 64)
            .setOrigin(0.5, 0.5)
            .setDepth(100)
            .setScrollFactor(0);
        this.time.delayedCall(1000, () => {
            this.centerTextWeapon.destroy();
        });
    }

    orbitingBulletCollision(bullet, enemy) {
        enemy.destroy();
        this.vfx.createEmitter('red', enemy.x, enemy.y, 1, 0, 500).explode(10);
        this.score += 10;
    }

    pauseGame() {
        handlePauseGame.bind(this)();
    }

    gameOver() {
        this.sounds.background.stop();
        initiateGameOver.bind(this)({ score: this.score });
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
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions,
    },
    deviceOrientation: _CONFIG.deviceOrientation === "landscape"
};
