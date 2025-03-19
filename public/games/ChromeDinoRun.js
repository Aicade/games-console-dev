/*
------------------- GLOBAL CODE STARTS HERE -------------------
*/

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        this.score = 0;
        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }

        this.load.image('heart', 'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/heart.png');
        this.load.bitmapFont('pixelfont',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.png',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.xml');
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");

        addEventListenersPhaser.bind(this)();
        displayProgressLoader.call(this);

    }

    create() {

        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.vfx = new VFXLibrary(this);

// Add UI elements with animated transitions.
this.scoreText = this.add.bitmapText(30, 15, 'pixelfont', 'Score: 0', 25)
                      .setScrollFactor(0)
                      .setDepth(11);
// Set initial alpha to 0 and position off-screen for slide-in effect.
this.scoreText.alpha = 0;
this.scoreText.x = -100; // start off-screen left

// Tween the scoreText into view.
this.tweens.add({
    targets: this.scoreText,
    x: 30,          // move to its normal position
    alpha: 1,       // fade in to full opacity
    duration: 1000, // duration in ms
    ease: 'Sine.easeInOut'
});

this.lives = 3;
this.hearts = [];
for (let i = 0; i < this.lives; i++) {
    let xPos = 50 + (i * 35);
    let heart = this.add.image(xPos, 90, "heart")
                     .setScale(0.025)
                     .setDepth(11);
    // Set initial properties for a smooth transition.
    heart.alpha = 0;
    heart.y = 50; // start higher than final position.
    this.hearts.push(heart);

    // Tween each heart into place with a stagger effect.
    this.tweens.add({
        targets: heart,
        y: 90,        // final y position
        alpha: 1,     // fade in
        duration: 1000,
        delay: i * 100, // stagger delay
        ease: 'Sine.easeInOut'
    });
}


        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        this.sounds.background.setVolume(3).setLoop(true).play();
        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.pauseButton = this.add.image(this.game.config.width - 60, 60, "pauseButton");
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(2).setScrollFactor(0).setDepth(11);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        this.scale.pageAlignHorizontally = true;
        this.scale.pageAlignVertically = true;
        this.scale.refresh();

this.bg = this.add.tileSprite(this.game.config.width / 2, this.game.config.height / 2, this.game.config.width, this.game.config.height, "background");

// Create the tileSprite as before:
this.bg = this.add.tileSprite(
    this.game.config.width / 2,
    this.game.config.height / 2,
    this.game.config.width,
    this.game.config.height,
    "background"
  );
  
  // Get the source image dimensions.
  let bgSource = this.textures.get("background").getSourceImage();
  
  // Scale the tile texture so one image fills the screen.
  this.bg.tileScaleX = this.game.config.width / bgSource.width;
  this.bg.tileScaleY = this.game.config.height / bgSource.height;
  

        this.cameras.main.setBackgroundColor('#eee');

        this.time.addEvent({
            delay: 1000,
            callback: this.updateScore,
            callbackScope: this,
            loop: true,
            args: [1]
        });

        this.platform = this.add.tileSprite(this.width / 2, this.height, this.width, 80, 'platform');
        this.physics.add.existing(this.platform);
        this.platform.body.setImmovable(true);
        this.platform.body.setAllowGravity(false)
        this.platform.setOrigin(0.5, 1);

        this.platform.preFX.addShine(0.3);


        this.player = this.physics.add.sprite(this.width * 0.2, this.height * 0.6, 'player');
        this.player.setOrigin(0.5).setScale(0.2);
        const fx = this.player.preFX.addBarrel(0.95);

        this.tweens.add({
            targets: fx,
            amount: 1.05,
            duration: 600,
            yoyo: true,
            loop: -1,
            ease: 'sine.inout'
        });

        this.player.body.setSize(this.player.width * 0.8, this.player.height * 0.8);

        let spaceKey = this.input.keyboard.addKey('SPACE');

        spaceKey.on('down', this.jump, this);

        this.input.on('pointerdown', this.jump, this);

        this.tileVelocity = -45000;
        this.tileRate = 1500;

        this.time.addEvent({
            delay: this.tileRate,
            callback: this.addObstacles,
            callbackScope: this,
            loop: true,
        });

        this.boxes = this.physics.add.group({
            // allowGravity: false,
        });

        this.physics.add.collider(this.player, this.platform);
        this.physics.add.collider(this.platform, this.boxes);
        this.physics.add.collider(this.boxes, this.boxes);
        this.physics.add.overlap(this.player, this.boxes, this.gameOverWithEffects, null, this);

        this.instructionText = this.add.bitmapText(this.width / 2, this.height / 3, 'pixelfont', 'Tap to Jump', 50).setOrigin(0.5, 0.5);
        this.instructionText.setScrollFactor(0).setDepth(11);

        this.lastLifeText = this.add.bitmapText(this.width / 2, this.height / 3, 'pixelfont', 'Last life!', 50).setOrigin(0.5, 0.5);
        this.lastLifeText.setScrollFactor(0).setAlpha(0).setDepth(11).setTint(0xff2f2f);
        this.input.keyboard.disableGlobalCapture();

    }

    update(time, delta) {
        // Adjust the background scroll speed so its effective movement matches the platform's speed.
        this.bg.tilePositionX += 2 / this.bg.tileScaleX;
        this.platform.tilePositionX += 2;
    
        if (this.player.body.touching.down) {
            this.player.setAngle(0);
            this.player.setAngularVelocity(0);
            if (this.stompEffect) {
                this.stompEffect = false;
                this.tweens.add({
                    targets: this.cameras.main,
                    y: this.cameras.main.worldView.y - 5, // Adjust value for desired intensity
                    duration: 50, // Adjust timing as needed
                    ease: 'Power1',
                    yoyo: true, // Automatically returns to starting position
                    repeat: 0 // Number of times to repeat the effect
                });
            }
        }
    }
    


    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(`Score: ${this.score}`);
    }

    gameOver() {
        initiateGameOver.bind(this)({ score: this.score });
    }

    pauseGame() {
        handlePauseGame.bind(this)();
    }

    jump() {
        if (this.player.body.touching.down) {
            this.sounds.jump.play();
            this.stompEffect = true;
            this.player.body.velocity.y = -650;
            this.player.setAngularVelocity(280);
            
            this.instructionText.setAlpha(0);
        }
    }

    addObstacles() {
        var boxesNeeded = Math.floor(Math.random() * 3);
        if (this.tileRate > 200) {
            this.tileRate -= 10;
            this.tileVelocity = -(5000000 / this.tileRate);
        }

        for (var i = 0; i < boxesNeeded; i++) {
            let xPosition = this.width + 100;
            let yPosition = (this.height - 100) - ((i + 1) * 80);
            this.addBox(xPosition, yPosition);
        }
    }

    addBox(x, y) {
        // Random chance: if less than 30% chance, spawn a 2x2 formation; otherwise, spawn a single obstacle.
        if (Phaser.Math.Between(0, 100) < 30) {
            // Manually set the x positions for the two columns.
            // You can adjust these values as desired.
            let colX = [x + 10, x + 60];  
            // Set a fixed vertical offset for the two rows.
            let offsetY = 30;
            
            // Spawn obstacles in a 2x2 formation.
            for (let row = 0; row < 2; row++) {
                for (let col = 0; col < 2; col++) {
                    let posX = colX[col];  // Use manually defined x coordinate
                    let posY = y + row * offsetY;
                    let box = this.boxes.getFirstDead(true, posX, posY, 'avoidable');
                    if (!box) {
                        box = this.boxes.create(posX, posY, 'avoidable');
                    }
                    box.body.setSize(box.width * 0.8, box.height * 0.8);
                    box.setScale(2 * 0.09);
                    box.body.velocity.x = this.tileVelocity / 10;
                    box.body.width *= 0.5;
                    box.checkWorldBounds = true;
                    box.outOfBoundsKill = true;
                }
            }
        } else {
            // Spawn a single obstacle (as before).
            let box = this.boxes.getFirstDead(true, x, y, 'avoidable');
            if (!box) {
                box = this.boxes.create(x, y, 'avoidable');
            }
            box.body.setSize(box.width * 0.8, box.height * 0.8);
            box.setScale(2 * 0.09);
            box.body.velocity.x = this.tileVelocity / 10;
            box.body.width *= 0.5;
            box.checkWorldBounds = true;
            box.outOfBoundsKill = true;
        }
    }
    

    gameOverWithEffects(player, boxes) {
        if (this.lives <= 0) {
            // Player is already dead, don't process further collisions
            return;
        }
        this.lives--;
        let heart = this.hearts[this.lives];
        this.tweens.add({
            targets: heart,
            y: heart.y + 50,  // Drop it down 50 pixels; adjust as desired.
            alpha: 0,         // Fade out to 0.
            duration: 500,    // Animation lasts 500ms.
            ease: 'Power1',
            onComplete: () => {
                heart.destroy();
            }
        });
        

        if (this.lives === 1) {
            this.sounds.countdown.play({ volume: 0.6 }); // Duration in milliseconds
            this.time.delayedCall(3000, () => {
                this.sounds.countdown.stop();
            });
            this.instructionText.setAlpha(0);
            this.vfx.blinkEffect(this.lastLifeText, 400, 3)
        }

        if (this.lives > 0) {
            this.sounds.damage.play();
            boxes.destroy();
            this.vfx.shakeCamera(200, 0.01);
        } else {
            this.sound.stopAll();
            this.sounds.lose.play();
            this.player.setTint(0xff0000);
            // Disable the player's physics body so it doesn't interfere with the drop
            this.player.body.enable = false;
            this.vfx.shakeCamera(300, 0.04);
            
            // Animate the player dropping below the ground.
            // Here, we move the player to y = this.height + this.player.height (below the bottom)
            this.tweens.add({
                targets: this.player,
                y: this.height + this.player.height,
                duration: 1000,
                ease: 'Linear',
                onComplete: () => {
                    this.gameOver();
                }
            });
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
            gravity: { y: 1000 },
            debug: false,
        },
    },
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions,
    },
    deviceOrientation: _CONFIG.deviceOrientation==="landscape"
};