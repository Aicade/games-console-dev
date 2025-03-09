// Game Scene
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.grid = [];
        this.keyboard = [];
        this.targetWord = '';
        this.currentRow = 0;
        this.currentCol = 0;
        this.maxGuesses = 5;
        this.letterCount = 6; // Changed to 6 letters
        this.isGameOver = false;
        this.hasWon = false;
    }

    preload() {
        this.load.json('dictionary', `https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fdb35c81-f6d8-4572-beb2-fd760c0a6e60.json`);

        for (const key in _CONFIG.imageLoader) {
            this.load.image(key, _CONFIG.imageLoader[key]);
        }

        for (const key in _CONFIG.soundsLoader) {
            this.load.audio(key, [_CONFIG.soundsLoader[key]]);
        }
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");

        addEventListenersPhaser.bind(this)();
        const fontName = 'pix';
        const fontBaseURL = "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/fonts/"
        this.load.bitmapFont('pixelfont', fontBaseURL + fontName + '.png', fontBaseURL + fontName + '.xml');
        displayProgressLoader.call(this);
    }

    create() {
        this.isGameOver = false;
        this.hasWon = false;

        this.vfx = new VFXLibrary(this);
        this.cursor = this.input.keyboard.createCursorKeys();
        
        // Setup sounds
        this.sounds = {};
        for (const key in _CONFIG.soundsLoader) {
            this.sounds[key] = this.sound.add(key, { loop: false, volume: 0.5 });
        }
        this.sounds.background.setVolume(1).setLoop(true).play();

        // Setup background
        this.bg = this.add.sprite(0, 0, 'background').setOrigin(0, 0).setDepth(-5);
        this.bg.displayWidth = this.game.config.width;
        this.bg.displayHeight = this.game.config.height;

        this.width = this.game.config.width;
        this.height = this.game.config.height;

        // Add pause button
        this.pauseButton = this.add.sprite(this.width - 50, 60, "pauseButton").setOrigin(0.5, 0.5);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(3);
        this.pauseButton.setDepth(11);
        this.pauseButton.on('pointerdown', () => this.pauseGame());

        // Load dictionary words
        this.words = this.cache.json.get('dictionary');
        
        // Filter for 6-letter words only
        this.sixLetterWords = this.words.filter(word => word.length === 6);
        
        // Select a random 6-letter word
        this.targetWord = this.getRandomWord();
        console.log("Target word:", this.targetWord); // For debugging
        
        this.cameras.main.setBackgroundColor('#283747');
        
        // Create title
        const isPortrait = this.scale.height > this.scale.width;
        const titleY = isPortrait ? 80 : 100;
        const titleSize = isPortrait ? 48 : 64;
        this.titleText = this.add.bitmapText(this.width / 2, titleY, 'pixelfont', 'WORDLE', titleSize).setOrigin(0.5, 0.5);
        
        // Create game board and keyboard
        this.createGameBoard();
        this.createKeyboard();
        
        // Create timer text (moved to top left)
        const timerFontSize = isPortrait ? 32 : 40;
        this.timerText = this.add.bitmapText(
            80,
            50, 
            'pixelfont',
            'Time: 60',
            timerFontSize
        ).setOrigin(0.5, 0.5);

        // Start timer
        this.startTime = 60;
        this.updateTimerDisplay();

        this.timer = this.time.addEvent({
            delay: 1000,
            callback: () => {
                this.startTime -= 1;
                this.updateTimerDisplay();
                if (this.startTime <= 0 && !this.isGameOver) {
                    this.resetGame(true);  // Changed to true to properly end the game when time runs out
                }
            },
            callbackScope: this,
            loop: true
        });

        this.scale.on('resize', this.resizeGame, this);
    
        // Initial layout setup
        this.layoutGame();
    }

    layoutGame() {
        // Get current game dimensions
        this.width = this.scale.width;
        this.height = this.scale.height;
        const isPortrait = this.height > this.width;
        
        // Resize background
        this.bg.displayWidth = this.width;
        this.bg.displayHeight = this.height;
        
        // Position pause button
        this.pauseButton.setPosition(this.width - 50, 60);
        
        // Position title
        const titleY = isPortrait ? 80 : 60;
        const titleSize = isPortrait ? 48 : 64;
        if (this.titleText) {
            this.titleText.setPosition(this.width / 2, titleY);
            this.titleText.setFontSize(titleSize);
        } else {
            this.titleText = this.add.bitmapText(this.width / 2, titleY, 'pixelfont', 'WORDLE', titleSize).setOrigin(0.5, 0.5);
        }
        
        // Position timer text (top left)
        const timerFontSize = isPortrait ? 32 : 40;
        this.timerText.setPosition(80, 50);
        this.timerText.setFontSize(timerFontSize);
        
        // Reposition game board
        this.repositionGameBoard(isPortrait);
        
        // Reposition keyboard
        this.repositionKeyboard(isPortrait);
    }
    
    repositionGameBoard(isPortrait) {
        const gridSize = this.letterCount;
        // Make squares smaller, especially in landscape mode
        const squareSize = isPortrait ? 
            Math.min(50, (this.width - 60) / gridSize) : 
            Math.min(50, (this.width - 120) / gridSize); // Smaller in landscape
        
        const startX = (this.width - (gridSize * squareSize + (gridSize - 1) * 10)) / 2;
        const startY = isPortrait ? 150 : 180; // Adjust vertical position
        
        for (let row = 0; row < this.maxGuesses; row++) {
            for (let col = 0; col < this.letterCount; col++) {
                const cell = this.grid[row][col];
                const x = startX + col * (squareSize + 10);
                const y = startY + row * (squareSize + 10);
                
                // Resize and reposition the cell
                cell.container.setPosition(x, y);
                
                // Redraw the square at the new size
                cell.square.clear();
                if (cell.state === 'correct') {
                    cell.square.fillStyle(0x6aaa64); // Green
                } else if (cell.state === 'present') {
                    cell.square.fillStyle(0xc9b458); // Yellow
                } else if (cell.state === 'absent') {
                    cell.square.fillStyle(0x787c7e); // Gray
                } else {
                    cell.square.fillStyle(0xf5f5f5); // Default
                }
                cell.square.fillRoundedRect(0, 0, squareSize, squareSize, 10);
                
                // Adjust text size
                cell.letter.setFontSize(squareSize * 0.6);
                cell.letter.setPosition(squareSize / 2, squareSize / 2);
            }
        }
    }
    
    repositionKeyboard(isPortrait) {
        const keyboardRows = [
            ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
            ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
            ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL']
        ];
        
        // Calculate available height for keyboard
        const boardBottom = this.grid[this.maxGuesses-1][0].container.y + 80; // Position of last row + buffer
        const availableHeight = this.height - boardBottom - 20; // 20px bottom margin
        
        // Calculate available width - leave margins on the sides
        const availableWidth = this.width * 0.95;
        
        // Determine key size based on both width and height constraints
        let keySize;
        if (isPortrait) {
            // For portrait: base on width of top row (10 keys) with spacing
            // Shift keyboard up by reducing the reserved height
            keySize = Math.min(
                (availableWidth - 9 * 5) / 10, // Width constraint (10 keys in top row with 5px spacing)
                (availableHeight - 30) / 3.5 // Height constraint (3 rows + spacing) with extra space at bottom
            );
        } else {
            // For landscape: make keys bigger
            keySize = Math.min(
                (availableWidth - 9 * 8) / 10, // Width constraint
                availableHeight / 3.5 // Height constraint with more space
            );
            // Ensure keys are bigger in landscape
            keySize = Math.max(keySize, 45);
        }
        
        // Ensure minimum and maximum sizes
        keySize = Math.max(35, Math.min(65, keySize));
        
        const keySpacing = isPortrait ? Math.max(2, keySize * 0.1) : Math.max(5, keySize * 0.15);
        
        // Position keyboard at bottom of screen with some margin
        // For portrait, move keyboard up by adding an offset
        const portraitOffset = isPortrait ? 40 : 0;
        const keyboardY = this.height - (keySize * 3 + keySpacing * 4) - 20 - portraitOffset;
        
        let keyIndex = 0;
        
        keyboardRows.forEach((row, rowIndex) => {
            // Calculate row width precisely
            const rowWidth = row.reduce((sum, key) => {
                return sum + (key === 'ENTER' || key === 'DEL' ? 1.5 * keySize : keySize) + keySpacing;
            }, -keySpacing);
            
            // Center the row
            let startX = (this.width - rowWidth) / 2;
            
            row.forEach(key => {
                const keyWidth = key === 'ENTER' || key === 'DEL' ? 1.5 * keySize : keySize;
                
                if (keyIndex >= this.keyboard.length) return; // Safety check
                const keyObj = this.keyboard[keyIndex];
                
                // Reposition the key
                keyObj.container.setPosition(
                    startX,
                    keyboardY + rowIndex * (keySize + keySpacing)
                );
                
                // Redraw the key background
                keyObj.background.clear();
                if (keyObj.state === 'correct') {
                    keyObj.background.fillStyle(0x6aaa64); // Green
                } else if (keyObj.state === 'present') {
                    keyObj.background.fillStyle(0xc9b458); // Yellow
                } else if (keyObj.state === 'absent') {
                    keyObj.background.fillStyle(0x787c7e); // Gray
                } else {
                    keyObj.background.fillStyle(0xCCCCCC); // Default
                }
                keyObj.background.fillRoundedRect(0, 0, keyWidth, keySize, 8);
                
                // Resize text - use proportional sizing for consistent appearance
                // Set smaller font size for special keys
                const fontSize = key === 'ENTER' || key === 'DEL' 
                    ? Math.floor(keySize * 0.3) 
                    : Math.floor(keySize * 0.6);
                    
                keyObj.text.setFontSize(fontSize);
                keyObj.text.setPosition(keyWidth / 2, keySize / 2);
                
                // Update interactive area
                if (keyObj.container.input && keyObj.container.input.hitArea) {
                    keyObj.container.input.hitArea.width = keyWidth;
                    keyObj.container.input.hitArea.height = keySize;
                }
                
                startX += keyWidth + keySpacing;
                keyIndex++;
            });
        });
    }
    
    resizeGame() {
        // Call layout function when window is resized
        this.layoutGame();
    }

    getRandomWord() {
        return this.sixLetterWords[Math.floor(Math.random() * this.sixLetterWords.length)].toUpperCase();
    }

    createGameBoard() {
        const gridSize = this.letterCount;
        const isPortrait = this.scale.height > this.scale.width;
        const squareSize = isPortrait ? 
            Math.min(50, (this.width - 60) / gridSize) : 
            Math.min(50, (this.width - 120) / gridSize); // Smaller in landscape
        
        const startX = (this.width - (gridSize * squareSize + (gridSize - 1) * 10)) / 2;
        const startY = isPortrait ? 150 : 180;
            
        for (let row = 0; row < this.maxGuesses; row++) {
            this.grid[row] = [];
            for (let col = 0; col < this.letterCount; col++) {
                const x = startX + col * (squareSize + 10);
                const y = startY + row * (squareSize + 10);
                
                // Create cell background
                const square = this.add.graphics();
                square.fillStyle(0xf5f5f5);
                square.fillRoundedRect(0, 0, squareSize, squareSize, 10);
                
                // Create letter text (initially empty)
                const letter = this.add.bitmapText(squareSize / 2, squareSize / 2, 'pixelfont', '', 40);
                letter.setOrigin(0.5, 0.5);
                
                // Create a container for the cell
                const cellContainer = this.add.container(x, y, [square, letter]);
                
                // Store the cell container and its components
                this.grid[row][col] = {
                    container: cellContainer,
                    square: square,
                    letter: letter,
                    value: '',
                    state: 'empty' // Can be 'empty', 'filled', 'correct', 'present', or 'absent'
                };
            }
        }
    }

    createKeyboard() {
        const keyboardRows = [
            ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
            ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
            ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL']
        ];
        
        // Clear any existing keyboard if rebuilding
        this.keyboard = [];
        
        // Calculate initial sizes - these will be refined in repositionKeyboard
        const isPortrait = this.height > this.width;
        const baseKeySize = isPortrait ? 40 : 60; // Bigger keys in landscape
        const keySpacing = isPortrait ? 4 : 8;
        
        // Just create the keyboard elements - position will be set in repositionKeyboard
        keyboardRows.forEach((row, rowIndex) => {
            row.forEach(key => {
                const keyWidth = key === 'ENTER' || key === 'DEL' ? 1.5 * baseKeySize : baseKeySize;
                
                // Create key background
                const keyBg = this.add.graphics();
                keyBg.fillStyle(0xCCCCCC);
                keyBg.fillRoundedRect(0, 0, keyWidth, baseKeySize, 8);
                
                // Create key text
                const keyText = this.add.bitmapText(
                    keyWidth / 2,
                    baseKeySize / 2,
                    'pixelfont',
                    key,
                    key === 'ENTER' || key === 'DEL' ? 24 : 36
                );
                keyText.setOrigin(0.5, 0.5);
                
                // Create container for key
                const keyContainer = this.add.container(0, 0, [keyBg, keyText]);
                
                // Create reference to this key
                const keyObj = {
                    key: key,
                    container: keyContainer,
                    background: keyBg,
                    text: keyText,
                    state: 'unused'
                };
                
                // Store key information
                this.keyboard.push(keyObj);
                
                // Make key interactive
                keyContainer.setInteractive(
                    new Phaser.Geom.Rectangle(0, 0, keyWidth, baseKeySize),
                    Phaser.Geom.Rectangle.Contains
                );
                
                // Add pointer events with direct reference to the keyObj
                keyContainer.on('pointerdown', () => {
                    keyBg.clear();
                    if (keyObj.state === 'correct') {
                        keyBg.fillStyle(0x5a9a54); // Darker green
                    } else if (keyObj.state === 'present') {
                        keyBg.fillStyle(0xb9a448); // Darker yellow
                    } else if (keyObj.state === 'absent') {
                        keyBg.fillStyle(0x686c6e); // Darker gray
                    } else {
                        keyBg.fillStyle(0x999999); // Default darker
                    }
                    const currentWidth = key === 'ENTER' || key === 'DEL' ? 
                        keyContainer.input.hitArea.width : keyContainer.input.hitArea.width;
                    const currentHeight = keyContainer.input.hitArea.height;
                    keyBg.fillRoundedRect(0, 0, currentWidth, currentHeight, 8);
                });
                
                keyContainer.on('pointerup', () => {
                    keyBg.clear();
                    if (keyObj.state === 'correct') {
                        keyBg.fillStyle(0x6aaa64); // Green
                    } else if (keyObj.state === 'present') {
                        keyBg.fillStyle(0xc9b458); // Yellow
                    } else if (keyObj.state === 'absent') {
                        keyBg.fillStyle(0x787c7e); // Gray
                    } else {
                        keyBg.fillStyle(0xCCCCCC); // Default
                    }
                    const currentWidth = key === 'ENTER' || key === 'DEL' ? 
                        keyContainer.input.hitArea.width : keyContainer.input.hitArea.width;
                    const currentHeight = keyContainer.input.hitArea.height;
                    keyBg.fillRoundedRect(0, 0, currentWidth, currentHeight, 8);
                    this.handleKeyPress(key);
                });
                
                keyContainer.on('pointerout', () => {
                    keyBg.clear();
                    if (keyObj.state === 'correct') {
                        keyBg.fillStyle(0x6aaa64); // Green
                    } else if (keyObj.state === 'present') {
                        keyBg.fillStyle(0xc9b458); // Yellow
                    } else if (keyObj.state === 'absent') {
                        keyBg.fillStyle(0x787c7e); // Gray
                    } else {
                        keyBg.fillStyle(0xCCCCCC); // Default
                    }
                    const currentWidth = key === 'ENTER' || key === 'DEL' ? 
                        keyContainer.input.hitArea.width : keyContainer.input.hitArea.width;
                    const currentHeight = keyContainer.input.hitArea.height;
                    keyBg.fillRoundedRect(0, 0, currentWidth, currentHeight, 8);
                });
            });
        });
        
        // Actually position all the keyboard elements
        this.repositionKeyboard(isPortrait);
        
        // Add physical keyboard input
        this.input.keyboard.on('keydown', event => {
            if (event.key === 'Enter') {
                this.handleKeyPress('ENTER');
            } else if (event.key === 'Backspace') {
                this.handleKeyPress('DEL');
            } else if (/^[a-zA-Z]$/.test(event.key)) {
                this.handleKeyPress(event.key.toUpperCase());
            }
        });
    }

    handleKeyPress(key) {
        if (this.isGameOver || this.hasWon) return;
        
        if (key === 'ENTER') {
            this.submitGuess();
        } else if (key === 'DEL') {
            this.deleteLetter();
        } else if (/^[A-Z]$/.test(key)) {
            this.addLetter(key);
        }
    }

    addLetter(letter) {
        if (this.currentCol < this.letterCount) {
            const cell = this.grid[this.currentRow][this.currentCol];
            cell.letter.setText(letter);
            cell.value = letter;
            cell.state = 'filled';
            this.sounds.collect.setVolume(0.05).setLoop(false).play();
            this.currentCol++;
        }
    }

    deleteLetter() {
        if (this.currentCol > 0) {
            this.currentCol--;
            const cell = this.grid[this.currentRow][this.currentCol];
            cell.letter.setText('');
            cell.value = '';
            cell.state = 'empty';
        }
    }

    submitGuess() {
        // Check if the row is fully filled
        if (this.currentCol < this.letterCount) {
            this.vfx.shakeCamera();
            return;
        }
        
        // Get the current guess
        let guess = '';
        for (let col = 0; col < this.letterCount; col++) {
            guess += this.grid[this.currentRow][col].value;
        }
        
        // Check if guess is in dictionary
        if (!this.sixLetterWords.includes(guess)) {
            this.vfx.shakeCamera();
            this.sounds.lose.setVolume(0.5).setLoop(false).play();
            return;
        }
        
        // Check the guess against the target word
        let correctCount = 0;
        let letterCounts = {};
        const isPortrait = this.scale.height > this.scale.width;
        
        // Count letters in target word
        for (let i = 0; i < this.targetWord.length; i++) {
            const letter = this.targetWord[i];
            letterCounts[letter] = (letterCounts[letter] || 0) + 1;
        }
        
        // First pass: check for correct positions
        for (let col = 0; col < this.letterCount; col++) {
            const cell = this.grid[this.currentRow][col];
            const letter = cell.value;
            
            if (letter === this.targetWord[col]) {
                cell.state = 'correct';
                cell.square.clear();
                cell.square.fillStyle(0x6aaa64); // Green
                
                // Get the current size for this cell
                const squareSize = isPortrait ? 
                    Math.min(50, (this.width - 60) / this.letterCount) : 
                    Math.min(50, (this.width - 120) / this.letterCount);
                
                cell.square.fillRoundedRect(0, 0, squareSize, squareSize, 10);
                
                correctCount++;
                letterCounts[letter]--;
                
                // Update keyboard key
                this.updateKeyboardKey(letter, 'correct');
            }
        }
        
        // Second pass: check for present but wrong position
        for (let col = 0; col < this.letterCount; col++) {
            const cell = this.grid[this.currentRow][col];
            const letter = cell.value;
            
            if (cell.state !== 'correct') {
                if (this.targetWord.includes(letter) && letterCounts[letter] > 0) {
                    cell.state = 'present';
                    cell.square.clear();
                    cell.square.fillStyle(0xc9b458); // Yellow
                    
                    // Get the current size for this cell
                    const isPortrait = this.height > this.width;
                    const squareSize = isPortrait ? 
                        Math.min(50, (this.width - 60) / this.letterCount) : 
                        Math.min(50, (this.width - 120) / this.letterCount);
                    
                    cell.square.fillRoundedRect(0, 0, squareSize, squareSize, 10);
                    
                    letterCounts[letter]--;
                    
                    // Update keyboard key if not already correct
                    this.updateKeyboardKey(letter, 'present');
                } else {
                    cell.state = 'absent';
                    cell.square.clear();
                    cell.square.fillStyle(0x787c7e); // Gray
                    
                    // Get the current size for this cell
                    const isPortrait = this.height > this.width;
                    const squareSize = isPortrait ? 
                        Math.min(50, (this.width - 60) / this.letterCount) : 
                        Math.min(50, (this.width - 120) / this.letterCount);
                    
                    cell.square.fillRoundedRect(0, 0, squareSize, squareSize, 10);
                    
                    // Update keyboard key if not already correct or present
                    this.updateKeyboardKey(letter, 'absent');
                }
            }
        }
        
        // Animate the reveal
        this.animateReveal();
        
        // Check if won
        if (correctCount === this.letterCount) {
            this.hasWon = true;
            this.sounds.success.setVolume(1).setLoop(false).play();
            this.showCorrectGuessNotification();
        }
        
        // Move to next row regardless of correctness
        this.currentRow++;
        this.currentCol = 0;
        
        // Check if out of guesses
        if (this.currentRow >= this.maxGuesses && !this.hasWon) {
            this.showGameComplete(false);  // Show game over if all guesses used and not won
        }
    }

    animateReveal() {
        for (let col = 0; col < this.letterCount; col++) {
            const cell = this.grid[this.currentRow][col];
            
            // Add reveal animation
            this.tweens.add({
                targets: cell.container,
                scaleX: { from: 1, to: 0 },
                duration: 150,
                delay: col * 150,
                onComplete: () => {
                    this.tweens.add({
                        targets: cell.container,
                        scaleX: { from: 0, to: 1 },
                        duration: 150
                    });
                }
            });
        }
    }

    updateKeyboardKey(letter, state) {
        const keyObj = this.keyboard.find(k => k.key === letter);
        if (!keyObj) return;
        
        // Only update if the new state has higher priority
        const statePriority = { correct: 3, present: 2, absent: 1, unused: 0 };
        if (statePriority[state] > statePriority[keyObj.state]) {
            keyObj.state = state;
            
            keyObj.background.clear();
            if (state === 'correct') {
                keyObj.background.fillStyle(0x6aaa64); // Green
            } else if (state === 'present') {
                keyObj.background.fillStyle(0xc9b458); // Yellow
            } else if (state === 'absent') {
                keyObj.background.fillStyle(0x787c7e); // Gray
            }
            
            // Get current key dimensions from the hit area
            const currentWidth = keyObj.container.input.hitArea.width;
            const currentHeight = keyObj.container.input.hitArea.height;
            keyObj.background.fillRoundedRect(0, 0, currentWidth, currentHeight, 8);
        }
    }

    showCorrectGuessNotification() {
        const correctText = this.add.bitmapText(
            this.width / 2, 
            this.height / 2 - 150, 
            'pixelfont', 
            'CORRECT!', 
            48
        )
        .setOrigin(0.5)
        .setTint(0x00FF00);
        
        // Animate the notification
        this.tweens.add({
            targets: [correctText],
            alpha: { from: 1, to: 0 },
            y: '-=30',
            ease: 'Sine.easeOut',
            duration: 1500,
            onComplete: () => {
                correctText.destroy();
                // Start a new round when they got it correct
                this.gameOver();
            }
        });
    }

    showGameComplete(won) {
        if (won) {
            let winText = this.add.bitmapText(
                this.width / 2, 
                this.height / 2 - 100, 
                'pixelfont', 
                'ROUND COMPLETE!', 
                64
            )
            .setOrigin(0.5)
            .setVisible(false)
            .setTint(0x00FF00);
            
            let scoreText = this.add.bitmapText(
                this.width / 2, 
                this.height / 2 - 20, 
                'pixelfont', 
                `Score: ${this.score}`, 
                48
            )
            .setOrigin(0.5)
            .setVisible(false);
                
            this.time.delayedCall(1000, () => {
                winText.setVisible(true);
                scoreText.setVisible(true);
                this.tweens.add({
                    targets: [winText, scoreText],
                    scale: { from: 0.5, to: 1.2 },
                    alpha: { from: 0, to: 1 },
                    ease: 'Elastic.easeOut',
                    duration: 1500,
                    onComplete: () => {
                        this.time.delayedCall(1500, () => {
                            this.gameOver();
                        });
                    }
                });
            });
        } else {
            // Show correct word but don't end the game
            let correctWordText = this.add.bitmapText(
                this.width / 2, 
                this.height / 2 - 50, 
                'pixelfont', 
                `The word was: ${this.targetWord}`, 
                48
            )
            .setOrigin(0.5)
            .setVisible(false);
                
            let roundCompleteText = this.add.bitmapText(
                this.width / 2, 
                this.height / 2 - 150, 
                'pixelfont', 
                'ROUND COMPLETE', 
                64
            )
            .setOrigin(0.5)
            .setVisible(false)
            .setTint(0xFF5500);
                
            this.sounds.lose.setVolume(1).setLoop(false).play();
                
            this.time.delayedCall(1000, () => {
                roundCompleteText.setVisible(true);
                correctWordText.setVisible(true);
                this.tweens.add({
                    targets: [roundCompleteText, correctWordText],
                    scale: { from: 0.5, to: 1 },
                    alpha: { from: 0, to: 1 },
                    ease: 'Elastic.easeOut',
                    duration: 1500,
                    onComplete: () => {
                        // Remove the text after displaying it for a short time
                        this.time.delayedCall(2000, () => {
                            // Fade out and destroy the text
                            this.tweens.add({
                                targets: [roundCompleteText, correctWordText],
                                alpha: 0,
                                duration: 500,
                                onComplete: () => {
                                    roundCompleteText.destroy();
                                    correctWordText.destroy();
                                    
                                    // Check if time ran out or all guesses used
                                    if (this.startTime <= 0) {
                                        this.resetGame(true); // End the game properly
                                    } else {
                                        this.gameOver(); // Game Over
                                    }
                                }
                            });
                        });
                    }
                });
            });
        }
    }
    
    startNewRound() {
        // Choose a new word first
        this.targetWord = this.getRandomWord();
        console.log("New target word:", this.targetWord);
        
        // Reset game state
        this.currentRow = 0;
        this.currentCol = 0;
        this.hasWon = false;
        this.isGameOver = false;  // Add this line to ensure game state is reset
        
        // Clear the board
        for (let row = 0; row < this.maxGuesses; row++) {
            for (let col = 0; col < this.letterCount; col++) {
                const cell = this.grid[row][col];
                cell.letter.setText('');
                cell.value = '';
                cell.state = 'empty';
                cell.square.clear();
                
                // Get the current size for proper rendering
                const isPortrait = this.height > this.width;
                const squareSize = isPortrait ? 
                    Math.min(50, (this.width - 60) / this.letterCount) : 
                    Math.min(50, (this.width - 120) / this.letterCount);
                
                cell.square.fillStyle(0xf5f5f5);
                cell.square.fillRoundedRect(0, 0, squareSize, squareSize, 10);
            }
        }
        
        // Reset keyboard
        this.keyboard.forEach(key => {
            key.state = 'unused';
            key.background.clear();
            key.background.fillStyle(0xCCCCCC);
            
            // Get current key dimensions from the hit area
            const currentWidth = key.container.input.hitArea.width;
            const currentHeight = key.container.input.hitArea.height;
            key.background.fillRoundedRect(0, 0, currentWidth, currentHeight, 8);
        });
        
        // Add time for next round
        this.startTime += 30;
        this.updateTimerDisplay();
    }

    resetGame(isGameOver) {
        if (!this.isGameOver) {
            this.isGameOver = true;
            this.currentRow = 0;  // Add this to reset row position
            this.currentCol = 0;  // Add this to reset column position
            
            this.sounds.background.stop();
            
            if (isGameOver) {
                this.gameOver();
            }
        }
    }

    updateTimerDisplay() {
        if (!this.isGameOver) {
            this.timerText.setText(`Time: ${this.startTime}`);
        }
    }

    pauseGame() {
        handlePauseGame.bind(this)();
        
    }
    gameOver() {
        this.sounds.background.stop();
        // When the game restarts after gameOver, we need to ensure the game state is reset
        this.currentRow = 0;
        this.currentCol = 0;
        
        initiateGameOver.bind(this)({
            "Time left": this.startTime,
        });
    }
}

// Keep existing loader function
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
        console.log(file.src);
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
    width: window.innerWidth,
    height: window.innerHeight,
    scene: [GameScene],
    scale: {
        mode: Phaser.Scale.RESIZE,  // Changed from FIT to RESIZE
        autoCenter: Phaser.Scale.CENTER_BOTH,
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
    }
};