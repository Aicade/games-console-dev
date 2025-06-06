// Touch Screen Controls - Simplified for mobile
const joystickEnabled = false;
const buttonEnabled = false;

/*
------------------- GLOBAL CODE STARTS HERE -------------------
*/

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.distance = 0;
        this.coins = 0;
        this.jetpackForce = -400;
        this.gravity = 800;
        this.isFlying = false;
        this.jumpEnergy = 100;
        this.maxJumpEnergy = 100;
        this.energyRechargeRate = 10;
        this.energyDrainRate = 20;
        this.lastBulletTime = 0;
        this.bulletDelay = 300;
        this.missileWarning = null;
        this.invincibleWarning = null;
        this.birdWarning = null;
        this.isMobile = false;
        this.currentOrientation = 'portrait';
        this.scaleFactor = 1;
    }

    getOrientation() {
        return this.game.config.width > this.game.config.height ? 'landscape' : 'portrait';
    }

    getScaleFactor() {
        this.currentOrientation = this.getOrientation();
        const baseSize = this.currentOrientation === 'portrait' ? 800 : 1200;
        return this.game.config.width / baseSize;
    }

    preload() {
        addEventListenersPhaser.bind(this)();

        // Load all configured assets
        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        for (const key in _CONFIG.libLoader) {
            this.load.image(key, _CONFIG.libLoader[key]);
        }

        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/";
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        displayProgressLoader.call(this);
    }

    create() {
        // Device detection and scaling
        this.isMobile = !this.sys.game.device.os.desktop;
        this.currentOrientation = this.getOrientation();
        this.scaleFactor = this.getScaleFactor();
        
        // Adjust game difficulty/speed for mobile
        if (this.isMobile) {
            this.jetpackForce *= 0.9;
            this.gravity *= 0.9;
            this.bgScrollSpeed *= 0.8;
        }

        this.distance = 0;
        this.coins = 0;
        this.sounds = {};
        
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.6 });
        }

        this.width = this.game.config.width;
        this.height = this.game.config.height;

        this.vfx = new VFXLibrary(this);

        this.bgScrollSpeed = 100;
        this.background = this.add.tileSprite(0, 0, this.width, this.height, "background")
            .setOrigin(0, 0)
            .setScrollFactor(5, 1);

        this.sounds.background.setVolume(0.05).setLoop(true).play();

        // Pause button with scaling
        const pauseButtonScale = 3 * this.scaleFactor;
        this.pauseButton = this.add.sprite(
            this.width - 60 * this.scaleFactor, 
            60 * this.scaleFactor, 
            "pauseButton"
        ).setOrigin(0.5, 0.5).setInteractive({ cursor: 'pointer' }).setScale(pauseButtonScale).on('pointerdown', () => this.pauseGame());

        // Touch controls
        this.input.on('pointerdown', (pointer) => {
            if (!this.pauseButton.getBounds().contains(pointer.x, pointer.y)) {
                this.activateJetpack();
            }
        });
        this.input.on('pointerup', () => this.deactivateJetpack());

        // UI Elements with scaling
        const uiTextSize = 48 * this.scaleFactor;
        const uiSmallTextSize = 32 * this.scaleFactor;
        
        this.distanceText = this.add.bitmapText(
            10 * this.scaleFactor, 
            100 * this.scaleFactor, 
            'pixelfont', 
            `Distance: 0m`, 
            uiTextSize
        ).setOrigin(0, 0.5).setDepth(10);
            
        this.coinIcon = this.add.image(
            10 * this.scaleFactor, 
            160 * this.scaleFactor, 
            'collectible'
        )
            .setScale(0.1 * this.scaleFactor)
            .setOrigin(0, 0.5)
            .setDepth(10);
            
        this.coinsText = this.add.bitmapText(
            60 * this.scaleFactor, 
            150 * this.scaleFactor, 
            'pixelfont', 
            `0`, 
            uiTextSize
        ).setOrigin(0, 0.5).setDepth(10);

        // Platform
        this.platform = this.physics.add.image(
            this.width / 2, this.height, 'platform'
        ).setOrigin(0.5, 1).setImmovable(true).setGravity(0, 0).setDisplaySize(this.width, this.height * 0.1).setVisible(true);

        // Player with scaling
        const playerScale = 0.2 * this.scaleFactor;
        const playerY = this.currentOrientation === 'portrait' ? this.height * 0.7 : this.height * 0.65;
            
        this.player = this.physics.add.image(
            this.width / 3, 
            playerY, 
            'player'
        )
            .setScale(playerScale)
            .setCollideWorldBounds(true)
            .setGravityY(this.gravity)
            .setImmovable(false);

        // Game objects groups
        this.bullets = this.physics.add.group({ maxSize: 10 });
        this.enemies = this.physics.add.group({ maxSize: 5 });
        this.invincibleEnemies = this.physics.add.group({ maxSize: 2 });
        this.birds = this.physics.add.group({ maxSize: 3 }); // New bird group
        this.coinGroup = this.physics.add.group({ maxSize: 20 });
        this.obstacles = this.physics.add.group({ maxSize: 3 });

        // Energy bar with scaling
        this.energyBarBg = this.add.rectangle(
            10 * this.scaleFactor, 
            50 * this.scaleFactor, 
            210 * this.scaleFactor, 
            30 * this.scaleFactor, 
            0x333333
        )
            .setOrigin(0, 0.5)
            .setScrollFactor(0);
            
        this.energyBar = this.add.rectangle(
            10 * this.scaleFactor, 
            50 * this.scaleFactor, 
            200 * this.scaleFactor, 
            20 * this.scaleFactor, 
            0x00ff00
        )
            .setOrigin(-0.02, 0.5)
            .setScrollFactor(0);
            
        this.energyText = this.add.bitmapText(
            220 * this.scaleFactor, 
            50 * this.scaleFactor, 
            'pixelfont', 
            '100%', 
            uiSmallTextSize
        )
            .setOrigin(0, 0.5)
            .setScrollFactor(0);

        // Colliders
        this.setupColliders();
        
        // Distance timer
        this.distanceTimer = this.time.addEvent({
            delay: 100,
            callback: () => {
                this.distance += 0.1;
                this.updateDistanceText();
                this.background.tilePositionX += 20;
            },
            loop: true
        });

        // Enhanced Warning System with scaling
        const warningScale = 0.2 * this.scaleFactor;
        this.missileWarning = this.add.sprite(
            this.width - 40 * this.scaleFactor, 
            this.height / 2, 
            'enemy'
        )
            .setOrigin(0.5)
            .setDepth(20)
            .setVisible(false)
            .setScale(warningScale)
            .setTint(0xff0000);
            
        this.invincibleWarning = this.add.sprite(
            this.width - 40 * this.scaleFactor, 
            this.height / 2, 
            'avoidable'
        )
            .setOrigin(0.5)
            .setDepth(20)
            .setVisible(false)
            .setScale(warningScale)
            .setTint(0x9900ff);
            
        this.birdWarning = this.add.sprite(
            this.width - 40 * this.scaleFactor, 
            this.height / 2, 
            'enemy_1'
        )
            .setOrigin(0.5)
            .setDepth(20)
            .setVisible(false)
            .setScale(warningScale)
            .setTint(0xff6600);

        // Spawn timers
        this.setupSpawnTimers();
        
        // Keyboard controls (for desktop)
        this.input.keyboard.on('keydown-SPACE', () => this.activateJetpack());
        this.input.keyboard.on('keyup-SPACE', () => this.deactivateJetpack());
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
    }

    setupColliders() {
        this.physics.add.collider(this.player, this.platform, (player, platform) => {
            if (player.body.velocity.y >= 0) {
                player.y = platform.y - platform.displayHeight/2 - player.displayHeight/2;
                player.setVelocityY(0);
                this.isOnPlatform = true;
            }
        });

        this.physics.add.collider(this.player, this.invincibleEnemies, () => {
            this.gameOver();
            this.sounds?.lose?.play();
        });

        this.physics.add.collider(this.player, this.enemies, () => {
            this.gameOver();
            this.sounds?.lose?.setVolume(0.5).play();
        });
        
        this.physics.add.collider(this.player, this.birds, () => { // Bird collision
            this.gameOver();
            this.sounds?.lose?.setVolume(0.5).play();
        });
        
        this.physics.add.collider(this.player, this.obstacles, () => {
            this.gameOver();
            this.sounds?.lose?.setVolume(0.5).play();
        });
        
        this.physics.add.overlap(this.player, this.coinGroup, (player, coin) => {
            this.sounds.collect.setVolume(0.001).play();
            this.vfx.createEmitter('star', coin.x, coin.y, 0, 0.3, 100).explode(3);
            coin.destroy();
            this.coins += 1;
            this.updateCoinsText();
            this.sounds?.coin?.play();
        });
        
        this.physics.add.collider(this.bullets, this.enemies, (bullet, enemy) => {
            this.sounds.blast.setVolume(0.01).play();
            this.vfx.createEmitter('Explosion', enemy.x, enemy.y, 0, 0.3, 400).explode(10);
            bullet.destroy();
            enemy.destroy();
            this.addCoins(5);
        });
    }

    setupSpawnTimers() {
        this.missileSpawnTimer = this.time.addEvent({
            delay: 30000, ///15000 to increase frequency
            callback: () => {
                if (this.enemies.countActive() < this.enemies.maxSize) {
                    const spawnY = Phaser.Math.Between(100, this.height - 100);
                    this.showWarning(this.missileWarning, 1000, spawnY, () => this.spawnMissile(spawnY));
                }
            },
            loop: true
        });

        this.invincibleSpawnTimer = this.time.addEvent({
            delay: 70000, ///20000 to increase frequency
            callback: () => {
                if (this.invincibleEnemies.countActive() < this.invincibleEnemies.maxSize) {
                    const spawnY = Phaser.Math.Between(100, this.height - 100);
                    this.showWarning(this.invincibleWarning, 1000, spawnY, () => this.spawnInvincibleEnemy(spawnY));
                }
            },
            loop: true
        });

        // New bird spawn timer
        this.birdSpawnTimer = this.time.addEvent({
            delay: 90000, ///25000 to increase frequency
            callback: () => {
                if (this.birds.countActive() < this.birds.maxSize) {
                    const spawnY = Phaser.Math.Between(100, this.height - 100);
                    this.showWarning(this.birdWarning, 1000, spawnY, () => this.spawnBird(spawnY));
                }
            },
            loop: true
        });

        this.coinSpawnTimer = this.time.addEvent({
            delay: 6000,
            callback: () => this.spawnCoinRow(),
            loop: true
        });

        this.obstacleSpawnTimer = this.time.addEvent({
            delay: 9000,
            callback: () => this.spawnObstacle(),
            loop: true
        });
    }

    spawnObstacle() {
        if (this.obstacles.countActive() >= this.obstacles.maxSize) return;

        const type = Phaser.Math.RND.pick(['horizontal', 'vertical']);
        const sizes = {
            horizontal: { width: 200 * this.scaleFactor, height: 30 * this.scaleFactor },
            vertical: { width: 30 * this.scaleFactor, height: 200 * this.scaleFactor }
        };
        
        const yPos = type === 'horizontal' 
            ? Phaser.Math.Between(100 * this.scaleFactor, this.height - 100 * this.scaleFactor)
            : Phaser.Math.Between(100 * this.scaleFactor, this.height - sizes.vertical.height);
            
        const obstacle = this.obstacles.create(
            this.width + 50 * this.scaleFactor,
            type === 'vertical' ? yPos + sizes.vertical.height/2 : yPos,
            'obstacle'
        )
            .setOrigin(0.5, 0.5)
            .setDisplaySize(sizes[type].width, sizes[type].height)
            .setVelocityX(-this.bgScrollSpeed - 200)
            .setAlpha(0.8);
         
        obstacle.body.setSize(sizes[type].width, sizes[type].height);
        obstacle.body.immovable = true;

        this.time.delayedCall(15000, () => obstacle.active && obstacle.destroy());
    }

    spawnBird(yPosition) {
        if (this.birds.countActive() >= this.birds.maxSize) return;

        const birdScale = 0.25 * this.scaleFactor;
        const bird = this.birds.create(
            this.width + 50 * this.scaleFactor,
            yPosition,
            'enemy_1'
        )
            .setScale(birdScale)
            .setVelocityX(-300); //.setFlipX(true)

        // Set hitbox
        bird.body.setSize(bird.width * 0.6, bird.height * 0.5);
        bird.body.offset.y = bird.height * 0.2;

        // Flapping animation
        this.tweens.add({
            targets: bird,
            scaleY: birdScale * 0.5,
            duration: 300,
            yoyo: true,
            repeat: -1
        });

        // Wavy flight path
        this.tweens.add({
            targets: bird,
            y: bird.y + Phaser.Math.Between(-60, 60),
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Feather particle trail
        const featherTrail = this.add.particles(0, 0, 'star', {
            speed: 10,
            scale: { start: 0.1, end: 0 },
            alpha: { start: 0.7, end: 0 },
            tint: 0xffffff,
            blendMode: 'ADD',
            lifespan: 800,
            frequency: 30,
            follow: bird,
            followOffset: { x: -bird.width * 0.04, y: 0 }
        });

        bird.on('destroy', () => {
            featherTrail.stop();
            featherTrail.destroy();
        });

        this.time.delayedCall(10000, () => bird.active && bird.destroy());
    }

    spawnInvincibleEnemy(yPosition) {
        if (this.invincibleEnemies.countActive() >= this.invincibleEnemies.maxSize) return;

        const enemyScale = 0.25 * this.scaleFactor;
        const enemy = this.invincibleEnemies.create(
            this.width + 50 * this.scaleFactor,
            yPosition,
            'avoidable'
        )
            .setScale(enemyScale)
            .setTint(0xff00ff)
            .setVelocityX(-350);

        enemy.body.setSize(enemy.width * 0.6, enemy.height * 0.5);
        enemy.body.offset.y = -0.2;

        this.tweens.add({
            targets: enemy,
            scaleX: enemyScale * 1.1,
            scaleY: enemyScale * 1.1,
            duration: 500,
            yoyo: true,
            repeat: -1
        });

        this.tweens.add({
            targets: enemy,
            y: enemy.y + Phaser.Math.Between(-50, 50),
            duration: 2000,
            yoyo: true,
            repeat: -1
        });

        const aura = this.add.particles(0, 0, 'star', {
            speed: 20,
            scale: { start: 0.2, end: 0 },
            alpha: { start: 0.8, end: 0 },
            tint: [0xff00ff, 0x00ffff],
            blendMode: 'ADD',
            lifespan: 1000,
            frequency: 50,
            follow: enemy
        });

        enemy.on('destroy', () => {
            aura.stop();
            aura.destroy();
        });

        this.time.delayedCall(10000, () => enemy.active && enemy.destroy());
    }

    spawnMissile(yPosition) {
        if (this.enemies.countActive() >= this.enemies.maxSize) return;

        const missileScale = 0.2 * this.scaleFactor;
        const missile = this.enemies.create(
            this.width + 50 * this.scaleFactor, 
            yPosition, 
            'enemy'
        )
            .setScale(missileScale)
            .setVelocityX(-400);

        missile.body.setSize(missile.width * 0.6, missile.height * 0.27);
        missile.body.offset.y = missile.height * 0.3;

        const smokeEmitter = this.add.particles(0, 0, 'explosion', {
            speed: 20,
            scale: { start: 0.13, end: 0 },
            alpha: { start: 0.7, end: 0 },
            blendMode: 'NORMAL',
            lifespan: 100,
            frequency: 10,
            follow: missile,
            followOffset: { x: missile.width * 0.08, y: 0 }
        });

        missile.on('destroy', () => {
            smokeEmitter.stop();
            smokeEmitter.destroy();
        });

        this.time.delayedCall(10000, () => missile.active && missile.destroy());
    }

    spawnCoinRow() {
        if (this.coinGroup.countActive() >= this.coinGroup.maxSize) return;

        const coinCount = Phaser.Math.Between(5, 10);
        const startY = Phaser.Math.Between(
            100 * this.scaleFactor, 
            this.height - 100 * this.scaleFactor
        );
        const spacing = 60 * this.scaleFactor;
        
        for (let i = 0; i < coinCount && this.coinGroup.countActive() < this.coinGroup.maxSize; i++) {
            const coinScale = 0.1 * this.scaleFactor;
            const coin = this.coinGroup.create(
                this.width + 50 * this.scaleFactor + (i * spacing),
                startY,
                'collectible'
            )
                .setScale(coinScale)
                .setVelocityX(-250);
            
            this.tweens.add({
                targets: coin,
                y: coin.y + Phaser.Math.Between(-20, 20),
                duration: 1000,
                yoyo: true,
                repeat: -1
            });
            
            this.time.delayedCall(9000, () => coin.active && coin.destroy());
        }
    }

    showWarning(warning, duration, yPosition, callback) {
        warning.y = yPosition;
        warning.setVisible(true);
        
        this.tweens.add({
            targets: warning,
            scaleX: warning.scale * 1.5,
            scaleY: warning.scale * 1.5,
            alpha: 0.9,
            duration: 300,
            yoyo: true,
            repeat: Math.floor(duration/300),
            onComplete: () => {
                warning.setVisible(false);
                callback();
            }
        });
        
        this.sounds.warning?.play();
        this.flashScreen(warning.tint, 100, duration);
    }

    flashScreen(color, intensity, duration) {
        const flash = this.add.rectangle(0, 0, this.width, this.height, color)
            .setOrigin(0)
            .setAlpha(intensity / 255)
            .setDepth(19);
            
        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: duration,
            onComplete: () => flash.destroy()
        });
    }

    update(time, delta) {
        if (this.isOnPlatform && !this.physics.overlap(this.player, this.platform)) {
            this.isOnPlatform = false;
        }

        this.background.tilePositionX += (this.bgScrollSpeed * delta) / 1000;
        
        if (this.isFlying) {
            this.jumpEnergy = Phaser.Math.Clamp(
                this.jumpEnergy - (this.energyDrainRate * delta / 1000),
                0,
                this.maxJumpEnergy
            );
            
            if (this.jumpEnergy <= 0) {
                this.deactivateJetpack();
                this.player.setVelocityY(Math.abs(this.jetpackForce)/2);
            } else {
                this.player.setVelocityY(this.jetpackForce);
                
                if (time > this.lastBulletTime + this.bulletDelay) {
                    this.fireBullet();
                    this.lastBulletTime = time;
                }
            }
        } else if (this.jumpEnergy < this.maxJumpEnergy) {
            this.jumpEnergy = Phaser.Math.Clamp(
                this.jumpEnergy + (this.energyRechargeRate * delta / 1000),
                0,
                this.maxJumpEnergy
            );
        }
        
        this.updateEnergyBar();

        // Cleanup off-screen objects
        [this.enemies, this.invincibleEnemies, this.birds, this.coinGroup, this.obstacles].forEach(group => {
            group.getChildren().forEach(obj => {
                if (obj.x < -50 * this.scaleFactor && obj.active) obj.destroy();
            });
        });
    }

    updateEnergyBar() {
        const percent = (this.jumpEnergy / this.maxJumpEnergy) * 100;
        this.energyBar.setScale(percent / 100, 1);
        
        if (percent > 50) {
            this.energyBar.setFillStyle(0x00ff00);
        } else if (percent > 20) {
            this.energyBar.setFillStyle(0xffff00);
        } else {
            this.energyBar.setFillStyle(0xff0000);
        }
        
        this.energyText.setText(`${Math.floor(percent)}%`);
    }

    activateJetpack() {
        this.isFlying = true;
    }

    deactivateJetpack() {
        this.isFlying = false;
    }
    
    fireBullet() {
        if (this.bullets.countActive() >= this.bullets.maxSize) return;

        this.sounds.shoot.setVolume(0.01).play();

        const bulletScale = 0.1 * this.scaleFactor;
        const bullet = this.bullets.create(
            this.player.x, 
            this.player.y + 30 * this.scaleFactor,
            'projectile'
        )
            .setScale(bulletScale)
            .setVelocityY(500);
        
        const trail = this.add.particles(0, 0, 'projectile', {
            speed: 10,
            scale: { start: 0.3 * this.scaleFactor, end: 0 },
            alpha: { start: 0.5, end: 0 },
            tint: 0xff9900,
            blendMode: 'ADD',
            lifespan: 300,
            frequency: 1,
            follow: bullet,
            followOffset: { x: 0, y: -bullet.height*0.08 }
        });

        bullet.on('destroy', () => {
            trail.stop();
            this.time.delayedCall(300, () => trail.destroy());
        });

        this.time.delayedCall(1200, () => bullet.active && bullet.destroy());
    }

    addCoins(amount) {
        this.coins += amount;
        this.updateCoinsText();
    }

    updateDistanceText() {
        this.distanceText.setText(`${this.distance.toFixed(1)}m`);
    }

    updateCoinsText() {
        this.coinsText.setText(`${this.coins}`);
    }

    gameOver() {
        this.sounds.background.stop();
        
        this.bullets.clear(true, true);
        this.enemies.clear(true, true);
        this.birds.clear(true, true);
        this.coinGroup.clear(true, true);
        this.obstacles.clear(true, true);
        
        this.distanceTimer?.destroy();
        this.obstacleSpawnTimer?.destroy();
        this.missileSpawnTimer?.destroy();
        this.invincibleSpawnTimer?.destroy();
        this.birdSpawnTimer?.destroy();
         
        initiateGameOver.bind(this)({
            "distance": this.distance.toFixed(1),
            "coins": this.coins
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

/*
------------------- GLOBAL CODE ENDS HERE -------------------
*/

// Configuration object
const config = {
    type: Phaser.AUTO,
    width: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width,
    height: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].height,
    scene: [GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        orientation: Phaser.Scale.Orientation.PORTRAIT
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
    deviceOrientation: _CONFIG.deviceOrientation==="portrait"
};

let gameLevel = 1;
let levelThreshold = 50;
let enemySpeed = 120;
let baseSpawnDelay = 2000;
let spawnDelayDecrease = 400;
let spawnTimer;
let enemies;
let bg;
let velocityX = 100;
let velocityY = 250;