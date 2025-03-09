var difficulty = 1;
var difficultyDelay = 5000;
var spawnTimeDelay = 1000 * difficulty;
var bombTimeDelay = 2000 * difficulty;
var timerTimeDelay = 2500 * difficulty;
const startDelay = 4000;

// Enhanced orientation handling
const orientationSizes = {
    "landscape": {
        "width": 1280,
        "height": 720,
    },
    "portrait": {
        "width": 720,
        "height": 1280,
    }
};

// Helper function to scale UI elements based on device orientation
function getScaleFactor(scene) {
    const isPortrait = scene.game.config.height > scene.game.config.width;
    const baseWidth = isPortrait ? 720 : 1280;
    const baseHeight = isPortrait ? 1280 : 720;
    
    // Calculate scale based on current game dimensions vs base dimensions
    const widthScale = scene.game.config.width / baseWidth;
    const heightScale = scene.game.config.height / baseHeight;
    
    // Use the smaller of the two to ensure everything fits
    return Math.min(widthScale, heightScale);
}

// Utility function to position elements proportionally
function positionElement(scene, xPercent, yPercent) {
    return {
        x: scene.game.config.width * xPercent,
        y: scene.game.config.height * yPercent
    };
}

class SliceEffect {
    constructor(scene) {
        // slicing lines
        this.scene = scene;
        this.lines = []; // For the slice lines
        this.maxLifetime = 300; // Increased lifetime for better visibility
        this.lastX = null; // Track last position for continuous line
        this.lastY = null;
        this.lineHistory = []; // Store recent points to create a trail
        this.maxHistoryLength = 10; // Maximum number of points to store
        
        // Create particle emitter for the slice effect
        this.emitter = scene.add.particles('collectible', {
            speed: 50,
            scale: { start: 0.05 * scene.scaleFactor, end: 0 },
            alpha: { start: 0.8, end: 0 },
            lifespan: 300,
            blendMode: 'ADD',
            tint: 0xFFFFFF,
            frequency: -1 // Manual emission
        });
    }

    addSlice(x1, y1, x2, y2) {
        // Scale line thickness based on device
        const scale = getScaleFactor(this.scene);
        const lineWidth = Math.max(3, Math.floor(5 * scale));

        // Check for valid coordinates - sometimes touch events can return NaN or undefined
        if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
            return;
        }
        
        // If this is a continuation of a previous slice, use the last point as the start
        if (this.lastX !== null && this.lastY !== null) {
            // Calculate distance to previous point - if too large, treat as new slice
            const distToPrev = Phaser.Math.Distance.Between(this.lastX, this.lastY, x2, y2);
            if (distToPrev < 100) { // Only connect if reasonably close
                x1 = this.lastX;
                y1 = this.lastY;
            }
        }
        
        // Save current end position for next slice segment
        this.lastX = x2;
        this.lastY = y2;
        
        // Add to line history
        this.lineHistory.push({x: x2, y: y2, time: this.scene.time.now});
        if (this.lineHistory.length > this.maxHistoryLength) {
            this.lineHistory.shift();
        }
        
        // Create a graphics object for the line
        let graphics = this.scene.add.graphics({ 
            lineStyle: { 
                width: lineWidth, 
                color: 0xffffff,
                alpha: 0.8
            } 
        });
        
        // Draw the line
        graphics.strokeLineShape(new Phaser.Geom.Line(x1, y1, x2, y2));
        
        // Add glow effect
        let glowGraphics = this.scene.add.graphics({
            lineStyle: {
                width: lineWidth + 4,
                color: 0x00ffff,
                alpha: 0.3
            }
        });
        glowGraphics.strokeLineShape(new Phaser.Geom.Line(x1, y1, x2, y2));
        
        // Store the line with its creation time
        this.lines.push({ 
            graphics, 
            glowGraphics,
            createdAt: this.scene.time.now,
            alpha: 1.0
        });

        // Create particles along the line
        this.createParticlesAlongLine(x1, y1, x2, y2);

        // Play slice sound with randomized pitch for variety (if frequent slices)
        if (this.scene.sounds && this.scene.sounds.slice && Math.random() < 0.3) {
            this.scene.sounds.slice.setVolume(0.15).setRate(0.8 + Math.random() * 0.4).play();
        }

        // Destroy old lines
        this.scene.time.delayedCall(this.maxLifetime, () => {
            if (graphics && graphics.active) {
                graphics.clear();
                graphics.destroy();
            }
            if (glowGraphics && glowGraphics.active) {
                glowGraphics.clear();
                glowGraphics.destroy();
            }
        }, [], this);
    }

    createParticlesAlongLine(x1, y1, x2, y2) {
        // Calculate distance between points
        const distance = Phaser.Math.Distance.Between(x1, y1, x2, y2);
        
        // If points are too close, just emit at one position
        if (distance < 5) {
            this.emitter.emitParticleAt(x1, y1, 2);
            return;
        }
        
        // Calculate how many particles to emit based on distance
        const particleCount = Math.max(3, Math.ceil(distance / 10));
        
        // Emit particles along the line
        for (let i = 0; i < particleCount; i++) {
            const t = i / particleCount;
            const x = Phaser.Math.Linear(x1, x2, t);
            const y = Phaser.Math.Linear(y1, y2, t);
            
            // Add some random offset for more natural look
            const offsetX = (Math.random() - 0.5) * 5;
            const offsetY = (Math.random() - 0.5) * 5;
            
            this.emitter.emitParticleAt(x + offsetX, y + offsetY, 1);
        }
    }

    // Reset the slice (call this when pointer is released)
    resetSlice() {
        this.lastX = null;
        this.lastY = null;
        this.lineHistory = [];
    }

    update() {
        // Fade out existing lines for a smoother disappearance
        const currentTime = this.scene.time.now;
        
        for (let i = this.lines.length - 1; i >= 0; i--) {
            const line = this.lines[i];
            const elapsed = currentTime - line.createdAt;
            
            if (elapsed < this.maxLifetime) {
                // Calculate fade out
                const newAlpha = Phaser.Math.Linear(0.8, 0, elapsed / this.maxLifetime);
                if (line.graphics && line.graphics.active) {
                    line.graphics.alpha = newAlpha;
                }
                if (line.glowGraphics && line.glowGraphics.active) {
                    line.glowGraphics.alpha = newAlpha * 0.5;
                }
            } else {
                // Remove from array if past lifetime
                this.lines.splice(i, 1);
            }
        }
        
        // Clean up old history points
        const cutoffTime = currentTime - this.maxLifetime;
        this.lineHistory = this.lineHistory.filter(point => point.time > cutoffTime);
    }
    
    // Draw the entire trail (alternative approach)
    drawTrail() {
        if (this.lineHistory.length < 2) return;
        
        const scale = getScaleFactor(this.scene);
        const lineWidth = Math.max(3, Math.floor(5 * scale));
        
        // Create graphics for the trail
        let trailGraphics = this.scene.add.graphics({ 
            lineStyle: { 
                width: lineWidth, 
                color: 0xffffff,
                alpha: 0.8
            } 
        });
        
        // Begin path
        trailGraphics.beginPath();
        trailGraphics.moveTo(this.lineHistory[0].x, this.lineHistory[0].y);
        
        // Draw line through all points
        for (let i = 1; i < this.lineHistory.length; i++) {
            trailGraphics.lineTo(this.lineHistory[i].x, this.lineHistory[i].y);
        }
        
        // Stroke the path
        trailGraphics.strokePath();
        
        // Add the trail to lines for cleanup
        this.lines.push({
            graphics: trailGraphics,
            glowGraphics: null,
            createdAt: this.scene.time.now,
            alpha: 1.0
        });
    }
}
function detectDeviceAndOrientation() {
    // Check if the device is mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Set orientation based on device type
    if (isMobile) {
        return "portrait";
    } else {
        return "landscape";
    }
}

// Set the device orientation in the config
_CONFIG.deviceOrientation = detectDeviceAndOrientation();
// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.score = 0;
        this.timerText = null; // Text object to display the timer
        this.timeLeft = 25; // Time in seconds given to answer each question
        this.timerEvent = null; // Phaser timer event
    }

    preload() {
        difficulty = 1;
        
        addEventListenersPhaser.bind(this)();

        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }

        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
        this.load.image("newAsset_4","https://aicade-ui-assets.s3.amazonaws.com/6994335331/games/5EcOUaGOzDpaqm0s/history/iteration/DtMfxFkl1c52.webp");

        this.load.bitmapFont('pixelfont',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.png',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.xml');
        displayProgressLoader.call(this);
    }

    create() {
        this.timeLeft = 25;
        this.cam = this.cameras.main;
        this.width = this.game.config.width;
        this.height = this.game.config.height;
        
        // Detect current orientation based on actual dimensions
        this.isPortrait = this.height > this.width;
        
        // Update physics based on orientation
        this.physics.world.gravity.y = this.isPortrait ? 250 : 200;
        
        this.scaleFactor = getScaleFactor(this);
        
        // Setup sounds
        this.setupSounds();
        
        // Setup particle effects
        this.setupParticleEffects();
        
        this.pointerDown = false;
        this.gameSceneBackground();
        this.gameOverFlag = false;
    
        // Create UI elements based on orientation
        this.createUIElements();
    
        // Add input listeners
        this.setupInputListeners();

        this.score = 0;
        this.fruits = this.physics.add.group({});
        this.timer = this.physics.add.group({});
        this.bombs = this.physics.add.group({});

        // Position and scale center text based on orientation
        const centerPos = positionElement(this, 0.5, 0.5);
        const centerTextSize = this.isPortrait ? 60 : 70;
        this.centerText = this.add.bitmapText(centerPos.x, centerPos.y, 'pixelfont', '', centerTextSize)
            .setOrigin(0.5, 0.5)
            .setVisible(true)
            .setDepth(100);

        this.sliceEffect = new SliceEffect(this);

        this.setupGameStart();
        
        // Set initial spawn timings
        spawnTimeDelay = this.time.now + (2500 * difficulty);
        bombTimeDelay = this.time.now + (3000 * difficulty);
        timerTimeDelay = this.time.now + (4000 * difficulty);
        this.scale.on('resize', this.handleResize, this);
    }
    handleResize(gameSize) {
        // Get new dimensions
        this.width = gameSize.width;
        this.height = gameSize.height;
        
        // Update orientation flag
        const wasPortrait = this.isPortrait;
        this.isPortrait = this.height > this.width;
        
        // Only recreate UI if orientation actually changed
        if (wasPortrait !== this.isPortrait) {
            // Update physics
            if (this.physics && this.physics.world) {
                this.physics.world.gravity.y = this.isPortrait ? 250 : 200;
            }
            
            // Update scale factor
            this.scaleFactor = getScaleFactor(this);
            
            // Clear existing UI elements
            if (this.scoreText) this.scoreText.destroy();
            if (this.timerText) this.timerText.destroy();
            if (this.instructionText) this.instructionText.destroy();
            
            // Recreate UI
            this.createUIElements();
        }
    }
    
    setupSounds() {
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }
        this.sounds.background.setVolume(1).setLoop(true).play();
    }
    
    setupParticleEffects() {
        this.explosionEmitter = this.add.particles('avoidable', {
            speed: 150,
            scale: { start: 0.025 * this.scaleFactor, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 5000,
            on: false
        });
    }
    
    createUIElements() {
        // Position elements based on detected orientation
        let scoreIconScale, scoreTextSize, timerTextSize, instructionTextSize;
        let scoreIconX, scoreIconY, scoreTextX, scoreTextY, timerTextX, timerTextY;
        let pauseButtonX, pauseButtonY, pauseButtonScale;
        
        if (this.isPortrait) {
            // Portrait mode positions (relative to screen)
            scoreIconScale = 0.22;
            scoreTextSize = 35;
            timerTextSize = 24;
            instructionTextSize = 20;
            
            // Move score to right side in portrait
            scoreIconX = this.width/2;
            scoreIconY = this.height * 0.05;
            scoreTextX = this.width/2 + 30;
            scoreTextY = this.height * 0.05 - 15;
            
            // Position timer at top left corner
            timerTextX = this.width * 0.05;
            timerTextY = this.height * 0.05;
            
            pauseButtonX = this.width * 0.85;
            pauseButtonY = this.height * 0.05;
            pauseButtonScale = 1.8;
        } else {
            // Landscape mode positions (original)
            scoreIconScale = 0.25;
            scoreTextSize = 40;
            timerTextSize = 28;
            instructionTextSize = 25;
            
            scoreIconX = this.width / 2 - 70;
            scoreIconY = 55;
            scoreTextX = this.width / 2 - 40;
            scoreTextY = 15;
            
            timerTextX = 50;
            timerTextY = 30;
            
            pauseButtonX = this.width * 0.9;
            pauseButtonY = this.height * 0.1;
            pauseButtonScale = 2;
        }
        
        // Create UI elements with appropriate scaling
        let fruitLabel = this.add.sprite(scoreIconX, scoreIconY, 'collectible').setScale(scoreIconScale);
        this.scoreText = this.add.bitmapText(scoreTextX, scoreTextY, 'pixelfont', 'x 0', scoreTextSize);
        this.scoreText.setTint(0xff9900).setDepth(11);
        
        this.timerText = this.add.bitmapText(timerTextX, timerTextY, 'pixelfont', `Time left : ${this.timeLeft}s`, timerTextSize).setTint(0xffffff);
        
        // Instruction text - centered regardless of orientation
        this.instructionText = this.add.bitmapText(
            this.width * 0.5, 
            this.height * 0.3, 
            'pixelfont', 
            `BEST OF LUCK SCORING IN ${this.timeLeft} SECONDS`, 
            instructionTextSize
        ).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(11).setTint(0xabe810);
        
        // Pause button
        const pauseButton = this.add.sprite(pauseButtonX, pauseButtonY, "pauseButton")
            .setOrigin(0.5, 0.5)
            .setScale(pauseButtonScale);
        pauseButton.setInteractive({ cursor: 'pointer' });
        pauseButton.on('pointerdown', () => this.pauseGame());
    }
    
    setupInputListeners() {
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        
        // Track previous pointer position for more accurate slicing
        this.prevPointerX = 0;
        this.prevPointerY = 0;
        
        this.input.on("pointerdown", (pointer) => {
            this.preScore = this.score;
            this.pointerDown = true;
            this.prevPointerX = pointer.x;
            this.prevPointerY = pointer.y;
            
            // Reset the slice effect when starting a new slice
            this.sliceEffect.resetSlice();
        });
        
        this.input.on("pointermove", (pointer) => {
            if (this.pointerDown) {
                // Only create a slice if there's enough movement
                const minDistance = 5;
                const distance = Phaser.Math.Distance.Between(
                    this.prevPointerX, this.prevPointerY, pointer.x, pointer.y
                );
                
                if (distance >= minDistance) {
                    this.sliceEffect.addSlice(
                        this.prevPointerX, this.prevPointerY, 
                        pointer.x, pointer.y
                    );
                    
                    this.prevPointerX = pointer.x;
                    this.prevPointerY = pointer.y;
                }
            }
        });
        
        this.input.on("pointerup", () => {
            this.postScore = this.score;
            const combo = this.postScore - this.preScore;
            if (combo > 1 && !this.gameOverFlag) {
                this.centerText.setText("COMBO x" + (this.postScore - this.preScore).toString());
                this.centerText.setVisible(true);
                this.time.delayedCall(500, () => {
                    this.centerText.setVisible(false);
                });
            }
            this.pointerDown = false;
            
            // Reset the slice effect when ending a slice
            this.sliceEffect.resetSlice();
        });
        
        this.input.keyboard.disableGlobalCapture();
    }
    
    setupGameStart() {
        this.startDelayTimer = this.time.delayedCall(startDelay - 2000, () => {
            this.instructionText.setAlpha(0);
            this.startTimer();
        });
    }
    
    update() {
        if (this.gameOverFlag) return;
        
        if (this.pointerDown) {
            this.sliceEffect.addSlice(this.input.x, this.input.y, this.input.activePointer.prevPosition.x, this.input.activePointer.prevPosition.y);
        }
        
        // Handle spawning objects with appropriate timing
        this.sliceEffect.update();
    
    // Handle spawning objects with appropriate timing
    const currentTime = this.time.now;
    if (currentTime > spawnTimeDelay && currentTime > startDelay) {
        this.spawnFruit();
        spawnTimeDelay = currentTime + (2500 * difficulty);
    }

    if (currentTime > bombTimeDelay && currentTime > startDelay) {
        this.spawnBomb();
        bombTimeDelay = currentTime + (3000 * difficulty);
    }

    if (currentTime > timerTimeDelay && currentTime > startDelay) {
        this.spawnTimer();
        timerTimeDelay = currentTime + (4000 * (difficulty - 0.08));
    }

    // Gradually decrease difficulty
    if (currentTime > difficultyDelay && difficulty > 0.1) {
        difficulty -= 0.05;
        difficultyDelay = currentTime + 10000;
    }
    }

    createParticles(x, y, type = "collectible") {
        // Scale particles based on detected orientation
        const particleScale = this.isPortrait ? 0.022 : 0.025;
        
        const emitter = this.add.particles(x, y, type, {
            speed: 100,
            scale: { start: particleScale * this.scaleFactor, end: 0 },
            blendMode: 'ADD',
            lifespan: 400,
            on: false
        });

        emitter.explode(20);
        this.time.delayedCall(1000, () => {
            emitter.destroy();
        });
    }

    startTimer() {
        this.timerEvent = this.time.addEvent({
            delay: 1000, // 1 second
            callback: this.updateTimer,
            callbackScope: this,
            loop: true
        });
    }
    
    updateTimer() {
        this.timeLeft--;
        this.timerText.setText(`Time left: ${this.timeLeft}s`);

        if (this.timeLeft <= 0) {
            this.gameOver();
        }
    }

    addTimer() {
        this.timeLeft = this.timeLeft + 2;
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(`x ${this.score}`);
    }

    gameOver() {
        initiateGameOver.bind(this)({
            "score": this.score,
            "Time left": this.timeLeft,
        });
    }

    pauseGame() {
        handlePauseGame.bind(this)();
    }
    
    gameSceneBackground() {
        let bg = this.add.image(this.width / 2, this.height / 2, "background").setOrigin(0.5);

        // Scale differently based on orientation
        const scale = Math.max(this.width / bg.displayWidth, this.height / bg.displayHeight);
        bg.setScale(scale);
    }

    cutFruit(fruit) {
        if (!this.pointerDown) return;
        this.sounds.slice.setVolume(0.3).play();
        this.createParticles(fruit.x, fruit.y);
        fruit.setAlpha(0);
        this.time.delayedCall(500, () => {
            this.fruits.remove(fruit, true, true);
        });
        this.updateScore(1);
    }

    cutBomb(bomb) {
        if (this.pointerDown) {
            this.centerText.alpha = 0;
            this.gameOverFlag = true;
            this.timerEvent.destroy();
            this.physics.pause();
            this.cam.shake(100, 0.1);
            this.sounds.background.pause();

            this.time.delayedCall(500, () => {
                this.cam.flash(200);
                this.sounds.destroy.setVolume(0.3).play();
                this.createParticles(bomb.x, bomb.y, "avoidable");
                bomb.setAlpha(0);
                this.bombs.remove(bomb, true, true);
                this.time.delayedCall(2000, () => {
                    this.gameOver();
                });
            });
        }
    }

    cutTimer(timer) {
        if (!this.pointerDown) return;
        this.sounds.slice.play();
        this.createParticles(timer.x, timer.y, "newAsset_4");
        timer.setAlpha(0);
        this.time.delayedCall(100, () => {
            this.timer.remove(timer, true, true);
        });
        this.addTimer();
        this.centerText.setText("Time + 2");
        this.centerText.setVisible(true);
        this.time.delayedCall(500, () => {
            this.centerText.setVisible(false);
        });
    }

    // Spawn methods with orientation-based adjustments
    spawnFruit() {
        // Adjust spawn count and velocity based on detected orientation
        const spawnCount = Phaser.Math.Between(2, this.isPortrait ? 4 : 5);
        const yVelocityMin = this.isPortrait ? -500 : -350;
        const yVelocityMax = this.isPortrait ? -650 : -500;
        
        for (var i = 0; i < spawnCount; i++) {
            const fruit = this.fruits.create(
                Phaser.Math.Between(150, this.width - 150), 
                this.height, 
                'collectible'
            );
            
            // Scale based on orientation
            fruit.setScale(0.25 * this.scaleFactor);
            fruit.setVelocity(
                Phaser.Math.Between(-100, 100),
                Phaser.Math.Between(yVelocityMin, yVelocityMax)
            );
            fruit.setAngularVelocity(Phaser.Math.Between(-200, 200));

            fruit.setInteractive();
            fruit.on("pointerover", function(pointer) {
                this.cutFruit(fruit);
            }, this);
        }
    }

    spawnBomb() {
        // Adjust velocity based on detected orientation
        const yVelocityMin = this.isPortrait ? -500 : -350;
        const yVelocityMax = this.isPortrait ? -650 : -500;
        
        const bomb = this.bombs.create(
            Phaser.Math.Between(150, this.width - 150), 
            this.height, 
            'avoidable'
        );
        
        // Scale based on orientation
        bomb.setScale(0.25 * this.scaleFactor);
        bomb.setVelocity(
            Phaser.Math.Between(-100, 100),
            Phaser.Math.Between(yVelocityMin, yVelocityMax)
        );
        bomb.setAngularVelocity(Phaser.Math.Between(-200, 200));

        bomb.setInteractive();
        bomb.on("pointerover", function(pointer) {
            this.cutBomb(bomb);
        }, this);
    }

    spawnTimer() {
        // Adjust velocity based on detected orientation
        const yVelocityMin = this.isPortrait ? -500 : -350;
        const yVelocityMax = this.isPortrait ? -650 : -500;
        
        const timer = this.timer.create(
            Phaser.Math.Between(150, this.width - 150), 
            this.height, 
            'newAsset_4'
        );
        
        // Scale based on orientation
        timer.setScale(0.25 * this.scaleFactor);
        timer.setVelocity(
            Phaser.Math.Between(-200, 200),
            Phaser.Math.Between(yVelocityMin, yVelocityMax)
        );
        timer.setAngularVelocity(Phaser.Math.Between(-300, 300));

        timer.setInteractive();
        timer.on("pointerover", function(pointer) {
            this.cutTimer(timer);
        }, this);
    }
}

// Modified loader to be orientation aware
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

// Updated configuration object with responsive handling
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
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: _CONFIG.deviceOrientation === "portrait" ? 250 : 200 }, // Adjust gravity based on orientation
            debug: false,
        },
    },
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions,
    }
};
