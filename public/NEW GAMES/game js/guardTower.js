// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        this.isGameOver = false;

        addEventListenersPhaser.bind(this)();

        // Reuse preload components from template
        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
        this.load.image("path","https://aicade-user-store.s3.amazonaws.com/0306251268/games/dYMpo2kPtXDB3iSp/assets/images/texture-cobble-granite-pavement_839833-30880.png?t=1744297529374");
        this.load.image("tower1", "https://aicade-user-store.s3.amazonaws.com/0306251268/games/dYMpo2kPtXDB3iSp/assets/images/tower%201.png?t=1744316977538");
        this.load.image("tower2", "https://aicade-user-store.s3.amazonaws.com/0306251268/games/dYMpo2kPtXDB3iSp/assets/images/tower%202.png?t=1744316977583");
        this.load.image("tower3", "https://aicade-user-store.s3.amazonaws.com/0306251268/games/dYMpo2kPtXDB3iSp/assets/images/tower%203.png?t=1744316977313");
        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/"
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        displayProgressLoader.call(this);
    }

    create() {
        // Initialize game properties
        this.score = 0;
        this.money = 100;
        this.lives = 10;
        this.waveNumber = 0;
        this.enemiesLeft = 0;
        this.towerPlacing = false;
        this.selectedTower = null;
        this.currentTowerType = null;
        
        // Sound setup from template
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        this.sounds.background.setVolume(0.1).setLoop(true).play();
        

        this.vfx = new VFXLibrary(this);

        // Pause button
        this.pauseButton = this.add.sprite(this.game.config.width - 60, 43, "pauseButton").setOrigin(0.5, 0.5).setDepth(11);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(2);
        this.pauseButton.on('pointerdown', () => this.pauseGame());
        
        // Background
        this.add.image(0, 0, 'background').setOrigin(0, 0).setDisplaySize(this.sys.game.config.width, this.sys.game.config.height);

        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.bg = this.add.sprite(0, 0, 'background').setOrigin(0, 0);
        this.bg.setScrollFactor(0);
        this.bg.displayHeight = this.game.config.height;
        this.bg.displayWidth = this.game.config.width;

        // Create the game path (using an array of points)
        this.path = [
            { x: 0, y: 580 }, // Start (left end)
            { x: 620, y: 580 }, // Move right
            { x: 620, y: 300 }, // Move up
            { x: 1255, y: 300 }, // Move right
            { x: 1255, y: 800 }, // Move down
            { x: 1910, y: 800 }  // Move right to the right endy: 400 }  // Move right and end // Turn right and end
        ];

        // Draw the path
        this.drawPath();
        
        // Create UI components
        this.createUI();
        
        // Setup physics groups
        this.enemies = this.physics.add.group();
        this.towers = this.physics.add.group();
        this.bullets = this.physics.add.group();
        
        // Collision handling between bullets and enemies
        this.physics.add.overlap(this.bullets, this.enemies, this.damageEnemy, null, this);
        
        // Start the first wave
        this.startNextWave();
        
        // Set up game timer for tower shooting and enemy spawning
        this.gameTimer = this.time.addEvent({
            delay: 500,
            callback: this.updateTowers,
            callbackScope: this,
            loop: true
        });
        
        this.input.setTopOnly(true); // Ensures we only drag the top-most game object
        this.towerDragging = false;
        // Add input listeners
        this.input.on('pointerdown', this.handleClick, this);
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.cursors = this.input.keyboard.createCursorKeys();
        this.input.keyboard.disableGlobalCapture();
    }

    // In GameScene class
    drawPath() {
        const graphics = this.add.graphics();
        // graphics.lineStyle(20, 0xAAAAAA, 1);
        
        // Draw line segments between path points
        for (let i = 0; i < this.path.length - 1; i++) {
            graphics.beginPath();
            graphics.moveTo(this.path[i].x, this.path[i].y);
            graphics.lineTo(this.path[i + 1].x, this.path[i + 1].y);
            graphics.strokePath();
        }
    }

    createUI() {
        // Score text
        this.scoreText = this.add.bitmapText(this.width / 2-500, 35, 'pixelfont', '0', 48).setOrigin(0.5, 0.5);
        this.scoreText.setDepth(11);
        
        // Money text
        this.moneyText = this.add.bitmapText(this.width / 2-230, 35, 'pixelfont', '100', 48).setOrigin(0.5, 0.5);
        this.moneyText.setDepth(11);
        
        // Lives text
        this.livesText = this.add.bitmapText(this.width / 2-785, 35, 'pixelfont', '10', 48).setOrigin(0.5, 0.5);
        this.livesText.setDepth(11);
        
        // Wave text
        this.waveText = this.add.bitmapText(this.width / 2+200, 30, 'pixelfont', '1', 58).setOrigin(0.5, 0.5);
        this.waveText.setDepth(11);

        // Create tower buttons at the bottom of the screen
        const buttonY = this.height - 60;
        const spacing = 120;
        
        // Create a UI panel for tower selection
        const uiPanel = this.add.rectangle(this.width / 2, this.height - 60, 400, 100, 0x333333, 0.8);
        uiPanel.setStrokeStyle(2, 0xFFFFFF);
        
        // Tower 1 - Basic Tower (Red)
        this.tower1Button = this.createTowerButton(this.width / 2 - spacing, buttonY, 0xFF0000, 'basic', 20);
        
        // Tower 2 - Rapid Tower (Blue)
        this.tower2Button = this.createTowerButton(this.width / 2, buttonY, 0x0000FF, 'rapid', 30);
        
        // Tower 3 - Heavy Tower (Green)
        this.tower3Button = this.createTowerButton(this.width / 2 + spacing, buttonY, 0x00FF00, 'heavy', 40); 
    }  

    createTowerButton(x, y, color, type, cost) {
        const group = this.add.group();

        // Map tower type to sprite key
        const spriteKey = type === 'basic' ? 'tower1' : (type === 'rapid' ? 'tower2' : 'tower3');

        // Create button with tower sprite
        const button = this.add.sprite(x, y, spriteKey);
        button.setScale(0.5); // Adjust size for button

        // Make the button draggable
        button.setInteractive({ cursor: 'pointer', draggable: true });

        // Tower properties
        button.towerType = type;
        button.towerCost = cost;
        button.towerColor = color; // Kept for range indicator

        // Handle drag events
        button.on('dragstart', (pointer) => this.startDraggingTower(button, pointer));
        button.on('drag', (pointer, dragX, dragY) => this.dragTower(pointer, dragX, dragY));
        button.on('dragend', (pointer) => this.dropTower(pointer));

        // Allow clicking to select
        button.on('pointerdown', () => {
            if (!this.input.activePointer.isDragging) {
                this.selectTower(type);
            }
        });

        // Add base and price tag
        const base = this.add.rectangle(x, y + 15, 40, 10, 0x333333);
        const priceTag = this.add.bitmapText(x, y + 40, 'pixelfont', cost + '$', 18).setOrigin(0.5, 0.5);

        group.add(button);
        group.add(base);
        group.add(priceTag);

        return group;
    }

    startDraggingTower(towerButton, pointer) {
        const type = towerButton.towerType;
        const color = towerButton.towerColor;

        // Clean up existing preview
        if (this.towerPreview) {
            this.towerPreview.destroy();
        }
        if (this.towerBase) {
            this.towerBase.destroy();
        }
        if (this.rangeIndicator) {
            this.rangeIndicator.destroy();
        }

        // Create preview with tower sprite
        const spriteKey = type === 'basic' ? 'tower1' : (type === 'rapid' ? 'tower2' : 'tower3');
        this.towerPreview = this.add.sprite(pointer.x, pointer.y, spriteKey).setScale(0.5).setAlpha(0.7);
        this.towerBase = this.add.rectangle(pointer.x, pointer.y + 15, 40, 10, 0x333333, 0.7);

        // Add range indicator
        const range = type === 'basic' ? 150 : (type === 'rapid' ? 100 : 200);
        this.rangeIndicator = this.add.circle(pointer.x, pointer.y, range, color, 0.2);

        // Set the current tower type
        this.currentTowerType = type;
        this.towerDragging = true;

        // Highlight the selected tower button
        this.highlightSelectedTower(type);
    }

    dragTower(pointer, dragX, dragY) {
        if (this.towerDragging && this.towerPreview && this.rangeIndicator) {
            // Update preview position
            this.towerPreview.x = dragX;
            this.towerPreview.y = dragY;
            this.towerBase.x = dragX;
            this.towerBase.y = dragY + 15;
            this.rangeIndicator.x = dragX;
            this.rangeIndicator.y = dragY;

            // Change appearance based on placement validity
            const canPlace = !this.isOnPath(dragX, dragY) && 
                            this.money >= this.getTowerCost(this.currentTowerType) &&
                            this.isNearPath(dragX, dragY);
            const alpha = canPlace ? 0.7 : 0.3;
            const tint = canPlace ? 0xFFFFFF : 0xFF0000; // White (normal) or red (invalid)

            this.towerPreview.setAlpha(alpha);
            this.towerPreview.setTint(tint);
            this.towerBase.setAlpha(alpha);
            this.rangeIndicator.setAlpha(canPlace ? 0.2 : 0.1);
            this.rangeIndicator.setFillStyle(this.currentTowerType === 'basic' ? 0xFF0000 : 
                                            (this.currentTowerType === 'rapid' ? 0x0000FF : 0x00FF00), 
                                            canPlace ? 0.2 : 0.1);
        }
    }

    dropTower(pointer) {
        if (this.towerDragging) {
            const x = pointer.x;
            const y = pointer.y;
            const cost = this.getTowerCost(this.currentTowerType);

            // Check if player has enough money, position is not on path, and is near path
            if (this.money >= cost && !this.isOnPath(x, y) && this.isNearPath(x, y)) {
                // Place the tower
                this.placeTower(x, y, this.currentTowerType);
                this.money -= cost;
                this.updateMoneyText();

                // Play sound if available
                if (this.sounds.place) {
                    this.sounds.place.play();
                }
            }

            // Clean up preview
            if (this.towerPreview) {
                this.towerPreview.destroy();
                this.towerPreview = null;
            }
            if (this.towerBase) {
                this.towerBase.destroy();
                this.towerBase = null;
            }
            if (this.rangeIndicator) {
                this.rangeIndicator.destroy();
                this.rangeIndicator = null;
            }

            // Reset state
            this.towerDragging = false;
            this.currentTowerType = null;

            // Remove highlight from all tower buttons
            this.highlightSelectedTower(null);
        }
    }

        selectTower(type) {
        // Set the current tower type and start placing mode
        this.currentTowerType = type;
        this.towerPlacing = true;

        // Clean up existing preview
        if (this.towerPreview) {
            this.towerPreview.destroy();
        }
        if (this.towerBase) {
            this.towerBase.destroy();
        }
        if (this.rangeIndicator) {
            this.rangeIndicator.destroy();
        }

        // Create preview with tower sprite
        const spriteKey = type === 'basic' ? 'tower1' : (type === 'rapid' ? 'tower2' : 'tower3');
        const color = type === 'basic' ? 0xFF0000 : (type === 'rapid' ? 0x0000FF : 0x00FF00);
        this.towerPreview = this.add.sprite(0, 0, spriteKey).setScale(0.5).setAlpha(0.7);
        this.towerBase = this.add.rectangle(0, 15, 40, 10, 0x333333, 0.7);

        // Add range indicator
        const range = type === 'basic' ? 150 : (type === 'rapid' ? 100 : 200);
        this.rangeIndicator = this.add.circle(0, 0, range, color, 0.2);

        // Highlight the selected tower button
        this.highlightSelectedTower(type);
    }

        highlightSelectedTower(type) {
        // Reset all button highlights
        [this.tower1Button, this.tower2Button, this.tower3Button].forEach(towerGroup => {
            const button = towerGroup.getChildren()[0];
            button.clearTint(); // Remove tint to reset
        });

        // Highlight the selected tower
        let selectedButton;
        if (type === 'basic') selectedButton = this.tower1Button;
        else if (type === 'rapid') selectedButton = this.tower2Button;
        else if (type === 'heavy') selectedButton = this.tower3Button;

        if (selectedButton) {
            const button = selectedButton.getChildren()[0];
            button.setTint(0xFFFF00); // Yellow tint for highlight
        }
    }

    handleClick(pointer) {
        // Skip if we're handling a drag operation
        if (this.towerDragging) {
            return;
        }

        if (this.towerPlacing) {
            const cost = this.getTowerCost(this.currentTowerType);

            // Check if player has enough money, position is not on path, and is near path
            if (this.money >= cost && !this.isOnPath(pointer.x, pointer.y) && this.isNearPath(pointer.x, pointer.y)) {
                // Place the tower
                this.placeTower(pointer.x, pointer.y, this.currentTowerType);
                this.money -= cost;
                this.updateMoneyText();

                // Play sound if available
                if (this.sounds.place) {
                    this.sounds.place.play();
                }
            }

            // Exit tower placing mode
            this.towerPlacing = false;
            if (this.towerPreview) {
                this.towerPreview.destroy();
                this.towerPreview = null;
            }
            if (this.towerBase) {
                this.towerBase.destroy();
                this.towerBase = null;
            }
            if (this.rangeIndicator) {
                this.rangeIndicator.destroy();
                this.rangeIndicator = null;
            }

            // Remove highlight from all tower buttons
            this.highlightSelectedTower(null);
        }
    }

    getTowerCost(type) {
        switch (type) {
            case 'basic': return 20;
            case 'rapid': return 30;
            case 'heavy': return 40;
            default: return 0;
        }
    }

    isOnPath(x, y) {
        // Simple check if the position is close to any path segment
        const pathWidth = 40; // Width of the path (twice the line width)

        for (let i = 0; i < this.path.length - 1; i++) {
            const p1 = this.path[i];
            const p2 = this.path[i + 1];

            // Check if the points are on a horizontal or vertical line
            if (p1.x === p2.x) { // Vertical segment
                if (Math.abs(x - p1.x) < pathWidth / 2 &&
                    y >= Math.min(p1.y, p2.y) &&
                    y <= Math.max(p1.y, p2.y)) {
                    return true;
                }
            } else { // Horizontal segment
                if (Math.abs(y - p1.y) < pathWidth / 2 &&
                    x >= Math.min(p1.x, p2.x) &&
                    x <= Math.max(p1.x, p2.x)) {
                    return true;
                }
            }
        }
        return false;
    }

    isNearPath(x, y) {
        const maxDistance = 100; // Max distance from path (in pixels)

        for (let i = 0; i < this.path.length - 1; i++) {
            const p1 = this.path[i];
            const p2 = this.path[i + 1];

            // Calculate the closest point on the segment to (x, y)
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const lengthSquared = dx * dx + dy * dy;
            if (lengthSquared === 0) continue; // Skip if p1 and p2 are the same

            // Project point (x, y) onto the segment
            let t = ((x - p1.x) * dx + (y - p1.y) * dy) / lengthSquared;
            t = Math.max(0, Math.min(1, t)); // Clamp t to [0, 1]

            // Closest point on segment
            const closestX = p1.x + t * dx;
            const closestY = p1.y + t * dy;

            // Distance from (x, y) to closest point
            const distX = x - closestX;
            const distY = y - closestY;
            const distance = Math.sqrt(distX * distX + distY * distY);

            if (distance <= maxDistance) {
                return true;
            }
        }
        return false;
    }

    placeTower(x, y, type) {
        // Check if position is not on path and is near path
        if (this.isOnPath(x, y) || !this.isNearPath(x, y)) {
            return null; // Don't place tower if conditions aren't met
        }

        const color = type === 'basic' ? 0xFF0000 : (type === 'rapid' ? 0x0000FF : 0x00FF00);
        const spriteKey = type === 'basic' ? 'tower1' : (type === 'rapid' ? 'tower2' : 'tower3');

        // Create tower with sprite
        const tower = this.add.sprite(x, y, spriteKey).setScale(0.8);
        const base = this.add.rectangle(x, y + 15, 40, 10, 0x333333);

        // Add tower properties
        tower.type = type;
        tower.range = type === 'basic' ? 150 : (type === 'rapid' ? 100 : 200);
        tower.damage = type === 'basic' ? 10 : (type === 'rapid' ? 5 : 20);
        tower.fireRate = type === 'basic' ? 1000 : (type === 'rapid' ? 400 : 1500);
        tower.lastFired = 0;

        // Group the tower and base
        const towerGroup = this.add.group();
        towerGroup.add(tower);
        towerGroup.add(base);

        // Add to physics group
        this.towers.add(tower);

        return towerGroup;
    }

    updateTowers() {
        // Update tower preview position if in placing mode
        if (this.towerPlacing && this.towerPreview && this.rangeIndicator) {
            const pointer = this.input.activePointer;
            this.towerPreview.x = pointer.x;
            this.towerPreview.y = pointer.y;
            this.rangeIndicator.x = pointer.x;
            this.rangeIndicator.y = pointer.y;
        }
        
        // Check each tower to see if it should fire
        const time = this.time.now;
        this.towers.getChildren().forEach(tower => {
            if (time > tower.lastFired + tower.fireRate) {
                // Find closest enemy in range
                const target = this.findTarget(tower);
                if (target) {
                    this.shootAt(tower, target);
                    tower.lastFired = time;
                }
            }
        });
    }

    findTarget(tower) {
        let closestEnemy = null;
        let closestDistance = tower.range;
        
        this.enemies.getChildren().forEach(enemy => {
            const distance = Phaser.Math.Distance.Between(tower.x, tower.y, enemy.x, enemy.y);
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestEnemy = enemy;
            }
        });
        
        return closestEnemy;
    }

    shootAt(tower, enemy) {
        // Create bullet
        const bullet = this.add.circle(tower.x, tower.y, 5, 0xFFFFFF);
        this.bullets.add(bullet);
        bullet.damage = tower.damage;
        
        // Play sound if available
        if (tower.type === 'basic' && this.sounds.shoot) {
            this.sounds.shoot.play();
        } else if (tower.type === 'rapid' && this.sounds.shoot) {
            this.sounds.shoot.setRate(1.5).play();
        } else if (tower.type === 'heavy' && this.sounds.shoot) {
            this.sounds.shoot.setRate(0.7).play();
        }
        
        // Move bullet to enemy with physics
        this.physics.add.existing(bullet);
        
        // Calculate direction toward enemy
        const angle = Phaser.Math.Angle.Between(tower.x, tower.y, enemy.x, enemy.y);
        
        // Set velocity based on angle
        const speed = 300;
        bullet.body.velocity.x = Math.cos(angle) * speed;
        bullet.body.velocity.y = Math.sin(angle) * speed;
        
        // Destroy bullet after 1 second if it doesn't hit anything
        this.time.delayedCall(1000, () => {
            if (bullet.active) {
                bullet.destroy();
            }
        });
    }

    damageEnemy(bullet, enemy) {
        // Apply damage and check if enemy is destroyed
        enemy.health -= bullet.damage;
        
        // Remove the bullet
        bullet.destroy();
        
        if (enemy.health <= 0) {
            this.destroyEnemy(enemy);
        }
    }

    destroyEnemy(enemy) {
        // Add money and score for killing enemy
        this.money += enemy.reward;
        this.score += enemy.points;
        
        // Update text displays
        this.updateMoneyText();
        this.updateScoreText();
        
        // Play destroy sound if available
        if (this.sounds.explosion) {
            this.sounds.explosion.play();
        }
        
        // Create particle effect
        // this.vfx.createExplosion(enemy.x, enemy.y, enemy.fillColor);
        
        // Remove the enemy
        enemy.destroy();
        this.enemiesLeft--;
        
        // Check if wave is complete
        this.checkWaveComplete();
    }

    startNextWave() {
        this.waveNumber++;
        const enemyCount = 5 + (this.waveNumber * 2);
        this.enemiesLeft = enemyCount;

        // Update wave text
        this.waveText.setText(this.waveNumber);

        // Start spawning enemies
        this.spawnTimer = this.time.addEvent({
            delay: 1500,
            callback: this.spawnEnemy,
            callbackScope: this,
            repeat: enemyCount - 1
        });
    }

    spawnEnemy() {
        // Create enemy
        const startPoint = this.path[0];
        const enemy = this.add.circle(startPoint.x, startPoint.y, 15, 0xFFAA00);
        
        // Add to physics group
        this.enemies.add(enemy);
        this.physics.add.existing(enemy);
        
        // Set enemy properties based on wave number
        enemy.health = 20 + (this.waveNumber * 5);
        enemy.speed = 70 + (this.waveNumber * 2);
        enemy.reward = 5 + Math.floor(this.waveNumber / 2);
        enemy.points = 1;
        enemy.pathIndex = 1;
        
        // Move enemy along the path
        this.moveEnemyAlongPath(enemy);
    }

    moveEnemyAlongPath(enemy) {
        if (enemy.pathIndex < this.path.length) {
            const targetPoint = this.path[enemy.pathIndex];
            
            // Calculate direction and distance
            const dx = targetPoint.x - enemy.x;
            const dy = targetPoint.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Set velocity to move toward the next point
            const vx = (dx / distance) * enemy.speed;
            const vy = (dy / distance) * enemy.speed;
            enemy.body.velocity.x = vx;
            enemy.body.velocity.y = vy;
            
            // Check when to move to the next point
            this.time.addEvent({
                delay: distance / enemy.speed * 1000,
                callback: () => {
                    if (enemy.active) {
                        enemy.pathIndex++;
                        this.moveEnemyAlongPath(enemy);
                    }
                }
            });
        } else {
            // Enemy reached the end, lose a life
            this.loseLife(enemy);
        }
    }

    loseLife(enemy) {
        this.lives--;
        this.livesText.setText(this.lives);
        
        // Play sound if available
        if (this.sounds.hit) {
            this.sounds.hit.play();
        }
        
        // Remove the enemy
        enemy.destroy();
        this.enemiesLeft--;
        
        // Check if game over
        if (this.lives <= 0) {
            this.gameOver();
        }
        
        // Check if wave is complete
        this.checkWaveComplete();
    }

    checkWaveComplete() {
        if (this.enemiesLeft <= 0 && (!this.spawnTimer || this.spawnTimer.getOverallProgress() === 1)) {
            // Start next wave after delay
            this.time.delayedCall(3000, () => {
                if (!this.isGameOver) {
                    this.startNextWave();
                }
            });
        }
    }

    updateScoreText() {
        this.scoreText.setText(this.score);
    }

    updateMoneyText() {
        this.moneyText.setText(this.money);
    }

    update() {
        // Update tower preview position if in selection placing mode 
        // (this is for click-to-select-then-click-to-place)
        if (this.towerPlacing && this.towerPreview && this.rangeIndicator && !this.towerDragging) {
            const pointer = this.input.activePointer;
            this.towerPreview.x = pointer.x;
            this.towerPreview.y = pointer.y;
            this.towerBase.x = pointer.x;
            this.towerBase.y = pointer.y + 15;
            this.rangeIndicator.x = pointer.x;
            this.rangeIndicator.y = pointer.y;

            // Change appearance based on placement validity
            const canPlace = !this.isOnPath(pointer.x, pointer.y) && 
                            this.money >= this.getTowerCost(this.currentTowerType) &&
                            this.isNearPath(pointer.x, pointer.y);
            const alpha = canPlace ? 0.7 : 0.3;
            const tint = canPlace ? 0xFFFFFF : 0xFF0000; // White (normal) or red (invalid)

            this.towerPreview.setAlpha(alpha);
            this.towerPreview.setTint(tint);
            this.towerBase.setAlpha(alpha);
            this.rangeIndicator.setAlpha(canPlace ? 0.2 : 0.1);
            this.rangeIndicator.setFillStyle(this.currentTowerType === 'basic' ? 0xFF0000 : 
                                            (this.currentTowerType === 'rapid' ? 0x0000FF : 0x00FF00), 
                                            canPlace ? 0.2 : 0.1);
        }

        // Any other per-frame updates can go here
    }

    gameOver() {
        this.isGameOver = true;
        this.gameTimer.remove();
        
        if (this.spawnTimer) {
            this.spawnTimer.remove();
        }
        
        // Stop all enemy movement
        this.enemies.getChildren().forEach(enemy => {
            enemy.body.velocity.x = 0;
            enemy.body.velocity.y = 0;
        });
        
        // Show game over message
        const gameOverText = this.add.bitmapText(this.width / 2, this.height / 2, 'pixelfont', 'GAME OVER', 64).setOrigin(0.5, 0.5);
        gameOverText.setDepth(20);
        
        // Show final score
        const finalScoreText = this.add.bitmapText(this.width / 2, this.height / 2 + 80, 'pixelfont', 'Score: ' + this.score, 36).setOrigin(0.5, 0.5);
        finalScoreText.setDepth(20);
        
        // Stop background music if playing
        if (this.sounds.background) {
            this.sounds.background.stop();
        }
        
        // Call template game over function with the score
        initiateGameOver.bind(this)({
            score: this.score
        });
    }

    pauseGame() {
        handlePauseGame.bind(this)();
    }
}

// Class for visual effects


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