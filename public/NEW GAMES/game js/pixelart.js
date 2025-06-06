class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.colors = [
            0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff,
            0x00ffff, 0xffa500, 0x800080, 0x008000, 0x654321,
            0x000000, 0xffffff
        ];
    }

    preload() {
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
        
        

        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/";
        this.load.bitmapFont('pixelfont', fontBaseURL + 'pix.png', fontBaseURL + 'pix.xml');

        displayProgressLoader.call(this);
    }

    create() {
    this.width = this.game.config.width;
    this.height = this.game.config.height;
    this.isPortrait = this.height > this.width;
    this.gameIsOver = false;

    this.input.on('pointerdown', (pointer) => {
        console.log(`Pointer down at: ${pointer.x}, ${pointer.y}`);
    });

    this.sounds = {};
    for (const key in _CONFIG.soundsLoader) {
        this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
    }

    this.sounds.background.setVolume(0.2).setLoop(true).play();
    this.input.addPointer(3);

    // Move timer text up in portrait mode
    this.timeLimit = 60;
    this.timeRemaining = this.timeLimit;
    this.timerText = this.add.bitmapText(
        this.width * 0.5, 
        this.height * (this.isPortrait ? 0.03 : 0.05), 
        'pixelfont', 
        'Time: ' + this.timeRemaining, 
        this.isPortrait ? 18 : 24
    ).setOrigin(0.5).setDepth(1);

    // Background
    this.bg = this.add.image(this.width * 0.5, this.height * 0.5, "background")
        .setOrigin(0.5);
    const scale = Math.max(this.width / this.bg.displayWidth, this.height / this.bg.displayHeight);
    this.bg.setScale(scale);

    // Move level text up in portrait mode
    this.level = 1;
    this.levelText = this.add.bitmapText(
        this.width * 0.5, 
        this.height * (this.isPortrait ? 0.07 : 0.1), 
        'pixelfont', 
        'LEVEL ' + this.level, 
        this.isPortrait ? 24 : 32
    ).setOrigin(0.5);
    
    this.levelUpText = this.add.bitmapText(
        this.width * 0.5, 
        this.height * 0.3, 
        'pixelfont', 
        'LEVEL UP!', 
        this.isPortrait ? 36 : 48
    ).setOrigin(0.5).setDepth(11).setVisible(false);

    // Position pause button to avoid overlap
    this.pauseButton = this.add.sprite(
        this.width * (this.isPortrait ? 0.92 : 0.9), 
        this.height * (this.isPortrait ? 0.03 : 0.05), 
        "pauseButton"
    ).setOrigin(0.5)
     .setScale(this.isPortrait ? 0.7 : 1)
     .setInteractive({ cursor: 'pointer' })
     .on('pointerdown', () => this.pauseGame())
     .setScrollFactor(0);
    this.input.keyboard.on('keydown-ESC', () => this.pauseGame());

    // Fruit data
    this.fruitData = [
        { name: "apple", label: "APPLE", difficulty: 1 },
        { name: "orange", label: "ORANGE", difficulty: 1 },
        { name: "banana", label: "BANANA", difficulty: 2 },
        { name: "mango", label: "MANGO", difficulty: 2 },
        { name: "strawberry", label: "STRAWBERRY", difficulty: 3 },
        { name: "grapes", label: "GRAPES", difficulty: 3 },
        { name: "watermelon", label: "WATERMELON", difficulty: 4 },
        { name: "pineapple", label: "PINEAPPLE", difficulty: 4 }
    ];
    this.totalLevels = this.fruitData.length;

    this.setupPixelArtCanvas();
    this.setupColorPalette();
    this.setupReferenceImage();
    this.setupTools();
    this.startLevel();
}

createReferencePattern() {
    if (this.referencePattern) {
        for (let y = 0; y < this.referencePattern.length; y++) {
            for (let x = 0; x < this.referencePattern[y].length; x++) {
                if (this.referencePattern[y][x]) this.referencePattern[y][x].destroy();
            }
        }
    }

    this.referencePattern = [];
    this.targetPattern = [];
    
    // Smaller reference cells in portrait mode
    const refCellSize = this.cellSize * (this.isPortrait ? 0.7 : 0.8);
    const refCanvasWidth = this.gridSize * refCellSize;
    const refCanvasHeight = this.gridSize * refCellSize;

    for (let y = 0; y < this.gridSize; y++) {
        this.referencePattern[y] = [];
        this.targetPattern[y] = [];
        for (let x = 0; x < this.gridSize; x++) {
            const cellX = (x * refCellSize) - refCanvasWidth/2 + refCellSize/2;
            const cellY = (y * refCellSize) - refCanvasHeight/2 + refCellSize/2;
            let fillColor = 0xffffff;
            this.targetPattern[y][x] = null;

            const refPixel = this.add.rectangle(cellX, cellY, refCellSize-2, refCellSize-2, fillColor)
                .setOrigin(0.5)
                .setVisible(true);
            this.referencePattern[y][x] = refPixel;
            this.referenceContainer.add(refPixel);
        }
    }
}
    colorsAreClose(color1, color2) {
    // Extract RGB components
    const r1 = (color1 >> 16) & 0xFF;
    const g1 = (color1 >> 8) & 0xFF;
    const b1 = color1 & 0xFF;
    
    const r2 = (color2 >> 16) & 0xFF;
    const g2 = (color2 >> 8) & 0xFF;
    const b2 = color2 & 0xFF;
    
    // Calculate color distance using simple Euclidean distance
    const distance = Math.sqrt(
        Math.pow(r1 - r2, 2) + 
        Math.pow(g1 - g2, 2) + 
        Math.pow(b1 - b2, 2)
    );
    
    // Colors are "close enough" if distance is less than threshold
    // Adjust threshold as needed (30 is relatively permissive)
    return distance < 30;
}

    setupPixelArtCanvas() {
    this.baseGridSize = 6;
    this.gridSize = this.calculateGridSize();
    
    // Smaller cell size in portrait mode to leave more space
    this.cellSize = this.isPortrait 
        ? Math.min(this.width, this.height) * 0.04
        : Math.min(this.width, this.height) * 0.05;

    // Move canvas position up in portrait mode
    this.canvasContainer = this.add.container(
        this.width * 0.5, 
        this.height * (this.isPortrait ? 0.4 : 0.4)
    );
    this.createCanvas();
}

    createCanvas() {
        const canvasWidth = this.gridSize * this.cellSize;
        const canvasHeight = this.gridSize * this.cellSize;

        if (this.canvasBg) this.canvasBg.destroy();
        if (this.pixels) {
            for (let y = 0; y < this.pixels.length; y++) {
                for (let x = 0; x < this.pixels[y].length; x++) {
                    if (this.pixels[y][x]) this.pixels[y][x].destroy();
                }
            }
        }

        this.canvasBg = this.add.rectangle(0, 0, canvasWidth, canvasHeight, 0xcccccc)
            .setOrigin(0.5)
            .setStrokeStyle(4, 0x333333);
        this.canvasContainer.add(this.canvasBg);

        this.pixels = [];
        for (let y = 0; y < this.gridSize; y++) {
            this.pixels[y] = [];
            for (let x = 0; x < this.gridSize; x++) {
                const cellX = (x - this.gridSize/2) * this.cellSize + this.cellSize/2;
                const cellY = (y - this.gridSize/2) * this.cellSize + this.cellSize/2;

                const pixel = this.add.rectangle(cellX, cellY, this.cellSize-2, this.cellSize-2, 0xffffff)
                    .setOrigin(0.5)
                    .setInteractive({ useHandCursor: true })
                    .setData('filled', false)
                    .setData('x', x)
                    .setData('y', y)
                    .setData('targetColor', null);

                this.pixels[y][x] = pixel;
                this.canvasContainer.add(pixel);

                pixel.on('pointerdown', () => this.paintPixel(pixel));
                pixel.on('pointerover', () => {
                    if (this.input.mousePointer.isDown || this.input.activePointer.isDown) {
                        this.paintPixel(pixel);
                    }
                });
            }
        }
    }

    calculateGridSize() {
        const fruitIndex = (this.level - 1) % this.fruitData.length;
        const currentFruit = this.fruitData[fruitIndex].name;

        const fruitGridSizes = {
            "apple": 6, "banana": 8, "mango": 7, "orange": 6,
            "strawberry": 9, "watermelon": 10, "pineapple": 11, "grapes": 10
        };

        const baseSizeForFruit = fruitGridSizes[currentFruit] || 8;
        const levelIncrease = Math.floor((this.level - 1) / 8) * 2;
        return Math.min(baseSizeForFruit + levelIncrease, 16);
    }

    setupColorPalette() {
    // Move palette further down in portrait mode
    const paletteY = this.height * (this.isPortrait ? 0.82 : 0.75);
    const paletteWidth = this.width * (this.isPortrait ? 0.9 : 0.8);
    const paletteHeight = this.height * 0.05;

    this.add.rectangle(this.width * 0.5, paletteY, paletteWidth, paletteHeight, 0x333333)
        .setOrigin(0.5);

    // Smaller font and move label closer to palette
    this.add.bitmapText(
        this.width * 0.5, 
        paletteY - this.height * (this.isPortrait ? 0.03 : 0.04), 
        'pixelfont', 
        'COLOR PALETTE', 
        this.isPortrait ? 14 : 20
    ).setOrigin(0.5);

    // Smaller color boxes in portrait mode
    const colorBoxSize = Math.min(
        paletteWidth / this.colors.length, 
        this.height * (this.isPortrait ? 0.03 : 0.04)
    );
    const startX = (this.width - (colorBoxSize * this.colors.length)) / 2;

    this.colorButtons = [];
    this.colors.forEach((color, index) => {
        const x = startX + (index * colorBoxSize) + colorBoxSize/2;
        const colorBtn = this.add.rectangle(x, paletteY, colorBoxSize - 2, colorBoxSize - 2, color)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setStrokeStyle(1, 0x000000);

        colorBtn.on('pointerdown', () => {
            this.selectColor(color);
            this.colorButtons.forEach(btn => btn.setStrokeStyle(1, 0x000000));
            colorBtn.setStrokeStyle(2, 0xffffff);
        });

        this.colorButtons.push(colorBtn);
    });

    this.currentColor = this.colors[0];
    this.colorButtons[0].setStrokeStyle(2, 0xffffff);
}

    setupReferenceImage() {
    // In portrait mode, position reference image at top
    const referenceX = this.width * (this.isPortrait ? 0.5 : 0.75);
    const referenceY = this.height * (this.isPortrait ? 0.16 : 0.45);
    
    this.referenceContainer = this.add.container(
        referenceX, 
        referenceY
    );

    // Create a background for the reference title
    this.referenceTitle = this.add.bitmapText(
        referenceX, 
        referenceY - (this.gridSize * this.cellSize * 0.5) - 20,
        'pixelfont', 
        'REFERENCE', 
        this.isPortrait ? 16 : 24 // Smaller font in portrait mode
    ).setOrigin(0.5);
}

   setupTools() {
    // Position submit button at bottom
    this.submitButton = this.add.sprite(
        this.width * 0.5, 
        this.height * 0.92, // Move down in both modes
        "checkmark"
    ).setOrigin(0.5)
     .setScale(this.isPortrait ? 0.2 : 0.3)
     .setInteractive({ cursor: 'pointer' })
     .on('pointerdown', () => this.checkDrawing());

    // Calculate positions based on canvas position
    const canvasBottom = this.canvasContainer ? 
        (this.canvasContainer.y + (this.gridSize * this.cellSize / 2)) : this.height * 0.4;
    
    // In portrait mode, position eraser below canvas with more space
    const eraserY = this.isPortrait ?
        Math.min(canvasBottom + (this.height * 0.1), this.height * 0.65) : 
        this.height * 0.65;

    this.eraser = this.add.sprite(
        this.width * (this.isPortrait ? 0.25 : 0.15), // Move eraser to the left in portrait
        eraserY,
        "eraser"
    ).setOrigin(0.5)
     .setScale(this.isPortrait ? 0.05 : 0.07)
     .setInteractive({ cursor: 'pointer' })
     .on('pointerdown', () => {
         this.currentColor = 0xffffff;
         this.colorButtons.forEach(btn => btn.setStrokeStyle(1, 0x000000));
     });

    // Position text above eraser
    this.eraserText = this.add.bitmapText(
        this.width * (this.isPortrait ? 0.25 : 0.15), // Keep aligned with eraser 
        eraserY - (this.height * 0.04), // Closer to eraser
        'pixelfont', 
        'ERASER', 
        this.isPortrait ? 16 : 24 // Smaller font in portrait mode
    ).setOrigin(0.5);
}
    generateFruitReference() {
    if (this.referenceSprite) this.referenceSprite.destroy();
    
    // Clear existing reference pattern
    if (this.referencePattern) {
        for (let y = 0; y < this.referencePattern.length; y++) {
            for (let x = 0; x < this.referencePattern[y].length; x++) {
                if (this.referencePattern[y][x]) this.referencePattern[y][x].destroy();
            }
        }
    }

    const fruitIndex = (this.level - 1) % this.fruitData.length;
    const currentFruit = this.fruitData[fruitIndex];
    console.log(`Level ${this.level} - Drawing fruit: ${currentFruit.name}`);
    
    // Update the text content with smaller font in portrait mode
    this.referenceTitle.setText(currentFruit.label)
                        .setFontSize(this.isPortrait ? 16 : 24);
    
    // Make sure it's positioned correctly after text update
    const refGridSize = this.gridSize;
    const refCellSize = this.cellSize * (this.isPortrait ? 0.7 : 0.8);
    const referenceY = this.referenceContainer.y;
    
    // Reposition the title to be above the grid with enough space
    this.referenceTitle.y = referenceY - (refGridSize * refCellSize * 0.5) - 20;

    const refCanvasWidth = refGridSize * refCellSize;
    const refCanvasHeight = refGridSize * refCellSize;

    const refBg = this.add.rectangle(0, 0, refCanvasWidth, refCanvasHeight, 0xcccccc)
        .setOrigin(0.5)
        .setStrokeStyle(2, 0x333333);
    this.referenceContainer.add(refBg);

    this.createReferencePattern();
    this.drawFruitPattern(currentFruit.name);
}
drawFruitPattern(fruitName) {
    switch(fruitName) {
        case "apple": this.createApplePattern(); break;
        case "banana": this.createBananaPattern(); break;
        case "mango": this.createMangoPattern(); break;
        case "orange": this.createOrangePattern(); break;
        case "strawberry": this.createStrawberryPattern(); break;
        case "watermelon": this.createWatermelonPattern(); break;
        case "pineapple": this.createPineapplePattern(); break;
        case "grapes": this.createGrapesPattern(); break;
        default: this.createApplePattern();
    }
}

    createPixelatedFruit(fruitName, gridSize) {
        this.referencePattern = [];
        this.targetPattern = [];
        const refCellSize = this.cellSize * 0.8;
        const refCanvasWidth = gridSize * refCellSize;
        const refCanvasHeight = gridSize * refCellSize;

        for (let y = 0; y < gridSize; y++) {
            this.referencePattern[y] = [];
            this.targetPattern[y] = [];
            for (let x = 0; x < gridSize; x++) {
                const cellX = (x * refCellSize) - refCanvasWidth/2 + refCellSize/2;
                const cellY = (y * refCellSize) - refCanvasHeight/2 + refCellSize/2;
                let fillColor = 0xffffff;
                this.targetPattern[y][x] = null;

                const refPixel = this.add.rectangle(cellX, cellY, refCellSize-2, refCellSize-2, fillColor)
                    .setOrigin(0.5)
                    .setVisible(true);
                this.referencePattern[y][x] = refPixel;
                this.referenceContainer.add(refPixel);
            }
        }

        switch(fruitName) {
            case "apple": this.createApplePattern(); break;
            case "banana": this.createBananaPattern(); break;
            case "mango": this.createMangoPattern(); break;
            case "orange": this.createOrangePattern(); break;
            case "strawberry": this.createStrawberryPattern(); break;
            case "watermelon": this.createWatermelonPattern(); break;
            case "pineapple": this.createPineapplePattern(); break;
            case "grapes": this.createGrapesPattern(); break;
            default: this.createApplePattern();
        }
    }

    setFruitPixel(x, y, color) {
    if (x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize) {
        this.targetPattern[y][x] = color;
        if (this.pixels && this.pixels[y] && this.pixels[y][x]) {
            this.pixels[y][x].setData('targetColor', color);
        }
        if (this.referencePattern && this.referencePattern[y] && this.referencePattern[y][x]) {
            this.referencePattern[y][x].setFillStyle(color);
        }
    }
}
    createApplePattern() {
        const red = 0xff0000, green = 0x00ff00, brown = 0x654321;
        const center = Math.floor(this.gridSize / 2);
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const distX = x - center, distY = y - center;
                const dist = Math.sqrt(distX * distX + distY * distY);
                if (dist < this.gridSize / 2.5 && y > center / 2) this.setFruitPixel(x, y, red);
                if (Math.abs(distX) < 1 && y < center && y > center / 2) this.setFruitPixel(x, y, brown);
                if (distX > 0 && distX < 3 && y < center && y > center / 3) this.setFruitPixel(x, y, green);
            }
        }
    }

    createBananaPattern() {
        const yellow = 0xffff00, brown = 0x654321;
        const center = Math.floor(this.gridSize / 2);
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const distFromCurve = Math.abs(y - (center + Math.sin((x - center) * 0.5) * 2));
                if (x >= center - 3 && x <= center + 3 && distFromCurve < 1.5) this.setFruitPixel(x, y, yellow);
                if ((x === center - 3 || x === center + 3) && Math.abs(y - center) < 2) this.setFruitPixel(x, y, brown);
            }
        }
    }

    createMangoPattern() {
        const orange = 0xffa500, yellow = 0xffff00, green = 0x00ff00;
        const center = Math.floor(this.gridSize / 2);
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const distX = (x - center) / 2, distY = y - center;
                const dist = Math.sqrt(distX * distX + distY * distY);
                if (dist < this.gridSize / 4) {
                    this.setFruitPixel(x, y, y < center ? orange : yellow);
                }
                if (Math.abs(distX) < 0.5 && y < center - this.gridSize / 5) this.setFruitPixel(x, y, green);
            }
        }
    }

    createOrangePattern() {
        const orange = 0xffa500, brown = 0x654321;
        const center = Math.floor(this.gridSize / 2);
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const distX = x - center, distY = y - center;
                const dist = Math.sqrt(distX * distX + distY * distY);
                if (dist < this.gridSize / 3) this.setFruitPixel(x, y, orange);
                if (Math.abs(distX) < 1 && y === center - Math.floor(this.gridSize / 3)) this.setFruitPixel(x, y, brown);
            }
        }
    }

    createStrawberryPattern() {
        const red = 0xff0000, green = 0x00ff00, yellow = 0xffff00;
        const center = Math.floor(this.gridSize / 2);
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const distX = x - center, distY = y - center;
                if (y >= center - 1 && Math.abs(distX) < (this.gridSize / 4) * (1 - (y - center) / this.gridSize)) {
                    this.setFruitPixel(x, y, red);
                    if ((x + y) % 3 === 0) this.setFruitPixel(x, y, yellow);
                }
                if (y < center - 1 && y > center - 3 && Math.abs(distX) < 2) this.setFruitPixel(x, y, green);
            }
        }
    }

    createWatermelonPattern() {
    const red = 0xff0000, green = 0x008000, black = 0x000000;
    const center = Math.floor(this.gridSize / 2);

    for (let y = 0; y < this.gridSize; y++) {
        for (let x = 0; x < this.gridSize; x++) {
            const distX = x - center, distY = y - center;
            const dist = Math.sqrt(distX * distX + distY * distY);
            
            // Ensure pattern fits within grid bounds
            if (dist < this.gridSize / 2.5) {
                if (y >= center) {
                    this.setFruitPixel(x, y, red);
                    if ((x + y) % 4 === 0 && y > center) this.setFruitPixel(x, y, black);
                }
                if (dist > this.gridSize / 3 && y >= center) {
                    this.setFruitPixel(x, y, green);
                }
            }
        }
    }
}

    createPineapplePattern() {
        const yellow = 0xffff00, green = 0x008000, brown = 0x654321;
        const center = Math.floor(this.gridSize / 2);
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const distX = x - center, distY = y - center;
                if (Math.abs(distX) < this.gridSize / 4 && y > center - this.gridSize / 4 && y < center + this.gridSize / 2.5) {
                    this.setFruitPixel(x, y, yellow);
                    if ((x + y) % 2 === 0) this.setFruitPixel(x, y, brown);
                }
                if (Math.abs(distX) < this.gridSize / 4 && y <= center - this.gridSize / 4 && y > center - this.gridSize / 2.5) {
                    this.setFruitPixel(x, y, green);
                }
            }
        }
    }

    createGrapesPattern() {
        const purple = 0x800080, green = 0x008000;
        const center = Math.floor(this.gridSize / 2);
        const grapePositions = [
            {x: center, y: center}, {x: center-1, y: center+1}, {x: center+1, y: center+1},
            {x: center-2, y: center+2}, {x: center, y: center+2}, {x: center+2, y: center+2},
            {x: center-1, y: center+3}, {x: center+1, y: center+3}
        ];

        grapePositions.forEach(pos => {
            for (let y = pos.y - 1; y <= pos.y + 1; y++) {
                for (let x = pos.x - 1; x <= pos.x + 1; x++) {
                    const dist = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
                    if (dist < 1.2) this.setFruitPixel(x, y, purple);
                }
            }
        });

        for (let y = center - 3; y < center; y++) {
            for (let x = center - 1; x <= center + 1; x++) {
                if (Math.abs(x - center) < 2 && y > center - 3) this.setFruitPixel(x, y, green);
            }
        }
    }

    selectColor(color) {
        this.currentColor = color;
    }

    paintPixel(pixel) {
        try {
            if (this.sounds.collectible) this.sounds.collectible.play();
        } catch(e) {
            console.error("Error playing sound:", e);
        }

        const x = pixel.getData('x');
        const y = pixel.getData('y');
        console.log(`Painting pixel at (${x}, ${y}) with color ${this.currentColor}`);
        pixel.setFillStyle(this.currentColor);
        pixel.setData('filled', true);
        pixel.setData('fillColor', this.currentColor);
    }

    checkDrawing() {
    let correct = 0, total = 0;
    
    for (let y = 0; y < this.gridSize; y++) {
        for (let x = 0; x < this.gridSize; x++) {
            const targetColor = this.targetPattern[y][x];
            const pixel = this.pixels[y][x];
            const currentColor = pixel.getData('fillColor') || 0xffffff;

            if (targetColor !== null) {
                total++;
                // Fix: Normalize colors for comparison by removing alpha channel if present
                const targetHex = (targetColor & 0xFFFFFF).toString(16).padStart(6, '0');
                const currentHex = (currentColor & 0xFFFFFF).toString(16).padStart(6, '0');
                
                // Use color tolerance for watermelon at level 7
                const isWatermelon = this.level === 7;
                const isClose = this.colorsAreClose(targetColor, currentColor);
                
                if (targetHex === currentHex || (isWatermelon && isClose)) {
                    correct++;
                }
            }
        }
    }

    const accuracy = total > 0 ? (correct / total) * 100 : 0;
    console.log(`Correct: ${correct}, Total: ${total}, Accuracy: ${accuracy.toFixed(1)}%`);

    if (this.accuracyText) this.accuracyText.destroy();
    
    // Position accuracy text in a clear space
    this.accuracyText = this.add.bitmapText(
        this.width * 0.5, 
        this.height * (this.isPortrait ? 0.73 : 0.85), // Higher in portrait mode
        'pixelfont', 
        `Accuracy: ${accuracy.toFixed(1)}%`, 
        this.isPortrait ? 28 : 36
    ).setOrigin(0.5).setDepth(10); // Higher depth to ensure visibility

    // Fix for level 7 watermelon: if it's level 7 and accuracy is very close to 100%
    if (accuracy >= 99.9 || (this.level === 7 && accuracy >= 80)) {
    if (this.sounds.levelup) this.sounds.levelup.play();
    this.levelUpText.setVisible(true);
    if (this.timerEvent) this.timerEvent.remove();

    // Change this condition to check for level 8 (pineapple) instead of totalLevels
    if (this.level === 8) {
        const congratsText = this.add.bitmapText(
            this.width * 0.5, 
            this.height * 0.5, 
            'pixelfont',
            "CONGRATULATIONS\nYOU'RE AN ARTIST!", 
            this.isPortrait ? 36 : 48
        ).setOrigin(0.5).setDepth(10);

        this.time.delayedCall(3000, () => {
            congratsText.destroy();
            this.gameOver(true);
        });
    } else {
        // Immediately destroy the accuracy text if level is passed
        if (this.accuracyText) {
            this.accuracyText.destroy();
            this.accuracyText = null;
        }
        
        this.time.delayedCall(1500, () => {
            this.level++;
            this.startLevel();
            this.levelUpText.setVisible(false);
        });
    }
}
    }

    startLevel() {
        this.levelText.setText('LEVEL ' + this.level);
        this.gridSize = this.calculateGridSize();
        this.createCanvas();
        this.generateFruitReference();

        this.timeRemaining = this.timeLimit;
        this.timerText.setText('Time: ' + this.timeRemaining);
        if (this.timerEvent) this.timerEvent.remove();

        this.timerEvent = this.time.addEvent({
            delay: 1000,
            callback: this.updateTimer,
            callbackScope: this,
            loop: true
        });
    }

    updateTimer() {
        this.timeRemaining--;
        this.timerText.setText('Time: ' + this.timeRemaining);
        if (this.timeRemaining <= 0) {
            if (this.timerEvent) this.timerEvent.remove();
            if (this.sounds.failure) this.sounds.failure.play();
            this.gameOver();
        }
    }

    update() {}

    gameOver(completed = false) {
        if (this.timerEvent) this.timerEvent.remove();
        initiateGameOver.bind(this)({
            "level": this.level,
            "completed": completed
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
    width: window.innerWidth,
    height: window.innerHeight,
    scene: [GameScene],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    pixelArt: true,
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    dataObject: {
        name: _CONFIG.title || "Pixel Art Drawing Game",
        description: _CONFIG.description || "Learn to draw pixel art by copying reference images!",
        instructions: _CONFIG.instructions || "Use the color palette to fill in the pixel grid to match the reference image!"
    }
};

window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});
