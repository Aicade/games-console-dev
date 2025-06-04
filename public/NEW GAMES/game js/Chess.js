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
class ChessScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ChessScene' });
        this.tileSize = 80;
        this.currentTurn = 'white';
        this.isComputerPlaying = true; // Auto-play black moves using chess-bot
    }
    preload() {
        // Load chess piece images
        this.load.image('white_pawn', 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg');
        this.load.image('white_rook', 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg');
        this.load.image('white_knight', 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg');
        this.load.image('white_bishop', 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg');
        this.load.image('white_queen', 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg');
        this.load.image('white_king', 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg');
        
        this.load.image('black_pawn', 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg');
        this.load.image('black_rook', 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg');
        this.load.image('black_knight', 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg');
        this.load.image('black_bishop', 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg');
        this.load.image('black_queen', 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg');
        this.load.image('black_king', 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg');
        this.load.image("pauseButton", "https://aicade-ui-assets.s3.amazonaws.com/GameAssets/icons/pause.png");
        
        displayProgressLoader.call(this);
    }

    create() {
        // Initialize the chess board
        this.board = this.createBoard();
        this.pieces = this.setupPieces();
        this.validMoveHighlights = [];
         this.calculateTileSize();
    
    // Add resize event listener
    this.scale.on('resize', this.handleResize, this);

        // Draw the board
        this.drawBoard();
        
        // Create UI for automatic move integration
        this.createAutoMoveUI();

        // Set up player input
        this.input.on('pointerdown', (pointer) => this.handlePlayerMove(pointer));
         this.pauseButton = this.add.sprite(this.width - 50, 60, "pauseButton").setOrigin(0.5, 0.5);
        this.pauseButton.setInteractive({ cursor: 'pointer' });
        this.pauseButton.setScale(3);
        this.pauseButton.setDepth(11);
        this.pauseButton.on('pointerdown', () => this.pauseGame());
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());

        // Track selected piece and valid moves
        this.selectedPiece = null;
        this.validMoves = [];
        
        // Display current turn
        this.turnText = this.add.text(10, 650, "Current Turn: White", {
            fontSize: '24px',
            fill: '#fff',
            backgroundColor: '#000',
            padding: { x: 10, y: 5 }
        });
        
        // Create FEN representation for the initial board position
        this.updateFEN();
        
        // Setup auto move timer for black
        this.setupAutoMove();
    }
    calculateTileSize() {
    // Determine if we're in portrait mode
    const isPortrait = this.game.config.height > this.game.config.width;
    
    // In portrait mode, make autoUI panel smaller and position it below board
    if (isPortrait) {
        // Reserve less space for UI in portrait mode
        const maxWidth = this.game.config.width * 0.9; 
        const maxHeight = this.game.config.height * 0.6; // Use 60% of height for board
        
        // Calculate maximum tile size
        const availableSpace = Math.min(maxWidth, maxHeight);
        this.tileSize = Math.floor(availableSpace / 8);
        
        // Center board horizontally
        this.boardX = (this.game.config.width - (this.tileSize * 8)) / 2;
        this.boardY = 50; // Position at top with margin
    } else {
        // Landscape layout (your original code)
        const maxWidth = this.game.config.width - 320; 
        const maxHeight = this.game.config.height - 100;
        
        const maxBoardWidth = maxWidth * 0.9;
        const maxBoardHeight = maxHeight * 0.9;
        
        const availableSpace = Math.min(maxBoardWidth, maxBoardHeight);
        this.tileSize = Math.floor(availableSpace / 8);
        
        this.boardX = (this.game.config.width - 300 - (this.tileSize * 8)) / 2;
        this.boardY = (this.game.config.height - (this.tileSize * 8)) / 2;
    }
}

handleResize() {
    this.calculateTileSize();
    this.drawBoard();

    if (this.turnText) {
        this.turnText.setPosition(this.boardX, this.boardY + (this.tileSize * 8) + 40);
    }

    const isPortrait = this.game.config.height > this.game.config.width;
    if (isPortrait) {
        if (this.autoUIPanel) this.autoUIPanel.setVisible(false);
        
        // Ensure AI moves work without UI
        if (this.currentTurn === 'black' && this.isComputerPlaying) {
            this.makeAutomatedMove();
        }
    } else {
        if (this.autoUIPanel) {
            this.autoUIPanel.setVisible(true);
            this.autoUIPanel.setPosition(this.game.config.width - 300, 50);
        }
    }
}


repositionUI() {
    // Reposition turn text
    this.turnText.setPosition(this.boardX, this.boardY + (this.tileSize * 8) + 10);
    
    // Reposition other UI elements like the auto move panel
    // You'll need to adjust coordinates for all UI elements
    
    // Reposition pause button
    this.pauseButton.setPosition(this.boardX + (this.tileSize * 8) - 30, this.boardY + 30);
}

    createBoard() {
        return Array(8).fill().map(() => Array(8).fill(null));
    }

    setupPieces() {
    const pieces = [];
    const pieceTypes = {
        0: 'rook', 1: 'knight', 2: 'bishop', 3: 'queen', 
        4: 'king', 5: 'bishop', 6: 'knight', 7: 'rook'
    };

    // Place pawns and back rank pieces
    // FIXED: Swap the positions so white is at the bottom (standard chess setup)
    ['black', 'white'].forEach((player, playerIndex) => {
        const backRank = playerIndex === 0 ? 0 : 7;
        const pawnRank = playerIndex === 0 ? 1 : 6;
        
        // Pawns
        for (let i = 0; i < 8; i++) {
            pieces.push({ type: 'pawn', x: i, y: pawnRank, player });
        }
        
        // Back rank pieces
        for (let i = 0; i < 8; i++) {
            pieces.push({ type: pieceTypes[i], x: i, y: backRank, player });
        }
    });

    return pieces;
}

    drawBoard() {
    // Clear any existing pieces and board elements
    this.children.list.forEach(child => {
        if (child.type === 'Sprite' || child.type === 'Rectangle') {
            child.destroy();
        }
    });

    // Draw the board
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const color = (x + y) % 2 === 0 ? 0xEEEED2 : 0x769656;
            this.add.rectangle(
                this.boardX + x * this.tileSize + this.tileSize / 2, 
                this.boardY + y * this.tileSize + this.tileSize / 2, 
                this.tileSize, this.tileSize, color
            ).setOrigin(0.5);
        }
    }
    
    // Add coordinate labels
    for (let x = 0; x < 8; x++) {
        // File labels (a-h) at the bottom
        this.add.text(
            this.boardX + x * this.tileSize + this.tileSize / 2, 
            this.boardY + 8 * this.tileSize + 15, // Position below the board
            String.fromCharCode(97 + x), 
            { fontSize: '16px', fill: '#000000' }
        ).setOrigin(0.5);
    }
    
    for (let y = 0; y < 8; y++) {
        // Rank labels (1-8) on the left
        this.add.text(
            this.boardX - 15, // Position to the left of the board
            this.boardY + y * this.tileSize + this.tileSize / 2, 
            (8 - y).toString(), 
            { fontSize: '16px', fill: '#000000' }
        ).setOrigin(0.5);
    }

    // Draw pieces
    this.pieces.forEach(piece => {
        if (!piece.sprite || !piece.sprite.active) {
            const spriteKey = `${piece.player}_${piece.type}`;
            const sprite = this.add.sprite(
                this.boardX + piece.x * this.tileSize + this.tileSize / 2, 
                this.boardY + piece.y * this.tileSize + this.tileSize / 2, 
                spriteKey
            ).setOrigin(0.5).setDisplaySize(this.tileSize * 0.8, this.tileSize * 0.8);
            
            piece.sprite = sprite;
        } else {
            // Update existing sprite position
            piece.sprite.setPosition(
                this.boardX + piece.x * this.tileSize + this.tileSize / 2,
                this.boardY + piece.y * this.tileSize + this.tileSize / 2
            );
            piece.sprite.setDisplaySize(this.tileSize * 0.8, this.tileSize * 0.8);
        }
        
        this.board[piece.y][piece.x] = piece;
    });
}

    createAutoMoveUI() {
        const isPortrait = this.game.config.height > this.game.config.width;
    
    if (isPortrait) {
        this.autoUIPanel = null;  // Prevent UI from being created
        return;
    }
     const panelWidth = Math.min(280, this.game.config.width * 0.25);
    const panelHeight = 280;
    
    // Position panel in top right, with smaller width on narrow screens
    const panelX = this.game.config.width - panelWidth - 10;
    const panelY = 50;
    
    // Create the panel background
    this.autoUIPanel = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x333333).setOrigin(0);
    
    // Adjust text and element sizing based on available space
    const fontSize = Math.max(10, Math.min(14, this.game.config.width / 50));
    
    // Add UI elements...
    this.add.text(panelX + 10, panelY + 10, "Auto Chess-Bot Integration", {
        fontSize: '18px',
        fill: '#fff'
    });
        this.add.text(panelX + 10, panelY + 40, "Current FEN:", {
            fontSize: '14px',
            fill: '#fff'
        });
        
        this.fenText = this.add.text(panelX + 10, panelY + 60, "", {
            fontSize: '12px',
            fill: '#fff',
            wordWrap: { width: panelWidth - 20 }
        });
        
        this.add.text(panelX + 10, panelY + 100, "Auto-play Status:", {
            fontSize: '14px',
            fill: '#fff'
        });
        
        this.statusText = this.add.text(panelX + 10, panelY + 120, 
            "When it's Black's turn, the best move\nfrom chess-bot.com will be used.", {
            fontSize: '12px',
            fill: '#fff'
        });
        
        // Create auto move toggle
        const toggleAutoButton = document.createElement('button');
        toggleAutoButton.textContent = 'Toggle Auto-play';
        toggleAutoButton.style = 'padding: 5px 10px;';
        const toggleButtonElement = this.add.dom(panelX + 90, panelY + 160, toggleAutoButton);
        
        // Manual move input for testing
        const moveInputElement = document.createElement('input');
        moveInputElement.style = 'width: 100px; padding: 5px;';
        moveInputElement.placeholder = 'e.g., e7e5';
        const moveInput = this.add.dom(panelX + 80, panelY + 200, moveInputElement);
        
        const applyButton = document.createElement('button');
        applyButton.textContent = 'Apply Move';
        applyButton.style = 'padding: 5px 10px; margin-left: 10px;';
        const buttonElement = this.add.dom(panelX + 180, panelY + 200, applyButton);
        
        // Add copy FEN button for convenience
        const copyFenButton = document.createElement('button');
        copyFenButton.textContent = 'Copy FEN';
        copyFenButton.style = 'padding: 5px 10px;';
        const copyButtonElement = this.add.dom(panelX + 80, panelY + 240, copyFenButton);
        
        // Button click handlers
        toggleAutoButton.addEventListener('click', () => {
            this.isComputerPlaying = !this.isComputerPlaying;
            this.statusText.setText(this.isComputerPlaying ? 
                "When it's Black's turn, the best move\nfrom chess-bot.com will be used." : 
                "Auto-play is disabled. Use the input\nbelow to enter Black's moves manually.");
            
            if (this.currentTurn === 'black' && this.isComputerPlaying) {
                this.turnText.setText("Black's turn - Fetching best move...");
                this.makeAutomatedMove();
            }
        });
        
        applyButton.addEventListener('click', () => {
            const moveText = moveInputElement.value;
            if (moveText && moveText.length >= 4) {
                this.applyCalculatedMove(moveText);
                moveInputElement.value = '';
            }
        });
        
        copyFenButton.addEventListener('click', () => {
            navigator.clipboard.writeText(this.fenText.text)
                .then(() => {
                    alert('FEN copied to clipboard!');
                })
                .catch(err => {
                    console.error('Could not copy FEN: ', err);
                });
        });
    }

    

    setupAutoMove() {
        this.events.on('turnChanged', () => {
        if (this.currentTurn === 'black' && this.isComputerPlaying) {
            this.makeAutomatedMove();
        }
    });
    }

    makeAutomatedMove() {
        if (this.gameOver) return;
        
        
        this.turnText.setText("Black's turn - Calculating best move...");
        
        // Simulate a delay for processing
        this.time.delayedCall(1500, () => {
            // Generate a simple move for black based on the current board state
            const move = this.calculateBestMove();
            if (move) {
                this.applyCalculatedMove(move);
                if (this.statusText) {
    this.statusText.setText(`Applied move: ${move}`);
}
            } else {
                if (this.statusText) {
    this.statusText.setText("No valid moves found for Black");
}

            }
        });
    }

    calculateBestMove() {
    // Find all black pieces with valid moves
    const blackPieces = this.pieces.filter(piece => piece.player === 'black');
    const piecesWithMoves = [];
    
    for (const piece of blackPieces) {
        const moves = this.getValidMoves(piece);
        if (moves.length > 0) {
            piecesWithMoves.push({ piece, moves });
        }
    }
    
    if (piecesWithMoves.length === 0) return null;
    
    // Strategic priorities:
    // 1. Check if king is in check - if so, find moves to get out of check
    const king = this.pieces.find(p => p.type === 'king' && p.player === 'black');
    const isInCheck = this.isKingInCheck('black');
    
    if (isInCheck) {
        // Find any move that gets out of check
        for (const { piece, moves } of piecesWithMoves) {
            // Return first valid move (any valid move gets out of check due to our validation)
            if (moves.length > 0) {
                const move = moves[0];
                return `${String.fromCharCode(97 + piece.x)}${8 - piece.y}${String.fromCharCode(97 + move.x)}${8 - move.y}`;
            }
        }
    }
    
    // 2. Look for captures, prioritize by piece value
    const pieceValues = {
        'pawn': 1, 'knight': 3, 'bishop': 3, 'rook': 5, 'queen': 9, 'king': 100
    };
    
    // Find capturing moves
    let bestCaptureValue = 0;
    let bestCaptureMove = null;
    
    for (const { piece, moves } of piecesWithMoves) {
        for (const move of moves) {
            const targetPiece = this.board[move.y][move.x];
            if (targetPiece && targetPiece.player === 'white') {
                const captureValue = pieceValues[targetPiece.type];
                if (captureValue > bestCaptureValue) {
                    bestCaptureValue = captureValue;
                    bestCaptureMove = {
                        from: piece,
                        to: move
                    };
                }
            }
        }
    }
    
    if (bestCaptureMove) {
        return `${String.fromCharCode(97 + bestCaptureMove.from.x)}${8 - bestCaptureMove.from.y}${String.fromCharCode(97 + bestCaptureMove.to.x)}${8 - bestCaptureMove.to.y}`;
    }
    
    // 3. Try to develop pieces - move knights and bishops first
    for (const { piece, moves } of piecesWithMoves) {
        if ((piece.type === 'knight' || piece.type === 'bishop') && 
            (piece.y === 7 || piece.y === 6)) {
            // Find a move toward the center
            const centerMove = moves.find(move => move.y < piece.y);
            if (centerMove) {
                return `${String.fromCharCode(97 + piece.x)}${8 - piece.y}${String.fromCharCode(97 + centerMove.x)}${8 - centerMove.y}`;
            }
        }
    }
    
    // 4. Advance pawns strategically, prefer center pawns
    const centerPawns = piecesWithMoves.filter(
        ({ piece }) => piece.type === 'pawn' && (piece.x === 3 || piece.x === 4)
    );
    
    if (centerPawns.length > 0) {
        const { piece, moves } = centerPawns[0];
        const forwardMove = moves.find(move => move.y < piece.y && move.x === piece.x);
        if (forwardMove) {
            return `${String.fromCharCode(97 + piece.x)}${8 - piece.y}${String.fromCharCode(97 + forwardMove.x)}${8 - forwardMove.y}`;
        }
    }
    
    // 5. Random fallback strategy - select a random piece and move
    const randomPieceIndex = Math.floor(Math.random() * piecesWithMoves.length);
    const { piece, moves } = piecesWithMoves[randomPieceIndex];
    const randomMoveIndex = Math.floor(Math.random() * moves.length);
    const move = moves[randomMoveIndex];
    
    return `${String.fromCharCode(97 + piece.x)}${8 - piece.y}${String.fromCharCode(97 + move.x)}${8 - move.y}`;
}

    updateFEN() {
        let fen = '';
        
        // Board position
        for (let y = 0; y < 8; y++) {
            let emptyCount = 0;
            for (let x = 0; x < 8; x++) {
                const piece = this.board[y][x];
                if (piece) {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    
                    const pieceChars = {
                        'pawn': 'p', 'rook': 'r', 'knight': 'n',
                        'bishop': 'b', 'queen': 'q', 'king': 'k'
                    };
                    
                    let pieceChar = pieceChars[piece.type];
                    fen += piece.player === 'white' ? pieceChar.toUpperCase() : pieceChar;
                } else {
                    emptyCount++;
                }
            }
            if (emptyCount > 0) {
                fen += emptyCount;
            }
            if (y < 7) fen += '/';
        }
        
        // Add turn indicator and other FEN components
        fen += ' ' + (this.currentTurn === 'white' ? 'w' : 'b');
        fen += ' KQkq - 0 1'; // Simplified castling, en passant, halfmove and fullmove
        
        if (this.fenText) {
            this.fenText.setText(fen);
        }
        
        return fen;
    }

    applyCalculatedMove(moveText) {
    if (moveText.length < 4) return;
    
    const fromFile = moveText.charCodeAt(0) - 97; 
    const fromRank = 8 - parseInt(moveText[1]);  
    const toFile = moveText.charCodeAt(2) - 97;  
    const toRank = 8 - parseInt(moveText[3]);    
    
    // Find the piece at the starting position
    const piece = this.board[fromRank][fromFile];
    
    if (piece) {
        // Move the piece
        this.movePiece(piece, toFile, toRank);
        
        // Switch turns
        this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';
        
        // Check for checkmate after the move
        if (this.isKingInCheck(this.currentTurn)) {
            // See if the checked player has any valid moves
            const checkedPlayerPieces = this.pieces.filter(p => p.player === this.currentTurn);
            let hasValidMove = false;
            
            for (const piece of checkedPlayerPieces) {
                const moves = this.getValidMoves(piece);
                if (moves.length > 0) {
                    hasValidMove = true;
                    break;
                }
            }
            
            if (!hasValidMove) {
    // Checkmate!
    const winner = this.currentTurn === 'white' ? 'black' : 'white';
    this.turnText.setText(`Checkmate! ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins!`);
    this.gameOver = true;
    this.time.delayedCall(2000, () => {
        this.endGame(winner);
    }); // Call the gameOver function
    return;
}
        }
        
        this.events.emit('turnChanged');
        this.turnText.setText(`Current Turn: ${this.currentTurn.charAt(0).toUpperCase() + this.currentTurn.slice(1)}`);
        
        // Update FEN
        this.updateFEN();
    }
}

   handlePlayerMove(pointer) {
    if (this.gameOver) return;
    
    // Calculate board coordinates with offset
    const boardX = Math.floor((pointer.x - this.boardX) / this.tileSize);
    const boardY = Math.floor((pointer.y - this.boardY) / this.tileSize);
    
    // Check if click is within board boundaries
    if (boardX < 0 || boardX > 7 || boardY < 0 || boardY > 7) return;
    
    // If it's black's turn and computer is playing, ignore player moves
    if (this.currentTurn === 'black' && this.isComputerPlaying) return;

    // FIXED: Improved piece selection and move logic
    if (this.selectedPiece) {
        // Check if the clicked tile is a valid move
        const validMove = this.validMoves.find(move => move.x === boardX && move.y === boardY);
        if (validMove) {
            // Move the selected piece
            this.movePiece(this.selectedPiece, boardX, boardY);
            this.clearHighlights();
            this.selectedPiece = null;
            this.validMoves = [];
            
            // Switch turns
            this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';
            
            // Check for checkmate after the move
            if (this.isKingInCheck(this.currentTurn)) {
                // See if the checked player has any valid moves
                const checkedPlayerPieces = this.pieces.filter(p => p.player === this.currentTurn);
                let hasValidMove = false;
                
                for (const piece of checkedPlayerPieces) {
                    const moves = this.getValidMoves(piece);
                    if (moves.length > 0) {
                        hasValidMove = true;
                        break;
                    }
                }
                
                if (!hasValidMove) {
                    // Checkmate!
                    const winner = this.currentTurn === 'white' ? 'black' : 'white';
                    this.turnText.setText(`Checkmate! ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins!`);
                    this.gameOver = true;
                    this.time.delayedCall(2000, () => {
        this.endGame(winner);
    });
                    return;
                }
            }
            
            // Event and display updates
            this.events.emit('turnChanged');
            
            // Update display
            if (this.currentTurn === 'black' && this.isComputerPlaying) {
                this.turnText.setText("Black's turn - Calculating best move...");
            } else {
                this.turnText.setText(`Current Turn: ${this.currentTurn.charAt(0).toUpperCase() + this.currentTurn.slice(1)}`);
            }
            
            // Update FEN for move calculator
            this.updateFEN();
        } else if (this.board[boardY][boardX] && this.board[boardY][boardX].player === this.currentTurn) {
            // If clicking on another piece of the same color, select that piece instead
            this.clearHighlights();
            this.selectedPiece = this.board[boardY][boardX];
            this.validMoves = this.getValidMoves(this.selectedPiece);
            this.highlightValidMoves();
        } else {
            // Deselect the piece
            this.clearHighlights();
            this.selectedPiece = null;
            this.validMoves = [];
        }
    } else {
        // Check if the player clicked on a piece of the current turn
        const piece = this.board[boardY][boardX];
        // FIXED: Added more logging and checks to help diagnose issues
        console.log("Clicked on:", boardX, boardY, "Piece:", piece ? `${piece.player} ${piece.type}` : "none");
        
        if (piece && piece.player === this.currentTurn) {
            this.selectedPiece = piece;
            this.validMoves = this.getValidMoves(piece);
            console.log("Selected piece has", this.validMoves.length, "valid moves");
            this.highlightValidMoves();
        }
    }
}
    movePiece(piece, x, y) {
    // Update the board data structure
    this.board[piece.y][piece.x] = null;
    
    // Capture any piece at the target position
    const capturedPiece = this.board[y][x];
    if (capturedPiece) {
        capturedPiece.sprite.destroy();
        this.pieces = this.pieces.filter(p => p !== capturedPiece);
    }
    
    // Move the piece
    piece.x = x;
    piece.y = y;
    
    // Update sprite position with correct board offset
    piece.sprite.setPosition(
        this.boardX + x * this.tileSize + this.tileSize / 2, 
        this.boardY + y * this.tileSize + this.tileSize / 2
    );
    
    // Update the board data structure
    this.board[y][x] = piece;
    
    // Check for pawn promotion
    if (piece.type === 'pawn') {
        if ((piece.player === 'white' && y === 0) || (piece.player === 'black' && y === 7)) {
            piece.type = 'queen';
            piece.sprite.destroy();
            
            const spriteKey = `${piece.player}_queen`;
            const sprite = this.add.sprite(
                this.boardX + piece.x * this.tileSize + this.tileSize / 2, 
                this.boardY + piece.y * this.tileSize + this.tileSize / 2, 
                spriteKey
            ).setOrigin(0.5).setDisplaySize(this.tileSize * 0.8, this.tileSize * 0.8);
            
            piece.sprite = sprite;
        }
    }
}
    isKingInCheck(player) {
    // Find the king
    const king = this.pieces.find(p => p.type === 'king' && p.player === player);
    if (!king) return false;
    
    // Check if any opponent piece can capture the king
    const opponentPlayer = player === 'white' ? 'black' : 'white';
    const opponentPieces = this.pieces.filter(p => p.player === opponentPlayer);
    
    for (const piece of opponentPieces) {
        const moves = this.getValidMovesWithoutCheckValidation(piece);
        if (moves.some(move => move.x === king.x && move.y === king.y)) {
            return true;
        }
    }
    
    return false;
}

isCheckmate(player) {
    if (!this.isKingInCheck(player)) return false;
    
    // Check if any move can get the king out of check
    const playerPieces = this.pieces.filter(p => p.player === player);
    
    for (const piece of playerPieces) {
        const moves = this.getValidMoves(piece);
        if (moves.length > 0) return false;
    }
    
    return true;
}
getValidMovesWithoutCheckValidation(piece) {
    const moves = [];
    const { x, y, type, player } = piece;
    
    // FIXED: Direction for pawns (white moves UP the board (negative y), black moves DOWN (positive y))
    const direction = player === 'white' ? -1 : 1;
    
    switch (type) {
        case 'pawn':
            // Forward move
            if (this.isInBounds(x, y + direction) && !this.board[y + direction][x]) {
                moves.push({ x, y: y + direction });
                
                // Double move from starting position
                // FIXED: Starting ranks for white (6) and black (1)
                const startRank = player === 'white' ? 6 : 1;
                if (y === startRank && this.isInBounds(x, y + 2 * direction) && !this.board[y + 2 * direction][x]) {
                    moves.push({ x, y: y + 2 * direction });
                }
            }
            
            // Capture moves
            [{ x: x - 1, y: y + direction }, { x: x + 1, y: y + direction }].forEach(pos => {
                if (this.isInBounds(pos.x, pos.y) && this.board[pos.y][pos.x] && this.board[pos.y][pos.x].player !== player) {
                    moves.push(pos);
                }
            });
            break;
            
        case 'rook':
            // Horizontal and vertical moves
            this.addStraightMoves(moves, x, y, player, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
            break;
            
        case 'knight':
            // L-shaped moves
            [
                { x: x + 1, y: y + 2 }, { x: x + 2, y: y + 1 },
                { x: x + 2, y: y - 1 }, { x: x + 1, y: y - 2 },
                { x: x - 1, y: y - 2 }, { x: x - 2, y: y - 1 },
                { x: x - 2, y: y + 1 }, { x: x - 1, y: y + 2 }
            ].forEach(pos => {
                if (this.isInBounds(pos.x, pos.y) && (!this.board[pos.y][pos.x] || this.board[pos.y][pos.x].player !== player)) {
                    moves.push(pos);
                }
            });
            break;
            
        case 'bishop':
            // Diagonal moves
            this.addStraightMoves(moves, x, y, player, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
            break;
            
        case 'queen':
            // Combine rook and bishop moves
            this.addStraightMoves(moves, x, y, player, [
                [1, 0], [-1, 0], [0, 1], [0, -1],
                [1, 1], [1, -1], [-1, 1], [-1, -1]
            ]);
            break;
            
        case 'king':
            // One square in any direction
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    
                    const newX = x + dx;
                    const newY = y + dy;
                    
                    if (this.isInBounds(newX, newY) && (!this.board[newY][newX] || this.board[newY][newX].player !== player)) {
                        moves.push({ x: newX, y: newY });
                    }
                }
            }
            break;
    }
    
    return moves;
}

        // Get potential moves without check validation
    getValidMoves(piece) {
    // Get all potential moves without considering check
    const potentialMoves = this.getValidMovesWithoutCheckValidation(piece);
    
    // Filter out moves that would leave the king in check
    return potentialMoves.filter(move => {
        // Save original piece position and target square state
        const originalX = piece.x;
        const originalY = piece.y;
        const targetPiece = this.board[move.y][move.x];
        
        // Temporarily make the move
        this.board[piece.y][piece.x] = null;
        this.board[move.y][move.x] = piece;
        piece.x = move.x;
        piece.y = move.y;
        
        // Check if this move would leave/put the king in check
        const isValid = !this.isKingInCheck(piece.player);
        
        // Restore the original position
        piece.x = originalX;
        piece.y = originalY;
        this.board[originalY][originalX] = piece;
        this.board[move.y][move.x] = targetPiece;
        
        return isValid;
    });
}
    
    addStraightMoves(moves, x, y, player, directions) {
        directions.forEach(([dx, dy]) => {
            let newX = x + dx;
            let newY = y + dy;
            
            while (this.isInBounds(newX, newY)) {
                const targetPiece = this.board[newY][newX];
                
                if (!targetPiece) {
                    // Empty square
                    moves.push({ x: newX, y: newY });
                } else {
                    // Square has a piece
                    if (targetPiece.player !== player) {
                        // Can capture opponent's piece
                        moves.push({ x: newX, y: newY });
                    }
                    break; // Stop in this direction
                }
                
                newX += dx;
                newY += dy;
            }
        });
    }
    
    isInBounds(x, y) {
        return x >= 0 && x < 8 && y >= 0 && y < 8;
    }

    highlightValidMoves() {
    this.clearHighlights();
    
    // Highlight the selected piece
    const selectedHighlight = this.add.rectangle(
        this.boardX + this.selectedPiece.x * this.tileSize + this.tileSize / 2, 
        this.boardY + this.selectedPiece.y * this.tileSize + this.tileSize / 2, 
        this.tileSize * 0.9, 
        this.tileSize * 0.9, 
        0xFFA500, 
        0.7
    ).setOrigin(0.5);
    this.validMoveHighlights.push(selectedHighlight);
    
    // Highlight valid moves
    this.validMoves.forEach(move => {
        const color = this.board[move.y][move.x] ? 0xFF0000 : 0x00FF00;
        const highlight = this.add.circle(
            this.boardX + move.x * this.tileSize + this.tileSize / 2, 
            this.boardY + move.y * this.tileSize + this.tileSize / 2, 
            this.tileSize * 0.3, 
            color, 
            0.5
        ).setOrigin(0.5);
        
        this.validMoveHighlights.push(highlight);
    });
}

    clearHighlights() {
        this.validMoveHighlights.forEach(highlight => highlight.destroy());
        this.validMoveHighlights = [];
    }
    endGame(winner) {
    // Change method name to avoid conflict with the gameOver flag
    this.gameOver = true;
    this.turnText.setText(`Checkmate! ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins!`);
    
    // If you have a gameOver callback function, use it:
    if (typeof initiateGameOver === 'function') {
        initiateGameOver.bind(this)({
            "winner": `${winner.charAt(0).toUpperCase() + winner.slice(1)} wins by checkmate!`
        });
    }
}

pauseGame() {
        handlePauseGame.bind(this)();
    }
}

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    dom: {
        createContainer: true
    },
    scene: [ChessScene],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    pixelArt: false,
};