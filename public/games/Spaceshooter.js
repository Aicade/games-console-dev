// Touuch Screen Controls
const joystickEnabled = true;
const buttonEnabled = true;

// JOYSTICK DOCUMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/virtualjoystick/
const rexJoystickUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js";

// BUTTON DOCMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/button/
const rexButtonUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexbuttonplugin.min.js";

/*
------------------- GLOBAL CODE STARTS HERE -------------------
*/

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        //this.score = 0;
        this.isMobile = false;
        this.killCounter = 0;        // Track consecutive kills
        this.lastKillTime = 0;       // Timestamp of last kill
        this.chainThreshold = 3;     // Number of kills needed for chain
        this.chainTimeWindow = 1000; // 1 second window for chain
        this.referenceWidth = 1920;  // Original design width
        this.referenceHeight = 951;  // Original design height
    }

    preload() {

        addEventListenersPhaser.bind(this)();

        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }

        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
        // Add this inside the preload() method
        this.load.image("heart", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/heart.png");

        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/"
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        if (joystickEnabled) this.load.plugin('rexvirtualjoystickplugin', rexJoystickUrl, true);
        if (buttonEnabled) this.load.plugin('rexbuttonplugin', rexButtonUrl, true);

        displayProgressLoader.call(this);
    }

    resize(gameSize) {
        const width = gameSize.width;
        const height = gameSize.height;
        this.width = width;
        this.height = height;

        const scaleX = width / this.referenceWidth;
        const scaleY = height / this.referenceHeight;
        const scale = Math.min(scaleX, scaleY);

        // Resize background (check if they exist)
        if (this.bg1) {
            const bgScale = width / 512;
            this.bg1.setScale(bgScale);
            this.bg1.setPosition(0, this.bg1.y);
        }
        if (this.bg2) {
            const bgScale = width / 512;
            this.bg2.setScale(bgScale);
            this.bg2.setPosition(0, this.bg2.y);
        }

        // Resize player
        if (this.player) {
            this.player.setScale(0.2 * scale);
            this.player.setPosition(width / 2, height / 2);
        }

        // Resize UI elements
        if (this.scoreText) {
            this.scoreText.setScale(scale);
            this.scoreText.setPosition(width / 2, 100 * scaleY);
        }
        if (this.levelText) {
            this.levelText.setScale(1.2 * scale);  // Maintain larger scale
            this.levelText.setPosition(20 * scaleX, 40 * scaleY);  // Slightly adjusted position
            this.levelText.setAlpha(1);
        }
        if (this.pauseButton) {
            this.pauseButton.setScale(3 * scale);
            this.pauseButton.setPosition(width - (60 * scaleX), 60 * scaleY);
        }

        // Resize joystick (only if enabled and created)
        if (joystickEnabled && this.joyStick) {
            const joyScale = scale;  // Use same scale factor
            this.joyStick.radius = 50 * joyScale;  // Scale radius
            this.joyStick.base.setScale(joyScale); // Scale base circle
            this.joyStick.thumb.setScale(joyScale); // Scale thumb circle
            this.joyStick.setPosition(
                100 * scaleX,           // Adjusted initial position
                height - (100 * scaleY) // Keep near bottom
            );
        }

        // Resize button
        if (buttonEnabled && this.buttonA) {
            this.buttonA.setScale(scale);
            this.buttonA.setPosition(
                width - (80 * scaleX),
                height - (100 * scaleY)
            );
        }

        // Update physics world bounds
        if (this.physics && this.physics.world) {
            this.physics.world.setBounds(0, 0, width, height);
        }

        // Adjust existing enemies
        if (this.enemies) {
            this.enemies.getChildren().forEach(enemy => {
                if (enemy) {
                    enemy.setScale(0.2 * scale);
                    const relativeX = (enemy.x / this.referenceWidth) * width;
                    enemy.x = Phaser.Math.Clamp(relativeX, 50 * scaleX, width - (50 * scaleX));
                }
            });
        }

        // Adjust existing bullets
        if (this.bullets) {
            this.bullets.getChildren().forEach(bullet => {
                if (bullet) {
                    bullet.setScale(0.08 * scale);
                }
            });
        }
    }

    create() {

        //for keyboard
        this.input.keyboard.disableGlobalCapture();
        
        gameScore = 0;
        gameLevel = 1;
        levelThreshold = 100;
        enemySpeed = 200;
        baseSpawnDelay = 1000;
        spawnDelayDecrease = 400;
        velocityX = 100;

        let isMobile = !this.sys.game.device.os.desktop;

        this.width = this.game.config.width;
        this.height = this.game.config.height;

        this.vfx = new VFXLibrary(this);

        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        // this.sounds.background.setVolume(0.1).setLoop(true).play();

        // this.bg = this.add.tileSprite(
        //     this.game.config.width / 2, 
        //     this.game.config.height / 2, 
        //     this.game.config.width, 
        //     this.game.config.height, 
        //     "background"
        // ).setOrigin(0.5);

        // // Adjust scale to fit screen
        // const scale = Math.max(
        //     this.game.config.width / this.bg.width, 
        //     this.game.config.height / this.bg.height
        // );
        // this.bg.setScale(scale);

    //     this.bg = this.add.tileSprite(
    //     0,                          // x position (top-left)
    //     0,                          // y position (top-left)
    //     this.game.config.width,     // width matches game size (1920)
    //     this.game.config.height,    // height matches game size (951)
    //     "background"                // texture key
    // ).setOrigin(0, 0);             // Origin at top-left

    // // Since texture size matches game size, scale should be 1
    // this.bg.setTileScale(1, 1);    // Explicitly set scale to 1:1

    // // Ensure no unnecessary tiling occurs
    // this.bg.tilePositionX = 0;
    // this.bg.tilePositionY = 0;

        this.bg = this.add.tileSprite(
            0,                          // x position (top-left)
            0,                          // y position (top-left)
            this.game.config.width,     // width matches game size (1920)
            this.game.config.height,    // height matches game size (951)
            "background"                // texture key
        ).setOrigin(0, 0);

        // Calculate scale based on texture size (512x512) to match game size (1920x951)
        const scaleX = this.game.config.width / 512;   // 1920 / 512 ≈ 3.75
        const scaleY = this.game.config.height / 512;  // 951 / 512 ≈ 1.857
        this.bg.setTileScale(scaleX, scaleY);


        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());

        this.pauseButton = this.add.sprite(this.game.config.width - 60, 60, "pauseButton")
            .setOrigin(0.5, 0.5)
            .setInteractive({ cursor: 'pointer' })
            .setScale(3);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        this.input.addPointer(3);
        const joyStickRadius = 50;

        if (joystickEnabled) {
            this.joyStick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
                x: 100,  // Initial position (will be adjusted in resize)
                y: this.game.config.height - 100,
                radius: 50,
                base: this.add.circle(0, 0, 80, 0x888888, 0.5),
                thumb: this.add.circle(0, 0, 40, 0xcccccc, 0.5),
            });
            this.joystickKeys = this.joyStick.createCursorKeys();
        }

        if (buttonEnabled) {
            this.buttonA = this.add.rectangle(this.game.config.width - 80, this.game.config.height - 100, 80, 80, 0xcccccc, 0.5);
            this.buttonA.button = this.plugins.get('rexbuttonplugin').add(this.buttonA, {
                mode: 1,
                clickInterval: 100,
            });
            this.buttonA.button.on('down', () => this.fireBullet(), this);
        }

        this.playerLives = 1;
        this.hearts = [];

        this.scoreText = this.add.bitmapText(this.width / 2, 100, 'pixelfont', gameScore, 64)
            .setOrigin(0.5, 0.5)
            .setTint(0xffff00);
        this.levelText = this.add.bitmapText(10, 30, 'pixelfont', `Level: ${gameLevel}`, 48)
            .setOrigin(0, 0.5)
            .setTint(0xfff11f)  // White base color
            .setScale(1.2);     // Slightly larger
        this.vfx.addGlow(this.levelText, 0.2, 0x00ff00);  // Green glow effect
        this.scoreText.setDepth(10);
        this.levelText.setDepth(10);
        this.levelText.setAlpha(1);

        // for (let i = 0; i < this.playerLives; i++) {
        //     const heart = this.add.image(10 + (i * 40), 80, 'heart').setOrigin(0, 0.5).setScale(0.03);
        //     heart.setDepth(10);
        //     this.hearts.push(heart);
        // }

        const centerX = this.game.config.width / 2;
        const centerY = this.game.config.height / 2;
        this.player = this.physics.add.image(centerX, centerY, 'player').setScale(0.2);
        this.player.setCollideWorldBounds(true);

        // // Bullets
        this.bullets = this.physics.add.group();

        // Enemies
        this.enemies = this.physics.add.group();

        // Keyboard Controls
        this.cursors = this.input.keyboard.createCursorKeys();
        // Replace the current collision code with this
        this.playerInvulnerable = false;
        this.physics.add.overlap(this.player, this.enemies, (player, enemy) => {
            if (!this.playerInvulnerable) {
                this.sounds.destroy.play();
                this.vfx.createEmitter('red', player.x, player.y, 1, 0, 500).explode(10);
                this.playerLives--;
                this.updateLivesDisplay();
                
                // Destroy the enemy that hit the player
                enemy.destroy();
                
                // Make player briefly invulnerable
                this.playerInvulnerable = true;
                player.alpha = 0.5;
                
                this.time.delayedCall(1500, () => {
                    player.alpha = 1;
                    this.playerInvulnerable = false;
                });
                
                // Check if game over
                if (this.playerLives <= 0) {
                    this.gameOver();
                }
            }
        }, null, this);

        this.vfx.addCircleTexture('cyan', 0x00FFFF, 1, 50);    // Larger radius
        this.vfx.addCircleTexture('magenta', 0xFF00FF, 1, 50);
        this.vfx.addCircleTexture('green', 0x00FF00, 1, 50);

        this.vfx.addCircleTexture('red', 0xFF0000, 1, 10);
        this.vfx.addCircleTexture('orange', 0xFFA500, 1, 10);
        this.vfx.addCircleTexture('yellow', 0xFFFF00, 1, 10);
        this.vfx.addCircleTexture('purple', 0x800080, 1, 5);

        this.physics.add.collider(this.bullets, this.enemies, (bullet, enemy) => {
            this.sounds.destroy.play();

            // Track kills for chain
            const currentTime = this.time.now;
            if (currentTime - this.lastKillTime <= this.chainTimeWindow) {
                this.killCounter++;
            } else {
                this.killCounter = 1;  // Reset if too much time has passed
            }
            this.lastKillTime = currentTime;

            this.vfx.createEmitter('red', enemy.x, enemy.y, 1, 0, 500).explode(10);
            this.vfx.createEmitter('yellow', enemy.x, enemy.y, 1, 0, 500).explode(10);
            this.vfx.createEmitter('orange', enemy.x, enemy.y, 1, 0, 500).explode(10);

            // Check for chain blast
            if (this.killCounter >= this.chainThreshold) {
                this.triggerChainBlast(enemy.x, enemy.y);
                this.killCounter = 0;  // Reset counter after chain
            }

            bullet.destroy();
            enemy.destroy();
            this.increaseScore(10);
        });


        spawnTimer = this.time.addEvent({
            delay: baseSpawnDelay,  // Now 1000ms instead of 2000ms
            callback: () => this.spawnEnemy(),
            loop: true
        });

        enemies = this.physics.add.group();
        this.toggleControlsVisibility(isMobile);
    }
    

    toggleControlsVisibility(visibility) {
        this.joyStick.base.visible = visibility;
        this.joyStick.thumb.visible = visibility;
        this.buttonA.visible = visibility;

        // Add resize event listener
        this.scale.on('resize', this.resize, this);
        // Call resize initially to set everything up
        this.resize({ width: this.game.config.width, height: this.game.config.height });
    }

    update() {
        this.bg.tilePositionY -= 3 + (gameLevel * 0.5);

        // Horizontal Movement
        if (this.cursors.left.isDown || this.joystickKeys.left.isDown) {
            this.player.setVelocityX(-950);
            this.player.flipX = true;
        } else if (this.cursors.right.isDown || this.joystickKeys.right.isDown) {
            this.player.setVelocityX(950);
            this.player.flipX = false;
        } else {
            this.player.setVelocityX(0);
        }

        // Add vertical movement
        if (this.cursors.up.isDown || this.joystickKeys.up.isDown) {
            this.player.setVelocityY(-650);
        } else if (this.cursors.down.isDown || this.joystickKeys.down.isDown) {
            this.player.setVelocityY(650);
        } else {
            this.player.setVelocityY(0);
        }

        this.updateGameLevel();

        // Clean up enemies that go off screen
        this.enemies.getChildren().forEach(enemy => {
            if (enemy.y > this.height + 50) {
                enemy.destroy();
            }
        });

        if (this.cursors.space.isDown && canFireBullet) {
            this.fireBullet();
            canFireBullet = false;
        } else if (this.cursors.space.isUp) {
            canFireBullet = true;
        }
    }

    triggerChainBlast(x, y) {
        // Screen-filling Chain Blast VFX
        const emitterConfig = {
            speed: { min: 300, max: 600 },      // Faster particles to reach edges
            scale: { start: 3, end: 0 },        // Much larger starting scale
            lifespan: 1000,                     // Longer lifespan to cross screen
            quantity: 50,                       // More particles for coverage
            blendMode: 'ADD',                   // Brighter effect
            radial: true,                       // Emit in all directions
            angle: { min: 0, max: 360 }         // Full circle emission
        };

        // Create multiple emitters for full coverage
        const cyanEmitter = this.vfx.createEmitter('cyan', x, y, 3, 0, 1000);
        cyanEmitter.setConfig(emitterConfig);
        cyanEmitter.explode(50);

        const magentaEmitter = this.vfx.createEmitter('magenta', x, y, 3, 0, 1000);
        magentaEmitter.setConfig(emitterConfig);
        magentaEmitter.explode(50);

        const greenEmitter = this.vfx.createEmitter('green', x, y, 3, 0, 1000);
        greenEmitter.setConfig(emitterConfig);
        greenEmitter.explode(50);

        // Add camera shake for dramatic effect
        this.vfx.shakeCamera(500, 0.02);

        // Display "Chain Blast" text
        const chainText = this.add.bitmapText(
            this.width / 2,
            this.height / 2,
            'pixelfont',
            'Chain Blast!',
            64
        ).setOrigin(0.5, 0.5).setDepth(100);

        // Enhance text VFX
        this.vfx.scaleGameObject(chainText, 1.5, 500, 0);  // Larger scale
        this.vfx.shakeGameObject(chainText, 300, 10);      // Stronger shake

        // Remove text after 1 second
        this.time.delayedCall(1000, () => {
            chainText.destroy();
        });
    }

    updateLivesDisplay() {
        for (let i = 0; i < this.hearts.length; i++) {
            this.hearts[i].visible = i < this.playerLives;
        }
    }

    updateGameLevel() {
        if (gameScore >= levelThreshold) {
            this.sounds.upgrade.play();
            this.centerText = this.add.bitmapText(this.width / 2, this.height / 2, 'pixelfont', "LEVEL UP!", 64)
                .setOrigin(0.5, 0.5)
                .setDepth(100);
            this.time.delayedCall(500, () => {
                this.centerText.destroy();
            });
            
            enemySpeed += 20;  // Increased from 10 to 20 for more noticeable speed increase
            gameLevel++;
            levelThreshold += 200;
            
            let newDelay = baseSpawnDelay - (spawnDelayDecrease * (gameLevel - 1));
            newDelay = Math.max(newDelay, 200);  // Minimum delay of 200ms
            spawnTimer.delay = newDelay;
            
            // Update existing enemies' speed
            this.enemies.getChildren().forEach(enemy => {
                enemy.setVelocityY(enemySpeed);
            });
            
            this.updateLevelText();
        }
    }

    spawnEnemy() {
        const scaleX = this.width / this.referenceWidth;
        const x = Phaser.Math.Between(50 * scaleX, this.width - (50 * scaleX));
        const enemy = this.enemies.create(x, -50, 'enemy')
            .setScale(0.2 * (this.width / this.referenceWidth));
        enemy.setVelocityY(enemySpeed);
        this.tweens.add({
            targets: enemy,
            x: {
                value: () => Phaser.Math.Between(50 * scaleX, this.width - (50 * scaleX)),
                duration: Phaser.Math.Between(1000, 2000),
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            }
        });
    }

    fireBullet() {
        this.sounds.shoot.play();
        const scale = this.width / this.referenceWidth;
        const bullet = this.bullets.create(this.player.x, this.player.y, 'projectile')
            .setScale(0.08 * scale);
        bullet.setVelocityY(-300 * scale);  // Scale velocity too
        this.time.addEvent({
            delay: 10000,
            callback: () => bullet.destroy(),
            callbackScope: this,
            loop: false
        });
    }

    // updateScore(points) {
    //     this.score += points;
    //     this.updateScoreText();
    // }

    increaseScore(points) {
        gameScore += points;
        this.updateScoreText();
        this.updateGameLevel(); // This will potentially update the level
    }

    // updateScoreText() {
    //     this.children.getChildren()[0].setText(`Score: ${this.score}`);
    // }

    updateScoreText() {

        this.scoreText.setText(`${gameScore}`);
    }

    updateLevelText() {
        this.levelText.setText(`Level: ${gameLevel}`);
        // Add scale animation on level up
        this.tweens.add({
            targets: this.levelText,
            y: this.levelText.y - 20,  // Bounce up
            duration: 200,
            ease: 'Bounce.easeOut',
            yoyo: true
        });
    }

    gameOver() {
        this.sounds.background.stop()
        initiateGameOver.bind(this)({
            "score": gameScore
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

/*
------------------- GLOBAL CODE ENDS HERE -------------------
*/


// Configuration object
const config = {
    type: Phaser.AUTO,
    width: _CONFIG.orientationSizes.landscape.width,
    height: _CONFIG.orientationSizes.landscape.height,
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
    }
};

let gameScore = 0;
let gameLevel = 1;
let levelThreshold = 100;
let enemySpeed = 1000; // Initial speed of enemies
let baseSpawnDelay = 1000; // 2000 milliseconds or 2 seconds
let spawnDelayDecrease = 200; // 400 milliseconds or 0.4 seconds
let spawnTimer;
let enemies;
let bg;
let canFireBullet = true;
let velocityX = 1000;