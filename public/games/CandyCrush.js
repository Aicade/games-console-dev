// CandyCrush.js

// Import the Braincade SDK functions (adjust the import path as needed)
// import { addEventListenersPhaser, handlePauseGame } from './braincadeSDK.js';


if (/Mobi|Android/i.test(navigator.userAgent)) {
    _CONFIG.deviceOrientation = "portrait";
}

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.score = 0;
        // Updated target score to 12000.
        this.targetScore = 12000;
    }
    
    preload() {
        // Load images from JSON config
        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }
        // NOTE: We removed the external star asset load.
        
        // Load sounds from JSON config
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        // Load the star sound.
        this.load.audio('starSound', 'https://files.catbox.moe/9wqm2a.mp3');
        
        // Load bitmap font for UI
        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/";
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');
        // Load pause button asset from base code
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
        
        displayProgressLoader.call(this);
    }
    
    create() {
        // Stop any previously playing sounds (useful on restart).
        this.sound.stopAll();
        // Reset score.
        this.score = 0;
        
        // Register Braincade SDK event listeners.
        addEventListenersPhaser.bind(this)();

        // Instantiate the VFX library for this scene.
        this.vfx = new VFXLibrary(this);

        // Create the star shape texture.
        this.createStarShape();

        // Initialize sounds.
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: key === 'background', volume: 0.5 });
        }
        // Add the star sound.
        this.sounds.starSound = this.sound.add('starSound', { volume: 0.5 });

        // Streak text.
// Define default streak text coordinates.
let streakTextX = 20;
let streakTextY = 70;

// If on mobile, update the position.
if (/Mobi|Android/i.test(navigator.userAgent)) {
    streakTextX = 350;  // New x-coordinate for mobile (adjust as needed)
    streakTextY = 310;  // New y-coordinate for mobile (adjust as needed)
}

// Create the streak text using the calculated coordinates.
this.streakText = this.add.bitmapText(streakTextX, streakTextY, 'pixelfont', '', 28)
    .setOrigin(-2, 0)
    .setDepth(102);


        // Create a trail texture.
        let trailGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        trailGraphics.fillStyle(0xffffff, 1);
        trailGraphics.fillCircle(10, 10, 10);
        trailGraphics.generateTexture('trail', 20, 20);

        // Set background image to fill the screen.
        this.bg = this.add.sprite(0, 0, 'background').setOrigin(0, 0);
        this.bg.displayWidth = this.game.config.width;
        this.bg.displayHeight = this.game.config.height;
        
        this.width = this.game.config.width;
        this.height = this.game.config.height;

        // UI: Display Score and Timer.
// Create score text.
// Determine default score text position.
let scoreTextX = 20;
let scoreTextY = 20;

// If on mobile, update the position.
if (/Mobi|Android/i.test(navigator.userAgent)) {
    scoreTextX = 250;  // New x-coordinate for mobile
    scoreTextY = 250;  // New y-coordinate for mobile
}

// Create score text at the determined position.
this.scoreText = this.add.bitmapText(scoreTextX, scoreTextY, 'pixelfont', 'Score: 0', 32);
this.scoreText.setDepth(10);

// Calculate text bounds and define padding/extra width.
let bounds = this.scoreText.getTextBounds();
let paddingX = 10;
let paddingY = 5;
let extraWidth = 100; // Updated extra width value

// Create a graphics object to draw the rounded rectangle background.
this.scoreBg = this.add.graphics();

// Draw the filled rounded rectangle.
this.scoreBg.fillStyle(0xffc107, 1);
this.scoreBg.fillRoundedRect(
    this.scoreText.x - paddingX,
    this.scoreText.y - paddingY,
    bounds.global.width + 2 * paddingX + extraWidth,
    bounds.global.height + 2 * paddingY,
    10 // Corner radius
);

// Draw the black boundary around the rectangle.
this.scoreBg.lineStyle(3, 0x000000, 1);
this.scoreBg.strokeRoundedRect(
    this.scoreText.x - paddingX,
    this.scoreText.y - paddingY,
    bounds.global.width + 2 * paddingX + extraWidth,
    bounds.global.height + 2 * paddingY,
    10
);

// Ensure the background appears behind the score text.
this.scoreBg.setDepth(this.scoreText.depth - 1);



        
// Define the circle radius for the timer background.
let timerRadius = 50; // adjust as needed

// Manually set the circle's position.
let timerCircleX = 1100; // your custom x-coordinate
let timerCircleY = 60;   // your custom y-coordinate

// Create a graphics object at your specified position.
this.timerBg = this.add.graphics({ x: timerCircleX, y: timerCircleY });

// Draw the filled circle.
this.timerBg.fillStyle(0xffc107, 1);
this.timerBg.fillCircle(0, 0, timerRadius);

// Add a black boundary by setting a line style and drawing the circle outline.
this.timerBg.lineStyle(3, 0x000000, 1);
this.timerBg.strokeCircle(0, 0, timerRadius);

// Create timer text with centered origin.
this.timerText = this.add.bitmapText(timerCircleX, timerCircleY, 'pixelfont', '120', 32)
    .setOrigin(0.5, 0.5);

// If needed, adjust by a few pixels:
this.timerText.x = timerCircleX - 5; // adjust horizontal offset as needed
this.timerText.y = timerCircleY - 5; // adjust vertical offset as needed

// Ensure the timer text appears above the circle.
this.timerText.setDepth(this.timerBg.depth + 1);




        // **** Add Progress Bar UI with Rounded Corners ****
// For desktop (default)
this.progressBarWidth = 500;  // Increased width
this.progressBarHeight = 30;  // Increased height
this.progressBarY = 20;       // Top center

// For mobile devices, you might want different values
if (/Mobi|Android/i.test(navigator.userAgent)) {
    this.progressBarWidth = 550;  // Even wider for mobile
    this.progressBarHeight = 70;  // Taller for mobile
    this.progressBarY = 60;       // And moved lower
}

// Recalculate the x position so that the progress bar remains centered.
this.progressBarX = (this.width - this.progressBarWidth) / 2;

// Create the progress bar background with a black boundary.
this.progressBarBg = this.add.graphics();
this.progressBarBg.fillStyle(0x666666, 1);
this.progressBarBg.fillRoundedRect(
    this.progressBarX,
    this.progressBarY - this.progressBarHeight / 2,
    this.progressBarWidth,
    this.progressBarHeight,
    10  // corner radius
);

this.progressBarBg.lineStyle(3, 0x000000, 1);
this.progressBarBg.strokeRoundedRect(
    this.progressBarX,
    this.progressBarY - this.progressBarHeight / 2,
    this.progressBarWidth,
    this.progressBarHeight,
    10
);

// Create the progress bar fill (green) with updated dimensions.
this.progressBarFill = this.add.graphics();
this.progressBarFill.fillStyle(0x00ff00, 1);
this.progressBarFill.fillRoundedRect(
    this.progressBarX,
    this.progressBarY - this.progressBarHeight / 2,
    0,  // Initially 0 progress
    this.progressBarHeight,
    10
);

        
        // Text to display numeric progress.
        this.progressText = this.add.bitmapText(
            this.width / 2,
            this.progressBarY,
            'pixelfont',
            `0 / ${this.targetScore}`,
            20
        ).setOrigin(0.5);

        // Add Pause Button at top-right.
        this.pauseButton = this.add.sprite(this.width - 60, 60, "pauseButton")
                                     .setOrigin(0.5, 0.5)
                                     .setInteractive({ cursor: 'pointer' })
                                     .setScale(1.5)
                                     .setDepth(101);
        this.pauseButton.on('pointerdown', () => {
            handlePauseGame.call(this);
        });
        
// Grid Setup: 8 columns x 7 rows with fixed tile size (80).
this.tileTypes = ['candy_1', 'candy_2', 'candy_3'];
this.numCols = 8;
this.numRows = 7;
this.tileWidth = 80;
this.tileHeight = 80;
this.gridOffsetX = (this.width - (this.numCols * this.tileWidth)) / 2;
this.gridOffsetY = 100; // default value

// Adjust the grid offset for mobile devices.
if (/Mobi|Android/i.test(navigator.userAgent)) {
    this.gridOffsetY += 300; // Increase the offset by 80 pixels on mobile
}

// Now, when you draw the grid, it will use the updated this.gridOffsetY.
this.drawChessBoard();
this.drawGridLines();

        
        // Create 2D tile array.
        this.tileGrid = [];
        for (let i = 0; i < this.numCols; i++) {
            this.tileGrid[i] = [];
            for (let j = 0; j < this.numRows; j++) {
                this.tileGrid[i][j] = null;
            }
        }
        
        // Draw the chessboard-style background.
        this.drawChessBoard();
        // Draw subtle inner grid lines with a rounded outer border.
        this.drawGridLines();
        
        this.activeTile1 = null;
        this.activeTile2 = null;
        this.canMove = false;
        
        // Initialize chain counter.
        this.chainCount = 0;
        
        let seed = Date.now();
        this.random = new Phaser.Math.RandomDataGenerator([seed]);
        this.initTiles();
        
        // Timer event: 120 seconds countdown.
        this.timerEvent = this.time.addEvent({
            delay: 120000,
            callback: () => this.gameOver(),
            callbackScope: this
        });
        
        // Start background music on first pointer interaction.
        this.input.on('pointerdown', () => {
            if (!this.sounds.background.isPlaying) {
                this.sounds.background.play();
            }
        });
        
        this.canMove = true;
    }
    
    update() {
        // Handle tile swap based on pointer movement.
        if (this.activeTile1 && !this.activeTile2) {
            let pointer = this.input.activePointer;
            let tilePos = this.getTileCoordinates(pointer.x, pointer.y);
            let hoverPosX = tilePos.x;
            let hoverPosY = tilePos.y;
            let difX = hoverPosX - this.startPosX;
            let difY = hoverPosY - this.startPosY;
            if (hoverPosX >= 0 && hoverPosX < this.numCols && hoverPosY >= 0 && hoverPosY < this.numRows) {
                if ((Math.abs(difY) === 1 && difX === 0) || (Math.abs(difX) === 1 && difY === 0)) {
                    this.canMove = false;
                    this.activeTile2 = this.tileGrid[hoverPosX][hoverPosY];
                    this.swapTiles();
                    this.time.delayedCall(500, () => {
                        this.checkMatch();
                    });
                }
            }
        }
        
        // Update timer text and add pulse effect.
        if (this.timerEvent) {
            let remainingTime = Math.floor((this.timerEvent.delay - this.timerEvent.getElapsed()) / 1000);
            this.timerText.setText(remainingTime.toString());
            this.tweens.add({
                targets: this.timerText,
                scale: { from: 1.2, to: 1 },
                duration: 200,
                ease: 'Power1'
            });
            if (remainingTime <= 0) {
                this.timerEvent = null;
            }
        }
    }
    
    // Create a star shape texture for award purposes.
    createStarShape() {
        let graphics = this.make.graphics({ x: 0, y: 0, add: false });
        let radius = 20;
        let cx = radius, cy = radius;
        // Fill star with yellow.
        graphics.fillStyle(0xffff00, 1);
        // Add a black stroke (2 pixels thick).
        graphics.lineStyle(2, 0x000000, 1);
        graphics.beginPath();
        let spikes = 5;
        let outerRadius = radius;
        let innerRadius = radius / 2;
        let rot = Math.PI / 2 * 3;
        let step = Math.PI / spikes;
        graphics.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            let x = cx + Math.cos(rot) * outerRadius;
            let y = cy + Math.sin(rot) * outerRadius;
            graphics.lineTo(x, y);
            rot += step;
            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            graphics.lineTo(x, y);
            rot += step;
        }
        graphics.lineTo(cx, cy - outerRadius);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
        graphics.generateTexture('starShape', radius * 2, radius * 2);
        graphics.destroy();
    }
    
    // Update the progress bar fill and award stars at thresholds.
    updateProgressBar() {
        let progress = Phaser.Math.Clamp(this.score / this.targetScore, 0, 1);
        let fillWidth = this.progressBarWidth * progress;
        
        // Clear and redraw the fill.
        this.progressBarFill.clear();
        this.progressBarFill.fillStyle(0x00ff00, 1);
        if (fillWidth > 0) {
            this.progressBarFill.fillRoundedRect(
                this.progressBarX,
                this.progressBarY - this.progressBarHeight / 2,
                fillWidth,
                this.progressBarHeight,
                10
            );
        }
        
        // Update numeric display.
        this.progressText.setText(`${this.score} / ${this.targetScore}`);
        
        // Award stars when progress thresholds are met.
        if (progress >= 0.25 && (!this.starAwarded || !this.starAwarded[25])) {
            this.awardStar(25);
        }
        if (progress >= 0.60 && (!this.starAwarded || !this.starAwarded[60])) {
            this.awardStar(60);
        }
        if (progress >= 1 && (!this.starAwarded || !this.starAwarded[100])) {
            this.awardStar(100);
        }
        
        // Check win condition.
        if (this.score >= this.targetScore) {
            this.gameWin();
        }
    }
    
    // Award a star for reaching a specific threshold.
    awardStar(threshold) {
        // Track awarded stars to prevent duplicates.
        this.starAwarded = this.starAwarded || {};
        this.starAwarded[threshold] = true;
        
        // Play the star sound.
        this.sounds.starSound.play();
        
        // Starting position: center of the progress bar.
        let startX = this.progressBarX + this.progressBarWidth / 2;
        let startY = this.progressBarY;
        
        // Determine target X based on threshold.
        let offsetX = 50; // Adjust spacing as needed.
        let targetX;
        if (threshold === 25) {
            targetX = startX - offsetX;
        } else if (threshold === 60) {
            targetX = startX;
        } else if (threshold === 100) {
            targetX = startX + offsetX;
        }
        
        // Adjust target Y: place the star further below the progress bar.
        let targetY = this.progressBarY + this.progressBarHeight / 2 + 40;
        
        // Create the star sprite using the generated 'starShape' texture.
        let star = this.add.sprite(startX, startY, 'starShape');
        star.setScale(0); // Start at 0 scale for a pop-up effect.
        if (!this.awardedStars) this.awardedStars = [];
        this.awardedStars.push(star);
        
        // First tween: Pop-up effect (scale from 0 to 1.2).
        this.tweens.add({
            targets: star,
            scale: 1.2,
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Second tween: Move the star to its target position.
                this.tweens.add({
                    targets: star,
                    x: targetX,
                    y: targetY,
                    duration: 500,
                    ease: 'Cubic.easeOut'
                });
            }
        });
    }
    
    // Called when the target score is reached.
    gameWin() {
        // Instead of immediately ending, we call gameOver() to animate end effects.
        this.gameOver();
    }
    
    // End-of-timer game over: blur everything except the awarded stars,
    // then arrange the stars side-by-side and animate them to a row at center.
    gameOver() {
        // Stop tile interactions.
        this.canMove = false;
        
        // Apply blur to main camera.
        if (this.cameras.main.setPostPipeline) {
            this.cameras.main.setPostPipeline('BlurPostFX');
        }
        
        // Rearrange awarded stars so they do not overlap.
        let totalStars = this.awardedStars ? this.awardedStars.length : 0;
        let centerX = this.width / 2;
        let spacing = 60; // spacing between stars
        let targetY = this.height / 2; // vertical center for stars
        
        if (this.awardedStars && totalStars > 0) {
            this.awardedStars.forEach((star, index) => {
                // Remove blur from the star.
                if (star.clearPipeline) {
                    star.clearPipeline();
                }
                // Calculate target X for this star so they are arranged side-by-side.
                let targetX = centerX + (index - (totalStars - 1) / 2) * spacing;
                this.tweens.add({
                    targets: star,
                    scale: 3,
                    x: targetX,
                    y: targetY,
                    duration: 1000,
                    ease: 'Cubic.easeInOut'
                });
            });
        }
        
        // After the star animation, end the game.
        this.time.delayedCall(1500, () => {
            initiateGameOver.call(this, { score: this.score });
        });
    }
    
    // Helper function to display a match message overlay.
displayMatchMessage(message) {
    const defaultMessages = ["Nice!", "Good!", "Excellent!", "Crazy!", "Oof!!"];
    let msg = message || Phaser.Utils.Array.GetRandom(defaultMessages);
    
    // Define special messages.
    const biggerMessages = ["Sugar Crush", "Tasty", "Sweet", "You Win!"];
    
    // Detect mobile device.
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    
    // Determine font size based on message and device.
    let fontSize;
    if (biggerMessages.includes(msg)) {
        fontSize = isMobile ? 100 : 150; // Smaller on mobile, larger on PC.
    } else {
        fontSize = isMobile ? 70 : 100; // Adjust as needed for non-special messages.
    }
    
    let duration = biggerMessages.includes(msg) ? 2500 : 1500;
    
    // Use your new font if needed, or keep "pixelfont"
    let overlayText = this.add.bitmapText(this.width / 2, this.height / 2, 'pixelfont', msg, fontSize)
                           .setOrigin(0.5)
                           .setDepth(102);
    
    if (message) {
        overlayText.setTint(0xffaa00);
    }
    
    this.tweens.add({
        targets: overlayText,
        y: overlayText.y - 50,
        alpha: 0,
        duration: duration,
        ease: 'Linear',
        onComplete: () => {
            overlayText.destroy();
        }
    });
}

    
    // Draw a chessboard-style background.
    drawChessBoard() {
        const color1 = 0xD0E6F8;
        const color2 = 0xA0C6E8;
        let board = this.add.graphics();
        for (let i = 0; i < this.numCols; i++) {
            for (let j = 0; j < this.numRows; j++) {
                let cellX = this.gridOffsetX + i * this.tileWidth;
                let cellY = this.gridOffsetY + j * this.tileHeight;
                let cellColor = ((i + j) % 2 === 0) ? color1 : color2;
                board.fillStyle(cellColor, 1);
                board.fillRect(cellX, cellY, this.tileWidth, this.tileHeight);
            }
        }
        let maskShape = this.make.graphics();
        const radius = 10;
        maskShape.fillStyle(0xffffff);
        maskShape.fillRoundedRect(this.gridOffsetX, this.gridOffsetY, this.numCols * this.tileWidth, this.numRows * this.tileHeight, radius);
        let mask = maskShape.createGeometryMask();
        board.setMask(mask);
        board.setDepth(0);
    }
    
    // Draw grid lines and an outer rounded border.
    drawGridLines() {
        this.gridGraphics = this.add.graphics();
        const darkerShade = 0xA0C6E8;
        this.gridGraphics.lineStyle(1, darkerShade, 0.3);
        for (let col = 1; col < this.numCols; col++) {
            let x = this.gridOffsetX + col * this.tileWidth;
            let startY = this.gridOffsetY;
            let endY = this.gridOffsetY + this.numRows * this.tileHeight;
            this.gridGraphics.strokeLineShape(new Phaser.Geom.Line(x, startY, x, endY));
        }
        for (let row = 0; row < this.numRows; row++) {
            let y = this.gridOffsetY + row * this.tileHeight;
            let startX = this.gridOffsetX;
            let endX = this.gridOffsetX + this.numCols * this.tileWidth;
            this.gridGraphics.strokeLineShape(new Phaser.Geom.Line(startX, y, endX, y));
        }
        this.gridGraphics.lineStyle(2, darkerShade, 1);
        const radius = 10;
        this.gridGraphics.strokeRoundedRect(this.gridOffsetX, this.gridOffsetY, this.numCols * this.tileWidth, this.numRows * this.tileHeight, radius);
        let maskShape = this.make.graphics();
        maskShape.fillStyle(0xffffff);
        maskShape.fillRoundedRect(this.gridOffsetX, this.gridOffsetY, this.numCols * this.tileWidth, this.numRows * this.tileHeight, radius);
        let mask = maskShape.createGeometryMask();
        this.gridGraphics.setMask(mask);
    }
    
    initTiles() {
        for (let i = 0; i < this.numCols; i++) {
            for (let j = 0; j < this.numRows; j++) {
                let tile = this.addTile(i, j);
                this.tileGrid[i][j] = tile;
            }
        }
        this.time.delayedCall(600, () => {
            this.checkMatch();
        });
    }
    
    addTile(col, row) {
        let tileType = this.tileTypes[Phaser.Math.Between(0, this.tileTypes.length - 1)];
        let posX = this.gridOffsetX + col * this.tileWidth + this.tileWidth / 2;
        let posY = this.gridOffsetY + row * this.tileHeight + this.tileHeight / 2;
        let tile = this.add.sprite(posX, 0, tileType).setInteractive();
        tile.setDisplaySize(this.tileWidth * 0.9, this.tileHeight * 0.9);
        tile.tileType = tileType;
        this.tweens.add({
            targets: tile,
            y: posY,
            duration: 500,
            ease: 'Quad.easeOut'
        });
        tile.on('pointerdown', () => this.tileDown(tile));
        tile.originalScaleX = tile.scaleX;
        tile.originalScaleY = tile.scaleY;
        tile.on('pointerover', () => {
            this.tweens.add({
                targets: tile,
                scaleX: tile.originalScaleX * 1.1,
                scaleY: tile.originalScaleY * 1.1,
                duration: 100,
                ease: 'Linear'
            });
        });
        tile.on('pointerout', () => {
            this.tweens.add({
                targets: tile,
                scaleX: tile.originalScaleX,
                scaleY: tile.originalScaleY,
                duration: 100,
                ease: 'Linear'
            });
        });
        return tile;
    }
    
    tileDown(tile) {
        if (this.canMove) {
            this.activeTile1 = tile;
            let coords = this.getTileCoordinates(tile.x, tile.y, true);
            this.startPosX = coords.x;
            this.startPosY = coords.y;
        }
    }
    
    tileUp() {
        this.activeTile1 = null;
        this.activeTile2 = null;
    }
    
    swapTiles() {
        if (this.activeTile1 && this.activeTile2) {
            this.sounds.swap.play();
            let tile1Pos = this.getTileCoordinates(this.activeTile1.x, this.activeTile1.y, true);
            let tile2Pos = this.getTileCoordinates(this.activeTile2.x, this.activeTile2.y, true);
            this.tileGrid[tile1Pos.x][tile1Pos.y] = this.activeTile2;
            this.tileGrid[tile2Pos.x][tile2Pos.y] = this.activeTile1;
            let tile1DestX = this.gridOffsetX + tile2Pos.x * this.tileWidth + this.tileWidth / 2;
            let tile1DestY = this.gridOffsetY + tile2Pos.y * this.tileHeight + this.tileHeight / 2;
            let tile2DestX = this.gridOffsetX + tile1Pos.x * this.tileWidth + this.tileWidth / 2;
            let tile2DestY = this.gridOffsetY + tile1Pos.y * this.tileHeight + this.tileHeight / 2;
    
            let trailTimer1 = this.time.addEvent({
                delay: 50,
                callback: () => {
                    let trailSprite = this.add.sprite(this.activeTile1.x, this.activeTile1.y, 'trail');
                    trailSprite.setDisplaySize(30, 10);
                    this.tweens.add({
                        targets: trailSprite,
                        alpha: 0,
                        duration: 300,
                        ease: 'Linear',
                        onComplete: () => {
                            trailSprite.destroy();
                        }
                    });
                },
                loop: true
            });
    
            let trailTimer2 = this.time.addEvent({
                delay: 50,
                callback: () => {
                    let trailSprite = this.add.sprite(this.activeTile2.x, this.activeTile2.y, 'trail');
                    trailSprite.setDisplaySize(30, 10);
                    this.tweens.add({
                        targets: trailSprite,
                        alpha: 0,
                        duration: 300,
                        ease: 'Linear',
                        onComplete: () => {
                            trailSprite.destroy();
                        }
                    });
                },
                loop: true
            });
    
            this.tweens.add({
                targets: this.activeTile1,
                x: tile1DestX,
                y: tile1DestY,
                duration: 200,
                ease: 'Cubic.easeInOut',
                onComplete: () => {
                    trailTimer1.remove();
                }
            });
    
            this.tweens.add({
                targets: this.activeTile2,
                x: tile2DestX,
                y: tile2DestY,
                duration: 200,
                ease: 'Cubic.easeInOut',
                onComplete: () => {
                    trailTimer2.remove();
                }
            });
        }
    }
    
    checkMatch() {
        let matches = this.getMatches();
        if (matches.length > 0) {
            this.chainCount++;
            this.streakText.setText(this.chainCount + "x");
    
            // Show random match messages during each pop
            this.displayMatchMessage();
    
            this.removeTileGroup(matches);
            this.time.delayedCall(800, () => {
                this.resetTiles();
                this.fillTiles();
                this.tileUp();
                this.checkMatch();
            });
        } else {
            // When all matches stop, show the final streak message.
            if (this.chainCount >= 8) {
                this.displayMatchMessage("Sugar Crush");
                this.time.delayedCall(500, () => {
                    if (this.sounds.streak) this.sounds.streak.play();
                });
            } else if (this.chainCount >= 5) {
                this.displayMatchMessage("Tasty");
                this.time.delayedCall(500, () => {
                    if (this.sounds.tasty) this.sounds.tasty.play();
                });
            } else if (this.chainCount >= 2) {
                this.displayMatchMessage("Sweet");
                this.time.delayedCall(500, () => {
                    if (this.sounds.sweet) this.sounds.sweet.play();
                });
            }
    
            this.streakText.setText(""); // Reset streak text
            if (this.chainCount === 0) {
                this.swapTiles();
            }
            this.chainCount = 0;
            this.time.delayedCall(500, () => {
                this.tileUp();
                this.canMove = true;
            });
        }
    }
    
    
    getMatches() {
        let matches = [];
        for (let i = 0; i < this.numCols; i++) {
            for (let j = 0; j < this.numRows - 2; j++) {
                let tile1 = this.tileGrid[i][j];
                let tile2 = this.tileGrid[i][j + 1];
                let tile3 = this.tileGrid[i][j + 2];
                if (tile1 && tile2 && tile3 && tile1.tileType === tile2.tileType && tile2.tileType === tile3.tileType) {
                    let group = [tile1, tile2, tile3];
                    let k = j + 3;
                    while (k < this.numRows && this.tileGrid[i][k] && this.tileGrid[i][k].tileType === tile1.tileType) {
                        group.push(this.tileGrid[i][k]);
                        k++;
                    }
                    matches.push(group);
                }
            }
        }
        for (let j = 0; j < this.numRows; j++) {
            for (let i = 0; i < this.numCols - 2; i++) {
                let tile1 = this.tileGrid[i][j];
                let tile2 = this.tileGrid[i + 1][j];
                let tile3 = this.tileGrid[i + 2][j];
                if (tile1 && tile2 && tile3 && tile1.tileType === tile2.tileType && tile2.tileType === tile3.tileType) {
                    let group = [tile1, tile2, tile3];
                    let k = i + 3;
                    while (k < this.numCols && this.tileGrid[k][j] && this.tileGrid[k][j].tileType === tile1.tileType) {
                        group.push(this.tileGrid[k][j]);
                        k++;
                    }
                    matches.push(group);
                }
            }
        }
        return matches;
    }
    
    removeTileGroup(matches) {
        for (let group of matches) {
            if (group.length > 0) {
                let type = group[0].tileType;
                if (type === 'candy_1' && this.sounds.collect1) {
                    this.sounds.collect1.play();
                } else if (type === 'candy_2' && this.sounds.collect2) {
                    this.sounds.collect2.play();
                } else if (type === 'candy_3' && this.sounds.collect3) {
                    this.sounds.collect3.play();
                }
            }
            for (let tile of group) {
                let pos = this.getTilePos(tile);
                if (tile) {
                    if (this.vfx && typeof this.vfx.addGlow === 'function') {
                        this.vfx.addGlow(tile, 0.8, 0xffff00);
                    }
                    // Animate tile to progress bar center.
                    this.time.delayedCall(200, () => {
                        this.tweens.add({
                            targets: tile,
                            scale: 0,
                            x: this.progressBarX + this.progressBarWidth / 2,
                            y: this.progressBarY,
                            alpha: 0,
                            duration: 1000,
                            ease: 'Power1',
                            onComplete: () => {
                                tile.destroy();
                            }
                        });
                    });
                    this.score += 10;
                    this.scoreText.setText("Score: " + this.score);
                    this.updateProgressBar();
                    if (pos.x !== -1 && pos.y !== -1) {
                        this.tileGrid[pos.x][pos.y] = null;
                    }
                }
            }
        }
    }
    
    getTilePos(tile) {
        for (let i = 0; i < this.numCols; i++) {
            for (let j = 0; j < this.numRows; j++) {
                if (this.tileGrid[i][j] === tile) {
                    return { x: i, y: j };
                }
            }
        }
        return { x: -1, y: -1 };
    }
    
    resetTiles() {
        for (let i = 0; i < this.numCols; i++) {
            for (let j = this.numRows - 1; j >= 0; j--) {
                if (this.tileGrid[i][j] === null) {
                    for (let k = j - 1; k >= 0; k--) {
                        if (this.tileGrid[i][k]) {
                            this.tileGrid[i][j] = this.tileGrid[i][k];
                            this.tileGrid[i][k] = null;
                            let newY = this.gridOffsetY + j * this.tileHeight + this.tileHeight / 2;
                            this.tweens.add({
                                targets: this.tileGrid[i][j],
                                y: newY,
                                duration: 200,
                                ease: 'Bounce.easeOut'
                            });
                            break;
                        }
                    }
                }
            }
        }
    }
    
    fillTiles() {
        for (let i = 0; i < this.numCols; i++) {
            for (let j = 0; j < this.numRows; j++) {
                if (this.tileGrid[i][j] === null) {
                    let tile = this.addTile(i, j);
                    this.tileGrid[i][j] = tile;
                }
            }
        }
    }
    
    gameOver() {
        // End-of-game effect: blur everything except awarded stars and rearrange them.
        this.canMove = false;
        
        // Stop all sounds to prevent overlapping on restart.
        this.sound.stopAll();
        
        // Apply a blur effect to the main camera.
        if (this.cameras.main.setPostPipeline) {
            this.cameras.main.setPostPipeline('BlurPostFX');
        }
        
        // Rearrange the awarded stars so they do not overlap.
        let totalStars = this.awardedStars ? this.awardedStars.length : 0;
        let centerX = this.width / 2;
        let spacing = 60; // horizontal spacing between stars
        let targetY = this.height / 2; // vertical center for stars
        
        if (this.awardedStars && totalStars > 0) {
            this.awardedStars.forEach((star, index) => {
                // Remove blur from the star so it remains clear.
                if (star.clearPipeline) {
                    star.clearPipeline();
                }
                // Calculate target X for this star so they are arranged side-by-side.
                let targetX = centerX + (index - (totalStars - 1) / 2) * spacing;
                this.tweens.add({
                    targets: star,
                    scale: 3,
                    x: targetX,
                    y: targetY,
                    duration: 1000,
                    ease: 'Cubic.easeInOut'
                });
            });
        }
        
        // After the star animation, end the game.
        this.time.delayedCall(1500, () => {
            initiateGameOver.call(this, { score: this.score });
        });
    }
    
    getTileCoordinates(x, y, exactTile = false) {
        let adjustedX = x - this.gridOffsetX;
        let adjustedY = y - this.gridOffsetY;
        if (exactTile) {
            let col = Math.round((adjustedX - this.tileWidth / 2) / this.tileWidth);
            let row = Math.round((adjustedY - this.tileHeight / 2) / this.tileHeight);
            return { x: col, y: row };
        } else {
            let col = Math.floor(adjustedX / this.tileWidth);
            let row = Math.floor(adjustedY / this.tileHeight);
            return { x: col, y: row };
        }
    }
}

// Loader Progress UI
function displayProgressLoader() {
    let width = 320;
    let height = 50;
    let x = (this.game.config.width / 2) - 160;
    let y = (this.game.config.height / 2) - 25;
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(x, y, width, height);
    const loadingText = this.make.text({
        x: this.game.config.width / 2,
        y: this.game.config.height / 2 + 20,
        text: 'Loading...',
        style: { font: '20px monospace', fill: '#ffffff' }
    }).setOrigin(0.5, 0.5);
    const progressBar = this.add.graphics();
    this.load.on('progress', (value) => {
        progressBar.clear();
        progressBar.fillStyle(0x364afe, 1);
        progressBar.fillRect(x, y, width * value, height);
    });
    this.load.on('complete', () => {
        progressBar.destroy();
        progressBox.destroy();
        loadingText.destroy();
    });
}

// Game configuration (using settings from _CONFIG)
const config = {
    type: Phaser.AUTO,
    width: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width,
    height: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].height,
    scene: [GameScene],
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    pixelArt: true,
    physics: {
        default: "arcade",
        arcade: { gravity: { y: 0 }, debug: false }
    },
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions
    },
    orientation: _CONFIG.deviceOrientation
};

let gameScore = 0;
