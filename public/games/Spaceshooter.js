// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.score = 0; this.gameWin = false; this.isGameOver = false;
        this.graphics = null; this.playerBullets = null;
        this.players = null; this.enemyBullets = null;
        this.enemies = null; this.coins = [];
        this.asteroids = []; this.shields = null;
        this.powerups = null; this.gameCoinScoreTxt = null;
        this.gameScale = 0.3; this.gameSpeed = 1;
        this.playerSelected = 3; this.playerHitpoints = 3;
        this.gameCoinScore = 0; this.gameStage = 0;
        this.gameStarted = true; this.gameAllOver = false;
        this.spawnCoinTimerEvent = null; this.playerSelectBtns = [];
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

        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/";
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        this.load.image('blue_shield', `https://play.rosebud.ai/assets/blue_shield_80x78.png.png?CgMm`);
        this.load.image('pink_heart', `https://play.rosebud.ai/assets/pink_heart_80x78.png.png?xCqT`);
        this.load.image('shield', `https://play.rosebud.ai/assets/shield_160x60.png.png?kqMH`);
    }

    create() {
        this.isGameOver = false;
        this.input.keyboard.disableGlobalCapture();
        this.score = 0;
        this.vfx = new VFXLibrary(this);

        this.cursor = this.input.keyboard.createCursorKeys();

        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        this.bg = this.add.image(this.game.config.width / 2, this.game.config.height / 2, "background").setOrigin(0.5);
        // Use the larger scale factor to ensure the image covers the whole canvas
        const scale = Math.max(this.game.config.width / this.bg.displayWidth, this.game.config.height / this.bg.displayHeight);
        this.bg.setScale(scale).setDepth(-100);

        this.sounds.background.setVolume(0.3).setLoop(true).play();
        this.width = this.game.config.width;
        this.height = this.game.config.height;

        // Add UI elements
        this.scoreText = this.add.bitmapText(this.width / 2, 50, 'pixelfont', '0', 64).setOrigin(0.5, 0.5);
        this.scoreText.setDepth(100);

        this.pauseButton = this.add.sprite(this.width - 50, 60, "pauseButton").setOrigin(0.5, 0.5);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(3);
        this.pauseButton.setDepth(11);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());

        this.screenWidth = this.sys.game.config.width;
        this.screenHeight = this.sys.game.config.height;

        this.graphics = this.add.graphics();

        this.players = this.physics.add.group();
        this.create_playerObj();

        // Create 5 heart icons on top left for player lives
        this.playerShip.lives = 5;
        this.lifeIcons = [];
        for (let i = 0; i < 5; i++) {
            let heart = this.add.image(10 + i * 40, 10, 'pink_heart').setOrigin(0, 0);
            heart.setScale(0.5);
            this.lifeIcons.push(heart);
        }

        this.shields = this.physics.add.group(); 
        this.coins = this.physics.add.group();
        this.asteroids = this.physics.add.group(); 
        this.powerups = this.physics.add.group();
        this.enemies = this.physics.add.group(); 
        this.enemyBullets = this.physics.add.group();

        this.enemyTypes = [{
            spriteKey: '1', speedX: 10, sideMovementDistance: 200, speedY: 50,
            hitPoints: 30, hitPointsCurrent: 30, hitPointsBars: 3, hitPointsBarsCurrent: 3,
            hasGun: true, gunOption: 0, gunTarget: null
        }];
        this.gameStageController(this.gameStage);

        // Collision detection
        this.physics.add.overlap(this.playerBullets, this.enemies, this.bulletHitsEnemy, null, this);
        this.physics.add.overlap(this.playerBullets, this.asteroids, this.bulletHitsAsteroid, null, this);
        this.physics.add.overlap(this.enemyBullets, this.players, this.bulletHitsPlayer, null, this);
        this.physics.add.overlap(this.asteroids, this.players, this.bulletHitsPlayer, null, this);
        this.physics.add.overlap(this.enemyBullets, this.shields, this.bulletHitsPlayerShield, null, this);
        this.physics.add.overlap(this.players, this.powerups, this.collectPowerup, null, this);
        this.physics.add.overlap(this.players, this.coins, this.collectPowerup, null, this);
        this.setCoinTimer();
        this.setAsteroidTimer();
    }

    setCoinTimer() {
        if (!this.isGameOver) {
            if (this.spawnCoinTimerEvent) {
                this.spawnCoinTimerEvent.remove(false);
            }
            this.spawnCoinTimerEvent = this.time.addEvent({
                delay: Phaser.Math.Between(3000, 8000), // between 3-5 seconds,
                callback: () => {
                    let x = Phaser.Math.Between(0, this.screenWidth);
                    let y = Phaser.Math.Between(0, this.screenHeight);
                    if (!this.gameAllOver) {
                        if (this.coins.getLength() < 12) {
                            let coin = this.create_powerupObj('collectible', x, y);
                            coin.setScale(0.2);
                            this.moveObjectRandomly(coin, 100);
                        }
                        this.setCoinTimer(); // Reset the timer again
                    }
                },
                loop: false
            });
        }
    }

    setAsteroidTimer() {
        if (!this.isGameOver) {
            if (this.spawnAsteroidTimerEvent) {
                this.spawnAsteroidTimerEvent.remove(false);
            }
            this.spawnAsteroidTimerEvent = this.time.addEvent({
                delay: Phaser.Math.Between(3000, 8000), // between 3-5 seconds,
                callback: () => {
                    let x = Phaser.Math.Between(0, this.screenWidth);
                    let y = Phaser.Math.Between(0, this.screenHeight);
                    if (!this.gameAllOver) {
                        if (this.asteroids.getLength() < 4) {
                            let asteroid = this.create_powerupObj('avoidable', x, y);
                            asteroid.hitPointsCurrent = 3;
                            asteroid.setAlpha(0);
                            asteroid.setScale(0.1);
                            asteroid.name = 'avoidable';
                            this.tweens.add({
                                targets: asteroid,
                                alpha: 1,
                                scale: 0.04,
                                ease: 'linear',
                                duration: 500
                            });
                            this.moveObjectRandomly(asteroid, Phaser.Math.Between(100, 50), false, Phaser.Math.Between(3000, 8000));
                        }
                        this.setAsteroidTimer(); // Reset the timer again
                    }
                },
                loop: false
            });
        }
    }

    create_playerObj() {
        this.playerShip = this.add.sprite(this.screenWidth / 2, this.screenHeight * 1.2, 'player');
        this.players.add(this.playerShip);
        this.playerShip.setScale(0.3);
        let originalWidth = this.playerShip.width;
        let originalHeight = this.playerShip.height;
        let newWidth = originalWidth * 0.8; // 80% of the original width
        let newHeight = originalHeight * 0.7; // 70% of the original height
        this.playerShip.body.setSize(newWidth, newHeight);
        this.playerShip.targetX = this.playerShip.x;
        this.playerShip.targetY = this.playerShip.y;
        this.playerBullets = this.physics.add.group();
        this.playerShip.hitPoints = 10;
        this.playerShip.hitPointsCurrent = 10;
        let gunOptionsPlayer = {
            gunSpeed: 400,
            numberOfBullets: 1,
            shootingArc: 0,
            startingAngle: -90,
            shootingCooldown: 500,
            delay: 0
        };
        this.playerShip.gun = this.createGun(this.playerShip, 'projectile', this.playerBullets, gunOptionsPlayer);
    }

    createPlayerShield(x, y) {
        let shield = this.shields.create(x, y, 'shield');
        shield.setScale(this.gameScale);
        shield.hitPoints = 5;
        shield.hitPointsCurrent = shield.hitPoints;
        shield.flipY = true;
        return shield;
    }

    updatePlayerShieldPosition(player, shield, offsetY) {
        shield.x = player.x;
        shield.y = player.y + offsetY;
    }

    movePlayerToPointer(offsetX = 0, offsetY = 0) {
        let pointer = this.input.activePointer;
        if (pointer.x >= 0 && pointer.x <= this.screenWidth && pointer.y >= 0 && pointer.y <= this.screenHeight) {
            let prevTargetX = this.playerShip.x;
            this.playerShip.targetX = pointer.x;
            this.playerShip.targetY = pointer.y - offsetY;

            let movementDirection = this.playerShip.targetX - prevTargetX;
            if (movementDirection > 6) {
                this.playerShip.setFrame(this.playerSelected + 1);
            }
            else if (movementDirection < -6) {
                this.playerShip.setFrame(this.playerSelected - 1);
            }
            else {
                this.playerShip.setFrame(this.playerSelected);
            }
        }
        let factor = 0.14;
        this.playerShip.x += (this.playerShip.targetX - this.playerShip.x) * factor;
        this.playerShip.y += (this.playerShip.targetY - this.playerShip.y) * factor;
    }

    spawnObject(sprObj, x, y, flipX = false, flipY = false, funcToCall = null) {
        let obj = this.physics.add.sprite(x, y, sprObj);
        obj.setScale(this.gameScale);
        obj.flipX = flipX;
        obj.flipY = flipY;
        if (funcToCall) {
            funcToCall();
        }
        return obj;
    }

    createBullet(bulletArray, spr, gunObj, speed, direction) {
        let bullet = bulletArray.create(gunObj.x, gunObj.y, spr);
        this.physics.velocityFromAngle(direction, speed, bullet.body.velocity);
        bullet.setCollideWorldBounds(false);
        bullet.setDepth(-1);
        bullet.setScale(0.1);
        console.log(spr);
        if (spr == 'projectile') {
            let bubble = this.add.graphics({ x: -100, y: 0, add: false });
            const bubbleRadius = 10;
            const bubbleColor = 0xffffff; // A nice bubble color
            bubble.fillStyle(bubbleColor, 0.1); // Semi-transparent
            bubble.fillCircle(bubbleRadius, bubbleRadius, bubbleRadius);
            bubble.generateTexture('bubbles', 100, 100);
            let trail = this.add.particles(15, 15, 'bubbles', {
                speed: { min: 50, max: 100 },
                scale: { start: 0.3, end: 0 },
                blendMode: 'ADD',
                lifespan: 600,
                angle: -90,
                frequency: 10, // Emit particles more frequently
                quantity: 5,
            });
            trail.startFollow(bullet);
            bullet.emitter = trail;
        }
        bullet.body.onWorldBounds = true;
        this.physics.world.on('worldbounds', (body) => {
            if (body.gameObject === bullet) {
                bullet.destroy();
                // trail.destroy();
            }
        });
    }

    createBulletSpread(bulletArray, spr, gunObj, speed, numBullets, arcAngle, startAngle, delay = 0, clockwise = true) {
        if (numBullets === 1) {
            this.createBullet(bulletArray, spr, gunObj, speed, startAngle);
        }
        else {
            let halfArc = arcAngle / 2;
            let angleStep = arcAngle / (numBullets - 1);
            angleStep = clockwise ? angleStep * 1 : angleStep * -1;
            this.lastBulletTime = 0;
            for (let i = 0; i < numBullets; i++) {
                this.time.delayedCall(i * delay, () => {
                    let angle = startAngle - halfArc + angleStep * i;
                    this.createBullet(bulletArray, spr, gunObj, speed, angle);
                });
            }
        }
    }

    createGun(ship, bulletSpr, bulletArray, gunOptions) {
        let gun = {
            myShip: ship, bulletSprite: bulletSpr, myBulletArray: bulletArray, x: ship.x,
            y: ship.y, speed: gunOptions.gunSpeed, numBullets: gunOptions.numberOfBullets, arcAngle: gunOptions.shootingArc,
            startAngle: gunOptions.startingAngle, shootingCooldown: gunOptions.shootingCooldown,
            delay: gunOptions.delay, clockwise: gunOptions.clockwise, bulletsLastFireTime: 0,
            fire: function () {
                if (this.destroyed) {
                    return;
                }
                this.x = this.myShip.x;
                this.y = this.myShip.y;
                let time = this.scene.time.now;
                if (time >= this.bulletsLastFireTime + this.shootingCooldown) {
                    this.scene.createBulletSpread(this.myBulletArray,
                        this.bulletSprite,
                        this.myShip,
                        this.speed,
                        this.numBullets,
                        this.arcAngle,
                        this.startAngle,
                        this.delay,
                        this.clockwise
                    );
                    this.bulletsLastFireTime = time;
                }
            },
            scene: this,
            destroy: function () {
                this.myShip = null;
                this.bulletSprite = null;
                this.myBulletArray = null;
                this.destroyed = true;
            },
            destroyed: false
        };
        ship.on('destroy', function () {
            gun.destroy();
        });
        return gun;
    }

    moveEnemyBoss(object, pattern) {
        switch (pattern) {
            case 'horizontal':
                this.moveInPattern(object, this.screenWidth - object.x * 2, 4000, 0, 2000, true, true, Phaser.Math.Easing.Sine.InOut);
                break;
            default:
                console.error(`Pattern ${pattern} not recognized`);
                break;
        }
    }

    moveInPattern(object, distanceX, speedX, distanceY, speedY, startRight = true, yoyo = true, easing = 'linear', onComplete = null) {
        let targetXRight = object.x + distanceX;
        let targetXLeft = object.x - distanceX;
        let targetYDown = object.y + distanceY;
        let targetYUp = object.y - distanceY;

        object.tweenX = this.tweens.add({
            targets: object,
            x: startRight ? targetXRight : targetXLeft,
            ease: easing,
            duration: speedX,
            yoyo: onComplete ? false : yoyo,
            repeat: yoyo ? -1 : 0,
            flipX: true,
            onComplete: onComplete
        });

        object.tweenY = this.tweens.add({
            targets: object,
            y: startRight ? targetYDown : targetYUp,
            ease: easing,
            duration: speedY,
            yoyo: yoyo,
            repeat: yoyo ? -1 : 0,
            onComplete: onComplete
        });
    }

    moveObjectRandomly(object, speed, wrap = false, rotationTime = 0) {
        let randomAngle = Phaser.Math.Between(0, 360);
        this.physics.velocityFromAngle(randomAngle, speed, object.body.velocity);
        if (wrap) {
            object.wrap = wrap;
        }
        else {
            object.setCollideWorldBounds(true);
            object.setBounce(1);
        }

        if (rotationTime > 0) {
            object.rotationTime = rotationTime;
            this.tweens.add({
                targets: object,
                angle: 360,
                ease: 'Linear',
                duration: object.rotationTime,
                repeat: -1,
            });
        }
    }

    splitObj(bigObj, smallObjKey, objGroup, health = 0) {
        const bigObjVelocity = bigObj.body.velocity;
        const speed = Math.hypot(bigObjVelocity.x, bigObjVelocity.y);

        const smallObj1 = this.physics.add.image(bigObj.x, bigObj.y, smallObjKey).setScale(this.gameScale);
        smallObj1.name = smallObjKey;
        smallObj1.hitPointsCurrent = health;
        const smallObj2 = this.physics.add.image(bigObj.x, bigObj.y, smallObjKey).setScale(this.gameScale);
        smallObj2.name = smallObjKey;
        smallObj2.hitPointsCurrent = health;
        objGroup.add(smallObj1);
        objGroup.add(smallObj2);

        this.moveObjectRandomly(smallObj1, speed, bigObj.wrap, bigObj.rotationTime * 0.8);
        this.moveObjectRandomly(smallObj2, speed, bigObj.wrap, bigObj.rotationTime * 0.8);

        bigObj.destroy();
    }

    moveAlongBorder(obj, speed, margin, clockwise) {
        const directions = clockwise ? [
            { prop: 'x', target: this.cameras.main.width - margin, rotation: 90 },
            { prop: 'y', target: this.cameras.main.height - margin, rotation: 180 },
            { prop: 'x', target: margin, rotation: 270 },
            { prop: 'y', target: margin, rotation: 0 },
        ] : [
            { prop: 'y', target: this.cameras.main.height - margin, rotation: 180 },
            { prop: 'x', target: this.cameras.main.width - margin, rotation: 90 },
            { prop: 'y', target: margin, rotation: 0 },
            { prop: 'x', target: margin, rotation: 270 },
        ];

        const makeTween = (direction, onComplete) => {
            const duration = Math.abs(direction.target - obj[direction.prop]) / speed * 1000;

            this.tweens.add({
                targets: obj,
                [direction.prop]: direction.target,
                ease: 'Linear',
                duration: duration,
                onComplete: () => {
                    obj.rotation = Phaser.Math.DegToRad(direction.rotation);
                    onComplete();
                }
            });
        };

        const move = (directionIndex) => {
            makeTween(directions[directionIndex], () => {
                move((directionIndex + 1) % directions.length);
            });
        };

        move(0);
    }

    spawnEnemy(enemyType, x, y) {
        let enemy = this.enemies.create(x, y, 'enemy');
        enemy.setFrame(enemyType.spriteKey);
        enemy.setScale(0.4);
        enemy.hitPoints = enemyType.hitPoints;
        enemy.hitPointsCurrent = enemyType.hitPointsCurrent;
        enemy.hitPointsBars = enemyType.hitPointsBars;
        enemy.hitPointsBarsCurrent = enemyType.hitPointsBarsCurrent;
        enemy.speedX = enemyType.speedX;
        enemy.speedY = enemyType.speedY;
        enemy.sideMovementDistance = enemyType.sideMovementDistance;
        enemy.hasGun = enemyType.hasGun;
        enemy.gunOption = enemyType.gunOption;
        enemy.gunTarget = enemyType.gunTarget;

        let gunOptionsEnemy = [{
            gunSpeed: 60, numberOfBullets: 4,
            shootingArc: 35, startingAngle: 90,
            shootingCooldown: 1500, delay: 50
        }];
        enemy.gun = this.createGun(enemy, 'projectile_1', this.enemyBullets, gunOptionsEnemy[enemy.gunOption]);
        return enemy;
    }

    enemyShootAtTarget(enemy) {
        if (enemy.gun && (enemy.y > 10 && enemy.y < this.screenHeight - 100)) {
            if (enemy.gunTarget) {
                enemy.gun.startAngle = Phaser.Math.RadToDeg(Phaser.Math.Angle.Between(enemy.x, enemy.y, enemy.gunTarget.x, enemy.gunTarget.y));
            }
            else {
                enemy.gun.startAngle = Phaser.Math.RadToDeg(enemy.rotation) + 90;
            }
            enemy.gun.myBulletArray.getChildren().forEach(function (bullete) {
                bullete.setScale(0.1);
            });
            enemy.gun.fire();
        }
    }

    drawHealthBar(obj, totalHitpoints, currentHitpoints, color, emptyColor, offsetY = -20, size) {
        let healthBarTotalLength = obj.width * size;
        let healthBarCurrentLength = (healthBarTotalLength / totalHitpoints) * currentHitpoints;
        this.graphics.fillStyle(emptyColor, 1);
        this.graphics.fillRect(obj.x - healthBarTotalLength / 2, obj.y - offsetY, healthBarTotalLength, 5);
        this.graphics.fillStyle(color, 1);
        this.graphics.fillRect(obj.x - healthBarTotalLength / 2, obj.y - offsetY, healthBarCurrentLength, 5);
    }

    drawEnemyHealthBars(enemy) {
        const healthBarWidth = 10; // You can change this to the width of each health bar
        const healthPerBar = enemy.hitPoints / enemy.hitPointsBars;
        for (let i = 0; i < enemy.hitPointsBars; i++) {
            let currentHealthInThisBar = Math.max(0, Math.min(healthPerBar, enemy.hitPointsCurrent - (i * healthPerBar)));
            this.drawHealthBar(enemy, healthPerBar, currentHealthInThisBar, 0x00ff00, 0xff0000, 90 + (i * healthBarWidth), this.gameScale);
        }
    }

    bulletHitsEnemy(bullet, enemy) {
        if (bullet.emitter) {
            bullet.emitter.stop();  // Stop emitting new particles
            bullet.emitter = null;  // Clear the reference to help with garbage collection
        }
        bullet.destroy();
        enemy.hitPointsCurrent -= 1;
        this.sounds.damage.setVolume(0.1).setLoop(false).play();

        if (enemy.hitPointsCurrent <= ((enemy.hitPoints / enemy.hitPointsBars) * (enemy.hitPointsBarsCurrent - 1))) {
            enemy.hitPointsBarsCurrent -= 1;
            if (enemy.hitPointsBarsCurrent >= 0) {
                let powerupTypes = ['pink_heart', 'blue_shield'];
                let chosenPowerup = Phaser.Utils.Array.GetRandom(powerupTypes);
                this.create_powerupObj(chosenPowerup, enemy.x, enemy.y);
            }
            if (enemy.hitPointsCurrent <= 0) {
                this.gameStage += 1;
                enemy.destroy();
                this.gameStageController(this.gameStage);
            }
        }
    }

    bulletHitsAsteroid(bullet, asteroid) {
        bullet.destroy();
        asteroid.destroy();
    }

    bulletHitsPlayer(bullet, player) {
        if (bullet.emitter) {
            bullet.emitter.stop();
            bullet.emitter = null;
        }
        bullet.destroy();
    
        // Flash the screen red for 50ms
        this.cameras.main.flash(50, 255, 0, 0);
    
        // Prevent repeated collision processing
        if (player.invulnerable) return;
        player.invulnerable = true;
        this.time.delayedCall(500, () => {
            player.invulnerable = false;
        }, [], this);
    
        this.vfx.shakeCamera();
        this.sounds.damage.setVolume(0.1).setLoop(false).play();
    
        // Subtract one life and update UI
        player.lives -= 1;
        this.updateLivesUI();
        if (player.lives <= 0) {
            player.destroy();
            this.gameAllOver = true;
            this.resetGame();
        }
    }
    

    bulletHitsPlayerShield(bullet, shield) {
        if (bullet.emitter) {
            bullet.emitter.stop();  // Stop emitting new particles
            bullet.emitter = null;  // Clear the reference
        }
        bullet.destroy();
        shield.hitPointsCurrent -= 1;
        shield.alpha = shield.hitPointsCurrent / shield.hitPoints;
        if (shield.hitPointsCurrent <= 0) {
            shield.destroy();
        }
        else {
            this.time.delayedCall(100, () => {
                shield.alpha = shield.hitPointsCurrent / shield.hitPoints + 0.2;
            });
            shield.alpha = 0.5;
        }
    }

    create_powerupObj(spr, x, y) {
        let powerup = this.physics.add.sprite(x, y, spr);
        powerup.name = spr;
        switch (powerup.name) {
            case "collectible":
                this.coins.add(powerup);
                break;
            case "avoidable":
                this.asteroids.add(powerup);
                break;
            default:
                this.powerups.add(powerup);
                break;
        }
        powerup.setScale(this.gameScale);
        this.moveObjectRandomly(powerup, 100);
        return powerup;
    }

collectPowerup(player, powerup) {
    let pupName = powerup.name;
    switch (pupName) {
        case "collectible":
            this.gameCoinScore += 100;
            this.updateScore(100);
            this.displayFadeAwayText("+100", powerup.x, powerup.y);
            this.sounds.collect.setVolume(0.2).setLoop(false).play();
            // Golden flash when collecting a coin
            this.cameras.main.flash(50, 255, 215, 0);
            break;
        case "blue_shield":
            this.createPlayerShield(player.x, player.y + 350);
            this.sounds.collect.setVolume(0.2).setLoop(false).play();
            break;
        case "pink_heart":
            // Add an extra life and create a new heart icon just after the currently visible hearts.
            player.lives++;
            let activeCount = this.lifeIcons.filter(heart => heart.visible).length;
            let newHeart = this.add.image(10 + activeCount * 40, 10, 'pink_heart').setOrigin(0, 0);
            newHeart.setScale(0.5);
            this.lifeIcons.push(newHeart);
            this.sounds.collect.setVolume(0.2).setLoop(false).play();
            // Green flash when collecting a heart
            this.cameras.main.flash(50, 0, 255, 0);
            break;
        default:
            console.error(`Powerup ${pupName} not recognized`);
            break;
    }
    powerup.destroy();
}


    displayFadeAwayText(text, x, y) {
        let displayText = this.add.bitmapText(x, y, 'pixelfont', text, 32) // 32 is the font size; adjust as needed
                            .setOrigin(0.5, 0.5)
                            .setTint(0xFFD700); // Golden tint
        this.tweens.add({
            targets: displayText,
            y: y - 30,
            alpha: 0,
            ease: 'linear',
            duration: 700,
            onComplete: () => displayText.destroy()
        });
    }
    
    
    
    // New function: updateLivesUI with animation for disappearing hearts
    updateLivesUI() {
        for (let i = 0; i < this.lifeIcons.length; i++) {
            if (i < this.playerShip.lives) {
                // Ensure the heart is visible and reset its alpha if needed.
                if (!this.lifeIcons[i].visible) {
                    this.lifeIcons[i].setVisible(true);
                    this.lifeIcons[i].alpha = 1;
                }
            } else {
                // If the heart is visible, animate it upward and fade out, then hide it.
                if (this.lifeIcons[i].visible && this.lifeIcons[i].alpha === 1) {
                    this.tweens.add({
                        targets: this.lifeIcons[i],
                        y: this.lifeIcons[i].y - 20,
                        alpha: 0,
                        duration: 500,
                        ease: 'Linear',
                        onComplete: () => {
                            this.lifeIcons[i].setVisible(false);
                            this.lifeIcons[i].alpha = 1;
                        }
                    });
                }
            }
        }
    }

    gameStageController(gameStage) {
        switch (gameStage) {
            case 0:
                let boss2 = this.spawnEnemy(this.enemyTypes[0], this.screenWidth / 8, -this.screenHeight / 6 + 100);
                this.tweens.add({
                    targets: boss2,
                    y: this.screenHeight / 6 + 50, // change this to the y position you want
                    ease: 'Power1',
                    duration: 2000, // change this to the duration you want
                    onComplete: () => this.moveEnemyBoss(boss2, 'horizontal')
                });
                break;
            default:
                this.sounds.background.stop();
                this.sounds.success.setVolume(1).setLoop(false).play();
                this.gameAllOver = true;
                this.gameWin = true;
                this.resetGame();
                break;
        }
    }

    update() {
        this.graphics.clear();
        // Enemy update section
        if (this.enemies) {
            this.enemies.getChildren().forEach(enemy => {
                if (enemy.hasGun && !this.gameAllOver)
                    this.enemyShootAtTarget(enemy);
                this.drawEnemyHealthBars(enemy);
            });
        }
        // Powerups update section
        this.asteroids.getChildren().forEach((asteroid) => {
            if (asteroid.wrap) {
                this.physics.world.wrap(asteroid, 100);
            }
        });
        // Player update section
        if (this.playerShip && !this.gameAllOver) {
            if (this.gameStarted) {
                this.movePlayerToPointer(0, 16);
                this.playerShip.gun.fire();
            }
            this.drawHealthBar(this.playerShip,
                this.playerShip.hitPoints,
                this.playerShip.hitPointsCurrent,
                0x00ff00, 0xff0000, 55, 0.1);
            this.shields.getChildren().forEach(shield => {
                if (this.playerShip) {
                    this.updatePlayerShieldPosition(this.playerShip, shield, -30);
                }
                else
                    shield.destroy();
            });
        }
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(this.score);
    }

    resetGame() {
        this.isGameOver = true;
        this.score = 0;
        this.vfx.shakeCamera();
        if (this.gameWin) {
            let gameWINText = this.add.bitmapText(this.cameras.main.centerX, this.cameras.main.centerY - 500, 'pixelfont', 'Congratulations!!!', 24)
                .setOrigin(0.5)
                .setVisible(false)
                .setAngle(-15)
                .setDepth(10)
                .setTint(0xffff00);
            this.time.delayedCall(500, () => {
                this.sounds.lose.setVolume(0.5).setLoop(false).play();
                gameWINText.setVisible(true);
                this.tweens.add({
                    targets: gameWINText,
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
        } else {
            let gameOverText = this.add.bitmapText(this.cameras.main.centerX, this.cameras.main.centerY - 200, 'pixelfont', 'Game Over', 64)
                .setOrigin(0.5)
                .setVisible(false)
                .setAngle(-15)
                .setTint(0xFF0000);

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
    }

    gameOver() {
        initiateGameOver.bind(this)({ score: this.gameCoinScore });
    }

    pauseGame() {
        handlePauseGame.bind(this)();
    }
}

const orientationSizes = {
    "landscape": {
        "width": 1280,
        "height": 720,
    },
    "portrait": {
        "width": 720,
        "height": 1280,
    }
};

// Game Orientation
const orientation = "landscape";

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
        // console.log(file.src);
    });
    this.load.on('complete', function () {
        progressBar.destroy();
        progressBox.destroy();
        loadingText.destroy();
    });
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
            gravity: { y: 0 },
            debug: false,
        },
    },
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions,
    },
    orientation: _CONFIG.deviceOrientation === "landscape"
};
