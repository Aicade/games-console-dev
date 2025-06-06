// Touch Screen Controls
var joystickEnabled = true;
const buttonEnabled = true;

const rexJoystickUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js";
const rexButtonUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexbuttonplugin.min.js";


class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        // Load assets from _CONFIG.imageLoader
        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }
        // Load assets from _CONFIG.soundsLoader
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        // Load assets from _CONFIG.libLoader (assuming these are also images based on .image call)
        for (const key in _CONFIG.libLoader) {
            this.load.image(key, [_CONFIG.libLoader[key]]);
        }
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
    }

    create() {
        // --- SDK Event Listeners ---
        // Assuming addEventListenersPhaser is a global function provided by Aicade
        if (typeof addEventListenersPhaser === 'function') {
            addEventListenersPhaser.call(this);
        } else {
            console.warn("addEventListenersPhaser function not found. Skipping SDK event listeners.");
        }

        // --- Basic Setup ---
        // Access config from the scene's game object if it's not global, or if it is
        const gameConfig = this.sys.game.config;
        const newWidth = gameConfig.width * 0.8;
        const newHeight = gameConfig.height;

        this.bg = this.add.image(gameConfig.width / 2, gameConfig.height / 2, 'background');
        this.bg.setDisplaySize(newWidth, newHeight);
        this.bg.setScrollFactor(0.5);

        // --- Grid Setup ---
        // We use 9 columns and 8 rows.
        this.gridWidth = newWidth;
        this.gridHeight = newHeight;
        this.cellWidth = newWidth / 9;
        this.cellHeight = newHeight / 8;
        this.gridLeft = (gameConfig.width - newWidth) / 2;

        this.gridGraphics = this.add.graphics();
        this.gridGraphics.setScrollFactor(0.5);
        this.gridGraphics.lineStyle(2, 0xffffff, 1);
        // Draw vertical grid lines.
        for (let i = 1; i < 9; i++) {
            let x = this.gridLeft + i * this.cellWidth;
            this.gridGraphics.moveTo(x, gameConfig.height - newHeight);
            this.gridGraphics.lineTo(x, gameConfig.height);
        }
        // Draw horizontal grid lines.
        for (let j = 1; j < 8; j++) {
            let y = gameConfig.height - newHeight + j * this.cellHeight;
            this.gridGraphics.moveTo(this.gridLeft, y);
            this.gridGraphics.lineTo(this.gridLeft + newWidth, y);
        }
        this.gridGraphics.strokePath();
        // Hide grid lines.
        this.gridGraphics.setVisible(false);

        // --- Sound Setup ---
        this.sounds = {};
        this.sounds.bg = this.sound.add("bg", { volume: 0.2, loop: true });
        this.sounds.lose = this.sound.add("lose", { volume: 1, loop: false });
        this.sounds.collect = this.sound.add("collect", { volume: 1, loop: false });
        // Play background music.
        this.sounds.bg.play();

        // --- Score & Difficulty ---
        this.score = 0;
        this.enemyTweenDuration = 3000;
        this.scoreText = this.add.text(10, 10, "Score: 0", {
            fontFamily: 'Arial Black',
            fontSize: '48px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        });

        // --- Enemies ---
        this.enemies = [];
        this.spawnEnemies(); // Call as a method of the class instance

        // --- Player ---
        const playerRow = 7;
        const playerCol = 4;
        const playerX = this.gridLeft + this.cellWidth * (playerCol + 0.5);
        const playerY = gameConfig.height - this.cellHeight * 0.5; // bottom row center
        this.player = this.add.image(playerX, playerY, 'player');
        this.player.setDisplaySize(this.cellWidth * 0.7, this.cellHeight * 0.7);
        this.playerGrid = { row: playerRow, col: playerCol };

        // --- Collectible ---
        const collectibleRow = 0;
        const collectibleCol = 4;
        const collectibleX = this.gridLeft + this.cellWidth * (collectibleCol + 0.5);
        const collectibleY = gameConfig.height - newHeight + this.cellHeight * (collectibleRow + 0.5);
        this.collectible = this.add.image(collectibleX, collectibleY, 'collectible');
        this.collectible.setDisplaySize(this.cellWidth * 0.7, this.cellHeight * 0.7);

        // --- Initialize Invincibility Flag & Game Over Flag ---
        this.invincible = false;
        this.gameOverCalled = false;

        // --- Player Movement (Grid-wise) ---
        this.input.keyboard.on('keydown', (event) => {
            let newRow = this.playerGrid.row;
            let newCol = this.playerGrid.col;

            if (event.key === 'ArrowUp') {
                newRow = Math.max(0, newRow - 1);
            } else if (event.key === 'ArrowDown') {
                newRow = Math.min(7, newRow + 1);
            } else if (event.key === 'ArrowLeft') {
                newCol = Math.max(0, newCol - 1);
            } else if (event.key === 'ArrowRight') {
                newCol = Math.min(8, newCol + 1);
            }

            if (newRow !== this.playerGrid.row || newCol !== this.playerGrid.col) {
                this.playerGrid.row = newRow;
                this.playerGrid.col = newCol;
                const newX = this.gridLeft + this.cellWidth * (newCol + 0.5);
                const newY = gameConfig.height - newHeight + this.cellHeight * (newRow + 0.5);
                this.tweens.add({
                    targets: this.player,
                    x: newX,
                    y: newY,
                    duration: 200,
                    ease: 'Power2',
                    onComplete: () => {
                        // Use gameConfig.height directly as collectibleY calculation used it
                        const actualCollectibleY = gameConfig.height - newHeight + this.cellHeight * (collectibleRow + 0.5);
                        if (this.playerGrid.row === collectibleRow && this.playerGrid.col === collectibleCol) {
                            this.sounds.collect.play();
                            this.levelUp(); // Call as a method of the class instance
                        }
                    }
                });
            }
        });

        // --- Pause Button ---
        this.pauseButton = this.add.image(gameConfig.width - 60, 60, "pauseButton")
            .setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScrollFactor(0);
        this.pauseButton.setScale(3);
        this.pauseButton.on('pointerdown', () => {
            // handlePauseGame is assumed to be a global function or needs to be passed.
            // If it's part of Aicade SDK, it might be globally available or attached to 'this' by addEventListenersPhaser.
            if (typeof handlePauseGame === 'function') {
                handlePauseGame.call(this);
            } else {
                console.warn("handlePauseGame function not found. Cannot pause.");
            }
        });

        this.cameras.main.setBounds(0, 0, gameConfig.width, gameConfig.height);
    }

    update(time, delta) {
        // Access config from the scene's game object if it's not global, or if it is
        const gameConfig = this.sys.game.config;

        if (!this.invincible) {
            this.enemies.forEach(enemy => {
                if (Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) < this.cellWidth * 0.35) {
                    if (!this.gameOverCalled) {
                        this.gameOverCalled = true;
                        // Pause enemy's tween so it stops moving horizontally.
                        if (enemy.tween) {
                            enemy.tween.pause();
                        }
                        // Play lose sound.
                        this.sounds.lose.play();
                        let originalY = enemy.y;
                        // Tween the enemy upward one grid cell.
                        this.tweens.add({
                            targets: enemy,
                            y: originalY - this.cellHeight,
                            duration: 500,
                            ease: 'Linear',
                            onComplete: () => {
                                enemy.setFlipY(true);
                                // Tween it back down.
                                this.tweens.add({
                                    targets: enemy,
                                    y: originalY,
                                    duration: 500,
                                    ease: 'Linear'
                                });
                            }
                        });
                        // Immediately start falling the player.
                        this.tweens.add({
                            targets: this.player,
                            y: gameConfig.height + 100, // Use gameConfig.height
                            duration: 2000,
                            ease: 'Bounce.easeOut',
                            onComplete: () => {
                                this.gameOver(); // Call as a method of the class instance
                            }
                        });
                    }
                }
            });
        }
    }

    // --- Helper Functions as Class Methods ---

    spawnEnemies() {
        this.enemies.forEach(enemy => enemy.destroy());
        this.enemies = [];

        let enemyCount;
        if (this.score === 0) enemyCount = 1;
        else if (this.score === 1) enemyCount = 2;
        else if (this.score === 2) enemyCount = 3;
        else {
            enemyCount = Math.min(3 + (this.score - 2), 7);
        }

        let availableRows = [0, 1, 2, 3, 4, 5, 6];
        let rowEnemyCounts = {};
        availableRows.forEach(r => rowEnemyCounts[r] = 0);

        for (let i = 0; i < enemyCount; i++) {
            let candidateRows = availableRows.filter(r => rowEnemyCounts[r] < 2);
            if (candidateRows.length === 0) break;
            let chosenRow = Phaser.Utils.Array.GetRandom(candidateRows);
            this.spawnEnemy(chosenRow, 'horizontal'); // Call as a method
            rowEnemyCounts[chosenRow]++;
        }
    }

    spawnEnemy(row, mode) {
        // Access config from the scene's game object
        const gameConfig = this.sys.game.config;

        if (mode === 'vertical') {
            let chosenCol;
            do {
                chosenCol = Phaser.Math.Between(0, 8);
            } while (chosenCol === this.playerGrid.col);

            let startRow = Phaser.Math.Between(2, 6);
            let targetRow = Phaser.Math.Between(2, 6);
            while (targetRow === startRow) {
                targetRow = Phaser.Math.Between(2, 6);
            }

            const x = this.gridLeft + this.cellWidth * (chosenCol + 0.5);
            const yStart = gameConfig.height - this.gridHeight + this.cellHeight * (startRow + 0.5);
            const yEnd = gameConfig.height - this.gridHeight + this.cellHeight * (targetRow + 0.5);
            let enemy = this.add.image(x, yStart, 'enemy');
            enemy.setDisplaySize(this.cellWidth * 0.7, this.cellHeight * 0.7);
            enemy.setFlipX(false);
            this.tweens.add({
                targets: enemy,
                y: yEnd,
                duration: this.enemyTweenDuration,
                yoyo: true,
                repeat: -1,
                ease: 'Linear'
            });
            this.enemies.push(enemy);
        } else {
            const startCol = Phaser.Math.Between(0, 8);
            let targetCol = Phaser.Math.Between(0, 8);
            while (targetCol === startCol) {
                targetCol = Phaser.Math.Between(0, 8);
            }
            const startX = this.gridLeft + this.cellWidth * (startCol + 0.5);
            const endX = this.gridLeft + this.cellWidth * (targetCol + 0.5);
            const y = gameConfig.height - this.gridHeight + this.cellHeight * (row + 0.5);
            let enemy = this.add.image(startX, y, 'enemy');
            enemy.setDisplaySize(this.cellWidth * 0.7, this.cellHeight * 0.7);

            // Since the car asset is originally facing left:
            // If moving right, flip so it faces right.
            if (endX > startX) {
                enemy.setFlipX(true);
                enemy.direction = "right";
            } else {
                enemy.setFlipX(false);
                enemy.direction = "left";
            }

            enemy.tween = this.tweens.add({
                targets: enemy,
                x: endX,
                duration: this.enemyTweenDuration,
                yoyo: true,
                repeat: -1,
                ease: 'Linear',
                onUpdate: function(tween, target) {
                    // Check for direction change at the ends of the tween
                    if (Math.abs(target.x - startX) < 5 && target.direction !== "right" && tween.progress === 0) {
                        target.direction = "right";
                        target.setFlipX(true);
                    }
                    if (Math.abs(target.x - endX) < 5 && target.direction !== "left" && tween.progress === 1) {
                        target.direction = "left";
                        target.setFlipX(false);
                    }
                }
            });

            this.enemies.push(enemy);
        }
    }

    levelUp() {
        // Access config from the scene's game object
        const gameConfig = this.sys.game.config;

        this.score++;
        this.scoreText.setText("Score: " + this.score);
        this.enemyTweenDuration = Math.max(1000, 3000 - this.score * 200);

        this.sounds.collect.play();

        this.invincible = true;
        this.time.delayedCall(500, () => { this.invincible = false; }, [], this);

        this.playerGrid = { row: 7, col: 4 };
        const newX = this.gridLeft + this.cellWidth * (4 + 0.5);
        const newY = gameConfig.height - this.cellHeight * 0.5;
        this.tweens.add({
            targets: this.player,
            x: newX,
            y: newY,
            duration: 200,
            ease: 'Power2'
        });

        this.spawnEnemies(); // Call as a method
    }

    gameOver() {
        // initiateGameOver is assumed to be a global function provided by Aicade
        if (typeof initiateGameOver === 'function') {
            initiateGameOver.call(this, { score: this.score });
        } else {
            console.warn("initiateGameOver function not found. Cannot finalize game over.");
        }
        this.scene.pause();
    }
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
            debug: false
        }
    },
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions
    },
    deviceOrientation: _CONFIG.deviceOrientation === "landscape"
};
