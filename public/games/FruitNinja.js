class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.score = 0;
        this.lives = 3;
        this.fruits = [];
        this.splashes = []; // Track active splash effects
        this.isGameOver = false; // Renamed from this.gameOver
        this.sliceTimes = []; // Array to store timestamps of slices
        this.comboImage = null; // Track current combo image
        this.fruitTypes = [{
            name: 'watermelon',
            halfName: 'watermelon_half',
            juiceName: 'juice_red',
            scale: 0.15,
            points: 10,
            shortid: 'QosS',
            halfShortid: 'JVEe',
            juiceShortid: 'OF0j',
            splashImage: 'splash_red'
        }, {
            name: 'apple',
            halfName: 'apple_half',
            juiceName: 'juice_red',
            scale: 0.15,
            points: 15,
            shortid: 'f6Yz',
            halfShortid: 'io2N',
            juiceShortid: 'OF0j',
            splashImage: 'splash_white'
        }, {
            name: 'orange',
            halfName: 'orange_half',
            juiceName: 'juice_orange',
            scale: 0.2,
            points: 20,
            shortid: '0UYb',
            halfShortid: 'mAyh',
            juiceShortid: '1USA',
            splashImage: 'splash_orange'
        }, {
            name: 'pineapple',
            halfName: 'pineapple_half',
            juiceName: 'juice_yellow',
            scale: 0.12,
            points: 25,
            shortid: 'JODv',
            halfShortid: 'Qa5j',
            juiceShortid: 'qpqQ',
            splashImage: 'splash_white'
        }];
    }

    preload() {

        // this.isGameOver = false;

        addEventListenersPhaser.bind(this)();

        for (const key in _CONFIG.imageLoader) {
            try {
                console.log(`Attempting to load image: ${key} from ${_CONFIG.imageLoader[key]}`);
                this.load.image(key, _CONFIG.imageLoader[key]);
            } catch (error) {
                console.error(`Failed to load image: ${key}, ${error}`);
            }
        }
        

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/"
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        displayProgressLoader.call(this);

        // Load fruits
        this.load.image('watermelon', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/assets/images/watermelon.png?t=1743006857035');
        this.load.image('apple', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/assets/images/apple.png?t=1743006916895');
        this.load.image('orange', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/assets/images/orange.png?t=1743006960452');
        this.load.image('pineapple', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/assets/images/pineapple.png?t=1743006999938');

        // Load fruit halves
        this.load.image('watermelon_half', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/assets/images/watermelon_half.png?t=1743074383195');
        this.load.image('apple_half', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/assets/images/apple_half.png?t=1743074383076');
        this.load.image('orange_half', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/assets/images/orange_half.png?t=1743074382429');
        this.load.image('pineapple_half', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/assets/images/pineapple_half.png?t=1743074383242');

        // Load fruit splashes
        this.load.image('splash_red', 'https://aicade-ui-assets.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/history/iteration/HpyFcUemF4Xd.webp');
        this.load.image('splash_white', 'https://aicade-ui-assets.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/history/iteration/GgBguVUHedV0.webp');
        this.load.image('splash_orange', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/assets/images/orange_splash.png?t=1743356658935');

        // Load juice effects
        this.load.image('juice_red', 'https://play.rosebud.ai/assets/juice_red.png?OF0j');
        this.load.image('juice_orange', 'https://play.rosebud.ai/assets/juice_orange.png?1USA');
        this.load.image('juice_yellow', 'https://play.rosebud.ai/assets/juice_yellow.png?qpqQ');

        // Load other assets
        this.load.image('bomb', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/assets/images/Bomb_FNPIB.png?t=1743096817209');
        this.load.audio('bomb_blast', 'https://aicade-user-store.s3.amazonaws.com/GameAssets/music/explosion-47821_159cdab1-b536-448f-840e-ec7ca980987a.mp3?t=1743323514376');

        // Load background and effects
        this.load.image('background', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/assets/images/360_F_302312313_qbLQYom8uLPpthrty1KVHhrkI8WO0SEg.png?t=1743177010425');
        this.load.image('slice_trail', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/assets/images/slice_trail.png?t=1743356935488');
        this.load.image('heart', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/assets/images/x%20cross.png?t=1743356011821');
        this.load.image('2_fruits', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/assets/images/x2.png?t=1743322656371');
        this.load.image('3_fruits', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/assets/images/x3.png?t=1743322632815');
        this.load.image('4_fruits', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/assets/images/x4.png?t=1743322602044');

        // Audio
        this.load.audio('blade', 'https://aicade-user-store.s3.amazonaws.com/GameAssets/music/steel-blade-slice-1-188213_b39adf1f-a242-449b-a007-e0d4d2643f9c.mp3?t=1743319546494');
    }

    resizeAssets() {
        const baseWidth = 800;
        const baseHeight = 600;
        const scaleX = this.game.config.width / baseWidth;
        const scaleY = this.game.config.height / baseHeight;
        const scale = Math.min(scaleX, scaleY);

        // Resize background
        this.bg.setDisplaySize(this.game.config.width, this.game.config.height);

        // Resize UI elements
        this.scoreText.setFontSize(45 * scale);
        this.scoreText.setPosition(this.game.config.width / 2 - 200, 15 * scale);
        this.scoreText.setOrigin(0.5, 0);
        this.pauseButton.setScale(2 * scale);
        this.pauseButton.setPosition(this.game.config.width - 60 * scale, 60 * scale);

        this.clock.setPosition(0, 0); // Reset position (relative to graphics)
        this.clockHand.setPosition(0, 0);
        this.drawClock(); // Redraw clock at new scale

        // Resize hearts
        const heartSize = 20 * scale;
        const baseScale = 0.12; // Base scale factor
        this.hearts.forEach((heart, index) => {
            if (heart.active) {
                const sizeMultiplier = [1, 1.5, 2][index]; // 1x, 1.5x, 2x for hearts 0, 1, 2
                heart.setScale(scale * baseScale * sizeMultiplier);
                heart.setPosition(16 * scale + index * (heartSize + 20 * scale), 56 * scale);
            }
        });

        // Resize fruits and bombs
        this.fruits.forEach(fruit => {
            if (fruit.fruitType) {
                fruit.setScale(fruit.fruitType.scale * scale);
            } else if (fruit.isBomb) {
                fruit.setScale(0.2 * scale); // Scale bomb image consistently
            }
        });

        // Resize active splashes
        this.splashes.forEach(splash => {
            if (splash.active) {
                const fruitScale = splash.scale / 0.3; // Reverse-engineer base fruit scale
                splash.setScale(fruitScale * scale * 0.3); // Apply scaled size
            }
        });
    }

    create() {
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        this.sounds.background.setVolume(0.1).setLoop(true).play();

        this.vfx = new VFXLibrary(this)

        this.add.image(0, 0, 'background').setOrigin(0, 0).setDisplaySize(this.sys.game.config.width, this.sys.game.config.height);

        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.bg = this.add.sprite(0, 0, 'background').setOrigin(0, 0);
        this.bg.setScrollFactor(0);
        this.bg.displayHeight = this.game.config.height;
        this.bg.displayWidth = this.game.config.width;

        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());

        this.pauseButton = this.add.sprite(this.game.config.width - 60, 60, "pauseButton").setOrigin(0.5, 0.5).setDepth(1);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(3);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        // Score text
        this.scoreText = this.add.bitmapText(this.game.config.width / 2 - 200, 20, 'pixelfont', '0', 32);
        this.scoreText.setOrigin(0.5, 0); // Center horizontally, align top
        this.scoreText.setDepth(1); // Ensure it’s above other elements
        this.scoreText.setDropShadow(2, 2, 0x000000, 0.8); // Add a shadow for better contrast

        // Lives text
        this.hearts = [];
        const baseScale = 0.1; // Current size of first heart
        this.hearts.push(this.add.image(0, 0, 'heart').setScale(baseScale).setDepth(2)); // First heart (same size)
        this.hearts.push(this.add.image(0, 0, 'heart').setScale(baseScale * 1.5).setDepth(2)); // Second heart (50% bigger)
        this.hearts.push(this.add.image(0, 0, 'heart').setScale(baseScale * 2).setDepth(2)); // Third heart (100% bigger)

        // Trail effect for slice
        this.input.on('pointermove', (pointer) => {
            if (pointer.isDown) {
                const trail = this.add.image(pointer.x, pointer.y, 'slice_trail');
                trail.setScale(0.2);
                trail.setAlpha(0.8);
                trail.angle = Phaser.Math.Between(0, 360);

                this.tweens.add({
                    targets: trail,
                    alpha: 0,
                    scale: 0.1,
                    duration: 200,
                    onComplete: () => {
                        trail.destroy();
                    }
                });
            }
        });

        // Slice detection
        this.input.on('pointermove', (pointer) => {
            if (pointer.isDown) {
                this.fruits.forEach(fruit => {
                    if (!fruit.sliced && fruit.getBounds().contains(pointer.x, pointer.y)) {
                        this.sliceFruit(fruit);
                    }
                });
            }
        });

        this.spawnDelay = 1000; // Start with 1 second delay
        this.minSpawnDelay = 200; // Minimum delay (e.g., 0.2 seconds)

        // Spawn fruits periodically
        // Store the spawn timer event so we can destroy it later
        this.spawnTimer = this.time.addEvent({
            delay: 1000,
            callback: () => {
                if (!this.isGameOver) { // Use isGameOver
                    if (Phaser.Math.Between(1, 100) <= 15) {
                        this.spawnBomb();
                    } else {
                        this.spawnFruit();
                    }
                }
            },
            callbackScope: this,
            loop: true
        });

        this.time.addEvent({
            delay: 10000, // Adjust every 10 seconds
            callback: () => {
                if (!this.isGameOver && this.spawnDelay > this.minSpawnDelay) {
                    this.spawnDelay = Math.max(this.minSpawnDelay, this.spawnDelay - 100); // Decrease by 100 ms, cap at min
                    this.spawnTimer.delay = this.spawnDelay; // Update the spawn timer delay
                    // console.log(`Spawn delay reduced to: ${this.spawnDelay} ms`); // Debug log (optional)
                }
            },
            callbackScope: this,
            loop: true
        });

        // Clock UI
        this.totalTime = 60; // Total game time in seconds (adjust as needed)
        this.timeRemaining = this.totalTime; // Current time remaining

        // Clock graphics
        this.clockRadius = 30; // Radius of the clock
        this.clock = this.add.graphics({ x: 0, y: 0 }); // Graphics object for clock
        this.clockHand = this.add.graphics({ x: 0, y: 0 }); // Graphics object for clock hand

        // Initial clock draw (updated in resizeAssets)
        this.drawClock();

        // Timer event to update clock
        this.timerEvent = this.time.addEvent({
            delay: 1000, // Update every second
            callback: () => {
                this.timeRemaining--;
                this.updateClock();
                if (this.timeRemaining <= 0) {
                    this.gameOver();
                }
            },
            callbackScope: this,
            loop: true
        });

        this.resizeAssets();
        this.scale.on('resize', () => this.resizeAssets(), this);

        this.cursors = this.input.keyboard.createCursorKeys();
        this.input.keyboard.disableGlobalCapture();

    }

    drawClock() {
        this.clock.clear();
        this.clockHand.clear();

        const scale = Math.min(this.game.config.width / 800, this.game.config.height / 600);
        const centerX = this.game.config.width / 2;
        const centerY = 60 * scale;
        
        // Draw outer glow
        const glowSize = 5 * scale;
        this.clock.lineStyle(glowSize * scale, 0xFFFFFF, 0.3);
        this.clock.strokeCircle(centerX, centerY, (this.clockRadius + glowSize/2) * scale);
        
        // Draw fancy clock face
        // Dark outer circle
        this.clock.fillStyle(0x1A237E, 1); // Dark blue
        this.clock.fillCircle(centerX, centerY, this.clockRadius * scale);
        
        // Lighter inner circle for gradient effect
        this.clock.fillStyle(0x303F9F, 1); // Lighter blue
        this.clock.fillCircle(centerX - 5 * scale, centerY - 5 * scale, this.clockRadius * 0.7 * scale);
        
        // Add metallic border
        this.clock.lineStyle(3 * scale, 0xE0E0E0);
        this.clock.strokeCircle(centerX, centerY, this.clockRadius * scale);
        
        // Add inner ring
        this.clock.lineStyle(1 * scale, 0xFFFFFF, 0.6);
        this.clock.strokeCircle(centerX, centerY, (this.clockRadius - 3) * scale);
        
        // Add hour markers
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * (i / 12)) - (Math.PI / 2);
            const innerRadius = this.clockRadius * 0.8 * scale;
            const outerRadius = this.clockRadius * 0.95 * scale;
            
            this.clock.lineStyle(i % 3 === 0 ? 2 * scale : 1 * scale, 0xFFFFFF, 0.8);
            this.clock.beginPath();
            this.clock.moveTo(
                centerX + Math.cos(angle) * innerRadius,
                centerY + Math.sin(angle) * innerRadius
            );
            this.clock.lineTo(
                centerX + Math.cos(angle) * outerRadius,
                centerY + Math.sin(angle) * outerRadius
            );
            this.clock.strokePath();
        }
        
        // Add center dot
        this.clock.fillStyle(0xFFFFFF);
        this.clock.fillCircle(centerX, centerY, 2 * scale);
        
        // Draw initial clock hand (updated in updateClock)
        this.updateClock();
        
        // Add dynamic time text
        if (this.timeText) {
            this.timeText.destroy();
        }
        
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        const timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        
        this.timeText = this.add.text(
            centerX, 
            centerY + (this.clockRadius + 15) * scale,
            timeString,
            { 
                fontFamily: 'Arial',
                fontSize: 16 * scale,
                color: '#FFFFFF',
                stroke: '#000000',
                strokeThickness: 2 * scale
            }
        ).setOrigin(0.5);
    }

    updateClock() {
        this.clockHand.clear();

        const scale = Math.min(this.game.config.width / 800, this.game.config.height / 600);
        const centerX = this.game.config.width / 2;
        const centerY = 60 * scale;

        // Get percentage of time remaining
        const timePercent = this.timeRemaining / this.totalTime;
        
        // Change color based on remaining time
        let handColor;
        if (timePercent > 0.6) {
            handColor = 0x4CAF50; // Green when plenty of time
        } else if (timePercent > 0.3) {
            handColor = 0xFFC107; // Yellow/amber when time is getting low
        } else {
            handColor = 0xFF0000; // Red when time is critical
            
            // Use alpha for pulsing effect instead of color changes
            const pulseRate = 0.5 + Math.sin(this.time.now / 200) * 0.5;
            this.clockHand.alpha = 0.5 + pulseRate * 0.5;
        }

        // Calculate angle based on remaining time (0° at top, clockwise)
        const angle = (Math.PI * 2 * timePercent) - (Math.PI / 2);
        const handLength = this.clockRadius * 0.75 * scale;

        // Draw hand
        this.clockHand.lineStyle(2 * scale, handColor);
        this.clockHand.beginPath();
        this.clockHand.moveTo(centerX, centerY);
        this.clockHand.lineTo(
            centerX + Math.cos(angle) * handLength,
            centerY + Math.sin(angle) * handLength
        );
        this.clockHand.strokePath();
        
        // Add arrowhead to hand
        const arrowSize = 3 * scale;
        const arrowAngle1 = angle + Math.PI * 0.85;
        const arrowAngle2 = angle - Math.PI * 0.85;
        
        this.clockHand.beginPath();
        this.clockHand.moveTo(
            centerX + Math.cos(angle) * handLength,
            centerY + Math.sin(angle) * handLength
        );
        this.clockHand.lineTo(
            centerX + Math.cos(angle) * handLength + Math.cos(arrowAngle1) * arrowSize,
            centerY + Math.sin(angle) * handLength + Math.sin(arrowAngle1) * arrowSize
        );
        this.clockHand.lineTo(
            centerX + Math.cos(angle) * handLength + Math.cos(arrowAngle2) * arrowSize,
            centerY + Math.sin(angle) * handLength + Math.sin(arrowAngle2) * arrowSize
        );
        this.clockHand.closePath();
        this.clockHand.fillStyle(handColor);
        this.clockHand.fillPath();
        
        // Draw arc showing remaining time
        this.clock.lineStyle(3 * scale, handColor, 0.7);
        this.clock.beginPath();
        this.clock.arc(
            centerX, centerY,
            (this.clockRadius + 3) * scale,
            -Math.PI/2, // Start at top
            -Math.PI/2 + (Math.PI * 2 * timePercent), // End at current position
            false
        );
        this.clock.strokePath();
        
        // Update time text
        if (this.timeText) {
            const minutes = Math.floor(this.timeRemaining / 60);
            const seconds = this.timeRemaining % 60;
            const timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            this.timeText.setText(timeString);
        }
    }

    spawnFruit() {
        const groupSize = Phaser.Math.Between(1, 4); // Randomly spawn 2 or 3 fruits
        const baseX = Phaser.Math.Between(100, this.game.config.width - 100); // Base spawn X position
        const y = this.game.config.height + 50; // Start below screen
        const scale = Math.min(this.game.config.width / 800, this.game.config.height / 600);

        for (let i = 0; i < groupSize; i++) {
            const fruitType = this.fruitTypes[Phaser.Math.Between(0, this.fruitTypes.length - 1)];
            const xOffset = i * 30 * scale; // Offset each fruit horizontally (adjustable)
            const fruit = this.add.image(baseX + xOffset, y, fruitType.name);
            fruit.setScale(fruitType.scale * scale);

            this.physics.add.existing(fruit);
            const velocityX = Phaser.Math.Between(-200 * scale, 200 * scale) + (i * 50 * scale); // Vary X velocity slightly
            fruit.body.setVelocity(velocityX, -900 * scale); // Upward toss
            fruit.body.setGravityY(980 * scale); // Gravity pulls down

            fruit.fruitType = fruitType;
            fruit.sliced = false;
            this.fruits.push(fruit);

            this.time.addEvent({
                delay: 5000,
                callback: () => {
                    if (!fruit.sliced && this.fruits.includes(fruit)) {
                        this.fruits = this.fruits.filter(f => f !== fruit);
                        fruit.destroy();
                    }
                }
            });
        }

        // Optional: Chance to spawn a bomb with the group (e.g., 20% chance)
        if (Phaser.Math.Between(0, 100) < 20) {
            this.spawnBomb(baseX + (groupSize * 30 * scale), y);
        }
    }

    sliceFruit(fruit) {
        if (fruit.sliced || this.isGameOver) return;
        this.sound.play('blade');

        if (fruit.isBomb) {
            fruit.sliced = true; // Prevent multiple triggers
            this.isGameOver = true;
            // this.sound.play('bomb_blast');
            if (this.spawnTimer) {
                this.spawnTimer.destroy(); // Stop spawning
            }
            this.fruits.forEach(f => {
                if (f.body) {
                    f.body.setVelocity(0, 0); // Freeze all objects
                    f.body.setGravityY(0);
                }
            });
            // Use VFXLibrary for white rays
        this.vfx.addCircleTexture('whiteRay', 0xffffff, 1, 800); // Larger white circle texture, radius 30
        const emitter = this.vfx.createEmitter(
            'whiteRay',           // Texture key
            fruit.x,              // X position (bomb location)
            fruit.y,              // Y position (bomb location)
            0.5,                  // Scale start (larger particles)
            0.2,                  // Scale end (still shrink, but bigger)
            2000                  // Lifespan matches 2-second duration
        );

        // Emit a single burst to cover screen and end after 2 seconds
        // emitter.setSpeed({ min: 300, max: 600 }); // Faster particles to cover screen
        emitter.explode(800); // Burst 100 particles at once for full coverage

        // Stop particles and clean up after 2 seconds
        this.time.delayedCall(2000, () => {
            emitter.stop();       // Stop emitting
            emitter.destroy();    // Destroy the emitter itself
            // Start fade-to-white after rays
            this.cameras.main.fadeOut(3000, 255, 255, 255); // 3-second fade
        }, [], this);

        // Call gameOver after total 5 seconds (2s rays + 3s fade)
        this.time.delayedCall(5000, () => {
            this.gameOver();
        }, [], this);
        return;
    }

        fruit.sliced = true;

        // Splash Effect
        const splash = this.add.image(fruit.x, fruit.y, fruit.fruitType.splashImage);
        splash.setScale(fruit.fruitType.scale * 1.0); // Increase from 0.3 to 1.0 for visibility
        splash.setAlpha(0.8);
        splash.setDepth(10); // Ensure it’s above fruits and halves
        this.splashes.push(splash); // Add to tracking array
        console.log(`Splash added for ${fruit.fruitType.name} with texture: ${fruit.fruitType.splashImage}`); // Debug log
        this.tweens.add({
            targets: splash,
            alpha: 0,
            scale: fruit.fruitType.scale * 5, // Grow to 1.5x fruit scale
            duration: 2000,
            onComplete: () => {
                this.splashes = this.splashes.filter(s => s !== splash); // Remove from array
                splash.destroy();
            }
        });


        // Update score
        this.score += fruit.fruitType.points;
        this.scoreText.setText(this.score);

        const scale = Math.min(this.game.config.width / 800, this.game.config.height / 600);

        // Track slice time
        const currentTime = this.time.now;
        this.sliceTimes.push(currentTime);

        // Filter slices within the last 1 second
        this.sliceTimes = this.sliceTimes.filter(time => currentTime - time <= 1000);
        const comboCount = this.sliceTimes.length;

        // Display combo image if combo is 2, 3, or 4
        let comboImage = null; // Local variable to avoid reassignment issues
        const padding = 100 * scale; // Padding from edges
        const randomX = Phaser.Math.Between(padding, this.game.config.width - padding);
        const randomY = Phaser.Math.Between(padding, this.game.config.height - padding);
        if (comboCount === 2) {
            comboImage = this.add.image(randomX, randomY, '2_fruits');
        } else if (comboCount === 3) {
            comboImage = this.add.image(randomX, randomY, '3_fruits');
        } else if (comboCount === 4) {
            comboImage = this.add.image(randomX, randomY, '4_fruits');
        }

        if (comboImage) {
            comboImage.setScale(0.1 * scale);
            comboImage.setAngle(45);
            comboImage.setDepth(10);
            comboImage.setAlpha(1);
            this.tweens.add({
                targets: comboImage,
                alpha: 0,
                scale: 0.2 * scale,
                duration: 1000,
                onComplete: () => {
                    comboImage.destroy(); // Destroy the local reference
                }
            });
        }

        // Reset combo after 1 second from the first slice
        if (this.sliceTimes.length === 1) {
            this.time.delayedCall(1000, () => {
                this.sliceTimes = [];
            }, [], this);
        }
        
        const leftHalf = this.add.image(fruit.x - 10 * scale, fruit.y, fruit.fruitType.halfName);
        const rightHalf = this.add.image(fruit.x + 10 * scale, fruit.y, fruit.fruitType.halfName);

        leftHalf.setScale(fruit.fruitType.scale * scale);
        rightHalf.setScale(fruit.fruitType.scale * scale);

        this.physics.add.existing(leftHalf);
        this.physics.add.existing(rightHalf);

        leftHalf.body.setVelocity(-100 * scale, -200 * scale);
        rightHalf.body.setVelocity(100 * scale, -200 * scale);
        leftHalf.body.setGravityY(980 * scale);
        rightHalf.body.setGravityY(980 * scale);

        this.tweens.add({
            targets: leftHalf,
            angle: -180,
            duration: 1000
        });
        this.tweens.add({
            targets: rightHalf,
            angle: 180,
            duration: 1000
        });

        this.fruits = this.fruits.filter(f => f !== fruit);
        fruit.destroy();

        this.time.delayedCall(2000, () => {
            leftHalf.destroy();
            rightHalf.destroy();
        });
    }

    spawnBomb() {
        const x = Phaser.Math.Between(100, this.game.config.width - 100);
        const y = this.game.config.height + 50; // Start just below the screen
        const scale = Math.min(this.game.config.width / 800, this.game.config.height / 600);
        const bomb = this.add.image(x, y, 'bomb'); // Use the bomb image
        bomb.setScale(0.2 * scale); // Match fruit scale (e.g., watermelon scale is 0.15)

        this.physics.add.existing(bomb);
        bomb.body.setVelocity(Phaser.Math.Between(-200 * scale, 200 * scale), -800 * scale); // Move upward
        bomb.body.setGravityY(980 * scale); // Gravity pulls downward

        // Add properties
        bomb.sliced = false;
        bomb.isBomb = true;
        this.fruits.push(bomb);

        // Remove bomb if it hasn't been sliced after a timeout
        this.time.addEvent({
            delay: 5000,
            callback: () => {
                if (!bomb.sliced) {
                    this.fruits = this.fruits.filter(f => f !== bomb);
                    bomb.destroy();
                }
            }
        });
    }

    gameOver() {
        if (this.timerEvent) {
            this.timerEvent.remove();
        }
        this.sounds.background.stop();
        initiateGameOver.bind(this)({
            score: this.score
        });
    }

    // endGame() {
    //     this.gameOver();
    // }

    update() {
        if (!this.isGameOver) {
            this.fruits = this.fruits.filter(fruit => {
                if (fruit.y > this.game.config.height + 50 && !fruit.sliced) {
                    if (!fruit.isBomb) {
                        this.lives = Math.max(0, this.lives - 1);
                        if (this.hearts.length > 0) {
                            const heart = this.hearts.pop();
                            heart.destroy();
                        }
                        if (this.lives <= 0) {
                            this.isGameOver = true; // Stop gameplay
                            if (this.spawnTimer) {
                                this.spawnTimer.destroy(); // Stop spawning
                            }
                            this.fruits.forEach(f => {
                                if (f.body) {
                                    f.body.setVelocity(0, 0); // Freeze all objects
                                    f.body.setGravityY(0);
                                }
                            });
                            this.gameOver(); // Call gameOver immediately
                        }
                    }
                    fruit.destroy();
                    return false;
                }
                return true;
            });
        }
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
    deviceOrientation: _CONFIG.deviceOrientation==="landscape"
};