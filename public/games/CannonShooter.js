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
        this.score = 0;
    }

    preload() {

        addEventListenersPhaser.bind(this)();

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
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/"
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        if (joystickEnabled) this.load.plugin('rexvirtualjoystickplugin', rexJoystickUrl, true);
        if (buttonEnabled) this.load.plugin('rexbuttonplugin', rexButtonUrl, true);

        displayProgressLoader.call(this);
    }

    calculateScaleFactor() {
        // Base resolution the game was designed for
        const baseWidth = 720; // Based on your portrait width
        const baseHeight = 1280; // Based on your portrait height
        
        // Calculate scale factors based on current screen dimensions
        const widthFactor = this.width / baseWidth;
        const heightFactor = this.height / baseHeight;
        
        // Use the smaller factor to ensure everything fits on screen
        return Math.min(widthFactor, heightFactor);
    }

    create() {

        this.scale.on('resize', this.resize, this);
        this.isLandscape = window.innerWidth > window.innerHeight;
        gameScore = 0;
        gameLevel = 1;
        levelThreshold = 50;
        velocityX = 100;
        velocityY = 250;

        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.scaleFactor = this.calculateScaleFactor();
        
        this.scale.on('resize', this.resize, this);
        this.isLandscape = window.innerWidth > window.innerHeight;
        
        // Initialize sounds...
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.6 });
        }
        
        this.vfx = new VFXLibrary(this);
        
        // Scale background properly
        this.bg = this.add.image(this.width / 2, this.height / 2, "background").setOrigin(0.5);
        const bgScale = Math.max(this.width / this.bg.displayWidth, this.height / this.bg.displayHeight);
        this.bg.setScale(bgScale);
        this.sounds.background.setVolume(1.7).setLoop(true).play();
        
        // Add input listeners...
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        
        // Scale UI elements
        this.pauseButton = this.add.sprite(this.width - 60 * this.scaleFactor, 60 * this.scaleFactor, "pauseButton").setOrigin(0.5, 0.5);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(3 * this.scaleFactor); // Scale based on device size
        this.pauseButton.on('pointerdown', () => this.pauseGame());
        
        // Scale joystick based on device size
        const joyStickRadius = 50 * this.scaleFactor;
        
        if (joystickEnabled) {
            const joyX = this.isLandscape ? joyStickRadius * 2.5 : joyStickRadius * 2;
            const joyY = this.isLandscape ? 
                this.height - (joyStickRadius * 2) : 
                this.height - (joyStickRadius * 4);
                
            this.joyStick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
                x: joyX,
                y: joyY,
                radius: joyStickRadius,
                base: this.add.circle(0, 0, 80 * this.scaleFactor, 0x888888, 0.5),
                thumb: this.add.circle(0, 0, 40 * this.scaleFactor, 0xcccccc, 0.5),
            });
            this.joystickKeys = this.joyStick.createCursorKeys();
        }
        
        // Scale fire button
        if (buttonEnabled) {
            const buttonSize = 80 * this.scaleFactor;
            const buttonX = this.isLandscape ? 
                this.width - (150 * this.scaleFactor) : 
                this.width - (80 * this.scaleFactor);
            const buttonY = this.isLandscape ? 
                this.height - (100 * this.scaleFactor) : 
                this.height - (200 * this.scaleFactor);
                
            this.buttonA = this.add.rectangle(buttonX, buttonY, buttonSize, buttonSize, 0xcccccc, 0.5);
            
            // Scale text based on device size
            const fontSize = Math.max(16 * this.scaleFactor, 12); // Minimum font size of 12
            this.buttonAText = this.add.text(buttonX, buttonY, 'FIRE', {
                font: `${fontSize}px Arial`,
                fill: '#000000'
            }).setOrigin(0.5, 0.5);
            
            this.buttonA.button = this.plugins.get('rexbuttonplugin').add(this.buttonA, {
                mode: 1,
                clickInterval: 300,
            });
            
            this.buttonA.button.on('down', () => this.fireBullet(), this);
        }
        
        // Scale text elements
        const scoreFontSize = Math.max(64 * this.scaleFactor, 32); // Minimum size of 32
        const levelFontSize = Math.max(48 * this.scaleFactor, 24); // Minimum size of 24
        
        this.scoreText = this.add.bitmapText(this.width / 2, 100 * this.scaleFactor, 'pixelfont', gameScore, scoreFontSize).setOrigin(0.5, 0.5);
        this.levelText = this.add.bitmapText(10 * this.scaleFactor, 30 * this.scaleFactor, 'pixelfont', `Level: ${gameLevel}`, levelFontSize).setOrigin(0, 0.5);
        this.scoreText.setDepth(10);
        this.levelText.setDepth(10);
        
        // Scale platform
        this.platform = this.physics.add.image(this.width / 2, this.height, 'platform').setOrigin(0.5, 1);
        this.platform.body.immovable = true;
        this.platform.body.moves = false;
        this.platform.setImmovable(true);
        this.platform.setGravity(0, 0);
        this.platform.setDisplaySize(this.width, this.height * 0.1);
        
        // Scale player based on device size
        const playerScale = 0.24 * this.scaleFactor;
        this.player = this.physics.add.image(this.width / 2, this.height - this.platform.height + (80 * this.scaleFactor), 'player')
            .setScale(playerScale);
        this.player.setCollideWorldBounds(true);
        
        // Create groups for game objects
        this.bullets = this.physics.add.group();
        this.enemies = this.physics.add.group();

        this.cursors = this.input.keyboard.createCursorKeys();
        this.physics.add.collider(this.player, this.enemies, (player, enemy) => {
            this.gameOver();
            //loose sound
            if (this.sounds && this.sounds.lose) {
                this.sounds.lose.setVolume(0.5).setLoop(false).play();
            }
        });
        this.physics.add.collider(this.platform, this.enemies);
        this.physics.add.collider(this.bullets, this.enemies, (bullet, enemy) => {
            this.sounds.blast.setVolume(0.12).setLoop(false).play();

            this.vfx.createEmitter('enemy', enemy.x, enemy.y, 0, 0.03, 400).explode(50);
            if (enemy.level != 1) {
                bullet.destroy();
                enemy.scaleX = enemy.scaleX / 2;
                enemy.scaleY = enemy.scaleY / 2;
                enemy.level = enemy.level - 1;
            }
            else {
                bullet.destroy();
                enemy.destroy();
                this.increaseScore(10);
            }
        });

        spawnTimer = this.time.addEvent({
            delay: 2000,
            callback: () => this.spawnEnemy(),
            loop: true
        });
        enemies = this.physics.add.group();
        this.input.keyboard.disableGlobalCapture();
    }

    update() {
        // PC controls
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-600);
            this.player.flipX = true;
        } else if (this.cursors.right.isDown) {
            this.player.flipX = false;
            this.player.setVelocityX(600);
        } 
        // Mobile joystick controls with improved handling
        else if (joystickEnabled && this.joyStick) {
            if (this.joyStick.force > 10) { // Add a minimum force threshold
                // Calculate velocity based on joystick angle and force
                const angle = this.joyStick.angle;
                // Only use horizontal component for movement
                if (angle > 45 && angle < 135 || angle > 225 && angle < 315) {
                    // Up/down regions - don't move horizontally
                    this.player.setVelocityX(0);
                } else {
                    // Convert angle to radians and calculate horizontal component
                    const force = Math.min(this.joyStick.force, 50) / 50; // Normalize force
                    const radians = Phaser.Math.DegToRad(angle);
                    const velocityX = Math.cos(radians) * 600 * force;
                    
                    this.player.setVelocityX(velocityX);
                    
                    // Flip sprite based on direction
                    if (velocityX < 0) {
                        this.player.flipX = true;
                    } else if (velocityX > 0) {
                        this.player.flipX = false;
                    }
                }
            } else {
                this.player.setVelocityX(0);
            }
        } else {
            this.player.setVelocityX(0);
        }
    
        this.updateGameLevel();
    
        // PC spacebar controls
        if (this.cursors.space.isDown && canFireBullet) {
            this.fireBullet();
            canFireBullet = false;
        } else if (this.cursors.space.isUp) {
            canFireBullet = true;
        }
        
        // No need to handle the button here as it's already set up with the on('down') event
    }

    updateGameLevel() {
        if (gameScore >= levelThreshold) {
            this.sounds.upgrade.setVolume(0.5).setLoop(false).play();

            this.centerText = this.add.bitmapText(this.width / 2, this.height / 2, 'pixelfont', "LEVEL UP!", 64).setOrigin(0.5, 0.5).setDepth(100);
            this.time.delayedCall(500, () => {
                this.centerText.destroy();
            });
            velocityY += 20;
            gameLevel++;
            levelThreshold += 50;
            let newDelay = baseSpawnDelay - (spawnDelayDecrease * (gameLevel - 1));
            newDelay = Math.max(newDelay, 200);
            spawnTimer.delay = newDelay;
            this.updateLevelText();
        }
    }

    spawnEnemy() {
        let rand = Math.floor(Math.random() * 2);
        let spawnX = rand == 0 ? 50 * this.scaleFactor : this.game.config.width - (50 * this.scaleFactor);
    
        // Scale enemy based on device size and level
        var enemy = this.enemies.create(spawnX, 200 * this.scaleFactor, 'enemy')
            .setScale(0.2 * gameLevel * this.scaleFactor);
            
        enemy.setBounce(0.9);
        enemy.setCollideWorldBounds(true);
        enemy.setGravity(0, 200);
        enemy.setVelocityY(velocityY);
    
        let enemyVelocityX = rand == 0 ? 200 : -200;
        enemy.setVelocityX(enemyVelocityX);
        enemy.level = gameLevel;
    }

    fireBullet() {
        this.sounds.shoot.setVolume(0.1).setLoop(false).play();
    
        // Scale bullet based on device size
        var bullet = this.bullets.create(this.player.x, this.player.y, 'projectile')
            .setScale(.1 * this.scaleFactor);
            
        bullet.setVelocityY(-1000);
        var bulletDestroyTimer = this.time.addEvent({
            delay: 10000,
            callback: () => {
                bullet.destroy();
            },
            callbackScope: this,
            loop: false
        });
    }

    resize(gameSize) {
        const width = gameSize.width;
        const height = gameSize.height;
        
        this.width = width;
        this.height = height;
        this.isLandscape = width > height;
        
        // Recalculate scale factor
        this.scaleFactor = this.calculateScaleFactor();
        
        // Resize and reposition background
        if (this.bg) {
            this.bg.setPosition(width / 2, height / 2);
            const scale = Math.max(width / this.bg.width, height / this.bg.height);
            this.bg.setScale(scale);
        }
        
        // Reposition and resize the platform
        if (this.platform) {
            this.platform.setPosition(width / 2, height);
            this.platform.setDisplaySize(width, height * 0.1);
        }
        
        // Reposition and resize UI elements
        if (this.scoreText) {
            const scoreFontSize = Math.max(64 * this.scaleFactor, 32);
            this.scoreText.setPosition(width / 2, 100 * this.scaleFactor);
            this.scoreText.setFontSize(scoreFontSize);
        }
        
        if (this.levelText) {
            const levelFontSize = Math.max(48 * this.scaleFactor, 24);
            this.levelText.setPosition(10 * this.scaleFactor, 30 * this.scaleFactor);
            this.levelText.setFontSize(levelFontSize);
        }
        
        if (this.pauseButton) {
            this.pauseButton.setPosition(width - 60 * this.scaleFactor, 60 * this.scaleFactor);
            this.pauseButton.setScale(3 * this.scaleFactor);
        }
        
        // Resize player
        if (this.player) {
            const playerScale = 0.24 * this.scaleFactor;
            this.player.setScale(playerScale);
            // Make sure player is above platform
            this.player.y = height - this.platform.displayHeight + (80 * this.scaleFactor);
        }
        
        // Resize joystick
        if (this.joyStick) {
            const joyStickRadius = 50 * this.scaleFactor;
            const joyX = this.isLandscape ? joyStickRadius * 2.5 : joyStickRadius * 2;
            const joyY = this.isLandscape ? height - (joyStickRadius * 2) : height - (joyStickRadius * 4);
            
            this.joyStick.setPosition(joyX, joyY);
            this.joyStick.radius = joyStickRadius;
            
            // Need to recreate base and thumb with new sizes
            if (this.joyStick.base) this.joyStick.base.setRadius(80 * this.scaleFactor);
            if (this.joyStick.thumb) this.joyStick.thumb.setRadius(40 * this.scaleFactor);
        }
        
        // Resize fire button
        if (this.buttonA) {
            const buttonSize = 80 * this.scaleFactor;
            const buttonX = this.isLandscape ? width - (150 * this.scaleFactor) : width - (80 * this.scaleFactor);
            const buttonY = this.isLandscape ? height - (100 * this.scaleFactor) : height - (200 * this.scaleFactor);
            
            this.buttonA.setPosition(buttonX, buttonY);
            this.buttonA.width = buttonSize;
            this.buttonA.height = buttonSize;
            
            if (this.buttonAText) {
                const fontSize = Math.max(16 * this.scaleFactor, 12);
                this.buttonAText.setPosition(buttonX, buttonY);
                this.buttonAText.setFontSize(fontSize);
            }
        }
    }

    increaseScore(points) {
        gameScore += points;
        this.updateScoreText();
        this.updateGameLevel();
    }

    updateLevelText() {
        this.levelText.setText(`Level: ${gameLevel}`);
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(`Score: ${gameScore}`);
    }

    gameOver() {
        this.sounds.background.stop();
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
    width: window.innerWidth,
    height: window.innerHeight,
    scene: [GameScene],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        // Let the device determine orientation instead of forcing it
        orientation: Phaser.Scale.Orientation.AUTO
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
    // Remove fixed orientation preference
    deviceOrientation: null
};

let gameScore = 0;
let gameLevel = 1;
let levelThreshold = 50;
let enemySpeed = 120;
let baseSpawnDelay = 2000;
let spawnDelayDecrease = 400;
let spawnTimer;
let enemies;
let bg;
let canFireBullet = true;
let velocityX = 100;
let velocityY = 250;
