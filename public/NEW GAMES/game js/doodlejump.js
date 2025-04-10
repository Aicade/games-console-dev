// Touch Screen Controls Configuration
const joystickEnabled = false; // Disabled as Doodle Jump only needs left/right
const buttonEnabled = true;    // Buttons for left/right movement
const hideButtons = true;      // Hide buttons on desktop
var isMobile = false;

// Button Plugin URL (Joystick not needed)
const rexButtonUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexbuttonplugin.min.js";

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    /** Initialize game variables */
    init() {
        this.cursors = null;
        this.player = null;
        this.platforms = null;
        this.springGroup = null;
        this.enemies = null;           // Group for enemies
        this.bullets = null;           // Group for bullets
        this.jetpacks = null;          // Group for jetpack power-ups
        this.scoreText = null;
        this.score = 0;
        this.highestY = 0;
        this.startingY = 0;
        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.leftPressed = false;
        this.rightPressed = false;
        this.enemySpeed = 100;         // Decreased enemy movement speed
        this.jetpackActive = false;    // Flag for jetpack power-up active
        this.defaultPlayerTexture = 'player'; // Store default texture
        this.defaultPlayerScale = 0.15;         // Constant default player scale

        // We'll store the player's default body size after creation
        this.defaultBodyWidth = 0;
        this.defaultBodyHeight = 0;

        // These variables allow manual adjustment of the jetpack player's hitbox size.
        this.jetpackBodyWidth = 0;  // will be set after default body size is known
        this.jetpackBodyHeight = 0;
    }

    /** Load game assets */
    preload() {
        // Images
        this.load.image("background", "https://media-hosting.imagekit.io/b05597d822ca443d/doodle%20jump%20bg.png?Expires=1838481515&Key-Pair-Id=K2ZIVPTIP2VGHC&Signature=YEdKXBGhyjeyKsL4Zk2jr0lm0ds05805WAQIgYpoVyERQ~q~nAHC4VTDyGunRgoAWgxaMRxuDn9ML7Dhjh~CURkleEmiwROvsiAqcVsbOrIx5cnOyp61Bt-Hyzt5fMSd09CrRbY9jLur1zhmN-1yoVNvdwr6Is7bnXwoxvXKUBC63r2W7GCEmA1OquXhJZE2As1uPkXLLyfzEZOptw0ShzOaQZAKrpXb1kRNED0vY5QGzyLfIcPOStZM4LfHaYQYDPEyJe7WI0twPa3AbZK-BwfuIE-UMgwm~72I0Oosh3jDMebaA2iv4wDvyvHGRWgBVIJSzWNPV~jtHmI43dNd5g__");
        this.load.image("player", "https://media-hosting.imagekit.io/0031c94e870b496a/doodle%20player.png?Expires=1838481776&Key-Pair-Id=K2ZIVPTIP2VGHC&Signature=Sfb6QaADXADnaKKB8fyatqV2pZSiDmr31yNQ1~DHeQeOyXbZu5vs3jme4B2~MOzL9wIuWY65r698BXIm~x94dwQmtZmlnrvC-lFuo9D-UrMsbyduUZ0rvKeQh3NfiwycCVKVoWb4CMrWbNYzA1omCRyWRDk9CgmTdy2ml5EqbBvSfWZTSkfaEE7Abgz7Hg0dO9NeBOkEeZSjiq45t5-ytxYM0IOT9FYsMXQegna~iTtZnyBBVAwRQb1yfpboCuttgLCkqNi0ekvebD0jpthRj92eHD-~B7qeaJHWmPXvhz3M02CXbZNZAZv0mqmoraPHghBdEm7u3XgndDS-l3J0ag__");
        // Shooting player asset (for shooting animation)
        this.load.image("playerShoot", "https://media-hosting.imagekit.io/d011f005d76147b9/doodle%20shoot-Photoroom.png?Expires=1838487463&Key-Pair-Id=K2ZIVPTIP2VGHC&Signature=vtxT36LnswSCm2w8hIfCUR4~s1ZtUVcTWJiyNFkjf2rT5qD3gDZgqLheBge0-~VD~GLM6WhgNUk5Dc8-~yc56JGIL~E~f0Vp0Fdj32SRqE5fZql-8SN3Y5-WZ0EuyRYYWQktbcsq6WrvBlBXwLDnvgPu0CpiZor31-Rh7THThDi-oeEjD6n5jaWh9Hep4krvRul9EE5IU8j0GBgpyWi63LEIawBoYj0L~DjB0fRJKU2IEbtvf5NCNXJMJCxVpcoNuLc1JTqe-aPGtIFImcMIppztRA00hq0p0pSv~kNchYNS8GqUXr0ybhDqDG5FGscoS6Ek2pjrv0TCPE8UuQcrNHayERTR3WE-1V1~Lj5zOQOKDc24O3Y3-aUY3IY7Rs9-TrvmChoh90I-Yd9fb3tZewLRRiNat8q0IW7X4ECTa3SMuMsy~jUqtPjPJCUCQyV3ghFzRwKIUQiWScNJJFGHoRrrjCgTrRf3silAPiMo8UDN-I2JnJdj06N8qzBM5m2iWvf4s4eY2adxs1L7F-2YXL17mOBWX3S2qoJqpWb56ApjT9Gbb~KvWLy8S4xZ8rh9PB18f1QEhw1Jus7ZVwaL1Kywo6rWUvNxaHcgmRK81Dr-N57GRPHKroWAw__");
        this.load.image("platform", "https://aicade-user-store.s3.amazonaws.com/1334528653/games/1EfhKOphiHv3PzOw/assets/images/Screenshot%202025-04-02%20233410.png?t=1743617599903");
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
        this.load.bitmapFont('pixelfont', "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.png", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.xml");
        // Spring asset preload
        this.load.image("spring", "https://media-hosting.imagekit.io/37dc26cf68b34417/doodle%20spring-Photoroom.png?Expires=1838483294&Key-Pair-Id=K2ZIVPTIP2VGHC&Signature=iFlchJbYKM610zgKXkwr-EgZIY4MyU~4FHpQNSrMxUxjA4nRs801Idr7txNfsDtOqZW~Ti2Zy~pcKYiAWOkNP7YRS4q8PnftXWUfmjLPSa-8e~RC75IDo3wwSRbvpvtWZfalEHL62fGMk5qITdz8WbqIrkiAYQpfnBYjdMre-i06TF0N6hNkI7NdieXRBjDvParwwB12S-LZeTiCT~cPX8s38lEIAWEnzYvwRdqlYfQGYjtlbcPZvYXS1fEI065IqZQKrmLVlJDp0VmXwFc5CutLbBVNC89KXYUPggiMbFeHKSxeXNT1C0iwgEcSDOBQe78lwj3FnYUsiMQ28MD0sA__");
        // Crack asset preload (used for cracked platforms)
        this.load.image("crack", "https://aicade-user-store.s3.amazonaws.com/1334528653/games/1EfhKOphiHv3PzOw/assets/images/Screenshot%202025-04-02%20233422.png?t=1743617757767");
        // Enemy asset preload
        this.load.image("enemy", "https://media-hosting.imagekit.io/edf067be557a4ce8/doodle%20enemy-Photoroom.png?Expires=1838486361&Key-Pair-Id=K2ZIVPTIP2VGHC&Signature=EteowRmUAz0axmZI2KHXiRF1R0gcqUlGklhVAQk5h~KESqggfpPVyvGM~v8nR3bPgr8qFuAFz8l5vAvBN8hQUBRdIgIJhOi-DVTaxyrrckZur929BfFCeB~3kWE2elieydEK4cGcac13aJaE5yfvuGbRMxL1IMyweJN4rz-KXwJQNdAHvdTo~7-VMI7DBrOVoHkw4bqrs7l1NHftgx2fAfnTwfGvqsqcAcr0pvKWWLEvBOcR2KzblJhpu53LPZ9QriLkpW5D-~cS7H~AJkQuCvcrIEiySYtCXvqSFd2u7Z4853AVx8QxktBaIYafQn~4ExsUEoRlFJcZpZPc23V-XA__");
        // NEW: Load jetpack asset for power-up (to spawn on platform)
        this.load.image("jetpack", "https://media-hosting.imagekit.io/047fede0ca4e43b5/doodle_jetpack-removebg-preview.png?Expires=1838530428&Key-Pair-Id=K2ZIVPTIP2VGHC&Signature=DaaBGJRc~FBibzYTsmJZkGOtcNL6Ygwze-EboUo6NB25YGplSx3CGvyDZxeyN76VTWkf50J43LhB7tr4CMdNh4qdkGw4fjjfkdLlglpAYjy4XNUrgjzbYVB6peasAF7sHMB5qOERWmqxCSyMbwETZfiCfQhflpAl2y-J4fYCrRPrBXrPdyKmi8HMUWnNfa20K7qORYq0gEH6yV5kxpIZhqSlJvCA9v-klvXiQCHRL-7eeXGe2s5xnJJAdxjOl9MvpI839kCBcbg~MNpNlfJEC7pXwjnkFROdwv~8UaGXaOw3dKRgd9gpLyFns~L0x82NBc02QL-UcKkQsm0mGWqB1g__");
        // NEW: Load jetpack player asset for when the power-up is active
        this.load.image("jetpackPlayer", "https://media-hosting.imagekit.io/125ac29ce6844ab0/doodler%20jetpack.png?Expires=1838530428&Key-Pair-Id=K2ZIVPTIP2VGHC&Signature=kGLuGpVNS8GqUXr0ybhDqDG5FGscoS6Ek2pjrv0TCPE8UuQcrNHayERTR3WE-1V1~Lj5zOQOKDc24O3Y3-aUY3IY7Rs9-TrvmChoh90I-Yd9fb3tZewLRRiNat8q0IW7X4ECTa3SMuMsy~jUqtPjPJCUCQyV3ghFzRwKIUQiWScNJJFGHoRrrjCgTrRf3silAPiMo8UDN-I2JnJdj06N8qzBM5m2iWvf4s4eY2adxs1L7F-2YXL17mOBWX3S2qoJqpWb56ApjT9Gbb~KvWLy8S4xZ8rh9PB18f1QEhw1Jus7ZVwaL1Kywo6rWUvNxaHcgmRK81Dr-N57GRPHKroWAw__");

        // Audio
        this.load.audio("background", ["https://aicade-user-store.s3.amazonaws.com/GameAssets/music/Doodle%20Background_3cd80d47-33cf-4ca1-8c60-7a13793255ef.mp3?t=1744134167420"]);
        this.load.audio("lose", ["https://aicade-ui-assets.s3.amazonaws.com/GameAssets/sfx/lose_1.mp3"]);
        this.load.audio("jump", ["https://aicade-user-store.s3.amazonaws.com/GameAssets/music/Doodle%20Jump_4e42502a-1765-49c5-95f5-4ef18300e806.mp3?t=1744132241323"]);
        this.load.audio("collect", ["https://aicade-ui-assets.s3.amazonaws.com/GameAssets/sfx/collect_3.mp3"]);
        this.load.audio("success", ["https://aicade-ui-assets.s3.amazonaws.com/GameAssets/sfx/success_1.wav"]);
        // ── NEW SPRING SOUND ─────────────────────────────────────────────────────
        this.load.audio("springSound", ["https://aicade-user-store.s3.amazonaws.com/GameAssets/music/Doodle%20Spring_b221b4e4-3300-4f8d-937a-17d16caf3646.mp3?t=1744134407165"]);
        // ── NEW JETPACK SOUND ────────────────────────────────────────────────────
        this.load.audio("jetpackSound", ["https://aicade-user-store.s3.amazonaws.com/GameAssets/music/doodle%20jetpack_afccc19d-772e-4bbc-9b83-9cb716cac929.mp3?t=1744134665210"]);
        // ── NEW CRACK PLATFORM SOUND ─────────────────────────────────────────────
        this.load.audio("crackSound", ["https://aicade-user-store.s3.amazonaws.com/GameAssets/music/Doodle%20Platform%20Crack_c34b6a03-57a7-4e68-aed4-f52493f84832.mp3?t=1744135032021"]);
        // ── NEW ENEMY SOUND ──────────────────────────────────────────────────────
        this.load.audio("enemySound", ["https://aicade-user-store.s3.amazonaws.com/GameAssets/music/Doodle%20Enemy_dfe86aed-13ab-4645-b3b4-2c1232a14e67.mp3?t=1744135326035"]);

        // Load button plugin for mobile controls
        if (buttonEnabled) {
            this.load.plugin('rexbuttonplugin', rexButtonUrl, true);
        }
        this.displayProgressLoader();
    }

    /** Display a loading progress bar */
    displayProgressLoader() {
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
            style: { font: '20px monospace', fill: '#ffffff' }
        }).setOrigin(0.5, 0.5);

        const progressBar = this.add.graphics();
        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0x364afe, 1);
            progressBar.fillRect(x, y, width * value, height);
        });
        this.load.on('fileprogress', (file) => {});
        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
        });
    }

    /** Set up the game world */
    create() {
        // Initialize sounds
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }
        // ── ADD NEW SPRING SOUND INSTANCE ─────────────────────────────────────────
        this.sounds.springSound = this.sound.add('springSound', { loop: false, volume: 0.8 });
        // ── ADD NEW JETPACK SOUND INSTANCE ────────────────────────────────────────
        this.sounds.jetpackSound = this.sound.add('jetpackSound', { loop: true, volume: 0.6 });
        // ── ADD NEW CRACK PLATFORM SOUND INSTANCE ─────────────────────────────────
        this.sounds.crackSound = this.sound.add('crackSound', { loop: false, volume: 0.8 });
        // ── ADD NEW ENEMY SOUND INSTANCE ───────────────────────────────────────────
        this.sounds.enemySound = this.sound.add('enemySound', { loop: true, volume: 0.5 });

        isMobile = !this.sys.game.device.os.desktop;
        this.sounds.background.setVolume(0.01).setLoop(true).play();

        this.input.addPointer(3);
        this.score = 0;

        // Set up world and camera bounds for unlimited upward scrolling
        this.physics.world.setBounds(0, -1000000, this.game.config.width, 2000000);
        this.cameras.main.setBounds(0, -1000000, this.game.config.width, 2000000);

        // Background tile sprite
        this.bg = this.add.tileSprite(0, 0, this.game.config.width, this.game.config.height, 'background')
            .setOrigin(0, 0)
            .setScrollFactor(0);

        // Create a graphics object for debugging hitboxes (debug drawing removed)
        this.debugGraphics = this.add.graphics();

        // Spawn the first platform at the bottom middle
        const firstPlatformX = this.game.config.width / 2;
        const firstPlatformY = this.game.config.height - 50;
        const firstPlatform = this.physics.add.staticSprite(firstPlatformX, firstPlatformY, 'platform')
            .setScale(0.5)
            .refreshBody();
        firstPlatform.displayWidth = 200;
        firstPlatform.displayHeight = 20;
        firstPlatform.body.setSize(firstPlatform.displayWidth, firstPlatform.displayHeight);
        firstPlatform.body.setOffset(-90, 0);

        // Position the player on the first platform using default scale
        this.player = this.physics.add.sprite(firstPlatformX, firstPlatformY - 50, 'player')
            .setScale(this.defaultPlayerScale)
            .setBounce(0.1);
        this.player.setGravityY(800);
        // Store the player's default physics body dimensions for later resetting
        this.defaultBodyWidth = this.player.body.width;
        this.defaultBodyHeight = this.player.body.height;
        // Define desired jetpack hitbox dimensions manually (adjust as needed)
        this.jetpackBodyWidth = this.defaultBodyWidth * 0.3;
        this.jetpackBodyHeight = this.defaultBodyHeight * 0.3;

        this.cursors = this.input.keyboard.createCursorKeys();

        // Create groups for springs, enemies, bullets and jetpacks
        this.springGroup = this.physics.add.group({ allowGravity: false, immovable: true });
        this.enemies = this.physics.add.group();
        this.bullets = this.physics.add.group();
        this.jetpacks = this.physics.add.group({ allowGravity: false, immovable: true });

        // Create bullet texture if it doesn't exist
        if (!this.textures.exists('bullet')) {
            let graphics = this.make.graphics({ x: 0, y: 0, add: false });
            graphics.lineStyle(2, 0x000000, 1);
            graphics.fillStyle(0x90ee90, 1);
            graphics.fillCircle(10, 10, 10);
            graphics.strokeCircle(10, 10, 10);
            graphics.generateTexture('bullet', 20, 20);
        }

        // Spawn additional platforms, springs, cracked platforms, jetpacks, etc.
        this.platforms = this.physics.add.staticGroup();
        this.platforms.add(firstPlatform);
        this.highestY = firstPlatformY;
        let prevY = firstPlatformY;
        let y = firstPlatformY - 100;
        while (y > -5000) {
            let x = Phaser.Math.Between(50, this.game.config.width - 50);
            const platform = this.platforms.create(x, y, 'platform').setScale(0.5).refreshBody();
            platform.displayWidth = 200;
            platform.displayHeight = 20;
            platform.body.setSize(platform.displayWidth, platform.displayHeight);
            platform.body.setOffset(-90, 0);
            
            // 20% chance for a cracked platform
            if (Phaser.Math.Between(0, 100) < 20) {
                platform.isCracked = true;
                platform.crackSprite = this.add.sprite(platform.x, platform.y, 'crack');
                platform.crackSprite.setDisplaySize(platform.displayWidth, platform.displayHeight);
                platform.crackSprite.setDepth(1);
            }
            
            // Determine if a spring should be spawned
            let gap = prevY - y;
            if (gap > 300) {
                let spring = this.springGroup.create(platform.x, platform.y - platform.displayHeight / 2 - 10, 'spring');
                spring.setScale(0.5);
            } else if (Phaser.Math.Between(0, 100) < 10) {
                let spring = this.springGroup.create(platform.x, platform.y - platform.displayHeight / 2 - 10, 'spring');
                spring.setScale(0.5);
            }
            // 10% chance to spawn a jetpack power-up on the platform
            if (Phaser.Math.Between(0, 100) < 5) {
                let jetpack = this.jetpacks.create(platform.x, platform.y - platform.displayHeight / 2 - 10, 'jetpack');
                jetpack.setScale(0.3);
            }
            prevY = y;
            y -= Phaser.Math.Between(50, 250);
            if (y < this.highestY) this.highestY = y;
        }

        // Set up collisions/overlaps
        this.physics.add.overlap(this.player, this.springGroup, this.hitSpring, null, this);
        this.physics.add.overlap(this.player, this.enemies, this.hitEnemy, null, this);
        this.physics.add.overlap(this.bullets, this.enemies, this.hitEnemyWithBullet, null, this);
        this.physics.add.overlap(this.player, this.jetpacks, this.collectJetpack, null, this);

        // Set initial camera position
        this.cameras.main.scrollY = this.player.y - this.game.config.height + 100;

        // Score UI: add the score text and create a bold, translucent box around it.
        this.scoreText = this.add.bitmapText(10, 10, 'pixelfont', 'Score: 0', 28).setScrollFactor(0);
        // Create a graphics object for the box
        const padding = 10;
        const offsetX = 20;  // Shift the box 20 pixels to the right
        const offsetY = 15;  // Shift the box 15 pixels downward
        const extraWidth = 100;  // Increase the width from the right side by 10 pixels
        const bounds = this.scoreText.getTextBounds();
        this.scoreBox = this.add.graphics();
        // Draw an opaque black border (thickness 6) and a translucent black fill (alpha 0.5)
        this.scoreBox.lineStyle(6, 0x000000, 1);  // Opaque black boundary
        this.scoreBox.fillStyle(0x000000, 0.5);
        this.scoreBox.strokeRect(bounds.local.x - padding + offsetX, bounds.local.y - padding + offsetY, bounds.local.width + padding * 2 + extraWidth, bounds.local.height + padding * 2);
        this.scoreBox.fillRect(bounds.local.x - padding + offsetX, bounds.local.y - padding + offsetY, bounds.local.width + padding * 2 + extraWidth, bounds.local.height + padding * 2);
        // Ensure the box does not scroll with the camera
        this.scoreBox.setScrollFactor(0);

        this.startingY = this.player.y;

        // Pause button – triggers the SDK overlay
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.pauseButton = this.add.sprite(this.game.config.width - 60, 60, "pauseButton")
            .setOrigin(0.5, 0.5)
            .setInteractive({ cursor: 'pointer' })
            .setScale(2)
            .setScrollFactor(0);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        // Collision overlap for platforms (normal jump boost or cracked behavior)
        this.physics.add.overlap(this.player, this.platforms, this.checkPlatformCollision, null, this);

        // Mobile controls
        this.createMobileButtons();
        this.input.keyboard.disableGlobalCapture();

        // IMPORTANT: Attach the SDK event listeners so that resume/restart/destroy work.
        if (typeof addEventListenersPhaser === "function") {
            addEventListenersPhaser.call(this);
        }
    }

    /** Handle game updates */
    update(time, delta) {
        // Left/right movement and sprite flip based on direction
        if (this.cursors.left.isDown || this.leftPressed) {
            this.player.setVelocityX(-400);
            this.player.flipX = true;
        } else if (this.cursors.right.isDown || this.rightPressed) {
            this.player.setVelocityX(400);
            this.player.flipX = false;
        } else {
            this.player.setVelocityX(0);
        }

        // Horizontal wrapping
        if (this.player.x < 0) {
            this.player.x = this.game.config.width;
        } else if (this.player.x > this.game.config.width) {
            this.player.x = 0;
        }

        // Camera scrolling
        const threshold = this.game.config.height / 2;
        if (this.player.y < this.cameras.main.scrollY + threshold) {
            this.cameras.main.scrollY = this.player.y - threshold;
        }

        // Recycle platforms and spawn new ones
        this.platforms.children.iterate((platform) => {
            if (platform.y > this.cameras.main.scrollY + this.game.config.height + 100) {
                if (platform.isCracked && platform.crackSprite) {
                    platform.crackSprite.destroy();
                }
                platform.destroy();

                let previousHighestY = this.highestY;
                let newY = previousHighestY - Phaser.Math.Between(50, 250);
                let newX = Phaser.Math.Between(50, this.game.config.width - 50);
                const newPlatform = this.platforms.create(newX, newY, 'platform').setScale(0.5).refreshBody();
                newPlatform.displayWidth = 200;
                newPlatform.displayHeight = 20;
                newPlatform.body.setSize(newPlatform.displayWidth, newPlatform.displayHeight);
                newPlatform.body.setOffset(-90, 0);

                if (Phaser.Math.Between(0, 100) < 20) {
                    newPlatform.isCracked = true;
                    newPlatform.crackSprite = this.add.sprite(newPlatform.x, newPlatform.y, 'crack');
                    newPlatform.crackSprite.setDisplaySize(newPlatform.displayWidth, newPlatform.displayHeight);
                    newPlatform.crackSprite.setDepth(1);
                }

                let gap = previousHighestY - newY;
                if (gap > 300) {
                    let spring = this.springGroup.create(newPlatform.x, newPlatform.y - newPlatform.displayHeight / 2 - 10, 'spring');
                    spring.setScale(0.5);
                } else if (Phaser.Math.Between(0, 100) < 10) {
                    let spring = this.springGroup.create(newPlatform.x, newPlatform.y - newPlatform.displayHeight / 2 - 10, 'spring');
                    spring.setScale(0.5);
                }
                if (Phaser.Math.Between(0, 100) < 10) {
                    let jetpack = this.jetpacks.create(newPlatform.x, newPlatform.y - newPlatform.displayHeight / 2 - 10, 'jetpack');
                    jetpack.setScale(0.3);
                }

                // Compute enemy spawn chance based on score
                let enemyChance = 15;
                if (this.score >= 1500) {
                    enemyChance = 40;
                } else if (this.score >= 1000) {
                    enemyChance = 25;
                }
                if (Phaser.Math.Between(0, 100) < enemyChance) {
                    let spawnLeft = Phaser.Math.Between(0, 1) === 0;
                    let enemyY = newPlatform.y;
                    let enemy;
                    if (spawnLeft) {
                        enemy = this.enemies.create(-20, enemyY, 'enemy');
                        enemy.setVelocityX(this.enemySpeed);
                    } else {
                        enemy = this.enemies.create(this.game.config.width + 20, enemyY, 'enemy');
                        enemy.setVelocityX(-this.enemySpeed);
                    }
                    enemy.setCollideWorldBounds(true);
                    enemy.setBounce(1, 0);
                    enemy.setScale(0.2);
                    enemy.body.allowGravity = false;
                }
                this.highestY = newY;
            }
        });

        // Destroy bullets that left the top of the screen
        this.bullets.children.each(bullet => {
            if (bullet.y < this.cameras.main.scrollY - bullet.height) {
                bullet.destroy();
            }
        }, this);

        // Background parallax scrolling
        this.bg.tilePositionY = -this.cameras.main.scrollY * 0.5;

        // Update score based on height
        this.score = Math.max(0, Math.floor((this.startingY - this.player.y) / 10));
        this.scoreText.setText('Score: ' + this.score);

        // Force upward movement if jetpack is active
        if (this.jetpackActive) {
            this.player.setVelocityY(-800);
        }

        // Check game over
        if (this.player.y > this.cameras.main.scrollY + this.game.config.height) {
            this.gameOver();
        }

        // ── UPDATE ENEMY SOUND BASED ON VISIBILITY ───────────────────────────────
        let enemyVisible = false;
        this.enemies.children.iterate((enemy) => {
            if (enemy.active) {
                let enemyBounds = enemy.getBounds();
                let cameraBounds = this.cameras.main.worldView;
                if (Phaser.Geom.Intersects.RectangleToRectangle(enemyBounds, cameraBounds)) {
                    enemyVisible = true;
                }
            }
        });
        if (enemyVisible) {
            if (!this.sounds.enemySound.isPlaying) {
                this.sounds.enemySound.play();
            }
        } else {
            if (this.sounds.enemySound.isPlaying) {
                this.sounds.enemySound.stop();
            }
        }
    }

    /** Player shooting: changes texture briefly and fires a bullet upward */
    shootBullet() {
        this.player.setTexture('playerShoot');
        this.time.addEvent({
            delay: 100,
            callback: () => {
                this.player.setTexture(this.defaultPlayerTexture);
            }
        });
        let bullet = this.physics.add.sprite(this.player.x, this.player.y, 'bullet');
        bullet.body.setAllowGravity(false);
        bullet.setVelocityY(-500);
        this.bullets.add(bullet);
    }

    /** Custom collision for platforms (normal jump or cracked behavior) */
    checkPlatformCollision(player, platform) {
        if (this.jetpackActive) {
            return;
        }
        if (player.body.velocity.y > 0 && player.y < platform.y) {
            player.setVelocityY(-1000);
            this.sounds.jump.setVolume(1.5).setLoop(false).play();
            if (platform.isCracked) {
                // ── PLAY CRACK PLATFORM SOUND ───────────────────────────────────
                this.sounds.crackSound.play();

                if (platform.crackSprite) {
                    this.tweens.add({
                        targets: platform.crackSprite,
                        y: platform.crackSprite.y + 100,
                        alpha: 0,
                        duration: 500,
                        onComplete: () => {
                            platform.crackSprite.destroy();
                        }
                    });
                }
                this.tweens.add({
                    targets: platform,
                    y: platform.y + 100,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        platform.destroy();
                    }
                });
            }
        }
    }
    
    /** Callback for spring collision (2x jump boost) */
    hitSpring(player, spring) {
        if (player.body.velocity.y > 0 && player.y < spring.y) {
            player.setVelocityY(-2000);
            spring.destroy();
            // ── PLAY DEDICATED SPRING SOUND ─────────────────────────────────────
            this.sounds.springSound.play();
        }
    }
    
    /** Callback for enemy collision (game over) */
    hitEnemy(player, enemy) {
        this.gameOver();
    }

    /** Callback for bullet and enemy collision */
    hitEnemyWithBullet(bullet, enemy) {
        bullet.destroy();
        enemy.destroy();
    }
    
    /** Callback for collecting a jetpack power-up */
    collectJetpack(player, jetpack) {
        jetpack.destroy();
        this.jetpackActive = true;
        // ── PLAY JETPACK LOOPING SOUND ───────────────────────────────────────
        this.sounds.jetpackSound.play();

        this.player.setTexture('jetpackPlayer');
        this.player.setScale(0.4);
        this.player.body.setSize(this.jetpackBodyWidth, this.jetpackBodyHeight, true);
        this.player.body.setAllowGravity(false);

        this.time.addEvent({
            delay: 5000,
            callback: () => {
                this.jetpackActive = false;
                // ── STOP JETPACK SOUND WHEN POWER-UP ENDS ─────────────────────────
                this.sounds.jetpackSound.stop();

                this.player.setTexture(this.defaultPlayerTexture);
                this.player.setScale(this.defaultPlayerScale);
                this.player.body.setSize(this.defaultBodyWidth, this.defaultBodyHeight, true);
                this.player.body.setAllowGravity(true);
            }
        });
    }

    /** Create mobile control buttons */
    createMobileButtons() {
        this.leftButton = this.add.rectangle(80, this.height - 60, 100, 100, 0xcccccc, 0.5)
            .setScrollFactor(0)
            .setInteractive();
        this.rightButton = this.add.rectangle(200, this.height - 60, 100, 100, 0xcccccc, 0.5)
            .setScrollFactor(0)
            .setInteractive();

        this.leftButton.on('pointerdown', () => { this.leftPressed = true; });
        this.leftButton.on('pointerup', () => { this.leftPressed = false; });
        this.leftButton.on('pointerout', () => { this.leftPressed = false; });

        this.rightButton.on('pointerdown', () => { this.rightPressed = true; });
        this.rightButton.on('pointerup', () => { this.rightPressed = false; });
        this.rightButton.on('pointerout', () => { this.rightPressed = false; });

        this.toggleControlsVisibility(isMobile);
    }

    /** Toggle mobile control visibility */
    toggleControlsVisibility(visibility) {
        if (this.leftButton) this.leftButton.visible = visibility;
        if (this.rightButton) this.rightButton.visible = visibility;
    }

    /** Pause game by triggering the SDK event which shows the default overlay */
    pauseGame() {
        handlePauseGame.call(this);
    }

    /** Game over: trigger the SDK event which shows the default game-over overlay */
    gameOver() {
        this.sound.stopAll();
        this.sounds.lose.setVolume(0.2).setLoop(false).play();
        initiateGameOver.bind(this)({ score: this.score });
    }
}

// Game Configuration
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
            gravity: { y: 800 },
            debug: false,
        },
    },
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions,
    },
    deviceOrientation: _CONFIG.deviceOrientation === "landscape"
};

// Initialize the Phaser game instance
//const game = new Phaser.Game(config);
