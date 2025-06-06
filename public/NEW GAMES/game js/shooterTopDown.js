// Touch Screen Controls
var joystickEnabled = true;
const buttonEnabled = true;

const rexJoystickUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js";
const rexButtonUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexbuttonplugin.min.js";

/*
------------------- GLOBAL CODE STARTS HERE -------------------
*/

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.isMobile =true;
        this.currentLevel = 0;
        this.levelTransitioning = false; 
        this.mazeRows = 7; 
        this.mazeCols = 11;
        this.doubleDamage = false;
        this.playerSpeed = 150;
        this.originalPlayerSpeed = this.playerSpeed; 
        this.player = null; 
        this.obstacles = null; 
        this.enemies = null;
        this.playerBullets = null; 
        this.enemyBullets = null;
        this.lastTextureIndex = -1;
        this.bulletHitCounter = 0;
        this.playerFireRate = 250; 
        this.enemiesKilled = 0;
        this.diamondsCollected = 0;
        this.diamondAttractionRange = 200; 
        this.diamondAttractionForce = 250;
        this.enemyTypes = [
        { type: 'chaser', spriteKey: 'enemy', health: 2, speed: 700 },
        { type: 'avenger', spriteKey: 'enemy_1', health: 4, speed: 1500 },
        { type: 'sniper', spriteKey: 'enemy_2', health: 1, speed: 300 }
    ];

        this.occupiedTiles = new Set();
        this.weaponTypes = {
        basic_gun: {
            key: "basic_gun",
            scale: 0.13 ,
            offsetX: 20,
            offsetY: 0
        },
        shotgun: {
            key: "shotgun",
            scale: 0.15 ,
            offsetX: 22,
            offsetY: 2
        },
        laser: {
            key: "laser",
            scale: 0.15 ,
            offsetX: 18,
            offsetY: -2
        }
    };
        this.powerupTypes = [
            { type: 'speedBoost', spriteKey: 'power_speed', duration: 7000 },
            { type: 'doubleDamage', spriteKey: 'power_damage', duration: 5000 },
            { type: 'areaDamage', spriteKey: 'power_area', duration: 0 }, // Instant
            { type: 'freezeEnemies', spriteKey: 'power_freeze', duration: 10000 }
        ];
        this.playerPowerups = {}; 
        this.powerupButtons = {}; 
        this.powerupUIContainer = null;

       this.switchWeapon = (weaponName) => {
    const data = this.weaponTypes[weaponName];
    if (!data) return;

    this.player.weapon.setTexture(data.key);
    this.player.weapon.setScale(data.scale * this.scaleFactor);
    this.player.weapon.setPosition(data.offsetX, data.offsetY);
    this.player.currentWeapon = weaponName;
};


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
            this.load.image(key, [_CONFIG.libLoader[key]]);
        }

        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/";
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        if (joystickEnabled) this.load.plugin('rexvirtualjoystickplugin', rexJoystickUrl, true);
        if (buttonEnabled) this.load.plugin('rexbuttonplugin', rexButtonUrl, true);

        displayProgressLoader.call(this);
    }

create() {  
    this.isMobile = true;
    const isPortrait = this.game.config.height > this.game.config.width;

    this.scaleFactor = isPortrait
        ? this.game.config.width / 800
        : this.game.config.width / 1200;

    this.width = this.game.config.width; 
    this.height = this.game.config.height; 
    this.vfx = new VFXLibrary(this);
    this.sfx = {
    shootBasic:  this.sound.add('sfx_shoot_basic'),
    shootShotgun:this.sound.add('sfx_shoot_shotgun'),
    shootLaser:  this.sound.add('sfx_shoot_laser'),
    enemyHit:    this.sound.add('sfx_enemy_hit'),
    enemyKill:    this.sound.add('sfx_enemy_die'),
    playerHit:   this.sound.add('sfx_player_hit'),
    powerup:     this.sound.add('sfx_powerup'),
    click:       this.sound.add('sfx_click'),
    };
    this.bg = this.add.tileSprite(
    this.cameras.main.centerX, 
    this.cameras.main.centerY, 
    this.sys.game.config.width,  
    this.sys.game.config.height, 
    "background" 
    );
    this.bg.setOrigin(0.5);      
    this.bg.setScrollFactor(0);  

    // this.isMobile = this.sys.game.device.input.touch;

    if (this.isMobile) {
        // Create the on-screen weapon swap button for mobile
        this.createWeaponSwapButton();
    } else {
        this.input.keyboard.on("keydown-E", () => {
            this.swapWeaponAction();
        });
    }
    
     this.backgroundTextures = [
            'background_forest',
            'background_volcano',
            'background'
        ];

        this.wallTextures = [
            'wall_bush',
            'wall_lava',
            'wall_cave'
        ];


    this.input.keyboard.on('keydown-ESC', this.pauseGame, this);
   
  this.diamonds = this.physics.add.group({
            defaultKey: 'collectible',
            bounceX: 0.5,
            bounceY: 0.5,
            collideWorldBounds: true
        });


    this.playerMaxLives = 50;
    this.playerLives = this.playerMaxLives;
    this.activePowerups = {};       // For timers and states
    this.activePowerupsUI = {};     // Store UI container refs by type



const iconFontSize = 32 * this.scaleFactor;
const labelPaddingX = 10 * this.scaleFactor;
const labelPaddingY = 5 * this.scaleFactor;
const countPaddingX = 8 * this.scaleFactor;
const countPaddingY = 4 * this.scaleFactor;
const containerSpacing = 12 * this.scaleFactor;


const baseX = 20 * this.scaleFactor;
const baseY = this.scale.height - (590 * this.scaleFactor);

const healthIconSize = 38 * this.scaleFactor;

const healthIconX = 22 * this.scaleFactor;

const healthIconY = 20 * this.scaleFactor;



const healthBarX = 93 * this.scaleFactor;

const healthBarY = healthIconY;

const barWidth = 200 * this.scaleFactor;

const barHeight = 30 * this.scaleFactor;



this.healthLabel = this.add.text(healthIconX, healthIconY, '❤️', {

    fontSize: `${healthIconSize}px`

}).setScrollFactor(0).setDepth(101);



this.healthBarBG = this.add.rectangle(healthBarX, healthBarY, barWidth, barHeight, 0x555555)

    .setOrigin(0, 0)

    .setScrollFactor(0)

    .setDepth(100);



this.healthBar = this.add.rectangle(healthBarX, healthBarY, barWidth, barHeight, 0x00ff00)

    .setOrigin(0, 0)

    .setScrollFactor(0)

    .setDepth(101);



// === 💀 KILLS CONTAINER ===
const killContainer = this.add.container(baseX, baseY).setScrollFactor(0).setDepth(100);

const killIcon = this.add.text(0, 0, '💀', {
    fontSize: `${iconFontSize}px`,
    backgroundColor: '#000',
    padding: { x: labelPaddingX, y: labelPaddingY }
}).setOrigin(0, 0.5);

this.killsText = this.add.text(killIcon.displayWidth + 8 * this.scaleFactor, 0, this.enemiesKilled.toString(), {
    fontSize: `${iconFontSize}px`,
    fill: '#FF5555',
    backgroundColor: '#000',
    fontStyle: 'bold',
    padding: { x: countPaddingX, y: countPaddingY }
}).setOrigin(0, 0.5);

killContainer.add([killIcon, this.killsText]);

// === 💎 DIAMOND CONTAINER ===
const diamondContainer = this.add.container(baseX, baseY + killIcon.displayHeight + containerSpacing).setScrollFactor(0).setDepth(100);

this.diamondIcon = this.add.text(0, 0, '💎', {
    fontSize: `${iconFontSize}px`,
    backgroundColor: '#000',
    padding: { x: labelPaddingX, y: labelPaddingY }
}).setOrigin(0, 0.5);

this.diamondsText = this.add.text(this.diamondIcon.displayWidth + 8 * this.scaleFactor, 0, this.diamondsCollected.toString(), {
    fontSize: `${iconFontSize}px`,
    fill: '#FFFFFF',
    backgroundColor: '#000',
    padding: { x: countPaddingX, y: countPaddingY }
}).setOrigin(0, 0.5);

diamondContainer.add([this.diamondIcon, this.diamondsText]);






    //Graphics

    this.vfx.addCircleTexture('iceBlue', 0x99ccff, 1, 10);
this.vfx.addCircleTexture('whiteSoft', 0xffffff, 0.8, 8);


    this.vfx.addCircleTexture('red', 0xFF0000, 1, 10);
    this.vfx.addCircleTexture('orange', 0xFFA500, 1, 10);
    this.vfx.addCircleTexture('yellow', 0xFFFF00, 1, 10);
    this.vfx.addCircleTexture('white', 0xFFFFFF, 1, 10);
    this.vfx.addCircleTexture('blue', 0x0000FF, 1, 10);
this.vfx.addCircleTexture('cyan', 0x00FFFF, 1, 10);




            this.tileSize = Math.min(this.width / this.mazeCols, this.height / this.mazeRows);
            this.mazeOffsetX = (this.width - (this.mazeCols * this.tileSize)) / 2;
            this.mazeOffsetY = (this.height - (this.mazeRows * this.tileSize)) / 2;
        const baseMaze = [
        [1,1,1,1,1,1,1,1,1],
        [1,0,0,0,1,0,0,0,1],
        [1,0,1,0,1,0,1,0,1],
        [1,0,1,0,0,0,1,0,1],
        [1,0,1,1,1,1,1,0,1],
        [1,0,0,0,0,0,0,0,1],
        [1,1,1,1,1,1,1,1,1],

            ];
            this.maze = baseMaze;
            this.rows = this.maze.length;
            this.cols = this.maze[0].length;
    
        this.tileSize = Math.min(this.width / this.cols, this.height / this.rows);
        this.mazeOffsetX = (this.width - (this.cols * this.tileSize)) / 2; 
        this.mazeOffsetY = (this.height - (this.rows * this.tileSize)) / 2; 
        this.obstacles = this.physics.add.staticGroup();
        const emptyCells = []; 
        for (let r = 0; r < this.rows; r++) { 
        for (let c = 0; c < this.cols; c++) {
            const x = c * this.tileSize + this.tileSize / 2 + this.mazeOffsetX;
            const y = r * this.tileSize + this.tileSize / 2 + this.mazeOffsetY;

            if (this.maze[r][c] === 1) { 
            const w = this.obstacles.create(x, y, "wall_cave");
            w.setDisplaySize(this.tileSize, this.tileSize); 
            w.refreshBody();
            } else {
            emptyCells.push({ x: x, y: y, col: c, row: r }); 
            }
        }
        }

            this.playerBullets = this.physics.add.group({
            defaultKey: 'projectile',
            classType: Phaser.Physics.Arcade.Image,
            runChildUpdate: true,
        // maxSize: 100,
            });

            this.enemyBullets = this.physics.add.group({
                defaultKey: 'enemyBullet',
                classType: Phaser.Physics.Arcade.Image,
                runChildUpdate: true,
                //maxSize: 200,
            });


    this.powerups = this.physics.add.group();


    if (this.diamonds && this.player && this.player.active) { // Ensure diamonds group and player exist and are active
        this.diamonds.children.each(function(diamond) {
            // Only attract active diamonds with a physics body
            if (diamond.active && diamond.body) {
                const distance = Phaser.Math.Distance.Between(diamond.x, diamond.y, this.player.x, this.player.y);

                if (distance < this.diamondAttractionRange) {
                    const angle = Phaser.Math.Angle.Between(diamond.x, diamond.y, this.player.x, this.player.y);

                    this.physics.velocityFromRotation(angle, this.diamondAttractionForce, diamond.body.velocity);

                } else {
                    
                    diamond.body.velocity.x *= 0.98; 
                    diamond.body.velocity.y *= 0.98; 
                }
            }
        }, this); 
    }

        this.physics.world.on('worldbounds', (body) => {
            if (this.playerBullets.contains(body.gameObject) || this.enemyBullets.contains(body.gameObject)) {
                body.gameObject.disableBody(true, true); 
            }
        });    
        

    const minSafeTiles = 7;
    const minSafeDistancePixels = minSafeTiles * this.tileSize;

    const maxEnemies = Math.min(1, emptyCells.length);
    const enemySpawnCandidates = emptyCells.slice(0, maxEnemies);

    let safePlayerSpawnCells = [];
    emptyCells.forEach(pCell => {
        let isSafe = true;
        for (const eCell of enemySpawnCandidates) {
            const dist = Phaser.Math.Distance.Between(
                pCell.x, pCell.y,
                eCell.x, eCell.y
            );
            if (dist < minSafeDistancePixels) {
                isSafe = false;
                break;
            }
        }
        if (isSafe) {
            safePlayerSpawnCells.push(pCell);
        }
    });

        let pSpawn;
        if (safePlayerSpawnCells.length > 0) {
            pSpawn = Phaser.Math.RND.pick(safePlayerSpawnCells);
        } else {
            console.warn("No perfectly safe spawn spot found for player. Spawning randomly from available cells.");
            pSpawn = Phaser.Math.RND.pick(emptyCells);
        }

    const playerSprite = this.add.sprite(0, 0, "player").setScale(0.17 * this.scaleFactor);

    const weaponData = this.weaponTypes.basic_gun;

    const weapon = this.add.sprite(weaponData.offsetX, weaponData.offsetY, weaponData.key)
        .setScale(weaponData.scale * this.scaleFactor)
        .setOrigin(0.2, 0.5);

    // 3. Create container at player spawn location
    this.player = this.add.container(pSpawn.x, pSpawn.y, [playerSprite, weapon]);

    // 4. Enable physics for the container
    this.physics.add.existing(this.player);

    // 5. Enable collision with world bounds
      this.player.body.setCollideWorldBounds(true);



    // 6. Set body size and offset (similar to original)

    const baseWidth = playerSprite.width * playerSprite.scaleX;

    const baseHeight = playerSprite.height * playerSprite.scaleY;

    this.player.body.setSize(baseWidth * 0.5, baseHeight * 0.5);

    this.player.body.setOffset(-baseWidth * 0.25, -baseHeight * 0.13);

    // 7. Store extra references and metadata
    this.player.currentTile = { x: pSpawn.col, y: pSpawn.row };
    this.player.sprite = playerSprite;
    this.player.weapon = weapon;
    this.player.currentWeapon = 'basic_gun';

        this.playerFireCooldown = 0;


        const pSpawnIndex = emptyCells.findIndex(cell => cell.x === pSpawn.x && cell.y === pSpawn.y);
        if (pSpawnIndex !== -1) {
            emptyCells.splice(pSpawnIndex, 1);
        }

    this.enemies = this.physics.add.group();
        for (let i = 0; i < maxEnemies; i++) {
            if (emptyCells.length === 0) {
                console.warn("Ran out of empty cells for enemy spawns.");
                break;
            }
            const eSpawn = emptyCells.shift();
            const enemyType = this.enemyTypes[i % this.enemyTypes.length]; 
            
            const e = this.enemies.create(eSpawn.x, eSpawn.y, enemyType.spriteKey).setScale(0.17 * this.scaleFactor);
            e.type = enemyType.type;
            e.maxHealth = enemyType.health;
            e.health = enemyType.health;
            e.speed = enemyType.speed;
            e.state = 'idle';
            e.targetTile = null;
            e.clearTint();
            e.setDepth(1);
            e.setOrigin(0.5, 0.5);
            e.body.setSize(e.width * 0.6, e.height * 0.8);
            e.body.setOffset(e.width * 0.2, e.height * 0.1);
            e.dir = ["left", "right", "up", "down"][i % 4];
            e.isMoving = false;
            e.visionCone = this.add.graphics({ fillStyle: { color: 0xffffaa, alpha: 0.2 } });
            e.path = [];
            e.visitedTiles = new Set();
            e.currentTile = { x: eSpawn.col, y: eSpawn.row };
            e.fireCooldown = 0;
            e.nextFireTime = 0;

        }

    // Ensure enemiesKilled is initialized (if not already in constructor)
    if (this.enemiesKilled === undefined) {
        this.enemiesKilled = 0;
    }
  

        this.events.on('enemyDied', (data) => {
        this.enemies.children.iterate(enemy => {
            if (!enemy.active) return;

            if (enemy.type === 'avenger' && enemy.state !== 'investigating') {
                console.log(`Avenger enemy heading to fallen ally at (${data.x}, ${data.y})`);
                enemy.state = 'investigating';
                enemy.targetTile = { x: data.x, y: data.y };
            }
        });
    });

    this.createPowerupUI();
        this.physics.add.collider(this.player, this.obstacles);
        this.physics.add.collider(this.enemies, this.obstacles); 
        this.physics.add.overlap(this.player, this.enemies, this.onEnemyCollision, null, this);
        this.physics.add.overlap(this.player, this.diamonds, this.collectDiamond, null, this);
        this.physics.add.collider(this.enemies, this.enemies);
        this.physics.add.overlap(this.player, this.powerups, this.handlePowerupCollect, null, this);

        this.physics.add.overlap(this.playerBullets, this.enemies, this.hitEnemy, null, this);
        this.physics.add.overlap(this.enemyBullets, this.player, this.hitPlayer, null, this);
        this.physics.add.collider(this.playerBullets, this.obstacles, this.bulletHitWall, null, this);
        this.physics.add.collider(this.enemyBullets, this.obstacles, this.bulletHitWall, null, this);

            joystickEnabled = this.isMobile;

    if (!this.cursors) {
    this.cursors = this.input.keyboard.createCursorKeys();
}

if (!this.joystickKeys) {
    this.joystickKeys = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D
    });
}


console.log('joystickEnabled:',joystickEnabled); 
    if (joystickEnabled) { 
        const joyPlugin = this.plugins.get('rexvirtualjoystickplugin');
        if (joyPlugin) {
            const R = 50;
                const joyPlugin = this.plugins.get('rexvirtualjoystickplugin');
    this.joystick = joyPlugin.add(this, {
        x: R * 2,
        y: this.scale.height - R * 2,
        radius: R,
        base: this.add.circle(0, 0, R * 1.6, 0x888888, 0.5),
        thumb: this.add.circle(0, 0, R * 0.8, 0xcccccc, 0.5),
    });
  
        } else {
            console.warn('rexvirtualjoystickplugin not available, skipping joystick.');
        }
        }

 this.lastTapTime = 0;
this.mobileTapTarget = null;

this.input.on('pointerdown', (pointer) => {
    if (this.isMobile) {
        // Ignore if touch is on joystick
        const isTouchOnJoystick = this.joystick.base && this.joystick.base.getBounds().contains(pointer.x, pointer.y);
        if (isTouchOnJoystick) return;

        const now = this.time.now;
        const doubleTap = (now - this.lastTapTime < 300); // 300ms threshold

        if (doubleTap) {
            this.mobileTapTarget = { x: pointer.worldX, y: pointer.worldY };
        }

        this.lastTapTime = now;
    }
});




        this.input.keyboard.disableGlobalCapture();
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
}

spawnRandomPowerup(x, y) {
    const powerupData = Phaser.Utils.Array.GetRandom(this.powerupTypes);

    const baseScale = powerupData.scale || 0.4;
const adjustedScale = powerupData.spriteKey === 'power_area' ? baseScale * 0.35 : baseScale;

const powerup = this.physics.add.sprite(0, 0, powerupData.spriteKey)
    .setScale(adjustedScale * this.scaleFactor);


    powerup.setData('type', powerupData.type);
    powerup.setData('duration', powerupData.duration);

    // Create glow ring using graphics at (0,0) relative to the container
    const glow = this.add.graphics();
    glow.fillStyle(0xffd700, 0.5); // Gold color with some transparency
    glow.fillCircle(0, 0, powerup.displayWidth * 0.7); 
    const powerupContainer = this.add.container(x, y, [glow, powerup]);
    powerupContainer.setDepth(2); // Set depth for the entire container

    this.physics.world.enable(powerupContainer); // Give physics body to the container
    // Set the circular body relative to the container's origin (0,0)
    powerupContainer.body.setCircle(powerup.displayWidth / 2);
    // Offset the body to center it if the sprite's origin isn't its center (Phaser sprites default to center)
    // If your sprites are centered by default, you might not need this offset or it could be simpler
    powerupContainer.body.setOffset(-powerup.displayWidth / 2, -powerup.displayHeight / 2);


    // Store the reference for logic
    powerupContainer.setData('type', powerupData.type);
    powerupContainer.setData('duration', powerupData.duration);
    this.powerups.add(powerupContainer);

    // Add a pulse tween to simulate glowing
    this.tweens.add({
        targets: glow,
        alpha: { from: 0.5, to: 0.1 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });
}

startNewLevelTransition() {
    if (this.levelTransitioning) return; 
    this.levelTransitioning = true;

   // ✅ Auto-collect ALL powerups remaining on the map before transitioning
this.powerups.children.each(powerup => {
    if (powerup.active) {
        this.handlePowerupCollect(this.player, powerup);
    }
});


    const graphics = this.add.graphics({ fillStyle: { color: 0x000000, alpha: 0 } });
    const centerX = this.player.x;
    const centerY = this.player.y;
    const maxRadius = Math.max(this.width, this.height) * 1.5;

    this.tweens.add({
        targets: graphics,
        alpha: 1,
        duration: 500,
        onUpdate: (tween) => {
            const value = tween.progress;
            graphics.clear();
            graphics.fillStyle(0x000000, value);
            graphics.fillCircle(centerX, centerY, maxRadius * value);
        },
        onComplete: () => {
            this.levelTransitioning = true;

            this.loadingText = this.add.text(
                this.cameras.main.centerX,
                this.cameras.main.centerY,
                'Loading new world...',
                {
                    fontSize: '40px',
                    fill: '#FFFFFF',
                    backgroundColor: '#000000'
                }
            )
            .setOrigin(0.5)
            .setDepth(1000);

            this.time.delayedCall(1500, () => {
                this.maze = this.generateRandomMaze();
                this.buildMazeAndPlaceEntities();

                if (this.loadingText) {
                    this.loadingText.destroy();
                    this.loadingText = null;
                }

                this.tweens.add({
                    targets: graphics,
                    alpha: 0,
                    duration: 500,
                    onUpdate: (tween) => {
                        const value = 1 - tween.progress;
                        graphics.clear();
                        graphics.fillStyle(0x000000, value);
                        graphics.fillCircle(centerX, centerY, maxRadius * value);
                    },
                    onComplete: () => {
                        graphics.destroy();
                        this.levelTransitioning = false;
                    }
                });
            }, [], this);
        }
    });
}



 generateRandomMaze() {
        let newMaze = Array(this.mazeRows).fill(0).map(() => Array(this.mazeCols).fill(1));

        const directions = [
            { dr: -2, dc: 0 }, // Up (move 2 steps to carve a path)
            { dr: 2, dc: 0 },  // Down
            { dr: 0, dc: -2 }, // Left
            { dr: 0, dc: 2 }   // Right
        ];

        let startRow = 1 + 2 * Phaser.Math.Between(0, Math.floor((this.mazeRows - 2) / 2) - 1);
        let startCol = 1 + 2 * Phaser.Math.Between(0, Math.floor((this.mazeCols - 2) / 2) - 1);

        if (startRow < 1 || startRow >= this.mazeRows - 1) startRow = 1;
        if (startCol < 1 || startCol >= this.mazeCols - 1) startCol = 1;

        let stack = [];
        stack.push({ r: startRow, c: startCol });
        newMaze[startRow][startCol] = 0; 
        while (stack.length > 0) {
            let { r: currentRow, c: currentCol } = stack[stack.length - 1]; 
            let unvisitedNeighbors = [];
            for (let dir of directions) {
                let nextRow = currentRow + dir.dr;
                let nextCol = currentCol + dir.dc;

                if (nextRow > 0 && nextRow < this.mazeRows - 1 &&
                    nextCol > 0 && nextCol < this.mazeCols - 1 &&
                    newMaze[nextRow][nextCol] === 1) {
                    unvisitedNeighbors.push({ r: nextRow, c: nextCol, dir: dir });
                }
            }

            if (unvisitedNeighbors.length > 0) {
                let randomIndex = Phaser.Math.Between(0, unvisitedNeighbors.length - 1);
                let nextCell = unvisitedNeighbors.splice(randomIndex, 1)[0]; 
                let nextRow = nextCell.r;
                let nextCol = nextCell.c;
                let dir = nextCell.dir;

                let wallRow = currentRow + dir.dr / 2;
                let wallCol = currentCol + dir.dc / 2;

                newMaze[wallRow][wallCol] = 0; // Carve the wall
                newMaze[nextRow][nextCol] = 0; // Mark the next cell as empty

                stack.push({ r: nextRow, c: nextCol }); // Move to the next cell
            } else {
                stack.pop(); // No unvisited neighbors, backtrack
            }
        }

        const playerSpawnRow = 1; // Example: top-left corner (inner)
        const playerSpawnCol = 1;
        newMaze[playerSpawnRow][playerSpawnCol] = 0;
        if (this.isWalkable(playerSpawnRow, playerSpawnCol + 1)) newMaze[playerSpawnRow][playerSpawnCol + 1] = 0;
        if (this.isWalkable(playerSpawnRow + 1, playerSpawnCol)) newMaze[playerSpawnRow + 1][playerSpawnCol] = 0;

        const enemySpawnRow = this.mazeRows - 2; // Example: bottom-right corner (inner)
        const enemySpawnCol = this.mazeCols - 2;
        newMaze[enemySpawnRow][enemySpawnCol] = 0;
        // Also clear adjacent cells for enemy
        if (this.isWalkable(enemySpawnRow, enemySpawnCol - 1)) newMaze[enemySpawnRow][enemySpawnCol - 1] = 0;
        if (this.isWalkable(enemySpawnRow - 1, enemySpawnCol)) newMaze[enemySpawnRow - 1][enemySpawnCol] = 0;

        return newMaze;
    }

    isWalkable(row, col) {
        return row >= 0 && row < this.mazeRows &&
               col >= 0 && col < this.mazeCols &&
               this.maze[row][col] === 0; // Check against this.maze
    }

    hasOpenNeighbor(row, col) {
        return this.isWalkable(row - 1, col) || // Up
               this.isWalkable(row + 1, col) || // Down
               this.isWalkable(row, col - 1) || // Left
               this.isWalkable(row, col + 1);   // Right
    }


buildMazeAndPlaceEntities() {
    // Increase level at the start of a new maze
    this.currentLevel = (this.currentLevel || 0) + 1;

    this.levelTransitioning = true; 

     if (this.bg) {
        this.bg.destroy();
        this.bg = null; // Clear the reference
    }

    // --- Start: New texture selection logic ---
    let newTextureIndex;
    const numTexturePairs = this.backgroundTextures.length; // Assuming backgroundTextures and wallTextures have the same length

    if (numTexturePairs > 1) {
        do {
            newTextureIndex = Phaser.Math.Between(0, numTexturePairs - 1);
        } while (newTextureIndex === this.lastTextureIndex);
    } else {
        // If there's only one texture pair available, it will always be chosen.
        newTextureIndex = 0;
    }

    const randomBackgroundKey = this.backgroundTextures[newTextureIndex];
    const randomWallKey = this.wallTextures[newTextureIndex];

    this.lastTextureIndex = newTextureIndex; 

    this.bg = this.add.tileSprite(
        this.cameras.main.centerX,
        this.cameras.main.centerY,
        this.sys.game.config.width,
        this.sys.game.config.height,
        randomBackgroundKey // Use the randomly selected background texture
    );
    this.bg.setOrigin(0.5);
    this.bg.setScrollFactor(0);
    this.bg.setDepth(-1); // Background at the very back

   


    if (this.obstacles) {
        this.obstacles.clear(true, true); 
    } else {
        this.obstacles = this.physics.add.staticGroup(); 
    }

    if (this.diamonds) {
        this.diamonds.clear(true, true); 
    } else {
        this.diamonds = this.physics.add.group({
            defaultKey: 'collectible',
            bounceX: 0.5,
            bounceY: 0.5,
            collideWorldBounds: true
        });
 
    }
    if (this.enemies) {
        this.enemies.clear(true, true); 
    } else {
        this.enemies = this.physics.add.group(); 
    }

    if (this.playerBullets) {
        this.playerBullets.clear(true, true); 
    } else {
        this.playerBullets = this.physics.add.group({
            defaultKey: 'projectile', 
            classType: Phaser.Physics.Arcade.Image,
            runChildUpdate: true,
            // maxSize: 100, 
        });
    }

    if (this.enemyBullets) {
        this.enemyBullets.clear(true, true); 
    } else {
        this.enemyBullets = this.physics.add.group({
            defaultKey: 'enemyBullet', // Assuming this is your enemy bullet key
            classType: Phaser.Physics.Arcade.Image,
            runChildUpdate: true,
            // maxSize: 200, 
        });
    }
 


    const emptyCells = [];
    for (let r = 0; r < this.mazeRows; r++) {
        for (let c = 0; c < this.mazeCols; c++) {
            const x = c * this.tileSize + this.tileSize / 2 + this.mazeOffsetX;
            const y = r * this.tileSize + this.tileSize / 2 + this.mazeOffsetY;

            if (this.maze[r][c] === 1) { // If it's a wall
                const w = this.obstacles.create(x, y, randomWallKey);
                w.setDisplaySize(this.tileSize, this.tileSize);
                w.refreshBody();
            } else {
                emptyCells.push({ x: x, y: y, col: c, row: r });
            }
        }
    }

    if (emptyCells.length === 0) {
        console.error("No empty cells found in maze to place player! This level is unplayable.");
        return;
    }

    // Player spawning logic
    if (this.player) {
        let playerSpawnCell = null;
        let pAttempts = 0;
        const maxPlayerAttempts = 50;
        this.player.setDepth(1); // Ensure player depth is set

        while (pAttempts < maxPlayerAttempts && emptyCells.length > 0) {
            const pSpawnIndex = Phaser.Math.Between(0, emptyCells.length - 1);
            const tempPlayerSpawn = emptyCells[pSpawnIndex];

            if (this.hasOpenNeighbor(tempPlayerSpawn.row, tempPlayerSpawn.col)) {
                playerSpawnCell = emptyCells.splice(pSpawnIndex, 1)[0];
                break;
            } else {
                emptyCells.splice(pSpawnIndex, 1);
            }
            pAttempts++;
        }

        if (playerSpawnCell) {
            this.player.setPosition(playerSpawnCell.x, playerSpawnCell.y);
            this.player.body.setVelocity(0, 0);
            this.player.currentTile = { x: playerSpawnCell.col, y: playerSpawnCell.row };
        } else {
            console.error("Could not find a connected spawn point for the player. Player might be isolated.");
            const fallbackSpawn = emptyCells.length > 0 ? emptyCells.splice(0, 1)[0] : { x: this.width/2, y: this.height/2, col: 0, row: 0 };
            this.player.setPosition(fallbackSpawn.x, fallbackSpawn.y);
            this.player.body.setVelocity(0, 0);
            this.player.currentTile = { x: fallbackSpawn.col, y: fallbackSpawn.row };
        }

    } else {
        const pSpawn = emptyCells.shift();
        this.player = this.physics.add.sprite(pSpawn.x, pSpawn.y, "player").setScale(0.17 * this.scaleFactor);
        this.player.setCollideWorldBounds(true);
        this.player.body.setSize(this.player.width * 0.5, this.player.height * 0.8);
        this.player.body.setOffset(this.player.width * 0.25, this.player.height * 0.1);
        this.player.currentTile = { x: pSpawn.col, y: pSpawn.row };
        this.playerFireCooldown = 0;
        this.player.setDepth(1); 
    }

      if (this.diamonds && this.player && this.player.active) { // Ensure diamonds group and player exist and are active
        this.diamonds.children.each(function(diamond) {
            // Only attract active diamonds with a physics body
            if (diamond.active && diamond.body) {
                const distance = Phaser.Math.Distance.Between(diamond.x, diamond.y, this.player.x, this.player.y);

                if (distance < this.diamondAttractionRange) {
                    const angle = Phaser.Math.Angle.Between(diamond.x, diamond.y, this.player.x, this.player.y);

                    this.physics.velocityFromRotation(angle, this.diamondAttractionForce, diamond.body.velocity);

                } else {
                    
                    diamond.body.velocity.x *= 0.98; 
                    diamond.body.velocity.y *= 0.98; 
                }
            }
        }, this); 
    }
    

    // Gradually unlock enemy types based on level
let availableEnemyTypes = [];
if (this.currentLevel >= 3) {
    availableEnemyTypes = this.enemyTypes;
} else if (this.currentLevel === 2) {
    availableEnemyTypes = this.enemyTypes.filter(e => e.type !== 'sniper');
} else {
    availableEnemyTypes = this.enemyTypes.filter(e => e.type === 'chaser');
}

// Dynamically calculate enemy count based on level
const baseEnemies = 1; // Level 1 starts with 1 enemy
const enemiesThisLevel = baseEnemies + Math.floor(this.currentLevel * 1.5);
const targetEnemies = Math.min(enemiesThisLevel, emptyCells.length);

for (let i = 0; i < targetEnemies; i++) {
    let attempts = 0;
    let selectedSpawn = null;
    const maxAttempts = 100;

    while (attempts < maxAttempts && emptyCells.length > 0) {
        const tempSpawnIndex = Phaser.Math.Between(0, emptyCells.length - 1);
        const tempSpawn = emptyCells[tempSpawnIndex];
        if (this.hasOpenNeighbor(tempSpawn.row, tempSpawn.col)) {
            selectedSpawn = emptyCells.splice(tempSpawnIndex, 1)[0];
            break;
        } else {
            emptyCells.splice(tempSpawnIndex, 1);
        }
        attempts++;
    }

    if (selectedSpawn) {
        // Randomly select one of the available enemy types (based on level)
        const enemyType = Phaser.Utils.Array.GetRandom(availableEnemyTypes);

        const e = this.enemies.create(selectedSpawn.x, selectedSpawn.y, enemyType.spriteKey).setScale(0.17 * this.scaleFactor);
        e.type = enemyType.type;
        e.maxHealth = enemyType.health;
        e.health = enemyType.health;
        e.speed = enemyType.speed;

        e.state = 'idle';
        e.targetTile = null;
        e.clearTint();
        e.setDepth(1);
        e.setOrigin(0.5, 0.5);
        e.body.setSize(e.width * 0.6, e.height * 0.8);
        e.body.setOffset(e.width * 0.2, e.height * 0.1);
        e.dir = ["left", "right", "up", "down"][i % 4];
        e.isMoving = false;
        e.visionCone = this.add.graphics({ fillStyle: { color: 0xffffaa, alpha: 0.2 } });
        e.path = [];
        e.visitedTiles = new Set();
        e.currentTile = { x: selectedSpawn.col, y: selectedSpawn.row };
        e.fireCooldown = 0;
        e.nextFireTime = 0;
    } else {
        console.warn("Could not find a connected spawn point for enemy " + (i + 1) + ". Remaining empty cells: " + emptyCells.length + ". Skipping this enemy.");
        break;
    }
}


    this.enemyLives = 5;
    this.playerHealth = 100;
    this.enemyHealth = 100;
    this.playerWon = false;

    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.enemies, this.obstacles);
    this.physics.add.overlap(this.player, this.enemies, this.onEnemyCollision, null, this);
    this.physics.add.overlap(this.player, this.diamonds, this.collectDiamond, null, this);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.overlap(this.playerBullets, this.enemies, this.hitEnemy, null, this);
    this.physics.add.overlap(this.enemyBullets, this.player, this.hitPlayer, null, this);
    this.physics.add.collider(this.playerBullets, this.obstacles, this.bulletHitWall, null, this);
    this.physics.add.collider(this.enemyBullets, this.obstacles, this.bulletHitWall, null, this);
    this.physics.add.overlap(this.player, this.powerups, this.handlePowerupCollect, null, this);


    this.input.keyboard.disableGlobalCapture();
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.levelTransitioning = false;
}

smartEnemyMovement(enemy) {
    const tileSize = this.tileSize;
    const speed = enemy.speed; 
    if (enemy.isMoving) {
        return;
    }

    const enemyTile = {
        x: Math.floor((enemy.x - this.mazeOffsetX) / tileSize),
        y: Math.floor((enemy.y - this.mazeOffsetY) / tileSize),
    };

    const maze = this.maze;
    if (!maze) {
        console.error("Maze not defined on the scene (this.maze). Please set it in create().");
        return;
    }

    if (!enemy.path || enemy.path.length === 0) {
        const emptyTiles = [];
        for (let r = 0; r < maze.length; r++) {
            for (let c = 0; c < maze[0].length; c++) {
                if (maze[r][c] === 0) {
                    emptyTiles.push({ x: c, y: r });
                }
            }
        }

        if (!enemy.visitedTiles) {
            enemy.visitedTiles = new Set();
        }

        const availableTargets = emptyTiles.filter(tile =>
            tile.x !== enemyTile.x || tile.y !== enemyTile.y
        );

        let targetTile = null;

        const unvisitedTargets = availableTargets.filter(tile =>
            !enemy.visitedTiles.has(`${tile.x},${tile.y}`)
        );

        if (unvisitedTargets.length > 0) {
            targetTile = Phaser.Utils.Array.GetRandom(unvisitedTargets);
        } else if (availableTargets.length > 0) {
            enemy.visitedTiles.clear(); 
            targetTile = Phaser.Utils.Array.GetRandom(availableTargets);
        } else {
            console.warn("Enemy at", enemyTile, ": No available empty tiles to pathfind to.");
            return;
        }

        const newPath = this.findPath(enemyTile, targetTile, maze);

        if (newPath.length > 0) {
            enemy.path = newPath;
            enemy.visitedTiles.add(`${targetTile.x},${targetTile.y}`); 
        } else {
            console.warn(`Enemy at (${enemyTile.x},${enemyTile.y}): No path found to target (${targetTile.x},${targetTile.y}).`);
            enemy.path = []; 
            return;
        }
    }

    if (enemy.path && enemy.path.length > 0) {
        const nextTile = enemy.path.shift(); 

        const dx = nextTile.x - enemyTile.x;
        const dy = nextTile.y - enemyTile.y;

        let dir = "";
        if (dx === 1) dir = "right";
        else if (dx === -1) dir = "left";
        else if (dy === 1) dir = "down";
        else if (dy === -1) dir = "up";

        if (dir) {
            this.moveEnemyToTile(enemy, nextTile.x, nextTile.y, speed, dir);
        } else {
            console.warn("Invalid direction calculated for next path step. Re-evaluating path.", enemyTile, nextTile);
            enemy.path = []; 
        }
    }
}

gameOver() {
        this.physics.pause();

        this.player.sprite.setTint(0xff0000); 
        if (this.player.anims) { 
            this.player.anims.stop(); 
        }
        this.player.setActive(false);   
        this.player.setVisible(false);  

        this.gameOverText = this.add.text(
            this.cameras.main.centerX, 
            this.cameras.main.centerY,   
            'GAME OVER',
            {
                fontSize: '90px',
                fill: '#ff0000',          
                backgroundColor: '#000',  
                padding: { x: 20, y: 10 }
            }
        ).setOrigin(0.5)                
         .setDepth(100);                

        this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY + 100,
            'Refresh to Restart',
            {
                fontSize: '32px',
                fill: '#fff',
                backgroundColor: '#000',
                padding: { x: 10, y: 5 }
            }
        ).setOrigin(0.5).setDepth(100);

        this.input.keyboard.enabled = false;
        this.input.mouse.enabled = false;
      
        if (this.joystick) {
             this.joystick.setEnable(false); 
        }
        if (this.joystickKeys) {
            Object.values(this.joystickKeys).forEach(key => key.reset());
        }

        this.enemies.children.iterate(enemy => {
            if (enemy.body) { 
                enemy.body.setVelocity(0);
            }
            enemy.setActive(false);
            enemy.setVisible(false);
        });

        
        this.time.removeAllEvents();
}


hasLineOfSight(startX, startY, endX, endY) {
        const MAX_LOS_RANGE = 300; // In pixels
        const startTile = this.getTileCoordsFromPixels(startX, startY);
        const endTile = this.getTileCoordsFromPixels(endX, endY);

         const dist = Phaser.Math.Distance.Between(startX, startY, endX, endY);
            if (dist > MAX_LOS_RANGE) {
                return false;
            }

        const maze = this.maze;

        let x0 = startTile.col;
        let y0 = startTile.row;
        const x1 = endTile.col;
        const y1 = endTile.row;

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            if (y0 < 0 || y0 >= maze.length || x0 < 0 || x0 >= maze[0].length) {
                return false; 
            }
            if (maze[y0][x0] === 1) {
               
                if (x0 !== endTile.col || y0 !== endTile.row) {
                     return false; 
                }
            }

            if (x0 === x1 && y0 === y1) break;

            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }

        return true; 
    }


    getTileCoordsFromPixels(x, y) {
        const col = Math.floor((x - this.mazeOffsetX) / this.tileSize);
        const row = Math.floor((y - this.mazeOffsetY) / this.tileSize);
        return { col, row };
    }



fireBullet(shooter, targetX, targetY, bulletGroup, bulletSpeed = 400) {
    const spawnOffset = 30;
    const angle = Phaser.Math.Angle.Between(shooter.x, shooter.y, targetX, targetY);

        if (shooter === this.player) {
        switch (this.player.currentWeapon) {
            case 'basic_gun':
                this.sfx.shootBasic.play();
                break;
            case 'shotgun':
                this.sfx.shootShotgun.play();
                break;
            case 'laser':
                this.sfx.shootLaser.play();
                break;
            default:
                this.sfx.shootBasic.play();
        }
    }


    if (shooter !== this.player) {
        shooter.rotation = angle;
        shooter.flipX = false;
    }

    const spawnX = shooter.x + Math.cos(angle) * spawnOffset;
    const spawnY = shooter.y + Math.sin(angle) * spawnOffset;

    let bulletTextureKey = 'enemyBullet'; // default

    // Choose bullet behavior based on current player weapon
    let bulletConfig = {
        texture: 'projectile',
        scale: 0.07,
        damage: 1,
        spread: 0,
        pellets: 1,
        piercing: false,
        tint: 0xffffff
    };

    if (shooter === this.player) {
        const weapon = this.player.currentWeapon;
        if (weapon === 'shotgun') {
            bulletConfig = {
                texture: 'projectile',
                scale: 0.07,
                damage: 1,
                spread: 15,
                pellets: 5,
                piercing: false,
                tint: 0xffaa00
            };
        } else if (weapon === 'laser') {
            bulletConfig = {
                texture: 'projectile',
                scale: 0.05,
                damage: 2,
                spread: 0,
                pellets: 1,
                piercing: true,
                tint: 0x00ffff
            };
        } else {
            // basic_gun or default
            bulletConfig = {
                texture: 'projectile',
                scale: 0.07,
                damage: 1,
                spread: 0,
                pellets: 1,
                piercing: false,
                tint: 0xffffff
            };
        }

        bulletTextureKey = bulletConfig.texture;
    }

    // Shotgun: fire multiple pellets
    const fireSingleBullet = (angleOffset = 0) => {
        const finalAngle = angle + Phaser.Math.DegToRad(angleOffset);
        const bullet = bulletGroup.create(
            shooter.x + Math.cos(finalAngle) * spawnOffset,
            shooter.y + Math.sin(finalAngle) * spawnOffset,
            bulletTextureKey
        );

        if (!bullet) {
            console.warn("Could not create bullet – bullet group full?");
            return;
        }

        bullet.setDepth(2);
        bullet.setActive(true);
        bullet.setVisible(true);
        bullet.setOrigin(0.5);
        bullet.setScale(bulletConfig.scale * this.scaleFactor);
        bullet.setRotation(finalAngle);
        bullet.setTint(bulletConfig.tint);

        this.physics.velocityFromRotation(finalAngle, bulletSpeed, bullet.body.velocity);
        bullet.body.setCollideWorldBounds(true);
        bullet.body.onWorldBounds = true;

        bullet.damage = bulletConfig.damage;
        bullet.piercing = bulletConfig.piercing;

        this.time.delayedCall(1500, () => {
            if (bullet.active) bullet.destroy();
        });
    };

    for (let i = 0; i < bulletConfig.pellets; i++) {
        const spreadAngle = Phaser.Math.Between(-bulletConfig.spread, bulletConfig.spread);
        fireSingleBullet(spreadAngle);
    }
}


displayPowerupNotification(type, duration) {
    const durationSeconds = duration > 0 ? (duration / 1000).toFixed(1) : 'Instant';
    const notificationText = this.add.text(
        this.player.x, // Position X near the player
        this.player.y - 50, // Position Y above the player
        `${type} Activated!`,
        {
            fontFamily: 'pixelfont', // Use your game's font
            fontSize: '24px',
            fill: '#FFFFFF', // White text
            stroke: '#000000', // Black outline
            strokeThickness: 4
        }
    ).setOrigin(0.5); // Center the text

    // Set a depth to ensure it's visible above other elements
    notificationText.setDepth(100);

    // Make the text follow the player, but you might want it to stay put briefly
    // notificationText.setScrollFactor(0); // If you want it relative to the camera

    // Tween to move up, fade out, and destroy the text
    this.tweens.add({
        targets: notificationText,
        y: notificationText.y - 50, // Move 50 pixels up
        alpha: 0, // Fade out
        ease: 'Power1',
        duration: 1500, // Duration of the animation
        onComplete: () => {
            notificationText.destroy(); // Remove the text object after animation
        }
    });

    // Optionally, display the duration separately if it's not instant
    if (duration > 0) {
        const durationText = this.add.text(
            this.player.x,
            this.player.y - 20, // Slightly below the main text
            `Duration: ${durationSeconds}s`,
            {
                fontFamily: 'pixelfont',
                fontSize: '18px',
                fill: '#FFFF00', // Yellow text for duration
                stroke: '#000000',
                strokeThickness: 3
            }
        ).setOrigin(0.5).setDepth(100);

        this.tweens.add({
            targets: durationText,
            y: durationText.y - 50,
            alpha: 0,
            ease: 'Power1',
            duration: 1500,
            onComplete: () => {
                durationText.destroy();
            }
        });
    }
}


handlePowerupCollect(player, powerupContainer) { 
    const type = powerupContainer.getData('type');
    this.sfx.powerup.play();
    powerupContainer.destroy();

    // Increment power-up count
    if (this.playerPowerups[type]) {
        this.playerPowerups[type]++;
    } else {
        this.playerPowerups[type] = 1;
    }

    // Update the UI display for this power-up type
    this.updatePowerupCountUI(type);
}

usePowerup(type) {
    if (this.playerPowerups[type] > 0) {
        // Get the powerup data from our pre-defined types
        const powerupData = this.powerupTypes.find(p => p.type === type);
        if (!powerupData) {
            console.warn(`Attempted to use unknown powerup type: ${type}`);
            return;
        }

        // Consume one power-up
        this.playerPowerups[type]--;
        this.updatePowerupCountUI(type);

        // Apply the power-up effect based on its type
        switch (type) {
            case 'speedBoost':
                this.applySpeedBoost(powerupData.duration);
                break;
            case 'doubleDamage':
                this.applyDoubleDamage(powerupData.duration);
                break;
            case 'areaDamage':
                this.applyAreaDamage(); // Instant, duration is 0
                break;
            case 'freezeEnemies':
                this.applyFreezeEnemies(powerupData.duration);
                break;
            default:
                console.warn(`No action defined for powerup type: ${type}`);
                break;
        }


    } else {
        // Optional: Play a "no powerup" sound or display a message
        // console.log(`No ${type} powerups available!`);
    }
}

updatePowerupCountUI(type) {
    const button = this.powerupButtons[type];
    if (button) {
        const count = this.playerPowerups[type] || 0;
        button.countText.setText(count.toString());

        if (count > 0) {
            button.background.setAlpha(1);
            button.icon.setAlpha(1);
            button.countText.setVisible(true);
        } else {
            button.background.setAlpha(0.5);
            button.icon.setAlpha(0.5);
            button.countText.setVisible(false);
        }
    }
}



createPowerupUI() {
    const screenWidth = this.sys.game.config.width;
    const screenHeight = this.sys.game.config.height;

    const containerY = screenHeight - 60 * this.scaleFactor;
    this.powerupUIContainer = this.add.container(screenWidth / 2, containerY).setScrollFactor(0);
    this.powerupUIContainer.setDepth(100);

    let xOffset = 0;
    const buttonSpacing = 90 * this.scaleFactor;
    const initialX = -(this.powerupTypes.length - 1) * buttonSpacing / 2;

    this.powerupTypes.forEach((powerupData, index) => {
        const bgSize = 64 * this.scaleFactor;
        const glowSize = 72 * this.scaleFactor;
        const iconScale = 0.4 * this.scaleFactor;
        const countFontSize = 18 * this.scaleFactor;

        const bg = this.add.rectangle(initialX + xOffset, 0, bgSize, bgSize, 0x222222, 0.8)
            .setStrokeStyle(2, 0xffffff)
            .setOrigin(0.5)
            .setInteractive({ cursor: 'pointer' });

        const glow = this.add.rectangle(initialX + xOffset, 0, glowSize, glowSize, 0xffff00, 0.1)
            .setOrigin(0.5)
            .setVisible(false);

        const iconScaleAdjusted = powerupData.spriteKey === 'power_area' ? iconScale * 0.5 : iconScale;

        const icon = this.add.image(initialX + xOffset, 0, powerupData.spriteKey)
            .setScale(iconScaleAdjusted)
            .setOrigin(0.5);

        const countText = this.add.text(initialX + xOffset + 20 * this.scaleFactor, 20 * this.scaleFactor, '0', {
            fontSize: `${countFontSize}px`,
            fontStyle: 'bold',
            fill: '#ffffff',
            backgroundColor: '#000000aa',
            padding: {
                x: 6 * this.scaleFactor,
                y: 2 * this.scaleFactor
            },
            align: 'center'
        }).setOrigin(0.5).setDepth(101);

        bg.on('pointerover', () => {
            glow.setVisible(true);
            bg.setFillStyle(0x333333);
        });

        bg.on('pointerout', () => {
            glow.setVisible(false);
            bg.setFillStyle(0x222222);
        });
bg.on('pointerdown', (pointer) => {
    this.pointerOnUI = true;  
    this.sfx.click.play();
    this.usePowerup(powerupData.type);
});

bg.on('pointerup', () => {
    // Optional: reset after a tiny delay
    this.time.delayedCall(100, () => {
        this.pointerOnUI = false;
    });
});


        this.powerupUIContainer.add([glow, bg, icon, countText]);

        this.powerupButtons[powerupData.type] = {
            background: bg,
            icon: icon,
            countText: countText,
            glow: glow
        };

        this.updatePowerupCountUI(powerupData.type);

        xOffset += buttonSpacing;
    });
}


applySpeedBoost(duration) {
    // Cancel old timer if it's still running
    if (this.speedBoostTimer) {
        this.speedBoostTimer.remove(false);
    }

    // Apply the boost
    this.playerSpeed = this.originalPlayerSpeed * 1.5;

    // Show UI (with auto duration reset logic as discussed)
    this.showPowerupNotification('speed', duration);

    // Set new timer to revert speed
    this.speedBoostTimer = this.time.delayedCall(duration, () => {
        this.playerSpeed = this.originalPlayerSpeed;
    });
}


applyDoubleDamage(duration) {
    // Cancel any existing timer
    if (this.doubleDamageTimer) {
        this.doubleDamageTimer.remove(false);
    }

    this.doubleDamage = true;
    this.showPowerupNotification('damage', duration);

    this.doubleDamageTimer = this.time.delayedCall(duration, () => {
        this.doubleDamage = false;
    });
}


showPowerupNotification(type, duration) {
    const iconMap = {
        speed: '⚡',
        freeze: '❄️',
        damage: '💥',
        aoe: '🌪️'
    };

    const labelMap = {
        speed: 'Speed Boost',
        freeze: 'Freeze Enemies',
        damage: 'Double Damage',
        aoe: 'Area Blast'
    };

    const scale = this.scaleFactor || 1;
    const width = 180 * scale;
    const height = 45 * scale;
    const barWidth = 130 * scale;
    const barHeight = 8 * scale;
    const marginTop = 154 * scale;
    const verticalSpacing = 60 * scale;
    const fontSizeLabel = 18 * scale;
    const fontSizeIcon = 24 * scale;

    // If already exists, reset bar
    if (this.activePowerupsUI[type]) {
        const { bar, tween } = this.activePowerupsUI[type];

        if (tween) tween.stop();
        bar.scaleX = 1;

        const newTween = this.tweens.add({
            targets: bar,
            scaleX: 0,
            duration: duration,
            ease: 'Linear',
            onComplete: () => {
                this.activePowerupsUI[type].container.destroy();
                delete this.activePowerupsUI[type];
            }
        });

        this.activePowerupsUI[type].tween = newTween;
        return;
    }

    const offsetY = marginTop + Object.keys(this.activePowerupsUI).length * verticalSpacing;

    const container = this.add.container(20 * scale, offsetY).setScrollFactor(0);
    container.setDepth(999);

    const bg = this.add.rectangle(0, 0, width, height, 0x222222, 0.8)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xffffff);

    const icon = this.add.text(10 * scale, 8 * scale, iconMap[type] || '❔', {
        fontSize: `${fontSizeIcon}px`
    });

    const label = this.add.text(40 * scale, 8 * scale, labelMap[type] || 'Unknown', {
        fontSize: `${fontSizeLabel}px`,
        fill: '#ffffff'
    });

    const barBg = this.add.rectangle(40 * scale, 30 * scale, barWidth, barHeight, 0x555555).setOrigin(0, 0);
    const bar = this.add.rectangle(40 * scale, 30 * scale, barWidth, barHeight, 0x00ff00).setOrigin(0, 0);

    container.add([bg, icon, label, barBg, bar]);
    this.add.existing(container);

    const tween = this.tweens.add({
        targets: bar,
        scaleX: 0,
        duration: duration,
        ease: 'Linear',
        onComplete: () => {
            container.destroy();
            delete this.activePowerupsUI[type];
        }
    });

    this.activePowerupsUI[type] = { container, bar, tween };
}


hitEnemy(bullet, enemy) {
    let damage = this.doubleDamage ? 5 : 1;
    enemy.health -= damage;
    this.sfx.enemyHit.play();

    console.log(`Damage dealt: ${damage}`);
    console.log(`Enemy health after hit: ${enemy.health}`);
    if (this.doubleDamage) {
        console.log('Double Damage active!');
    }

    // 🎯 Show different VFX based on weapon type
    const weapon = this.player.currentWeapon;

    if (weapon === 'basic_gun') {
        this.vfx.createEmitter('orange', enemy.x, enemy.y, 1, 0, 500).explode(15);
        this.vfx.createEmitter('yellow', bullet.x, bullet.y, 0.5, 0, 300).explode(8);
    }

    else if (weapon === 'shotgun') {
        this.vfx.createEmitter('red', enemy.x, enemy.y, 1, 0, 500).explode(25);
        this.vfx.createEmitter('orange', bullet.x, bullet.y, 0.6, 0, 300).explode(10);
        this.vfx.createEmitter('yellow', bullet.x, bullet.y, 0.5, 0, 200).explode(8);
    }

    else if (weapon === 'laser') {
        this.vfx.createEmitter('white', enemy.x, enemy.y, 1, 0, 500).explode(20);
        this.vfx.createEmitter('cyan', bullet.x, bullet.y, 0.4, 0, 100).explode(10);
        this.vfx.createEmitter('blue', bullet.x, bullet.y, 0.2, 0, 100).explode(5);
    }

    // ❄️ Freeze tint for feedback if enemy is still alive
    if (enemy.health <= 0) {
        this.killEnemy(enemy);
    } else {
        enemy.setTint(0xff0000);
        this.time.delayedCall(100, () => enemy.clearTint());
    }

    // 🧊 Destroy bullet **only if it's not a laser**
    if (weapon !== 'laser') {
        bullet.disableBody(true, true);
    } else {
        // Laser can continue moving — add hit cooldown to avoid re-hitting too fast (optional)
        bullet.hitCooldown = this.time.now + 200; // Avoid hitting the same enemy immediately again
    }
}



applyDoubleDamage(duration) {
    // Cancel any existing timer
    if (this.doubleDamageTimer) {
        this.doubleDamageTimer.remove(false);
    }

    this.doubleDamage = true;
    this.showPowerupNotification('damage', duration);

    this.doubleDamageTimer = this.time.delayedCall(duration, () => {
        this.doubleDamage = false;
    });
      
    this.vfx.createEmitter('explosion', this.player.x, this.player.y, 1, 0, 300).explode(30);
}
applyFreezeEnemies(duration) {

     if (this.freezeEnemiesTimer) {
        this.freezeEnemiesTimer.remove(false);
    }
    // 1. Freeze movement & apply VFX
    this.enemies.getChildren().forEach(enemy => {
        if (!enemy.active) return;

        enemy.body.moves = false;
        enemy.isFrozen = true;
        enemy.setTint(0x99ccff); // Icy blue color to indicate frozen
        this.showPowerupNotification('freeze',duration);  // Example for 5 sec speed boost


        // Freeze VFX
        this.vfx.createEmitter('iceBlue', enemy.x, enemy.y, 0.5, 0, 800).explode(15);
        this.vfx.createEmitter('whiteSoft', enemy.x, enemy.y, 0.4, 0, 800).explode(10);
    });

    // 2. Burst effect at player as source of freeze
    this.vfx.createEmitter('iceBlue', this.player.x, this.player.y, 0.8, 0, 500).explode(12);
    this.vfx.createEmitter('whiteSoft', this.player.x, this.player.y, 0.6, 0, 500).explode(8);
    this.cameras.main.shake(150, 0.004);

    // 3. Unfreeze after duration
     this.freezeEnemiesTimer = this.time.delayedCall(duration, () => {
        this.enemies.getChildren().forEach(enemy => {
            if (!enemy.active) return;
            enemy.body.moves = true;
            enemy.isFrozen = false; 
            enemy.clearTint();
        });
    });
}

applyAreaDamage() {
    const radius = 400; // area damage radius (in pixels)
    const damage = 4;

    // Visual VFX: radial wave from player
    this.vfx.createEmitter('white', this.player.x, this.player.y, 0.3, 0, 400).explode(20);
    this.vfx.createEmitter('orange', this.player.x, this.player.y, 0.3, 0, 400).explode(15);
    this.vfx.createEmitter('yellow', this.player.x, this.player.y, 0.3, 0, 400).explode(10);

    this.enemies.getChildren().forEach(enemy => {
        if (!enemy.active || enemy.health <= 0) return;

        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
        if (dist <= radius) {
            enemy.health -= damage;

            if (enemy.health <= 0) {
                this.killEnemy(enemy);
            } else {
                enemy.setTint(0xff8800); // partial damage effect
                this.time.delayedCall(100, () => enemy.clearTint());
            }
        }
    });

    this.showPowerupNotification('aoe', 1000);
}




killEnemy(enemy) {
    const enemyX = enemy.x;
    const enemyY = enemy.y;
    this.sfx.enemyKill.play();
    if (Phaser.Math.Between(0, 100) < 41) { // 30% chance
    this.spawnRandomPowerup(enemyX, enemyY);
    }

    this.cameras.main.shake(200, 0.01);

    this.enemiesKilled++;
    this.killsText.setText('Kills: ' + this.enemiesKilled);
    this.tweens.add({
        targets: this.killsText,
        scale: 1.3,
        duration: 100,
        yoyo: true,
        ease: 'Power1'
    });

    const diamond = this.diamonds.create(enemy.x, enemy.y, 'collectible');
    diamond.setDepth(2);
    diamond.setScale(0.1 * this.scaleFactor);
    diamond.setBounce(0.5);
    diamond.setVelocity(Phaser.Math.Between(-50, 50), Phaser.Math.Between(-50, 50));
    diamond.setDrag(0.95);
    diamond.setCollideWorldBounds(true);

    this.time.delayedCall(100, () => {
        if (enemy.visionCone) enemy.visionCone.destroy();
        this.events.emit('enemyDied', { x: enemyX, y: enemyY });
        this.enemies.remove(enemy, true, true);

        if (this.enemies.countActive(true) === 0 && !this.levelTransitioning) {
            console.log("All enemies defeated! Starting new level...");
            this.startNewLevelTransition();
        }
    }, [], this);
}





hitPlayer(player, bullet) {
    bullet.disableBody(true, true); // Disable the bullet that hit the player
    
    this.sfx.playerHit.play();


    console.log('Player hit!');
    // Increment the counter for every bullet hit
    this.bulletHitCounter++;
    console.log('Bullet hits: ' + this.bulletHitCounter); // For debugging, you can remove this later

    if (this.bulletHitCounter >= 2) {
    this.playerLives--;
    this.bulletHitCounter = 0;
    console.log('Player lost a life! Lives remaining: ' + this.playerLives);

    // Calculate width relative to max lives
    const healthPercent = Phaser.Math.Clamp(this.playerLives / this.playerMaxLives, 0, 1);
    this.healthBar.width = 200 * healthPercent;

    // Optional: Change color based on health (green to red)
    if (healthPercent > 0.5) {
        this.healthBar.fillColor = 0x00ff00; // green
    } else if (healthPercent > 0.2) {
        this.healthBar.fillColor = 0xffff00; // yellow
    } else {
        this.healthBar.fillColor = 0xff0000; // red
    }
    }

  
    player.sprite.setTint(0xff0000);
    this.time.delayedCall(200, () => {
        player.sprite.setTint(0xffffff);
    }, [], this);

  
    if (this.playerLives <= 0) {
        this.gameOver();
    }
}

// Replace your entire onEnemyCollision function with this corrected version:
onEnemyCollision(playerObj, enemy) {
    // 🛑 Prevent multiple collisions
    if (enemy.isDying) return;
    enemy.isDying = true;

    // Disable physics body immediately to avoid further overlaps
    enemy.body.enable = false;

    enemy.health = 0;
    this.killEnemy(enemy);

    const enemyX = enemy.x;
    const enemyY = enemy.y;

    this.vfx.createEmitter('red', enemyX, enemyY, 1, 0, 500).explode(20);
    this.vfx.createEmitter('yellow', enemyX, enemyY, 1, 0, 500).explode(20);
    this.vfx.createEmitter('orange', enemyX, enemyY, 1, 0, 500).explode(20);

    this.cameras.main.shake(200, 0.01);
    this.killsText.setText('Kills: ' + this.enemiesKilled);
    this.tweens.add({
        targets: this.killsText,
        scale: 1.3,
        duration: 100,
        yoyo: true,
        ease: 'Power1'
    });

    console.log('Enemy hit!');

    this.time.delayedCall(100, () => {
        if (enemy.visionCone) {
            enemy.visionCone.destroy();
        }

        this.events.emit('enemyDied', {
            x: enemyX,
            y: enemyY
        });

        this.enemies.remove(enemy, true, true);
        this.spawnDiamondAt(enemyX, enemyY);

        if (this.enemies.countActive(true) === 0 && !this.levelTransitioning) {
            console.log("All enemies defeated! Starting new level...");
            this.startNewLevelTransition();
        }
    }, [], this);
}


   bulletHitWall(bullet, wall) {
    if (bullet.active) { 
        bullet.destroy(); 
        console.log('Bullet hit wall and destroyed!');
    }
}



moveEnemyToTile(enemy, tileX, tileY, speed, dir) {
    const tileSize = this.tileSize; 
    const targetX = tileX * tileSize + tileSize / 2 + this.mazeOffsetX;
    const targetY = tileY * tileSize + tileSize / 2 + this.mazeOffsetY;

    const oldTileX = Math.floor((enemy.x - this.mazeOffsetX) / tileSize);
    const oldTileY = Math.floor((enemy.y - this.mazeOffsetY) / tileSize);


    this.occupiedTiles.delete(`${oldTileX},${oldTileY}`);

    if (this.occupiedTiles.has(`${tileX},${tileY}`)) {
        console.warn(`Tile ${tileX},${tileY} is already occupied, cannot move enemy.`);
        enemy.isMoving = false;
        return;
    }

    this.occupiedTiles.add(`${tileX},${tileY}`);

    enemy.isMoving = true;
    enemy.dir = dir; 
    switch (dir) {
        case "left":
            enemy.angle = 0; 
            enemy.flipX = true; 
            break;
        case "right":
            enemy.angle = 0; 
            enemy.flipX = false; 
            break;
        case "up":
            enemy.angle = -90; 
            enemy.flipX = false; 
            break;
        case "down":
            enemy.angle = 90; 
            enemy.flipX = false; 
            break;
        default:
            enemy.angle = 0;
            enemy.flipX = false;
            break;
    }

    this.tweens.add({
        targets: enemy,
        x: targetX,
        y: targetY,
        duration: speed,
        ease: 'Linear', 
        onComplete: () => {
            enemy.isMoving = false; 
            enemy.x = targetX;
            enemy.y = targetY;
        }
    });
}

findPath(start, end, maze) {
    const rows = maze.length;
    const cols = maze[0].length;

    function inBounds(x, y) {
        return x >= 0 && y >= 0 && x < cols && y < rows;
    }

    function heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    const open = [{ x: start.x, y: start.y, f: 0, g: 0, parent: null }];
    const closed = new Set(); 

    while (open.length > 0) {
        open.sort((a, b) => a.f - b.f); 
        const current = open.shift();
        const key = `${current.x},${current.y}`;

        if (closed.has(key)) continue;
        closed.add(key);

        if (current.x === end.x && current.y === end.y) {
    
            const path = [];
            let node = current;
            while (node.parent) { 
                path.push({ x: node.x, y: node.y });
                node = node.parent;
            }
            path.reverse(); 
            return path;
        }

        const neighbors = [
            { x: current.x + 1, y: current.y },
            { x: current.x - 1, y: current.y },
            { x: current.x, y: current.y + 1 },
            { x: current.x, y: current.y - 1 },
        ];

        for (const n of neighbors) {
            if (
                inBounds(n.x, n.y) &&
                maze[n.y][n.x] === 0 && 
                !closed.has(`${n.x},${n.y}`)
            ) {
                
                const g = current.g + 1;
                const h = heuristic(n, end); 
                const f = g + h;

                const existingOpenNode = open.find(node => node.x === n.x && node.y === n.y);

                if (!existingOpenNode || g < existingOpenNode.g) {
                    if (existingOpenNode) {           
                        existingOpenNode.g = g;
                        existingOpenNode.f = f;
                        existingOpenNode.parent = current;
                    } else {
                        // Add new node to open set
                        open.push({ ...n, g, f, parent: current });
                    }
                }
            }
        }
    }

    return []; // No path found
}


isBlocked(enemy) {
    const tileSize = this.tileSize; // Use scene's tileSize
    const maze = this.maze; // Use scene's maze

    let dx = 0, dy = 0;
    if (enemy.dir === "left") dx = -tileSize;
    else if (enemy.dir === "right") dx = tileSize;
    else if (enemy.dir === "up") dy = -tileSize;
    else if (enemy.dir === "down") dy = tileSize;

    // Calculate next pixel position
    const nextX = enemy.x + dx;
    const nextY = enemy.y + dy;

    // Convert next pixel position to grid coordinates, factoring in offsets
    const nextTileCol = Math.floor((nextX - this.mazeOffsetX) / tileSize);
    const nextTileRow = Math.floor((nextY - this.mazeOffsetY) / tileSize);

    // Check bounds before accessing maze array
    if (nextTileRow < 0 || nextTileRow >= this.rows || nextTileCol < 0 || nextTileCol >= this.cols) {
        return true; // Out of bounds is considered blocked
    }

    return maze[nextTileRow][nextTileCol] === 1; // blocked if wall
}

getTileAt(x, y) {
    const maze = this.maze; // Use scene's maze
    const tileSize = this.tileSize; 
    const col = Math.floor((x - this.mazeOffsetX) / tileSize);
    const row = Math.floor((y - this.mazeOffsetY) / tileSize);

    // Return tile type, treat out-of-bounds as wall
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
        return 1; // wall if outside bounds
    }

    return maze[row][col];
}

getNearestEnemy(x, y) {
    let nearest = null;
    let minDist = Infinity;
    this.enemies.children.iterate(e => {
        const d = Phaser.Math.Distance.Between(e.x, e.y, x, y);
        if (d < minDist) {
            minDist = d;
            nearest = e;
        }
    });
    return nearest;
}


spawnDiamondAt(x, y) {
    const diamond = this.diamonds.create(x, y, "collectible").setScale(0.1 * this.scaleFactor);
}
collectDiamond(player, diamond) {
    diamond.disableBody(true, true); 

    this.diamondsCollected++; 
    this.diamondsText.setText(this.diamondsCollected.toString());

}



createWeaponSwapButton() {
    // Button dimensions and padding
    // Increased buttonSize for a larger button
    const buttonSize = 90 * this.scaleFactor; // Increased from 70 to 90 for a larger button

    // Adjusted buttonPadding to move it slightly higher from the bottom edge
    // (e.g., increased from 20 to 30)
    const buttonPadding = 30 * this.scaleFactor; // Padding from screen edges and bottom

    // Position the button at the bottom-right
    // Calculations remain the same to center the button based on its size and padding
    const buttonX = this.sys.game.config.width - buttonPadding - (buttonSize / 2);
    const buttonY = this.sys.game.config.height - buttonPadding - (buttonSize / 2);

    // Create a graphic for the button background (perfect circle)
    const swapButton = this.add.graphics();
    swapButton.fillStyle(0x333333, 0.7); // Dark grey, semi-transparent
    swapButton.fillCircle(0, 0, buttonSize / 2); // Use buttonSize / 2 for the radius
    swapButton.x = buttonX; // Set graphic object's world X
    swapButton.y = buttonY; // Set graphic object's world Y
    swapButton.setScrollFactor(0); // Fixed on screen
    swapButton.setDepth(100); // Ensure it's above game elements, below pause/notifications

    // Add a weapon icon or text to the button
    const buttonIcon = this.add.text(buttonX, buttonY, '🔄', { // Unicode for 'clockwise vertical arrows'
        fontSize: `${buttonSize * 0.6}px`, // Icon scales with the button size
        fill: '#ffffff',
        fontStyle: 'bold'
    }).setOrigin(0.5) // Center the icon on the button
      .setScrollFactor(0)
      .setDepth(101);

    // Make the button interactive with a circular hit area matching its visual
    swapButton.setInteractive(new Phaser.Geom.Circle(0, 0, buttonSize / 2), Phaser.Geom.Circle.Contains);

    // Add pointerdown listener to swap weapon
    swapButton.on('pointerdown', (pointer) => {
        this.swapWeaponAction();
        pointer.stopPropagation(); // Crucial: Prevent other actions (like shooting) when button is pressed
    });

    // Optional: Add visual feedback on touch
    swapButton.on('pointerover', () => swapButton.setAlpha(0.9));
    swapButton.on('pointerout', () => swapButton.setAlpha(0.7));
    swapButton.on('pointerup', () => swapButton.setAlpha(0.7)); // Reset alpha on release
}

// Add this new method to your scene class
swapWeaponAction() {
    this.currentWeaponIndex = (this.currentWeaponIndex + 1) % this.weaponKeys.length;
    const nextWeapon = this.weaponKeys[this.currentWeaponIndex];
    this.switchWeapon(nextWeapon);
    // You might want to play a sound or show a temporary notification here
    console.log(`Switched to weapon: ${nextWeapon}`);
}


update(time, delta) {
   

   if (this.levelTransitioning) return;
    if (!this.player || !this.player.active) return;

    const isMobile = this.isMobile;
    const currentTime = this.time.now;

    // Reset velocity at the start of each frame
    this.player.body.setVelocity(0);

    let aimAngle;
    const deadzone = 0.2;

    if (isMobile && this.joystick && this.joystick.force > 0.1) {
        let forceX = this.joystick.forceX;
    let forceY = this.joystick.forceY;

    // Calculate magnitude of joystick input
    const magnitude = Math.sqrt(forceX * forceX + forceY * forceY);

    // Remap magnitude from [deadzone..1] to [0..1]
    const normalizedMagnitude = Phaser.Math.Clamp((magnitude - deadzone) / (1 - deadzone), 0, 1);

    // Normalize direction vector (forceX, forceY)
    const directionX = forceX / magnitude;
    const directionY = forceY / magnitude;

    // Calculate final velocity applying remapped magnitude for smooth sensitivity
    const velocityX = directionX * normalizedMagnitude * this.playerSpeed * this.scaleFactor;
    const velocityY = directionY * normalizedMagnitude * this.playerSpeed * this.scaleFactor;

    const aimAngle = Phaser.Math.Angle.Between(0, 0, forceX, forceY);
    this.player.setRotation(aimAngle);
    this.player.body.setVelocity(velocityX, velocityY);

    } else {
        // Non-mobile / no joystick — fallback to keyboard + mouse

        // Aim angle towards mouse pointer
        const pointer = this.input.activePointer;
        aimAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);
        this.player.setRotation(aimAngle);

        // Movement vector based on WASD / arrow keys
        let vx = 0, vy = 0;
        if (this.cursors?.up?.isDown || this.joystickKeys?.up?.isDown) {
    vx += Math.cos(aimAngle) * this.playerSpeed;
    vy += Math.sin(aimAngle) * this.playerSpeed;
}
if (this.cursors?.down?.isDown || this.joystickKeys?.down?.isDown) {
    vx -= Math.cos(aimAngle) * this.playerSpeed;
    vy -= Math.sin(aimAngle) * this.playerSpeed;
}
if (this.cursors?.left?.isDown || this.joystickKeys?.left?.isDown) {
    vx += Math.cos(aimAngle - Math.PI / 2) * this.playerSpeed;
    vy += Math.sin(aimAngle - Math.PI / 2) * this.playerSpeed;
}
if (this.cursors?.right?.isDown || this.joystickKeys?.right?.isDown) {
    vx += Math.cos(aimAngle + Math.PI / 2) * this.playerSpeed;
    vy += Math.sin(aimAngle + Math.PI / 2) * this.playerSpeed;
}


        if (vx !== 0 || vy !== 0) {
            const v = new Phaser.Math.Vector2(vx, vy).normalize().scale(this.playerSpeed * this.scaleFactor);
            this.player.body.setVelocity(v.x, v.y);
        } else {
            this.player.body.setVelocity(0);
        }
    }


    // === SHOOTING ===
    if (this.playerFireCooldown > 0) {
        this.playerFireCooldown -= delta;
    }

    
    const canShoot = 
    (!isMobile && ((!this.pointerOnUI && (this.cursors.space.isDown || this.input.activePointer.isDown)))) ||
    (isMobile && this.mobileTapTarget);  // Only fire if mobile tap target exists

    if (canShoot && this.playerFireCooldown <= 0) {
    let targetX, targetY;

    if (isMobile && this.mobileTapTarget) {
        targetX = this.mobileTapTarget.x;
        targetY = this.mobileTapTarget.y;
        this.mobileTapTarget = null; // reset after shot
    } else {
        // Desktop aim from pointer direction
        const aimAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.input.activePointer.worldX, this.input.activePointer.worldY);
        targetX = this.player.x + Math.cos(aimAngle) * 10;
        targetY = this.player.y + Math.sin(aimAngle) * 10;
    }

    this.fireBullet(this.player, targetX, targetY, this.playerBullets);
    this.playerFireCooldown = this.playerFireRate;
    }


    // === DIAMOND ATTRACTION ===
    if (this.diamonds && this.player && this.player.active) {
        this.diamonds.children.each(diamond => {
            if (diamond.active && diamond.body) {
                const angle = Phaser.Math.Angle.Between(diamond.x, diamond.y, this.player.x, this.player.y);
                this.physics.velocityFromRotation(angle, this.diamondAttractionForce, diamond.body.velocity);
            }
        });
    }

    // === BULLET CLEANUP ===
    this.playerBullets.children.iterate(bullet => {
        if (bullet.active && (this.time.now > bullet.lifespan || (Math.abs(bullet.body.velocity.x) < 1 && Math.abs(bullet.body.velocity.y) < 1))) {
            bullet.disableBody(true, true);
        }
    });

    this.enemyBullets.children.iterate(bullet => {
        if (bullet.active && (this.time.now > bullet.lifespan || (Math.abs(bullet.body.velocity.x) < 1 && Math.abs(bullet.body.velocity.y) < 1))) {
            bullet.disableBody(true, true);
        }
    });

    // === ENEMY BEHAVIOR ===
    this.enemies.children.iterate(enemy => {
        if (!enemy.active || enemy.isFrozen || !enemy.visionCone) return;

        const cone = enemy.visionCone;
        cone.clear();
        const viewRadius = 200;
        const viewAngle = Phaser.Math.DegToRad(90);
        const segments = 20;
        const facingAngle = enemy.rotation;
        const startAngle = facingAngle - viewAngle / 2;
        const points = [new Phaser.Math.Vector2(enemy.x, enemy.y)];

        for (let i = 0; i <= segments; i++) {
            const angle = startAngle + (i / segments) * viewAngle;
            const x = enemy.x + Math.cos(angle) * viewRadius;
            const y = enemy.y + Math.sin(angle) * viewRadius;
            points.push(new Phaser.Math.Vector2(x, y));
        }

        // Avenger investigation logic
        if (enemy.type === 'avenger' && enemy.state === 'investigating' && enemy.targetTile) {
            const tileSize = this.tileSize;
            const enemyTile = {
                x: Math.floor((enemy.x - this.mazeOffsetX) / tileSize),
                y: Math.floor((enemy.y - this.mazeOffsetY) / tileSize)
            };

            if (!enemy.path || enemy.path.length === 0) {
                if (!this.maze) return;

                const path = this.findPath(enemyTile, enemy.targetTile, this.maze);
                enemy.path = path.length > 0 ? path : [];
            }

            if (enemy.path.length > 0 && !enemy.isMoving) {
                const nextTile = enemy.path.shift();
                const dx = nextTile.x - enemyTile.x;
                const dy = nextTile.y - enemyTile.y;

                let dir = "";
                if (dx === 1) dir = "right";
                else if (dx === -1) dir = "left";
                else if (dy === 1) dir = "down";
                else if (dy === -1) dir = "up";

                if (dir) this.moveEnemyToTile(enemy, nextTile.x, nextTile.y, 1400, dir);
                else {
                    enemy.path = [];
                    enemy.state = 'idle';
                    enemy.targetTile = null;
                    enemy.body.setVelocity(0);
                }
            }

            if (enemy.path.length === 0 && !enemy.isMoving) {
                enemy.state = 'idle';
                enemy.targetTile = null;
                enemy.body.setVelocity(0);
            }
            return;
        }

        // Enemy shooting logic
        const shootRange = this.tileSize * 5;
        const distToPlayer = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
        const hasLOS = this.hasLineOfSight(enemy.x, enemy.y, this.player.x, this.player.y);

        if (distToPlayer < shootRange && hasLOS) {
            enemy.body.setVelocity(0);
            const angleToPlayer = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
            enemy.setRotation(angleToPlayer);

            if (currentTime > enemy.nextFireTime) {
                this.fireBullet(enemy, this.player.x, this.player.y, this.enemyBullets);
                enemy.nextFireTime = currentTime + 500;
            }
        } else {
            if (!enemy.isMoving && enemy.body.moves) {
                this.smartEnemyMovement(enemy);
            }
        }
    });



    // === WEAPON SWITCHING ===
    this.weaponKeys = ["basic_gun", "shotgun", "laser"];
    this.currentWeaponIndex = this.currentWeaponIndex || 0;

    // this.input.keyboard.on("keydown-Q", () => {
    //     this.currentWeaponIndex = (this.currentWeaponIndex + 1) % this.weaponKeys.length;
    //     const nextWeapon = this.weaponKeys[this.currentWeaponIndex];
    //     this.switchWeapon(nextWeapon);
    // });
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
        progressBar.fillStyle(0x00ff00, 1);
        progressBar.fillRect(x, y, width * value, height);
    });
    this.load.on('complete', function () {
        progressBar.destroy();
        progressBox.destroy();
        loadingText.destroy();
    });
}

/*
------------------- GLOBAL CODE ENDS HERE -------------------
*/

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
