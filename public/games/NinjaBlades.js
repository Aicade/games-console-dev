
// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.score = 0;
        this.cursors = null;
        this.playerSpeed = 300;
        this.jumpSpeed = 600;
        this.isJumping = false;
        this.playerState = 'idle';
        this.gameScene = 1;
        this.loadNextScene = false;
        this.gameStarted = false;
        this.gameOverC = false;
        this.levelOver = false;
        this.gameScore = 0;
        this.levelOverText = null;
        this.nextLevelButton = null;
        this.enemyKilledScore = 0;
        this.gameOverText = null;
        this.loseSoundPlayed = false;
        this.aimLine = null;
        this.isAiming = false;
        this.shootOnRelease = true;
        this.currentWeapon = 'ninja';
        this.aimStartTime = null;


        this.playerBulletBounces = 8;
        this.playerBullets = 5;
        this.playerBulletsRemaining = 5;
        this.bombs = 3;                      // Bomb total (new)
        this.bombsRemaining = 3;

        this.playerBullets = [];
        this.bulletsRemainingImages = [];
        this.bombsRemainingImages = [];
        this.enemies = [];
        this.bridges = [];
    }

    preload() {
        for (const key in _CONFIG.imageLoader) {

            this.load.image(key, _CONFIG.imageLoader[key]);

        }

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        addEventListenersPhaser.bind(this)();

        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
        this.load.image('cave_ground', `https://aicade-ui-assets.s3.amazonaws.com/GameAssets/textures/Bricks/s2+Brick+01+Grey.png`);
        this.load.image('bridge_mid', `https://aicade-ui-assets.s3.amazonaws.com/GameAssets/textures/Wall/s2+greenish+tile+horizontal.png`);
        this.load.image('bridge_mid_v', `https://aicade-ui-assets.s3.amazonaws.com/GameAssets/textures/Wall/s2+greenish+tile+vertical.png`);
        this.load.image('next_level', `https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/arrow.png`)
        this.load.image('bomb', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/assets/images/Bomb_FNPIB.png?t=1743096817209');
        this.load.image('hand', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/KgUw0B1xxrz13Vl2/assets/images/newAsset_14.png?t=1743944513822');
        this.load.image('gun', 'https://aicade-ui-assets.s3.amazonaws.com/0306251268/games/5GVig3hxQHZ44k3Z/assets/image_2_player.webp'); // Replace with your gun asset
        this.load.image('rpg', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/assets/images/Bomb_FNPIB.png?t=1743096817209'); // Replace with your RPG asset
        this.load.image('gunButton', 'https://aicade-ui-assets.s3.amazonaws.com/0306251268/games/5GVig3hxQHZ44k3Z/assets/image_2_player.webp'); // Replace with your asset path
        this.load.image('rpgButton', 'https://aicade-user-store.s3.amazonaws.com/0306251268/games/ZVCvos4iEH44XG5X/assets/images/Bomb_FNPIB.png?t=1743096817209'); // Replace with your asset path

        // this.load.image('player', 'https://files.catbox.moe/jyvtdc.png');
        // "shoot": "https://files.catbox.moe/b87m5h.mp3",

        

        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/"
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');
    }

    shootPlayerBullet(pointer, bulletBounces, offset = 0, weaponType = 'ninja') {
        // this.sounds.shoot.setVolume(1).setLoop(false).play();
    
        if (this.gameOverC) return;
        if (weaponType === 'ninja' && this.playerBulletsRemaining <= 0) return;
        if (weaponType === 'bomb' && this.bombsRemaining <= 0) return;
    
        if (weaponType === 'ninja') {
            this.playerBulletsRemaining -= 1;
            this.displayBulletsRemaining();
        } else if (weaponType === 'bomb') {
            this.bombsRemaining -= 1;
            this.displayBombsRemaining();
        }
    
        const weaponConfig = {
            'ninja': { sprite: 'projectile', scale: 0.25, speed: 2000, bounces: 8, rotation: true },
            'bomb': { sprite: 'bomb', scale: 0.5, speed: 1000, bounces: 2, rotation: false }
        };
    
        const config = weaponConfig[weaponType];
        var projectile = this.physics.add.sprite(this.player.x, this.player.y, config.sprite);
        projectile.setScale(config.scale);
        projectile.setDepth(1);
        this.physics.moveTo(projectile, pointer.x + offset, pointer.y + offset, config.speed);
        projectile.setCollideWorldBounds(true);
        projectile.setBounce(1); // Fully elastic collision
        projectile.body.allowGravity = false;
        projectile.setData('bounces', config.bounces); // Ensure correct max bounces
        projectile.setData('currentBounces', 0); // Reset to 0
        projectile.setData('weaponType', weaponType);
        this.playerBullets.push(projectile);
    
        if (config.rotation) {
            this.tweens.add({
                targets: projectile,
                angle: 360,
                duration: 1000,
                repeat: -1,
                ease: 'Linear'
            });
        }
    }

    bombExplosion(bomb) {
        // Create explosion effect
        this.playerDestroyEmitter.explode(20, bomb.x, bomb.y);
        
        // Check all enemies for area damage
        this.enemies.forEach(enemy => {
            const distance = Phaser.Math.Distance.Between(
                bomb.x, bomb.y,
                enemy.x, enemy.y
            );
            
            // Damage enemies within 100 pixels
            if (distance < 100) {
                this.destroyEnemy(enemy);
                this.gameScoreHandler(100);
                this.updateScore(100);
                this.enemyKilledScore += 100;
            }
        });
        
        this.sounds.destroy.setVolume(1).setLoop(false).play();
        this.destroyPlayerBullet(bomb);
        this.gameSceneHandler();
    }

    handlePlayerBulletBounce() {
        this.playerBullets.forEach((projectile, index) => {
            if (!projectile.active) return; // Skip inactive projectiles
    
            const body = projectile.body;
            if (body.blocked.up || body.blocked.down || body.blocked.left || body.blocked.right) {
                let currentBounces = projectile.getData('currentBounces');
                currentBounces += 1;
                projectile.setData('currentBounces', currentBounces);
                projectile.setFlipX(!projectile.flipX);
    
                const maxBounces = projectile.getData('bounces');
                if (currentBounces >= maxBounces) {
                    if (projectile.getData('weaponType') === 'bomb') {
                        this.bombExplosion(projectile);
                    } else {
                        projectile.destroy();
                        this.playerBullets.splice(index, 1); // Remove from array
                    }
                }
            }
        });
    }

    destroyPlayerBullet(bullet) {

        bullet.destroy();
    }


    spawnEnemy(x, y, enemyObj, speed, distX, distY) {
        let enemy = this.physics.add.sprite(x, y, enemyObj);
        enemy.name = enemyObj;
        this.enemies.push(enemy);
        enemy.setScale(0.3);
        enemy.body.setSize(enemy.body.width * 1.2, enemy.body.height / 1.5);
        enemy.body.allowGravity = false; // Prevent falling
        this.vfx.scaleGameObject(enemy, 1.1);
        let distance = Math.sqrt(distX * distX + distY * distY);
        let fps = 60;
        let time = (distance / speed) * fps * 10; // speed units must be pixels/second

        if (distX + distY > 0) {
            this.tweens.add({
                targets: enemy,
                x: x + distX,
                //y: y + distY,
                duration: time,
                yoyo: true,
                repeat: -1,
                onYoyo: function (tween, target, targetKey, value, tweenData, index) {
                    target.setFlipX(true);
                },
                onRepeat: function (tween, target, targetKey, value, tweenData, index) {
                    target.setFlipX(false);
                }
            });
        }
    }

    destroyEnemy(enemy) {
        this.playerDestroyEmitter.explode(400, enemy.x, enemy.y);
        this.enemies = this.enemies.filter(e => e !== enemy);
        // let x = enemy.x;
        // let y = enemy.y;
        enemy.destroy();
    }
    bulletHitsEnemy(bullet, enemy) {
        this.sounds.destroy.setVolume(1).setLoop(false).play();

        this.destroyPlayerBullet(bullet);
        this.gameScoreHandler(100);
        this.updateScore(100);
        this.enemyKilledScore += 100;
        this.destroyEnemy(enemy);
        this.gameSceneHandler();
    }

    create_Bridge(x, y, length, rotate = false) {
        let bridge_mid_width = 128; // Manually setting width of bridge_mid
        if (rotate) {
            for (let i = 0; i < length; i++) {
                this.bridges.create(x, y + i * bridge_mid_width, 'bridge_mid_v');
            }
        }
        else {
            for (let i = 0; i < length - 1; i++) {
                this.bridges.create(x + i * bridge_mid_width, y, 'bridge_mid');
            }
        }
    }

    add_colliders() {
        this.physics.add.collider(this.player, this.ground);
        this.physics.add.collider(this.enemies, this.ground);
        this.physics.add.collider(this.enemies, this.bridges);
        this.physics.add.collider(this.playerBullets, this.enemies, this.bulletHitsEnemy, null, this);
        this.physics.add.collider(this.playerBullets, this.bridges);
        this.physics.add.collider(this.playerBullets, this.ground);
    }

    create() {


        //for keyboard 
        this.input.keyboard.disableGlobalCapture();
        
        this.vfx = new VFXLibrary(this);

        this.cursor = this.input.keyboard.createCursorKeys();

        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        this.sounds.background.setVolume(0.1).setLoop(true).play();
        var me = this;

        this.bg = this.add.sprite(0, 0, 'background').setOrigin(0, 0).setDepth(-5);
        this.bg.displayWidth = this.game.config.width;
        this.bg.displayHeight = this.game.config.height;


        this.width = this.game.config.width;
        this.height = this.game.config.height;

        // Add UI elements
        this.scoreText = this.add.bitmapText(this.width / 2, 50, 'pixelfont', '0', 64).setOrigin(0.5, 0.5);
        this.scoreText.setDepth(100)
        // here u can remove the keyword to have less tile sheet
        this.pauseButton = this.add.sprite(this.width - 50, 60, "pauseButton").setOrigin(0.5, 0.5);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(3);
        this.pauseButton.setDepth(11)
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        // this.physics.world.setBoundsCollision(true, true, true, true);

        this.playerDestroyEmitter = this.vfx.createEmitter('enemy', 0, 0, 0.035, 0, 1000).setAlpha(0.5)
        this.bridges = this.physics.add.staticGroup();
        this.ground = this.physics.add.staticImage(320, 1240, 'cave_ground').setScale(3.15, 1);
        this.ground.body.setSize(this.ground.width * 5, this.ground.height);

        this.player = this.physics.add.sprite(150, 800, 'player');
        this.player.setScale(0.4);
        // this.player.play('idle');
        this.hand = this.add.sprite(this.player.x, this.player.y, 'hand');
        this.hand.setScale(0.3); // Adjust scale to match player
        this.hand.setOrigin(0.5, 1); // Set origin to bottom center (where it "holds")
        this.hand.setDepth(2); // Above player but below aim line

        // Gun sprite (for ninja star)
        this.gun = this.add.sprite(this.hand.x, this.hand.y, 'gun');
        this.gun.setScale(0.3); // Adjust as needed
        this.gun.setOrigin(0.5, 1); // Bottom center (barrel points up)
        this.gun.setDepth(3); // Above hand
        this.gun.visible = this.currentWeapon === 'ninja'; // Show if ninja is active

        // RPG sprite (for bomb)
        this.rpg = this.add.sprite(this.hand.x, this.hand.y, 'rpg');
        this.rpg.setScale(0.3); // Adjust as needed
        this.rpg.setOrigin(0.5, 1); // Bottom center
        this.rpg.setDepth(3); // Above hand
        this.rpg.visible = this.currentWeapon === 'bomb'; // Show if bomb is active

        // Create graphics crosshair
        this.crosshair = this.add.graphics();
        this.crosshair.lineStyle(4, 0x000000, 1); // Thicker lines (4px)
        const size = 20; // Crosshair line length
        const circleRadius = 12; // Radius of surrounding circle

        // Draw crosshair lines
        this.crosshair.beginPath();
        this.crosshair.moveTo(-size / 2, 0);
        this.crosshair.lineTo(size / 2, 0);
        this.crosshair.moveTo(0, -size / 2);
        this.crosshair.lineTo(0, size / 2);
        this.crosshair.strokePath();

        // Draw circle
        this.crosshair.lineStyle(2, 0x000000, 1); // Thinner line for circle (2px)
        this.crosshair.beginPath();
        this.crosshair.arc(0, 0, circleRadius, 0, Math.PI * 2); // Full circle
        this.crosshair.strokePath();

        this.crosshair.setDepth(5);
        this.crosshair.visible = false;

        // Add weapon selection buttons
        const buttonSpacing = 60; // Space between buttons
        const bottomY = this.height - 50; // 50 pixels from bottom
        const centerX = this.width / 2;

        // Gun button (ninja star)
        this.gunButton = this.add.sprite(centerX - buttonSpacing / 2, bottomY, 'gunButton');
        this.gunButton.setScale(0.2); // Adjust scale as needed
        this.gunButton.setInteractive({ cursor: 'pointer' });
        this.gunButton.on('pointerdown', () => {
            this.currentWeapon = 'ninja';
            this.gun.visible = true;
            this.rpg.visible = false;
        });

        // RPG button (bomb)
        this.rpgButton = this.add.sprite(centerX + buttonSpacing / 2, bottomY, 'rpgButton');
        this.rpgButton.setScale(0.2); // Adjust scale as needed
        this.rpgButton.setInteractive({ cursor: 'pointer' });
        this.rpgButton.on('pointerdown', () => {
            this.currentWeapon = 'bomb';
            this.gun.visible = false;
            this.rpg.visible = true;
        });

        this.add_colliders();

        this.clearScreen();
        this.create_scenes(this.gameScene);

        this.displayBulletsRemaining();
        this.gameScoreHandler(0)

        this.displayBulletsRemaining();
        this.displayBombsRemaining(); // Add this line
        this.gameScoreHandler(0);

        this.input.on('pointerdown', function(pointer) {
            if (!this.gameStarted)
                this.gameStarted = true;
            
            this.isAiming = true;
            this.aimStartTime = this.time.now;
            this.drawAimLine(pointer);
        }, this);
        
        this.input.on('pointermove', function(pointer) {
            if (this.isAiming) {
                this.drawAimLine(pointer);
            }
        }, this);
        
        this.input.on('pointerup', function(pointer) {
            if (this.isAiming) {
                const aimDuration = (this.time.now - this.aimStartTime) / 1000;
                if (aimDuration >= 1) {
                    const bounces = this.currentWeapon === 'bomb' ? 2 : 8; // Explicitly set here
                    this.shootPlayerBullet(pointer, bounces, 0, this.currentWeapon);
                }
                this.isAiming = false;
                this.aimStartTime = null;
                if (this.aimLine) {
                    this.aimLine.destroy();
                    this.aimLine = null;
                }
                this.crosshair.visible = false;
            }
        }, this);

        

    }

    drawAimLine(pointer) {
        if (this.aimLine) {
            this.aimLine.destroy();
        }
        
        this.aimLine = this.add.line(
            0, 0,
            this.player.x, this.player.y,
            pointer.x, pointer.y,
            0xff0000, 0.7
        );
        this.aimLine.setOrigin(0, 0);
        this.aimLine.setLineWidth(3);
        this.aimLine.setDepth(4);
    
        const angle = Phaser.Math.Angle.Between(
            this.player.x, this.player.y,
            pointer.x, pointer.y
        );
        
        this.hand.setRotation(angle);
        const handHeight = this.hand.displayHeight;
        const weapon = this.currentWeapon === 'ninja' ? this.gun : this.rpg;
        weapon.setRotation(angle);
        weapon.setPosition(
            this.hand.x + Math.cos(angle) * handHeight / 2,
            this.hand.y + Math.sin(angle) * handHeight / 2
        );
    
        // Position graphics crosshair at pointer
        this.crosshair.setPosition(pointer.x, pointer.y);
        this.crosshair.visible = true;
    }

    update(delta) {
        this.handlePlayerBulletBounce();
        this.checkGameOver();
    
        this.hand.setPosition(this.player.x, this.player.y);
        const handHeight = this.hand.displayHeight;
        const weapon = this.currentWeapon === 'ninja' ? this.gun : this.rpg;
        
        if (!this.isAiming) {
            this.hand.setRotation(0);
            weapon.setRotation(0);
            weapon.setPosition(this.hand.x, this.hand.y - handHeight / 2);
            this.crosshair.visible = false;
        } else {
            weapon.setPosition(
                this.hand.x + Math.cos(this.hand.rotation) * handHeight / 2,
                this.hand.y + Math.sin(this.hand.rotation) * handHeight / 2
            );
        }
    }

    checkGameOver() {
        let bulletsAlive = this.playerBullets.some(bullet => bullet.active);
        if (this.gameStarted && !bulletsAlive && this.playerBulletsRemaining === 0 && this.enemies.length > 0) {

            if (!this.loseSoundPlayed) {
                this.sounds.lose.setVolume(1).setLoop(false).play();
                this.loseSoundPlayed = true;
                this.resetGame();
            }
        }
    }

    create_scenes(scene) {
        this.loadNextScene = false;
        this.enemyKilledScore = 0;
        this.gameStarted = false;


        this.physics.add.collider(this.enemies, this.bridges);
        this.physics.add.collider(this.playerBullets, this.enemies, this.bulletHitsEnemy, null, this);
        switch (scene) {
            case 1:
                this.playerBulletsRemaining = 6;
                this.bombsRemaining = 3;
                this.displayBulletsRemaining();
                this.displayBombsRemaining();

                // Platforms (128px per segment)
                this.create_Bridge(10, 650, 3); // Lower: x=10 to ~394, y=650
                this.create_Bridge(300, 500, 3); // Mid: x=300 to ~684, y=500
                this.create_Bridge(100, 350, 4); // High: x=100 to ~612, y=350

                // Static enemies
                this.spawnEnemy(150, 615, 'enemy', 0, 0, 0); // Lower platform (easy)
                this.spawnEnemy(300, 1100, 'enemy', 0, 0, 0); // Ground level (easy, near player)
                this.spawnEnemy(400, 465, 'enemy', 0, 0, 0); // Mid platform
                this.spawnEnemy(450, 315, 'enemy', 0, 0, 0); // High platform

                break;

            case 2:
                this.playerBulletsRemaining = 6;
                this.bombsRemaining = 3;
                this.displayBulletsRemaining();
                this.displayBombsRemaining();
                this.create_Bridge(65, 500, 4);
                this.spawnEnemy(100, 250, 'enemy', 100, 250, 0)
                this.create_Bridge(290, 250, 4);
                this.spawnEnemy(250, 100, 'enemy', 75, 300, 0)
                break;

            case 3: // New level
                this.playerBulletsRemaining = 6;
                this.bombsRemaining = 3;
                this.displayBulletsRemaining();
                this.displayBombsRemaining();
                this.create_Bridge(265, 450, 3);
                this.create_Bridge(65, 250, 5);
                this.spawnEnemy(70, 100, 'enemy', 50, 370, 0);
                this.spawnEnemy(270, 300, 'enemy', 50, 180, 0);
                break;

            case 4:
                this.playerBulletsRemaining = 7;
                this.bombsRemaining = 3;
                this.displayBulletsRemaining();
                this.displayBombsRemaining();
                this.create_Bridge(575, 505, 1, true);
                this.create_Bridge(180, 505, 1, true);
                this.create_Bridge(250, 546, 4);
                this.spawnEnemy(220, 240, 'enemy', 50, 260, 0)
                break;

            case 5: // New level
                this.playerBulletsRemaining = 7;
                this.bombsRemaining = 3;
                this.displayBulletsRemaining();
                this.displayBombsRemaining();
                this.create_Bridge(100, 296, 3);

                this.create_Bridge(390, 555, 1, true);
                this.create_Bridge(655, 555, 1, true);
                this.create_Bridge(460, 596, 3);

                this.spawnEnemy(90, 120, 'enemy', 50, 120, 0)
                this.spawnEnemy(430, 220, 'enemy', 50, 140, 0)
                break;

            default:
                const randomCase = Math.floor(Math.random() * 5) + 1;
                switch (randomCase) {
                    case 1:
                        this.playerBulletsRemaining = 6;
                        this.bombsRemaining = 3;
                        this.displayBulletsRemaining();
                        this.displayBombsRemaining();
                        this.create_Bridge(10, 550, 4);
                        this.spawnEnemy(65, 250, 'enemy', 100, 0, 0)
                        break;

                    case 2:
                        this.playerBulletsRemaining = 6;
                        this.bombsRemaining = 3;
                        this.displayBulletsRemaining();
                        this.displayBombsRemaining();
                        this.create_Bridge(65, 500, 4);
                        this.spawnEnemy(100, 250, 'enemy', 100, 250, 0)
                        this.create_Bridge(290, 250, 4);
                        this.spawnEnemy(250, 100, 'enemy', 75, 300, 0)
                        break;

                    case 3: // New level
                        this.playerBulletsRemaining = 6;
                        this.bombsRemaining = 3;
                        this.displayBulletsRemaining();
                        this.displayBombsRemaining();
                        this.create_Bridge(265, 450, 3);
                        this.create_Bridge(65, 250, 5);
                        this.spawnEnemy(70, 100, 'enemy', 50, 370, 0);
                        this.spawnEnemy(270, 300, 'enemy', 50, 180, 0);
                        break;

                    case 4:
                        this.playerBulletsRemaining = 7;
                        this.bombsRemaining = 3;
                        this.displayBulletsRemaining();
                        this.displayBombsRemaining();
                        this.create_Bridge(575, 505, 1, true);
                        this.create_Bridge(180, 505, 1, true);
                        this.create_Bridge(250, 546, 4);
                        this.spawnEnemy(220, 240, 'enemy', 50, 260, 0)
                        break;

                    case 5: // New level
                        this.playerBulletsRemaining = 7;
                        this.bombsRemaining = 3;
                        this.displayBulletsRemaining();
                        this.displayBombsRemaining();
                        this.create_Bridge(100, 296, 3);

                        this.create_Bridge(390, 555, 1, true);
                        this.create_Bridge(655, 555, 1, true);
                        this.create_Bridge(460, 596, 3);

                        this.spawnEnemy(90, 120, 'enemy', 50, 120, 0)
                        this.spawnEnemy(430, 220, 'enemy', 50, 140, 0)
                        break;
                }
                break;

        }
    }

    gameSceneHandler() {
        if (this.gameStarted) {
            if (this.enemies.length <= 0 && !this.levelOver) {
                this.levelOver = true;
                this.gameScoreHandler(this.playerBulletsRemaining * 100);
                this.showLevelOver();
            }
        }

    }

    gameScoreHandler(score) {
        this.gameScore += score;
    }

    clearScreen() {
        this.enemies.forEach(enemy => this.destroyEnemy(enemy));
        this.playerBullets.forEach(bullet => this.destroyPlayerBullet(bullet));
        this.bridges.clear(true, true); // Add this line to clear bridges

    }

    showLevelOver() {
        this.sounds.success.setVolume(1).setLoop(false).play();

        // this.sound.play('next_level_sound');
        var enemyKilledGraphic = this.add.image(200, 380, 'enemy').setScale(0.2).setVisible(false);
        var ninjaStarGraphic = this.add.image(200, 438, 'projectile').setScale(0.2).setVisible(false);
        if (!this.levelOverText) {
            this.levelOverText = this.add.bitmapText(this.width / 2, 550, 'pixelfont', '0', 64)
                .setOrigin(0.5, 0.5).setDepth(100);

        }

        var levelScore = this.enemyKilledScore + (this.playerBulletsRemaining * 100);
        this.levelOverText.setText('Level Score: ' + levelScore + '\nFinal Score: ' + this.gameScore);
        this.levelOverText.setVisible(true);
        this.updateScore(levelScore);

        // Display enemy killed score
        if (!this.enemyKilledText) {
            this.enemyKilledText = this.add.bitmapText(this.width / 2, 370, 'pixelfont', '0', 64)
                .setOrigin(0.5, 0.5).setDepth(100);

        }
        this.enemyKilledText.setText('' + this.enemyKilledScore);
        this.enemyKilledText.setVisible(true);
        enemyKilledGraphic.setVisible(true);

        // Display ninja star score
        if (!this.ninjaStarText) {
            this.ninjaStarText = this.add.bitmapText(this.width / 2, 430, 'pixelfont', '0', 64)
                .setOrigin(0.5, 0.5).setDepth(100);
        }
        this.ninjaStarText.setText('' + this.playerBulletsRemaining * 100);
        this.ninjaStarText.setVisible(true);
        ninjaStarGraphic.setVisible(true);

        // Create a 'Next Level' button if it doesn't exist
        if (!this.nextLevelButton) {
            this.nextLevelButton = this.add.image(350, 680, 'next_level');
            this.nextLevelButton.setScale(.75);
            this.nextLevelButton.setInteractive();
            this.nextLevelButton.on('pointerdown', () => {
                // this.sound.play('clink_sound');
                this.nextLevelButton.destroy();
                this.nextLevelButton = null;
                this.levelOver = false;
                this.gameScene += 1;
                this.clearScreen();

                this.levelOverText.setVisible(false);
                this.ninjaStarText.setVisible(false);
                this.enemyKilledText.setVisible(false);
                enemyKilledGraphic.setVisible(false);
                ninjaStarGraphic.setVisible(false);


                this.create_scenes(this.gameScene);
            }, this);
        }

        // Show the 'Next Level' button
        this.nextLevelButton.setVisible(true);
    }

    displayBulletsRemaining() {
        // Destroy previous ninja star images
        if (this.bulletsRemainingImages.length > 0) {
            this.bulletsRemainingImages.forEach(image => image.destroy());
            this.bulletsRemainingImages = [];
        }
        let startingX = 25;
        let y = 20;
        for (let i = 0; i < this.playerBulletsRemaining; i++) {
            let x = startingX + i * 45;
            let image = this.add.image(x, y, "projectile");
            image.setScale(0.1);
            this.bulletsRemainingImages.push(image);
        }
    }

    displayBombsRemaining() {
        // Destroy previous bomb images
        if (this.bombsRemainingImages.length > 0) {
            this.bombsRemainingImages.forEach(image => image.destroy());
            this.bombsRemainingImages = [];
        }
        let startingX = 25;
        let y = 65; // Position below ninja stars (20 + 45 offset)
        for (let i = 0; i < this.bombsRemaining; i++) {
            let x = startingX + i * 45;
            let image = this.add.image(x, y, "bomb");
            image.setScale(0.1); // Match bomb scale
            this.bombsRemainingImages.push(image);
        }
    }

    resetGame() {
        this.isGameOver = true;
        this.playerBulletsRemaining = 5; // Reset ninja stars
        this.bombsRemaining = 3;         // Reset bombs
        this.displayBulletsRemaining();
        this.displayBombsRemaining();
        // this.score = 0;
        this.vfx.shakeCamera();
        // this.car.destroy();
        // this.physics.pause();
        this.sounds.background.stop();

        let gameOverText = this.add.bitmapText(this.cameras.main.centerX, this.cameras.main.centerY - 400, 'pixelfont', 'Game Over', 64)
            .setOrigin(0.5)
            .setVisible(false)
            .setAngle(-15).setTint(0xFF0000);

        this.time.delayedCall(500, () => {
            gameOverText.setVisible(true);
            this.tweens.add({
                targets: gameOverText,
                y: '+=200',
                angle: 0,
                scale: { from: 0.5, to: 2 },
                alpha: { from: 0, to: 1 },
                ease: 'Elastic.easeOut',
                duration: 1500,
                onComplete: () => {
                    this.time.delayedCall(1000, this.gameOver, [], this);
                }
            });
        });
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(this.score);
    }

    gameOver() {
        initiateGameOver.bind(this)({
            "score": this.score
        });
    }

    pauseGame() {
        handlePauseGame.bind(this)();
    }
}

const config = {
    type: Phaser.AUTO,
    width: _CONFIG.deviceOrientationSizes[_CONFIG.deviceOrientation].width,
    height: _CONFIG.deviceOrientationSizes[_CONFIG.deviceOrientation].height,
    scene: [GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    pixelArt: true,
    /* ADD CUSTOM CONFIG ELEMENTS HERE */
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 1000 },
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


