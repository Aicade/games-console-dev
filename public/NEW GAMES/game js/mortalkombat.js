class CharacterSelectScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CharacterSelectScene' });
        this.vfx = null;
        this.selectedCard = null;
        this.cpuSelectedCard = null;
        // Use navigator.userAgent for device detection
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        //this.isMobile = true; //test
    }

    preload() {
        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        for (const key in _CONFIG.libLoader) {
            this.load.image(key, _CONFIG.libLoader[key]);
        }

        // Load bitmap font
        this.load.bitmapFont(
            'pixelfont',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.png',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.xml'
        );
        
        this.width = this.game.config.width; // Dynamic width
        this.height = this.game.config.height; // Dynamic height
    }

    create() {
        // Initialize VFX Library
        this.vfx = new VFXLibrary(this);

        // Add background with fighting arena style
        this.add.image(0, 0, 'selectionscreen').setOrigin(0).setDisplaySize(this.width, this.height);
        
        // Title
        this.add.bitmapText(this.width / 2, this.isMobile ? 40 : 50, 'pixelfont', 'SELECT YOUR FIGHTER', this.isMobile ? 28 : 36)
            .setTint(0xffffff)
            .setOrigin(0.5);
        
        // Create character cards
        this.createCharacterCards();
        
        // VS text in the middle
        this.add.bitmapText(this.width / 2, this.height / 2, 'pixelfont', 'VS', this.isMobile ? 36 : 48)
            .setTint(0xff0000)
            .setOrigin(0.5);
        
        // Player and CPU indicators
        this.playerText = this.add.bitmapText(this.width / 4, this.isMobile ? 80 : 150, 'pixelfont', 'PLAYER', this.isMobile ? 22 : 30)
            .setTint(0x00ff00)
            .setOrigin(0.5);
            
        this.cpuText = this.add.bitmapText(this.width * 3/4, this.isMobile ? 80 : 150, 'pixelfont', 'CPU', this.isMobile ? 22 : 30)
            .setTint(0xFFA500)
            .setOrigin(0.5);
        
        // Instructions
        this.add.bitmapText(this.width / 2, this.height - (this.isMobile ? 20 : 50), 'pixelfont', 'SELECT A CHARACTER CARD', this.isMobile ? 18 : 24)
            .setTint(0xffffff)
            .setOrigin(0.5);
    }
    
    createCharacterCards() {
        // Character data
        const characters = [
            { type: 'player', fullBodyType: 'fighter1', name: 'NINJA', tint: 0xADD8E6 },
            { type: 'enemy', fullBodyType: 'fighter2', name: 'HOVER', tint: 0xFFD700 }
        ];
        
        // Card positions
        const cardWidth = this.isMobile ? 120 : 150;
        const cardHeight = this.isMobile ? 160 : 200;
        const spacing = this.isMobile ? 30 : 40;
        const startX = this.width / 4 - cardWidth / 2;
        const cardY = this.height * (this.isMobile ? 0.65 : 0.75);
        
        // Create player selection area
        this.playerSelectionContainer = this.add.container(0, 0);
        
        // Create cards for player selection
        characters.forEach((char, index) => {
            // Create card background
            const cardX = startX + (cardWidth + spacing) * index;
            
            // Card background
            const card = this.add.rectangle(cardX, cardY, cardWidth, cardHeight, 0x333333)
                .setStrokeStyle(4, 0x666666)
                .setInteractive()
                .setData('character', char);
            
            // Character portrait 
            const portrait = this.add.image(cardX, cardY - (this.isMobile ? 25 : 30), char.type)
                .setScale(this.isMobile ? 0.25 : 0.3);
                
            // Card decoration
            const decoration = this.add.rectangle(cardX, cardY + (this.isMobile ? 10 : 15), cardWidth - (this.isMobile ? 8 : 10), this.isMobile ? 32 : 40, 0x111111)
                .setStrokeStyle(2, char.tint).setVisible(false);
                
            // Character name
            const nameText = this.add.bitmapText(cardX, cardY + (this.isMobile ? 50 : 60), 'pixelfont', char.name, this.isMobile ? 18 : 24)
                .setTint(char.tint)
                .setOrigin(0.5);
                
            // Group card elements
            const cardGroup = this.add.container(0, 0, [card, portrait, decoration, nameText]);
            cardGroup.setData('character', char);
            this.playerSelectionContainer.add(cardGroup);
            
            // Add glow effect on hover
            card.on('pointerover', () => {
                card.setStrokeStyle(4, char.tint);
                this.vfx.scaleGameObject(portrait, 1.1, 200, 0);
            });
            
            card.on('pointerout', () => {
                if (this.selectedCard !== card) {
                    card.setStrokeStyle(4, 0x666666);
                    portrait.setScale(this.isMobile ? 0.25 : 0.3);
                }
            });
            
            // Selection logic with touch feedback for mobile
            card.on('pointerdown', () => {
                if (this.isMobile) {
                    this.tweens.add({
                        targets: cardGroup,
                        scale: 1.1,
                        duration: 100,
                        yoyo: true,
                        onComplete: () => this.selectCharacter(card, char, cardGroup)
                    });
                } else {
                    this.selectCharacter(card, char, cardGroup);
                }
            });
        });
        
        // Create CPU selection area
        this.cpuCardContainer = this.add.container(this.width * 3/4, cardY);
        
        // Display empty CPU card
        this.cpuCardBg = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x333333)
            .setStrokeStyle(4, 0x666666);
        
        // Card decoration for CPU
        const cpuDecoration = this.add.rectangle(0, this.isMobile ? 10 : 15, cardWidth - (this.isMobile ? 8 : 10), this.isMobile ? 32 : 40, 0x111111)
            .setStrokeStyle(2, 0xff0000).setVisible(false);
            
        this.cpuCardLabel = this.add.bitmapText(0, this.isMobile ? 50 : 60, 'pixelfont', 'CPU CHOICE', this.isMobile ? 16 : 20)
            .setTint(0xFFA500)
            .setOrigin(0.5);
        this.cpuCardContainer.add([this.cpuCardBg, cpuDecoration, this.cpuCardLabel]);
    }
    
    selectCharacter(card, character, cardGroup) {
        // Already selected
        if (this.selectedCard === card) return;
        
        // Reset previous selection if any
        if (this.selectedCard) {
            this.selectedCard.setStrokeStyle(4, 0x666666);
        }
        
        // Sound effect for selection
        if (_CONFIG.soundsLoader.selectSound) {
            this.sound.play('selectSound');
        }
        
        // Set as selected
        this.selectedCard = card;
        card.setStrokeStyle(6, character.tint);
        
        // Add full body character display on player side
        if (this.playerFullBodySprite) {
            this.playerFullBodySprite.destroy();
        }
        
        if (this.playerFaceSprite) {
            this.playerFaceSprite.destroy();
        }
        
        // Display the full body character
        this.playerFullBodySprite = this.add.image(this.width / 4, this.height * 0.45, character.fullBodyType)
            .setScale(this.isMobile ? 2.5 : 3.5)
            .setAlpha(0);
            
        // Add face on top of body
        this.playerFaceSprite = this.add.image(this.playerFullBodySprite.x, this.playerFullBodySprite.y + (this.isMobile ? -100 : -150), character.type)
            .setScale(this.isMobile ? 0.25 : 0.3)
            .setAlpha(0);
            
        // Fade in animation for full body character and face
        this.tweens.add({
            targets: [this.playerFullBodySprite, this.playerFaceSprite],
            alpha: 1,
            duration: 500,
            ease: 'Back.out'
        });
        
        // Make CPU select the other character
        this.selectCpuCharacter(character);
        
        // Wait and then show confirmation
        this.time.delayedCall(1000, () => {
            this.showConfirmation(character.fullBodyType, character.name);
        });
    }
    
    selectCpuCharacter(playerCharacter) {
        // Clear previous CPU selection
        this.cpuCardContainer.removeAll(true);
        
        // Find the other character
        const characters = [
            { type: 'player', fullBodyType: 'fighter1', name: 'NINJA', tint: 0xADD8E6 },
            { type: 'enemy', fullBodyType: 'fighter2', name: 'HOVER', tint: 0xFFD700 }
        ];
        
        const cpuCharacter = characters.find(c => c.type !== playerCharacter.type);
        
        // Card width and height
        const cardWidth = this.isMobile ? 120 : 150;
        const cardHeight = this.isMobile ? 160 : 200;
        
        // Create CPU card with character
        const cpuCard = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x333333)
            .setStrokeStyle(6, cpuCharacter.tint);
            
        const cpuPortrait = this.add.image(0, -(this.isMobile ? 25 : 30), cpuCharacter.type)
            .setScale(this.isMobile ? 0.25 : 0.3);
        
        // Decoration
        const cpuDecoration = this.add.rectangle(0, this.isMobile ? 10 : 15, cardWidth - (this.isMobile ? 8 : 10), this.isMobile ? 32 : 40, 0x111111)
            .setStrokeStyle(2, cpuCharacter.tint).setVisible(false);
            
        const cpuNameText = this.add.bitmapText(0, this.isMobile ? 50 : 60, 'pixelfont', cpuCharacter.name, this.isMobile ? 18 : 24)
            .setTint(cpuCharacter.tint)
            .setOrigin(0.5);
            
        // Add to container
        this.cpuCardContainer.add([cpuCard, cpuPortrait, cpuDecoration, cpuNameText]);
        
        // Animation for CPU selection
        this.tweens.add({
            targets: this.cpuCardContainer,
            scaleX: [0, 1.2, 1],
            scaleY: [0, 1.2, 1],
            duration: 500,
            ease: 'Back.out'
        });
        
        // CPU selection effect
        this.time.delayedCall(200, () => {
            //this.vfx.flashGameObject(cpuPortrait, 0xffffff, 300);
        });
        
        // Display full body character on CPU side
        if (this.cpuFullBodySprite) {
            this.cpuFullBodySprite.destroy();
        }
        
        if (this.cpuFaceSprite) {
            this.cpuFaceSprite.destroy();
        }
        
        // Add CPU full body character
        this.cpuFullBodySprite = this.add.image(this.width * 3/4, this.height * 0.45, cpuCharacter.fullBodyType)
            .setScale(this.isMobile ? 2.5 : 3.5)
            .setFlipX(true)
            .setAlpha(0);
            
        // Add face on top of body
        this.cpuFaceSprite = this.add.image(this.cpuFullBodySprite.x, this.cpuFullBodySprite.y + (this.isMobile ? -100 : -150), cpuCharacter.type)
            .setScale(this.isMobile ? 0.25 : 0.3)
            .setAlpha(0).setFlipX(true);
            
        // Fade in animation for CPU full body character and face
        this.tweens.add({
            targets: [this.cpuFullBodySprite, this.cpuFaceSprite],
            alpha: 1,
            duration: 500,
            ease: 'Back.out',
            delay: 300
        });
        
        // Store CPU selection
        this.cpuSelectedCharacter = cpuCharacter;
    }
    
    showConfirmation(playerCharacterType, playerCharacterName) {
        // Darken the background
        const overlay = this.add.rectangle(0, 0, this.width, this.height, 0x000000, 0.7)
            .setOrigin(0);
            
        // Create confirmation text
        const vs = this.add.bitmapText(this.width / 2, this.height / 2, 'pixelfont', 'VS', this.isMobile ? 48 : 64)
            .setTint(0xff0000)
            .setOrigin(0.5)
            .setAlpha(0);
            
        const playerName = this.add.bitmapText(this.width / 3, this.height / 2, 'pixelfont', playerCharacterName, this.isMobile ? 36 : 48)
            .setTint(0x00ff00)
            .setOrigin(0.5)
            .setAlpha(0);
            
        const cpuName = this.add.bitmapText(this.width * 2/3, this.height / 2, 'pixelfont', this.cpuSelectedCharacter.name, this.isMobile ? 36 : 48)
            .setTint(0xff0000)
            .setOrigin(0.5)
            .setAlpha(0);
        
        // Animate VS text
        this.tweens.add({
            targets: vs,
            alpha: 1,
            scale: [0, 1.5, 1],
            duration: 1000,
            ease: 'Bounce'
        });
        
        // Animate player name
        this.tweens.add({
            targets: playerName,
            alpha: 1,
            x: {from: this.width / 4, to: this.width / 3},
            duration: 800,
            delay: 300
        });
        
        // Animate CPU name
        this.tweens.add({
            targets: cpuName,
            alpha: 1,
            x: {from: this.width * 3/4, to: this.width * 2/3},
            duration: 800,
            delay: 300,
            onComplete: () => {
                // Wait a bit and start the game
                this.time.delayedCall(1500, () => {
                    this.scene.start('GameScene', { 
                        playerCharacter: this.cpuSelectedCharacter.fullBodyType === 'fighter1' ? 'fighter2' : 'fighter1',
                        cpuCharacter: this.cpuSelectedCharacter.fullBodyType
                    });
                });
            }
        });
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.score = 0;
        this.isGameOver = false;
        this.cpuAttackType = null;
        this.playerAttackType = null;
        this.playerFacingRight = true;
        this.cpuFacingLeft = true;
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        //this.isMobile = true; //test
        this.sounds = {};
    }

    init(data) {
        this.playerCharacter = data.playerCharacter || 'fighter1';
    }

    preload() {
        this.width = this.game.config.width;
        this.height = this.game.config.height;

        // Load images from config
        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        // Load sounds from config
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }

        // Load library images from config
        for (const key in _CONFIG.libLoader) {
            this.load.image(key, _CONFIG.libLoader[key]);
        }

        // Load atlases from config
        for (const key in _CONFIG.atlasLoader) {
            const atlas = _CONFIG.atlasLoader[key];
            if (atlas.atlasURL) {
                this.load.atlas(key, atlas.textureURL, atlas.atlasURL);
            } else if (atlas.atlasData) {
                this.load.atlas(key, atlas.textureURL, atlas.atlasData);
            }
        }

        displayProgressLoader.call(this);

        this.load.on('fileerror', (file) => {
            console.error(`Error loading file: ${file.key}`);
        });
    }

    create() {
        this.width = this.game.config.width;
        this.height = this.game.config.height;

        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        this.sounds.background.setVolume(0.5).setLoop(true).play();

        this.cameras.main.setBackgroundColor(0x000000);

        const background = this.add.image(this.width / 2, this.height / 2, 'background')
            .setOrigin(0.5)
            .setDisplaySize(this.width, this.height)
            .setDepth(0);

        this.platforms = this.physics.add.staticGroup();
        const platform = this.platforms.create(this.width / 2, this.height - (this.isMobile ? 20 : 40), 'platform')
            .setScale(this.isMobile ? 2.5 : 3)
            .refreshBody()
            .setDepth(1).setVisible(false);

        this.scoreText = this.add.text(this.width / 2, this.isMobile ? 30 : 60, this.score, {
            fontFamily: 'Arial',
            fontSize: this.isMobile ? 24 : 32,
            color: '#ffffff'
        }).setOrigin(0.5, 0.5).setDepth(10);

        this.anims.create({
            key: 'walkRight',
            frames: [
                { key: 'fighterAtlas', frame: 'image_102-removebg-preview.png' },
                { key: 'fighterAtlas', frame: 'image_103-removebg-preview.png' },
                { key: 'fighterAtlas', frame: 'image_103-removebg-preview(1).png' },
                { key: 'fighterAtlas', frame: 'image_104-removebg-preview.png' },
                { key: 'fighterAtlas', frame: 'image_105-removebg-preview.png' }
            ],
            frameRate: this.isMobile ? 8 : 10,
            repeat: -1
        });

        this.anims.create({
            key: 'kick',
            frames: [
                { key: 'kickAtlas', frame: 'image_76-removebg-preview.png' },
                { key: 'kickAtlas', frame: 'image_70-removebg-preview.png' },
                { key: 'kickAtlas', frame: 'image_71-removebg-preview.png' }
            ],
            frameRate: this.isMobile ? 12 : 15,
            repeat: 0
        });

        this.anims.create({
            key: 'punch',
            frames: [
                { key: 'punchAtlas', frame: 'image_85-removebg-preview.png' },
                { key: 'punchAtlas', frame: 'image_88-removebg-preview.png' },
                { key: 'punchAtlas', frame: 'image_87-removebg-preview.png' },
                { key: 'punchAtlas', frame: 'image_84-removebg-preview.png' },
                { key: 'punchAtlas', frame: 'image_86-removebg-preview.png' },
                { key: 'punchAtlas', frame: 'image_89-removebg-preview.png' }
            ],
            frameRate: this.isMobile ? 16 : 20,
            repeat: 0
        });

        this.anims.create({
            key: 'takeDamage',
            frames: [
                { key: 'damageAtlas', frame: 'image_40-removebg-preview.png' },
                { key: 'damageAtlas', frame: 'image_41-removebg-preview.png' }
            ],
            frameRate: this.isMobile ? 8 : 10,
            repeat: 0
        });

        this.anims.create({
            key: 'punchEffect',
            frames: [
                { key: 'punchEffectAtlas', frame: 'image_4(10).png' },
                { key: 'punchEffectAtlas', frame: 'image_5(6).png' },
                { key: 'punchEffectAtlas', frame: 'image_3(10).png' },
                { key: 'punchEffectAtlas', frame: 'image_2(13).png' },
                { key: 'punchEffectAtlas', frame: 'image_1(17).png' },
                { key: 'punchEffectAtlas', frame: 'image_0(17).png' }
            ],
            frameRate: this.isMobile ? 12 : 15,
            repeat: 0
        });

        this.setupFighters();
        this.player.on('animationcomplete', () => {
            this.playerFace.x = this.player.x;
            this.playerFace.y = this.player.y + (this.isMobile ? -100 : -220);
            this.playerFace.setFlipX(this.player.flipX);
        });

        this.cpu.on('animationcomplete', () => {
            this.cpuFace.x = this.cpu.x;
            this.cpuFace.y = this.cpu.y + (this.isMobile ? -100 : -220);
            this.cpuFace.setFlipX(this.cpu.flipX);
        });
        this.setupHealthBars();

        if (this.isMobile) {
            this.buttons = {};
            const buttonSize = 50;
            const buttonSpacing = 10;
            const buttonY = this.height - 40;

            this.buttons.left = this.add.image(40, buttonY, 'leftButton')
                .setDisplaySize(buttonSize, buttonSize)
                .setInteractive()
                .setDepth(10);

            this.buttons.right = this.add.image(40 + buttonSize + buttonSpacing, buttonY, 'rightButton')
                .setDisplaySize(buttonSize, buttonSize)
                .setInteractive()
                .setDepth(10);

            this.buttons.punch = this.add.image(this.width - 40 - 2 * (buttonSize + buttonSpacing), buttonY, 'punchButton')
                .setDisplaySize(buttonSize, buttonSize)
                .setInteractive()
                .setDepth(10);

            this.buttons.kick = this.add.image(this.width - 40 - (buttonSize + buttonSpacing), buttonY, 'kickButton')
                .setDisplaySize(buttonSize, buttonSize)
                .setInteractive()
                .setDepth(10);

            this.buttons.dodge = this.add.image(this.width - 40, buttonY, 'dodgeButton')
                .setDisplaySize(buttonSize, buttonSize)
                .setInteractive()
                .setDepth(10);

            this.buttons.left.on('pointerdown', () => this.buttons.left.isDown = true);
            this.buttons.left.on('pointerup', () => this.buttons.left.isDown = false);
            this.buttons.left.on('pointerout', () => this.buttons.left.isDown = false);

            this.buttons.right.on('pointerdown', () => this.buttons.right.isDown = true);
            this.buttons.right.on('pointerup', () => this.buttons.right.isDown = false);
            this.buttons.right.on('pointerout', () => this.buttons.right.isDown = false);

            this.buttons.punch.on('pointerdown', () => this.playerPunch());
            this.buttons.kick.on('pointerdown', () => this.playerKick());
            this.buttons.dodge.on('pointerdown', () => this.playerDodge());
        } else {
            this.keys = {
                left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
                right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
                dodge: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
                punch: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
                kick: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S)
            };
        }

        this.setupFighterProperties();
        this.setupFaceOffsets();

        this.physics.add.collider(this.player, this.platforms);
        this.physics.add.collider(this.cpu, this.platforms);
        this.physics.add.collider(this.player, this.cpu, this.handleFighterCollision, null, this);

        this.playerAttackCooldown = 0;
        this.playerDodgeCooldown = 0;
        this.cpuAttackCooldown = 0;
        this.cpuDodgeCooldown = 0;
        this.combatState = 'neutral';
        this.cpuDecisionTimer = 0;
        this.cpuIdleTimeout = 0;

        this.time.addEvent({
            delay: 500,
            callback: this.updateCpuAI,
            callbackScope: this,
            loop: true
        });
        this.input.keyboard.disableGlobalCapture();
    }

    setupFaceOffsets() {
        this.faceOffsets = {
            'walkRight': this.isMobile ? [
                {x: 0, y: -130}, {x: -20, y: -125}, {x: -20, y: -128}, {x: -20, y: -132}, {x: -20, y: -130}
            ] : [
                {x: 0, y: -230}, {x: -30, y: -225}, {x: -30, y: -228}, {x: -30, y: -232}, {x: -30, y: -230}
            ],
            'kick': this.isMobile ? [
                {x: 100, y: -125}, {x: -60, y: -100}, {x: -60, y: -80}
            ] : [
                {x: 200, y: -225}, {x: -100, y: -200}, {x: -100, y: -120}
            ],
            'punch': this.isMobile ? [
                {x: 0, y: -125}, {x: 15, y: -130}, {x: 20, y: -125}, {x: 10, y: -128}, {x: 5, y: -125}, {x: 0, y: -125}
            ] : [
                {x: 0, y: -225}, {x: 25, y: -230}, {x: 35, y: -225}, {x: 20, y: -228}, {x: 10, y: -225}, {x: 0, y: -225}
            ],
            'takeDamage': this.isMobile ? [
                {x: -20, y: -110}, {x: -60, y: -100}
            ] : [
                {x: -40, y: -210}, {x: -100, y: -200}
            ],
            'dodge': this.isMobile ? {x: -30, y: -100} : {x: -50, y: -200},
            'idle': this.isMobile ? {x: 0, y: -130} : {x: 0, y: -250}
        };
    }

    updateFacePosition(fighter, face) {
        const timeScale = this.time.timeScale || 1;

        if (fighter.isDodging) {
            let offsetX = this.faceOffsets['dodge'].x;
            let offsetY = this.faceOffsets['dodge'].y;
            
            if (fighter.flipX) {
                offsetX = -offsetX;
            }
            
            face.x = fighter.x + offsetX;
            face.y = fighter.y + offsetY;
            face.setFlipX(fighter.flipX);
            return;
        }

        if (! fighter.anims.isPlaying || !fighter.anims.currentAnim) {
            if (fighter === this.player) {
                face.x = fighter.x;
                face.y = fighter.y + (this.isMobile ? -100 : -220);
            } else {
                face.x = fighter.x;
                face.y = fighter.y + (this.isMobile ? -100 : -220);
            }
            face.setFlipX(fighter.flipX);
            return;
        }
        
        let offsetX = 0;
        let offsetY = this.isMobile ? -100 : -200;

        const animKey = fighter.anims.currentAnim.key;
        let frameIndex = 0;

        if (fighter.anims.currentFrame) {
            frameIndex = fighter.anims.currentFrame.index - 1;
        }

        if (this.faceOffsets[animKey] && Array.isArray(this.faceOffsets[animKey])) {
            const maxIndex = this.faceOffsets[animKey].length - 1;
            frameIndex = Math.min(Math.max(frameIndex, 0), maxIndex);
            
            const frameOffset = this.faceOffsets[animKey][frameIndex];
            if (frameOffset) {
                offsetX = frameOffset.x;
                offsetY = frameOffset.y;
            } else {
                console.warn(`Frame offset undefined for ${animKey} at index ${frameIndex}`);
                offsetX = this.faceOffsets[animKey][0]?.x || 0;
                offsetY = this.faceOffsets[animKey][0]?.y || (this.isMobile ? -100 : -200);
            }
        } else if (this.faceOffsets[animKey]) {
            offsetX = this.faceOffsets[animKey].x;
            offsetY = this.faceOffsets[animKey].y;
        } else {
            console.warn(`No face offsets defined for animation: ${animKey}`);
        }

        if (fighter.flipX) {
            offsetX = -offsetX;
        }

        face.x = fighter.x + offsetX;
        face.y = fighter.y + offsetY;
        face.setFlipX(fighter.flipX);
    }

    handleFighterCollision(player, cpu) {
        const pushForce = 60;
        
        if (player.x < cpu.x) {
            player.x -= pushForce * 0.5;
            cpu.x += pushForce * 0.5;
        } else {
            player.x += pushForce * 0.5;
            cpu.x -= pushForce * 0.5;
        }
        
        player.x = Phaser.Math.Clamp(player.x, 50, this.width - 50);
        cpu.x = Phaser.Math.Clamp(cpu.x, 50, this.width - 50);
        
        player.setVelocityX(0);
        cpu.setVelocityX(0);
    }

    setupFighters() {
        const cpuCharacter = this.playerCharacter === 'fighter1' ? 'fighter2' : 'fighter1';

        this.player = this.physics.add.sprite(this.width * (this.isMobile ? 0.25 : 0.3), this.height - (this.isMobile ? 100 : 200), 'fighterAtlas', 'image_102-removebg-preview.png')
            .setDepth(5);
        this.cpu = this.physics.add.sprite(this.width * (this.isMobile ? 0.75 : 0.7), this.height - (this.isMobile ? 100 : 200), 'fighterAtlas', 'image_102-removebg-preview.png')
            .setDepth(5);

        this.player.setCollideWorldBounds(true)
            .setBounce(0.2)
            .setScale(this.isMobile ? 2.5 : 5);

        this.cpu.setCollideWorldBounds(true)
            .setBounce(0.2)
            .setScale(this.isMobile ? 2.5 : 5)
            .setFlipX(true);

        this.player.body.setSize(this.isMobile ? 25 : 40, this.isMobile ? 65 : 100);
        this.cpu.body.setSize(this.isMobile ? 25 : 40, this.isMobile ? 65 : 100);

        this.playerInitialFaceX = this.player.x;
        this.playerInitialFaceY = this.player.y + (this.isMobile ? -100 : -220);
        
        this.cpuInitialFaceX = this.cpu.x;
        this.cpuInitialFaceY = this.cpu.y + (this.isMobile ? -100 : -220);
        this.playerFace = this.add.image(this.playerInitialFaceX, this.playerInitialFaceY, this.playerCharacter === 'fighter1' ? 'player' : 'enemy')
            .setScale(this.isMobile ? 0.25 : 0.5)
            .setDepth(6);
        this.playerFace.setOrigin(0.5, 0.5);

        this.cpuFace = this.add.image(this.cpuInitialFaceX, this.cpuInitialFaceY, cpuCharacter === 'fighter1' ? 'player' : 'enemy')
            .setScale(this.isMobile ? 0.25 : 0.5)
            .setDepth(6);
        this.cpuFace.setOrigin(0.5, 0.5);

        this.player.isAttacking = false;
        this.player.isDodging = false;
        this.player.isTakingDamage = false;
        this.player.health = 300;
        this.player.originalTexture = this.player.texture.key;
        this.player.originalFrame = this.player.frame.name;
        this.player.idleFrame = this.playerCharacter === 'fighter1' ? 'image_102-removebg-preview.png' : 'image_102-removebg-preview.png';

        this.cpu.isAttacking = false;
        this.cpu.isDodging = false;
        this.cpu.isTakingDamage = false;
        this.cpu.health = 300;
        this.cpu.originalTexture = this.cpu.texture.key;
        this.cpu.originalFrame = this.cpu.frame.name;
        this.cpu.idleFrame = cpuCharacter === 'fighter1' ? 'image_102-removebg-preview.png' : 'image_102-removebg-preview.png';

        this.player.energy = 0;
        this.player.lastHitTime = 0;
        this.player.canDeathBlow = false;

        this.cpu.energy = 0;
        this.cpu.lastHitTime = 0;
        this.cpu.canDeathBlow = false;
    }

    setupFighterProperties() {
        this.vfx = new VFXLibrary(this);
        this.vfx.addCircleTexture('impactCircle', 0xff0000, 0.8, 20);
        this.vfxDepth = 4;
        if (this.playerCharacter === 'fighter1') {
            this.player.attackPower = 15;
            this.player.speed = 160;
            this.player.dodgeTime = 500;
            this.cpu.attackPower = 25;
            this.cpu.speed = 200;
            this.cpu.dodgeTime = 400;
        } else {
            this.player.attackPower = 10;
            this.player.speed = 200;
            this.player.dodgeTime = 400;
            this.cpu.attackPower = 15;
            this.cpu.speed = 160;
            this.cpu.dodgeTime = 500;
        }
    }

    setupHealthBars() {
        this.add.rectangle(this.isMobile ? 80 : 150, this.isMobile ? 20 : 30, this.isMobile ? 160 : 210, this.isMobile ? 24 : 30, 0x000000).setOrigin(0, 0.5).setDepth(8);
        this.playerHealthBar = this.add.rectangle(this.isMobile ? 82 : 155, this.isMobile ? 20 : 30, this.isMobile ? 150 : 200, this.isMobile ? 18 : 20, 0x00ff00).setOrigin(0, 0.5).setDepth(9);
        this.add.rectangle(this.width - (this.isMobile ? 240 : 360), this.isMobile ? 20 : 30, this.isMobile ? 160 : 210, this.isMobile ? 24 : 30, 0x000000).setOrigin(0, 0.5).setDepth(8);
        this.cpuHealthBar = this.add.rectangle(this.width - (this.isMobile ? 238 : 355), this.isMobile ? 20 : 30, this.isMobile ? 150 : 200, this.isMobile ? 18 : 20, 0x00ff00).setOrigin(0, 0.5).setDepth(9);
        
        this.add.rectangle(this.isMobile ? 80 : 150, this.isMobile ? 50 : 90, this.isMobile ? 160 : 210, this.isMobile ? 24 : 30, 0x000000).setOrigin(0, 0.5).setDepth(8);
        this.playerEnergyBar = this.add.rectangle(this.isMobile ? 82 : 155, this.isMobile ? 50 : 90, this.isMobile ? 150 : 200, this.isMobile ? 18 : 20, 0x0000ff).setOrigin(0, 0.5).setDepth(9);
        
        this.add.rectangle(this.width - (this.isMobile ? 240 : 360), this.isMobile ? 50 : 90, this.isMobile ? 160 : 210, this.isMobile ? 24 : 30, 0x000000).setOrigin(0, 0.5).setDepth(8);
        this.cpuEnergyBar = this.add.rectangle(this.width - (this.isMobile ? 238 : 355), this.isMobile ? 50 : 90, this.isMobile ? 150 : 200, this.isMobile ? 18 : 20, 0x0000ff).setOrigin(0, 0.5).setDepth(9);

        const playerName = this.playerCharacter === 'fighter1' ? 'NINJA' : 'HOVER';
        const cpuName = this.playerCharacter === 'fighter1' ? 'HOVER' : 'NINJA';

        this.add.text(this.isMobile ? 82 : 155, this.isMobile ? 40 : 60, playerName, {
            fontFamily: 'Arial',
            fontSize: this.isMobile ? 16 : 20,
            color: '#ffffff'
        }).setOrigin(0, 0.5).setDepth(10);

        this.add.text(this.width - (this.isMobile ? 238 : 355), this.isMobile ? 40 : 60, cpuName, {
            fontFamily: 'Arial',
            fontSize: this.isMobile ? 16 : 20,
            color: '#ffffff'
        }).setOrigin(0, 0.5).setDepth(10);
    }

    update(time, delta) {
        if (this.isGameOver) return;

        if (this.playerAttackCooldown > 0) {
            this.playerAttackCooldown -= delta;
        }
        if (this.playerDodgeCooldown > 0) {
            this.playerDodgeCooldown -= delta;
        }
        if (this.cpuAttackCooldown > 0) {
            this.cpuAttackCooldown -= delta;
        }
        if (this.cpuDodgeCooldown > 0) {
            this.cpuDodgeCooldown -= delta;
        }

        if (this.player.isDodging && time > this.playerDodgeEndTime) {
            this.player.isDodging = false;
            this.player.clearTint();
            this.player.setTexture(this.player.originalTexture, this.player.originalFrame);
        }
        if (this.cpu.isDodging && time > this.cpuDodgeEndTime) {
            this.cpu.isDodging = false;
            this.cpu.clearTint();
            this.cpu.setTexture(this.cpu.originalTexture, this.cpu.originalFrame);
        }

        this.handlePlayerInput();
        this.handleCpuIdle();
        this.updateFighterFacing();

        const currentTime = time;
        const decayInterval = 2000;
        const decayAmount = 5;

        if (currentTime - this.player.lastHitTime > decayInterval && this.player.energy > 0) {
            this.player.energy = Math.max(0, this.player.energy - decayAmount);
            this.updatePlayerEnergyBar();
        }
        if (currentTime - this.cpu.lastHitTime > decayInterval && this.cpu.energy > 0) {
            this.cpu.energy = Math.max(0, this.cpu.energy - decayAmount);
            this.updateCpuEnergyBar();
        }

        if (this.player.energy >= 100) {
            this.player.canDeathBlow = true;
        }
        if (this.cpu.energy >= 100) {
            this.cpu.canDeathBlow = true;
        }

        if (this.cpuDecisionTimer > 0) {
            this.cpuDecisionTimer -= delta;
        }

        if (this.cpuIdleTimeout > 0) {
            this.cpuIdleTimeout -= delta;
        }

        if (!this.player.isTakingDamage || this.time.timeScale === 1) {
            this.updateFacePosition(this.player, this.playerFace);
        }
        if (!this.cpu.isTakingDamage || this.time.timeScale === 1) {
            this.updateFacePosition(this.cpu, this.cpuFace);
        }
    }

    updateFighterFacing() {
        if (this.player.x < this.cpu.x) {
            this.player.setFlipX(false);
            this.cpu.setFlipX(true);
            this.playerFacingRight = true;
            this.cpuFacingLeft = true;
        } else {
            this.player.setFlipX(true);
            this.cpu.setFlipX(false);
            this.playerFacingRight = false;
            this.cpuFacingLeft = false;
        }
    }

    handlePlayerInput() {
        const leftInput = this.isMobile ? this.buttons.left?.isDown : this.keys.left.isDown;
        const rightInput = this.isMobile ? this.buttons.right?.isDown : this.keys.right.isDown;

        if (!leftInput && !rightInput && !this.player.isDodging && !this.player.isAttacking && !this.player.isTakingDamage) {
            this.player.setVelocityX(0);
            this.player.anims.stop();
            this.player.setTexture('fighterAtlas', this.player.idleFrame);
        }

        if (leftInput && !this.player.isAttacking && !this.player.isDodging && !this.player.isTakingDamage) {
            this.playerMoveLeft();
        } else if (rightInput && !this.player.isAttacking && !this.player.isDodging && !this.player.isTakingDamage) {
            this.playerMoveRight();
        }

        if (!this.isMobile && Phaser.Input.Keyboard.JustDown(this.keys.punch)) {
            this.playerPunch();
        } else if (!this.isMobile && Phaser.Input.Keyboard.JustDown(this.keys.kick)) {
            this.playerKick();
        } else if (!this.isMobile && Phaser.Input.Keyboard.JustDown(this.keys.dodge)) {
            this.playerDodge();
        }
    }

    handleCpuIdle() {
        if (Math.abs(this.cpu.body.velocity.x) < 1 && !this.cpu.isDodging && !this.cpu.isAttacking && !this.cpu.isTakingDamage) {
            this.cpu.setVelocityX(0);
            this.cpu.anims.stop();
            this.cpu.setTexture('fighterAtlas', this.cpu.idleFrame);
        }
    }

    playerMoveLeft() {
        this.player.setVelocityX(-this.player.speed);
        this.player.anims.play('walkRight', true);
    }

    playerMoveRight() {
        this.player.setVelocityX(this.player.speed);
        this.player.anims.play('walkRight', true);
    }

    playerPunch() {
        if (this.player.isAttacking || this.player.isDodging || this.playerAttackCooldown > 0 || this.player.isTakingDamage) return;
        this.player.isAttacking = true;
        this.playerAttackCooldown = 400;
        this.playerAttackType = 'punch';
        this.player.anims.play('punch', true);
        if (this.canHit(this.player, this.cpu)) {
            this.hitOpponent(this.cpu, this.player.attackPower);
        }
        this.time.delayedCall(400, () => {
            this.player.isAttacking = false;
            this.player.anims.stop();
            this.player.setTexture(this.player.originalTexture, this.player.originalFrame);
            this.playerAttackType = null;
        });
    }

    playerKick() {
        if (this.player.isAttacking || this.player.isDodging || this.playerAttackCooldown > 0 || this.player.isTakingDamage) return;
        this.player.isAttacking = true;
        this.playerAttackCooldown = 600;
        this.playerAttackType = 'kick';
        this.player.anims.play('kick', true);
        if (this.canHit(this.player, this.cpu)) {
            this.hitOpponent(this.cpu, this.player.attackPower * 1.5);
        }
        this.time.delayedCall(200, () => {
            this.player.isAttacking = false;
            this.player.anims.stop();
            this.player.setTexture(this.player.originalTexture, this.player.originalFrame);
            this.playerAttackType = null;
        });
    }

    playerDodge() {
        if (this.player.isAttacking || this.player.isDodging || this.playerDodgeCooldown > 0 || this.player.isTakingDamage) return;
        this.player.isDodging = true;
        this.playerDodgeCooldown = 800;
        this.playerDodgeEndTime = this.time.now + this.player.dodgeTime;
        this.player.setVelocityX(0);
        this.player.anims.stop();
        this.player.setTexture('simpleDodgeSprite');
    }

    updateCpuAI() {
        if (this.isGameOver || this.cpu.isDodging || this.cpu.isAttacking || this.cpuDecisionTimer > 0 || this.cpu.isTakingDamage) return;

        const distanceToPlayer = Phaser.Math.Distance.Between(this.cpu.x, this.cpu.y, this.player.x, this.player.y);
        const rand = Phaser.Math.Between(1, 100);

        this.cpuDecisionTimer = 300;

        if (distanceToPlayer < 200) {
            this.combatState = 'attacking';
        } else if (distanceToPlayer < 300) {
            this.combatState = 'approaching';
        } else {
            this.combatState = 'neutral';
        }

        if (this.player.isAttacking && this.cpuDodgeCooldown <= 0) {
            if (rand <= 40) {
                this.cpuDodge();
                return;
            } else if (rand <= 90 && distanceToPlayer < 300) {
                if (rand <= 70) {
                    this.cpuPunch();
                } else {
                    this.cpuKick();
                }
                return;
            } else {
                if (this.cpu.x < this.player.x) {
                    this.cpuMoveLeft();
                } else {
                    this.cpuMoveRight();
                }
                return;
            }
        }

        switch (this.combatState) {
            case 'attacking':
                if (rand <= 80 && this.cpuAttackCooldown <= 0) {
                    this.cpuPunch();
                } else if (rand <= 60 && this.cpuAttackCooldown <= 0) {
                    this.cpuKick();
                } else if (rand <= 50) {
                    if (this.cpu.x < this.player.x) {
                        this.cpuMoveLeft();
                    } else {
                        this.cpuMoveRight();
                    }
                } else {
                    this.sounds.walking.stop();
                    this.cpu.setVelocityX(0);
                    this.cpuIdleTimeout = 200;
                }
                break;

            case 'approaching':
                if (rand <= 90) {
                    if (this.cpu.x < this.player.x) {
                        this.sounds.walking.setVolume(1).play();
                        this.cpuMoveRight();
                        
                        this.sounds.walking.stop();
                    } else {
                        this.sounds.walking.setVolume(1).play();
                        this.cpuMoveLeft();
                        this.sounds.walking.stop();
                        
                    }
                } else if (rand <= 70) {
                    this.sounds.walking.stop();
                    this.cpu.setVelocityX(0);
                    this.cpuIdleTimeout = 300;
                } else {
                    this.cpuDodge();
                }
                break;

            case 'neutral':
                if (this.player.health < this.cpu.health && rand <= 70) {
                    if (this.cpu.x < this.player.x) {
                        this.sounds.walking.setVolume(1).play();
                        this.cpuMoveRight();
                        this.sounds.walking.stop();
                    } else {
                        this.sounds.walking.setVolume(1).play();
                        this.cpuMoveLeft();
                        this.sounds.walking.stop();
                    }
                } else if (rand <= 70) {
                    if (this.cpu.x < this.player.x) {
                        this.sounds.walking.setVolume(1).play();
                        this.cpuMoveRight();
                        this.sounds.walking.stop();
                    } else {
                        this.sounds.walking.setVolume(1).play();
                        this.cpuMoveLeft();
                        this.sounds.walking.stop();
                    }
                } else {
                    this.sounds.walking.stop();
                    this.cpu.setVelocityX(0);
                    this.cpuIdleTimeout = 800;
                }
                break;
        }
    }

    cpuMoveLeft() {
        if (this.cpuIdleTimeout > 0) return;
        this.cpu.setVelocityX(-this.cpu.speed);
        this.cpu.anims.play('walkRight', true);
        
    }

    cpuMoveRight() {
        if (this.cpuIdleTimeout > 0) return;
        this.cpu.setVelocityX(this.cpu.speed);
        this.cpu.anims.play('walkRight', true);
    }

    cpuPunch() {
        if (this.cpu.isAttacking || this.cpu.isDodging || this.cpuAttackCooldown > 0 || this.cpu.isTakingDamage) return;
        this.cpu.isAttacking = true;
        this.cpuAttackCooldown = 400;
        this.cpuAttackType = 'punch';
        this.cpu.anims.play('punch', true);
        if (this.canHit(this.cpu, this.player)) {
            this.hitOpponent(this.player, this.cpu.attackPower);
        }
        this.time.delayedCall(200, () => {
            this.cpu.isAttacking = false;
            this.cpu.anims.stop();
            this.cpu.setTexture(this.cpu.originalTexture, this.cpu.originalFrame);
            this.cpuAttackType = null;
        });
    }

    cpuKick() {
        if (this.cpu.isAttacking || this.cpu.isDodging || this.cpuAttackCooldown > 0 || this.cpu.isTakingDamage) return;
        this.cpu.isAttacking = true;
        this.cpuAttackCooldown = 600;
        this.cpuAttackType = 'kick';
        this.cpu.anims.play('kick', true);
        if (this.canHit(this.cpu, this.player)) {
            this.hitOpponent(this.player, this.cpu.attackPower * 1.5);
        }
        this.time.delayedCall(300, () => {
            this.cpu.isAttacking = false;
            this.cpu.anims.stop();
            this.cpu.setTexture(this.cpu.originalTexture, this.cpu.originalFrame);
            this.cpuAttackType = null;
        });
    }

    cpuDodge() {
        if (this.cpu.isAttacking || this.cpu.isDodging || this.cpuDodgeCooldown > 0 || this.cpu.isTakingDamage) return;
        this.cpu.isDodging = true;
        this.cpuDodgeCooldown = 800;
        this.cpuDodgeEndTime = this.time.now + this.cpu.dodgeTime;
        this.cpu.setVelocityX(0);
        this.cpu.anims.stop();
        this.cpu.setTexture('simpleDodgeSprite');
    }

    canHit(attacker, target) {
        const distance = Phaser.Math.Distance.Between(attacker.x, attacker.y, target.x, target.y);
        let facingCorrectly = false;
        if (attacker === this.player && this.playerFacingRight && attacker.x < target.x) {
            facingCorrectly = true;
        } else if (attacker === this.player && !this.playerFacingRight && attacker.x > target.x) {
            facingCorrectly = true;
        } else if (attacker === this.cpu && this.cpuFacingLeft && attacker.x > target.x) {
            facingCorrectly = true;
        } else if (attacker === this.cpu && !this.cpuFacingLeft && attacker.x < target.x) {
            facingCorrectly = true;
        }

        let attackRange = 250;
        if (attacker.attackType === 'kick') {
            attackRange = 280;
        } else if (attacker.attackType === 'punch') {
            attackRange = 270;
        }

        return distance < attackRange && facingCorrectly && !target.isDodging;
    }

    hitOpponent(target, damage) {
        this.sounds.damage.setVolume(1.5).play();
        const attacker = (target === this.player) ? this.cpu : this.player;
        const attackType = attacker === this.player ? this.playerAttackType : this.cpuAttackType;

        attacker.energy = Math.min(100, attacker.energy + 20);
        attacker.lastHitTime = this.time.now;
        if (attacker === this.player) {
            this.updatePlayerEnergyBar();
        } else {
            this.updateCpuEnergyBar();
        }

        let finalDamage = target.isDodging ? damage * 0.25 : damage;
        let isDeathBlow = false;
        if (attackType === 'punch' && attacker.canDeathBlow) {
            finalDamage = 50;
            isDeathBlow = true;
            attacker.canDeathBlow = false;
            attacker.energy = 0;
            if (attacker === this.player) {
                this.updatePlayerEnergyBar();
            } else {
                this.updateCpuEnergyBar();
            }

            this.time.timeScale = 0.2;
            attacker.anims.timeScale = 0.2;
            target.anims.timeScale = 0.2;
            
            this.cameras.main.zoomTo(this.isMobile ? 1.5 : 2, 300);
            this.cameras.main.pan(attacker.x + (attacker.flipX ? -50 : 50), target.y - 150, 300);
            
            const flash = this.add.rectangle(0, 0, this.game.config.width * 2, this.game.config.height * 2, 0xffffff)
                .setOrigin(0)
                .setDepth(100)
                .setAlpha(0.8);
            
            this.tweens.add({
                targets: flash,
                alpha: 0,
                duration: 300,
                ease: 'Power2',
                onComplete: () => flash.destroy()
            });
            
            const redOverlay = this.add.rectangle(0, 0, this.game.config.width * 2, this.game.config.height * 2, 0xff0000)
                .setOrigin(0)
                .setDepth(99)
                .setAlpha(0.3);
            
            const shockwave = this.add.circle(target.x, target.y - 150, 10, 0xffffff, 0.8)
                .setDepth(5);
            
            this.tweens.add({
                targets: shockwave,
                radius: this.isMobile ? 100 : 200,
                alpha: 0,
                duration: 1000,
                ease: 'Cubic.Out',
                onComplete: () => shockwave.destroy()
            });
            
            this.time.delayedCall(600, () => {
                this.cameras.main.zoomTo(this.isMobile ? 1.2 : 1.5, 1000);
                this.cameras.main.pan((attacker.x + target.x) / 2, (attacker.y + target.y) / 2 - 100, 1000);
                
                try {
                    const particles = this.add.particles('particle');
                    const emitter = particles.createEmitter({
                        x: target.x,
                        y: target.y - 150,
                        speed: { min: 100, max: 200 },
                        angle: { min: 0, max: 360 },
                        scale: { start: 0.5, end: 0 },
                        blendMode: 'ADD',
                        lifespan: 2000,
                        gravityY: 300
                    });
                    emitter.explode(this.isMobile ? 15 : 30);
                    this.time.delayedCall(2000, () => {
                        particles.destroy();
                    });
                } catch (e) {
                    console.log("Particle effects unavailable:", e);
                }
            });
            
            try {
                const hitSound = this.sound.add('heavyImpact');
                hitSound.setRate(0.5);
                hitSound.play();
            } catch (e) {
                try {
                    const regularHit = this.sound.add('hit');
                    regularHit.setRate(0.5);
                    regularHit.play();
                } catch (err) {
                    console.log("Sound effects unavailable:", err);
                }
            }
            
            const attackerFace = (attacker === this.player) ? this.playerFace : this.cpuFace;
            const targetFace = (target === this.player) ? this.playerFace : this.cpuFace;
            const updateFacesDuringSlowMo = () => {
                if (this.time.timeScale !== 1) {
                    this.updateFacePosition(attacker, attackerFace);
                    this.updateFacePosition(target, targetFace);
                    this.time.delayedCall(16 / this.time.timeScale, updateFacesDuringSlowMo);
                }
            };
            updateFacesDuringSlowMo();
            
            this.time.delayedCall(1000, () => {
                this.time.timeScale = 1;
                attacker.anims.timeScale = 1;
                target.anims.timeScale = 1;
                this.cameras.main.zoomTo(1, 500);
                this.cameras.main.pan(this.width / 2, this.height / 2, 500);
                redOverlay.destroy();
            });
        }

        target.health -= finalDamage;
        if (target.health < 0) target.health = 0;

        if (target === this.player) {
            this.player.isTakingDamage = true;
            this.player.anims.play('takeDamage', true);
            this.time.delayedCall(200 / (isDeathBlow ? 0.2 : 1), () => {
                this.player.isTakingDamage = false;
                this.player.anims.stop();
                this.player.setTexture(this.player.originalTexture, this.player.originalFrame);
                this.player.setAlpha(1);
                this.player.clearMask();
            });
            this.updatePlayerHealthBar();
            const knockbackForce = isDeathBlow ? 200 : 100;
            if (this.player.x < this.cpu.x) {
                this.player.x -= knockbackForce;
            } else {
                this.player.x += knockbackForce;
            }

            if (attackType === 'punch') {
                this.vfx.shakeCamera(isDeathBlow ? 500 : 300, isDeathBlow ? 0.01 : 0.005);
                const punchEffect = this.add.sprite(this.player.x, this.player.y + (this.isMobile ? -100 : -220), 'punchEffectAtlas', 'image_4(10).png')
                    .setDepth(6)
                    .setScale(this.isMobile ? 0.5 : 1)
                    .play('punchEffect');
                this.time.delayedCall(400 / (isDeathBlow ? 0.2 : 1), () => {
                    punchEffect.destroy();
                });
            } else if (attackType === 'kick') {
                this.vfx.shakeCamera(500, 0.01);
                const punchEffect = this.add.sprite(this.player.x, this.player.y + (this.isMobile ? -100 : -220), 'punchEffectAtlas', 'image_4(10).png')
                    .setDepth(6)
                    .setScale(this.isMobile ? 0.5 : 1)
                    .play('punchEffect');
                this.time.delayedCall(400 / (isDeathBlow ? 0.2 : 1), () => {
                    punchEffect.destroy();
                });
                this.vfx.shakeGameObject(this.player, 150, 15);
            }

        } else {
            this.cpu.isTakingDamage = true;
            this.cpu.anims.play('takeDamage', true);
            this.time.delayedCall(200 / (isDeathBlow ? 0.2 : 1), () => {
                this.cpu.isTakingDamage = false;
                this.cpu.anims.stop();
                this.cpu.setTexture(this.cpu.originalTexture, this.cpu.originalFrame);
                this.cpu.setAlpha(1);
                this.cpu.clearMask();
            });
            this.updateCpuHealthBar();
            const knockbackForce = isDeathBlow ? 200 : 100;
            if (this.cpu.x < this.player.x) {
                this.cpu.x -= knockbackForce;
            } else {
                this.cpu.x += knockbackForce;
            }

            if (attackType === 'punch') {
                this.vfx.shakeCamera(isDeathBlow ? 500 : 300, isDeathBlow ? 0.01 : 0.005);
                const punchEffect = this.add.sprite(this.cpu.x, this.cpu.y + (this.isMobile ? -100 : -220), 'punchEffectAtlas', 'image_4(10).png')
                    .setDepth(6)
                    .setScale(this.isMobile ? 0.5 : 1)
                    .play('punchEffect');
                this.time.delayedCall(400 / (isDeathBlow ? 0.2 : 1), () => {
                    punchEffect.destroy();
                });
            } else if (attackType === 'kick') {
                this.vfx.shakeCamera(500, 0.01);
                const punchEffect = this.add.sprite(this.cpu.x, this.cpu.y + (this.isMobile ? -100 : -220), 'punchEffectAtlas', 'image_4(10).png')
                    .setDepth(6)
                    .setScale(this.isMobile ? 0.5 : 1)
                    .play('punchEffect');
                this.time.delayedCall(400 / (isDeathBlow ? 0.2 : 1), () => {
                    punchEffect.destroy();
                });
                this.vfx.shakeGameObject(this.cpu, 150, 15);
            }
        }

        if (isDeathBlow) {
            const flashTarget = () => {
                target.setTint(0xff0000);
                this.time.delayedCall(100, () => {
                    target.clearTint();
                    this.time.delayedCall(100, () => {
                        target.setTint(0xff0000);
                        this.time.delayedCall(100, () => {
                            target.clearTint();
                        });
                    });
                });
            };
            flashTarget();
        }

        this.player.x = Phaser.Math.Clamp(this.player.x, 50, this.width - 50);
        this.cpu.x = Phaser.Math.Clamp(this.cpu.x, 50, this.width - 50);

        if (target.health <= 0) {
            if (isDeathBlow) {
                this.time.delayedCall(1500, () => {
                    this.fighterDefeated(target);
                });
            } else {
                this.fighterDefeated(target);
            }
        }
    }

    updatePlayerHealthBar() {
        const width = (this.player.health / 300) * (this.isMobile ? 150 : 200);
        this.playerHealthBar.width = Math.max(0, width);
        if (this.player.health < 90) {
            this.playerHealthBar.fillColor = 0xff0000;
        } else if (this.player.health < 180) {
            this.playerHealthBar.fillColor = 0xffff00;
        }
    }

    updateCpuHealthBar() {
        const width = (this.cpu.health / 300) * (this.isMobile ? 150 : 200);
        this.cpuHealthBar.width = Math.max(0, width);
        if (this.cpu.health < 90) {
            this.cpuHealthBar.fillColor = 0xff0000;
        } else if (this.cpu.health < 180) {
            this.cpuHealthBar.fillColor = 0xffff00;
        }
    }

    updatePlayerEnergyBar() {
        const width = (this.player.energy / 100) * (this.isMobile ? 150 : 200);
        this.playerEnergyBar.width = Math.max(0, width);
    }

    updateCpuEnergyBar() {
        const width = (this.cpu.energy / 100) * (this.isMobile ? 150 : 200);
        this.cpuEnergyBar.width = Math.max(0, width);
    }

    fighterDefeated(fighter) {
        if (fighter === this.cpu) {
            this.updateScore(100);
            this.showResultMessage("YOU WIN!");
        } else {
            this.showResultMessage("YOU LOSE!");
        }
        this.time.delayedCall(2000, () => {
            this.gameOver();
        });
    }

    showResultMessage(message) {
        this.add.text(this.width / 2, this.height / 2, message, {
            fontFamily: 'Arial',
            fontSize: this.isMobile ? 48 : 64,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: this.isMobile ? 6 : 8
        }).setOrigin(0.5).setDepth(10);
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(`${this.score}`);
    }

    gameOver() {
        this.isGameOver = true;
        initiateGameOver.bind(this)({ score: this.score });
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



// Game config
const config = {
    type: Phaser.AUTO,
    width: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width,
    height: _CONFIG.orientationSizes[_CONFIG.deviceOrientation].height,
    scene: [CharacterSelectScene, GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    pixelArt: true,
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 400 },
            debug: false,
        },
    },
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions,
    },
    orientation: _CONFIG.deviceOrientation === "portrait"
};

