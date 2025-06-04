class CharacterSelectionScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CharacterSelectionScene' });
    }

    preload() {
        this.load.bitmapFont('pixelfont', 'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.png', 'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.xml');
        this.loadAssets(_CONFIG.imageLoader, 'image');
        this.loadAssets(_CONFIG.soundsLoader, 'audio');
    }

    loadAssets(loader, type) {
        for (const key in loader) {
            if (type === 'image') {
                this.load.image(key, loader[key]);
            } else {
                this.load.audio(key, [loader[key]]);
            }
        }
    }

    create() {
        this.add.image(this.game.config.width / 2, this.game.config.height / 2, 'select_bg').setOrigin(0.5).setScale(1);
        
        const characters = this.getCharacterData();
        const positions = [0.16, 0.5, 0.84];
        
        characters.forEach((character, index) => {
            this.createCharacterOption(character, positions[index], index);
        });
    }

    getCharacterData() {
        return [
            { 
                name: 'Fighter', sprite: 'character_1', speed: 10, health: 300, 
                abilities: { punch: 20, kick: 30, special: 50 }, 
                special: 'Power Punch', description: 'Destroys all enemies on the scene.'
            },
            { 
                name: 'Ninja', sprite: 'character_2', speed: 12, health: 280, 
                abilities: { punch: 15, kick: 25, special: 60 }, 
                special: 'Immortal', description: 'Immune to attacks for 5 secs.'
            },
            { 
                name: 'Mage', sprite: 'character_3', speed: 8, health: 320, 
                abilities: { punch: 15, kick: 20, special: 30 }, 
                special: { name: 'Magic Projectile' }, description: 'Throws a magic missile.'
            }
        ];
    }

    createCharacterOption(character, xPercent, index) {
        const x = this.game.config.width * xPercent;
        const y = this.game.config.height * 0.45;
        
        const button = this.add.sprite(x, y, `${character.sprite}_idle`)
            .setScale(2)
            .setInteractive({ cursor: 'pointer' });
        
        const specialName = character.special.name || character.special;
        
        // Create semi-transparent background for better text visibility
        const bgWidth = 400;
        const bgHeight = 270;
        const textBg = this.add.graphics();
        textBg.fillStyle(0x000000, 0.7); // Black with 70% opacity
        textBg.fillRoundedRect(x - bgWidth/2, y + 170, bgWidth, bgHeight, 10);
        
        // Add white stroke/outline effect by creating multiple text objects
        const createTextWithOutline = (x, y, text, size, color = 0xffffff) => {
            // Create outline (black text slightly offset in multiple directions)
            const outlineOffsets = [
                [-2, -2], [-2, 0], [-2, 2],
                [0, -2],           [0, 2],
                [2, -2],  [2, 0],  [2, 2]
            ];
            
            outlineOffsets.forEach(([offsetX, offsetY]) => {
                this.add.bitmapText(x + offsetX, y + offsetY, 'pixelfont', text, size)
                    .setOrigin(0.5)
                    .setTint(0x000000); // Black outline
            });
            
            // Create main text (colored)
            return this.add.bitmapText(x, y, 'pixelfont', text, size)
                .setOrigin(0.5)
                .setTint(color);
        };
        
        // Character name with larger, bright color
        createTextWithOutline(x, y + 200, character.name, 32, 0x00ff00); // Bright green
        
        // Special ability in bright yellow
        createTextWithOutline(x, y + 250, `Special: ${specialName}`, 26, 0xffff00); // Bright yellow
        
        // Description in light blue
        createTextWithOutline(x, y + 300, character.description, 20, 0x87ceeb); // Sky blue
        
        // Stats in different colors
        createTextWithOutline(x, y + 350, `Speed: ${character.speed}`, 22, 0xff6347); // Tomato red
        createTextWithOutline(x, y + 400, `Health: ${character.health}`, 22, 0xff69b4); // Hot pink
        
        button.on('pointerdown', () => {
            this.scene.start('GameScene', { selectedCharacter: character });
        });
        
        // Add hover effect for better interactivity
        button.on('pointerover', () => {
            button.setTint(0xcccccc);
            button.setScale(2.1);
        });
        
        button.on('pointerout', () => {
            button.clearTint();
            button.setScale(2);
        });
    }
}
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.initializeGameState();
    }

    initializeGameState() {
        this.score = 0;
        this.level = 1;
        this.enemiesDefeated = 0;
        this.isPlayerAlive = true;
        this.specialCooldown = 0;
        this.isSpecialOnCooldown = false;
        this.enemySpawnTimer = 0;
        this.maxEnemiesOnScreen = 3;
        this.currentEnemyCount = 0;
        this.enemiesSpawnedThisLevel = 0;
        this.enemiesToSpawnThisLevel = 5;
        this.cameraOffsetX = 0;
        this.cameraSpeed = 0.3;
    }

    init(data) {
        this.selectedCharacter = data.selectedCharacter || this.getDefaultCharacter();
    }

    getDefaultCharacter() {
        return { 
            name: 'Fighter', sprite: 'character_1', speed: 10, health: 300, 
            abilities: { punch: 20, kick: 30, special: 50 }, 
            special: 'Power Punch', description: 'Unleashes a devastating punch that destroys all enemies on the scene.'
        };
    }

    preload() {
        addEventListenersPhaser.bind(this)();
        this.loadAssets();
        displayProgressLoader.call(this);
    }

    loadAssets() {
        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        this.load.image('pause_button', 'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png');
        this.load.bitmapFont('pixelfont', 'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.png', 'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.xml');
    }

    create() {
        this.setupScene();
        this.createUI();
        this.createPlayer();
        this.createEnemies();
        this.setupControls();
        this.setupCollisions();
        this.setupEnemySpawning();
    }

    setupScene() {
        this.initializeSounds();
        this.width = this.game.config.width;
        this.height = this.game.config.height;
        
        this.createBackground();
        this.createPlatform();
        
        this.vfx = new VFXLibrary(this);
        this.createVFXTextures();
    }

    createVFXTextures() {
    // Create custom textures for VFX
    this.vfx.addCircleTexture('hit_particle', 0xff4444, 1, 8);
    this.vfx.addCircleTexture('punch_particle', 0xffaa00, 1, 6);
    this.vfx.addCircleTexture('kick_particle', 0x44ff44, 1, 10);
    this.vfx.addCircleTexture('hurt_particle', 0xff0000, 1, 100);
    this.vfx.addCircleTexture('spawn_particle', 0x8844ff, 1, 15);
}

    initializeSounds() {
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }
        this.backgroundMusic = this.sounds.background.setVolume(2.5).setLoop(true);
        this.backgroundMusic.play();
    }

    createBackground() {
    // Create multiple background images for seamless scrolling
    this.backgrounds = [];
    
    // Create 3 background instances side by side
    for (let i = -1; i <= 1; i++) {
        const bg = this.add.image(this.width / 2 + (i * this.width), this.height / 2, 'background_forest').setOrigin(0.5);
        const scale = Math.max(this.width / bg.displayWidth, this.height / bg.displayHeight);
        bg.setScale(scale * 1.2); // Make slightly larger to avoid gaps
        bg.setDepth(0); // Behind everything
        this.backgrounds.push(bg);
    }
}

    createPlatform() {
    const platformHeight = 200;
    const platformY = this.height - platformHeight / 2;
    
    // Create multiple platform tiles for seamless scrolling
    this.platforms = [];
    
    for (let i = -1; i <= 1; i++) {
        const platform = this.add.tileSprite(this.width / 2 + (i * this.width), platformY, this.width, platformHeight, 'platform_grass');
        platform.setOrigin(0.5, 0.5);
        this.physics.add.existing(platform);
        platform.body.immovable = true;
        platform.body.allowGravity = false;
        platform.setDepth(5);
        this.platforms.push(platform);
    }
    
    this.groundLevel = platformY - platformHeight / 2;
}

    createUI() {
        this.scorePanelBg = this.add.rectangle(this.width * 0.5, this.height * 0.05, 300, 50, 0x000000).setOrigin(0.5).setAlpha(0.7).setDepth(10);
this.scorePanelBorder = this.add.rectangle(this.width * 0.5, this.height * 0.05, 304, 54, 0xffffff).setOrigin(0.5).setStrokeStyle(3, 0xffd700).setDepth(10);

// Separate score and level text with icons
this.scoreText = this.add.bitmapText(this.width/2-100, this.height * 0.05, 'pixelfont', `${this.score}`, 36).setOrigin(0.5).setDepth(11).setTint(0xffd700);
this.levelText = this.add.bitmapText(this.width/2 + 100, this.height * 0.05, 'pixelfont', `LV.${this.level}`, 36).setOrigin(0.5).setDepth(11).setTint(0x00ff88);

// Add small icons/symbols
this.add.bitmapText(this.width * 0.35, this.height * 0.05, 'pixelfont', '★', 32).setOrigin(0.5).setDepth(11).setTint(0xffd700);
this.add.bitmapText(this.width/2, this.height * 0.05, 'pixelfont', '|', 32).setOrigin(0.5).setDepth(11).setTint(0x666666);
        
        this.playerHealth = this.selectedCharacter.health;
        this.healthBarBg = this.add.rectangle(this.width * 0.2, this.height * 0.05, 154, 24, 0x000000).setOrigin(0, 0.5).setAlpha(0.8);
this.healthBarBorder = this.add.rectangle(this.width * 0.2, this.height * 0.05, 158, 28, 0xffffff).setOrigin(0, 0.5).setStrokeStyle(2, 0xffffff);

// Health bar with gradient effect
this.playerHealthBar = this.add.rectangle(this.width * 0.2, this.height * 0.05, 150, 20, 0x00ff00).setOrigin(0, 0.5);

// Mana bar background  
this.manaBarBg = this.add.rectangle(this.width * 0.2, this.height * 0.05 + 35, 154, 14, 0x000000).setOrigin(0, 0.5).setAlpha(0.8);
this.manaBarBorder = this.add.rectangle(this.width * 0.2, this.height * 0.05 + 35, 158, 18, 0xffffff).setOrigin(0, 0.5).setStrokeStyle(2, 0xffffff);

// Mana bar with blue gradient
this.playerManaBar = this.add.rectangle(this.width * 0.2, this.height * 0.05 + 35, 150, 10, 0x0088ff).setOrigin(0, 0.5);

// Add health/mana text labels
this.add.bitmapText(350, this.height * 0.05 - 3, 'pixelfont', 'HP', 25).setOrigin(0.5).setTint(0xff4444);
this.add.bitmapText(350, this.height * 0.05 + 32, 'pixelfont', 'MP', 22).setOrigin(0.5).setTint(0x4488ff);
       this.playerIcon = this.add.sprite(this.width * 0.1, 100, `${this.selectedCharacter.sprite}_icon`).setScale(4).setDepth(10);
        const maskRadius = this.playerIcon.displayWidth / 3;
        // Add black circular border
        const borderGraphics = this.add.graphics()
            .fillStyle(0x000000, 1)
            .fillCircle(this.playerIcon.x, this.playerIcon.y, maskRadius + 2)
            .setDepth(9); // Depth below icon
        // Create and apply circular mask
        const maskGraphics = this.add.graphics()
            .fillCircle(this.playerIcon.x, this.playerIcon.y, maskRadius)
            .setDepth(10);
        const mask = maskGraphics.createGeometryMask();
        this.playerIcon.setMask(mask);
        this.instructionText = this.add.bitmapText(this.width * 0.5, this.height * 0.3, 'pixelfont', 'Arrow Keys: Move\nZ: Punch\nX: Kick\nS: Special', 24).setOrigin(0.5).setDepth(11);
        this.time.delayedCall(5000, () => this.instructionText.destroy());

        const pauseButton = this.add.sprite(this.width * 0.9, this.height * 0.05, 'pause_button').setOrigin(0.5).setScale(1.5).setInteractive({ cursor: 'pointer' });
        pauseButton.on('pointerdown', () => this.pauseGame());

        // Special attack cooldown indicator
this.specialCooldownBg = this.add.rectangle(this.width * 0.2, this.height * 0.12, 154, 14, 0x000000).setOrigin(0, 0.5).setAlpha(0.8);
this.specialCooldownBar = this.add.rectangle(this.width * 0.2, this.height * 0.12, 150, 10, 0xff8800).setOrigin(0, 0.5);
this.add.bitmapText(350, this.height * 0.12 - 2, 'pixelfont', 'SP', 22).setOrigin(0.5).setTint(0xff8800);
    }

    updateHealthBarColor() {
    const healthPercent = this.player.health / this.selectedCharacter.health;
    if (healthPercent > 0.6) {
        this.playerHealthBar.setFillStyle(0x00ff00); // Green
    } else if (healthPercent > 0.3) {
        this.playerHealthBar.setFillStyle(0xffaa00); // Orange
    } else {
        this.playerHealthBar.setFillStyle(0xff0000); // Red
    }
}

    createPlayer() {
        const playerY = this.groundLevel - 50;
        this.player = this.physics.add.sprite(this.width * 0.3, playerY, `${this.selectedCharacter.sprite}_idle`).setScale(3);
        this.player.setCollideWorldBounds(true);
        this.player.health = this.playerHealth;
        this.player.mana = 100;
        this.player.speed = this.selectedCharacter.speed;
        this.player.setGravityY(300);
        this.player.setBounce(0.2);
        this.player.setDepth(10);
    }

    createEnemies() {
        this.enemies = this.physics.add.group();
        // Start with fewer enemies since we'll spawn them dynamically
        this.currentEnemyCount = 0;
        this.enemiesSpawnedThisLevel = 0;
        this.enemiesToSpawnThisLevel = 3 + this.level * 2; // Scale with level
    }

    setupEnemySpawning() {
        // Set up random enemy spawning
        this.enemySpawnTimer = this.time.addEvent({
            delay: Phaser.Math.Between(2000, 4000), // Random spawn time between 2-4 seconds
            callback: this.spawnRandomEnemy,
            callbackScope: this,
            loop: true
        });
    }

    spawnRandomEnemy() {
        if (this.currentEnemyCount >= this.maxEnemiesOnScreen || 
            this.enemiesSpawnedThisLevel >= this.enemiesToSpawnThisLevel ||
            !this.isPlayerAlive) {
            return;
        }

        // Random spawn positions on the platform
        const spawnSide = Phaser.Math.Between(0, 3); // 0: left, 1: right, 2: top-left, 3: top-right
        let spawnX, spawnY;

        switch(spawnSide) {
            case 0: // Left side
                spawnX = 50;
                spawnY = this.groundLevel - 50;
                break;
            case 1: // Right side
                spawnX = this.width - 50;
                spawnY = this.groundLevel - 50;
                break;
            case 2: // Top-left
                spawnX = this.width * 0.2;
                spawnY = this.groundLevel - 200;
                break;
            case 3: // Top-right
                spawnX = this.width * 0.8;
                spawnY = this.groundLevel - 200;
                break;
        }

        const enemy = this.createSingleEnemy(spawnX, spawnY);
        this.enemies.add(enemy);
        this.currentEnemyCount++;
        this.enemiesSpawnedThisLevel++;

        // Spawn VFX
        this.vfx.createEmitter('spawn_particle', spawnX, spawnY, 0.5, 0, 800).explode(25);
        this.vfx.shakeCamera(200, 0.005);

        // Reset timer with new random delay
        this.enemySpawnTimer.delay = Phaser.Math.Between(1500, 3500);
    }

    createSingleEnemy(x, y) {
        const enemy = this.physics.add.sprite(x, y, 'enemy_1').setScale(0.4);
        
        enemy.health = 60 + (this.level * 20); // Scale health with level
        enemy.mana = 100;
        enemy.speed = 2 + this.level * 0.5;
        enemy.setCollideWorldBounds(true);
        enemy.setGravityY(300);
        enemy.setBounce(0.2);
        enemy.attackCooldown = 0;
        enemy.setDepth(10);

        enemy.healthBarBg = this.add.rectangle(enemy.x, enemy.y - 100, 54, 12, 0x000000).setOrigin(0.5).setDepth(14).setAlpha(0.8);
enemy.healthBar = this.add.rectangle(enemy.x, enemy.y - 100, 50, 8, 0xff4444).setOrigin(0.5).setDepth(15);

// Enemy mana bar background
enemy.manaBarBg = this.add.rectangle(enemy.x, enemy.y - 87, 54, 10, 0x000000).setOrigin(0.5).setDepth(14).setAlpha(0.8);
enemy.manaBar = this.add.rectangle(enemy.x, enemy.y - 87, 50, 6, 0x4488ff).setOrigin(0.5).setDepth(15);
        enemy.icon = this.add.sprite(enemy.x, enemy.y - 120, 'enemy_1_icon').setScale(0.5).setDepth(15);

        return enemy;
    }

    setupControls() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = {
            punch: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
            kick: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X),
            special: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S)
        };

        this.setupTouchControls();
    }

    setupTouchControls() {
        this.touchControls = this.add.group();
        if (this.game.device.os.desktop !== true) {
            const buttonSpacing = 80;
            const buttonY = this.height * 0.85;
            ['punch', 'kick', 'special'].forEach((action, index) => {
                const button = this.add.sprite(this.width * 0.6 + index * buttonSpacing, buttonY, `${action}_button`)
                    .setScale(0.5)
                    .setInteractive({ cursor: 'pointer' });
                button.on('pointerdown', () => this.handleTouchAction(action));
                this.touchControls.add(button);
            });

            this.input.on('pointermove', (pointer) => {
    if (pointer.isDown && pointer.x < this.width * 0.3) {
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.x, pointer.y);
        const velocityX = Math.cos(angle) * this.player.speed * 20;
        const velocityY = Math.sin(angle) * this.player.speed * 20;
        
        this.player.setVelocityX(velocityX);
        this.player.setVelocityY(velocityY);
        this.player.setFlipX(pointer.x < this.player.x);
        
        // Add scrolling for touch controls
        if (velocityX < 0) {
            this.cameraOffsetX -= this.cameraSpeed * this.player.speed;
        } else if (velocityX > 0) {
            this.cameraOffsetX += this.cameraSpeed * this.player.speed;
        }
        
        // Update multiple backgrounds and platforms
this.backgrounds.forEach((bg, index) => {
    bg.x = (this.width / 2) + ((index - 1) * this.width * 2) - this.cameraOffsetX * 0.5;
});

this.platforms.forEach((platform, index) => {
    platform.x = (this.width / 2) + ((index - 1) * this.width * 2) - this.cameraOffsetX * 0.8;
});
    }
});
        }
    }

    setupCollisions() {
    this.platforms.forEach(platform => {
        this.physics.add.collider(this.player, platform);
        this.physics.add.collider(this.enemies, platform);
    });
    this.physics.add.overlap(this.player, this.enemies, this.playerHitEnemy, null, this);
}

    handleTouchAction(action) {
        if (!this.player) return;
        
        const actions = {
            punch: () => this.performAttack('punch', this.selectedCharacter.abilities.punch),
            kick: () => this.performAttack('kick', this.selectedCharacter.abilities.kick),
            special: () => this.handleSpecialAttack()
        };
        
        actions[action]?.();
    }

    performAttack(attackType, damage) {
    if (!this.player || !this.player.active || !this.isPlayerAlive) return;
    const player = this.player;
    const selectedCharacter = this.selectedCharacter;
    
    player.setTexture(`${selectedCharacter.sprite}_${attackType}`);
    
    // Add attack VFX - back to original
    const particleType = `${attackType}_particle`;
    const offsetX = player.flipX ? -40 : 40;
    this.vfx.createEmitter(particleType, player.x + offsetX, player.y, 0.3, 0, 600).setDepth(8).explode(2);
    // Screen shake for attacks
    this.vfx.shakeCamera(150, 0.008);
    
    this.physics.world.overlap(player, this.enemies, (player, enemy) => {
        this.dealDamage(enemy, damage, attackType);
    });
    
    this.sounds[attackType].play();
    
    this.time.delayedCall(500, () => {
        if (player) player.setTexture(`${selectedCharacter.sprite}_idle`);
    });
}

    handleSpecialAttack() {
         if (!this.player || !this.player.active || !this.isPlayerAlive || this.isSpecialOnCooldown || this.player.mana < 100) return;

        this.player.mana -= 100;
        this.sounds.special.play();
        
        this.isSpecialOnCooldown = true;
        this.specialCooldown = 5000;

        const specialAttacks = {
            'Power Punch': () => this.powerPunchAttack(),
            'Immortal': () => this.immortalAttack(),
            'Magic Projectile': () => this.magicProjectileAttack()
        };

        const specialName = this.selectedCharacter.special.name || this.selectedCharacter.special;
        specialAttacks[specialName]?.();
    }

    powerPunchAttack() {
        const player = this.player;
        player.setTexture(`${this.selectedCharacter.sprite}_shoot`);
        
        // Massive screen shake for special attack
        this.vfx.shakeCamera(800, 0.02);
        
        this.enemies.getChildren().forEach(enemy => {
            this.dealDamage(enemy, 9999, 'special');
            this.vfx.createEmitter('fire', enemy.x, enemy.y, 0.5, 0, 1000).setDepth(8).explode(30);
        });
        
        this.time.delayedCall(500, () => {
            if (player) player.setTexture(`${this.selectedCharacter.sprite}_idle`);
        });
    }

    immortalAttack() {
        const player = this.player;
        player.setTexture(`${this.selectedCharacter.sprite}_shoot`);
        this.player.isImmortal = true;
        player.setTint(0x00ff00);
        
        // Glow effect for immortality
        //this.vfx.addGlow(player, 0.8, 0x00ff88);
        this.vfx.createEmitter('shadow', player.x, player.y, 0.02, 0, 5000).start();
        
        this.time.delayedCall(5000, () => {
            if (player) {
                this.player.isImmortal = false;
                player.clearTint();
            }
        });
        
        this.time.delayedCall(500, () => {
            if (player) player.setTexture(`${this.selectedCharacter.sprite}_idle`);
        });
    }

    magicProjectileAttack() {
        const player = this.player;
        player.setTexture(`${this.selectedCharacter.sprite}_shoot`);
        const projectile = this.add.sprite(player.x + (player.flipX ? -50 : 50), player.y, 'projectile_1').setScale(0.5).setDepth(100);
        projectile.direction = player.flipX ? -1 : 1;
        
        // Projectile trail effect
        //this.vfx.addGlow(projectile, 0.7, 0x4488ff);
        
        this.tweens.add({
            targets: projectile,
            x: player.x + (projectile.direction * this.width),
            duration: 1000,
            onUpdate: () => {
                // Create trail particles
                this.vfx.createEmitter('hit_particle', projectile.x, projectile.y, 0.1, 0, 300).setDepth(8).explode(3);
                
                this.enemies.getChildren().forEach(enemy => {
                    const distanceX = Math.abs(projectile.x - enemy.x);
                    const distanceY = Math.abs(projectile.y - enemy.y);
                    if (distanceX < 50 && distanceY < 50) {
                        this.dealDamage(enemy, 9999, 'special');
                        this.vfx.createEmitter('hit', enemy.x, enemy.y, 0.4, 0, 800).explode(25);
                    }
                });
            },
            onComplete: () => projectile.destroy()
        });
        
        this.time.delayedCall(500, () => {
            if (player) player.setTexture(`${this.selectedCharacter.sprite}_idle`);
        });
    }

    update(time, delta) {
        if (!this.isPlayerAlive || !this.player || !this.player.active) return;

        this.updateUI();
        this.handlePlayerMovement();
        this.handlePlayerAttacks();
        this.updateCooldowns(delta);
        this.updateEnemies(delta);
        this.checkLevelCompletion();
    }

    updateUI() {
    // Update score and level text separately
    this.scoreText.setText(`${this.score}`);
    this.levelText.setText(`LV.${this.level}`);
    
    // Update health bar with smooth animation and color change
    const healthPercent = Math.max(0, this.player.health / this.selectedCharacter.health);
    this.playerHealthBar.width = healthPercent * 150;
    this.updateHealthBarColor();
    
    // Update mana bar
    this.playerManaBar.width = Math.max(0, (this.player.mana / 100) * 150);
    
    // Add pulsing effect to low health
    if (healthPercent < 0.3) {
        this.tweens.add({
            targets: [this.playerHealthBar, this.healthBarBorder],
            alpha: 0.5,
            duration: 300,
            yoyo: true,
            repeat: 0
        });
    }
}

  handlePlayerMovement() {
    this.player.setVelocityX(0);
    this.player.setVelocityY(0);
    
    if (this.cursors.left.isDown) {
        this.player.setVelocityX(-this.player.speed * 20);
        this.player.setFlipX(true);
        this.cameraOffsetX -= this.cameraSpeed * this.player.speed;
    } else if (this.cursors.right.isDown) {
        this.player.setVelocityX(this.player.speed * 20);
        this.player.setFlipX(false);
        this.cameraOffsetX += this.cameraSpeed * this.player.speed;
    }
    
    if (this.cursors.up.isDown) {
        this.player.setVelocityY(-this.player.speed * 20);
    } else if (this.cursors.down.isDown) {
        this.player.setVelocityY(this.player.speed * 20);
    }
    
    // Update backgrounds with infinite scrolling
    this.backgrounds.forEach((bg, index) => {
        bg.x = (this.width / 2) + ((index - 1) * this.width) - (this.cameraOffsetX * 0.5) % this.width;
        
        // Reset position for infinite scrolling
        if (bg.x < -this.width) {
            bg.x += this.width * 3;
        } else if (bg.x > this.width * 2) {
            bg.x -= this.width * 3;
        }
    });
    
    // Update platforms with infinite scrolling
    this.platforms.forEach((platform, index) => {
        platform.x = (this.width / 2) + ((index - 1) * this.width) - (this.cameraOffsetX * 0.8) % this.width;
        
        // Reset position for infinite scrolling
        if (platform.x < -this.width) {
            platform.x += this.width * 3;
        } else if (platform.x > this.width * 2) {
            platform.x -= this.width * 3;
        }
    });
}

    handlePlayerAttacks() {
        if (Phaser.Input.Keyboard.JustDown(this.keys.punch)) {
            this.performAttack('punch', this.selectedCharacter.abilities.punch);
        }
        if (Phaser.Input.Keyboard.JustDown(this.keys.kick)) {
            this.performAttack('kick', this.selectedCharacter.abilities.kick);
        }
        if (Phaser.Input.Keyboard.JustDown(this.keys.special)) {
            this.handleSpecialAttack();
        }
    }

    updateCooldowns(delta) {
    if (this.isSpecialOnCooldown) {
        this.specialCooldown -= delta;
        const cooldownPercent = Math.max(0, this.specialCooldown / 5000);
        this.specialCooldownBar.width = cooldownPercent * 150;
        this.playerManaBar.fillColor = 0x808080;
        
        if (this.specialCooldown <= 0) {
            this.isSpecialOnCooldown = false;
            this.playerManaBar.fillColor = 0x0088ff;
            // Add ready flash effect
            this.tweens.add({
                targets: this.specialCooldownBar,
                alpha: 0.3,
                duration: 200,
                yoyo: true,
                repeat: 2
            });
        }
    } else {
        this.specialCooldownBar.width = 150; // Full when ready
    }

    if (!this.isSpecialOnCooldown) {
        this.player.mana = Math.min(this.player.mana + 0.02 * delta, 100);
    }
}

    updateEnemies(delta) {
        this.enemies.getChildren().forEach(enemy => {
            if (!enemy || !enemy.body || !enemy.active) return;

            this.updateEnemyAI(enemy, delta);
            this.updateEnemyUI(enemy);
            this.checkEnemyHealth(enemy);
        });
    }

    updateEnemyAI(enemy, delta) {
        enemy.setVelocityX(0);
        enemy.setVelocityY(0);
        
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
        
        if (distance > 100) {
            this.physics.moveToObject(enemy, this.player, enemy.speed * 50);
            enemy.setFlipX(this.player.x < enemy.x);
        }

        if (enemy.attackCooldown > 0) {
            enemy.attackCooldown -= delta;
        } else if (distance < 50) {
            this.dealDamage(this.player, 15, 'punch');
            enemy.attackCooldown = 1000;
            
            // Enemy attack VFX
            this.vfx.createEmitter('hurt_particle', this.player.x, this.player.y, 0.5, 0, 400).setDepth(12).explode(10);
        }

        enemy.mana = Math.min(enemy.mana + 0.001 * delta, 100);
    }

    updateEnemyUI(enemy) {
    // Add existence checks for all UI elements
    if (enemy.healthBar && enemy.manaBar && enemy.icon && 
        enemy.healthBarBg && enemy.manaBarBg) {
        
        // Update positions for backgrounds
        enemy.healthBarBg.setPosition(enemy.x, enemy.y - 100);
        enemy.healthBar.setPosition(enemy.x, enemy.y - 100);
        enemy.healthBar.width = Math.max(0, (enemy.health / (60 + this.level * 20)) * 50);
        
        enemy.manaBarBg.setPosition(enemy.x, enemy.y - 87);
        enemy.manaBar.setPosition(enemy.x, enemy.y - 87);
        enemy.manaBar.width = Math.max(0, (enemy.mana / 100) * 50);
        enemy.icon.setPosition(enemy.x, enemy.y - 120);
    }
}

    checkEnemyHealth(enemy) {
    if (enemy.health <= 0) {
        // Death VFX
        this.vfx.shakeCamera(300, 0.01);
        
        // Clean up enemy UI
        this.cleanupEnemyUI(enemy);
        
        // Remove and destroy enemy
        this.enemies.remove(enemy);
        enemy.destroy();
        
        this.enemiesDefeated++;
        this.currentEnemyCount--;
        this.score += 10;
    }
}

    checkLevelCompletion() {
        // Level complete when all enemies for this level have been spawned and defeated
        if (this.enemiesSpawnedThisLevel >= this.enemiesToSpawnThisLevel && 
            this.enemies.getChildren().length === 0) {
            this.resetLevel();
        }
    }

   dealDamage(target, damage = 15, attackType) {
    if (target === this.player && this.player.isImmortal) return;
    
    target.health -= damage;
    
    // Enhanced damage VFX
    if (target === this.player) {
        this.vfx.createEmitter('hurt_particle', target.x, target.y, 0.5, 0, 600).setDepth(12).explode(15);
        this.vfx.shakeGameObject(target, 200, 8);
        this.sounds.hurt.play();
    } else {
        this.vfx.createEmitter('hit_particle', target.x, target.y, 0.25, 0, 500).explode(12);
        this.vfx.shakeGameObject(target, 150, 5);
        this.sounds[attackType].play();
    }
}

    playerHitEnemy(player, enemy) {
        if (this.player.isInvulnerable || !this.player.active || this.player.isImmortal) return;
        
        this.dealDamage(this.player, 15, 'punch');
        this.player.isInvulnerable = true;
        //this.player.setAlpha(0.5);
        
        // Blink effect when hit
        //this.vfx.blinkEffect(this.player, 200, 5);
        
        this.time.delayedCall(1000, () => {
            if (this.player && this.player.active) {
                this.player.isInvulnerable = false;
                this.player.setAlpha(1);
            }
        });
        
        if (this.player.health <= 0) {
            this.gameOver();
        }
    }

    resetLevel() {
    this.level += 1;
    this.enemiesDefeated = 0;

    // Clean up all enemy UI elements properly
    this.enemies.getChildren().forEach(enemy => {
        if (enemy.healthBar) enemy.healthBar.destroy();
        if (enemy.healthBarBg) enemy.healthBarBg.destroy();  // Add this line
        if (enemy.manaBar) enemy.manaBar.destroy();
        if (enemy.manaBarBg) enemy.manaBarBg.destroy();      // Add this line
        if (enemy.icon) enemy.icon.destroy();
    });
    
    // Clear and destroy all enemies
    this.enemies.clear(true, true);
    
    // Reset counters
    this.currentEnemyCount = 0;
    this.enemiesSpawnedThisLevel = 0;
    this.enemiesToSpawnThisLevel = 3 + this.level * 2;

    this.createEnemies();
    this.physics.add.collider(this.enemies, this.platform);
    this.physics.add.overlap(this.player, this.enemies, this.playerHitEnemy, null, this);

    this.sounds.levelUp.play();

    if (this.player && this.player.body) {
        this.player.x = this.width * 0.3;
        this.player.y = this.groundLevel - 50;
        if (this.player.health < this.selectedCharacter.health) {
            this.player.health += this.selectedCharacter.health * 0.5;
            if(this.player.health > this.selectedCharacter.health){
                this.player.health = this.selectedCharacter.health;
            }
        }
    }
}
cleanupEnemyUI(enemy) {
    // Safely destroy all UI elements associated with an enemy
    const uiElements = ['healthBar', 'healthBarBg', 'manaBar', 'manaBarBg', 'icon'];
    uiElements.forEach(element => {
        if (enemy[element] && enemy[element].destroy) {
            enemy[element].destroy();
            enemy[element] = null;
        }
    });
}

    gameOver() {
        this.isPlayerAlive = false;
        if (this.player) {
            this.vfx.createEmitter('hurt_particle', this.player.x, this.player.y, 0.5, 0, 1000).setDepth(12).explode(400);
            this.player.destroy();
            this.player = false;
        }
        this.sounds.lose.play();
        this.backgroundMusic.stop();
        this.time.delayedCall(2000, () => {
            initiateGameOver.bind(this)({ score: this.score });
        });
    }

    pauseGame() {
        handlePauseGame.bind(this)();
    }
}

function displayProgressLoader() {
    const width = 320, height = 50;
    const x = (this.game.config.width / 2) - 160;
    const y = (this.game.config.height / 2) - 50;

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

const config = {
    type: Phaser.AUTO,
    width: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width,
    height: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].height,
    scene: [CharacterSelectionScene, GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        orientation: _CONFIG.deviceOrientation === 'landscape' ? Phaser.Scale.Orientation.LANDSCAPE : Phaser.Scale.Orientation.PORTRAIT
    },
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: 'Use Arrow Keys to move, Z to punch, X to kick, S for special attack. Defeat all enemies to progress.'
    },
    deviceOrientation: _CONFIG.deviceOrientation
};