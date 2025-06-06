// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.isgameover = false;
        this.targetHit = false;
        this.cakeBeingDragged = false;
        this.birthdayMessageShown = {
            300: false,
            800: false,
            1500: false
        };
        this.powerUpSpawned = false;
        this.powerUpTimer = 0;
        this
        .powerUpInterval = Phaser.Math.Between(3000, 5000); // 5-10 seconds

    }

    preload() {
        this.score = 0;
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

        displayProgressLoader.call(this);

    }

    create() {
        this.vfx = new VFXLibrary(this);
        this.vfx.addCircleTexture('hitParticle', 0xFFD700, 1, 10);
        this.vfx.addCircleTexture('cakeParticle', 0xFFFFFF, 1, 5);
        this.vfx.addCircleTexture('powerUpParticle', 0x00FFFF, 1, 8);
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }
        this.sounds.celebration = this.sound.add('celebration', { loop: false, volume: 0.5 });
         this.sounds.powerUp = this.sound.add('powerUp', { loop: false, volume: 0.5 });
          this.sounds.cakeSplat = this.sound.add('cakeSplat', { loop: false, volume: 0.7 });
        this.backgroundMusic = this.sounds.background.setVolume(0.5).setLoop(true);
        this.backgroundMusic.play();

        this.isgameover = false;
        this.score = 0;

        this.width = this.game.config.width;
        this.height = this.game.config.height;
        
        // Add background
        this.bg = this.add.sprite(0, 0, 'background').setOrigin(0, 0).setDepth(-10);
        this.bg.setScrollFactor(0);
        this.bg.displayHeight = this.game.config.height;
        this.bg.displayWidth = this.game.config.width;

        this.createInstructionTexts();

        // Add score text
        this.scoreText = this.add.bitmapText(this.width / 2, 60, 'pixelfont', '0', 80).setOrigin(0.5, 0.5);
        this.scoreText.setDepth(100);
        this.scoreHeader = this.add.bitmapText(this.width / 2, 20, 'pixelfont', 'SCORE', 40).setOrigin(0.5, 0.5);
        this.scoreHeader.setDepth(100);

        // Add pause button
        this.pauseButton = this.add.sprite(this.game.config.width - 60, 60, "pauseButton").setOrigin(0.5, 0.5);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(3);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.input.keyboard.disableGlobalCapture();

        // Add the target player that moves randomly
        this.player = this.physics.add.sprite(
            Phaser.Math.Between(100, this.width - 100),
            Phaser.Math.Between(100, this.height - 200),
            'player'
        );
        this.player.setScale(1);
        this.player.setDepth(5);
        this.player.setBounce(1, 1); // Set full bounce on collisions
        
        // Set random velocity for the player
        this.setRandomPlayerVelocity();
        
        // Make player collide with world bounds
        this.player.setCollideWorldBounds(true);
        
        // Initialize cake spawn position
        this.initialCakePosition = { x: this.width / 2, y: this.height - 150 };
        
        // Create the first cake
        this.createCake();
        
        // Create aim line (initially invisible)
        this.aimLine = this.add.sprite(this.initialCakePosition.x, this.initialCakePosition.y, 'aimLine');
        this.aimLine.setOrigin(0, 0.5);
        this.aimLine.setDepth(4);
        this.aimLine.setVisible(false);
        this.aimLine.setScale(0.5, 0.5);
        
        this.hitEmitter = this.vfx.createEmitter('hitParticle', 0, 0, 0.5, 0, 500);
        this.cakeEmitter = this.vfx.createEmitter('cakeParticle', 0, 0, 0.3, 0, 800);
         this.powerUpEmitter = this.vfx.createEmitter('powerUpParticle', 0, 0, 0.3, 0, 600);
        this.confettiEmitter = this.add.particles(0, 0, 'confetti', {
            speed: { min: 100, max: 300 },
            scale: { start: 0.4, end: 0 },
            angle: { min: 0, max: 360 },
            rotate: { min: 0, max: 360 },
            lifespan: { min: 1000, max: 2000 },
            frequency: 100,
            gravityY: 300,
            emitting: false
        });

        // Set up drag events for the cake
        this.input.on('dragstart', (pointer, gameObject) => {
            if (gameObject === this.cake && !this.cakeInMotion) {
                this.cakeBeingDragged = true;
                this.aimLine.setVisible(true);
            }
        });
        
        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            if (gameObject === this.cake && this.cakeBeingDragged) {
                // Calculate angle for aim line
                const angle = Phaser.Math.Angle.Between(
                    this.initialCakePosition.x, 
                    this.initialCakePosition.y,
                    pointer.x, 
                    pointer.y
                );
                
                // Set aim line angle and length based on drag distance
                const distance = Phaser.Math.Distance.Between(
                    this.initialCakePosition.x, 
                    this.initialCakePosition.y,
                    pointer.x, 
                    pointer.y
                );
                
                const power = Math.min(distance / 3, 100);
                this.aimLine.setPosition(this.initialCakePosition.x, this.initialCakePosition.y);
                this.aimLine.setRotation(angle);
                this.aimLine.displayWidth = power * 2;
                
                // Store power and angle for launch
                this.launchPower = power;
                this.launchAngle = angle;
            }
        });
        
        this.input.on('dragend', (pointer, gameObject) => {
            if (gameObject === this.cake && this.cakeBeingDragged) {
                this.cakeBeingDragged = false;
                this.aimLine.setVisible(false);
                
                // Launch the cake
                this.launchCake();
            }
        });

        
        // Set up collision between cake and player
        this.physics.add.overlap(this.cake, this.player, this.hitPlayer, null, this);
        if (this.powerUp) {
        this.physics.add.overlap(this.cake, this.powerUp, this.collectPowerUp, null, this);
    }
        
        // Initialize game state
        this.cakeInMotion = false;
        this.targetHit = false;
        this.gameTime = 30; // 60 seconds game time
        
        // Add timer text
        this.timeText = this.add.bitmapText(this.width / 2, 120, 'pixelfont', '30', 40).setOrigin(0.5, 0.5);
        this.timeText.setDepth(100);
        this.timeHeader = this.add.bitmapText(this.width / 2, 170, 'pixelfont', 'TIME', 30).setOrigin(0.5, 0.5);
        this.timeHeader.setDepth(100);

        this.birthdayMessageContainer = this.add.container(this.width / 2, this.height / 2);
        this.birthdayMessageContainer.setDepth(20);
        this.birthdayMessageContainer.setVisible(false);
        
        // Initialize birthday message flags
        this.birthdayMessageShown = {
            300: false,
            800: false,
            1500: false
        };
         this.powerUpTimer = 0;
        this.powerUpInterval = Phaser.Math.Between(3000, 5000); // 5-10 seconds
        this.powerUpSpawned = false;
        
        // Start timer
        this.timer = this.time.addEvent({
            delay: 1000,
            callback: this.updateTimer,
            callbackScope: this,
            loop: true
        });
    }

    createInstructionTexts() {
        // Create semi-transparent background for instructions
        const bgRect = this.add.rectangle(this.width / 2, this.height / 2, this.width - 100, this.height - 200, 0x000000, 0.2);
        bgRect.setDepth(1);
        
        // Add instruction texts
        const instructions = [
            { text: "Score 300 to start party", y: this.height / 2 - 100 },
            { text: "Score 800 to overeat", y: this.height / 2 },
            { text: "Score 1500 to say Happy Birthday", y: this.height / 2 + 100 }
        ];
        
        this.instructionTexts = [];
        
        instructions.forEach(inst => {
            const text = this.add.bitmapText(this.width / 2, inst.y, 'pixelfont', inst.text, 40);
            text.setOrigin(0.5, 0.5);
            text.setDepth(1);
            text.setAlpha(0.7);
            this.instructionTexts.push(text);
        });
    }

    createCake() {
        // Create a new cake at the initial position
        this.cake = this.physics.add.sprite(this.initialCakePosition.x, this.initialCakePosition.y, 'cake');
        this.cake.setScale(0.3);
        this.cake.setDepth(5);
        this.cake.setInteractive({ draggable: true });
        this.cake.body.setAllowGravity(false);
        this.cake.body.setImmovable(true);
        
        // Add a little scale effect to the new cake
        this.vfx.scaleGameObject(this.cake, 1.1, 1500, 2);
        
        // Set up collision between cake and player
        this.physics.add.overlap(this.cake, this.player, this.hitPlayer, null, this);
        
        this.cakeInMotion = false;
        this.targetHit = false;
    }

    createPowerUp() {
    if (this.powerUp) {
        this.powerUp.destroy();
    }
    
    // Create power up that follows the player
    this.powerUp = this.physics.add.sprite(this.player.x, this.player.y - 50, 'powerUp');
    this.powerUp.setScale(0.2);
    this.powerUp.setDepth(6);
    
    // Add glow effect
    this.vfx.addGlow(this.powerUp, 0.5, 0x00FFFF);
    
    // Add pulsing effect
    this.vfx.scaleGameObject(this.powerUp, 1.2, 800, -1);
    
    this.powerUpSpawned = true;
}


    

    

   update(time, delta) {
    // Occasionally change player direction
    if (Phaser.Math.Between(1, 150) === 1) {
        this.setRandomPlayerVelocity();
    }
    
    // If cake is in motion, check if it's gone off screen
    if (this.cakeInMotion && this.cake) {
        if (this.cake.y > this.height || 
            this.cake.y < 0 || 
            this.cake.x > this.width || 
            this.cake.x < 0) {
            
            // Destroy the current cake
            this.cake.destroy();
            
            // Create a new cake
            this.createCake();
        }
    }
    
    // Update power up timer and position
    if (!this.powerUpSpawned) {
        this.powerUpTimer += delta;
        if (this.powerUpTimer >= this.powerUpInterval) {
            this.createPowerUp();
            this.powerUpTimer = 0;
        }
    } else if (this.powerUp && this.player) {
        // Make power up follow the player
        this.powerUp.x = this.player.x;
        this.powerUp.y = this.player.y - 50;
    }
    
    // Check for special score milestones
    this.checkScoreMilestones();
    
    // Update instruction text visibility based on score
    this.updateInstructionVisibility();
}

    updateInstructionVisibility() {
        // Fade out instructions as they're achieved
        if (this.score >= 300) {
            this.instructionTexts[0].setAlpha(0);
        }
        
        if (this.score >= 800) {
            this.instructionTexts[1].setAlpha(0);
        }
        
        if (this.score >= 1500) {
            this.instructionTexts[2].setAlpha(0);
        }
    }

    setRandomPlayerVelocity() {
        // Give the player a random velocity
        const speed = 200;
        const angle = Phaser.Math.DegToRad(Phaser.Math.Between(0, 360));
        this.player.body.setVelocity(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
        );
    }

    bouncePlayerIfNeeded() {
        // Bounce the player off the edges of the screen
        const padding = 20;
        if (this.player.x < padding) {
            this.player.body.velocity.x = Math.abs(this.player.body.velocity.x);
        } else if (this.player.x > this.width - padding) {
            this.player.body.velocity.x = -Math.abs(this.player.body.velocity.x);
        }
        
        if (this.player.y < padding) {
            this.player.body.velocity.y = Math.abs(this.player.body.velocity.y);
        } else if (this.player.y > this.height - padding) {
            this.player.body.velocity.y = -Math.abs(this.player.body.velocity.y);
        }
        
        // Occasionally change direction randomly
        if (Phaser.Math.Between(1, 100) === 1) {
            this.setRandomPlayerVelocity();
        }
    }
    
    launchCake() {
        if (!this.cakeInMotion && this.cake) {
            this.cakeInMotion = true;
            
            // Apply velocity based on drag power and angle
            const velocityX = Math.cos(this.launchAngle) * this.launchPower * -10;
            const velocityY = Math.sin(this.launchAngle) * this.launchPower * -10;
            
            this.cake.body.setVelocity(velocityX, velocityY);
            
            // Play sound effect
            if (this.sounds.hit) {
                this.sounds.hit.play();
            }
            
            // Add rotation to the cake as it flies
            this.vfx.rotateGameObject(this.cake, 1000, 360, -1);
        }
    }
    
    hitPlayer(cake, player) {
    if (this.cakeInMotion && !this.targetHit && cake && player) {
        this.targetHit = true;
        
        // Play both success sound and cake splat sound
        if (this.sounds.success) {
            this.sounds.success.play();
        }
        
        // Play the cake splat sound effect
        if (this.sounds.cakeSplat) {
            this.sounds.cakeSplat.play();
        }
        
        // Update score
        this.updateScore(100);
        
        // If power-up is active on the player, collect it automatically
        if (this.powerUpSpawned && this.powerUp) {
            // Play power up sound
            this.sounds.powerUp.play();
            
            // Add time to the game timer
            this.gameTime += 2;
            this.timeText.setText(this.gameTime);
            
            // Show +2s text effect
            const plusTimeText = this.add.bitmapText(player.x, player.y - 50, 'pixelfont', '+2s', 40);
            plusTimeText.setDepth(20);
            
            this.tweens.add({
                targets: plusTimeText,
                y: player.y - 100,
                alpha: 0,
                duration: 1000,
                onComplete: () => plusTimeText.destroy()
            });
            
            // Emit particles at collection location
            this.powerUpEmitter.setPosition(this.powerUp.x, this.powerUp.y);
            this.powerUpEmitter.explode(30);
            
            // Reset power up state
            this.powerUp.destroy();
            this.powerUpSpawned = false;
            this.powerUpTimer = 0;
            this.powerUpInterval = Phaser.Math.Between(3000, 5000); // New random interval
        }
        
        // Shake camera
        this.vfx.shakeCamera(300, 0.005);
        
        // Change player texture to cake-faced version
        player.setTexture('playerWithCake').setScale(0.3);
        
        // Emit particles at hit location
        this.hitEmitter.setPosition(player.x, player.y);
        this.hitEmitter.explode(30);
        
        this.cakeEmitter.setPosition(player.x, player.y);
        this.cakeEmitter.explode(20);
        
        // Shake the player
        this.vfx.shakeGameObject(player, 300, 5);
        
        // Destroy the current cake
        cake.destroy();
        
        // Create a timer to revert player face after a short delay
        this.time.delayedCall(1000, () => {
            // Return to normal face and move to a new position
            player.setTexture('player').setScale(1);
            
            // Move player to a new random position with new random velocity
            player.setPosition(
                Phaser.Math.Between(100, this.width - 100),
                Phaser.Math.Between(100, this.height - 200)
            );
            this.setRandomPlayerVelocity();
            
            // Create a new cake
            this.createCake();
        });
    }
}
    
    collectPowerUp(powerUp, cake) {
    if (this.cakeInMotion && powerUp && cake) {
        // Play power up sound
        this.sounds.powerUp.play();
        
        // Add time to the game timer
        this.gameTime += 2;
        this.timeText.setText(this.gameTime);
        
        // Show +2s text effect
        const plusTimeText = this.add.bitmapText(powerUp.x, powerUp.y, 'pixelfont', '+2s', 40);
        plusTimeText.setDepth(20);
        
        this.tweens.add({
            targets: plusTimeText,
            y: powerUp.y - 50,
            alpha: 0,
            duration: 1000,
            onComplete: () => plusTimeText.destroy()
        });
        
        // Emit particles at collection location
        this.powerUpEmitter.setPosition(powerUp.x, powerUp.y);
        this.powerUpEmitter.explode(30);
        
        // Highlight the time text
        this.vfx.blinkEffect(this.timeText, 200, 2);
        
        // Reset power up state
        powerUp.destroy();
        this.powerUpSpawned = false;
        this.powerUpTimer = 0;
        this.powerUpInterval = Phaser.Math.Between(3000, 5000); // New random interval
    }
}
    
    resetCake() {
        this.cake.body.setVelocity(0, 0);
        this.cake.setPosition(this.initialCakePosition.x, this.initialCakePosition.y);
        this.cakeInMotion = false;
        this.targetHit = false;
    }

    updateTimer() {
    this.gameTime--;
    this.timeText.setText(this.gameTime);
    
    if (this.gameTime <= 0) {
        // Stop the timer to prevent multiple calls
        this.timer.remove();
        
        // Show Happy Birthday message before game over
        this.showFinalBirthdayMessage();
    }
}

    showFinalBirthdayMessage() {
    // Pause the game
    this.physics.pause();
    
    // Stop player movement
    if (this.player) {
        this.player.body.setVelocity(0, 0);
    }
    
    // Clear any existing message
    this.birthdayMessageContainer.removeAll(true);
    this.birthdayMessageContainer.setVisible(true);
    
    // Create happy birthday text
    const happyBirthdayText = this.add.bitmapText(0, 0, 'pixelfont', 'HAPPY BIRTHDAY!', 60);
    happyBirthdayText.setOrigin(0.5, 0.5);
    happyBirthdayText.setTint(0xffff00); // Yellow color
    
    // Add to container
    this.birthdayMessageContainer.add(happyBirthdayText);
    
    // Play celebration sound
    this.sounds.celebration.play();
    
    // Emit confetti particles
    this.confettiEmitter.setPosition(this.width / 2, this.height / 3);
    this.confettiEmitter.explode(100);
    
    // Shake camera
    this.vfx.shakeCamera(1000, 0.01);
    
    // Add glow effect around text
    this.vfx.addGlow(happyBirthdayText, 1, 0xffff00);
    
    // Wait 3 seconds then game over
    this.time.delayedCall(3000, () => {
        this.gameOver();
    });
}


    updateScore(points) {
        this.score += points;
        this.updateScoreText();
        
        // Add shine effect to the score text
        //this.vfx.blinkEffect(this.scoreText, 100, 1);
    }

    updateScoreText() {
        this.scoreText.setText(this.score);
    }
    
    checkScoreMilestones() {
        const milestones = [300, 800, 1500];
        
        for (const milestone of milestones) {
            if (this.score >= milestone && !this.birthdayMessageShown[milestone]) {
                this.showBirthdayMessage(milestone);
                this.birthdayMessageShown[milestone] = true;
            }
        }
    }
    
    showBirthdayMessage(milestone) {
        // Clear existing message content
        this.birthdayMessageContainer.removeAll(true);
        
        // Create message based on milestone
        let messageKey;
        let particleColor;
        let messageText;
        
        switch(milestone) {
            case 300:
                messageKey = 'birthdayMessage300';
                particleColor = 0xffcc00; // Yellow
                messageText = "PARTY STARTED!";
                break;
            case 800:
                messageKey = 'birthdayMessage600';
                particleColor = 0xff6699; // Pink
                messageText = "CAKE OVERDOSE!";
                break;
            case 1500:
                messageKey = 'birthdayMessage1000';
                particleColor = 0x66ccff; // Blue
                messageText = "HAPPY BIRTHDAY!";
                break;
            default:
                messageKey = 'birthdayMessage300';
                particleColor = 0xffcc00;
                messageText = "PARTY STARTED!";
        }
        
        // Create special particle effect for this milestone
        this.vfx.addCircleTexture('milestone' + milestone, particleColor, 1, 10);
        const specialEmitter = this.vfx.createEmitter('milestone' + milestone, 
            this.width / 2, this.height / 2, 0.5, 0, 1500);
        
        // Try to use image first, fallback to text if image not available
        let message;
        if (this.textures.exists(messageKey)) {
            message = this.add.sprite(0, 0, messageKey);
            message.setScale(0.5);
        } else {
            message = this.add.bitmapText(0, 0, 'pixelfont', messageText, 50);
            message.setOrigin(0.5, 0.5);
            message.setTint(particleColor);
        }
        
        // Add to container
        this.birthdayMessageContainer.add(message);
        
        // Show the message with animation
        this.birthdayMessageContainer.setScale(0.1);
        this.birthdayMessageContainer.setVisible(true);
        
        // Play celebration sound
        this.sounds.celebration.play();
        
        // Emit confetti particles
        this.confettiEmitter.setPosition(this.width / 2, this.height / 3);
        this.confettiEmitter.start();
        
        // Animate the message
        this.tweens.add({
            targets: this.birthdayMessageContainer,
            scale: 1,
            duration: 800,
            ease: 'Bounce.Out',
            onComplete: () => {
                // Rotate the message slightly back and forth
                this.vfx.rotateGameObject(message, 2000, 5, 2);
                
                // Special particles explosion
                specialEmitter.explode(50);
                
                // Hide the message after a delay
                this.time.delayedCall(2000, () => {
                    this.confettiEmitter.stop();
                    this.sounds.celebration.stop();
                    
                    this.tweens.add({
                        targets: this.birthdayMessageContainer,
                        scale: 1,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => {
                            this.birthdayMessageContainer.setVisible(false);
                            this.birthdayMessageContainer.setAlpha(1);
                        }
                    });
                });
            }
        });
        
        // Shake the camera with intensity based on milestone
        const intensity = milestone / 30000;
        this.vfx.shakeCamera(500, intensity);
        
        // Pause player movement temporarily
        const currentVelocity = {
            x: this.player.body.velocity.x,
            y: this.player.body.velocity.y
        };
        
        this.player.body.setVelocity(0, 0);
        
        // Add a special glow to the player
        this.vfx.addGlow(this.player, 1, particleColor);
        
        // Resume player movement after message is gone
        this.time.delayedCall(3000, () => {
            this.player.clearTint();
            this.player.setAlpha(1);
            this.player.body.setVelocity(currentVelocity.x, currentVelocity.y);
        });
    }
    
    gameOver() {
        this.backgroundMusic.stop();
        
        // Final celebration if score is high
        if (this.score >= 1000) {
            this.confettiEmitter.setPosition(this.width / 2, this.height / 2);
            this.confettiEmitter.explode(100);
            this.vfx.shakeCamera(800, 0.01);
        }
        
        initiateGameOver.bind(this)({ score: this.score });
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
    width: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width,
    height: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].height,
    scene: [GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        orientation: Phaser.Scale.Orientation.PORTRAIT
    },
    /* ADD CUSTOM CONFIG ELEMENTS HERE */
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 0 },
            debug: false,
        },
    },
    pixelArt: true,
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions,
    },
    deviceOrientation: _CONFIG.deviceOrientation==="portrait"
};