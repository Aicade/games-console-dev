// Updated SubwaySurfer.js with Manual Hitbox Settings (debug hitbox removed)

var isMobile = false;

// Touch Screen Controls (not used on PC)
const joystickEnabled = false;
const buttonEnabled = false;

const rexJoystickUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js";
const rexButtonUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexbuttonplugin.min.js";

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        // Track dimensions will be updated in create()
        this.trackWidth = 500;
        this.trackHeight = 500;
        // We'll use 3 manually defined lanes
        this.lanes = 3;
        this.currentLane = 1; // Player's current lane (middle lane initially)
        this.lastLane = 1;    // Track previous lane for side collision recovery
        this.playerXPositions = []; // Manually defined lane positions
        this.score = 0;
        // Spawn enemy delay will be randomized between 3000 and 6000 milliseconds.
        this.spawnDelay = Phaser.Math.Between(3000, 6000);
        this.isGameOver = false;
        this.isJumping = false; // Prevent overlapping jumps

        // Jump settings (smooth jump animation)
        this.jumpDuration = 1200; // Total jump duration (milliseconds)
        this.normalScale = 0.18;  // Normal scale (used when creating the player)
        this.jumpScaleMultiplier = 1.8; // Multiplier for jump scale (bigger than normal)
        // Updated player scale: reduced from 1.5 to 1.2 multiplier
        this.playerScaleOnCreation = this.normalScale * 1.2;
        this.jumpHeight = 100;    // Vertical jump height

        // Vertical movement speed for power-ups and obstacles
        this.powerUpStep = 1.4;
    }

    preload() {
        this.score = 0;
        this.spawnDelay = Phaser.Math.Between(3000, 6000);
        this.isGameOver = false;

        addEventListenersPhaser.bind(this)();

        // Load standard images from JSON except 'obstacle'
        for (const key in _CONFIG.imageLoader) {
            if (key !== 'obstacle') {
                this.load.image(key, _CONFIG.imageLoader[key]);
            }
        }
        // Temporarily use a known working URL for testing obstacle asset
        this.load.image('obstacle', 'https://media-hosting.imagekit.io/6f09521380b841b4/slazzer-edit-image.png?Expires=1838090935&Key-Pair-Id=K2ZIVPTIP2VGHC&Signature=SNJFSoD-uR8jglr5vrJ2rkqmOi5hZvfv~Vc-7SAHmN1yIeuqIiCyvEtfogm5vKOQDZ6BpkP7mnpgmG1VAuXCgyardNEzUHbmOJSCV9PfACitIOiCvUh5K90qH2b0wmQE4yPCrkzgAJxEKRsp1ufOT7SjRxjC8Jkgc1m7did9B-6UQEGhfws-MtpBBVA05BOC7RkAiHRJbbxwDU0dUu1qnhw-x7d6CPIaJSrpYUHooT27ct6-Z138nmUI82IePRLRN8T3G72e5~iS7uAxQtO8K590rTtTSB~DDVWWrx6i6TxsXQeU2bHeKHzgY57rMLuOK0wYdP5xV1~toeBp6zsV4w__', { crossOrigin: 'anonymous' });

        // Updated train track asset - using new image URL.
        this.load.image('trainTrack', 'https://media-hosting.imagekit.io/9fd2bad1b4f843cc/2.png?Expires=1838134173&Key-Pair-Id=K2ZIVPTIP2VGHC&Signature=ZE1vCDDtffZ7u4WuTmK2HHj8ryPT2pXS~0Py7lppweirJtzqCEbrbIFBczHTrPKaSNdex93Hvzv-4o5BK8grcQCnxU9Md4CORo0zmFOr2oeSKk4~UI5U47yzjY7-jYBQ8dRrfnVwqNXxin~~N1JxWv~d4kJx5Z~yH-1qgXI-566GrO9bFddXs3CM6ZvUGDx7QoUrjbCtX4df~A9x44saWgjtgEaRGHsid1YiFTaEyi95viEidmDrBb01V0PBWaRXdyzjt7l3Vdd4JHUM7zrPgM20JsGMCd8pB5iiy5zStVm9DTgzl-AAFpRbNjyD828AQGmyKO3k3pjY7jYAEVFSMg__');

        // Load audio from configuration.
        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }

        // Additional assets.
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
        this.load.image("pillar", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/textures/Bricks/s2+Brick+01+Grey.png");
        this.load.image("newAsset", "https://media-hosting.imagekit.io/6d0756600a534510/avatar-profile-picture-icon-set-260nw-207369067.png?Expires=1838106862&Key-Pair-Id=K2ZIVPTIP2VGHC&Signature=JF42YcfT-YHb7EYN5cbo5NXfgRTMzqO27DL8n0fRajh64BeYuv3~3R9o~9tN2w2rJAi2u2pCcZWlZIuKADSv5Cox8OX7i3IDas4sOzzTmdS3O3HwwIsnqbg3TDGhjqA3F8jqDfUgXTDCjxYKFzWCcz6lJgkCnloYBZaCLJut8OpMDvTSIx6~kmXSqA30UppvHR1YHDWtm6vQzOwL~NcIIToGZqmLTwtBUaKserIfNEFRjmtPVGWQG7jHEHphxd0GLGWvES~Eh7Yw0nKvmjInc7ENWl2LP82Dx-DDzpiSgchUGJjhJJjRAfc1Lih3VDoi7SVXZdeyiWTSfrD2SRB6YQ__");
        // Load the train asset with crossOrigin enabled.
        this.load.image('train', 
            'https://media-hosting.imagekit.io/ca871ac6db29492e/train.png?Expires=1838029696&Key-Pair-Id=K2ZIVPTIP2VGHC&Signature=1jYB9fzt0kIoqlVSdVVtkSTLctQuleW~1rM5ynX2CiTNDKIhObxio4dmKicEU7~i5EOXSNzQMPUtorxqhy5KdyHyE4KedahQlwuJ2TVnh1M37VMGShoQmMOnAzXcbYPtree2-1SmSDcR4fz-6865S4K66zuPLdRht1Wg9BPUbcfCqIKjqTvuzHmdK14liDoya5CJ9bXtI1xw0AX8fXzI8x630Tk0Agwx0Z~tk48gWKr0KGQ6yLEiO9J-1ec~zIgrfvgyLrZx5g7JF1q~KWlpa2-TIZ4ZtFL7QVaCFWV9okBsICS7LQAqZTK6IQEA1fjUGeE8ljG0owC28Q8xYgrweQ__',
            { crossOrigin: 'anonymous' }
        );

        // Bitmap font.
        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/";
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        displayProgressLoader.call(this);
    }

    create() {
        isMobile = !this.sys.game.device.os.desktop;
        
        // Instead of stretching the train track, use the image's native size.
        const sourceImage = this.textures.get('trainTrack').getSourceImage();
        this.trackWidth = sourceImage.width;
        this.trackHeight = sourceImage.height;
        this.track = this.add.tileSprite(
            this.scale.width / 2,
            this.scale.height / 2,
            this.trackWidth,
            this.trackHeight,
            'trainTrack'
        );
        
        // Adjust train track asset size only for mobile devices.
        if (isMobile) {
            const reducedWidth = this.trackWidth * 0.4;
            const reducedHeight = this.trackHeight * 0.6;
            this.track.setDisplaySize(reducedWidth, reducedHeight);
        } else {
            this.track.setScale(0.7);
        }
        
        this.track.tilePositionX = -50;
        this.track.tilePositionY = -100;
        
        // Define lane positions.
        this.playerXPositions[0] = this.scale.width / 1.85 - 150;
        this.playerXPositions[1] = this.scale.width / 1.92;
        this.playerXPositions[2] = this.scale.width / 2 + 150;
        
        if (isMobile) {
            this.playerXPositions[0] = this.scale.width * 0.34;
            this.playerXPositions[1] = this.scale.width * 0.55;
            this.playerXPositions[2] = this.scale.width * 0.74;
        }
        
        // Create player.
        this.currentLane = 1;
        this.lastLane = 1;
        this.playerGroundY = this.scale.height - 100;
        this.player = this.physics.add.sprite(
            this.playerXPositions[this.currentLane],
            this.playerGroundY,
            'player'
        ).setScale(this.playerScaleOnCreation);

        if (isMobile) {
            this.player.setScale(this.playerScaleOnCreation * 0.8);
        }
        
        this.player.body.setSize(200, 200);
        this.player.body.setOffset(40, 250);
        this.player.setDepth(20);

        // Keyboard inputs.
        this.input.keyboard.on('keydown-LEFT', () => {
            if (this.currentLane > 0) {
                this.lastLane = this.currentLane;
                this.currentLane--;
                this.movePlayerToLane();
            }
        });
        this.input.keyboard.on('keydown-RIGHT', () => {
            if (this.currentLane < this.lanes - 1) {
                this.lastLane = this.currentLane;
                this.currentLane++;
                this.movePlayerToLane();
            }
        });
        this.input.keyboard.on('keydown-SPACE', () => {
            if (!this.isJumping) {
                this.handleJump();
            }
        });

        // Groups.
        this.enemies = this.physics.add.group();
        this.powerUps = this.physics.add.group();
        this.obstacles = this.physics.add.group();

        // Collisions.
        this.physics.add.collider(this.player, this.enemies, this.handleCollision, null, this);
        this.physics.add.collider(this.player, this.obstacles, this.handleObstacleCollision, null, this);
        this.physics.add.overlap(this.player, this.powerUps, this.collectPowerup, null, this);

        // Spawning.
        this.setupEnemySpawn();
        this.time.addEvent({
            delay: Phaser.Math.Between(1000, 7000),
            callback: this.spawnPowerUp,
            callbackScope: this,
            loop: true
        });
        this.time.addEvent({
            delay: Phaser.Math.Between(2000, 5000),
            callback: this.spawnObstacle,
            callbackScope: this,
            loop: true
        });

        // UI.
        this.scoreText = this.add.bitmapText(this.scale.width / 2 + 20, 120, 'pixelfont', '0', 32)
            .setOrigin(0.5, 0.5)
            .setDepth(11);
        this.setScoreTextPosition(1190, 246);

        const distanceTextOffsetX = -50;
        const distanceTextOffsetY = this.pauseButton ? this.pauseButton.displayHeight * 1.5 : 100;
        this.distance = 0;
        this.distanceText = this.add.bitmapText(
            this.scale.width - 60 + distanceTextOffsetX,
            60 + distanceTextOffsetY,
            'pixelfont',
            "000000",
            32
        )
            .setOrigin(0.5, 0.5)
            .setDepth(11);
            
        const padding = 10;
        this.distanceBox = this.add.graphics();
        this.distanceBox.fillStyle(0x000000, 0.5);
        const boxX = this.distanceText.x - (this.distanceText.width / 2) - padding;
        const boxY = this.distanceText.y - (this.distanceText.height / 2) - padding;
        const boxWidth = this.distanceText.width + padding * 2;
        const boxHeight = this.distanceText.height + padding * 2;
        this.distanceBox.fillRect(boxX, boxY, boxWidth, boxHeight);
        this.distanceBox.setDepth(10);

        const offsetY = 90;
        this.distanceBox2 = this.add.graphics();
        this.distanceBox2.fillStyle(0x000000, 0.5);
        this.distanceBox2.fillRect(boxX, boxY + offsetY, boxWidth, boxHeight);
        this.distanceBox2.setDepth(10);

        const iconPadding = 10;
        this.collectibleIcon = this.add.image(
            boxX + iconPadding, 
            boxY + offsetY + boxHeight / 2, 
            'collectible'
        )
        .setOrigin(0, 0.5)
        .setScale(0.2);
        this.collectibleIcon.setDepth(11);

        const margin = 20;
        const offsetY2 = offsetY + boxHeight + margin;
        const newBoxHeight = boxHeight + 100;
        this.distanceBox3 = this.add.graphics();
        this.distanceBox3.fillStyle(0x000000, 0.5);
        this.distanceBox3.fillRect(boxX, boxY + offsetY2, boxWidth, newBoxHeight);
        this.distanceBox3.setDepth(10);

        this.newAssetImage = this.add.image(
            boxX + boxWidth / 2,
            boxY + offsetY2,
            'newAsset'
        )
        .setOrigin(0.5, 0)
        .setDepth(11);
        this.newAssetImage.displayWidth = 140;
        this.newAssetImage.displayHeight = 100;

        let savedHighScore = localStorage.getItem('highScore');
        if (savedHighScore === null) {
            savedHighScore = 0;
        } else {
            savedHighScore = parseInt(savedHighScore);
        }
        this.highScoreText = this.add.bitmapText(
            boxX + boxWidth / 2,
            boxY + offsetY2 + newBoxHeight * 0.75,
            'pixelfont',
            '' + savedHighScore,
            32
        ).setOrigin(0.5, 0.5);
        this.highScoreText.setDepth(11);

        // Initialize collectible count (for mobile)
        if (isMobile) {
            this.collectableCount = 0;
        }

        if (isMobile) {
            this.powerUpStep = 1.2;
        }
        
        this.distanceTimer = this.time.addEvent({
            delay: 1000,
            callback: function() {
                this.distance += 10;
                let formattedDistance = this.distance.toString().padStart(6, "0");
                this.distanceText.setText(formattedDistance);
                
                let currentHighScore = parseInt(localStorage.getItem('highScore') || 0);
                if (this.distance > currentHighScore) {
                    localStorage.setItem('highScore', this.distance);
                    this.highScoreText.setText('' + this.distance);
                }
            },
            callbackScope: this,
            loop: true
        });

        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        this.pauseButton = this.add.sprite(this.scale.width - 60, 60, "pauseButton")
            .setOrigin(0.5, 0.5)
            .setDepth(1)
            .setScale(3)
            .setInteractive({ cursor: 'pointer' });
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        // Audio.
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }
        this.sounds.background.setVolume(1).setLoop(true).play();

        // Visual effects.
        this.vfx = new VFXLibrary(this);

        this.isGameOver = false;
        this.input.keyboard.disableGlobalCapture();

        // ***** Mobile UI Adjustments *****
        if (isMobile) {
            const uiMarginX = 10;
            const uiMarginY = 10;
            const uiPadding = 5;
            const uiOffsetBetween = 10;

            this.distanceText.setPosition(uiMarginX + 30, uiMarginY + 20);
            this.distanceText.setFontSize(24);

            const mBoxX = this.distanceText.x - (this.distanceText.width / 2) - uiPadding;
            const mBoxY = this.distanceText.y - (this.distanceText.height / 2) - uiPadding;
            const mBoxWidth = this.distanceText.width + uiPadding * 2;
            const mBoxHeight = this.distanceText.height + uiPadding * 2;

            this.distanceBox.clear();
            this.distanceBox.fillStyle(0x000000, 0.5);
            this.distanceBox.fillRect(mBoxX, mBoxY, mBoxWidth, mBoxHeight);

            const mOffsetY = mBoxHeight + uiOffsetBetween;
            this.distanceBox2.clear();
            this.distanceBox2.fillStyle(0x000000, 0.5);
            this.distanceBox2.fillRect(mBoxX, mBoxY + mOffsetY, mBoxWidth, mBoxHeight);

            const mIconPadding = 5;
            this.collectibleIcon.setPosition(mBoxX + mIconPadding, mBoxY + mOffsetY + mBoxHeight / 2);
            this.collectibleIcon.setScale(0.15);

            // Add collectible count text inside the second box.
            this.collectibleCountText = this.add.bitmapText(
                mBoxX + mBoxWidth - 5, 
                mBoxY + mOffsetY + mBoxHeight / 2, 
                'pixelfont', 
                '0', 
                24
            ).setOrigin(1, 0.5).setDepth(20);

            const mOffsetY2 = mOffsetY + mBoxHeight + uiOffsetBetween;
            const mNewBoxHeight = mBoxHeight + 80;
            this.distanceBox3.clear();
            this.distanceBox3.fillStyle(0x000000, 0.5);
            this.distanceBox3.fillRect(mBoxX, mBoxY + mOffsetY2, mBoxWidth, mNewBoxHeight);

            this.newAssetImage.setPosition(mBoxX + mBoxWidth / 2, mBoxY + mOffsetY2);
            this.newAssetImage.displayWidth = 100;
            this.newAssetImage.displayHeight = 70;

            this.highScoreText.setPosition(mBoxX + mBoxWidth / 2, mBoxY + mOffsetY2 + mNewBoxHeight * 0.75);
            this.highScoreText.setFontSize(24);
        }

        // ***** Mobile Swipe Gestures *****
        if (isMobile) {
            this.input.on('pointerdown', function(pointer) {
                this.swipeStart = { x: pointer.x, y: pointer.y };
            }, this);
            this.input.on('pointerup', function(pointer) {
                let swipeEnd = { x: pointer.x, y: pointer.y };
                let deltaX = swipeEnd.x - this.swipeStart.x;
                let deltaY = swipeEnd.y - this.swipeStart.y;
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    if (deltaX > 30) {
                        if (this.currentLane < this.lanes - 1) {
                            this.lastLane = this.currentLane;
                            this.currentLane++;
                            this.movePlayerToLane();
                        }
                    } else if (deltaX < -30) {
                        if (this.currentLane > 0) {
                            this.lastLane = this.currentLane;
                            this.currentLane--;
                            this.movePlayerToLane();
                        }
                    }
                } else {
                    if (deltaY < -30) {
                        if (!this.isJumping) {
                            this.handleJump();
                        }
                    }
                }
            }, this);
        }
    }

    setScoreTextPosition(newX, newY) {
        this.scoreText.setPosition(newX, newY);
    }

    movePlayerToLane() {
        this.tweens.add({
            targets: this.player,
            x: this.playerXPositions[this.currentLane],
            duration: 150,
            ease: 'Power2'
        });
    }
    
    handleJump() {
        this.isJumping = true;
        this.tweens.add({
            targets: this.player,
            scale: this.normalScale * this.jumpScaleMultiplier,
            y: this.playerGroundY - this.jumpHeight,
            duration: this.jumpDuration / 2,
            ease: 'Sine.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: this.player,
                    scale: this.playerScaleOnCreation,
                    y: this.playerGroundY,
                    duration: this.jumpDuration / 2,
                    ease: 'Sine.easeIn',
                    onComplete: () => { 
                        this.isJumping = false; 
                    }
                });
            }
        });
    }

    handleCollision(player, enemy) {
        if (this.isJumping) { return; }
        const enemyLane = enemy.getData("lane");
        const verticalDiff = Math.abs(player.y - enemy.y);
        const fatalVerticalThreshold = 50;
        if (enemyLane === this.currentLane || verticalDiff < fatalVerticalThreshold) {
            this.sounds.damage.setVolume(1).setLoop(false).play();
            enemy.destroy();
            this.resetGame();
        } else {
            this.vfx.shakeCamera();
            this.currentLane = this.lastLane;
            this.movePlayerToLane();
        }
    }

    handleObstacleCollision(player, obstacle) {
        if (this.isJumping) { return; }
        const obstacleLane = obstacle.getData("lane");
        const verticalDiff = Math.abs(player.y - obstacle.y);
        const fatalVerticalThreshold = 50;
        if (obstacleLane === this.currentLane || verticalDiff < fatalVerticalThreshold) {
            this.sounds.damage.setVolume(1).setLoop(false).play();
            obstacle.destroy();
            this.resetGame();
        } else {
            this.vfx.shakeCamera();
            this.currentLane = this.lastLane;
            this.movePlayerToLane();
        }
    }

    collectPowerup(player, powerup) {
        if (this.isJumping) { return; }
        this.sounds.collect.setVolume(1).setLoop(false).play();
        let pointsText = this.add.bitmapText(powerup.x, powerup.y, 'pixelfont', '+10', 30)
            .setOrigin(0.5, 0.5);
        this.tweens.add({
            targets: pointsText,
            y: pointsText.y - 50,
            alpha: 0,
            ease: 'Linear',
            duration: 1000,
            onComplete: () => pointsText.destroy()
        });
        powerup.destroy();
        this.updateScore(10);
        if (isMobile) {
            this.collectableCount = (this.collectableCount || 0) + 10;
            if (this.collectibleCountText) {
                this.collectibleCountText.setText(this.collectableCount);
            }
        }
    }

    updateScore(points) {
        this.score += points;
        if (this.score % 50 === 0) {
            this.adjustDifficulty();
        }
        this.scoreText.setText(this.score);
    }

    setupEnemySpawn() {
        if (this.enemySpawnEvent) { this.enemySpawnEvent.remove(); }
        this.enemySpawnEvent = this.time.addEvent({
            delay: Phaser.Math.Between(3000, 6000),
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });
    }

    adjustDifficulty() {
        this.spawnDelay = Phaser.Math.Between(3000, 6000);
        this.setupEnemySpawn();
    }

    spawnEnemy() {
        const laneIndex = Phaser.Math.Between(0, this.lanes - 1);
        const xPosition = this.playerXPositions[laneIndex];
        const enemy = this.enemies.create(xPosition, -50, 'train');
        enemy.setData("lane", laneIndex);
        
        let speed = 1.4;
        if (isMobile) {
            speed = 1.2;
        }
        enemy.setData('speed', speed);
        
        // Use the sprite's width and height as before.
        const originalWidth = enemy.width;
        const originalHeight = enemy.height;
        let scaleFactor = 0.3;
        if (isMobile) {
            scaleFactor = 0.2;
        }
        const newWidth = originalWidth * scaleFactor;
        const newHeight = originalHeight * scaleFactor;
        enemy.setDisplaySize(newWidth, newHeight);
        
        const hitboxWidth = enemy.displayWidth * 4;
        const hitboxHeight = enemy.displayHeight * 4;
        enemy.body.setSize(hitboxWidth, hitboxHeight);
        const centerOffsetX = (enemy.displayWidth - hitboxWidth) / 5;
        const centerOffsetY = (enemy.displayHeight - hitboxHeight) / 5;
        const offsetX = centerOffsetX + 150;
        const offsetY = centerOffsetY + 70;
        enemy.body.setOffset(offsetX, offsetY);
        enemy.body.updateFromGameObject();

        enemy.alpha = 0;
        this.tweens.add({
            targets: enemy,
            alpha: 1,
            duration: 500,
            ease: 'Linear'
        });
    }

    spawnObstacle() {
        let availableLanes = [];
        for (let i = 0; i < this.lanes; i++) {
            let laneOccupied = false;
            this.enemies.getChildren().forEach((enemy) => {
                if (enemy.getData("lane") === i && enemy.y < 100) {
                    laneOccupied = true;
                }
            });
            if (!laneOccupied) {
                availableLanes.push(i);
            }
        }
        let laneIndex;
        if (availableLanes.length > 0) {
            laneIndex = Phaser.Math.Between(0, availableLanes.length - 1);
        } else {
            laneIndex = Phaser.Math.Between(0, this.lanes - 1);
        }
        
        const xPosition = this.playerXPositions[laneIndex];
        const obstacle = this.obstacles.create(xPosition, -50, 'obstacle');
        obstacle.setData("lane", laneIndex);
        
        let obstacleScale = 0.2;
        if (isMobile) {
            obstacleScale = 0.15;
        }
        obstacle.setScale(obstacleScale);
        
        let obstacleSpeed = 1.4;
        if (isMobile) {
            obstacleSpeed = 1.2;
        }
        obstacle.setData('speed', obstacleSpeed);
        
        obstacle.body.setSize(obstacle.displayWidth, obstacle.displayHeight);
        obstacle.setDepth(5);

        obstacle.alpha = 0;
        this.tweens.add({
            targets: obstacle,
            alpha: 1,
            duration: 500,
            ease: 'Linear'
        });
    }

    spawnPowerUp() {
        const laneIndex = Phaser.Math.Between(0, this.lanes - 1);
        const xPosition = this.playerXPositions[laneIndex];
        const powerUp = this.powerUps.create(xPosition, -50, 'collectible');
        powerUp.setScale(0.2);
        powerUp.alpha = 1;
    }
    
    update(time, delta) {
        if (!this.isGameOver) {
            this.enemies.children.iterate((enemy) => {
                if (enemy) {
                    enemy.y += enemy.getData('speed');
                    if (enemy.y > this.scale.height - 90 && !enemy.getData('fading')) {
                        enemy.setData('fading', true);
                        this.tweens.add({
                            targets: enemy,
                            alpha: 0,
                            duration: 500,
                            ease: 'Linear',
                            onComplete: () => {
                                this.enemies.remove(enemy, true, true);
                            }
                        });
                    }
                }
            });
            
            this.powerUps.children.iterate((powerUp) => {
                if (powerUp) {
                    powerUp.y += this.powerUpStep;
                    if (powerUp.y > this.scale.height) {
                        this.powerUps.remove(powerUp, true, true);
                    }
                }
            });
            
            this.obstacles.children.iterate((obstacle) => {
                if (obstacle) {
                    obstacle.y += obstacle.getData('speed');
                    if (obstacle.y > this.scale.height - 90 && !obstacle.getData('fading')) {
                        obstacle.setData('fading', true);
                        this.tweens.add({
                            targets: obstacle,
                            alpha: 0,
                            duration: 500,
                            ease: 'Linear',
                            onComplete: () => {
                                this.obstacles.remove(obstacle, true, true);
                            }
                        });
                    }
                }
            });
            this.track.tilePositionY -= 2;
        }
    }

    resetGame() {
        this.isGameOver = true;
        this.physics.pause();
        this.vfx.shakeCamera();
        
        if (this.distanceTimer) {
            this.distanceTimer.remove();
        }
        
        this.setScoreTextPosition(1190, 246);
        
        let gameOverText = this.add.bitmapText(
            this.cameras.main.centerX,
            this.cameras.main.centerY - 200,
            'pixelfont',
            'Game Over',
            64
        ).setOrigin(0.5)
         .setVisible(false)
         .setAngle(-15);
        this.time.delayedCall(500, () => {
            this.sounds.lose.setVolume(1).setLoop(false).play();
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
    
    gameOver() {
        this.sounds.background.stop();
        initiateGameOver.bind(this)({ score: this.score });
    }

    pauseGame() {
        handlePauseGame.bind(this)();
    }
}

// Progress loader.
function displayProgressLoader() {
    let width = 320, height = 50;
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
    }).setOrigin(0.5);
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

// Mobile device detection.
const isMobileDevice = /Mobi|Android/i.test(navigator.userAgent);
if (isMobileDevice) {
    _CONFIG.deviceOrientation = "portrait";
    _CONFIG.orientationSizes.portrait = { width: 360, height: 640 };
}

const config = {
    type: Phaser.AUTO,
    width: isMobileDevice
        ? _CONFIG.orientationSizes.portrait.width
        : _CONFIG.orientationSizes[_CONFIG.deviceOrientation].width,
    height: isMobileDevice
        ? _CONFIG.orientationSizes.portrait.height
        : _CONFIG.orientationSizes[_CONFIG.deviceOrientation].height,
    scene: [GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        orientation: isMobileDevice ? Phaser.Scale.PORTRAIT : Phaser.Scale.LANDSCAPE
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
    deviceOrientation: _CONFIG.deviceOrientation === "landscape"
};

//var game = new Phaser.Game(config);
