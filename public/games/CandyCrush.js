// CandyCrush.js

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.score = 0;
    }

    preload() {
        // Load images from the JSON config
        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }
        // Load sounds from the JSON config
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        
        // IMPORTANT: Attach Braincade SDK event listeners
        addEventListenersPhaser.bind(this)();

        // Load additional assets: pause button and bitmap font
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/";
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');
        
        displayProgressLoader.call(this);
    }

    create() {
        // Create VFX instance (assumed defined elsewhere)
        this.vfx = new VFXLibrary(this);

        // Initialize sounds but DO NOT start background music until first move.
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }
        // (Background music will start on first move)

        // Set background image (centered)
        this.bg = this.add.sprite(0, 0, 'background').setOrigin(0, 0);
        this.bg.displayWidth = this.game.config.width;
        this.bg.displayHeight = this.game.config.height;

        this.width = this.game.config.width;
        this.height = this.game.config.height;

        // Add platform and player (Mario) sprites on the left side.
        // Adjust origins and scales as needed.
        const platform = this.add.sprite(150, this.height - 1, 'platform').setOrigin(0.15, 0.5);
        platform.setScale(1, 0.6);
        this.mario = this.add.sprite(150, this.height - 250, 'mario').setOrigin(-0.7, 0.55);
        this.mario.setScale(0.5, 0.5);

        // Score text at the top-center.
        this.scoreText = this.add.bitmapText(this.width / 2, 50, 'pixelfont', '0', 64)
                              .setOrigin(0.5, 0.5);
        this.scoreText.setDepth(100);

        // Pause button at the top-right.
        this.pauseButton = this.add.sprite(this.width - 60, 60, "pauseButton")
                              .setOrigin(0.5, 0.5);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(2);
        this.pauseButton.setDepth(101);
        this.pauseButton.on('pointerdown', () => {
            // Dispatch pause event via Braincade SDK (which handles the pause UI)
            handlePauseGame.call(this);
        });

        // Prepare collectible tile types and create particle emitters.
        this.tileTypes = ['collectible_1', 'collectible_2', 'collectible_3'];
        for (const tileType of this.tileTypes) {
            this.vfx.createEmitter(tileType);
        }

        // --- Grid Setup ---
        // For Candy Crush we use an 8 x 7 grid.
        this.gridOffsetX = this.width * 0.50;  // Grid starts halfway across the screen.
        this.gridOffsetY = this.height * 0.20;   // 20% from the top.

        this.numCols = 8;
        this.numRows = 7;
        let availableWidth = this.width - this.gridOffsetX - 20;
        let availableHeight = this.height - this.gridOffsetY - 20;
        let tileSize = Math.min(availableWidth / this.numCols, availableHeight / this.numRows);
        this.tileWidth = tileSize;
        this.tileHeight = tileSize;

        // Create a 2D array for tiles.
        this.tileGrid = [];
        for (let i = 0; i < this.numCols; i++) {
            this.tileGrid[i] = [];
            for (let j = 0; j < this.numRows; j++) {
                this.tileGrid[i][j] = null;
            }
        }

        this.drawGridLines();
        this.activeTile1 = null;
        this.activeTile2 = null;
        this.canMove = false;

        let seed = Date.now();
        this.random = new Phaser.Math.RandomDataGenerator([seed]);
        this.initTiles();

        // Also pause via ESC key.
        this.input.keyboard.on('keydown-ESC', () => {
            handlePauseGame.call(this);
        });

        timerEvent = this.time.addEvent({
            delay: 120000,
            callback: () => this.gameOver(),
            callbackScope: this,
            loop: false
        });

        timerText = this.add.bitmapText(this.width - 150, 50, 'pixelfont', '120', 64)
                        .setOrigin(0.5)
                        .setDepth(100);

        this.canMove = true;
    }

    update() {
        if (this.activeTile1 && !this.activeTile2) {
            let hoverX = this.input.activePointer.x;
            let hoverY = this.input.activePointer.y;
            let tilePos = this.getTileCoordinates(hoverX, hoverY);
            let hoverPosX = tilePos.x;
            let hoverPosY = tilePos.y;
            let difX = (hoverPosX - this.startPosX);
            let difY = (hoverPosY - this.startPosY);
            if (
                hoverPosX >= 0 && hoverPosX < this.numCols &&
                hoverPosY >= 0 && hoverPosY < this.numRows
            ) {
                if ((Math.abs(difY) === 1 && difX === 0) ||
                    (Math.abs(difX) === 1 && difY === 0)) {
                    this.canMove = false;
                    this.activeTile2 = this.tileGrid[hoverPosX][hoverPosY];
                    this.swapTiles();
                    this.time.delayedCall(500, () => {
                        this.checkMatch();
                    });
                }
            }
        }

        if (timerEvent) {
            let remainingTime = Math.floor((timerEvent.delay - timerEvent.getElapsed()) / 1000);
            timerText.setText(remainingTime.toString());
            if (remainingTime <= 0) {
                timerEvent = null;
            }
        }
    }

    // -------------------------
    // Draw Grid Lines
    // -------------------------
    drawGridLines() {
        this.gridGraphics = this.add.graphics();
        this.gridGraphics.lineStyle(2, 0x000000, 1);
        for (let col = 0; col <= this.numCols; col++) {
            let startX = this.gridOffsetX + col * this.tileWidth;
            let startY = this.gridOffsetY;
            let endY = this.gridOffsetY + this.numRows * this.tileHeight;
            this.gridGraphics.beginPath();
            this.gridGraphics.moveTo(startX, startY);
            this.gridGraphics.lineTo(startX, endY);
            this.gridGraphics.closePath();
            this.gridGraphics.strokePath();
        }
        for (let row = 0; row <= this.numRows; row++) {
            let startX = this.gridOffsetX;
            let startY = this.gridOffsetY + row * this.tileHeight;
            let endX = this.gridOffsetX + this.numCols * this.tileWidth;
            this.gridGraphics.beginPath();
            this.gridGraphics.moveTo(startX, startY);
            this.gridGraphics.lineTo(endX, startY);
            this.gridGraphics.closePath();
            this.gridGraphics.strokePath();
        }
    }

    // -------------------------
    // Initialize Tiles
    // -------------------------
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
        let tileToAdd = this.tileTypes[Phaser.Math.Between(0, this.tileTypes.length - 1)];
        let posX = this.gridOffsetX + col * this.tileWidth + this.tileWidth / 2;
        let posY = this.gridOffsetY + row * this.tileHeight + this.tileHeight / 2;
        let tile = this.add.sprite(posX, 0, tileToAdd);
        tile.setOrigin(0.5);
        tile.setDisplaySize(this.tileWidth * 0.9, this.tileHeight * 0.9);
        tile.tileType = tileToAdd;
        this.tweens.add({
            targets: tile,
            y: posY,
            duration: 500,
            ease: 'Linear'
        });
        tile.setInteractive();
        tile.on('pointerdown', () => this.tileDown(tile));
        return tile;
    }

    tileDown(tile) {
        if (this.canMove) {
            // Start background music on first move if not already playing.
            if (!this.sounds.background.isPlaying) {
                this.sounds.background.setVolume(1).setLoop(true).play();
            }
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
            this.sounds.move.play();
            let tile1Pos = this.getTileCoordinates(this.activeTile1.x, this.activeTile1.y, true);
            let tile2Pos = this.getTileCoordinates(this.activeTile2.x, this.activeTile2.y, true);
            this.tileGrid[tile1Pos.x][tile1Pos.y] = this.activeTile2;
            this.tileGrid[tile2Pos.x][tile2Pos.y] = this.activeTile1;
            let tile1DestX = this.gridOffsetX + tile2Pos.x * this.tileWidth + this.tileWidth / 2;
            let tile1DestY = this.gridOffsetY + tile2Pos.y * this.tileHeight + this.tileHeight / 2;
            let tile2DestX = this.gridOffsetX + tile1Pos.x * this.tileWidth + this.tileWidth / 2;
            let tile2DestY = this.gridOffsetY + tile1Pos.y * this.tileHeight + this.tileHeight / 2;
            this.tweens.add({
                targets: this.activeTile1,
                x: tile1DestX,
                y: tile1DestY,
                duration: 200,
                ease: 'Linear'
            });
            this.tweens.add({
                targets: this.activeTile2,
                x: tile2DestX,
                y: tile2DestY,
                duration: 200,
                ease: 'Linear'
            });
            this.comboActive = true;
            this.combo = (this.combo || 0);
        }
    }

    checkMatch() {
        let matches = this.getMatches(this.tileGrid);
        if (matches.length > 0) {
            if (this.comboActive) {
                this.combo++;
            }
            this.removeTileGroup(matches);
            this.vfx.shakeCamera(200);
            this.sounds.collect.play();
            if (this.comboActive) {
                let comboText = "NICE!";
                if (this.combo === 2) comboText = "GREAT!!";
                if (this.combo === 3) comboText = "AWESOME!!!";
                if (this.combo >= 4) comboText = "UNSTOPPABLE!!!!";
                this.centerText = this.add.bitmapText(
                    this.width / 2, 
                    this.height / 2.5, 
                    'pixelfont', 
                    comboText, 
                    80
                ).setOrigin(0.5).setDepth(200);
                this.time.delayedCall(600, () => {
                    this.centerText.destroy();
                });
            }
            this.resetTile();
            this.fillTile();
            this.time.delayedCall(500, () => {
                this.tileUp();
            });
            this.time.delayedCall(600, () => {
                this.checkMatch();
            });
        } else {
            this.swapTiles();
            this.combo = 0;
            this.comboActive = false;
            this.time.delayedCall(500, () => {
                this.tileUp();
                this.canMove = true;
            });
        }
    }

    getMatches(tileGrid) {
        let matches = [];
        let groups = [];
        for (let i = 0; i < this.numCols; i++) {
            groups = [];
            for (let j = 0; j < this.numRows; j++) {
                if (j < this.numRows - 2) {
                    let tile1 = tileGrid[i][j];
                    let tile2 = tileGrid[i][j + 1];
                    let tile3 = tileGrid[i][j + 2];
                    if (tile1 && tile2 && tile3) {
                        if (tile1.tileType === tile2.tileType && tile2.tileType === tile3.tileType) {
                            if (groups.indexOf(tile1) === -1) groups.push(tile1);
                            if (groups.indexOf(tile2) === -1) groups.push(tile2);
                            if (groups.indexOf(tile3) === -1) groups.push(tile3);
                        }
                    }
                }
            }
            if (groups.length > 0) matches.push(groups);
        }
        for (let j = 0; j < this.numRows; j++) {
            groups = [];
            for (let i = 0; i < this.numCols; i++) {
                if (i < this.numCols - 2) {
                    let tile1 = tileGrid[i][j];
                    let tile2 = tileGrid[i + 1][j];
                    let tile3 = tileGrid[i + 2][j];
                    if (tile1 && tile2 && tile3) {
                        if (tile1.tileType === tile2.tileType && tile2.tileType === tile3.tileType) {
                            if (groups.indexOf(tile1) === -1) groups.push(tile1);
                            if (groups.indexOf(tile2) === -1) groups.push(tile2);
                            if (groups.indexOf(tile3) === -1) groups.push(tile3);
                        }
                    }
                }
            }
            if (groups.length > 0) matches.push(groups);
        }
        return matches;
    }

    removeTileGroup(matches) {
        for (let i = 0; i < matches.length; i++) {
            let group = matches[i];
            for (let tile of group) {
                let pos = this.getTilePos(tile);
                if (tile) {
                    this.vfx.createEmitter(tile.tileType, tile.x, tile.y, 0.01, 0.02, 500)
                        .explode(100);
                    tile.destroy();
                }
                this.incrementScore();
                if (pos.x !== -1 && pos.y !== -1) {
                    this.tileGrid[pos.x][pos.y] = null;
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

    resetTile() {
        for (let i = 0; i < this.numCols; i++) {
            for (let j = this.numRows - 1; j > 0; j--) {
                if (this.tileGrid[i][j] === null) {
                    for (let k = j - 1; k >= 0; k--) {
                        if (this.tileGrid[i][k]) {
                            this.tileGrid[i][j] = this.tileGrid[i][k];
                            this.tileGrid[i][k] = null;
                            this.tweens.add({
                                targets: this.tileGrid[i][j],
                                y: this.gridOffsetY + j * this.tileHeight + this.tileHeight / 2,
                                duration: 200,
                                ease: 'Linear'
                            });
                            break;
                        }
                    }
                }
            }
        }
    }

    fillTile() {
        for (let i = 0; i < this.numCols; i++) {
            for (let j = 0; j < this.numRows; j++) {
                if (this.tileGrid[i][j] === null) {
                    let tile = this.addTile(i, j);
                    this.tileGrid[i][j] = tile;
                }
            }
        }
    }

    incrementScore() {
        gameScore += 10 * (this.combo || 1);
        this.updateScore(gameScore);
    }

    updateScore(points) {
        this.score = points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(this.score);
    }

    gameOver() {
        initiateGameOver.bind(this)({ "score": this.score });
    }

    pauseGame() {
        handlePauseGame.call(this);
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

// Game configuration (using JSON settings from _CONFIG)
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
let gameLevel = 1;
let timerEvent;
let timerText;
let timeDown = 120000;

