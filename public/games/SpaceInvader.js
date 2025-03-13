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

    create() {

        //for keyboard
        this.input.keyboard.disableGlobalCapture();
        
        gameScore = 0;
        gameLevel = 1;
        levelThreshold = 100;
        enemySpeed = 120;
        baseSpawnDelay = 2000;
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

        this.sounds.background.setVolume(3).setLoop(true).play();

        this.bg = this.add.image(this.game.config.width / 2, this.game.config.height / 2, "background").setOrigin(0.5);

        // Use the larger scale factor to ensure the image covers the whole canvas
        const scale = Math.max(this.game.config.width / this.bg.displayWidth, this.game.config.height / this.bg.displayHeight);
        this.bg.setScale(scale);

        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());

        this.pauseButton = this.add.sprite(this.game.config.width - 60, 60, "pauseButton").setOrigin(0.5, 0.5);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(3);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        this.input.addPointer(3);
        const joyStickRadius = 50;

        if (joystickEnabled) {
            this.joyStick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
                x: joyStickRadius * 2,
                y: this.height - (joyStickRadius * 2),
                radius: 50,
                base: this.add.circle(0, 0, 80, 0x888888, 0.5),
                thumb: this.add.circle(0, 0, 40, 0xcccccc, 0.5),
                // dir: '8dir',   // 'up&down'|0|'left&right'|1|'4dir'|2|'8dir'|3
                // forceMin: 16,
            });
            this.joystickKeys = this.joyStick.createCursorKeys();
        }

        if (buttonEnabled) {
            this.buttonA = this.add.rectangle(this.width - 80, this.height - 100, 80, 80, 0xcccccc, 0.5)
            this.buttonA.button = this.plugins.get('rexbuttonplugin').add(this.buttonA, {
                mode: 1,
                clickInterval: 100,
            });

            this.buttonA.button.on('down', () => this.fireBullet(), this);
        }

        this.playerLives = 3;
        this.hearts = [];

        this.scoreText = this.add.bitmapText(this.width / 2, 100, 'pixelfont', gameScore, 64).setOrigin(0.5, 0.5);
        this.levelText = this.add.bitmapText(10, 30, 'pixelfont', `Level: ${gameLevel}`, 48).setOrigin(0, 0.5);
        this.scoreText.setDepth(10);
        this.levelText.setDepth(10);

        for (let i = 0; i < this.playerLives; i++) {
            const heart = this.add.image(10 + (i * 40), 80, 'heart').setOrigin(0, 0.5).setScale(0.03);
            heart.setDepth(10);
            this.hearts.push(heart);
        }

        const centerX = this.game.config.width / 2;
        const centerY = this.game.config.height / 2;

        this.player = this.physics.add.image(centerX, centerY + 300, 'player').setScale(0.2);
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

        this.vfx.addCircleTexture('red', 0xFF0000, 1, 10);
        this.vfx.addCircleTexture('orange', 0xFFA500, 1, 10);
        this.vfx.addCircleTexture('yellow', 0xFFFF00, 1, 10);

        this.physics.add.collider(this.bullets, this.enemies, (bullet, enemy) => {
            this.sounds.destroy.play();
            this.vfx.createEmitter('red', enemy.x, enemy.y, 1, 0, 500).explode(10);
            this.vfx.createEmitter('yellow', enemy.x, enemy.y, 1, 0, 500).explode(10);
            this.vfx.createEmitter('orange', enemy.x, enemy.y, 1, 0, 500).explode(10);
            bullet.destroy();
            enemy.destroy();
            this.increaseScore(10);
        });


        spawnTimer = this.time.addEvent({
            delay: 2000, // Initial spawn rate
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
    }

    update() {
        if (this.cursors.left.isDown || this.joystickKeys.left.isDown) {
            this.player.setVelocityX(-350);
            this.player.flipX = true;
        } else if (this.cursors.right.isDown || this.joystickKeys.right.isDown) {
            this.player.flipX = false;
            this.player.setVelocityX(350);

        } else {
            this.player.setVelocityX(0);
        }

        this.updateGameLevel();

        if (this.cursors.space.isDown && canFireBullet) {
            this.fireBullet();
            canFireBullet = false;
        } else if (this.cursors.space.isUp) {
            canFireBullet = true;
        }
    }

    updateLivesDisplay() {
        for (let i = 0; i < this.hearts.length; i++) {
            this.hearts[i].visible = i < this.playerLives;
        }
    }

    updateGameLevel() {
        console.log(gameScore);
        if (gameScore >= levelThreshold) {
            this.sounds.upgrade.play();
            this.centerText = this.add.bitmapText(this.width / 2, this.height / 2, 'pixelfont', "LEVEL UP!", 64).setOrigin(0.5, 0.5).setDepth(100);
            this.time.delayedCall(500, () => {
                this.centerText.destroy();
            });
            velocityX += 10;
            gameLevel++;
            levelThreshold += 200;
            let newDelay = baseSpawnDelay - (spawnDelayDecrease * (gameLevel - 1));
            newDelay = Math.max(newDelay, 200);
            spawnTimer.delay = newDelay;
            this.updateLevelText();
        }
    }

    spawnEnemy() {
        var enemyWidth = 60;
        var spacing = 10;
        var totalWidth = Phaser.Math.Between(2, 4) * (enemyWidth + spacing) - spacing;
        var startX = Phaser.Math.Between(0, this.width - totalWidth);
        var numEnemies = Phaser.Math.Between(1, 5);
        for (var i = 0; i < numEnemies; i++) {
            var x = startX + i * (enemyWidth + spacing);
            var enemy = this.enemies.create(x, -50, 'enemy').setScale(.2);
            enemy.setVelocityY(velocityX);
        }
    }

    fireBullet() {
        this.sounds.shoot.play();
        var bullet = this.bullets.create(this.player.x, this.player.y, 'projectile').setScale(.08);
        bullet.setVelocityY(-300);
        var bulletDestroyTimer = this.time.addEvent({
            delay: 10000, // 10 seconds in milliseconds
            callback: function () {
                bullet.destroy(); // Destroy the bullet after the timer expires
            },
            callbackScope: this,
            loop: false // This timer should only trigger once
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

        this.scoreText.setText(`Score: ${gameScore}`);
    }

    updateLevelText() {
        this.levelText.setText(`Level: ${gameLevel}`);
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
    width: _CONFIG.orientationSizes.portrait.width,
    height: _CONFIG.orientationSizes.portrait.height,
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
    }
};

let gameScore = 0;
let gameLevel = 1;
let levelThreshold = 100;
let enemySpeed = 120; // Initial speed of enemies
let baseSpawnDelay = 2000; // 2000 milliseconds or 2 seconds
let spawnDelayDecrease = 400; // 400 milliseconds or 0.4 seconds
let spawnTimer;
let enemies;
let bg;
let canFireBullet = true;
let velocityX = 100;