// Touuch Screen Controls
const joystickEnabled = false;
const buttonEnabled = false;

/*
------------------- GLOBAL CODE STARTS HERE -------------------
*/


// JOYSTICK DOCUMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/virtualjoystick/
const rexJoystickUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js";

// BUTTON DOCMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/button/
const rexButtonUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexbuttonplugin.min.js";

let gameScore = 0;
// this.score = 0;
let gameLevel = 1;
let levelThreshold = 10;
let enemySpeed = 120; // Initial speed of enemies
let spawnTimer;
let enemies;


//CREATE FUNCTION FOR THE GAME SCENE
function gameSceneCreate(game) {
    // Use updateScore(10) to increment score
    // Use gameOver() for game over

    game.scoreText = game.add.bitmapText(game.game.config.width * 0.5, game.game.config.height * 0.05, 'pixelfont', '0', 35).setOrigin(0.5).setDepth(11);
    game.levelText = game.add.bitmapText(game.game.config.width * 0.2, game.game.config.height * 0.05, 'pixelfont', `Level: ${gameLevel}`, '25').setOrigin(0.5, 0.5).setDepth(11);

    // const centerX = game.game.config.width / 2;
    // const centerY = game.game.config.height / 2;
    // game.add.image(centerX, centerY, 'background').setScale(1.3, 1);

    spawnTimer = game.time.addEvent({
        delay: 500, // Initial spawn rate
        callback: () => spawnEnemy(game),
        loop: true
    });
    enemies = game.physics.add.group();
}

//UPDATE FUNCTION FOR THE GAME SCENE
function gameSceneUpdate(game) {
    // Use updateScore(10) to increment score
    // Use gameOver() for game over
    enemies.children.iterate((enemy) => {

        if (enemy.y > game.game.config.height * 0.5) {
            game.vfx.rotateGameObject(enemy);
        }
        if (enemy.y > game.game.config.height - 20) {
            game.vfx.shakeCamera();
            game.sounds.lose.setVolume(1).setLoop(false).play();
            game.time.delayedCall(400, () => {
                game.gameOver();
            })
            enemySpeed = 120;
            spawnTimer.delay = 2000;
            // enemy.destroy();
        }
    });
    updateGameLevel(game);

}
function spawnEnemy(game) {
    const enemyX = Phaser.Math.Between(0, game.game.config.width);
    const enemy = enemies.create(enemyX, 0, 'collectible').setScale(0.4, 0.4);
    enemy.setVelocityY(enemySpeed);

    enemy.setInteractive().on('pointerdown', () => {
        game.instructionText.setAlpha(0);
        game.updateScore(1);

        enemy.destroy();
        game.sounds.collect.setVolume(0.05).setLoop(false).play()
        createParticles(game, enemy.x, enemy.y);
        increaseScore(game, 1);

    });

}

function createParticles(game, x, y) {
    // Create an emitter for the particles

    const emitter = game.add.particles(x, y, 'collectible', {
        speed: 200,
        scale: { start: 0.025, end: 0 },
        blendMode: 'ADD',
        lifespan: 600,
        on: false // Prevent it from emitting immediately
    });

    // Explode particles at the given position (x, y)
    emitter.explode(20);

    // Optional: Destroy the particles object after all particles have vanished
    // to clean up and save resources.
    game.time.delayedCall(1000, () => {
        emitter.destroy();
    });
}
function increaseDifficulty() {
    enemySpeed += 40;
    spawnTimer.delay = Math.max(spawnTimer.delay - 400, 500);
}
function increaseScore(game, points) {
    gameScore += points
    updateScoreText(game);
    updateGameLevel(game); // This will potentially update the level
}

function updateGameLevel(game) {
    if (gameScore >= levelThreshold) {
        gameLevel++;
        levelThreshold += 20; // Increment the threshold for the next level
        updateLevelText(game);
        increaseDifficulty();
    }
}
function updateScoreText(game) {

    game.scoreText.setText(`${gameScore}`);
}

function updateLevelText(game) {
    game.levelText.setText(`Level: ${gameLevel}`);
}
// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {

        this.score = 0;

        this.load.plugin('rexvirtualjoystickplugin', rexJoystickUrl, true);
        this.load.plugin('rexbuttonplugin', rexButtonUrl, true);

        // Load In-Game Assets from assetsLoader
        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }

        // gameScenePreload(this);
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
        this.load.bitmapFont('pixelfont',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.png',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.xml');

        addEventListenersPhaser.bind(this)();

        displayProgressLoader.call(this);
    }

    create() {

        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }


        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.vfx = new VFXLibrary(this);
        this.bg = this.add.sprite(0, 0, 'background').setOrigin(0, 0);
        this.bg.setScrollFactor(0);
        this.bg.displayHeight = this.game.config.height;
        this.bg.displayWidth = this.game.config.width;
        this.sounds.background.setVolume(1).setLoop(true).play();
        // Add UI elements
        // this.scoreText = this.add.text(10, 10, 'Score: 0', { fontSize: '20px', fill: globalPrimaryFontColor });
        this.instructionText = this.add.bitmapText(this.game.config.width * 0.5, this.game.config.height * 0.4, 'pixelfont', `Tap to destroy`, 25).setOrigin(0.5, 0.5);
        this.instructionText.setScrollFactor(0).setDepth(11).setTint(0x008000);
        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        const pauseButton = this.add.sprite(this.game.config.width * 0.8, this.game.config.height * 0.05, "pauseButton").setOrigin(0.5, 0.5).setScale(1.5);
        pauseButton.setInteractive({ cursor: 'pointer' });
        pauseButton.on('pointerdown', () => this.pauseGame());

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
        }

        if (buttonEnabled) {
            this.buttonA = this.add.rectangle(this.width - 80, this.height - 100, 80, 80, 0xcccccc, 0.5)
            this.buttonA.button = this.plugins.get('rexbuttonplugin').add(this.buttonA, {
                mode: 1,
                clickInterval: 100,
            });

            this.buttonA.button.on('down', function (button, gameObject) {
                console.log("button clicked");
            });
        }

        gameSceneCreate(this);

        this.input.keyboard.disableGlobalCapture();

    }

    update() {
        gameSceneUpdate(this);
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(`Score:  ${this.score}`);
    }

    gameOver() {
        initiateGameOver.bind(this)({ score: this.score});
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


// Configuration object
const config = {
    type: Phaser.AUTO,
    width: _CONFIG.deviceOrientationSizes["portrait"].width,
    height: _CONFIG.deviceOrientationSizes["portrait"].height,
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
    },
    orientation: "portrait"
};