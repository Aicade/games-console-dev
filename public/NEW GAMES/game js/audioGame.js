// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        this.isGameOver = false;

        addEventListenersPhaser.bind(this)();

        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");

        // Default players
        this.load.image("p1", "https://aicade-user-store.s3.amazonaws.com/0306251268/games/5GVig3hxQHZ44k3Z/assets/images/Screenshot%202025-04-07%20222316.png?t=1744045172183");
        // this.load.image("p2", "");
        // this.load.image("p3", "");
        // this.load.image("p4", "");
        // this.load.image("p5", "");

        
        // Changed players
        this.load.image("ep1","https://aicade-user-store.s3.amazonaws.com/0306251268/games/5GVig3hxQHZ44k3Z/assets/images/Screenshot%202025-04-07%20222316.png?t=1744045172183");
        // this.load.image("ep2","");
        // this.load.image("ep3","");
        // this.load.image("ep4","");
        // this.load.image("ep5","");


        // Buttons to enhance the player
        this.load.image("b1", "https://aicade-ui-assets.s3.amazonaws.com/0306251268/games/5GVig3hxQHZ44k3Z/assets/image_2_player.webp");
        // this.load.image("b2", "");
        // this.load.image("b3", "");
        // this.load.image("b4", "");
        // this.load.image("b5", "");


        // Audios
        this.load.audio("m1", "https://aicade-user-store.s3.amazonaws.com/GameAssets/music/aising_e60a0cfb-d750-481f-bb34-81d28a132f2e.mp3?t=1745252323560");
        this.load.audio("m2", "https://aicade-user-store.s3.amazonaws.com/GameAssets/music/square%20audio_4d1d7fed-fb59-4984-986a-c03ee4c45786.mp3?t=1745252323630");
        this.load.audio("m3", "https://aicade-user-store.s3.amazonaws.com/GameAssets/music/amen%20drum_bd5aff18-2d31-43d5-bb6a-af72343dd62f.mp3?t=1745252323719");
        this.load.audio("m4", "https://aicade-user-store.s3.amazonaws.com/GameAssets/music/whistle_0dcafa5f-1a14-416d-bd0d-bd448c3fe075.mp3?t=1745252323818");
        this.load.audio("m5", "https://aicade-user-store.s3.amazonaws.com/GameAssets/music/shaky_9f19cfb4-4380-483b-81ca-528aec993fb5.mp3?t=1745252323906");


        
        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/"
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');

        displayProgressLoader.call(this);

    }

    create() {

        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        this.sounds.background.setVolume(0.001).setLoop(true).play()

        this.vfx = new VFXLibrary(this);
         
        this.add.image(0, 0, 'background').setOrigin(0, 0).setDisplaySize(this.sys.game.config.width, this.sys.game.config.height);

        this.width = this.game.config.width;
        this.height = this.game.config.height;
        this.bg = this.add.sprite(0, 0, 'background').setOrigin(0, 0);
        this.bg.setScrollFactor(0);
        this.bg.displayHeight = this.game.config.height;
        this.bg.displayWidth = this.game.config.width;

        // Add UI elements


        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());

        this.pauseButton = this.add.sprite(this.game.config.width - 60, 60, "pauseButton").setOrigin(0.5, 0.5).setDepth(1);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(3);
        this.pauseButton.on('pointerdown', () => this.pauseGame());


        // Store references to pN, bN objects, audio, and track usage
        this.playerImages = [];
        this.buttonImages = [];
        this.buttonSlots = [];
        this.playerButtonMap = new Map();
        this.playerAudioMap = new Map(); // Track audio for each player

        // Configuration for assets
        const assetCount = 5;
        const imageWidth = 100;
        const padding = 20;

        // Spawn pN images (p1 to p5) as drop targets and clickable
        const totalWidth = (assetCount * imageWidth) + ((assetCount - 1) * padding);
        const startX = (this.width - totalWidth) / 2;
        const centerY = this.height / 2;
        for (let i = 0; i < assetCount; i++) {
            const xPos = startX + (i * (imageWidth + padding));
            const assetKey = `p${i + 1}`;
            const player = this.add.image(xPos, centerY, assetKey).setOrigin(0, 0.5);
            player.setData('originalKey', assetKey);
            player.setData('initialKey', assetKey);
            player.setInteractive({ cursor: 'pointer' });
            this.playerImages.push(player);
        }

        // Spawn bN buttons (b1 to b5) as draggable items and initialize slots
        const totalButtonWidth = (assetCount * imageWidth) + ((assetCount - 1) * padding);
        const startButtonX = (this.width - totalButtonWidth) / 2;
        const bottomY = this.height - 50;
        for (let i = 0; i < assetCount; i++) {
            const xPos = startButtonX + (i * (imageWidth + padding));
            const assetKey = `b${i + 1}`;
            const button = this.add.image(xPos, bottomY, assetKey).setOrigin(0, 0.5);
            button.setInteractive({ draggable: true });
            button.setData('index', i + 1);
            button.setData('slotIndex', i);
            this.buttonImages.push(button);
            this.buttonSlots.push({ button: button, originalX: xPos, originalY: bottomY });
        }

        // Initialize audio for m1 to m5
        this.audioTracks = {};
        for (let i = 1; i <= assetCount; i++) {
            this.audioTracks[`m${i}`] = this.sound.add(`m${i}`, { loop: true, volume: 0.5 });
        }

        // Enable input for dragging
        this.input.setDraggable(this.buttonImages);

        // Handle drag start
        this.input.on('dragstart', (pointer, gameObject) => {
            gameObject.setTint(0xaaaaaa);
        });

        // Handle dragging
        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            gameObject.x = dragX;
            gameObject.y = dragY;
        });

        // Handle drag end and drop logic with audio
        this.input.on('dragend', (pointer, gameObject) => {
            gameObject.clearTint();
            const droppedOn = this.playerImages.find(player => 
                Phaser.Math.Distance.Between(player.x, player.y, gameObject.x, gameObject.y) < 100
            );
            if (droppedOn) {
                const index = gameObject.getData('index');
                const slotIndex = gameObject.getData('slotIndex');

                // Stop any existing audio for this player
                if (this.playerAudioMap.has(droppedOn)) {
                    this.playerAudioMap.get(droppedOn).stop();
                    this.playerAudioMap.delete(droppedOn);
                }

                // Check if this player already has a button associated
                if (this.playerButtonMap.has(droppedOn)) {
                    const previousButton = this.playerButtonMap.get(droppedOn);
                    const previousSlot = this.buttonSlots[previousButton.slotIndex];
                    previousSlot.button = previousButton.button;
                    previousButton.button.x = previousSlot.originalX;
                    previousButton.button.y = previousSlot.originalY;
                    previousButton.button.setVisible(true);
                }

                // Update player to corresponding epN
                droppedOn.setTexture(`ep${index}`);
                droppedOn.setData('originalKey', `ep${index}`);

                // Play corresponding mN audio
                const audio = this.audioTracks[`m${index}`];
                audio.play();
                this.playerAudioMap.set(droppedOn, audio);

                // Update tracking: associate this button with the player
                this.playerButtonMap.set(droppedOn, {
                    button: gameObject,
                    slotIndex: slotIndex
                });

                // Remove the button from its slot
                this.buttonSlots[slotIndex].button = null;
                gameObject.setVisible(false);
            } else {
                // Return button to original position
                const slotIndex = gameObject.getData('slotIndex');
                gameObject.x = this.buttonSlots[slotIndex].originalX;
                gameObject.y = this.buttonSlots[slotIndex].originalY;
            }
        });

        // Handle click on player images to return bN, revert to pN, and stop audio
        this.playerImages.forEach(player => {
            player.on('pointerdown', () => {
                if (this.playerButtonMap.has(player)) {
                    const associatedButton = this.playerButtonMap.get(player);
                    const slotIndex = associatedButton.slotIndex;
                    const slot = this.buttonSlots[slotIndex];
                    // Return the button to its slot
                    slot.button = associatedButton.button;
                    associatedButton.button.x = slot.originalX;
                    associatedButton.button.y = slot.originalY;
                    associatedButton.button.setVisible(true);
                    // Revert player to original pN
                    player.setTexture(player.getData('initialKey'));
                    player.setData('originalKey', player.getData('initialKey'));
                    // Stop the audio
                    if (this.playerAudioMap.has(player)) {
                        this.playerAudioMap.get(player).stop();
                        this.playerAudioMap.delete(player);
                    }
                    // Remove tracking entry
                    this.playerButtonMap.delete(player);
                }
            });
        });


        this.cursors = this.input.keyboard.createCursorKeys();
        this.enemies = this.physics.add.group();
        this.input.keyboard.disableGlobalCapture();

    }

    update() {


    }


    updateScore(points) {
        this.score += points;
        this.gamePoint = this.score;
        this.updateScoreText();
    }

    updateScoreText() {
        this.scoreText.setText(this.score);
    }

    gameOver() {
        this.sounds.background.stop();
        initiateGameOver.bind(this)({
            score: this.score
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