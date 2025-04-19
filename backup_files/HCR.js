// Touch Screen Controls
const joystickEnabled = false;
const buttonEnabled = true;
var isMobile = false;
const gameOptions = {
    startTerrainHeight: 0.6,
    amplitude: 150,
    slopeLength: [150, 350],
    mountainsAmount: 3,
    slopesPerMountain: 10,
    carAcceleration: [0.01, -0.01],
    maxCarVelocity: 0.8,
    fuelSpawnTime: 15,
};

const rexJoystickUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js";
const rexButtonUrl = "https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexbuttonplugin.min.js";

// Helper function: Draw a gauge pointer given a graphics object, center, pointer length and angle.
function drawPointer(graphics, centerX, centerY, length, angleDeg) {
    graphics.clear();
    graphics.lineStyle(4, 0xffffff, 1);
    // Convert degrees to radians and compute end point
    let angle = Phaser.Math.DegToRad(angleDeg);
    let endX = centerX + length * Math.cos(angle);
    let endY = centerY + length * Math.sin(angle);
    graphics.lineBetween(centerX, centerY, endX, endY);
}

// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        addEventListenersPhaser.bind(this)();
        this.score = 0;

        if (buttonEnabled) this.load.plugin('rexbuttonplugin', rexButtonUrl, true);

        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        
        this.load.atlas('brakePedal', 'https://aicade-user-store.s3.amazonaws.com/6994335331/games/nCHTvXMyqtIdO4kH/assets/images/breakes.png?t=1742286073193', 'https://aicade-ui-assets.s3.amazonaws.com/nishchal/games/breaks/history/json/dzb89wXm9WWT.json');
        this.load.atlas('gasPedal', 'https://aicade-user-store.s3.amazonaws.com/6994335331/games/nCHTvXMyqtIdO4kH/assets/images/gas.png?t=1742286021661', 'https://aicade-ui-assets.s3.amazonaws.com/nishchal/games/gas/history/json/srC4LL1aAAPy.json');
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");

        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/";
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        // Make sure that the assets used for fuel/collectibles and coins are loaded.
        // For example, here we assume that "collectible" is the fuel icon and "coin" is the coin icon.
        // (They should exist in _CONFIG.imageLoader or be added manually.)
        
        displayProgressLoader.call(this);
    }

    create() {
        // Create keyboard cursors
        this.cursors = this.input.keyboard.createCursorKeys();

        // Initialize mobile flag and new accelerating flag for mobile support.
        isMobile = !this.sys.game.device.os.desktop;
        this.isAccelerating = false; // Flag to handle mobile gas pedal input

        // Sound setup
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }
    
        this.flipped = false;
        this.hasJumped = false;
        this.frontWheelGrounded = false;
        this.rearWheelGrounded = false;
    
        this.sounds.background.setVolume(0.1).setLoop(true).play();
        this.carSound = this.sounds.move.setVolume(1).setLoop(true);
    
        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.bg = this.add.sprite(0, 0, 'background').setOrigin(0, 0);
        this.bg.setScrollFactor(0);
        this.bg.displayHeight = this.height;
        this.bg.displayWidth = this.width;
    
        this.scoreText = this.add.bitmapText(this.width / 2, 100, 'pixelfont', '0', 128).setOrigin(0.5, 0.5);
        this.scoreText.setDepth(11);
    
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
    
        this.pauseButton = this.add.sprite(this.game.config.width - 60, 60, "pauseButton").setOrigin(0.5, 0.5);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(3);
        this.pauseButton.on('pointerdown', () => this.pauseGame());
    
        this.mountainGraphics = [];
        this.bodyPool = [];
        this.bodyPoolId = [];
        this.mountainStart = new Phaser.Math.Vector2(-200, 0);
    
        try {
            for (let i = 0; i < gameOptions.mountainsAmount; i++) {
                this.mountainGraphics[i] = this.add.graphics();
                this.mountainStart = this.generateTerrain(this.mountainGraphics[i], this.mountainStart);
            }
        } catch (error) {
            console.error("Error generating terrain:", error);
        }
    
        this.addPlayer();
        // Group for fuel collectibles (existing)
        this.collectibles = this.add.group();
        // New group for coin collectibles
        this.coinCollectibles = this.add.group();
        // Coin counter variable
        this.coinsCollected = 0;
    
        // --- Fuel Container at Top Left ---
        // Positions and sizes are manually adjustable by editing the x,y values.
        this.fuelBarBg = this.add.rectangle(100, 50, 200, 40, 0x333333)
            .setOrigin(0, 0.5)
            .setDepth(100)
            .setScrollFactor(0);
        this.fuelBar = this.add.rectangle(100, 50, 200, 40, 0x00ff00)
            .setOrigin(0, 0.5)
            .setDepth(101)
            .setScrollFactor(0);
        // Fuel asset icon is placed relative to the fuel bar.
        this.fuelIcon = this.add.image(40, 50, 'collectible')
            .setScale(0.3)
            .setOrigin(0.5)
            .setScrollFactor(0);
        
        // --- Draw Bold Black Boundary around Fuel Bar ---
        // This creates a new graphics object that draws a bold black rectangle around the fuel bar.
        this.fuelBarBorder = this.add.graphics();
        this.fuelBarBorder.lineStyle(4, 0x000000, 1);
        // Draw rectangle with same x,y and dimensions as fuel bar background.
        this.fuelBarBorder.strokeRect(100 - 1, 50 - 20, 200 + 2, 40 + 2);
    
        // --- Coin Container (Below Fuel Container) ---
        // The coin asset is placed on the left and the counter text to its right.
        // You can manually change coin container position by editing these coordinates.
        this.coinIcon = this.add.image(40, 120, 'coin')
            .setScale(0.28)
            .setOrigin(0.5)
            .setScrollFactor(0);
        this.coinText = this.add.bitmapText(100, 120, 'pixelfont', '0', 32)
            .setOrigin(0, 0.5)
            .setDepth(100)
            .setScrollFactor(0);
    
        this.lowFuel = this.add.bitmapText(this.width / 2, this.height / 2, 'pixelfont', "LOW FUEL", 64)
            .setOrigin(0.5, 0.5)
            .setDepth(100)
            .setVisible(false);
    
        this.anims.create({
            key: 'brakeNormal',
            frames: [{ key: 'brakePedal', frame: 'pedal-brake-normal.png' }],
            frameRate: 1,
            repeat: 0
        });
        this.anims.create({
            key: 'brakePressed',
            frames: [{ key: 'brakePedal', frame: 'pedal-brake-pressed.png' }],
            frameRate: 1,
            repeat: 0
        });
        this.anims.create({
            key: 'gasNormal',
            frames: [{ key: 'gasPedal', frame: 'pedal-gas-normal.png' }],
            frameRate: 1,
            repeat: 0
        });
        this.anims.create({
            key: 'gasPressed',
            frames: [{ key: 'gasPedal', frame: 'pedal-gas-pressed.png' }],
            frameRate: 1,
            repeat: 0
        });
    
        this.createSpriteButtons();
    
        this.cameraUI = this.cameras.add(0, 0, this.width, this.height);
        const ignoredElements = [
            this.pauseButton,
            this.scoreText,
            this.lowFuel,
            this.boostButton,
            this.brakeButton,
            this.fuelBarBg,
            this.fuelBar,
            this.fuelIcon,
            this.coinIcon,
            this.coinText,
            this.fuelBarBorder
        ];
        this.cameras.main.ignore(ignoredElements);
        this.cameraUI.ignore(this.children.list.filter(item => !ignoredElements.includes(item)));
    
        this.input.keyboard.disableGlobalCapture();

        // --- Create Circular Gauges (unchanged) ---
        // Increase gauge size: set radius to 90.
        this.gaugeRadius = 90;
        this.tickCount = 5; // 5 tick marks
        // Define the arc from -135° (left) to 45° (right)
        this.gaugeMinAngle = -135;
        this.gaugeMaxAngle = 45;
        // Set positions with additional offset for spacing:
        this.speedGaugeCenter = { x: this.width / 2 - 130, y: this.height - 100 };
        this.fuelGaugeCenter  = { x: this.width / 2 + 130, y: this.height - 100 };

        // Create background graphics for speed gauge
        this.speedGauge = this.add.graphics();
        this.speedGauge.lineStyle(6, 0xffffff, 1);
        this.speedGauge.fillStyle(0x000000, 0.5);
        this.speedGauge.strokeCircle(this.speedGaugeCenter.x, this.speedGaugeCenter.y, this.gaugeRadius);
        this.speedGauge.fillCircle(this.speedGaugeCenter.x, this.speedGaugeCenter.y, this.gaugeRadius);
        // Draw tick marks for speed gauge
        for (let i = 0; i < this.tickCount; i++) {
            let t = i / (this.tickCount - 1);
            let angle = Phaser.Math.Linear(this.gaugeMinAngle, this.gaugeMaxAngle, t);
            let rad = Phaser.Math.DegToRad(angle);
            let tickStart = this.gaugeRadius - 10;
            let tickEnd = this.gaugeRadius;
            let sx = this.speedGaugeCenter.x + tickStart * Math.cos(rad);
            let sy = this.speedGaugeCenter.y + tickStart * Math.sin(rad);
            let ex = this.speedGaugeCenter.x + tickEnd * Math.cos(rad);
            let ey = this.speedGaugeCenter.y + tickEnd * Math.sin(rad);
            this.speedGauge.lineBetween(sx, sy, ex, ey);
        }
        // Draw red alert arc in speedometer between tick 4 and tick 5 (from 0° to 45°)
        this.speedAlert = this.add.graphics();
        this.speedAlert.lineStyle(4, 0xff0000, 1);
        this.speedAlert.beginPath();
        this.speedAlert.arc(this.speedGaugeCenter.x, this.speedGaugeCenter.y, this.gaugeRadius - 6, Phaser.Math.DegToRad(0), Phaser.Math.DegToRad(45), false);
        this.speedAlert.strokePath();

        // Create background graphics for fuel gauge
        this.fuelGauge = this.add.graphics();
        this.fuelGauge.lineStyle(6, 0xffffff, 1);
        this.fuelGauge.fillStyle(0x000000, 0.5);
        this.fuelGauge.strokeCircle(this.fuelGaugeCenter.x, this.fuelGaugeCenter.y, this.gaugeRadius);
        this.fuelGauge.fillCircle(this.fuelGaugeCenter.x, this.fuelGaugeCenter.y, this.gaugeRadius);
        // Draw tick marks for fuel gauge
        for (let i = 0; i < this.tickCount; i++) {
            let t = i / (this.tickCount - 1);
            let angle = Phaser.Math.Linear(this.gaugeMinAngle, this.gaugeMaxAngle, t);
            let rad = Phaser.Math.DegToRad(angle);
            let tickStart = this.gaugeRadius - 10;
            let tickEnd = this.gaugeRadius;
            let sx = this.fuelGaugeCenter.x + tickStart * Math.cos(rad);
            let sy = this.fuelGaugeCenter.y + tickStart * Math.sin(rad);
            let ex = this.fuelGaugeCenter.x + tickEnd * Math.cos(rad);
            let ey = this.fuelGaugeCenter.y + tickEnd * Math.sin(rad);
            this.fuelGauge.lineBetween(sx, sy, ex, ey);
        }
        // Draw red alert arc in fuel meter between tick 1 and tick 2 (from -135° to -90°)
        this.fuelAlert = this.add.graphics();
        this.fuelAlert.lineStyle(4, 0xff0000, 1);
        this.fuelAlert.beginPath();
        this.fuelAlert.arc(this.fuelGaugeCenter.x, this.fuelGaugeCenter.y, this.gaugeRadius - 6, Phaser.Math.DegToRad(-135), Phaser.Math.DegToRad(-90), false);
        this.fuelAlert.strokePath();

        // Create pointer graphics (one for each gauge)
        this.speedPointer = this.add.graphics();
        this.fuelPointer = this.add.graphics();
        // Set initial pointer positions: speed pointer at minimum and fuel pointer at maximum.
        drawPointer(this.speedPointer, this.speedGaugeCenter.x, this.speedGaugeCenter.y, this.gaugeRadius - 15, this.gaugeMinAngle);
        drawPointer(this.fuelPointer, this.fuelGaugeCenter.x, this.fuelGaugeCenter.y, this.gaugeRadius - 15, this.gaugeMaxAngle);
        // Save the starting angle for the speedometer pointer.
        this.currentSpeedAngle = this.gaugeMinAngle;

        // --- Set up timer events for fuel and coin spawning ---
        this.timer = this.time.addEvent({
            delay: Phaser.Math.Between(8000, 12000),
            loop: true,
            callback: this.spawnCollectible,
            callbackScope: this
        });
        this.coinTimer = this.time.addEvent({
            delay: Phaser.Math.Between(10000, 15000),
            loop: true,
            callback: this.spawnCoins,
            callbackScope: this
        });
    
        this.matter.world.on('collisionstart', function (event) {
            event.pairs.forEach(function (pair) {
                let gameObjA = pair.bodyA.gameObject;
                let gameObjB = pair.bodyB.gameObject;
                
                if (gameObjA && (this.collectibles.contains(gameObjA) || this.coinCollectibles.contains(gameObjA)) && pair.bodyB.isStatic) {
                    this.matter.body.setStatic(pair.bodyA, true);
                }
                if (gameObjB && (this.collectibles.contains(gameObjB) || this.coinCollectibles.contains(gameObjB)) && pair.bodyA.isStatic) {
                    this.matter.body.setStatic(pair.bodyB, true);
                }
                
                let bodies = [gameObjA, gameObjB];
                if (bodies.includes(this.body) || bodies.includes(this.frontWheel) || bodies.includes(this.rearWheel)) {
                    var collectible = (bodies[0] === this.body || bodies[0] === this.frontWheel || bodies[0] === this.rearWheel) ? bodies[1] : bodies[0];
                    if (this.collectibles.contains(collectible)) {
                        collectible.destroy();
                        this.sounds.collect.setVolume(1).setLoop(false).play();
                        this.centerText = this.add.bitmapText(this.width / 2, this.height / 2, 'pixelfont', "FUEL +10", 64)
                            .setOrigin(0.5, 0.5)
                            .setDepth(100);
                        
                        const currentProgress = this.timerEvent ? this.timerEvent.getProgress() : 0;
                        const timeExtension = 10000;
                        const totalTime = this.timerEvent ? this.timerEvent.delay : 20000;
                        const newProgress = Math.max(0, currentProgress - (timeExtension / totalTime));
                        
                        this.timerEvent.reset({
                            delay: totalTime,
                            elapsed: newProgress * totalTime,
                            callback: () => this.gameOver(),
                            callbackScope: this,
                            loop: false
                        });
                        this.time.delayedCall(1000, () => this.centerText.destroy());
                    }
                    else if (this.coinCollectibles.contains(collectible)) {
                        collectible.destroy();
                        this.coinsCollected++;
                        this.coinText.setText(this.coinsCollected.toString()); // <-- ADD THIS LINE
                        this.sounds.collect.setVolume(1).setLoop(false).play();
                    }
                    
                }
                
                const isFrontWheel = pair.bodyA.gameObject === this.frontWheelBody || pair.bodyB.gameObject === this.frontWheelBody;
                const isRearWheel = pair.bodyA.gameObject === this.rearWheelBody || pair.bodyB.gameObject === this.rearWheelBody;
                const otherBody = isFrontWheel ? (pair.bodyA.gameObject === this.frontWheelBody ? pair.bodyB.gameObject : pair.bodyA.gameObject) :
                                   (isRearWheel ? (pair.bodyA.gameObject === this.rearWheelBody ? pair.bodyB.gameObject : pair.bodyA.gameObject) : null);
                if (otherBody && this.bodyPool.includes(otherBody)) {
                    if (isFrontWheel) this.frontWheelGrounded = true;
                    if (isRearWheel) this.rearWheelGrounded = true;
                }
            }, this);
        }, this);
        
    
        this.matter.world.on('collisionend', function (event) {
            event.pairs.forEach(function (pair) {
                const isFrontWheel = pair.bodyA.gameObject === this.frontWheelBody || pair.bodyB.gameObject === this.frontWheelBody;
                const isRearWheel = pair.bodyA.gameObject === this.rearWheelBody || pair.bodyB.gameObject === this.rearWheelBody;
                const otherBody = isFrontWheel ? (pair.bodyA.gameObject === this.frontWheelBody ? pair.bodyB.gameObject : pair.bodyA.gameObject) : 
                                (isRearWheel ? (pair.bodyA.gameObject === this.rearWheelBody ? pair.bodyB.gameObject : pair.bodyA.gameObject) : null);
    
                if (otherBody && this.bodyPool.includes(otherBody)) {
                    if (isFrontWheel) this.frontWheelGrounded = false;
                    if (isRearWheel) this.rearWheelGrounded = false;
                }
            }, this);
        }, this);
    
        this.velocity = 0;
        this.acceleration = 0;
        this.targetAcceleration = 0;
        this.decelerationRate = 0.0002;
        this.brakeHeldTime = 0;
    
        this.timerEvent = this.time.addEvent({
            delay: 20000,
            callback: () => this.gameOver(),
            callbackScope: this,
            loop: false
        });
    
        // --- Update gauge pointers in update() ---
    }
    
    createSpriteButtons() {
        // Increase the scale for pedals from 0.5 to 0.7 for both mobile and PC.
        this.boostButton = this.add.sprite(this.width - 100, this.height - 100, 'gasPedal', 'pedal-gas-normal.png')
            .setOrigin(0.5, 0.5)
            .setScale(0.7)
            .setDepth(100)
            .setScrollFactor(0);
        this.boostButton.setInteractive({ cursor: 'pointer' });
        this.boostButton.on('pointerdown', () => {
            this.accelerate();
            this.boostButton.play('gasPressed');
        }, this);
        this.boostButton.on('pointerup', () => {
            this.decelerate();
            this.boostButton.play('gasNormal');
        }, this);
        this.boostButton.on('pointerout', () => {
            this.decelerate();
            this.boostButton.play('gasNormal');
        }, this);
    
        this.brakeButton = this.add.sprite(100, this.height - 100, 'brakePedal', 'pedal-brake-normal.png')
            .setOrigin(0.5, 0.5)
            .setScale(0.7)
            .setDepth(100)
            .setScrollFactor(0);
        this.brakeButton.setInteractive({ cursor: 'pointer' });
        this.brakeButton.on('pointerdown', () => {
            this.brake();
            this.brakeButton.play('brakePressed');
        }, this);
        this.brakeButton.on('pointerup', () => {
            this.stopBraking();
            this.brakeButton.play('brakeNormal');
        }, this);
        this.brakeButton.on('pointerout', () => {
            this.stopBraking();
            this.brakeButton.play('brakeNormal');
        }, this);
    
        this.input.keyboard.on("keydown-RIGHT", () => {
            this.accelerate();
            this.boostButton.play('gasPressed');
        }, this);
        this.input.keyboard.on("keyup-RIGHT", () => {
            this.decelerate();
            this.boostButton.play('gasNormal');
        }, this);
        this.input.keyboard.on("keydown-LEFT", () => {
            this.brake();
            this.brakeButton.play('brakePressed');
        }, this);
        this.input.keyboard.on("keyup-LEFT", () => {
            this.stopBraking();
            this.brakeButton.play('brakeNormal');
        }, this);
    
        this.toggleControlsVisibility(true);
        this.boostButton.visible = true;
        this.brakeButton.visible = true;
    }

    toggleControlsVisibility(visibility) {
        this.boostButton.visible = visibility;
        this.brakeButton.visible = visibility;
    }

    update() {
        // Update camera scroll
        this.cameras.main.scrollX = this.body.x - this.width / 8;
    
        const accelerationStep = 0.0001;
        if (this.acceleration < this.targetAcceleration) {
            this.acceleration = Math.min(this.acceleration + accelerationStep, this.targetAcceleration);
        } else if (this.acceleration > this.targetAcceleration) {
            this.acceleration = Math.max(this.acceleration - accelerationStep, this.targetAcceleration);
        }
    
        if (this.targetAcceleration === 0 && (!this.brakeButton.input || !this.brakeButton.input.isDown)) {
            if (this.velocity > 0) {
                this.velocity = Math.max(this.velocity - this.decelerationRate, 0);
            } else if (this.velocity < 0) {
                this.velocity = Math.min(this.velocity + this.decelerationRate, 0);
            }
        } else {
            this.velocity += this.acceleration;
        }
    
        if (this.brakeButton && this.brakeButton.input && this.brakeButton.input.isDown) {
            this.brakeHeldTime += this.time.deltaTime / 1000;
            if (this.velocity <= 0) {
                this.targetAcceleration = gameOptions.carAcceleration[1];
            }
        }
    
        this.velocity = Phaser.Math.Clamp(this.velocity, -gameOptions.maxCarVelocity, gameOptions.maxCarVelocity);
    
        const angle = this.playerBody.angle;
        const isAirborne = !this.frontWheelGrounded && !this.rearWheelGrounded;
    
        // Airborne physics
        if (isAirborne) {
            if (!this.hasJumped) {
                this.hasJumped = true;
                const jumpForce = Math.abs(this.velocity) * 8;
                const jumpVelocityY = -5 - (jumpForce > 4 ? 4 : jumpForce);
                this.matter.body.setVelocity(this.playerBody, {
                    x: this.playerBody.velocity.x * 1.1,
                    y: jumpVelocityY
                });
                this.matter.body.setAngularVelocity(this.playerBody, 0);
            }
            if (this.cursors.right.isDown) {
                let newAngVel = this.playerBody.angularVelocity - 0.005;
                newAngVel = Phaser.Math.Clamp(newAngVel, -0.3, 0.3);
                this.matter.body.setAngularVelocity(this.playerBody, newAngVel);
            }
            else if (this.cursors.left.isDown) {
                let newAngVel = this.playerBody.angularVelocity + 0.005;
                newAngVel = Phaser.Math.Clamp(newAngVel, -0.3, 0.3);
                this.matter.body.setAngularVelocity(this.playerBody, newAngVel);
            }
        }
        else {
            this.hasJumped = false;
            if (Math.abs(angle) > Math.PI / 6) {
                const correctionDirection = angle > 0 ? -1 : 1;
                this.matter.body.setAngularVelocity(this.playerBody, correctionDirection * 0.1);
            }
        }
    
        const velocityScale = 10;
        this.matter.body.setVelocity(this.playerBody, {
            x: this.velocity * velocityScale,
            y: this.playerBody.velocity.y
        });
        
        this.matter.body.setAngularVelocity(this.frontWheelBody, this.velocity);
        this.matter.body.setAngularVelocity(this.rearWheelBody, this.velocity);
    
        this.playerBody.friction = 0.3;
        this.frontWheelBody.friction = 0.8;
        this.rearWheelBody.friction = 0.8;
        
        if (this.boostButton.input && this.boostButton.input.isDown) {
            this.accelerate();
        }
    
        if (Array.isArray(this.mountainGraphics)) {
            this.mountainGraphics.forEach(function (item) {
                if (this.cameras.main.scrollX > item.x + item.width + 100) {
                    this.mountainStart = this.generateTerrain(item, this.mountainStart);
                }
            }.bind(this));
        }
    
        this.updateScore(parseInt(this.player.x / 100 - this.score));
    
        if (this.timerEvent) {
            var remaining = (1 - this.timerEvent.getProgress());
            var fuelPercentage = remaining * 100;
            
            // For horizontal fuel bar, scale on X axis
            this.fuelBar.scaleX = remaining;
            let r = Math.min(255, Math.floor((1 - remaining) * 255));
            let g = Math.min(255, Math.floor(remaining * 255));
            this.fuelBar.fillColor = (r << 16) + (g << 8);

            // Now show low fuel message when remaining fuel falls below 25%.
            if (remaining < 0.25) {
                this.lowFuel.setVisible(true);
            } else {
                this.lowFuel.setVisible(false);
            }
        }
    
        // --- Update Speedometer ---
        // The pointer moves gradually toward the max angle when accelerating (via keyboard or mobile boost button)
        // and quickly returns to the min angle when released.
        const speedIncrement = 0.5;   // degrees per frame when accelerating
        const speedDecrement = 3;     // degrees per frame when not accelerating

        if (this.cursors.right.isDown || this.isAccelerating) {
            this.currentSpeedAngle = Math.min(this.currentSpeedAngle + speedIncrement, this.gaugeMaxAngle);
        } else {
            this.currentSpeedAngle = Math.max(this.currentSpeedAngle - speedDecrement, this.gaugeMinAngle);
        }
        drawPointer(this.speedPointer, this.speedGaugeCenter.x, this.speedGaugeCenter.y, this.gaugeRadius - 15, this.currentSpeedAngle);
    
        // --- Update Fuel Gauge ---
        // Fuel full (100%) gives 45°; fuel empty (0%) gives -135°.
        let targetFuelAngle = Phaser.Math.Linear(this.gaugeMinAngle, this.gaugeMaxAngle, (this.timerEvent ? (1 - this.timerEvent.getProgress()) : 1));
        drawPointer(this.fuelPointer, this.fuelGaugeCenter.x, this.fuelGaugeCenter.y, this.gaugeRadius - 15, targetFuelAngle);
    }

    interpolate(vFrom, vTo, delta) {
        let interpolation = (1 - Math.cos(delta * Math.PI)) * 0.5;
        return vFrom * (1 - interpolation) + vTo * interpolation;
    }

    generateTerrain(graphics, mountainStart) {
        let slopePoints = [];
        let slopes = 0;
        let slopeStart = new Phaser.Math.Vector2(0, mountainStart.y);
        let slopeLength = Phaser.Math.Between(gameOptions.slopeLength[0], gameOptions.slopeLength[1]);
        let slopeEnd = (mountainStart.x == 0) ? new Phaser.Math.Vector2(slopeStart.x + gameOptions.slopeLength[1] * 1.5, 0) : new Phaser.Math.Vector2(slopeStart.x + slopeLength, Math.random());
        let pointX = 0;

        while (slopes < gameOptions.slopesPerMountain) {
            let interpolationVal = this.interpolate(slopeStart.y, slopeEnd.y, (pointX - slopeStart.x) / (slopeEnd.x - slopeStart.x));
            if (pointX == slopeEnd.x) {
                slopes++;
                slopeStart = new Phaser.Math.Vector2(pointX, slopeEnd.y);
                slopeEnd = new Phaser.Math.Vector2(slopeEnd.x + Phaser.Math.Between(gameOptions.slopeLength[0], gameOptions.slopeLength[1]), Math.random());
                interpolationVal = slopeStart.y;
            }
            let pointY = this.height * gameOptions.startTerrainHeight + interpolationVal * gameOptions.amplitude;
            slopePoints.push(new Phaser.Math.Vector2(pointX, pointY));
            pointX++;
        }

        let simpleSlope = simplify(slopePoints, 1, true);
        graphics.x = mountainStart.x;
        graphics.clear();
        graphics.moveTo(0, this.height);
        graphics.fillStyle(0x654b35);
        graphics.beginPath();
        simpleSlope.forEach(function (point) {
            graphics.lineTo(point.x, point.y);
        }.bind(this));
        graphics.lineTo(pointX, this.height);
        graphics.lineTo(0, this.height);
        graphics.closePath();
        graphics.fillPath();

        graphics.lineStyle(16, 0x6b9b1e);
        graphics.beginPath();
        simpleSlope.forEach(function (point) {
            graphics.lineTo(point.x, point.y);
        });
        graphics.strokePath();

        for (let i = 1; i < simpleSlope.length; i++) {
            let line = new Phaser.Geom.Line(simpleSlope[i - 1].x, simpleSlope[i - 1].y, simpleSlope[i].x, simpleSlope[i].y);
            let distance = Phaser.Geom.Line.Length(line);
            let center = Phaser.Geom.Line.GetPoint(line, 0.5);
            let angle = Phaser.Geom.Line.Angle(line);

            if (this.bodyPool.length == 0) {
                this.matter.add.rectangle(center.x + mountainStart.x, center.y, distance, 10, {
                    isStatic: true,
                    angle: angle,
                    friction: 1,
                    restitution: 0
                });
            } else {
                let body = this.bodyPool.shift();
                this.bodyPoolId.shift();
                this.matter.body.setPosition(body, { x: center.x + mountainStart.x, y: center.y });
                let length = body.area / 10;
                this.matter.body.setAngle(body, 0);
                this.matter.body.scale(body, 1 / length, 1);
                this.matter.body.scale(body, distance, 1);
                this.matter.body.setAngle(body, angle);
            }
        }

        graphics.width = pointX - 1;
        return new Phaser.Math.Vector2(graphics.x + pointX - 1, slopeStart.y);
    }

    addPlayer() {
        this.matter.world.pause();
        this.player = this.add.sprite(this.width / 8, 0, 'player').setScale(0.3);
        const startX = this.width / 8;
        let startY = this.height * gameOptions.startTerrainHeight;
        for (let i = 0; i < this.mountainGraphics.length; i++) {
            const graphics = this.mountainGraphics[i];
            if (startX >= graphics.x && startX <= graphics.x + graphics.width) {
                startY = this.height * gameOptions.startTerrainHeight - gameOptions.amplitude / 2;
                break;
            }
        }
    
        this.player.y = startY - this.player.displayHeight - 10;
        this.playerBody = this.matter.add.rectangle(this.width / 8, this.player.y, 70, 10, {
            friction: 0.5,
            restitution: 0.05,
            mass: 30,
            angularDamping: 0.5
        });
        this.flipped = false;
    
        this.body = this.matter.add.gameObject(this.player, this.playerBody);
    
        this.frontWheelUI = this.add.circle(this.width / 8 + 25, this.player.y + 25, 15, 0x000000);
        this.frontWheelBody = this.matter.add.polygon(this.width / 8 + 25, this.player.y + 25, 8, 15, {
            friction: 1.0,
            restitution: 0.02,
            mass: 8,
            angularDamping: 0.3
        });
        this.frontWheel = this.matter.add.gameObject(this.frontWheelUI, this.frontWheelBody);
    
        this.rearWheelUI = this.add.circle(this.width / 8 - 25, this.player.y + 25, 15, 0x000000);
        this.rearWheelBody = this.matter.add.polygon(this.width / 8 - 25, this.player.y + 25, 8, 15, {
            friction: 1.0,
            restitution: 0.02,
            mass: 8,
            angularDamping: 0.3
        });
        this.rearWheel = this.matter.add.gameObject(this.rearWheelUI, this.rearWheelBody);
    
        this.matter.add.constraint(this.body, this.frontWheel, 22, 0.1, { pointA: { x: 25, y: 10 } });
        this.matter.add.constraint(this.body, this.frontWheel, 22, 0.15, { pointA: { x: 40, y: 10 } });
        this.matter.add.constraint(this.body, this.rearWheel, 22, 0.15, { pointA: { x: -25, y: 10 } });
        this.matter.add.constraint(this.body, this.rearWheel, 22, 0.15, { pointA: { x: -40, y: 10 } });
    
        this.matter.body.setAngle(this.playerBody, 0);
        this.frontWheelGrounded = true;
        this.rearWheelGrounded = true;
    
        this.time.delayedCall(500, () => { this.matter.world.resume(); }, [], this);
    }

    spawnCollectible() {
        // Spawn fuel collectible as a dynamic body so it falls onto the platform.
        var collectible = this.matter.add.sprite(this.player.x + this.width, 400, 'collectible').setScale(0.3);
        // Optionally adjust friction and bounce to make it settle on the terrain.
        collectible.setFriction(0.1);
        collectible.setBounce(0);
        this.collectibles.add(collectible);
    }
    
    spawnCoins() {
        // Spawn between 3 to 5 coins in a row as dynamic bodies so they fall naturally.
        const numberOfCoins = Phaser.Math.Between(3, 5);
        let startX = this.player.x + this.width;
        // Adjust the initial vertical position to let coins have enough room to fall onto the terrain.
        const baseY = Phaser.Math.Between(200, 300);
        for (let i = 0; i < numberOfCoins; i++) {
            let coin = this.matter.add.sprite(startX + (i * 50), baseY, 'coin').setScale(0.3);
            coin.setFriction(0.1);
            coin.setBounce(0);
            this.coinCollectibles.add(coin);
        }
    }
    
    // Modified accelerate function with enhanced reverse power and mobile support
    accelerate() {
        this.isAccelerating = true;  // Set flag on gas pedal press
        if (this.velocity < 0) {
            this.targetAcceleration = 0.06;
        } else {
            this.targetAcceleration = gameOptions.carAcceleration[0] * 1.5;
        }
        this.carSound.setVolume(1).play();
    }

    decelerate() {
        this.isAccelerating = false; // Reset flag when gas pedal is released
        this.targetAcceleration = 0;
        this.decelerationRate = 0.01;
        this.tweens.add({
            targets: this.carSound,
            volume: 0,
            duration: 200
        });
    }

    // Modified brake function with enhanced reverse power
    brake() {
        if (this.velocity > 0) {
            this.targetAcceleration = -0.2;
        } else {
            this.targetAcceleration = gameOptions.carAcceleration[1] * 3;
        }
        this.carSound.setVolume(0.5).play();
    }
    
    stopBraking() {
        this.targetAcceleration = 0;
        this.brakeHeldTime = 0;
        this.tweens.add({
            targets: this.carSound,
            volume: 0,
            duration: 200
        });
    }

    tiltForward() {
        this.matter.body.setAngularVelocity(this.playerBody, 0.05);
    }

    tiltBack() {
        this.matter.body.setAngularVelocity(this.playerBody, -0.05);
    }

    updateScore(points) {
        this.score += points;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(this.score);
    }

    gameOver() {
        initiateGameOver.bind(this)({ score: this.score });
    }

    pauseGame() {
        handlePauseGame.bind(this)();
    }
}

function displayProgressLoader() {
    let width = 320;
    let height = 50;
    let x = (this.width / 2) - 160;
    let y = (this.height / 2) - 50;

    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(x, y, width, height);

    const loadingText = this.make.text({
        x: this.width / 2,
        y: this.height / 2 + 20,
        text: 'Loading...',
        style: {
            font: '20px monospace',
            fill: '#ffffff'
        }
    }).setOrigin(0.5, 0.5);

    const progressBar = this.add.graphics();
    this.load.on('progress', (value) => {
        progressBar.clear();
        progressBar.fillStyle(0x364afe, 1);
        progressBar.fillRect(x, y, width * value, height);
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
    physics: {
        default: "matter",
        matter: {
            debug: false,
            gravity: { y: 0.4 },
        },
    },
    dataObject: {
        name: _CONFIG.title,
        description: _CONFIG.description,
        instructions: _CONFIG.instructions,
    },
    orientation: _CONFIG.deviceOrientation === "landscape"
};

function getSqDist(p1, p2) {
    var dx = p1.x - p2.x,
        dy = p1.y - p2.y;
    return dx * dx + dy * dy;
}

function getSqSegDist(p, p1, p2) {
    var x = p1.x,
        y = p1.y,
        dx = p2.x - x,
        dy = p2.y - y;

    if (dx !== 0 || dy !== 0) {
        var t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
        if (t > 1) {
            x = p2.x;
            y = p2.y;
        } else if (t > 0) {
            x += dx * t;
            y += dy * t;
        }
    }
    dx = p.x - x;
    dy = p.y - y;
    return dx * dx + dy * dy;
}

function simplifyRadialDist(points, sqTolerance) {
    var prevPoint = points[0],
        newPoints = [prevPoint],
        point;

    for (var i = 1, len = points.length; i < len; i++) {
        point = points[i];
        if (getSqDist(point, prevPoint) > sqTolerance) {
            newPoints.push(point);
            prevPoint = point;
        }
    }
    if (prevPoint !== point) newPoints.push(point);
    return newPoints;
}

function simplifyDPStep(points, first, last, sqTolerance, simplified) {
    var maxSqDist = sqTolerance,
        index;

    for (var i = first + 1; i < last; i++) {
        var sqDist = getSqSegDist(points[i], points[first], points[last]);
        if (sqDist > maxSqDist) {
            index = i;
            maxSqDist = sqDist;
        }
    }

    if (maxSqDist > sqTolerance) {
        if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
        simplified.push(points[index]);
        if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
    }
}

function simplifyDouglasPeucker(points, sqTolerance) {
    var last = points.length - 1;
    var simplified = [points[0]];
    simplifyDPStep(points, 0, last, sqTolerance, simplified);
    simplified.push(points[last]);
    return simplified;
}

function simplify(points, tolerance, highestQuality) {
    if (points.length <= 2) return points;
    var sqTolerance = tolerance !== undefined ? tolerance * tolerance : 1;
    points = highestQuality ? points : simplifyRadialDist(points, sqTolerance);
    points = simplifyDouglasPeucker(points, sqTolerance);
    return points;
}
