// Touuch Screen Controls
const joystickEnabled = false;
const buttonEnabled = false;

// JOYSTICK DOCUMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/virtualjoystick/
const rexJoystickUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js";

// BUTTON DOCMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/button/
const rexButtonUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexbuttonplugin.min.js";

function gameScenePreload(scene) {
    if (joystickEnabled) scene.load.plugin('rexvirtualjoystickplugin', rexJoystickUrl, true);
    if (buttonEnabled) scene.load.plugin('rexbuttonplugin', rexButtonUrl, true);

    for (const key in _CONFIG.imageLoader) {
        scene.load.image(key, _CONFIG.imageLoader[key]);
    }

    for (const key in _CONFIG.soundsLoader) {
        scene.load.audio(key, [_CONFIG.soundsLoader[key]]);
    }

    scene.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
    const fontName = 'pix';
    const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/"
    scene.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');
}

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.rows = 4;
        this.columns = 6;
        this.rectWidth = 100;
        this.rectHeight = 100;
        this.spacing = 40;
        this.indexInUse = [];
        this.randomPositions = [];
    }

    preload() {
        gameScenePreload(this);
        displayProgressLoader.call(this);
        addEventListenersPhaser.bind(this)();
    }
    resize() {
        // Get current game dimensions
        const width = this.game.config.width;
        const height = this.game.config.height;
        
        // Resize background
        if (this.bg) {
            this.bg.displayHeight = height;
            this.bg.displayWidth = width;
        }
        
        // Calculate scaling factors based on reference resolution
        // Assuming original design was for 1080x1920 (portrait)
        const referenceWidth = 1080;
        const referenceHeight = 1920;
        const scaleX = width / referenceWidth;
        const scaleY = height / referenceHeight;
        const scale = Math.min(scaleX, scaleY);
        
        // Recalculate game grid dimensions
        this.rectWidth = 100 * scale;
        this.rectHeight = 100 * scale;
        this.spacing = 40 * scale;
        
        // Recalculate total dimensions
        this.totalWidth = this.columns * this.rectWidth + ((this.columns - 1) * this.spacing);
        this.totalHeight = this.rows * this.rectHeight + ((this.rows - 1) * this.spacing);
        
        // Recalculate starting positions
        this.startPosX = ((width - this.totalWidth) / 2) + this.rectWidth / 2;
        this.startPosY = ((height - this.totalHeight) / 2) + this.rectHeight / 2 + (50 * scale);
        
        // Resize UI elements
        if (this.scoreText) {
            this.scoreText.setPosition(width / 2, 50 * scale);
            this.scoreText.setFontSize(64 * scale);
        }
        
        if (this.timerText) {
            this.timerText.setPosition(10 * scale, 30 * scale);
            this.timerText.setFontSize(48 * scale);
        }
        
        if (this.pauseButton) {
            this.pauseButton.setPosition(width - (60 * scale), 60 * scale);
            this.pauseButton.setScale(3 * scale);
        }
        
        // Resize joystick if enabled
        if (joystickEnabled && this.joyStick) {
            const joyStickRadius = 50 * scale;
            this.joyStick.base.setRadius(80 * scale);
            this.joyStick.thumb.setRadius(40 * scale);
            this.joyStick.setPosition(joyStickRadius * 2, height - (joyStickRadius * 2));
        }
        
        // Resize button if enabled
        if (buttonEnabled && this.buttonA) {
            this.buttonA.setPosition(width - (80 * scale), height - (100 * scale));
            this.buttonA.setSize(80 * scale, 80 * scale);
        }
        
        // Update mole grid positions
        this.randomPositions = [];
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
                this.randomPositions.push({
                    x: this.startPosX + (j * (this.rectWidth + this.spacing)),
                    y: this.startPosY + (i * (this.rectHeight + this.spacing))
                });
            }
        }
        
        // Resize grid rectangles if they exist
        if (this.gridRects) {
            this.gridRects.forEach((rect, index) => {
                const pos = this.randomPositions[index];
                rect.setPosition(pos.x, pos.y);
                rect.setSize(this.rectWidth, this.rectHeight);
            });
        }
        
        // Resize moles
        if (this.moleGroup) {
            this.moleGroup.getChildren().forEach(mole => {
                // Find the closest position in the grid
                const closestPos = this.findClosestPosition(mole.x, mole.y);
                if (closestPos) {
                    mole.setPosition(closestPos.x, closestPos.y);
                    mole.displayHeight = this.rectHeight;
                    mole.displayWidth = this.rectWidth;
                }
            });
        }
    }

    findClosestPosition(x, y) {
        if (!this.randomPositions.length) return null;
        
        let closestPos = this.randomPositions[0];
        let closestDist = Phaser.Math.Distance.Between(x, y, closestPos.x, closestPos.y);
        
        for (let i = 1; i < this.randomPositions.length; i++) {
            const pos = this.randomPositions[i];
            const dist = Phaser.Math.Distance.Between(x, y, pos.x, pos.y);
            if (dist < closestDist) {
                closestDist = dist;
                closestPos = pos;
            }
        }
        
        return closestPos;
    }

    create() {
        this.vfx = new VFXLibrary(this);
        this.score = 0;
        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.initTimeLimit = 50;
        this.timeLimit = this.initTimeLimit;
        this.sounds = {};

        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        this.sounds.background.setVolume(1.5).setLoop(true).play()

        this.bg = this.add.sprite(0, 0, 'background').setOrigin(0, 0);
        this.bg.setScrollFactor(0);
        this.bg.displayHeight = this.height;
        this.bg.displayWidth = this.width;

        // Add UI elements
        this.scoreText = this.add.bitmapText(this.width / 2, 50, 'pixelfont', 0, 64).setOrigin(0.5, 0.5);
        this.scoreText.setDepth(11);

        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());

        this.pauseButton = this.add.sprite(this.width - 60, 60, "pauseButton").setOrigin(0.5, 0.5);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(3);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        this.vfx.addCircleTexture('red', 0xFF0000, 1, 10);
        this.vfx.addCircleTexture('orange', 0xFFA500, 1, 10);
        this.vfx.addCircleTexture('yellow', 0xFFFF00, 1, 10);

        // To check if rows and columns won't get out of the game canvas area
        this.totalWidth = this.columns * this.rectWidth + ((this.columns - 1) * this.spacing);
        this.totalHeight = this.rows * this.rectHeight + ((this.rows - 1) * this.spacing);
        if (this.totalWidth > this.width) {
            let extraWidth = this.totalWidth - this.width;
            this.rectWidth = this.rectWidth - (extraWidth / this.columns);
        }
        if (this.totalHeight > this.height) {
            let extraHeight = this.totalHeight - this.height;
            this.rectHeight = this.rectHeight - (extraHeight / this.rows);
        }

        this.startPosX = ((this.width - this.totalWidth) / 2) + this.rectWidth / 2;
        this.startPosY = ((this.height - this.totalHeight) / 2) + this.rectHeight / 2 + 50;

        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
                this.randomPositions.push({
                    x: this.startPosX + (j * (this.rectWidth + this.spacing)),
                    y: this.startPosY + (i * (this.rectHeight + this.spacing))
                })
            }
        };
        this.timerText = this.add.bitmapText(10, 30, 'pixelfont', `Time: ${this.timeLimit}`, 48).setOrigin(0, 0.5);;
        this.gridRects = [];
        this.randomPositions.forEach((pos) => {
            let rect = this.add.rectangle(pos.x, pos.y, this.rectWidth, this.rectHeight, 0x000000, 0.5);
            rect.setStrokeStyle(2, 0x222222);
            this.gridRects.push(rect);
        });

        this.moleGroup = this.add.group();

        this.createSpawnerEvent(700);

        this.timerEvent = this.time.addEvent({
            delay: 500,
            callback: this.updateTimer,
            callbackScope: this,
            loop: true
        });


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

            this.buttonA.button.on('down', (button, gameObject) => {
                this.pointerTouched = true;
            });

            this.buttonA.button.on('up', (button, gameObject) => {
                this.pointerTouched = false;
            });
        }

        this.scale.on('resize', this.resize, this);
        this.resize(); // Call once to set initial sizes
    }

    createSpawnerEvent(time) {
        if (this.spawnerEvent) this.spawnerEvent.destroy();
        this.spawnerEvent = this.time.addEvent({
            delay: time,
            callback: this.spawnMole,
            callbackScope: this,
            loop: true
        });
        this.input.keyboard.disableGlobalCapture();
    }

    updateTimer() {
        this.timeLimit -= 1;
        this.timerText.setText('Time: ' + this.timeLimit);

        if (this.timeLimit === 0) {
            this.endGame();
        } else if (this.timeLimit === Math.floor(this.initTimeLimit / 2)) {
            this.createSpawnerEvent(500)
        } else if (this.timeLimit === Math.floor(this.initTimeLimit / 2.5)) {
            this.createSpawnerEvent(300)
        }
    }

    hitMole(mole) {
        if (mole.missed) return;
        this.sounds.destroy.setVolume(0.5).setLoop(false).play()
        this.vfx.createEmitter('red', mole.x, mole.y, 1, 0, 500).explode(10);
        this.vfx.createEmitter('yellow', mole.x, mole.y, 1, 0, 500).explode(10);
        this.vfx.createEmitter('orange', mole.x, mole.y, 1, 0, 500).explode(10);
        this.vfx.shakeCamera(100, 0.02);
        this.updateScore(5);
        mole.killed = true;
        this.tweens.add({
            targets: mole,
            alpha: 0,
            duration: 100,
            ease: 'Power2',
            onComplete: (tween, targets) => {
                targets[0].destroy();
            }
        });
    }

    spawnMole() {
        let randomIndex = Phaser.Math.Between(0, this.randomPositions.length - 1);

        // Avoids mole to spawn in the same place
        if (this.indexInUse.includes(randomIndex)) return;

        this.indexInUse.push(randomIndex);
        const randomPosition = this.randomPositions[randomIndex];
        const mole = this.moleGroup.create(randomPosition.x, randomPosition.y + 20, 'enemy');
        mole.killed = false;
        mole.missed = false;
        mole.setAlpha(0).setScale(0.08).setInteractive({ cursor: 'pointer' });
        mole.displayHeight = this.rectHeight;
        mole.displayWidth = this.rectWidth;
        this.sounds.spawn.setVolume(0.1).setLoop(false).play()
        this.tweens.add({
            targets: mole,
            alpha: 1,
            y: randomPosition.y,
            duration: 300,
            ease: 'Power2',
        });
        mole.on('pointerdown', () => this.hitMole(mole), this);

        // Hide the mole after a certain time
        this.time.delayedCall(Phaser.Math.Between(1000, 3000), () => {
            let indexToBeRemoved = this.indexInUse.indexOf(randomIndex);
            this.indexInUse.splice(indexToBeRemoved, 1);
            if (mole.killed) return;
            mole.missed = true;
            this.tweens.add({
                targets: mole,
                alpha: 0,
                y: randomPosition.y + 10,
                duration: 300,
                ease: 'Power2',
                onComplete: (tween, targets) => {
                    targets[0].destroy();
                }
            });
        });
    }

    endGame() {
        this.spawnerEvent.destroy();
        this.timerEvent.destroy();
        this.gameOver();
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(`Score: ${this.score}`);
    }

    gameOver() {
        initiateGameOver.bind(this)({
            "score": this.score
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
    width: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width,
    height: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].height,
    pixelArt: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        orientation: Phaser.Scale.Orientation.PORTRAIT,
        width: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width,
        height: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].height
    },
    scene: [GameScene],
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions,
    },
    deviceOrientation: _CONFIG.deviceOrientation==="portrait"
};
