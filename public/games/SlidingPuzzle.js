const globalPrimaryFontColor = "#FFF";

const SlidingPuzzle = {
    ALLOW_CLICK: 0,
    TWEENING: 1,
    PIECE_SCALE: 1.4, // 1: 100% | 0: 0%
};

class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');

        this.rows = 0;
        this.columns = 0;

        //  The width and height of each piece in the puzzle.
        this.pieceWidth = 0;
        this.pieceHeight = 0;

        this.pieces = null;
        this.spacer = null;

        //  The speed at which the pieces slide, and the tween they use
        this.slideSpeed = 300;
        this.slideEase = 'power3';

        //  The speed at which the pieces are shuffled at the start. This allows
        //  the player to see the puzzle before trying to solve it. However if
        //  you don't want this, just set the speed to zero and it'll appear
        //  instantly 'scrambled'.
        this.shuffleSpeed = 200;
        this.shuffleEase = 'power1';

        this.lastMove = null;


        this.photo = '';

        this.slices = [];

        this.action = SlidingPuzzle.ALLOW_CLICK;
    }


    askUserForGrid() {
        this.optsContainer = this.add.container(this.game.config.width / 2 - 200, 50);
        this.question = this.add.text(0, 0, 'Select your puzzle grid', { fontSize: '30px', fill: globalPrimaryFontColor });
        this.optsContainer.add(this.question);

        this.option1 = this.add.text(0, this.question.y + 70, '>> 3 x 3 Grid : 30sec time', { fontSize: '25px', fill: globalSecondaryFontColor });
        this.option1.setInteractive({ cursor: "pointer" }).on('pointerdown',
            () => this.scene.start('GameScene', { size: 3, time_limit: 30 }));
        this.optsContainer.add(this.option1);

        this.option2 = this.add.text(0, this.option1.y + 50, '>> 4 x 4 Grid : 45sec time', { fontSize: '25px', fill: globalSecondaryFontColor });
        this.option2.setInteractive({ cursor: "pointer" }).on('pointerdown',
            () => this.scene.start('GameScene', { size: 4, time_limit: 45 }));
        this.optsContainer.add(this.option2);

        this.option3 = this.add.text(0, this.option2.y + 50, '>> 5 x 5 Grid : 60sec time', { fontSize: '25px', fill: globalSecondaryFontColor });
        this.option3.setInteractive({ cursor: "pointer" }).on('pointerdown',
            () => this.scene.start('GameScene', { size: 5, time_limit: 60 }));
        this.optsContainer.add(this.option3);
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
            this.load.image(key, _CONFIG.libLoader[key]);
        }

        this.load.bitmapFont('pixelfont',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.png',
            'https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/pix.xml');

        displayProgressLoader.call(this);
    }

    create(data) {

        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }

        this.grid_size = data.size || 3;
        this.default_time_limit = data.time_limit || 30;
        this.default_time_limit *= 1000;
        //  The number of iterations the puzzle walker will go through when
        //  scrambling up the puzzle. 10 is a nice and easy puzzle, but
        //  push it higher for much harder ones.
        this.iterations = Math.ceil(this.grid_size * 4.5);

        this.score = 0;
        this.width = this.game.config.width;
        this.height = this.game.config.height;
        // this.bg = this.add.image(0, 0, 'background').setOrigin(0);
        // this.bg.displayHeight = this.height;
        // this.bg.displayWidth = this.width;


        this.sounds.background.setVolume(0.2).setLoop(true).play()
        // Add UI elements
        this.scoreText = this.add.text(10, 10, 'Score: 0', { fontSize: '20px', fill: globalPrimaryFontColor }).setAlpha(0);
        this.levelUpText = this.add.bitmapText(this.width / 2, this.height / 2, "pixelfont", "YOU WON! \nLEVEL UP!", 90).setAlpha(0).setDepth(11).setOrigin(0.5);
        this.levelUpText.align = 1;

        this.gameOverText = this.add.bitmapText(this.width / 2, this.height / 2, "pixelfont", "TIME UP!\n GAME OVER", 90).setAlpha(0).setDepth(11).setOrigin(0.5).setTint(0xff0000);
        this.gameOverText.align = 1;

        // Add input listeners
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        const pauseButton = this.add.sprite(this.game.config.width * 0.9, this.game.config.height * 0.1, "pauseButton").setOrigin(0.5, 0.5).setScale(2);
        pauseButton.setInteractive({ cursor: 'pointer' });
        pauseButton.on('pointerdown', () => this.pauseGame());

        window.solve = () => {
            this.nextRound();
        };
        this.startPuzzle('player', this.grid_size, this.grid_size);
        this.input.keyboard.disableGlobalCapture();
    }

    /**
     * This function is responsible for building the puzzle.
     * It takes an Image key and a width and height of the puzzle (in pieces, not pixels).
     * Read the comments within this function to find out what happens.
     */
    startPuzzle(key, rows, columns) {
        this.photo = key;

        //  The size if the puzzle, in pieces (not pixels)
        this.rows = rows;
        this.columns = columns;

        //  The size of the source image
        const texture = this.textures.getFrame(key);

        const photoWidth = texture.width;
        const photoHeight = texture.height;

        //  Create our sliding pieces

        //  Each piece will be this size:
        const pieceWidth = photoWidth / this.rows;
        const pieceHeight = photoHeight / this.columns;

        this.pieceWidth = pieceWidth;
        this.pieceHeight = pieceHeight;

        //  A Container to put the pieces in
        if (this.pieces) {
            this.pieces.removeAll(true);
        }

        //  The position sets the top-left of the container for the pieces to expand down from
        this.pieces = this.add.container((this.game.config.width - photoWidth) / 2, (this.game.config.height - photoHeight) / 2).setScale(SlidingPuzzle.PIECE_SCALE);

        //  An array to put the texture slices in
        if (this.slices) {
            this.slices.forEach(slice => slice.destroy());
            this.slices = [];
        }

        let i = 0;

        //  Loop through the image and create a new Sprite for each piece of the puzzle.
        for (let y = 0; y < this.columns; y++) {
            for (let x = 0; x < this.rows; x++) {
                //  remove old textures
                const slice = this.textures.addDynamicTexture(`slice${i}`, pieceWidth, pieceHeight);

                const ox = 0 + (x / this.rows);
                const oy = 0 + (y / this.columns);

                slice.stamp(key, null, 0, 0, { originX: ox, originY: oy });

                this.slices.push(slice);

                const piece = this.add.image(x * pieceWidth, y * pieceHeight, `slice${i}`);

                piece.setOrigin(0, 0);

                //  The current row and column of the piece
                //  Store the row and column the piece _should_ be in, when the puzzle is solved
                piece.setData({
                    row: x,
                    column: y,
                    correctRow: x,
                    correctColumn: y
                });

                piece.setInteractive();

                piece.on('pointerdown', () => this.checkPiece(piece));

                this.pieces.add(piece);

                i++;
            }
        }
        this.pieces.setPosition((this.game.config.width - this.getContainerSize(this.pieces).width) / 2,
            (this.game.config.height - this.getContainerSize(this.pieces).height) / 2);
        //  The last piece will be our 'spacer' to slide in to
        this.spacer = this.pieces.getAt(this.pieces.length - 1);
        this.spacer.alpha = 0;

        this.lastMove = null;

        this.shufflePieces();
    }

    getContainerSize(container) {
        let minX = Number.MAX_VALUE;
        let minY = Number.MAX_VALUE;
        let maxX = Number.MIN_VALUE;
        let maxY = Number.MIN_VALUE;

        container.list.forEach(child => {
            const bounds = child.getBounds();

            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.right);
            maxY = Math.max(maxY, bounds.bottom);
        });

        return {
            width: maxX - minX,
            height: maxY - minY
        };
    }

    update() {

        // Add white outline to the visible pieces
        if (this.outlineGroup) {
            this.outlineGroup.children && this.outlineGroup.children.iterate((grph) =>
                grph.clear()
            );
            this.outlineGroup.destroy();
            delete this.outlineGroup;
        }
        if (this.pieces) {
            this.outlineGroup = this.add.group();
            this.pieces.iterate((piece) => {
                // Assuming 'sprite' is your sprite object
                var graphics = this.add.graphics({ lineStyle: { width: 1, color: 0xffffff } });
                graphics.setAlpha(0.5)
                this.outlineGroup.add(graphics);
                graphics.clear()
                var bounds = piece.getBounds();
                graphics.strokeRectShape(bounds);
            });
        }
    }

    /**
     * This shuffles up our puzzle.
     *
     * We can't just 'randomize' the tiles, or 50% of the time we'll get an
     * unsolvable puzzle. So instead lets walk it, making non-repeating random moves.
     */
    shufflePieces() {
        //  Push all available moves into this array
        const moves = [];

        const spacerCol = this.spacer.data.get('column');
        const spacerRow = this.spacer.data.get('row');

        if (spacerCol > 0 && this.lastMove !== Phaser.DOWN) {
            moves.push(Phaser.UP);
        }

        if (spacerCol < this.columns - 1 && this.lastMove !== Phaser.UP) {
            moves.push(Phaser.DOWN);
        }

        if (spacerRow > 0 && this.lastMove !== Phaser.RIGHT) {
            moves.push(Phaser.LEFT);
        }

        if (spacerRow < this.rows - 1 && this.lastMove !== Phaser.LEFT) {
            moves.push(Phaser.RIGHT);
        }

        //  Pick a move at random from the array
        this.lastMove = Phaser.Utils.Array.GetRandom(moves);

        //  Then move the spacer into the new position
        switch (this.lastMove) {
            case Phaser.UP:
                this.swapPiece(spacerRow, spacerCol - 1);
                break;

            case Phaser.DOWN:
                this.swapPiece(spacerRow, spacerCol + 1);
                break;

            case Phaser.LEFT:
                this.swapPiece(spacerRow - 1, spacerCol);
                break;

            case Phaser.RIGHT:
                this.swapPiece(spacerRow + 1, spacerCol);
                break;
        }
    }

    makeTimerMeter(x = 20, y = 50, width = 200, height = 30, timeProvided = this.default_time_limit) {
        // Create the power meter background (empty part)
        let meterBg = this.add.rectangle(x, y, width, height, 0xbbbbbb).setOrigin(0);
        let meterProgressBar = this.add.rectangle(x, y, width, height, 0x00ff00).setOrigin(0);
        let meterText = this.add.bitmapText(x + 75, y - 50, "pixelfont", timeProvided, 28);

        this.meterTween = this.tweens.add({
            onUpdate: ({ progress }) => {
                let timeRemaining = Math.ceil((timeProvided * (1 - progress)) / 1000);
                meterText.setText(timeRemaining);
                if (timeRemaining <= 10) {
                    meterProgressBar.fillColor = 0xff0000;
                };
            },
            targets: meterProgressBar,
            duration: timeProvided, // 5 seconds default
            width: 0,
            ease: 'Linear',
            onComplete: () => {
                meterBg.destroy();
                meterProgressBar.destroy();
                meterText.destroy();
                this.gameOver();
            },
            onStop: () => {
                meterBg.destroy();
                meterProgressBar.destroy();
                meterText.destroy();
                this.score++;
            }
        });

    }

    destroyTimerMeter() {
        if (this.meterTween) {
            this.meterTween.stop().destroy();
        }
    }

    /**
     * Swaps the spacer with the piece in the given row and column.
     */
    swapPiece(row, column) {
        //  row and column is the new destination of the spacer

        const piece = this.getPiece(row, column);

        const spacer = this.spacer;
        const x = spacer.x;
        const y = spacer.y;
        // piece.data.set({
        //     row: spacer.data.get('row'),
        //     column: spacer.data.get('column')
        // });

        piece.data.values.row = spacer.data.values.row;
        piece.data.values.column = spacer.data.values.column;

        spacer.data.values.row = row;
        spacer.data.values.column = column;

        // spacer.data.set({
        //     row,
        //     column
        // });

        // this.spacer.data.row = row;
        // this.spacer.data.column = column;

        spacer.setPosition(piece.x, piece.y);

        //  If we don't want them to watch the puzzle get shuffled, then just
        //  set the piece to the new position immediately.
        if (this.shuffleSpeed === 0) {
            piece.setPosition(x, y);

            if (this.iterations > 0) {
                //  Any more iterations left? If so, shuffle, otherwise start play
                this.iterations--;

                this.shufflePieces();
            }
            else {
                this.startPlay();
            }
        }
        else {
            //  Otherwise, tween it into place
            this.sounds.move.setVolume(1).setLoop(false).play()
            const tween = this.tweens.add({
                targets: piece,
                x,
                y,
                duration: this.shuffleSpeed,
                ease: this.shuffleEase
            });

            if (this.iterations > 0) {
                //  Any more iterations left? If so, shuffle, otherwise start play
                this.iterations--;
                tween.on('complete', this.shufflePieces, this);
            }
            else {
                tween.on('complete', this.startPlay, this);
            }
        }
    }

    /**
     * Gets the piece at row and column.
     */
    getPiece(row, column) {
        for (let i = 0; i < this.pieces.length; i++) {
            const piece = this.pieces.getAt(i);

            if (piece.data.get('row') === row && piece.data.get('column') === column) {
                return piece;
            }
        }

        return null;
    }

    /**
     * Sets the game state to allow the user to click.
     */
    startPlay() {
        this.action = SlidingPuzzle.ALLOW_CLICK;
        this.time.delayedCall(500, this.makeTimerMeter.bind(this))
    }

    /**
     * Called when the user clicks on any of the puzzle pieces.
     * It first checks to see if the piece is adjacent to the 'spacer', and if not, bails out.
     * If it is, the two pieces are swapped by calling `this.slidePiece`.
     */
    checkPiece(piece) {
        if (this.action !== SlidingPuzzle.ALLOW_CLICK) {
            return;
        }

        //  Only allowed if adjacent to the 'spacer'
        //
        //  Remember:
        //
        //  Columns = vertical (y) axis
        //  Rows = horizontal (x) axis

        const spacer = this.spacer;

        if (piece.data.values.row === spacer.data.values.row) {
            if (spacer.data.values.column === piece.data.values.column - 1) {
                //  Space above the piece?
                piece.data.values.column--;

                spacer.data.values.column++;
                spacer.y += this.pieceHeight;

                this.slidePiece(piece, piece.x, piece.y - this.pieceHeight);
            }
            else if (spacer.data.values.column === piece.data.values.column + 1) {
                //  Space below the piece?
                piece.data.values.column++;

                spacer.data.values.column--;
                spacer.y -= this.pieceHeight;

                this.slidePiece(piece, piece.x, piece.y + this.pieceHeight);
            }
        }
        else if (piece.data.values.column === spacer.data.values.column) {
            if (spacer.data.values.row === piece.data.values.row - 1) {
                //  Space to the left of the piece?
                piece.data.values.row--;

                spacer.data.values.row++;
                spacer.x += this.pieceWidth;

                this.slidePiece(piece, piece.x - this.pieceWidth, piece.y);
            }
            else if (spacer.data.values.row === piece.data.values.row + 1) {
                //  Space to the right of the piece?
                piece.data.values.row++;

                spacer.data.values.row--;
                spacer.x -= this.pieceWidth;

                this.slidePiece(piece, piece.x + this.pieceWidth, piece.y);
            }
        }
    }

    /**
     * Slides the piece into the position previously occupied by the spacer.
     * Uses a tween (see slideSpeed and slideEase for controls).
     * When complete, calls tweenOver.
     */
    slidePiece(piece, x, y) {
        this.action = SlidingPuzzle.TWEENING;

        this.sounds.move.setVolume(1).setLoop(false).play()
        this.tweens.add({
            targets: piece,
            x,
            y,
            duration: this.slideSpeed,
            ease: this.slideEase,
            onComplete: () => this.tweenOver()
        });
    }

    /**
     * Called when a piece finishes sliding into place.
     * First checks if the puzzle is solved. If not, allows the player to carry on.
     */
    tweenOver() {
        //  Are all the pieces in the right place?

        let outOfSequence = false;

        this.pieces.each(piece => {

            if (piece.data.values.correctRow !== piece.data.values.row || piece.data.values.correctColumn !== piece.data.values.column) {
                outOfSequence = true;
            }

        });

        if (outOfSequence) {
            //  Not correct, so let the player carry on.
            this.action = SlidingPuzzle.ALLOW_CLICK;
        }
        else {
            //  If we get this far then the sequence is correct and the puzzle is solved.
            //  Fade the missing piece back in ...
            //  When the tween finishes we'll let them click to start the next round

            this.tweens.add({
                targets: this.spacer,
                alpha: 1,
                duration: this.slideSpeed * 2,
                ease: 'linear',
                onComplete: () => {
                    this.destroyTimerMeter();
                    this.showLevelUp();
                }
            });
        }
    }

    showLevelUp() {
        this.sounds.success.setVolume(1).setLoop(false).play()
        this.levelUpText.alpha = 1;
        this.time.delayedCall(2000, () => {
            this.levelUpText.alpha = 0;
            if (this.grid_size < 5) {
                this.grid_size++;
            }
            this.nextRound();
        })
    }

    /**
     * Starts the next round of the game.
     *
     * In this template it cycles between the 3 pictures, increasing the iterations and complexity
     * as it progresses. But you can replace this with whatever you need - perhaps returning to
     * a main menu to select a new puzzle?
     */
    nextRound() {
        let size;
        let iterations;
        let nextPhoto;

        if (this.photo === 'player') {
            nextPhoto = 'enemy';
            iterations = Math.ceil(this.grid_size * 2.5);
            size = this.grid_size;
        }
        else if (this.photo === 'enemy') {
            nextPhoto = 'collectible';
            iterations = Math.ceil(this.grid_size * 2.5);
            size = this.grid_size;
        }
        else {
            //  Back to the start again
            // nextPhoto = 'player';
            // iterations = Math.ceil(this.grid_size * 2.5);
            // size = this.grid_size;
            this.gameOver();
        }

        this.reveal = this.add.image(this.pieces.x, this.pieces.y, nextPhoto).setOrigin(0, 0);

        this.reveal.setPostPipeline('WipePostFX');

        const pipeline = this.reveal.getPostPipeline('WipePostFX');

        this.tweens.add({
            targets: pipeline,
            progress: 1,
            duration: 2000,
            onComplete: () => {

                this.photo = nextPhoto;
                this.iterations = iterations;
                this.reveal.destroy();

                this.startPuzzle(nextPhoto, size, size);

            }
        });
    }

    gameOver() {
        this.sounds.lose.setVolume(1).setLoop(false).play()
        this.gameOverText.setAlpha(1)
        this.time.delayedCall(2500, () => {
            initiateGameOver.bind(this)({
                "score": this.score,
            });
        })
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

// Configuration object
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
    orientation: _CONFIG.deviceOrientation === "portrait"
};