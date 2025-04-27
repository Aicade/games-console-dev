// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.score = 0;
        this.currentCustomer = null;
        this.isServing = false;
        this.selectedDishes = [];
        this.satisfaction = 30; // Start at 30% (range: 0 to 100)
        this.maxSatisfaction = 100;
        this.minSatisfaction = 0;
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

        // Define assets
        this.load.image('background', 'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/backgrounds/background1.png');
        this.load.image('customer1', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/GBhAeNVO2jjO98cy/assets/images/c%201.png?t=1744812839606');
        this.load.image('customer2', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/GBhAeNVO2jjO98cy/assets/images/c%202.png?t=1744812933798');
        this.load.image('customer3', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/GBhAeNVO2jjO98cy/assets/images/c%203.png?t=1744812919023');
        this.load.image('customer4', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/GBhAeNVO2jjO98cy/assets/images/c%204.png?t=1744812949362');
        this.load.image('table', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/GBhAeNVO2jjO98cy/assets/images/360_F_1030969107_cTJcVvKOf6ewgXWkX7bYjVVAau6Vb6JO.png?t=1745063003022');
        
        // Dish items
        this.load.image('dish1', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/GBhAeNVO2jjO98cy/assets/images/MILK_Shakes_Floats_882_Shakes.png?t=1744894559923');
        this.load.image('dish2', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/GBhAeNVO2jjO98cy/assets/images/MILK_Shakes_Floats_882_Shakes.png?t=1744894559923');
        this.load.image('dish3', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/GBhAeNVO2jjO98cy/assets/images/MILK_Shakes_Floats_882_Shakes.png?t=1744894559923');
        this.load.image('dish4', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/GBhAeNVO2jjO98cy/assets/images/MILK_Shakes_Floats_882_Shakes.png?t=1744894559923');
        this.load.image('dish5', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/GBhAeNVO2jjO98cy/assets/images/MILK_Shakes_Floats_882_Shakes.png?t=1744894559923');
        this.load.image('dish6', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/GBhAeNVO2jjO98cy/assets/images/MILK_Shakes_Floats_882_Shakes.png?t=1744894559923');
        this.load.image('dish7', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/GBhAeNVO2jjO98cy/assets/images/MILK_Shakes_Floats_882_Shakes.png?t=1744894559923');

        // Order items
        this.load.image("order1", "https://aicade-user-store.s3.amazonaws.com/0306251268/games/GBhAeNVO2jjO98cy/assets/images/360_F_1299383075_ZOLkChzK7N1fEgNIwvcpRsIowNH0Ngbd.png?t=1744874125061");
        this.load.image("order2", "https://aicade-user-store.s3.amazonaws.com/0306251268/games/GBhAeNVO2jjO98cy/assets/images/paper-coffee-cup-disposable-coffee-cup_486879-727.png?t=1744813377728");
        this.load.image("order3", "https://aicade-user-store.s3.amazonaws.com/0306251268/games/GBhAeNVO2jjO98cy/assets/images/360_F_170683129_J0z1iDuhHVy1YV891TpGtlOTOJWU8cFI.png?t=1744874224750");
        this.load.image("order4", "https://aicade-user-store.s3.amazonaws.com/0306251268/games/GBhAeNVO2jjO98cy/assets/images/360_F_188096235_MAB6os5VcSOpggp2Hctu7eTlULleQXyd.png?t=1744874279123");

        // Satisfaction emojis
        this.load.image("happy", "https://aicade-user-store.s3.amazonaws.com/0306251268/games/3hUAYEeFzgiJvaRR/assets/images/newAsset_14.png?t=1744531594530");
        this.load.image("sad", "https://aicade-user-store.s3.amazonaws.com/0306251268/games/3hUAYEeFzgiJvaRR/assets/images/newAsset_15.png?t=1744531606145");

        displayProgressLoader.call(this);

    }

    create() {

        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        this.sounds.background.setVolume(0.1).setLoop(true).play()

        this.vfx = new VFXLibrary(this);
         
        this.add.image(0, 0, 'background').setOrigin(0, 0).setDisplaySize(this.sys.game.config.width, this.sys.game.config.height);

        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.bg = this.add.sprite(0, 0, 'background').setOrigin(0, 0);
        this.bg.setScrollFactor(0);
        this.bg.displayHeight = this.game.config.height;
        this.bg.displayWidth = this.game.config.width;

        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());

        this.pauseButton = this.add.sprite(this.game.config.width - 60, 60, "pauseButton").setOrigin(0.5, 0.5).setDepth(1);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(2);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        // Add table
        this.table = this.add.image(this.width / 2, this.height / 2 + 100, 'table').setScale(0.5).setDepth(10);
        this.table.setInteractive();

        // Score display
        this.scoreText = this.add.bitmapText(this.width / 2 - 800, 40, 'pixelfont', '0', 74).setOrigin(0.5).setDepth(11);

        // Pause button
        // this.pauseButton = this.add.sprite(this.width - 60, 60, 'pauseButton').setOrigin(0.5).setScale(2).setDepth(11);
        // this.pauseButton.setInteractive({ cursor: 'pointer' });
        // this.pauseButton.on('pointerdown', () => this.pauseGame());

        // Input setup
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.cursors = this.input.keyboard.createCursorKeys();

        // Define recipes (each recipe is an array of dish keys in order)
        this.recipes = {
            order1: ['dish1', 'dish2', 'dish3'],
            order2: ['dish4', 'dish5'],
            order3: ['dish6', 'dish2', 'dish7'],
            order4: ['dish1', 'dish7', 'dish4']
        };

        // Available dishes
        this.dishKeys = ['dish1', 'dish2', 'dish3', 'dish4', 'dish5', 'dish6', 'dish7'];
        this.dishes = [];

        // Create dish selection area
        this.createDishSelection();

        // Satisfaction meter
        const meterX = 50;
        const meterY = this.height / 2;
        const meterWidth = 30;
        const meterHeight = 200;
        this.meterBg = this.add.graphics();
        this.meterBg.fillStyle(0x222222, 0.8);
        this.meterBg.fillRect(meterX - meterWidth / 2, meterY - meterHeight / 2, meterWidth, meterHeight);
        this.meterBg.setDepth(11);

        // Draw meter fill (initially 30%)
        this.meterFill = this.add.graphics();
        this.meterFill.setDepth(11);
        this.updateSatisfactionMeter();

        // Add emojis
        this.add.sprite(meterX, meterY - meterHeight / 2 - 30, 'happy').setDepth(11).setScale(0.3);
        this.add.sprite(meterX, meterY + meterHeight / 2 + 30, 'sad').setDepth(11).setScale(0.3);

        // Start spawning customers
        this.spawnCustomer();

        this.cursors = this.input.keyboard.createCursorKeys();
        this.enemies = this.physics.add.group();
        this.input.keyboard.disableGlobalCapture();

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

    createDishSelection() {
        const startX = this.width / 2 - 560;
        const y = this.height - 100;
        const spacing = 200;

        this.dishKeys.forEach((dishKey, index) => {
            const dish = this.add.sprite(startX + index * spacing, y, dishKey)
                .setScale(0.1)
                .setInteractive({ draggable: true })
                .setDepth(10);
            dish.originalX = dish.x;
            dish.originalY = dish.y;
            this.dishes.push(dish);

            // Drag events
            dish.on('dragstart', () => {
                dish.setScale(0.1);
            });

            dish.on('drag', (pointer, dragX, dragY) => {
                dish.x = dragX;
                dish.y = dragY;
            });

            dish.on('dragend', () => {
                dish.setScale(0.1);
                // Check if dropped on table
                if (this.isOverTable(dish)) {
                    this.selectedDishes.push(dishKey);
                    dish.setVisible(false);
                    this.checkOrder();
                } else {
                    // Return to original position
                    dish.x = dish.originalX;
                    dish.y = dish.originalY;
                }
            });
        });

        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            gameObject.x = dragX;
            gameObject.y = dragY;
        });
    }

    isOverTable(dish) {
        const tableBounds = this.table.getBounds();
        return Phaser.Geom.Rectangle.ContainsPoint(tableBounds, { x: dish.x, y: dish.y });
    }

    spawnCustomer() {
        if (this.isGameOver || this.currentCustomer) return;

        // Random customer and order
        const customerKey = `customer${Phaser.Math.Between(1, 4)}`;
        const orderKeys = Object.keys(this.recipes);
        const orderKey = orderKeys[Phaser.Math.Between(0, orderKeys.length - 1)];

        // Create customer
        this.currentCustomer = this.physics.add.sprite(this.width / 2, 0, customerKey)
            .setScale(0.5)
            .setDepth(10);

        // Display order text above customer
        const orderText = this.recipes[orderKey].join(' + ');
        this.orderText = this.add.bitmapText(this.width / 2, 150, 'pixelfont', orderText, 32)
            .setOrigin(0.5)
            .setDepth(15);

        // Display order image above order text
        this.orderImage = this.add.image(this.width / 2, 100, orderKey)
            .setScale(0.3)
            .setOrigin(0.5)
            .setDepth(11);

        // Move customer to center
        this.tweens.add({
            targets: this.currentCustomer,
            y: this.height / 2 - 100,
            duration: 2000,
            ease: 'Power2',
            onComplete: () => {
                this.isServing = true;
            }
        });

        this.currentOrder = this.recipes[orderKey];
    }

    checkOrder() {
        if (this.selectedDishes.length === this.currentOrder.length) {
            const isCorrect = this.selectedDishes.every((dish, index) => dish === this.currentOrder[index]);
            
            if (isCorrect) {
                // this.sounds.correct.play();
                this.updateScore(1);
                this.satisfaction = Math.min(this.satisfaction + 10, this.maxSatisfaction);
                this.showFeedback('Correct!', 0x00ff00);
            } else {
                // this.sounds.wrong.play();
                this.showFeedback('Wrong!', 0xff0000);
                this.updateScore(-50);
                this.satisfaction = Math.max(this.satisfaction - 10, this.minSatisfaction);
                if (this.satisfaction <= 0) {
                    this.gameOver();
                    return;
                }
            }

            this.updateSatisfactionMeter();

            // Reset for next customer
            this.resetRound();
        }
    }

    showFeedback(text, color) {
        const feedback = this.add.bitmapText(this.width / 2, this.height / 2, 'pixelfont', text, 48)
            .setOrigin(0.5)
            .setTint(color)
            .setDepth(11);
        this.tweens.add({
            targets: feedback,
            alpha: 0,
            y: feedback.y - 50,
            duration: 1000,
            onComplete: () => feedback.destroy()
        });
    }

    resetRound() {
        this.currentCustomer.destroy();
        this.orderText.destroy();
        this.orderImage.destroy();
        this.currentCustomer = null;
        this.isServing = false;
        this.selectedDishes = [];
        
        // Reset dishes
        this.dishes.forEach(dish => {
            dish.setVisible(true);
            dish.x = dish.originalX;
            dish.y = dish.originalY;
        });

        // Spawn next customer after delay
        this.time.delayedCall(1000, this.spawnCustomer, [], this);
    }

    update() {
        if (this.isGameOver) return;

        // Update customer position to follow order text and image
        if (this.currentCustomer && this.orderText && this.orderImage) {
            this.orderText.x = this.currentCustomer.x;
            this.orderText.y = this.currentCustomer.y - 80;
            this.orderImage.x = this.currentCustomer.x;
            this.orderImage.y = this.currentCustomer.y - 130;
        }
    }

    updateScore(points) {
        this.score += points;
        if (this.score < 0) this.score = 0;
        this.scoreText.setText(this.score);
    }

    // gameOver() {
    //     this.isGameOver = true;
    //     this.sounds.background.stop();
    //     this.add.bitmapText(this.width / 2, this.height / 2, 'pixelfont', 'Game Over\nScore: ' + this.score, 64)
    //         .setOrigin(0.5)
    //         .setDepth(11);
    //     this.time.delayedCall(2000, () => {
    //         this.scene.restart();
    //     });
    // }

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