// Game constants
const gameConstants = {
    dropSpeed: 900,       // Keep original drop speed
    pipeWidth: 120,       // Keep original pipe width
    jumpDistance: 20,     // Keep original jump distance
    pipeGap: 400,         // Initial pipe gap - will decrease as score increases
    pipeMovingSpeed: 400, // Initial pipe moving speed - will increase as score increases
    pipeSpawnTime: 100,   // Initial pipe spawn time - will decrease as score increases
    minPipeGap: 200,      // Minimum gap between pipes (difficulty cap)
    maxPipeSpeed: 600,    // Maximum pipe speed (difficulty cap)
    minPipeSpawnTime: 70, // Minimum spawn time (difficulty cap)
    
    // Difficulty progression
    difficultyRate: 0.05, // How quickly difficulty increases (lower for slower progression)
    
    // Refined physics parameters for smoother flapping
    gravity: 2000,        // Slightly reduced gravity pull for smoother fall
    flapForce: -450,      // More consistent upward force
    flapDuration: 10,     // Longer flap effect duration for smoother transition
    maxFallSpeed: 700,    // Slightly reduced maximum falling speed
    rotationSpeed: 2,     // Slower rotation for smoother turning
    
    // Animation parameters
    wingFlapSpeed: 100,   // Milliseconds between wing animation frames
    smoothTransition: 0.1, // Easing factor for smoother motion transitions
    
    // Background scrolling
    backgroundScrollSpeed: 0.5 // Background scrolls slower than foreground for parallax effect
};

// Preload function for GameScene - keeping original
function gameScenePreload(scene) {
    for (const key in _CONFIG.imageLoader) {
        scene.load.image(key, _CONFIG.imageLoader[key]);
    }

    for (const key in _CONFIG.soundsLoader) {
        scene.load.audio(key, _CONFIG.soundsLoader[key]);
    }

    scene.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
    scene.load.image("pillar", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/textures/Bricks/s2+Brick+01+Grey.png");
    
    // Add spritesheet for wing animation (if available)
    if (_CONFIG.imageLoader.playerSpritesheet) {
        scene.load.spritesheet('birdSprite', _CONFIG.imageLoader.playerSpritesheet, { 
            frameWidth: 92, 
            frameHeight: 64 
        });
    }

    const fontName = 'pix';
    const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/";
    scene.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

    scene.load.on('loaderror', (file) => {
        console.error('Error loading asset:', file.key);
    });
}

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        gameScenePreload(this);
        displayProgressLoader.call(this);
        addEventListenersPhaser.bind(this)();
    }

    create() {
        // Set initial game state to "waiting for first click"
        this.gameStarted = false;
        
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            if (this.cache.audio.exists(key)) {
                this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
            } else {
                console.warn(`Audio ${key} not found in cache`);
            }
        }

        if (this.sounds.background) {
            this.sounds.background.setVolume(0.3).setLoop(true).play();
        }

        this.vfx = new VFXLibrary(this);

        this.score = -1;
        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.gameActive = true;

        Object.assign(this, gameConstants);
        
        // Store initial difficulty settings to calculate progressive difficulty
        this.initialPipeGap = this.pipeGap;
        this.initialPipeSpeed = this.pipeMovingSpeed;
        this.initialPipeSpawnTime = this.pipeSpawnTime;

        // Setup scrolling background with parallax effect
        this.setupScrollingBackground();

        // Create a "Tap to Start" text
        this.startText = this.add.bitmapText(this.width / 2, this.height / 2, 'pixelfont', 'TAP TO START', 64).setOrigin(0.5, 0.5);
        this.startText.setDepth(30);

        this.scoreText = this.add.bitmapText(this.width / 2, 100, 'pixelfont', '0', 128).setOrigin(0.5, 0.5);
        this.scoreText.setDepth(20);
        this.scoreText.setVisible(false); // Hide score until game starts

        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());

        if (this.textures.exists('pauseButton')) {
            this.pauseButton = this.add.sprite(this.width - 60, 60, "pauseButton").setOrigin(0.5, 0.5);
            this.pauseButton.setInteractive({ cursor: 'pointer' });
            this.pauseButton.setScale(3).setDepth(20);
            this.pauseButton.on('pointerdown', () => this.pauseGame());
        } else {
            console.warn('Pause button image not found');
        }

        // Setup physics but don't enable gravity yet
        this.physics.world.gravity.y = 0; // No gravity until game starts
        
        this.pipesGroup = this.physics.add.group();

        // Create scrolling ground platforms
        this.groundGroup = this.physics.add.group();
        
        if (this.textures.exists('platform')) {
            // Create multiple ground segments for seamless scrolling
            const groundSegmentWidth = this.width / 2;
            
            // Create enough platforms to cover screen width + one extra for scrolling
            for (let i = 0; i <= this.width / groundSegmentWidth + 1; i++) {
                const groundSegment = this.groundGroup.create(
                    i * groundSegmentWidth, 
                    this.height, 
                    "platform"
                );
                groundSegment.displayHeight = 50;
                groundSegment.displayWidth = groundSegmentWidth;
                groundSegment.setOrigin(0, 1)
                              .setImmovable(true)
                              .setDepth(10);
                groundSegment.body.allowGravity = false;
            }
        } else {
            console.warn('Platform image not found');
        }

        this.upButton = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        this.framesMoveUp = 0;
        this.nextPipes = 0;
        this.isTapping = false;
        this.flapVelocity = 0;
        this.isFlapping = false;
        this.lastFlapTime = 0;

        // Create player with animation if spritesheet exists
        if (this.textures.exists('birdSprite')) {
            this.player = this.physics.add.sprite(80, this.height / 2, "birdSprite");
            
            // Create flapping animation
            this.anims.create({
                key: 'flap',
                frames: this.anims.generateFrameNumbers('birdSprite', { start: 0, end: 2 }),
                frameRate: 15,
                repeat: -1
            });
            
            this.player.play('flap');
        } else if (this.textures.exists('player')) {
            this.player = this.physics.add.sprite(80, this.height / 2, "player");
        } else {
            console.warn('Player image not found');
        }
        
        if (this.player) {
            this.player.setCollideWorldBounds(true).setScale(0.15);
            this.player.body.setSize(this.player.body.width / 1.5, this.player.body.height / 1.5);
            
            // Add air physics with less drag for smoother movement
            this.player.body.setDrag(10, 0);
            
            // Set maximum fall speed
            this.player.body.setMaxVelocityY(this.maxFallSpeed);
            
            // For the initial straight flight
            this.player.body.allowGravity = false;
            
            // Add subtle hover effect before game starts
            this.tweens.add({
                targets: this.player,
                y: this.player.y - 15,
                duration: 1000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            
            // Create trail emitter for visual smoothness
            this.createTrailEffect();
        }

        if (this.player && this.groundGroup) {
            this.physics.add.collider(this.player, this.groundGroup, this.hitBird, null, this);
        }
        if (this.player && this.pipesGroup) {
            this.physics.add.collider(this.player, this.pipesGroup, this.hitBird, null, this);
        }

        // Add the first-click event handler
        this.input.on('pointerdown', this.handleFirstClick, this);

        this.input.keyboard.disableGlobalCapture();
    }

    // Handle the first click to start the game
    handleFirstClick() {
        if (!this.gameStarted) {
            // Start the game
            this.gameStarted = true;
            
            // Remove the event listener
            this.input.off('pointerdown', this.handleFirstClick, this);
            
            // Set up the flapping event for actual gameplay
            this.input.on('pointerdown', () => this.flapWings());
            
            // Hide the start text
            this.startText.setVisible(false);
            
            // Show the score
            this.scoreText.setVisible(true);
            
            // Enable gravity
            this.physics.world.gravity.y = this.gravity;
            this.player.body.allowGravity = true;
            
            // Stop the hover animation
            this.tweens.killTweensOf(this.player);
            
            // Start with a flap
            this.flapWings();
            
            // Start pipe spawning
            this.nextPipes = 0;
            
            // Update score to 0 (from initial -1)
            this.updateScore(1);
        }
    }

    // New method to setup scrolling background
    setupScrollingBackground() {
        if (this.textures.exists('background')) {
            // Create multiple background panels for seamless scrolling
            this.backgroundGroup = [];
            
            // Calculate how many background images we need to cover the screen width + extra for scrolling
            const bgImage = this.textures.get('background');
            const bgWidth = bgImage.getSourceImage().width;
            const scale = Math.max(this.height / bgImage.getSourceImage().height, 1);
            const scaledWidth = bgWidth * scale;
            
            // We need at least 3 panels for seamless scrolling (current view + one on each side)
            const panelsNeeded = Math.ceil(this.width / scaledWidth) + 2;
            
            for (let i = 0; i < panelsNeeded; i++) {
                const bg = this.add.image(i * scaledWidth, this.height / 2, "background");
                bg.setOrigin(0, 0.5);
                bg.setScale(scale);
                bg.setDepth(0);
                this.backgroundGroup.push(bg);
            }
        } else {
            console.warn('Background image not found');
        }
    }

    update(time, delta) {
        if (!this.gameActive) return;
        
        // Calculate delta time in seconds for framerate-independent movement
        const dt = delta / 1000;
        
        // Update scrolling backgrounds with parallax effect
        this.updateScrollingBackground(dt);
        
        // Handle bird physics with smoother transitions
        if (this.player) {
            if (this.framesMoveUp > 0) {
                this.framesMoveUp--;
                
                // Calculate smooth upward velocity with easing
                const targetVelocity = this.flapForce;
                this.flapVelocity = Phaser.Math.Linear(this.flapVelocity, targetVelocity, this.smoothTransition);
                this.player.setVelocityY(this.flapVelocity);
                
                // Smoothly rotate bird upward during flap
                const targetAngle = -20;
                this.player.angle = Phaser.Math.Linear(this.player.angle, targetAngle, this.smoothTransition * 2);
                
                // Add wing flutter animation speed boost
                if (this.player.anims && !this.isFlapping) {
                    this.isFlapping = true;
                    this.player.anims.timeScale = 2;
                }
            } else if (Phaser.Input.Keyboard.JustDown(this.upButton) && this.gameStarted) {
                this.flapWings();
            } else if (this.gameStarted) {
                // Let gravity do its work but with smooth transitions
                
                // Reset flap animation speed gradually
                if (this.player.anims && this.isFlapping && time - this.lastFlapTime > 300) {
                    this.player.anims.timeScale = 1;
                    this.isFlapping = false;
                }
                
                // Calculate rotation based on velocity with smoothing
                const velocityRatio = Math.min(Math.abs(this.player.body.velocity.y) / this.maxFallSpeed, 1);
                const targetAngle = velocityRatio * 70; // Max angle of 70 degrees instead of 90 for less extreme rotation
                
                // Apply smooth rotation using interpolation
                this.player.angle = Phaser.Math.Linear(this.player.angle, targetAngle, this.rotationSpeed * dt);
                
                // Update trail emitter position
                if (this.trailEmitter) {
                    this.trailEmitter.setPosition(this.player.x - 10, this.player.y);
                    
                    // Adjust particle emission rate based on vertical speed
                    const particleRate = Math.abs(this.player.body.velocity.y) / 200;
                    this.trailEmitter.setFrequency(100 / Math.max(0.5, particleRate));
                }
            }
        }

        // Only update pipes and ground if the game has started
        if (this.gameStarted) {
            // Update pipes movement
            this.pipesGroup.children.iterate((child) => {
                if (child == undefined) return;
                if (child.x < -(this.pipeWidth + 50)) {
                    child.destroy();
                } else {
                    child.setVelocityX(-this.pipeMovingSpeed);
                    
                    // Check if pipe has passed the player and hasn't been scored yet
                    if (!child.scored && child.x + child.displayWidth < this.player.x) {
                        child.scored = true;
                        
                        // Find all pipes with the same pairId
                        let allScored = true;
                        let pairId = child.pairId;
                        
                        // We need to make sure both pipes in the pair are passed
                        this.pipesGroup.children.iterate((otherPipe) => {
                            if (otherPipe && otherPipe.pairId === pairId && !otherPipe.scored) {
                                allScored = false;
                            }
                        });
                        
                        // If this is the second pipe in the pair to be passed, award a point
                        if (allScored) {
                            this.updateScore(1);
                            if (this.sounds.collect) {
                                this.sounds.collect.play();
                            }
                        }
                    }
                }
            });
            
            // Update ground segments for scrolling effect
            this.groundGroup.children.iterate((segment) => {
                if (segment == undefined) return;
                
                // Move ground at the same speed as pipes
                segment.setVelocityX(-this.pipeMovingSpeed);
                
                // If ground segment moves out of view to the left, reposition it to the right
                if (segment.x < -segment.displayWidth) {
                    // Find the rightmost segment
                    let rightmostX = -Infinity;
                    this.groundGroup.children.iterate((otherSegment) => {
                        if (otherSegment && otherSegment.x > rightmostX) {
                            rightmostX = otherSegment.x;
                        }
                    });
                    
                    // Place this segment after the rightmost one
                    segment.x = rightmostX + segment.displayWidth;
                }
            });

            // Only spawn pipes if the game has started
            this.nextPipes++;
            if (this.nextPipes === this.pipeSpawnTime) {
                this.makePipes();
                this.nextPipes = 0;
            }
        }
    }

    // New method to update scrolling background
    updateScrollingBackground(dt) {
        if (!this.backgroundGroup || this.backgroundGroup.length === 0) return;
        
        // Move each background panel at a fraction of the pipe speed for parallax effect
        const moveSpeed = this.pipeMovingSpeed * this.backgroundScrollSpeed;
        
        for (let i = 0; i < this.backgroundGroup.length; i++) {
            const bg = this.backgroundGroup[i];
            
            // Move background
            bg.x -= moveSpeed * dt;
            
            // If this background panel has moved completely off screen to the left
            if (bg.x + bg.displayWidth < 0) {
                // Find the rightmost background panel
                let rightmostX = -Infinity;
                for (let j = 0; j < this.backgroundGroup.length; j++) {
                    const otherBg = this.backgroundGroup[j];
                    if (otherBg.x > rightmostX) {
                        rightmostX = otherBg.x;
                    }
                }
                
                // Position this panel right after the rightmost one for seamless scrolling
                bg.x = rightmostX + bg.displayWidth - 4; // Small overlap to prevent seams
            }
        }
    }

    flapWings() {
        if (!this.gameActive || !this.player || !this.gameStarted) return;
        
        // Play flap sound
        if (this.sounds.jump) {
            this.sounds.jump.play();
        }
        
        this.lastFlapTime = this.time.now;
        
        // Reset flap velocity for consistent feel
        this.flapVelocity = this.flapForce * 0.7;
        
        // Set flap duration
        this.framesMoveUp = this.flapDuration;
        
        // Add visual feedback with calmer particles
        this.addCalmFlapParticles();
        
        // Apply a very gentle screen shake for subtle feedback
        this.vfx.shakeCamera(0.3, 100);
        
        // Small scale squish effect
        this.player.setScale(0.17, 0.13);
        this.tweens.add({
            targets: this.player,
            scaleX: 0.15,
            scaleY: 0.15,
            duration: 200,
            ease: 'Sine.Out'  // Changed to Sine for smoother, calmer animation
        });
    }
    
    createTrailEffect() {
        if (!this.player) return;
        
        // Create subtle trailing particles emitter
        this.trailEmitter = this.add.particles(this.player.x - 10, this.player.y, 'pillar', {
            scale: { start: 0.02, end: 0.001 },  // Smaller particles
            speed: { min: 5, max: 15 },  // Slower speed
            angle: { min: 230, max: 310 },
            frequency: 100,  // Fewer particles
            lifespan: 600,  // Longer lifespan
            alpha: { start: 0.4, end: 0 },  // Lower opacity
            tint: [0xD0E8FF, 0xE0F0FF, 0xF0F8FF],  // Soft pastel blues
            blendMode: 'NORMAL',  // Normal blend mode for softness
            follow: this.player,
            followOffset: { x: -10, y: 0 }
        });
    }
    
    
    addCalmFlapParticles() {
        if (!this.player) return;
        
        // Create gentle feather-like particles with pastel colors
        const gentleParticles = this.add.particles(this.player.x - 15, this.player.y, 'pillar', {
            scale: { start: 0.04, end: 0.01 },
            speed: { min: 40, max: 80 },  // Slower particles
            angle: { min: 230, max: 310 },
            quantity: 5,  // Fewer particles
            lifespan: 800,  // Longer lifespan
            alpha: { start: 0.7, end: 0 },
            // Pastel color palette - soft blues and whites
            tint: [0xA0D8F0, 0xC0E0F0, 0xD0F0FF, 0xFFFFFF],
            rotate: { min: -90, max: 90 },  // Less rotation
            gravityY: 50,  // Lower gravity for floating effect
            blendMode: 'NORMAL'  // Normal blend for softer appearance
        });
        
        // Add a subtle glow effect with very few particles
        const gentleGlow = this.add.particles(this.player.x - 10, this.player.y, 'pillar', {
            scale: { start: 0.02, end: 0.005 },
            speed: { min: 30, max: 60 },
            angle: { min: 200, max: 340 },
            quantity: 3,  // Very few particles
            lifespan: 600,
            alpha: { start: 0.5, end: 0 },  // Lower alpha for subtlety
            tint: [0xD0E8FF, 0xE0F0FF, 0xFFFFFF],  // Soft blue to white
            blendMode: 'ADD',  // Soft glow
            gravityY: 30  // Very low gravity for drifting effect
        });
        
        // Auto-destroy particle emitters
        this.time.delayedCall(800, () => {
            gentleParticles.destroy();
            gentleGlow.destroy();
        });
    }
    
    

    hitBird() {
        if (!this.gameActive) return;
        
        this.gameActive = false;
        
        if (this.sounds.lose) {
            this.sounds.lose.play();
        }
        
        // Gentle camera shake
        this.vfx.shakeCamera(1, 400);
        
        // Add soft flash effect on impact
        this.cameras.main.flash(300, 255, 255, 255, 0.2);  // White flash instead of red
        
        if (this.player) {
            // Soft blue tint with gentle pulsing
            this.player.setTint(0xA0D8F0);  // Soft blue instead of red
            this.tweens.add({
                targets: this.player,
                alpha: 0.7,
                yoyo: true,
                repeat: 2,
                duration: 200,
                ease: 'Sine.InOut'  // Smoother easing
            });
            
            // Stop animations
            if (this.player.anims) {
                this.player.anims.stop();
            }
            
            // Stop trail emission
            if (this.trailEmitter) {
                this.trailEmitter.stop();
            }
            
            // Gentle dissolution particles
            const peaceParticles = this.add.particles(this.player.x, this.player.y, 'pillar', {
                scale: { start: 0.05, end: 0.01 },
                speed: { min: 50, max: 150 },  // Slower speed
                angle: { min: 0, max: 360 },
                quantity: 20,
                lifespan: 1500,  // Longer lifespan for drifting effect
                alpha: { start: 0.7, end: 0 },
                tint: [0xA0D8F0, 0xB8E0F0, 0xD0F0FF, 0xFFFFFF],  // Pastel blue palette
                rotate: { min: -90, max: 90 },  // Less rotation
                gravityY: 100,  // Lower gravity
                blendMode: 'NORMAL'  // Normal blend for softer look
            });
            
            // Gentle sparkle effect
            const gentleSparkles = this.add.particles(this.player.x, this.player.y, 'pillar', {
                scale: { start: 0.03, end: 0.005 },
                speed: { min: 40, max: 120 },
                angle: { min: 0, max: 360 },
                quantity: 15,
                lifespan: 1200,
                alpha: { start: 0.6, end: 0 },
                tint: [0xFFFFFF, 0xF0F8FF, 0xE0F0FF],  // White to very light blue
                blendMode: 'ADD',  // Subtle glow
                gravityY: 50  // Very low gravity for floating effect
            });
            
            // Soft expanding ring effect
            const softRing = this.add.circle(this.player.x, this.player.y, 10, 0xD0E8FF, 0.5);  // Softer blue, lower alpha
            softRing.setBlendMode('SCREEN');  // Screen blend for softer glow
            
            this.tweens.add({
                targets: softRing,
                radius: 120,
                alpha: 0,
                duration: 900,  // Slower expansion
                ease: 'Sine.Out',  // Smoother easing
                onComplete: () => {
                    softRing.destroy();
                }
            });
            
            // Gentle fade out for the player instead of harsh disappearance
            this.tweens.add({
                targets: this.player,
                alpha: 0,
                duration: 800,
                delay: 300,
                ease: 'Sine.InOut'
            });
            
            // Auto-destroy particle emitters
            this.time.delayedCall(1500, () => {
                peaceParticles.destroy();
                gentleSparkles.destroy();
            });
        }
        this.groundGroup.children.iterate((segment) => {
            if (segment) {
                this.tweens.add({
                    targets: segment,
                    x: segment.x,  // Keep same position but use tweens to smoothly stop
                    duration: 500,
                    ease: 'Sine.Out',
                    onComplete: () => {
                        segment.setVelocityX(0);
                    }
                });
            }
        });
        
        this.pipesGroup.children.iterate((pipe) => {
            if (pipe) {
                this.tweens.add({
                    targets: pipe,
                    x: pipe.x,  // Keep same position but use tweens to smoothly stop
                    duration: 500,
                    ease: 'Sine.Out',
                    onComplete: () => {
                        pipe.setVelocityX(0);
                    }
                });
            }
        });
        
        // Gently stop background scrolling
        if (this.backgroundGroup) {
            this.backgroundGroup.forEach(bg => {
                this.tweens.add({
                    targets: bg,
                    x: bg.x,  // Keep same position
                    duration: 500,
                    ease: 'Sine.Out',
                    onComplete: () => {
                        bg.setData('scrolling', false);
                    }
                });
            });
        }
        
        this.time.delayedCall(1500, () => {  // Longer delay before game over
            this.gameOver();
        });
    }

    // Updated pipe spawning method with continuous difficulty progression
    makePipes() {
        // Calculate difficulty progression based directly on score (0 to 1 range)
        const diffProgress = Math.min(this.score * this.difficultyRate, 1);
        
        // Adjust randomHeight range for higher pipes as score increases
        const minHeight = this.height * (0.2 + (diffProgress * 0.05)); 
        const maxHeight = this.height * (0.6 - (diffProgress * 0.05)); 
        const randomHeight = Phaser.Math.Between(minHeight, maxHeight);
        const pipeX = this.width - 20;
    
        // Continuously update difficulty parameters
        this.pipeGap = Phaser.Math.Linear(
            this.initialPipeGap, 
            this.minPipeGap, 
            diffProgress
        );
        
        this.pipeMovingSpeed = Phaser.Math.Linear(
            this.initialPipeSpeed, 
            this.maxPipeSpeed, 
            diffProgress
        );
        
        this.pipeSpawnTime = Phaser.Math.Linear(
            this.initialPipeSpawnTime, 
            this.minPipeSpawnTime, 
            diffProgress
        );
        
        // Round values to integers
        this.pipeGap = Math.round(this.pipeGap);
        this.pipeMovingSpeed = Math.round(this.pipeMovingSpeed);
        this.pipeSpawnTime = Math.round(this.pipeSpawnTime);
    
        if (this.textures.exists('pillar')) {
            const pipeTop = this.pipesGroup.create(pipeX, 0, "pillar");
            pipeTop.displayHeight = randomHeight;
            pipeTop.displayWidth = this.pipeWidth;
            pipeTop.body.allowGravity = false;
            pipeTop.setOrigin(0, 0);
            // Flag to track if this pipe pair has been scored yet
            pipeTop.scored = false;
            // Store the pipe pair ID so we can track them as a unit
            pipeTop.pairId = Date.now(); // Using timestamp as a unique ID
    
            const pipeBottom = this.pipesGroup.create(pipeX, randomHeight + this.pipeGap, "pillar");
            pipeBottom.displayHeight = this.height - this.pipeGap - randomHeight;
            pipeBottom.displayWidth = this.pipeWidth;
            pipeBottom.body.allowGravity = false;
            pipeBottom.setOrigin(0, 0);
            // Link to the same pair ID
            pipeBottom.pairId = pipeTop.pairId;
            pipeBottom.scored = false;
        } else {
            console.warn('Pillar texture not found');
        }
        
        // Don't update score here - it will be updated when pipes are passed
    }
    

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(this.score);
    }

    gameOver() {
        this.sounds.background.stop();
        initiateGameOver.bind(this)({
            score: this.score,
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
            gravity: { y: 0 }, // Set to 0 here as we're setting it in the scene
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