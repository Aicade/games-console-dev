class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.score = 0; // Initialize score
        // this.mistakes = 0; // Track incorrect deliveries
        // this.maxMistakes = 3; // Game over after 3 mistakes
    }

    preload() {
        this.isGameOver = false;

        addEventListenersPhaser.bind(this)();

        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/"
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        // Assets

        this.load.image("customer", "https://aicade-user-store.s3.amazonaws.com/0306251268/games/3hUAYEeFzgiJvaRR/assets/images/Screenshot%202025-04-13%20130807.png?t=1744529899740");
        this.load.image("donut1", "https://aicade-user-store.s3.amazonaws.com/0306251268/games/3hUAYEeFzgiJvaRR/assets/images/Screenshot%202025-04-13%20130907.png?t=1744529977238");
        this.load.image("donut2", "https://aicade-user-store.s3.amazonaws.com/0306251268/games/3hUAYEeFzgiJvaRR/assets/images/Screenshot%202025-04-13%20130917.png?t=1744529977643");
        this.load.image("donut3", "https://aicade-user-store.s3.amazonaws.com/0306251268/games/3hUAYEeFzgiJvaRR/assets/images/Screenshot%202025-04-13%20130921.png?t=1744529977667");
        this.load.image("donut4", "https://aicade-user-store.s3.amazonaws.com/0306251268/games/3hUAYEeFzgiJvaRR/assets/images/Screenshot%202025-04-13%20130925.png?t=1744529977687");
        this.load.image("happy" , "https://aicade-user-store.s3.amazonaws.com/0306251268/games/3hUAYEeFzgiJvaRR/assets/images/newAsset_14.png?t=1744531594530");
        this.load.image("sad", "https://aicade-user-store.s3.amazonaws.com/0306251268/games/3hUAYEeFzgiJvaRR/assets/images/newAsset_15.png?t=1744531606145");

        displayProgressLoader.call(this);
    }

    resize() {

    }
    
    create() {
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        this.sounds.background.setVolume(0.01).setLoop(true).play();

        this.vfx = new VFXLibrary(this);
         
        this.add.image(0, 0, 'background').setOrigin(0, 0).setDisplaySize(this.sys.game.config.width, this.sys.game.config.height);

        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.bg = this.add.sprite(0, 0, 'background').setOrigin(0, 0);
        this.bg.setScrollFactor(0);
        this.bg.displayHeight = this.game.config.height;
        this.bg.displayWidth = this.game.config.width;

        // Add UI elements
        this.scoreText = this.add.bitmapText(this.width / 2 - 800, 30, 'pixelfont', '0', 100).setOrigin(0.5, 0.5);
        this.scoreText.setDepth(11);

        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());

        this.pauseButton = this.add.sprite(this.game.config.width - 60, 60, "pauseButton").setOrigin(0.5, 0.5).setDepth(1);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(3);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        this.cursors = this.input.keyboard.createCursorKeys();
        this.enemies = this.physics.add.group();
        this.input.keyboard.disableGlobalCapture();


        // Satisfaction meter
        this.satisfaction = 30; // Start at 30% (range: 0 to 100)
        this.maxSatisfaction = 100;
        this.minSatisfaction = 0;

        // Draw meter background
        const meterX = 50;
        const meterY = this.height / 2;
        const meterWidth = 30;
        const meterHeight = 200;
        this.meterBg = this.add.graphics();
        this.meterBg.fillStyle(0x222222, 0.8);
        this.meterBg.fillRect(meterX - meterWidth / 2, meterY - meterHeight / 2, meterWidth, meterHeight);
        this.meterBg.setDepth(11);

        // Draw meter fill (initially 50%)
        this.meterFill = this.add.graphics();
        this.meterFill.setDepth(11);
        this.updateSatisfactionMeter();

        // Add emojis
        this.add.sprite(meterX, meterY - meterHeight / 2 - 30, 'happy').setDepth(11).setScale(0.3);
        this.add.sprite(meterX, meterY + meterHeight / 2 + 30, 'sad').setDepth(11).setScale(0.3);

        // Initialize customers group and lane management
        this.customers = this.physics.add.group({ maxSize: 4 });
        this.lanes = [
            { x: this.width * 0.2, occupied: false }, // Lane 1
            { x: this.width * 0.4, occupied: false }, // Lane 2
            { x: this.width * 0.6, occupied: false }, // Lane 3
            { x: this.width * 0.8, occupied: false }  // Lane 4
        ];
        this.time.addEvent({
            delay: 3000, // Spawn every 3 seconds
            callback: this.spawnCustomer,
            callbackScope: this,
            loop: true
        });

        // Initialize game elements
        this.donutTypes = ['donut1', 'donut2', 'donut3', 'donut4']; // Available donuts
        this.customer = null; // Current customer sprite
        this.order = null; // Current order sprite
        this.donuts = []; // Draggable donut sprites

        // Create donut selection area at the bottom
        const donutY = this.height - 100;
        const donutSpacing = this.width / 5;
        for (let i = 0; i < 4; i++) {
            let donut = this.physics.add.sprite(donutSpacing * (i + 1), donutY, this.donutTypes[i])
                .setInteractive({ draggable: true })
                .setDepth(10);
            donut.originalX = donut.x; // Store original position for reset
            donut.originalY = donut.y;
            donut.setScale(1); // Adjust size as needed
            this.donuts.push(donut);
        }

        // Enable drag-and-drop
        this.input.on('dragstart', (pointer, gameObject) => {
            gameObject.setDepth(12); // Bring to front while dragging
        });

        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            gameObject.x = dragX;
            gameObject.y = dragY;
        });

        this.input.on('dragend', (pointer, gameObject) => {
            gameObject.setDepth(12); // Ensure donut is above customers
            this.handleDonutDrop(gameObject); // Check immediately on drop
            // Reset donut position
            gameObject.x = gameObject.originalX;
            gameObject.y = gameObject.originalY;
            gameObject.setDepth(10);
        });

        // Spawn first customer
        this.spawnCustomer();
    }

    update() {
        if (this.isGameOver) return;

        // Optional: Add animations or effects if VFXLibrary supports it
    }

    spawnCustomer() {
        if (this.isGameOver) return;

        // Find an unoccupied lane
        const availableLanes = this.lanes.filter(lane => !lane.occupied);
        if (availableLanes.length === 0) return; // All lanes occupied

        // Randomly select an available lane
        const lane = availableLanes[Phaser.Math.Between(0, availableLanes.length - 1)];
        lane.occupied = true;

        // Create customer in the selected lane
        const customer = this.physics.add.sprite(lane.x, 0, 'customer')
            .setDepth(10)
            .setScale(0.8);
        customer.lane = lane; // Store lane reference
        customer.order = this.donutTypes[Phaser.Math.Between(0, 3)]; // Assign random order
        this.customers.add(customer);

        // Create order sprite above customer
        const order = this.add.sprite(customer.x, customer.y - 100, customer.order)
            .setDepth(10)
            .setScale(0.5);
        customer.orderSprite = order;

        // Move customer to middle of screen slowly
        this.tweens.add({
            targets: [customer, order],
            y: { value: this.height / 2, duration: 5000, ease: 'Linear' },
            onUpdate: () => {
                order.y = customer.y - 100; // Keep order above customer
            },
            onComplete: () => {
                // Free the lane when customer reaches destination (optional)
            }
        });
    }

    handleDonutDrop(donut) {
        if (this.isGameOver) return;

        // Check overlap with any customer
        this.customers.getChildren().forEach(customer => {
            // Use a simple rectangle-based overlap check
            const boundsA = donut.getBounds();
            const boundsB = customer.getBounds();
            const overlap = Phaser.Geom.Intersects.RectangleToRectangle(boundsA, boundsB);

            if (overlap) {
                // Destroy the order sprite immediately
                customer.orderSprite.destroy();

                // Create happy or sad sprite based on delivery
                const isCorrect = donut.texture.key === customer.order;
                const expressionSprite = this.add.sprite(customer.x, customer.y - 100, isCorrect ? 'happy' : 'sad')
                    .setDepth(10)
                    .setScale(0.5);

                // Update satisfaction
                if (isCorrect) {
                    this.satisfaction = Math.min(this.satisfaction + 10, this.maxSatisfaction);
                } else {
                    this.satisfaction = Math.max(this.satisfaction - 10, this.minSatisfaction);
                }
                this.updateSatisfactionMeter();

                // Determine move direction (left if x < width/2, right if x >= width/2)
                const moveX = customer.x < this.width / 2 ? customer.x - 100 : customer.x + 100;

                // Move customer and expression sprite to the side
                this.tweens.add({
                    targets: [customer, expressionSprite],
                    x: moveX,
                    duration: 500,
                    ease: 'Linear',
                    onUpdate: () => {
                        expressionSprite.y = customer.y - 100; // Keep sprite above customer
                    },
                    onComplete: () => {
                        if (isCorrect) {
                            // Correct delivery
                            this.updateScore(1);
                            if (this.sounds.correct) this.sounds.correct.play();
                        } else {
                            // Incorrect delivery
                            if (this.sounds.incorrect) this.sounds.incorrect.play();
                            if (this.satisfaction <= 0) {
                                this.gameOver();
                            }
                        }
                        expressionSprite.destroy();
                        customer.lane.occupied = false; // Free the lane
                        customer.destroy();
                    }
                });
            }
        });
    }

    updateSatisfactionMeter() {
        this.meterFill.clear();
        this.meterFill.fillStyle(0x00ff00, 1); // Green fill
        const meterX = 50;
        const meterY = this.height / 2;
        const meterWidth = 30;
        const meterHeight = 200;
        const fillHeight = (this.satisfaction / this.maxSatisfaction) * meterHeight;
        this.meterFill.fillRect(
            meterX - meterWidth / 2,
            meterY + meterHeight / 2 - fillHeight,
            meterWidth,
            fillHeight
        );
    }

    updateScore(points) {
        this.score += points;
        this.gamePoint = this.score;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(this.score);
    }

    gameOver() {
        this.isGameOver = true;
        this.sounds.background.stop();
        initiateGameOver.bind(this)({
            score: this.score
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