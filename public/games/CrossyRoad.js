// Phaser configuration
const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
  };
  
  // Do not instantiate Phaser.Game here per Aicade requirements.
  
  function preload() {
     for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }
            for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        for (const key in _CONFIG.libLoader) {
            this.load.image(key, [_CONFIG.libLoader[key]]);
        }
    this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
  }
  
  function create() {
    // --- SDK Event Listeners ---
    addEventListenersPhaser.call(this);
  
    // --- Basic Setup ---
    const newWidth = config.width * 0.8;  
    const newHeight = config.height;      
    
    this.bg = this.add.image(config.width / 2, config.height / 2, 'background');
    this.bg.setDisplaySize(newWidth, newHeight);
    this.bg.setScrollFactor(0.5);
  
    // --- Grid Setup ---
    // We use 9 columns and 8 rows.
    this.gridWidth = newWidth;
    this.gridHeight = newHeight;
    this.cellWidth = newWidth / 9;
    this.cellHeight = newHeight / 8;
    this.gridLeft = (config.width - newWidth) / 2;
    
    this.gridGraphics = this.add.graphics();
    this.gridGraphics.setScrollFactor(0.5);
    this.gridGraphics.lineStyle(2, 0xffffff, 1);
    // Draw vertical grid lines.
    for (let i = 1; i < 9; i++) {
        let x = this.gridLeft + i * this.cellWidth;
        this.gridGraphics.moveTo(x, config.height - newHeight);
        this.gridGraphics.lineTo(x, config.height);
    }
    // Draw horizontal grid lines.
    for (let j = 1; j < 8; j++) {
        let y = config.height - newHeight + j * this.cellHeight;
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
    spawnEnemies.call(this);
    
    // --- Player ---
    const playerRow = 7;
    const playerCol = 4;
    const playerX = this.gridLeft + this.cellWidth * (playerCol + 0.5);
    const playerY = config.height - this.cellHeight * 0.5; // bottom row center
    this.player = this.add.image(playerX, playerY, 'player');
    this.player.setDisplaySize(this.cellWidth * 0.7, this.cellHeight * 0.7);
    this.playerGrid = { row: playerRow, col: playerCol };
    
    // --- Collectible ---
    const collectibleRow = 0;
    const collectibleCol = 4;
    const collectibleX = this.gridLeft + this.cellWidth * (collectibleCol + 0.5);
    const collectibleY = config.height - newHeight + this.cellHeight * (collectibleRow + 0.5);
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
            const newY = config.height - newHeight + this.cellHeight * (newRow + 0.5);
            this.tweens.add({
                targets: this.player,
                x: newX,
                y: newY,
                duration: 200,
                ease: 'Power2',
                onComplete: () => {
                    if (this.playerGrid.row === collectibleRow && this.playerGrid.col === collectibleCol) {
                        this.sounds.collect.play();
                        levelUp.call(this);
                    }
                }
            });
        }
    });
    
    // --- Pause Button ---
    this.pauseButton = this.add.image(config.width - 60, 60, "pauseButton")
        .setInteractive({ cursor: 'pointer' });
    this.pauseButton.setScrollFactor(0);
    this.pauseButton.setScale(3);
    this.pauseButton.on('pointerdown', () => {
        handlePauseGame.call(this);
    });
    
    this.cameras.main.setBounds(0, 0, config.width, config.height);
  }
  
  
  function update(time, delta) {
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
                        y: config.height + 100,
                        duration: 2000,
                        ease: 'Bounce.easeOut',
                        onComplete: () => {
                            gameOver.call(this);
                        }
                    });
                }
            }
        });
    }
  }
  
  // --- Helper Functions ---
  
  function spawnEnemies() {
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
        spawnEnemy.call(this, chosenRow, 'horizontal');
        rowEnemyCounts[chosenRow]++;
    }
  }
  
  function spawnEnemy(row, mode) {
    if (mode === 'vertical') {
        let chosenCol;
        do {
            chosenCol = Phaser.Math.Between(0, 8);
        } while(chosenCol === this.playerGrid.col);
        
        let startRow = Phaser.Math.Between(2, 6);
        let targetRow = Phaser.Math.Between(2, 6);
        while (targetRow === startRow) {
            targetRow = Phaser.Math.Between(2, 6);
        }
        
        const x = this.gridLeft + this.cellWidth * (chosenCol + 0.5);
        const yStart = config.height - this.gridHeight + this.cellHeight * (startRow + 0.5);
        const yEnd = config.height - this.gridHeight + this.cellHeight * (targetRow + 0.5);
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
        const y = config.height - this.gridHeight + this.cellHeight * (row + 0.5);
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
                if (Math.abs(target.x - startX) < 5 && target.direction !== "right") {
                    target.direction = "right";
                    target.setFlipX(true);
                }
                if (Math.abs(target.x - endX) < 5 && target.direction !== "left") {
                    target.direction = "left";
                    target.setFlipX(false);
                }
            }
        });
        
        this.enemies.push(enemy);
    }
  }
  
  function levelUp() {
    this.score++;
    this.scoreText.setText("Score: " + this.score);
    this.enemyTweenDuration = Math.max(1000, 3000 - this.score * 200);
    
    this.sounds.collect.play();
    
    this.invincible = true;
    this.time.delayedCall(500, () => { this.invincible = false; }, [], this);
    
    this.playerGrid = { row: 7, col: 4 };
    const newX = this.gridLeft + this.cellWidth * (4 + 0.5);
    const newY = config.height - this.cellHeight * 0.5;
    this.tweens.add({
        targets: this.player,
        x: newX,
        y: newY,
        duration: 200,
        ease: 'Power2'
    });
    
    spawnEnemies.call(this);
  }
  
  function gameOver() {
    initiateGameOver.call(this, { score: this.score });
    this.scene.pause();
  }
  