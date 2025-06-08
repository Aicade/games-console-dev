// Touuch Screen Controls
const joystickEnabled = true;
const buttonEnabled = true;
const hideButtons = true;
var isMobile = false;
// JOYSTICK DOCUMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/virtualjoystick/
const rexJoystickUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js";

// BUTTON DOCMENTATION: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/button/
const rexButtonUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexbuttonplugin.min.js";




/*
------------------- GLOBAL CODE STARTS HERE -------------------
*/

const PLAYER_STATE = {
    SMALL:   0,
    BIG:     1,
    BULLETS: 2,
    SHIELD:  3,
    MISSILE: 4
};

const LEVEL= {
    FIRST:   1,
    SECOND:  2,
    THIRD:   3,
    FOURTH:  4,
};

const ENEMIES = {
    BASIC: 0,
    FIRE: 1,
    SNOW: 2,
};




// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    init() {

        this.currentLevel = LEVEL.THIRD; // Start with Level 1

        this.cursors = null;
        this.player = null;
        this.platforms = null;
        this.bottom_platform=null;
        this.enemies = null;
        this.nextEnemyTime = 0;
        this.nextBricksTime = 0;
        this.scoreText = null;
        this.powerUps = null;
        this.score = 0;
        this.missiles = null;
        this.rocketLauncher = null;
        this.leveluptext=null;
        this.lastEnemyShootTime = 0; 
        this.enemyShootDelay = 8000; 
        this.freezeDuration = 3000;
          
          // Lives / Hearts
        this.maxLives = 8;
        this.currentLives = 3; // Start with 3
        this.livesArray = [];  // For storing heart GameObjects
        this.highestX      = 0;

        // Power-up Icons
        this.sizeIcon     = null;
        this.bulletIcon   = null;
        this.shieldIcon   = null;
        this.missileIcon  = null;

        //boss
         this.bossMaxLives    = 12;
         this.bossCurrentLives = 12;
         this.bossLivesArray   = [];    
         this.boss = null;

         this.input.addPointer(3);
        this.score = 0;
        this.meter = 0;
        this.totalMeters = 0
        this.finishPoint = 20000;
        this.playerState = PLAYER_STATE.SMALL; // 0 : small | 1 : Big | 2 : Big + Bullets
        this.brickSize = 50;

         this.fireDelay = 4000;
        this.lastFireTime = 0;
        this.bossFireballSpeed = 150;
         this.playerReachedFinish = false;


         this.missileCount = 0;
         this.missileCountText = '';

        this.width = this.game.config.width;
        this.height = this.game.config.height;

        
    }

    preload() {

         for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

       

        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        
       for (const key in _CONFIG.atlasLoader) {
        const atlas = _CONFIG.atlasLoader[key];
        this.load.atlas(key, atlas.textureURL, atlas.atlasURL);
        }
        for (const key in _CONFIG.libLoader) {
            this.load.image(key, _CONFIG.libLoader[key]);
        }
        
   
        // Load additional UI assets
        this.load.bitmapFont('pixelfont',
            "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.png",
            "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.xml"
        );

            this.load.bitmapFont(
            'pixelFont',
            'assets/fonts/PressStart2P.png',
            'assets/fonts/PressStart2P.fnt'
        );
        
        
        if (joystickEnabled) this.load.plugin('rexvirtualjoystickplugin', rexJoystickUrl, true);
        if (buttonEnabled) this.load.plugin('rexbuttonplugin', rexButtonUrl, true);
        
        // Attach additional event listeners and display the progress loader
        addEventListenersPhaser.bind(this)();
        displayProgressLoader.call(this);


    }
    
    create() {
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }
        isMobile = !this.sys.game.device.os.desktop;
        this.vfx = new VFXLibrary(this);

        this.sounds.background.setVolume(0.1).setLoop(true).play();

      

        // Create a tileSprite that covers more vertical space so it repeats the background image
        this.bg = this.add.tileSprite(
            0,
            0,
            this.finishPoint + 200,
            this.game.config.height,
            'background'
        ).setOrigin(0, 0.04);

        this.bottom_platform = this.add.tileSprite(
            0,
            this.game.config.height - 50, // Adjust this Y position to align with your ground
            this.finishPoint + 200,
            100, // Height of the bottom platform
            'platform_ground' // Using the correct key
        ).setOrigin(0, 0)
        .setScrollFactor(1)
        .setDepth(2);

        // Adjust the tile position so that the bottom of the repeated image aligns with the bottom of the screen
        this.bg.tilePositionY = this.bg.height - this.game.config.height;

        this.bg.setScrollFactor(1);

        // this.endPole = this.add.sprite(this.finishPoint, 100, 'platform').setOrigin(0, 0);
        // this.endPole.setScrollFactor(1);
        // this.endPole.displayHeight = this.game.config.height;
        // this.endPole.displayWidth = 40;

            


                this.createBoss(); // Initialize the boss


                
                    // AVATAR & HEALTH BAR
                    
                    // Avatar image
                    this.avatar = this.add.image(60, 60, 'avatar')
                        .setDisplaySize(80, 80)
                        .setScrollFactor(0)
                        .setDepth(10);

                        // Icons positioned directly below the avatar
                    const iconY = 60 + 50 + 15;  // avatar Y + half avatar height + padding

                    this.sizeIcon = this.add.image(60, iconY, 'iconSize')
                        .setDisplaySize(40, 40)
                        .setAlpha(0.3)     // start grayed out
                        .setScrollFactor(0)
                        .setDepth(10);

                    this.bulletIcon = this.add.image(60 + 50, iconY, 'iconBullet')
                        .setDisplaySize(40, 40)
                        .setAlpha(0.3)
                        .setScrollFactor(0)
                        .setDepth(10);

                    this.shieldIcon = this.add.image(60 + 100, iconY, 'iconshield')
                        .setDisplaySize(40, 40)
                        .setAlpha(0.3)
                        .setScrollFactor(0)
                        .setDepth(10);

                    this.missileIcon = this.add.image(60 + 150, iconY, 'iconmissile')
                        .setDisplaySize(40, 40)
                        .setAlpha(0.3)
                        .setScrollFactor(0)
                        .setDepth(10);

                        this.missileCountCircle = this.add.circle(
                        this.missileIcon.x + 20,
                        this.missileIcon.y + 20,
                        14,
                        0xffffff
                    )
                    .setScrollFactor(0)
                    .setDepth(12);

                    this.missileCountText = this.add.text(
                        this.missileCountCircle.x,
                        this.missileCountCircle.y,
                        `${this.missileCount}`,
                        {
                            fontFamily: 'monospace',
                            fontSize: '20px',
                            color: '#000000',
                            align: 'center'
                        }
                    )
                    .setOrigin(0.5)
                    .setScrollFactor(0)
                    .setDepth(13);

                       

                    // Draw hearts (lives)
                    for (let i = 0; i < this.maxLives; i++) {
                        const heart = this.add.image(120 + i * 40, 60, 'heart')
                        .setDisplaySize(50, 50)
                        .setScrollFactor(0)
                        .setDepth(10)
                        .setVisible(i < this.currentLives); // Only show lives that exist

                        this.livesArray.push(heart);
                    }


            // ── DISTANCE BAR WITH AVATAR ──
                    this.barWidth  = 600; 
                    this.barHeight = 24; 
                    this.barY      = 60;  // align with hearts
                    this.barStartX = this.scale.width/2 - this.barWidth/2;
                    this.totalMeters = Math.round(this.finishPoint / 100);

                    // BG
                    this.distanceBarBg = this.add.rectangle(
                    this.scale.width/2, this.barY,
                    this.barWidth, this.barHeight,
                    0xaaaaaa
                    )
                    .setOrigin(0.5)
                    .setScrollFactor(0)
                    .setDepth(10);

                    // fill
                    this.distanceBarFill = this.add.rectangle(
                    this.barStartX, this.barY,
                    0, this.barHeight,
                    0x00ff00
                    )
                    .setOrigin(0, 0.5)
                    .setScrollFactor(0)
                    .setDepth(11);

                    // avatar
                    this.distanceAvatar = this.add.image(
                    this.barStartX, this.barY
                    , 'avatar')
                    .setDisplaySize(32, 32)   // larger so you can see it
                    .setOrigin(0.5, 0.5)       // center in both axes
                    .setScrollFactor(0)
                    .setDepth(12);

                    // text
                this.distanceText = this.add.text(
                this.scale.width/2,
                this.barY + this.barHeight/2 + 25,
                `0 / ${this.totalMeters}m`,
                {
                    fontFamily: 'monospace',
                    fontSize: '32px',
                    color: '#ffffff',
                    stroke: '#000000',        // black outline
                    strokeThickness: 4,       // thickness of outline
                    align: 'center',
                    shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#000000',
                    blur: 2,
                    fill: true
                    }
                }
                )
                .setOrigin(0.5)
                .setScrollFactor(0)
                .setDepth(11);

        // Coin icon
                this.scoreImg = this.add.image(60, 180, 'coin')
                    .setDisplaySize(65, 65) // slightly smaller for clean look
                    .setScrollFactor(0)
                    .setDepth(11);

                // Coin text, aligned right next to image
                this.scoreText = this.add.text(90, 166, '0', {
                    fontFamily: 'monospace',
                    fontSize: '32px',
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 4,
                    align: 'center',
                    shadow: {
                        offsetX: 2,
                        offsetY: 2,
                        color: '#000000',
                        blur: 2,
                        fill: true
                    }   
                })
                .setScrollFactor(0)
                .setDepth(11);


            // Initialize powerUpText for displaying power-up messages
        // POWER-UP MESSAGES (centered above the bar)
         this.powerUpText = this.add.text(
         this.scale.width / 2,                      // center X
         this.barY + this.barHeight / 2 + 100,       // same Y as finishText
                '',                                         // initially empty
                {
                    fontFamily: 'monospace',
                    fontSize: '30px',
                    color: '#ffffff',                         // white message
                    stroke: '#000000',                        // black outline
                    strokeThickness: 4,
                    align: 'center',
                    shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#000000',
                    blur: 3,
                    fill: true
                    }
                }
                )
                .setOrigin(0.5, 0)    // top-center origin, same as finishText
                .setScrollFactor(0)
                .setDepth(11);

                //leveluptext
                this.leveluptext = this.add.text(
                this.scale.width / 2,                      // center X
                this.barY + this.barHeight / 2 + 100,       // same Y as finishText
                        '',                                         // initially empty
                        {
                            fontFamily: 'monospace',
                            fontSize: '30px',
                            color: '#ffcc00',                        
                            stroke: '#000000',                        // black outline
                            strokeThickness: 4,
                            align: 'center',
                            shadow: {
                            offsetX: 2,
                            offsetY: 2,
                            color: '#000000',
                            blur: 3,
                            fill: true
                            }
                        }
                        )
                        .setOrigin(0.5, 0)    // top-center origin, same as finishText
                        .setScrollFactor(0)
                        .setDepth(11);
                
               

                // FINISH TEXT (centered below the bar, not overlapping)
                this.finishText = this.add.text(
                this.finishPoint - 100,               // center X
                this.barY + this.barHeight / 2 + 100, // below the bar by 40px
                'FINISH',
                {
                    fontFamily: 'monospace',
                    fontSize: '30px',
                    color: '#ffcc00',
                    stroke: '#000000',
                    strokeThickness: 4,
                    align: 'center',
                    shadow: {
                    offsetX: 2,
                    offsetY: 2,
                    color: '#000000',
                    blur: 3,
                    fill: true
                    }
                }
                )
                .setOrigin(0.5, 0)    // horizontally centered, vertical origin at top
                .setScrollFactor(1)   // scrolls with world if you want it near the finish pole
                .setDepth(11);
        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.pauseButton = this.add.sprite(this.game.config.width - 60, 60, "pauseButton").setOrigin(0.5, 0.5);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(2).setScrollFactor(0);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        this.physics.world.bounds.setTo(0, 0, this.finishPoint + 200, this.game.config.height);
        this.physics.world.setBoundsCollision(true);

        this.player = this.physics.add.sprite(100, 500, 'player').setScale(0.2).setBounce(0.1).setCollideWorldBounds(true);

        this.player.body.setMaxVelocity(300, 1000);

        // 1b) Add horizontal drag so they don’t stop instantly
        this.player.body.setDrag(800, 0);


        this.player.body.setSize(this.player.body.width / 1.5, this.player.body.height);
        this.player.setGravityY(800);
        this.player.power_state = PLAYER_STATE.SMALL;

        this.bullets = this.physics.add.group({
            defaultKey: 'projectile',
            active: false,
            maxSize: 20
        });

        // Replace the visible platform asset with an invisible ground rectangle
        this.ground = this.add.rectangle(
            0,
            this.game.config.height - 50,  // Position so that the top of the ground is at (game height - 50)
            this.finishPoint + 200,
            50
        ).setOrigin(0, 0);
        this.physics.add.existing(this.ground, true);

        this.platforms = this.physics.add.staticGroup();
        // First row y is defined as:
        let firstRowY = this.game.config.height - this.ground.displayHeight - this.player.displayHeight - 100;
        // Create initial first row platforms
        let x = this.player.x + this.game.config.width / 2 + 100;
        let platform = this.platforms.create(x, firstRowY, 'platform');
        platform.displayHeight = platform.displayWidth = this.brickSize;
        platform.refreshBody();
        let i = 5;
        while (i) {
            x = x + platform.displayWidth + 1;
            platform = this.platforms.create(x, firstRowY, 'platform');
            platform.displayHeight = platform.displayWidth = this.brickSize;
            platform.refreshBody();
            i--;
        }

        // Later, additional platforms are spawned by spawnBricks (which can be for a second row)
        this.physics.add.collider(this.player, this.platforms, this.hitBrick, null, this);
        this.physics.add.collider(this.player, this.ground);

        this.enemies = this.physics.add.group();
        this.physics.add.collider(this.enemies, this.platforms);
        this.physics.add.collider(this.enemies, this.ground);

        this.powerUps = this.physics.add.group();
        this.cameras.main.setBounds(0, 0, this.finishPoint + 200, this.game.config.height);
        this.physics.add.collider(this.powerUps, this.ground);
        this.physics.add.collider(this.powerUps, this.platforms);

        this.cameras.main.startFollow(this.player);

        this.physics.add.overlap(this.player, this.powerUps, this.collectPowerUp, null, this);
        this.highestX = this.player.x;
        this.physics.add.collider(this.player, this.enemies, this.onPlayerEnemyCollision, null, this);
        this.physics.add.collider(this.bullets, this.enemies, this.bulletHit, null, this);
        this.physics.add.collider(this.bullets, this.platforms);
        this.physics.add.collider(this.bullets, this.ground);


        this.playerMovedBackFrom = this.player.x;
        this.canSpawnEnemies = true;
        this.createMobileButtons();
        this.bindWalkingMovementButtons();
        this.input.keyboard.disableGlobalCapture();

        // In create(), add the jump key for spacebar jump
        this.jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);


            // ─── 5) Create missile group before its collider ──────────────────────────
            this.missiles = this.physics.add.group({
                defaultKey: 'player_powerup',
                maxSize: 10
            });

            //  // Register one collider for “bullet touches boss”:
            this.physics.add.collider(
                this.bullets,
                this.boss,
                this.onBulletBossCollision,
                null,
                this
            );

            // Register one collider for “missile touches boss”:
            this.physics.add.collider(
                this.missiles,
                this.boss,
                this.onMissileBossCollision,
                null,
                this
            );
           
            //  Set up boss ↔ platforms & boss ↔ ground collisions ─────────────────
            this.physics.add.collider(this.boss, this.platforms);
            this.physics.add.collider(this.boss, this.ground);

          
                         

            // When missile hits an enemy:
            this.physics.add.collider(this.missiles, this.enemies, (missile, enemy) => {
                
                 const explosion = this.vfx.createEmitter(
                    'enemy',              // texture key (e.g. a spark or smoke)
                    enemy.x, 
                    enemy.y,
                    0.03,                 // lifespan or frequency parameter (tweak as needed)
                    0, 
                    800                   // particle speed/lifetime (adjust to taste)
                );
                explosion.explode(200);
                // If the enemy tracks `health`, reduce it by 2; else, just destroy:
                if (enemy.health !== undefined) {
                    enemy.health -= 2;
                    if (enemy.health <= 0) {
                        enemy.destroy();
                    }
                } else {
                    enemy.destroy();
                }

                 // 4) Destroy the missile itself
                    missile.destroy();

                    // 5) (Optional) Increment score
                    this.updateScore(2); // or whatever value you want
            });

            // ─── (NEW) Rocket launcher sprite (hidden until MISSILE stage)
            this.rocketLauncher = this.add.image(this.player.x, this.player.y, 'player_powerup2')
                .setDisplaySize(48, 48)
                .setOrigin(0.5, 0.5)
                .setScrollFactor(0)
                .setDepth(12)
                .setVisible(false); // start off hidden

                
                

        this.physics.add.overlap(this.player, this.bossFireballs, this.onPlayerHit, null, this);

       

        if (typeof this.currentLevel === 'undefined') {
            this.currentLevel = LEVEL.FIRST; // Default to Level 1 if not set
        }
        

        // Log before and after `loadLevelAssets()`
      
        this.loadLevelAssets();
      
            this.changeboss(); // Pass enemy and boss to the function
       
     
            
        this.cursors = this.input.keyboard.createCursorKeys();

    }



    update(time, delta) {
        const isTouchingGround = this.player.body.blocked.down || this.player.body.touching.down;

        // Check if the player is frozen
        if (!this.player.isFrozen) {
            // Movement Physics
            if (this.cursors.left.isDown) {
                // Move left with acceleration
                this.player.setAccelerationX(-2000); // Adjust acceleration for smoother movement
                this.player.flipX = true; // Flip sprite to face left
                if (isTouchingGround && this.player.body.velocity.x !== 0) {
                    // ─── Simple dust VFX at feet ───
                    this.time.delayedCall(100, () => {
                        this.vfx.createEmitter(
                            'dust',
                            this.player.x + 20,
                            this.player.y + this.player.displayHeight / 2.5,
                            0.04, 0, 50
                        ).explode(1);
                    });
                }
            } else if (this.cursors.right.isDown) {
                // Move right with acceleration
                this.player.setAccelerationX(600); // Adjust acceleration for smoother movement
                this.player.flipX = false; // Flip sprite to face right
                if (isTouchingGround && this.player.body.velocity.x !== 0) {
                    // ─── Simple dust VFX at feet ───
                    this.time.delayedCall(100, () => {
                        this.vfx.createEmitter(
                            'dust',
                            this.player.x - 20,
                            this.player.y + this.player.displayHeight / 2.5,
                            0.04, 0, 50
                        ).explode(1);
                    });
                }
            } else {
                // Stop accelerating when no key is pressed
                this.player.setAccelerationX(0);

                // Apply ground friction when touching the ground
                if (isTouchingGround) {
                    this.player.setDragX(800); // Adjust drag for smoother deceleration
                }
            }

            // Jumping Physics
            if (Phaser.Input.Keyboard.JustDown(this.jumpKey) && isTouchingGround) {
                // Adjusted jump velocity for higher jumps
                this.vfx.createEmitter(
                    'enemy',                                        // use the 'enemy' texture for particles
                    this.player.x, 
                    this.player.y + this.player.displayHeight / 2,   // bottom of scaled sprite
                    0.03, 0, 300
                ).explode(12);

                this.player.setVelocityY(-600); // Increased from -500 to -600 for higher jump
                this.sounds.jump.setVolume(0.2).setLoop(false).play();
            }

            // Variable Jump Height (Allow holding jump key to jump higher)
            if (this.jumpKey.isDown && this.player.body.velocity.y < 0) {
                this.player.setGravityY(400); // Reduce gravity while the jump key is held
            } else {
                this.player.setGravityY(1600); // Increase gravity for a smooth fall
            }

            // Prevent infinite acceleration by clamping velocity
            this.player.setMaxVelocity(300, 1000); // Adjust max velocity for horizontal and vertical movement
        } else {
            // If the player is frozen, prevent movement and jumping
            this.player.setVelocityX(0); // Stop horizontal movement
            this.player.setAccelerationX(0); // Stop acceleration
            this.player.setVelocityY(0); // Stop vertical movement
        }

        // Enemy spawn logic
        if (time > this.nextEnemyTime) {
            const baseInterval = 5000; // Base spawn interval in milliseconds
            const maxInterval = 8000;
            const minInterval = 3000;
            const progress = Phaser.Math.Clamp(this.meter / this.totalMeters, 0, 1); // Progress 0 to 1

            // Reduce interval as the player progresses, but not below minInterval
            const spawnInterval = Phaser.Math.Between(
                Math.max(baseInterval * (1 - progress), minInterval),
                maxInterval
            );

            this.spawnEnemy();
            this.nextEnemyTime = time + spawnInterval;
        }

        // Brick spawn logic
        if (this.nextBricksTime && time > this.nextBricksTime && (this.cursors.right.isDown || this.rightPressed)) {
            this.nextBricksTime = time + Phaser.Math.Between(6000, 15000);
            let bricksNum = Phaser.Math.Between(2, 5);
            this.spawnBricks(bricksNum);
            if (Phaser.Math.Between(0, 5)) {
                this.spawnBricks(3, this.brickSize * bricksNum + 200, Phaser.Math.Between(150, 250));
            }
        }
        if (this.nextBricksTime == 0 && this.player.x > this.game.config.width) {
            this.nextBricksTime = time;
        }

        // Update distance bar and avatar
        if (this.player.x > this.highestX) {
            this.highestX = this.player.x;
            this.meter = Math.round(this.player.x / 100);

            // update the on-bar text
            this.distanceText.setText(`${this.meter} / ${this.totalMeters}m`);

            // progress 0→1
            const progress = Phaser.Math.Clamp(this.meter / this.totalMeters, 0, 1);

            // resize fill
            this.distanceBarFill.width = this.barWidth * progress;

            // move avatar
            this.distanceAvatar.x = this.barStartX + this.barWidth * progress;
        }

        // Stick the rocket launcher to the player when in MISSILE state
        if (this.player.power_state === PLAYER_STATE.MISSILE) {
            const offsetX = this.player.flipX ? -28 : 28;
            const offsetY = 8;
            this.rocketLauncher.setVisible(true);
            this.rocketLauncher.setPosition(this.player.x + offsetX, this.player.y + offsetY);
            this.rocketLauncher.setFlipX(this.player.flipX); // flip if player faces left
        } else {
            this.rocketLauncher.setVisible(false);
        }

        // Destroy missiles that leave the world bounds
        this.missiles.children.each((missile) => {
            if (missile.active) {
                if (missile.x < this.cameras.main.scrollX - 50 || missile.x > this.cameras.main.scrollX + this.width + 50) {
                    missile.destroy();
                }
            }
        }, this);

        if (!this.playerReachedFinish && this.meter >= 190) {
            this.playerReachedFinish = true;
        }

        if (this.playerReachedFinish && time > this.lastFireTime + this.fireDelay) {
            this.lastFireTime = time;
            this.fireTrackingFireball();
        }

        // Check enemy attack conditions (shoot only when player is close)
       if (time > this.lastEnemyShootTime + this.enemyShootDelay) {
            this.lastEnemyShootTime = time; // Update last shoot time
            this.enemies.children.each((enemy) => {
                const cameraBounds = this.cameras.main.worldView; // Get the camera's viewport bounds

                // Check if the enemy is within the viewport
                const isEnemyVisible =
                    enemy.x >= cameraBounds.x &&
                    enemy.x <= cameraBounds.x + cameraBounds.width &&
                    enemy.y >= cameraBounds.y &&
                    enemy.y <= cameraBounds.y + cameraBounds.height;

                if (isEnemyVisible) { // Enemy shoots only if visible on screen
                    if (this.currentLevel === LEVEL.SECOND) {
                        this.shootLavaBall(enemy, this.player);
                    } else if (this.currentLevel === LEVEL.THIRD) {
                        this.shootSnowBall(enemy, this.player);
                    }
                }
            });
        }
    }

    

    onBossDefeated() {
        console.log("Boss defeated logic triggered. Current Level:", this.currentLevel);

        if (this.currentLevel === LEVEL.FIRST) {
            this.boss.destroy();
            this.currentLevel = LEVEL.SECOND; // Transition to Level 2
            console.log("Transitioning to Level 2...");

            this.time.delayedCall(2000, () => {
                this.powerUpText.text="Level 2";
                
                this.resetGameState(); // Reset game state variables (excluding currentLevel)
                this.resetPlayerForLevelTransition(); // Reset player position and state for the new level
                this.loadLevelAssets();
            });

        } 
         else if (this.currentLevel === LEVEL.SECOND) {
              this.boss.destroy();
            this.currentLevel = LEVEL.THIRD; // Transition to Level 2
            console.log("Transitioning to Level 3...");

            this.time.delayedCall(2000, () => {
                this.powerUpText.text="Level 3";
                
                this.resetGameState(); // Reset game state variables (excluding currentLevel)
                this.resetPlayerForLevelTransition(); // Reset player position and state for the new level
                this.loadLevelAssets(); // Dynamically load Level 2 assets
            });

        }  
        else if (this.currentLevel === LEVEL.THIRD) {

            this.boss.destroy();
            this.player.setTint(0x00ff00);
            this.physics.pause();
            this.time.delayedCall(1000, () => {
                this.gameOver();
            }); 
        }
    }

    resetPlayerForLevelTransition() {
        console.log("Resetting player for level transition...");
        
        // Reset player position to the start of the new level
        this.player.setPosition(100, 500); // Starting position for Level 2
        this.player.setVelocity(0, 0); // Stop any ongoing movement
        this.player.body.setAcceleration(0); // Reset acceleration
        
        // Reset player state (optional, if you have specific states to reset)
        this.player.clearTint(); // Remove any visual effects like tint
        this.score=0;
        this.meter=0;

    }

    resetGameState() {
        console.log("Resetting game state...");
        
        // Do not reset currentLevel here
        console.log("currentLevel remains unchanged:", this.currentLevel);
        this.createBoss();
        this.changeboss();
        this.bossDefeated = false;
        this.bossCurrentLives = this.bossMaxLives;
        this.currentLives = this.maxLives;
    
        this.playerReachedFinish = false;

         // Reset the distance bar
        this.resetDistanceBar(); 

        this.meter=0;   
    }

    resetDistanceBar() {
        console.log("Resetting distance bar...");

        // Reset the fill width to 0
        this.distanceBarFill.setSize(0, this.barHeight);

        // Move the avatar back to the start of the bar
        this.distanceAvatar.setPosition(this.barStartX, this.barY);

        // Reset totalMeters to 0
        this.totalMeters = 0;

        // Update the text to reflect the reset state
        this.distanceText.setText(`0 / ${this.totalMeters}m`);
    }

    loadLevelAssets() {
        console.log("Loading assets for Level:", this.currentLevel);

        if (this.currentLevel === LEVEL.FIRST) {
            // Load Level 1 assets
            this.bg.setTexture("background");
            this.bottom_platform.setTexture("platform_ground");
           
        } else if (this.currentLevel === LEVEL.SECOND) {
            // Load Level 2 assets
            this.bg.setTexture("background_2");
            this.bottom_platform.setTexture("platform_ground2");
            
        } else if (this.currentLevel === LEVEL.THIRD) {
            // Load Level 2 assets
            this.bg.setTexture("background_3");
            this.bottom_platform.setTexture("platform_ground3");
            // this.platforms.getChildren().forEach((platform) => platform.setTexture("platform2"));
        }
        
        else {
            console.error("Unexpected currentLevel in loadLevelAssets:", this.currentLevel);
        }
    }

    createBoss() {
        const bossDesiredHeight = this.game.config.height * 0.66;
        const bossOriginal = this.textures.get('enemy_boss').getSourceImage();
        const bossScaleFactor = bossDesiredHeight / bossOriginal.height;

        // Create the boss sprite
        this.boss = this.physics.add.sprite(
            this.finishPoint,
            0, // We will adjust Y below
            'enemy_boss'
        );

        this.boss.setScale(bossScaleFactor);
        this.boss.setOrigin(0.5, 1);
        this.boss.y = this.game.config.height - 50; // Position bottom at ground
        this.boss.setCollideWorldBounds(true);

        // Initialize boss properties
        this.boss.health = 12; // Restore health
        this.bossCurrentLives = 12;
        this.bossDefeated = false;

        // Create boss lives UI
        const heartSize = 24; // Pixel size of each heart icon
        const spacing = 4; // Spacing between hearts
        const totalWidth = this.bossCurrentLives * heartSize + (this.bossCurrentLives - 1) * spacing;
        const startX = this.scale.width / 2 - totalWidth / 2;
        const yPosition = 20; // 20px down from the top of the screen

        // Clear previous boss lives array
        this.bossLivesArray.forEach((heart) => heart.destroy());
        this.bossLivesArray = [];

        for (let i = 0; i < this.bossCurrentLives; i++) {
            const heart = this.add.image(
                this.boss.x + i * (heartSize + spacing) - ((this.bossCurrentLives * (heartSize + spacing)) / 2),
                this.boss.y - this.boss.displayHeight - 30, // A bit above boss's head
                'heart'
            )
                .setDisplaySize(heartSize, heartSize)
                .setScrollFactor(1) // Make them move with camera
                .setDepth(20); // Put it above most UI

            this.bossLivesArray.push(heart);
        }

        // Create boss fireball group
        this.bossFireballs = this.physics.add.group();

        // Register collider for boss and player interactions
        // this.physics.add.collider(this.boss, this.platforms);

        // this.physics.add.collider(this.boss, this.ground);
        // this.physics.add.overlap(this.player, this.bossFireballs, this.onPlayerHit, null, this);

        // Register one collider for “bullet touches boss”:
        // this.physics.add.collider(
        //     this.bullets,
        //     this.boss,
        //     this.onBulletBossCollision,
        //     null,
        //     this
        // );

        // Register one collider for “missile touches boss”:
        // this.physics.add.collider(
        //     this.missiles,
        //     this.boss,
        //     this.onMissileBossCollision,
        //     null,
        //     this
        // );

        console.log("Boss created successfully!");
    }

    bossAnimationStart() {
        // Clear existing animation safely
        if (this.bossAnimEvent) {
            this.bossAnimEvent.destroy();
            this.bossAnimEvent = null;
        }

        // Create the idle animation with optimized timing
        this.bossAnimEvent = this.time.addEvent({
            delay: 180,    // Animation speed (similar to walking)
            callback: () => {
                if (this.boss.leftLeg) {
                    // Left to Right transition
                    this.boss.leftLeg = false;
                    this.boss.rightLeg = true;

                    // Smooth idle animation with angle transition
                    this.tweens.add({
                        targets: this.boss,
                        angle: -5,
                        duration: 90,  // Half of delay for smooth transition
                        ease: 'Sine.easeInOut'
                    });

                    // Optional visual effects for idle animation (like glow or aura)
                    if (this.vfx) {
                        this.vfx.createEmitter(
                            'aura',
                            this.boss.x,
                            this.boss.y + this.boss.displayHeight / 2,
                            0.005, // Adjust particle density
                            0,     // Direction
                            30     // Particle count
                        ).explode(2);
                    }
                } else {
                    // Right to Left transition
                    this.boss.leftLeg = true;
                    this.boss.rightLeg = false;

                    // Smooth idle animation with angle transition
                    this.tweens.add({
                        targets: this.boss,
                        angle: 5,
                        duration: 90,  // Half of delay for smooth transition
                        ease: 'Sine.easeInOut'
                    });
                }
            },
            loop: true
        });
    }

    changeboss() {
        if (this.currentLevel === LEVEL.FIRST) {
            if (this.boss) {
                this.boss.setTint(0xB5EBF5); // Blue tint for boss in Level 1
            } else {
                console.error('Boss is undefined in changeboss.');
            }
        } else if (this.currentLevel === LEVEL.SECOND) {
            if (this.boss) {
                this.boss.setTint(0xff0000); // Red tint for boss in Level 2
            } else {
                console.error('Boss is undefined in changeboss.');
            }
        } else if (this.currentLevel === LEVEL.THIRD) {
            if (this.boss) {
                this.boss.setTint(0x00cfee); // Green tint for boss in Level 3
            } else {
                console.error('Boss is undefined in changeboss.');
            }
        } else {
            console.error('Unexpected level or state in changeboss.');
        }
    }

   

    fireTrackingFireball() {
                // Fireball spawn offset to simulate boss's mouth
                const mouthOffsetX = -150; // adjust depending on boss image
                const mouthOffsetY = -400;

                const fireball = this.bossFireballs.create(
                this.boss.x + mouthOffsetX,
                this.boss.y + mouthOffsetY,
                'enemy_boss_powrup'
                );

                fireball.setScale(0.25); // smaller fireball
                fireball.body.allowGravity = false;

                const direction = new Phaser.Math.Vector2(this.player.x - fireball.x, this.player.y - fireball.y).normalize();
                fireball.setVelocity(direction.x * this.bossFireballSpeed, direction.y * this.bossFireballSpeed);
    }


    showGameOverScreen() {
        console.log("Game Over logic triggered.");
        // Game over logic here
    }   
 
 
     onPlayerHit(player, fireball) {
        // 1) Destroy the fireball immediately
        fireball.destroy();

        // 2) Reduce player lives
        if (this.currentLives > 0) {
            this.currentLives--;
            this.livesArray[this.currentLives].setVisible(false);
            this.cameras.main.shake(200);
        }

        // 3) Check for “Game Over”
        if (this.currentLives === 0) {
            console.log("Game Over - No lives left");
            player.setTint(0xff0000);
            this.physics.pause();
            this.cameras.main.shake(200);
            this.sound.stopAll();
            this.sounds.lose.setVolume(0.2).setLoop(false).play();
            this.sounds.lose.on('complete', () => this.gameOver());
            return;
        }

        // 4) Handle power‐state downgrades when hit
        // ─────────────────────────────────────────────────────────────────
        // (a) If player was in MISSILE state → drop to SHIELD
        if (player.power_state === PLAYER_STATE.MISSILE) {
            player.power_state = PLAYER_STATE.SHIELD;


            // Re‐activate shield glow
            this.colorAnimation(true, player);

            // Dim missile icon
            this.missileIcon.setAlpha(0.3);

            // Unbind missile key (X), rebind Z to shoot bullets
            this.input.keyboard.off('keydown-Z', this.shootMissile, this);
            this.input.keyboard.on('keydown-Z', this.shootBullet, this);
        }

        // (b) If player was in SHIELD state and lives dropped below max → drop to BULLETS
        else if (player.power_state === PLAYER_STATE.SHIELD && this.currentLives < this.maxLives) {
            player.power_state = PLAYER_STATE.BULLETS;
            this.colorAnimation(false, player);       // remove shield glow
            this.shieldIcon.setAlpha(0.3);             // dim shield icon
            player.setTexture('player');               // revert to normal texture

            // Ensure Z shoots bullets
            this.input.keyboard.off('keydown-Z', this.shootMissile, this);
            this.input.keyboard.on('keydown-Z', this.shootBullet, this);
        }

        // (c) If player was in BULLETS state and lives == 5 → drop to BIG
        else if (player.power_state === PLAYER_STATE.BULLETS && this.currentLives === 5) {
            this.sounds.damage.setVolume(1).setLoop(false).play();
            this.colorAnimation(false, this.player);
            player.power_state = PLAYER_STATE.BIG;
            this.bulletIcon.setAlpha(0.3);

            // Brief “hit‐bounce” effect
            player.setAngularVelocity(-900);
            this.time.delayedCall(500, () => {
                player.setAngle(0);
                player.setAngularVelocity(0);
            });
        }

        // (d) If player was in BIG state and lives == 3 → drop to SMALL
        else if (player.power_state === PLAYER_STATE.BIG && this.currentLives === 3) {
            this.sounds.damage.setVolume(1).setLoop(false).play();
            player.power_state = PLAYER_STATE.SMALL;
            this.sizeIcon.setAlpha(0.3);
            this.colorAnimation(false, this.player);

            // Brief “hit‐bounce” effect and shrink tween (1.5× → 1×)
            player.setAngularVelocity(-900);
            this.time.delayedCall(500, () => {
                player.setAngle(0);
                player.setAngularVelocity(0);
            });
            this.tweens.add({
                targets: this.player,
                scaleX: this.player.scaleX / 1.5,
                scaleY: this.player.scaleY / 1.5,
                duration: 200,
                ease: 'Power1'
            });
        }
    }

   
    bindWalkingMovementButtons() {
        this.input.keyboard.on('keydown-RIGHT', this.walkingAnimationStart, this);
        this.input.keyboard.on('keydown-LEFT', this.walkingAnimationStart, this);
        this.input.keyboard.on('keyup-RIGHT', this.walkingAnimationStop, this);
        this.input.keyboard.on('keyup-LEFT', this.walkingAnimationStop, this);
        // For keyboard-based controls if needed
        if (this.joystickKeys) {
            this.joystickKeys.left.on('down', this.walkingAnimationStart, this);
            this.joystickKeys.right.on('down', this.walkingAnimationStart, this);
            this.joystickKeys.left.on('up', this.walkingAnimationStop, this);
            this.joystickKeys.right.on('up', this.walkingAnimationStop, this);
        }
    }

    walkingAnimationStart() {
        // Clear existing animation more safely
        if (this.animEvent) {
            this.animEvent.destroy();
            this.animEvent = null;
        }

        // Create the walking animation with optimized timing
        this.animEvent = this.time.addEvent({
            delay: 180,    // Slightly faster for more responsive feel (was 200)
            callback: () => {
                if (this.player.leftLeg) {
                    // Left to Right transition
                    this.player.leftLeg = false;
                    this.player.rightLeg = true;
                    
                    // Smoother angle transition
                    this.tweens.add({
                        targets: this.player,
                        angle: -5,
                        duration: 90,  // Half of delay for smooth transition
                        ease: 'Sine.easeInOut'
                    });

                    // Add dust effect when walking
                    if (this.vfx && this.player.body.touching.down) {
                        this.vfx.createEmitter(
                            'dust',
                            this.player.x - (this.player.flipX ? -10 : 10),
                            this.player.y + this.player.displayHeight / 3,
                            0.005,
                            this.player.flipX ? 180 : 0,
                            20
                        ).explode(1);
                    }
                } else {
                    // Right to Left transition
                    this.player.leftLeg = true;
                    this.player.rightLeg = false;
                    
                    // Smoother angle transition
                    this.tweens.add({
                        targets: this.player,
                        angle: 5,
                        duration: 90,  // Half of delay for smooth transition
                        ease: 'Sine.easeInOut'
                    });
                }
            },
            loop: true
        });
    }

    walkingAnimationStop() {
        this.player.setAngle(0);
        if(this.animEvent) this.animEvent.destroy();
    }

    spawnBricks(numOfBricks = 2, XOffset = 100, YOffset = 0) {
        if (!this.canSpawnEnemies) return;

        let y = this.game.config.height - this.ground.displayHeight - 215 - YOffset;
        let xStart = this.player.x + this.game.config.width / 2 + 100 + XOffset;
        const brickSpacing = this.brickSize + 5;

        for (let i = 0; i < numOfBricks; i++) {
            let x = xStart + i * brickSpacing;

            // Check for overlap with the boss
            if (this.boss) {
                let bossBounds = this.boss.getBounds();
                let brickBounds = new Phaser.Geom.Rectangle(x, y, this.brickSize, this.brickSize);
                if (Phaser.Geom.Intersects.RectangleToRectangle(brickBounds, bossBounds)) {
                    continue;
                }
            }

            // Check for overlap with existing bricks
            let brickBounds = new Phaser.Geom.Rectangle(x, y, this.brickSize, this.brickSize);
            let overlap = this.platforms.getChildren().some(platform => {
                let platformBounds = platform.getBounds();
                return Phaser.Geom.Intersects.RectangleToRectangle(brickBounds, platformBounds);
            });

            if (overlap) {
                continue;
            }

            // Create the main platform (brick)
            let platform = this.platforms.create(x, y, 'platform');
            platform.displayHeight = platform.displayWidth = this.brickSize;
            platform.refreshBody();

            // Add collectible logic (coins or mushrooms)
            let coinProbability = Phaser.Math.Between(1, 10) % 3 === 0;
            let mushroomProbability = Phaser.Math.Between(1, 10) % 5 === 0;

            if (coinProbability) {
                platform.setTexture("platform_1");
                platform.coin = Phaser.Math.Between(1, 5);
            } else if (mushroomProbability) {
                platform.setTexture("platform_1");
                platform.mushroom = 1;
            }

            // Re-apply tint after changing texture
            

            // Add an extra platform below if a collectible is present and YOffset > 0
            if (YOffset > 0 && (coinProbability || mushroomProbability)) {
                let firstRowY = this.game.config.height - this.ground.displayHeight - this.player.displayHeight - 100;
                let extraBrickBounds = new Phaser.Geom.Rectangle(x, firstRowY, this.brickSize, this.brickSize);
                let extraOverlap = this.platforms.getChildren().some(platform => {
                    let platformBounds = platform.getBounds();
                    return Phaser.Geom.Intersects.RectangleToRectangle(extraBrickBounds, platformBounds);
                });

                if (!extraOverlap) {
                    let extraBrick = this.platforms.create(x, firstRowY, 'platform');
                    extraBrick.displayHeight = extraBrick.displayWidth = this.brickSize;
                    extraBrick.refreshBody();
                   
                }
            }
        }
    }
    applyPlatformTint(platform) {
         console.log('Received platform:', platform);
        if (!platform) {
            console.error('Platform is undefined in applyPlatformTint.');
            return;
        }
        // Apply tint based on the current level
        if (this.currentLevel === LEVEL.FIRST) {
            this.platform.setTint(0x0000ff); // Blue tint for Level 1
        } else if (this.currentLevel === LEVEL.SECOND) {
            this.platform.setTint(0xff0000); // Red tint for Level 2
        } else if (this.currentLevel === LEVEL.THIRD) {
            this.platform.setTint(0x00ff00); // Green tint for Level 3
        } else {
            console.error('Unexpected level in applyPlatformTint.');
        }
    }


    hitBrick(player, brick) {
        if (player.body.touching.up && brick.body.touching.down) {
            this.sounds.stretch.setVolume(0.2).setLoop(false).play();

            this.tweens.add({
                targets: this.cameras.main,
                y: this.cameras.main.worldView.y - 5,
                duration: 50,
                ease: 'Power1',
                yoyo: true,
                repeat: 0
            });
            this.tweens.add({
                targets: brick,
                y: brick.y - 10,
                duration: 50,
                ease: 'Linear',
                yoyo: true
            });
            if (brick.mushroom) {
                delete brick.mushroom;
                // Revert brick texture back to normal platform after power-up is collected
                brick.setTexture("platform");
                let powerUp = this.powerUps.create(brick.x, brick.y - 70, 'collectible').setScale(0.3);
                this.tweens.add({
                    targets: powerUp,
                    scaleY: 0.14,
                    scaleX: 0.14,
                    duration: 300,
                    ease: 'Power1',
                    onComplete: () => {
                        powerUp.setVelocityX(50);
                    }
                });
            }
            
            if (brick.coin) {
                brick.coin--;
                this.sounds.collect.setVolume(0.2).setLoop(false).play();

                this.updateScore(1);
                if (!brick.coin) {
                    // Revert brick texture back to normal platform when coins run out
                    brick.setTexture("platform");
                }
                let powerUp = this.powerUps.create(brick.x, brick.y - brick.displayHeight, 'collectible_coin').setScale(0.2);
                this.tweens.add({
                    targets: powerUp,
                    scaleY: 0.07,
                    scaleX: 0.07,
                    duration: 200,
                    ease: 'Power1',
                    yoyo: true,
                    onComplete: (tween, targets) => {
                        targets[0].destroy();
                    },
                });
            }
        }
    }

   spawnEnemy() {
        if (!this.canSpawnEnemies) return;

            // Enemy spawn logic
            let x = this.player.x + this.game.config.width; // Spawn in front of the player
            let fixedY = 400; // Set the enemy's fixed y-axis spawn position (adjust as needed)
            let enemy = this.enemies.create(x, fixedY, 'enemy').setScale(0.18);
            this.applyEnemyTint(enemy);

            // Adjust enemy speed based on player's power state
            let speed = -150;
            if (this.player.power_state === PLAYER_STATE.BIG) {
                speed = -200;
            } else if (this.player.power_state === PLAYER_STATE.BULLETS) {
                speed = -250;
            }
            enemy.setVelocityX(speed);
            enemy.setGravityY(100);
            enemy.setBounceX(1);
            enemy.body.setSize(enemy.width * 0.8, enemy.height * 0.7);
            enemy.body.setOffset(enemy.width * 0.2, enemy.height * 0.1);

            // Start walking animation
            this.startEnemyWalkAnimation(enemy);
          
    }

    applyEnemyTint(enemy) {
        // Apply tint based on the current level
        if (this.currentLevel === LEVEL.FIRST) {
            enemy.setTint(0x00ff00); // Green tint for Level 1
        } else if (this.currentLevel === LEVEL.SECOND) {
            enemy.setTint(0xff0000); // Red tint for Level 2
        } else if (this.currentLevel === LEVEL.THIRD) {
            enemy.setTint(0x00cfee); // Blue tint for Level 3
        } else {
            console.error('Unexpected level in applyEnemyTint.');
        }
    }

    // Helper function: Shoot lava ball
    shootLavaBall(enemy, target) {
        const lavaBall = this.physics.add.sprite(enemy.x, enemy.y, 'enemy_projectile2');
        lavaBall.setScale(0.2); // Reduce size
        lavaBall.setVelocityX(-300); // Adjust speed
        lavaBall.setBounce(1); // Allow bouncing off surfaces
        lavaBall.setCollideWorldBounds(true); // Prevent leaving the game area

        // Add collider with ground and platforms
        this.physics.add.collider(lavaBall, this.ground,()=>{
            this.vfx.createEmitter(
                'spark', 
                lavaBall.x, 
                lavaBall.y, 
                0.05, 
                0, 
                100
            ).explode(20);
        });
        this.physics.add.collider(lavaBall, this.platforms,()=>{
            this.vfx.createEmitter(
                'spark', 
                lavaBall.x, 
                lavaBall.y, 
                0.05, 
                0, 
                100
            ).explode(20);
        });

        // Destroy lava ball if it leaves the world bounds
        this.physics.world.on('worldbounds', (body) => {
            if (body.gameObject === lavaBall) {
                lavaBall.destroy();
            }
        });

        // Collider with player
        this.physics.add.collider(lavaBall, target, () => {
           this.vfx.createEmitter({
                texture: 'fireTrail',
                x: target.x,
                y: target.y,
                scale: { start: 0.5, end: 0.1 },
                speed: { min: 200, max: 400 },
                lifespan: 800,
                blendMode: 'ADD',
                gravityY: -200,
                tint: [0xff4500, 0xff6347] // Bright red and orange for fire effects
            }).explode(50);
           this.currentLives--;
            this.updateLivesDisplay();
            this.cameras.main.shake(200); // Reduce player health
            lavaBall.destroy(); // Destroy lava ball after hit
                if (this.currentLives === 0) {
                console.log("Game Over - No lives left");
                target.setTint(0xff0000);
                this.physics.pause();
                this.cameras.main.shake(200);
                this.sound.stopAll();
                this.sounds.lose.setVolume(0.2).setLoop(false).play();
                this.sounds.lose.on('complete', () => this.gameOver());
                return;
            }
        });
    }

    // Helper function: Shoot snowball
    shootSnowBall(enemy, target) {
        const snowBall = this.physics.add.sprite(enemy.x, enemy.y, 'enemy_projectile1');
        snowBall.setScale(0.2); // Reduce size
        snowBall.setVelocityX(-300); // Adjust direction and speed
        snowBall.setCollideWorldBounds(true); // Prevent leaving the game area

        // Add collider with ground and platforms
        this.physics.add.collider(snowBall, this.ground, () => {
            this.vfx.createEmitter(
                'snowflake', 
                snowBall.x, 
                snowBall.y, 
                0.05, 
                0, 
                100
            ).explode(20);});
        this.physics.add.collider(snowBall, this.platforms, () => {
            this.vfx.createEmitter(
                'snowflake', 
                snowBall.x, 
                snowBall.y, 
                0.05, 
                0, 
                100
            ).explode(20);});

        // Destroy snowball if it leaves the world bounds
        this.physics.world.on('worldbounds', (body) => {
            if (body.gameObject === snowBall) {
                snowBall.destroy();
            }
        });

        // Collider with player
        this.physics.add.collider(snowBall, target, () => {
            
             this.vfx.createEmitter({
                texture: 'icyBurst',
                x: target.x,
                y: target.y,
                scale: { start: 0.8, end: 0.2 },
                speed: { min: 100, max: 300 },
                lifespan: 1000,
                blendMode: 'ADD',
                gravityY: 0,
                tint: [0x00ffff, 0xadd8e6] // Light blue and cyan for icy effects
            }).explode(40);
            this.freezePlayer(target); // Freeze the player
            snowBall.destroy(); // Destroy snowball after hit
        });
    }

    // Helper function: Freeze player
    freezePlayer(player) {
        player.isFrozen = true; // Set frozen state
        player.setVelocity(0); // Stop movement
        player.setTint(0x00ffff); // Add visual effect (blue tint)

        this.time.delayedCall(this.freezeDuration, () => {
            player.isFrozen = false; // Unfreeze player
            player.clearTint(); // Remove visual effect
        });
    }


    startEnemyWalkAnimation(enemy) {
        enemy.animEvent = this.time.addEvent({
            delay: 180,
            callback: () => {
                if (!enemy.body || !enemy.body.velocity.x) return;

                if (enemy.leftLeg) {
                    enemy.leftLeg = false;
                    enemy.rightLeg = true;

                    this.tweens.add({
                        targets: enemy,
                        angle: -5,
                        duration: 90,
                        ease: 'Sine.easeInOut'
                    });

                    if (this.vfx && enemy.body.touching.down) {
                        this.vfx.createEmitter(
                            'dust',
                            enemy.x - (enemy.flipX ? -10 : 10),
                            enemy.y + enemy.displayHeight / 3,
                            0.005,
                            enemy.flipX ? 180 : 0,
                            20
                        ).explode(1);
                    }
                } else {
                    enemy.leftLeg = true;
                    enemy.rightLeg = false;

                    this.tweens.add({
                        targets: enemy,
                        angle: 5,
                        duration: 90,
                        ease: 'Sine.easeInOut'
                    });
                }
            },
            loop: true
        });
    }
    
    blinkEffect(object = this.powerUpText, duration = 300, blinks = 3) {
        if (this.blinkTween) this.blinkTween.stop();
        object.setAlpha(0);
        this.blinkTween = this.tweens.add({
            targets: object,
            alpha: 1,
            duration: duration,
            yoyo: true,
            repeat: blinks - 1,
            ease: 'Power1',
            onComplete: () => {
                object.setAlpha(0);
            },
            onStop: () => {
                object.setAlpha(0);
            }
        });
    }


    updateLivesDisplay() {
        for (let i = 0; i < this.maxLives; i++) {
            this.livesArray[i].setVisible(i < this.currentLives);
        }
    }

    collectPowerUp(player, powerUp) {
        powerUp.destroy();
        if (player.power_state === PLAYER_STATE.SMALL && this.currentLives >= 3 ) {
            this.powerUpText.text = "SIZE POWER UP";
            this.blinkEffect(this.powerUpText, this.scale.width/2, 5);
            player.power_state++;
            this.sizeIcon.setAlpha(1);
             this.currentHealth = 150;
            // When collecting the size power-up:
            this.sounds.upgrade_1.setVolume(0.1).setLoop(false).play();

            // When collecting the bullet power-up:
            this.sounds.upgrade_2.setVolume(0.001).setLoop(false).play();

            
            
            // Bullet icon remains inactive until next stage
            this.bulletIcon.setAlpha(0.3);

            // Multiply the current dimensions by a factor (e.g., 1.5x increase)
            this.tweens.add({
                targets: this.player,
                y: player.y - 30,
                scaleX: this.player.scaleX * 1.5,
                scaleY: this.player.scaleY * 1.5,
                duration: 100,
                ease: 'Power1',
                onComplete: () => {
                // ─── GROW VFX: emit a quick burst at the player's torso ───
                this.vfx.createEmitter(
                    'enemy',  // any particle texture you like (e.g. a glow or spark)
                    this.player.x,
                    this.player.y,
                    0.01, 0,
                    400
                ).explode(20);
             }
            });
            // ── NEW: give 2 extra lives, clamp to max
           
                this.currentLives = Math.min(this.currentLives + 2, this.maxLives);
                this.updateLivesDisplay();
            
        } 
        
        else if (player.power_state === PLAYER_STATE.BIG && this.currentLives >= 5 ) {
            this.powerUpText.text = "BULLET POWER UP";
            this.blinkEffect(this.powerUpText, 200, 5);
            player.power_state++;
            this.bulletIcon.setAlpha(1);
             player.setTexture('player_bullet');
            this.sounds.upgrade_2.setVolume(1).setLoop(false).play();
            this.input.keyboard.on('keydown-Z', this.shootBullet, this);
           

            this.currentLives = Math.min(this.currentLives + 1, this.maxLives);
            this.updateLivesDisplay();
        } 

        // 3) BULLETS → SHIELD
        else if (player.power_state === PLAYER_STATE.BULLETS) {
            this.powerUpText.text = "SHIELD ACTIVATED";
            this.blinkEffect(this.powerUpText, this.scale.width / 2, 5);

            player.power_state = PLAYER_STATE.SHIELD;
            this.shieldIcon.setAlpha(1);
            this.colorAnimation(true, this.player);
            this.input.keyboard.on('keydown-Z', this.shootBullet, this);

            this.currentLives = Math.min(this.currentLives + 1, this.maxLives);
            this.updateLivesDisplay();
        }

        // 4) SHIELD → MISSILE
        else if (player.power_state === PLAYER_STATE.SHIELD) {
            this.powerUpText.text = "MISSILE POWER UP";
            this.blinkEffect(this.powerUpText, this.scale.width / 2, 5);
            this.missileCount = 5;
            this.updateMissileCount();

            player.power_state = PLAYER_STATE.MISSILE;

            // Activate the missile icon, dim the shield icon
            this.missileIcon.setAlpha(1);

            // Bind Z to shoot missiles instead of bullets
            this.input.keyboard.off('keydown-Z', this.shootBullet, this);
            this.input.keyboard.on('keydown-Z', this.shootMissile, this);

            // Give +1 life (clamp to 8)
            this.currentLives = Math.min(this.currentLives + 1, this.maxLives);
            this.updateLivesDisplay();
        }

        else if (player.power_state === PLAYER_STATE.MISSILE) {
            if (this.missileCount === 0) {
                this.updateMissileCount();
                 this.input.keyboard.on('keydown-Z', this.shootBullet, this);
                this.input.keyboard.off('keydown-Z', this.shootMissile, this);
            } else {
                // Add 5 missiles
                this.missileCount += 5;
                this.updateMissileCount()
                 this.input.keyboard.off('keydown-Z', this.shootBullet, this);
                this.input.keyboard.on('keydown-Z', this.shootMissile, this);
                
            }
            this.powerUpText.text = "MISSILES +5";
            this.blinkEffect(this.powerUpText, this.scale.width / 2, 5);
        }
        else {
            this.currentLives++;
            this.updateLivesDisplay(); 
            this.updateScore(10);
        }
    }

    colorAnimation(startColorAnimation, obj) {
        if (!startColorAnimation && this.colorAnimEvent) {
            this.colorAnimEvent.destroy();
            obj.setTint(0xffffff);
            return;
        }

        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        let currentIndex = 0;

        // Change color every 100 milliseconds
        this.colorAnimEvent = this.time.addEvent({
            delay: 100,
            callback: () => {
                obj.setTint(colors[currentIndex]);
                currentIndex++;
                if (currentIndex >= colors.length) {
                    currentIndex = 0;
                }
            },
            loop: true
        });
    }


    enableMissiles(count) {
         this.missileCount = count;
        this.missileIcon.setAlpha(1);

        // Update the missile count text
        this.updateMissileCount();

        // Rebind Z to shoot missiles instead of bullets
        this.input.keyboard.off('keydown-Z', this.shootBullet, this);
        this.input.keyboard.on('keydown-Z', this.shootMissile, this);
    }

    disableMissiles() {
         this.missileIcon.setAlpha(0.3);

        // Hide the missile count text when missiles are disabled
        this.missileCountText.setText(0);

        // Rebind Z to shoot bullets instead of missiles
        this.input.keyboard.off('keydown-Z', this.shootMissile, this);
        this.input.keyboard.on('keydown-Z', this.shootBullet, this);
    }

    updateMissileCount() {
        this.missileCountText.setText(`${this.missileCount}`);
    }

    shootMissile() {

         if (this.missileCount > 0) {
        // Existing missile shooting logic...
        this.missileCount -= 1;

        this.updateMissileCount();

            // 1) Get an inactive missile from the group
            const xOffset = this.player.flipX ? -20 : +20;
            const spawnX  = this.player.x + xOffset;
            const spawnY  = this.player.y;

            const missile = this.missiles.get(spawnX, spawnY, 'missile');
            if (!missile) return; // no free missile available

            missile.enableBody(true, spawnX, spawnY, true, true);

            // 2) Activate & position it
            missile.setActive(true);
            missile.setVisible(true);
            missile.body.allowGravity = false; // so it flies straight

            // 3) Scale & rotation
            missile.setScale(0.25);
            missile.setAngle(this.player.flipX ? 180 : 0);

            // 4) Launch velocity
            const speed = 400;
            missile.setVelocityX(this.player.flipX ? -speed : speed);

            // 5) Automatically destroy after 2 seconds if it hasn’t already hit
            this.time.delayedCall(2000, () => {
                if (missile.active) missile.destroy();
            });

             if (this.missileCount === 0) {
                this.disableMissiles();
            }

        }
    }

    shootBullet() {
        if (this.player.power_state >= 2) {
            this.sounds.shoot.setVolume(0.2).setLoop(false).play();
            let bullet = this.bullets.get(this.player.x, this.player.y);
            if (bullet) {
                bullet.setActive(true)
                      .setVisible(true)
                      .setScale(0.08)
                      .setVelocityX(this.player.leftShoot ? -300 : 300)
                      .setVelocityY(-200)            // Initial upward velocity for bounce effect
                      .setCollideWorldBounds(true);  // Enable collision with the world bounds
                bullet.body.setBounce(0.8);         // Bounce value (adjust this value to increase or decrease the bounce)
                // Removed the delayedCall so the bullet bounces indefinitely until destroyed
            }
        }
    }
    
    bulletHit(bullet, enemy) {
        this.sounds.destroy.setVolume(0.2).setLoop(false).play();

        bullet.setActive(false);
        bullet.setVisible(false);
        bullet.body.stop();

        this.blueEmitter = this.vfx.createEmitter('enemy', enemy.x, enemy.y, 0.01, 0, 600);
        this.blueEmitter.explode(300);
        enemy.destroy();
        
        bullet.setActive(false);
        bullet.setVisible(false);
        bullet.body.enable = false;

        this.updateScore(1);
    }

    updateBossLivesDisplay() {
        for (let i = 0; i < this.bossMaxLives; i++) {
            this.bossLivesArray[i].setVisible(i < this.bossCurrentLives);
        }   
    }

    onBulletBossCollision(boss, bullet) {
        bullet.destroy(); // Only destroy bullet
        this.updateBossLivesDisplay();

        this.bossCurrentLives--;

       this.bossCurrentLives = Math.max(this.bossCurrentLives, 0); // Prevent negative lives
        if (this.bossCurrentLives <= 0 && !this.bossDefeated) {
            this.bossDefeated = true; // Set bossDefeated to true
            this.onBossDefeated();   // Handle boss defeat
        }
    }

    onMissileBossCollision(boss, missile) {
        missile.destroy(); // Only destroy missile

        this.bossCurrentLives -= 2;
        this.updateBossLivesDisplay();

       this.bossCurrentLives = Math.max(this.bossCurrentLives, 0); // Prevent negative lives
        if (this.bossCurrentLives <= 0 && !this.bossDefeated) {
            this.bossDefeated = true; // Set bossDefeated to true
            this.onBossDefeated();   // Handle boss defeat
        }
        
    }

    // New function to handle level transition
    transitionToNextLevel() {
        console.log("Boss defeated! Transitioning to Level 2...");
        this.scene.start('Level2'); // Replace 'Level2' with the actual key for your Level 2 scene
    }

    onPlayerEnemyCollision(player, enemy) {
        if (player.body.touching.down && enemy.body.touching.up) {
            // Play stomp sound
            this.sounds.destroy.setVolume(0.2).setLoop(false).play();

            // Bounce the player upward (adjust this value as desired)
            player.setVelocityY(-300);

            // Adjustable parameters for enemy movement:
            const ENEMY_BOUNCE_UP = 20;     // How far enemy moves up when stomped
            const ENEMY_FALL_DISTANCE = 150; // How far enemy falls down before destruction

            // First tween: enemy bounces upward
            this.tweens.add({
                targets: enemy,
                y: enemy.y - ENEMY_BOUNCE_UP,
                duration: 200,
                ease: 'Power1',
                onComplete: () => {
                    // Second tween: enemy falls down and then is destroyed
                    this.tweens.add({
                        targets: enemy,
                        y: enemy.y + ENEMY_FALL_DISTANCE,
                        duration: 300,
                        ease: 'Bounce.easeOut',
                        onComplete: () => {
                            enemy.destroy();
                        }
                    });
                }
            });
        }  
        else {
             if (this.currentLives > 0) {
            this.currentLives--;
            this.livesArray[this.currentLives].setVisible(false);
            this.cameras.main.shake(200);
            enemy.destroy();
             }
            // 2) GAME OVER?
            if (this.currentLives === 0) {
                console.log("Game Over - No lives left");
                player.setTint(0xff0000);
                this.physics.pause();
                this.cameras.main.shake(200);
                this.sound.stopAll();
                this.sounds.lose.setVolume(0.2).setLoop(false).play();
                this.sounds.lose.on('complete', () => this.gameOver());
                return;
            }
            this.input.keyboard.off('keydown-SPACE', this.shootBullet, this);
             if (player.power_state === PLAYER_STATE.MISSILE) {
                player.power_state = PLAYER_STATE.SHIELD;

                // Re‐activate shield VFX (if desired). If you want the shield glow to persist after downgrade:
                this.colorAnimation(true, player);

                // Update icons
                this.missileIcon.setAlpha(0.3);

                // Rebind Z to shoot bullets instead of missiles
                this.input.keyboard.off('keydown-Z', this.shootMissile, this);
                this.input.keyboard.on('keydown-Z', this.shootBullet, this);
                
                }

                // 3) If in SHIELD → revert to BULLETS, destroy enemy, no life lost
                if (player.power_state === PLAYER_STATE.SHIELD && this.currentLives < 6) {
                 player.power_state = PLAYER_STATE.BULLETS;
                this.colorAnimation(false, player); // remove shield glow
                this.shieldIcon.setAlpha(0.3);
                player.setTexture('player');
               

                // Ensure Z fires bullets
                this.input.keyboard.off('keydown-Z', this.shootMissile, this);
                this.input.keyboard.on('keydown-Z', this.shootBullet, this);      
                }

            if (player.power_state === PLAYER_STATE.BULLETS  && this.currentLives == 5) {
                this.sounds.damage.setVolume(1).setLoop(false).play();
                this.colorAnimation(false, this.player);
                player.power_state--;
                this.bulletIcon.setAlpha(0.3);
                player.setAngularVelocity(-900);
                this.time.delayedCall(500, () => {
                    player.setAngle(0);
                    player.setAngularVelocity(0);
                });
              
            } 
           if (this.currentLives === 3 && player.power_state === PLAYER_STATE.BIG) {
                this.sounds.damage.setVolume(1).setLoop(false).play();
                player.power_state--;
                 this.sizeIcon.setAlpha(0.3);
                this.colorAnimation(false, this.player);
                player.setAngularVelocity(-900);
                this.time.delayedCall(500, () => {
                    player.setAngle(0);
                    player.setAngularVelocity(0);
                });
                this.tweens.add({
                    targets: this.player,
                    scaleX: this.player.scaleX / 1.5,
                    scaleY: this.player.scaleY / 1.5,
                    duration: 200,
                    ease: 'Power1'
                });
               
            } 
            
        }
    }

    setupMobileScaling() {
    // Adjust background scaling
    this.background.setDisplaySize(this.scale.width, this.scale.height);

    // Scale and position distance bar
    if (this.distanceBar && this.distanceBarFill && this.distanceAvatar) {
        this.distanceBar.setScale(0.8).setPosition(this.scale.width / 2, 30); // Top center
        this.distanceBarFill.setScale(0.8);
        this.distanceAvatar.setScale(0.8);
    }

    // Scale and position icons and avatar
    const iconSpacing = 50; // Space between icons
    const avatarStartX = 20; // Start position for avatar
    const avatarStartY = 30; // Position for icons and avatar group

    if (this.avatar) {
        this.avatar.setScale(0.8).setPosition(avatarStartX, avatarStartY);
    }

    if (this.iconBullet) {
        this.iconBullet.setScale(0.8).setPosition(avatarStartX + iconSpacing, avatarStartY);
    }

    if (this.iconShield) {
        this.iconShield.setScale(0.8).setPosition(avatarStartX + iconSpacing * 2, avatarStartY);
    }

    if (this.iconMissile) {
        this.iconMissile.setScale(0.8).setPosition(avatarStartX + iconSpacing * 3, avatarStartY);
    }

    // Scale and position coin and score
    const scoreX = this.scale.width - 100; // Top right corner
    const scoreY = 30;

    if (this.coin) {
        this.coin.setScale(0.8).setPosition(scoreX - 50, scoreY);
    }

    if (this.scoreText) {
        this.scoreText.setFontSize(24).setPosition(scoreX, scoreY); // Adjust font size and position
    }

    // Scale and position hearts (health)
    const heartSpacing = 30; // Space between hearts
    const heartStartX = this.scale.width / 2 - 100; // Centered horizontally
    const heartY = this.scale.height - 50; // Bottom center

    if (this.bossLivesArray) {
        this.bossLivesArray.forEach((heart, index) => {
            heart.setDisplaySize(20, 20).setPosition(heartStartX + heartSpacing * index, heartY);
        });
    }

    console.log('Mobile scaling applied successfully!');
}


    createMobileButtons() {
        // Remove joystick and add left/right buttons on bottom left
        // Left button
        this.leftButton = this.add.rectangle(80, this.height - 60, 100, 100, 0xcccccc, 0.5)
            .setScrollFactor(0)
            .setInteractive();
        // Right button
        this.rightButton = this.add.rectangle(200, this.height - 60, 100, 100, 0xcccccc, 0.5)
            .setScrollFactor(0)
            .setInteractive();

        // Set up pointer events to toggle movement flags
        this.leftButton.on('pointerdown', () => { this.leftPressed = true; });
        this.leftButton.on('pointerup', () => { this.leftPressed = false; });
        this.leftButton.on('pointerout', () => { this.leftPressed = false; });

        this.rightButton.on('pointerdown', () => { this.rightPressed = true; });
        this.rightButton.on('pointerup', () => { this.rightPressed = false; });
        this.rightButton.on('pointerout', () => { this.rightPressed = false; });

        // Also create the standard mobile buttons on the bottom right
        if (buttonEnabled) {
            this.buttonA = this.add.rectangle(this.width - 60, this.height - 60, 100, 100, 0xcccccc, 0.5);
            this.buttonA.button = this.plugins.get('rexbuttonplugin').add(this.buttonA, {
                mode: 1,
                clickInterval: 10,
            });
            this.buttonA.setDepth(11).setScrollFactor(0);
            this.buttonB = this.add.circle(this.width - 60, this.height - 220, 60, 0xcccccc, 0.5);
            this.buttonB.button = this.plugins.get('rexbuttonplugin').add(this.buttonB, {
                mode: 1,
                clickInterval: 5,
            });
            this.buttonB.setDepth(11).setScrollFactor(0);
            this.buttonB.button.on('down', this.shootBullet, this);
        }
        // Hide any joystick if present
        if (this.joyStick) {
            this.joyStick.destroy();
        }
        // Toggle controls visibility if needed
        this.toggleControlsVisibility(isMobile);
    }

    toggleControlsVisibility(visibility) {
        // For mobile, our buttons are always visible; if needed, you can hide them via this method.
        if(this.leftButton) this.leftButton.visible = visibility;
        if(this.rightButton) this.rightButton.visible = visibility;
        if(this.buttonA) this.buttonA.visible = visibility;
        if(this.buttonB) this.buttonB.visible = visibility;
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(this.score);
    }

    gameOver() {
        this.sound.stopAll();
        // this.scene.stop();
        initiateGameOver.bind(this)( {
            meter: this.meter,
            coins: this.score,
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
    this.load.on('fileprogress', function (file) {});
    this.load.on('complete', function () {
        progressBar.destroy();
        progressBox.destroy();
        loadingText.destroy();
    });
}

// Configuration object
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
    /* ADD CUSTOM CONFIG ELEMENTS HERE */
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 300 },
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