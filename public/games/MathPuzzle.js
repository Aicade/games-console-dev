// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.score = 0;
        this.questionText = null;
        this.rightButton = null;
        this.wrongButton = null;
        this.timerText = null;
        this.timeLeft = 10;
        this.timerEvent = null;
        this.particles = null;
        this.emitter = null;
    }

    preload() {

        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        this.load.image('heart', 'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/heart.png');
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

        this.sounds.background.setVolume(1).setLoop(true).play()

        this.gameSceneBackground();
        this.lives = 3;
        this.hearts = [];
        for (let i = 0; i < this.lives; i++) {
            let x = 60 + (i * 35);
            this.hearts[i] = this.add.image(x, 100, "heart").setScale(0.025).setDepth(11);
        }

        // this.scoreText = this.add.bitmapText(40, 20, 'pixelfont', 'Score: 0', 28).setDepth(11);

        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.pauseButton = this.add.image(this.game.config.width - 60, 60, "pauseButton");
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(2).setScrollFactor(0).setDepth(11);
        this.pauseButton.on('pointerdown', () => this.pauseGame());
        this.score = 0;
        this.missed = 0;
        this.createImprovedUI();

        this.vfx.addCircleTexture('greenCircleTexture', 0x00ff00);
        this.greenEmitter = this.vfx.createEmitter('greenCircleTexture', this.width / 2, this.height - 100, 0.2, 0, 800).setAlpha(0.5);

        this.startNewQuestion();
        this.input.keyboard.disableGlobalCapture();
    }

    // Add this method to the GameScene class
    createImprovedUI() {
        // Create a semi-transparent panel for the question
        this.questionPanel = this.add.rectangle(
            this.game.config.width / 2,
            this.game.config.height / 2.5 - 2,
            this.game.config.width * 0.8,
            80,
            0x000000,
            0.7
        ).setOrigin(0.5);
        
        // Create a better timer bar
        this.timerBarBackground = this.add.rectangle(
            this.game.config.width / 2,
            50,
            this.game.config.width * 0.6,
            20,
            0x333333
        ).setOrigin(0.5);
        
        this.timerBar = this.add.rectangle(
            this.game.config.width / 2 - (this.game.config.width * 0.6) / 2,
            50,
            this.game.config.width * 0.6,
            20,
            0x00ff00
        ).setOrigin(0, 0.5);
        
        // Style the buttons with background rectangles
        this.correctButtonBg = this.add.rectangle(
            this.game.config.width / 2 + 100,
            this.game.config.height / 2 + 50,
            120,
            50,
            0x006600,
            0.8
        ).setOrigin(0.5).setInteractive({ cursor: 'pointer' })
        .on('pointerdown', () => this.checkAnswer(true))
        .on('pointerover', () => this.correctButtonBg.setFillStyle(0x009900, 0.8))
        .on('pointerout', () => this.correctButtonBg.setFillStyle(0x006600, 0.8));
        
        this.wrongButtonBg = this.add.rectangle(
            this.game.config.width / 2 - 100,
            this.game.config.height / 2 + 50,
            120,
            50,
            0x660000,
            0.8
        ).setOrigin(0.5).setInteractive({ cursor: 'pointer' })
        .on('pointerdown', () => this.checkAnswer(false))
        .on('pointerover', () => this.wrongButtonBg.setFillStyle(0x990000, 0.8))
        .on('pointerout', () => this.wrongButtonBg.setFillStyle(0x660000, 0.8));
        
        // Create and position UI text elements on top of the new backgrounds
        this.questionText = this.add.bitmapText(
            this.game.config.width / 2,
            this.game.config.height / 2.5,
            'pixelfont', 
            '55', 
            40
        ).setOrigin(0.5).setDepth(1);

        this.timerText = this.add.bitmapText(
            this.game.config.width / 2,
            20,
            'pixelfont',
            `Time: ${this.timeLeft}s`, 
            28
        ).setOrigin(0.5).setTint(0xffffff).setDepth(1);

        this.rightButton = this.add.bitmapText(
            this.game.config.width / 2 + 100,
            this.game.config.height / 2 + 50,
            'pixelfont', 
            'CORRECT', 
            22
        ).setOrigin(0.5).setTint(0xffffff).setDepth(1);

        this.wrongButton = this.add.bitmapText(
            this.game.config.width / 2 - 100,
            this.game.config.height / 2 + 50,
            'pixelfont', 
            'WRONG', 
            22
        ).setOrigin(0.5).setTint(0xffffff).setDepth(1);

        // Create feedback text for correct/wrong answers
        this.correctText = this.add.bitmapText(
            this.game.config.width / 2,
            this.game.config.height - 100,
            'pixelfont',
            "CORRECT! +10",
            30
        ).setOrigin(0.5).setAlpha(0).setTint(0x00ff00).setDepth(1);

        this.wrongText = this.add.bitmapText(
            this.game.config.width / 2,
            this.game.config.height - 100,
            'pixelfont',
            `WRONG!`,
            30
        ).setOrigin(0.5).setAlpha(0).setTint(0xff4f5f).setDepth(1);
        
        // Create a scoreboard panel
        // this.scorePanel = this.add.rectangle(
        //     40,
        //     20,
        //     150,
        //     40,
        //     0x000000,
        //     0.7
        // ).setOrigin(0, 0);
        
        this.scoreText = this.add.bitmapText(
            this.game.config.width / 2,
            80,
            'pixelfont', 
            'Score: 0', 
            28
        ).setOrigin(0.5, 0.5).setDepth(11);
    }


    checkAnswer(playerChoice) {
        if (this.timeLeft <= 0) return;
        if (!this.clickAllowed) return;
        this.answerChosen = true;
        this.clickAllowed = false;

        if (this.timerTween) {
            this.timerTween.stop();
        }

        if (playerChoice) {
            this.correctButtonBg.setFillStyle(0x00ff00, 1);
        } else {
            this.wrongButtonBg.setFillStyle(0xff0000, 1);
        }
        if (playerChoice === this.correctAnswer) {
            this.greenEmitter.explode(250);
            this.sounds.success.setVolume(0.4).setLoop(false).play()
            this.tweens.add({
                targets: this.correctText,
                alpha: 1,
                y: this.game.config.height - 200,
                duration: 200,
                ease: 'Power-in',
                onComplete: () => {
                    this.time.delayedCall(1500, () => {
                        this.correctText.alpha = 0;
                        this.correctText.y = this.game.config.height - 100;
                        this.updateScore(10);
                        this.startNewQuestion();
                    })
                }
            });
        } else {
            this.wrongAnswer();
        }
    }

    wrongAnswer() {
        this.sounds.damage.setVolume(0.4).setLoop(false).play()
        this.tweens.add({
            targets: this.wrongText,
            alpha: 1,
            y: this.game.config.height - 200,
            duration: 200,
            ease: 'Power-in',
            onComplete: () => {
                this.time.delayedCall(1500, () => {
                    this.wrongText.alpha = 0;
                    this.wrongText.y = this.game.config.height - 100;
                    if (this.lives > 0) {
                        this.lives--;
                        this.hearts[this.lives].destroy();
                        this.startNewQuestion();

                    } else {
                        this.sound.stopAll();
                        this.sounds.lose.setVolume(0.4).setLoop(false).play()
                        this.vfx.shakeCamera(300, 0.04);
                        this.time.delayedCall(2000, () => {
                            this.gameOver();
                        });
                    }
                })
            }
        });


    }

    startNewQuestion() {
        this.answerChosen = false;
        this.generateQuestion();
        this.resetTimer();
        this.clickAllowed = true;
    }

    generateQuestion() {
        const operations = ['+', '-', 'x', '/'];
        const operation = Phaser.Utils.Array.GetRandom(operations);
        const num1 = Phaser.Math.Between(1, 20);
        const num2 = Phaser.Math.Between(1, 20);

        let answer;
        switch (operation) {
            case '+':
                answer = num1 + num2;
                break;
            case '-':
                answer = num1 - num2;
                break;
            case 'x':
                answer = num1 * num2;
                break;
            case '/':
                answer = Math.floor(num1 / num2);
                break;
        }

        // Randomly decide if the shown answer should be correct or wrong
        const isCorrect = Phaser.Math.Between(0, 1) === 1;
        const shownAnswer = isCorrect ? answer : Phaser.Math.Between(1, 40);
        let quesString = `${num1} ${operation} ${num2}  =  ${shownAnswer}`;
        this.questionText.setText(quesString);
        this.correctAnswer = isCorrect;
        this.questionText.x = this.game.config.width;
        this.questionText.alpha = 0;
        this.tweens.add({
            targets: this.questionText,
            alpha: 1,
            x: this.game.config.width / 2,
            duration: 500,
            ease: 'Power-in',
        });
    }

    createUI() {
        this.questionText = this.add.bitmapText(this.game.config.width / 2,
            this.game.config.height / 2.5,
            'pixelfont', '55', 40).setOrigin(0.5);

        this.rightButton = this.add.bitmapText(this.game.config.width / 2 + 100,
            this.game.config.height / 2 + 50,
            'pixelfont', '< CORRECT >', 22).setOrigin(0.5)
            .setInteractive({ cursor: 'pointer' }).on('pointerdown', () => this.checkAnswer(true))
            .setTint(0x00ff00);

        this.wrongButton = this.add.bitmapText(this.game.config.width / 2 - 100,
            this.game.config.height / 2 + 50,
            'pixelfont', '< WRONG >', 27).setOrigin(0.5).
            setInteractive({ cursor: 'pointer' }).on('pointerdown', () => this.checkAnswer(false))
            .setTint(0xff4f5f);

        this.timerText = this.add.bitmapText(
            this.game.config.width / 2,
            50,
            'pixelfont',
            `Time left : ${this.timeLeft}s`, 28
        ).setOrigin(0.5).setTint(0xffffff);

        this.correctText = this.add.bitmapText(
            this.game.config.width / 2,
            this.game.config.height - 100,
            'pixelfont',
            "Score +10",
            30
        ).setOrigin(0.5).setAlpha(0).setTint(0x00ff00);

        this.wrongText = this.add.bitmapText(
            this.game.config.width / 2,
            this.game.config.height - 100,
            'pixelfont',
            `Wrong answer !`,
            30
        ).setOrigin(0.5).setAlpha(0).setTint(0xff4f5f);
    }

    resetTimer() {
        if (this.timerEvent) this.timerEvent.remove(false);
        this.timeLeft = 10; // Reset the time for each question
        this.timerText.setText(`Time: ${this.timeLeft}s`).setTint(0xffffff);
        
        // Stop any existing timer tween
        if (this.timerTween) {
            this.timerTween.stop();
        }
        
        // Reset timer bar and animate it
        this.timerBar.setFillStyle(0x00ff00);
        this.timerBar.width = this.game.config.width * 0.6;
        
        this.timerTween = this.tweens.add({
            targets: this.timerBar,
            width: 0,
            duration: 10000,
            ease: 'Linear'
        });
        
        this.timerEvent = this.time.addEvent({
            delay: 1000,
            callback: this.updateTimer,
            callbackScope: this,
            loop: true
        });
    }

    updateTimer() {
        if (this.answerChosen) return;
        
        this.timeLeft--;
        this.timerText.setText(`Time: ${this.timeLeft}s`);
        this.sounds.shoot.setVolume(0.05).setLoop(false).play();
        
        if (this.timeLeft <= 0) {
            this.gameOver();
        }
        
        if (this.timeLeft <= 5) {
            this.timerText.setTint(0xff0000);
            this.timerBar.setFillStyle(0xff0000);
        }
    }

    gameOver() {
        this.timerEvent.remove(false);
        if (this.timerTween) {
            this.timerTween.stop();
        }
        initiateGameOver.bind(this)({ score: this.score });
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(`Score: ${this.score}`);
    }

    pauseGame() {
        handlePauseGame.bind(this)();
    }

    gameSceneBackground() {
        this.bg = this.add.image(0, 0, "background").setOrigin(0, 0);
        const scale = Math.max(this.game.config.width / this.bg.displayWidth, this.game.config.height / this.bg.displayHeight);
        this.bg.setScale(scale);
        this.bg.postFX.addGradient("black", "black", 0.3);
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
    width: _CONFIG.deviceOrientationSizes[_CONFIG.deviceOrientation].width,
    height: _CONFIG.deviceOrientationSizes[_CONFIG.deviceOrientation].height,
    scene: [GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    pixelArt: true,
    /* ADD CUSTOM CONFIG ELEMENTS HERE */
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 200 },
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