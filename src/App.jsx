import React, { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";
// --- Constants for Game Logic and Board ---
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20; // Visible height
const HIDDEN_TOP_ROWS = 2; // For pieces to spawn above the visible board
const TOTAL_BOARD_HEIGHT = BOARD_HEIGHT + HIDDEN_TOP_ROWS;

// Define Tetris piece shapes and their colors
const TETROMINOS = {
  0: { shape: [[0]], color: "bg-gray-800" }, // Empty cell - Changed to a darker gray for better contrast
  I: {
    shape: [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
    ],
    color: "bg-cyan-500", // Cyan
  },
  J: {
    shape: [
      [0, 1, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    color: "bg-blue-500", // Blue
  },
  L: {
    shape: [
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 1],
    ],
    color: "bg-orange-500", // Orange
  },
  O: {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: "bg-yellow-500", // Yellow
  },
  S: {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
    color: "bg-green-500", // Green
  },
  T: {
    shape: [
      [0, 0, 0],
      [1, 1, 1],
      [0, 1, 0],
    ],
    color: "bg-purple-500", // Purple
  },
  Z: {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
    color: "bg-red-500", // Red
  },
};

// --- Helper Functions ---

/**
 * Generates a random Tetromino piece.
 * @returns {object} An object containing the shape, color, and initial position of the new piece.
 */
const generateRandomPiece = () => {
  const tetrominoNames = "IJLOSTZ";
  const randTetromino =
    tetrominoNames[Math.floor(Math.random() * tetrominoNames.length)];
  const piece = TETROMINOS[randTetromino];

  // Initial position for the piece at the top center of the board
  return {
    shape: piece.shape,
    color: piece.color,
    pos: {
      x: Math.floor(BOARD_WIDTH / 2) - Math.floor(piece.shape[0].length / 2),
      y: 0,
    },
    collided: false,
  };
};

/**
 * Creates an empty game board filled with '0' (empty cells).
 * @returns {Array<Array<string>>} A 2D array representing the game board.
 */
const createEmptyBoard = () =>
  Array.from(
    { length: TOTAL_BOARD_HEIGHT },
    () => Array.from({ length: BOARD_WIDTH }, () => ["0", "bg-gray-800"]) // Changed to a darker gray for better contrast
  );

/**
 * Checks for collision between a piece and the board.
 * @param {object} piece - The current piece object (shape, pos).
 * @param {Array<Array<string>>} board - The game board.
 * @param {object} offset - The x, y offset to check collision for.
 * @returns {boolean} True if a collision occurs, false otherwise.
 */
const checkCollision = (piece, board, { x, y }) => {
  for (let row = 0; row < piece.shape.length; row++) {
    for (let col = 0; col < piece.shape[row].length; col++) {
      // Check that we are on a Tetromino cell
      if (piece.shape[row][col] !== 0) {
        const newX = piece.pos.x + col + x;
        const newY = piece.pos.y + row + y;

        // Check if the move is within the board boundaries and doesn't collide with existing blocks
        if (
          !board[newY] || // Check board height boundary
          !board[newY][newX] || // Check board width boundary
          board[newY][newX][0] !== "0" // Check for collision with non-empty cell
        ) {
          return true;
        }
      }
    }
  }
  return false;
};

/**
 * Rotates a Tetromino matrix clockwise.
 * @param {Array<Array<number>>} matrix - The shape matrix of the Tetromino.
 * @returns {Array<Array<number>>} The rotated matrix.
 */
const rotate = (matrix) => {
  // Transpose the matrix (rows become columns)
  const rotatedMatrix = matrix.map((_, index) =>
    matrix.map((col) => col[index])
  );
  // Reverse each row to get a clockwise rotation
  return rotatedMatrix.map((row) => row.reverse());
};

function App() {
  const [board, setBoard] = useState(createEmptyBoard());
  const [currentPiece, setCurrentPiece] = useState(generateRandomPiece());
  const [nextPiece, setNextPiece] = useState(generateRandomPiece());
  const [heldPiece, setHeldPiece] = useState(null); // New state for held piece
  const [canHold, setCanHold] = useState(true); // New state to control hold action per turn
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [dropTime, setDropTime] = useState(1000); // Milliseconds
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isGameStarted, setIsGameStarted] = useState(false);

  const gameLoopRef = useRef(null);

  /**
   * Updates the game board by merging the current piece into it.
   * This is used when a piece lands and becomes part of the static blocks.
   * @param {Array<Array<string>>} prevBoard - The board state before merging.
   * @param {object} piece - The piece to merge (shape, pos, color).
   * @returns {Array<Array<string>>} The new board state with the piece merged.
   */
  const updateBoard = useCallback((prevBoard, piece) => {
    const newBoard = prevBoard.map((row) =>
      row.map((cell) => (cell[0] === "clear" ? ["0", "bg-gray-800"] : cell))
    ); // Updated empty cell color

    // Draw the piece on the new board
    piece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          const boardY = piece.pos.y + y;
          const boardX = piece.pos.x + x;
          if (newBoard[boardY] && newBoard[boardY][boardX]) {
            newBoard[boardY][boardX] = [value, piece.color];
          }
        }
      });
    });
    return newBoard;
  }, []);

  /**
   * Clears full rows from the board and updates the score.
   * New empty rows are added to the top.
   * @param {Array<Array<string>>} currentBoard - The current state of the game board.
   */
  const clearRows = useCallback(
    (currentBoard) => {
      let clearedRowsCount = 0;
      const newBoard = currentBoard.reduce((acc, row) => {
        if (row.every((cell) => cell[0] !== "0")) {
          clearedRowsCount++;
          // Add a new empty row at the top
          acc.unshift(
            Array.from({ length: BOARD_WIDTH }, () => ["0", "bg-gray-800"])
          ); // Updated empty cell color
        } else {
          acc.push(row);
        }
        return acc;
      }, []);

      if (clearedRowsCount > 0) {
        // Basic scoring logic: 100 points per row, bonus for multiple rows
        setScore(
          (prevScore) => prevScore + clearedRowsCount * 100 * clearedRowsCount
        );
        // Increase level every 10 rows cleared (example)
        if (score + clearedRowsCount * 100 * clearedRowsCount >= level * 1000) {
          setLevel((prevLevel) => prevLevel + 1);
          setDropTime((prevDropTime) => Math.max(100, prevDropTime - 50)); // Increase speed
        }
        setBoard(newBoard);
      }
    },
    [score, level]
  );

  /**
   * Moves the current piece horizontally (left or right).
   * @param {number} dir - The direction to move (-1 for left, 1 for right).
   */
  const movePiece = useCallback(
    (dir) => {
      if (gameOver || isPaused || !isGameStarted) return;
      if (!checkCollision(currentPiece, board, { x: dir, y: 0 })) {
        setCurrentPiece((prev) => ({
          ...prev,
          pos: { x: prev.pos.x + dir, y: prev.pos.y },
        }));
      }
    },
    [currentPiece, board, gameOver, isPaused, isGameStarted]
  );

  /**
   * Drops the current piece one step down.
   * If a collision occurs, the piece is merged with the board, and a new piece is generated.
   */
  const dropPiece = useCallback(() => {
    if (gameOver || isPaused || !isGameStarted) return;

    if (!checkCollision(currentPiece, board, { x: 0, y: 1 })) {
      // No collision, move down
      setCurrentPiece((prev) => ({
        ...prev,
        pos: { x: prev.pos.x, y: prev.pos.y + 1 },
      }));
    } else {
      // Collision, merge piece with board
      const newBoard = updateBoard(board, currentPiece);
      setBoard(newBoard);
      clearRows(newBoard);
      setCanHold(true); // Reset canHold after a piece lands

      // Generate next piece
      const newPiece = nextPiece;
      if (checkCollision(newPiece, newBoard, { x: 0, y: 0 })) {
        // Game Over: new piece collides immediately
        setGameOver(true);
        setIsGameStarted(false); // Stop the game loop
        clearInterval(gameLoopRef.current);
      } else {
        setCurrentPiece(newPiece);
        setNextPiece(generateRandomPiece());
      }
    }
  }, [
    board,
    currentPiece,
    gameOver,
    isPaused,
    isGameStarted,
    nextPiece,
    updateBoard,
    clearRows,
  ]);

  /**
   * Rotates the current piece.
   */
  const rotateCurrentPiece = useCallback(() => {
    if (gameOver || isPaused || !isGameStarted) return;

    const rotated = rotate(currentPiece.shape);
    const originalPos = currentPiece.pos; // Store original position

    // Test a few offsets for wall kicks
    const testOffsets = [0, -1, 1, -2, 2];

    for (const offset of testOffsets) {
      const newPieceAfterRotationAttempt = {
        ...currentPiece,
        shape: rotated,
        pos: { x: originalPos.x + offset, y: originalPos.y },
      };

      if (
        !checkCollision(newPieceAfterRotationAttempt, board, { x: 0, y: 0 })
      ) {
        setCurrentPiece(newPieceAfterRotationAttempt);
        return; // Rotation successful
      }
    }

    // If no test offset worked, rotation is not possible
  }, [currentPiece, board, gameOver, isPaused, isGameStarted]);

  /**
   * Handles holding/swapping the current piece.
   */
  const handleHold = useCallback(() => {
    if (gameOver || isPaused || !isGameStarted || !canHold) return;

    setCanHold(false); // Prevent holding again until next piece lands

    if (!heldPiece) {
      // No piece in hold, store current piece and get next
      setHeldPiece({ shape: currentPiece.shape, color: currentPiece.color });
      setCurrentPiece({
        ...nextPiece,
        pos: {
          x:
            Math.floor(BOARD_WIDTH / 2) -
            Math.floor(nextPiece.shape[0].length / 2),
          y: 0,
        },
      });
      setNextPiece(generateRandomPiece());
    } else {
      // Swap current piece with held piece
      const tempCurrentPiece = { ...currentPiece };
      setCurrentPiece({
        ...heldPiece,
        pos: {
          x:
            Math.floor(BOARD_WIDTH / 2) -
            Math.floor(heldPiece.shape[0].length / 2),
          y: 0,
        },
      });
      setHeldPiece({
        shape: tempCurrentPiece.shape,
        color: tempCurrentPiece.color,
      });
    }
  }, [
    gameOver,
    isPaused,
    isGameStarted,
    canHold,
    heldPiece,
    currentPiece,
    nextPiece,
  ]);

  /**
   * Handles keyboard input for piece movement and rotation.
   * @param {KeyboardEvent} event - The keyboard event object.
   */
  const handleKeyPress = useCallback(
    (event) => {
      if (gameOver || isPaused || !isGameStarted) return;

      if (event.key === "ArrowLeft") {
        movePiece(-1);
      } else if (event.key === "ArrowRight") {
        movePiece(1);
      } else if (event.key === "ArrowDown") {
        dropPiece();
      } else if (event.key === "ArrowUp") {
        rotateCurrentPiece();
      } else if (event.key === "c" || event.key === "C") {
        // 'C' for hold
        handleHold();
      }
    },
    [
      movePiece,
      dropPiece,
      rotateCurrentPiece,
      handleHold,
      gameOver,
      isPaused,
      isGameStarted,
    ]
  );

  /**
   * Initializes or resets the game state.
   */
  const startGame = useCallback(() => {
    setBoard(createEmptyBoard());
    setCurrentPiece(generateRandomPiece());
    setNextPiece(generateRandomPiece());
    setHeldPiece(null); // Reset held piece
    setCanHold(true); // Reset canHold
    setScore(0);
    setLevel(1);
    setDropTime(1000);
    setGameOver(false);
    setIsPaused(false);
    setIsGameStarted(true);
  }, []);

  /**
   * Toggles the pause state of the game.
   */
  const togglePause = useCallback(() => {
    if (isGameStarted && !gameOver) {
      setIsPaused((prev) => !prev);
    }
  }, [isGameStarted, gameOver]);

  // --- useEffect Hooks ---

  // Game loop: controls automatic piece dropping
  useEffect(() => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
    }
    if (isGameStarted && !gameOver && !isPaused) {
      gameLoopRef.current = setInterval(dropPiece, dropTime);
    }

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [dropTime, gameOver, isPaused, isGameStarted, dropPiece]);

  // Keyboard event listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress]);

  // --- Render Board ---
  const renderBoard = () => {
    const boardToRender = JSON.parse(JSON.stringify(board)); // Deep copy

    // Draw the current piece on a temporary board for rendering
    if (currentPiece && !gameOver && !isPaused) {
      currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value !== 0) {
            const boardY = currentPiece.pos.y + y;
            const boardX = currentPiece.pos.x + x;
            if (
              boardToRender[boardY] &&
              boardToRender[boardY][boardX] &&
              boardToRender[boardY][boardX][0] === "0"
            ) {
              boardToRender[boardY][boardX] = [value, currentPiece.color];
            }
          }
        });
      });
    }

    // Render all cells directly in the grid container
    return boardToRender
      .slice(HIDDEN_TOP_ROWS)
      .map((row, rowIndex) =>
        row.map((cell, colIndex) => (
          <div
            key={`${rowIndex}-${colIndex}`} // Key must be unique across all cells
            className={`w-6 h-6 border border-gray-600 ${cell[1]} rounded-sm shadow-inner`}
            style={{
              boxShadow:
                cell[0] !== "0" ? "inset 0 0 4px rgba(0,0,0,0.3)" : "none",
            }}
          ></div>
        ))
      )
      .flat(); // Flatten the array of arrays of divs into a single array of divs
  };

  // --- Render Next Piece ---
  const renderNextPiece = () => {
    if (!nextPiece) return null;
    return (
      <div className="p-2 border border-gray-600 bg-gray-800 rounded-lg shadow-md">
        <h3 className="text-xl font-bold mb-2 text-white text-center">Next</h3>
        <div
          className="grid gap-px mx-auto"
          style={{
            gridTemplateColumns: `repeat(${nextPiece.shape[0].length}, minmax(0, 1fr))`,
            width: `${nextPiece.shape[0].length * 24}px`, // Cell width is 24px (w-6)
          }}
        >
          {nextPiece.shape.map((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`w-6 h-6 border border-gray-700 ${
                  cell !== 0 ? nextPiece.color : "bg-gray-900"
                } rounded-sm`}
              ></div>
            ))
          )}
        </div>
      </div>
    );
  };

  // --- Render Held Piece ---
  const renderHeldPiece = () => {
    if (!heldPiece) {
      return (
        <div className="p-2 border border-gray-600 bg-gray-800 rounded-lg shadow-md">
          <h3 className="text-xl font-bold mb-2 text-white text-center">
            Hold
          </h3>
          <div className="w-24 h-24 flex items-center justify-center bg-gray-900 rounded-sm border border-gray-700 text-gray-500 text-sm">
            Empty
          </div>
        </div>
      );
    }
    return (
      <div className="p-2 border border-gray-600 bg-gray-800 rounded-lg shadow-md">
        <h3 className="text-xl font-bold mb-2 text-white text-center">Hold</h3>
        <div
          className="grid gap-px mx-auto"
          style={{
            gridTemplateColumns: `repeat(${heldPiece.shape[0].length}, minmax(0, 1fr))`,
            width: `${heldPiece.shape[0].length * 24}px`, // Cell width is 24px (w-6)
          }}
        >
          {heldPiece.shape.map((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`w-6 h-6 border border-gray-700 ${
                  cell !== 0 ? heldPiece.color : "bg-gray-900"
                } rounded-sm`}
              ></div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4 font-inter text-white">
      <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start p-6 bg-gray-800 rounded-xl shadow-2xl border border-gray-700">
        {/* Game Info Panel */}
        <div className="flex flex-col gap-6 text-center lg:text-left w-full lg:w-auto">
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 drop-shadow-lg mb-4">
            Tetris
          </h1>
          <div className="p-4 bg-gray-700 rounded-lg shadow-inner border border-gray-600">
            <h2 className="text-2xl font-bold mb-2">Score: {score}</h2>
            <h2 className="text-2xl font-bold">Level: {level}</h2>
          </div>
          {renderHeldPiece()} {/* Display held piece */}
          {renderNextPiece()}
        </div>

        {/* Game Board */}
        <div
          className="relative border-4 border-gray-700 rounded-lg shadow-xl overflow-hidden"
          style={{
            width: `${BOARD_WIDTH * 24}px`,
            height: `${BOARD_HEIGHT * 24}px`,
          }}
        >
          {" "}
          {/* 24px is w-6/h-6 */}
          <div
            className="grid bg-slate-900" // Changed background to slate-900 for clearer distinction
            style={{
              gridTemplateColumns: `repeat(${BOARD_WIDTH}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${BOARD_HEIGHT}, minmax(0, 1fr))`,
            }}
          >
            {renderBoard()}
          </div>
          {/* Game Over / Paused Overlay */}
          {(gameOver || isPaused) && (
            <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center rounded-lg">
              <div className="text-center p-4">
                {gameOver ? (
                  <>
                    <h2 className="text-6xl font-extrabold text-red-500 animate-pulse drop-shadow-xl mb-4">
                      GAME OVER!
                    </h2>
                    <p className="text-3xl font-semibold text-white">
                      Score: {score}
                    </p>
                    <p className="text-2xl text-gray-300 mt-2">
                      Press "Reset Game" to play again
                    </p>
                  </>
                ) : (
                  <h2 className="text-6xl font-extrabold text-yellow-400 drop-shadow-xl">
                    PAUSED
                  </h2>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4">
          {!isGameStarted && !gameOver && (
            <button
              onClick={startGame}
              className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xl font-bold rounded-lg shadow-lg hover:from-green-600 hover:to-emerald-700 transition duration-300 transform hover:scale-105 active:scale-95 border-b-4 border-emerald-800"
            >
              Start Game
            </button>
          )}

          {isGameStarted && !gameOver && (
            <>
              <button
                onClick={togglePause}
                className="w-full px-6 py-3 bg-gradient-to-r from-yellow-500 to-amber-600 text-white text-xl font-bold rounded-lg shadow-lg hover:from-yellow-600 hover:to-amber-700 transition duration-300 transform hover:scale-105 active:scale-95 border-b-4 border-amber-800"
              >
                {isPaused ? "Resume" : "Pause"}
              </button>
              <button
                onClick={handleHold}
                disabled={!canHold} // Disable if already held this turn
                className={`w-full px-6 py-3 bg-gradient-to-r ${
                  canHold
                    ? "from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
                    : "from-gray-500 to-gray-600 cursor-not-allowed"
                } text-white text-xl font-bold rounded-lg shadow-lg transition duration-300 transform hover:scale-105 active:scale-95 border-b-4 ${
                  canHold ? "border-indigo-800" : "border-gray-700"
                }`}
              >
                Hold Piece (C)
              </button>
            </>
          )}

          {(isGameStarted || gameOver) && (
            <button
              onClick={startGame} // startGame also acts as reset
              className="w-full px-6 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white text-xl font-bold rounded-lg shadow-lg hover:from-red-600 hover:to-rose-700 transition duration-300 transform hover:scale-105 active:scale-95 border-b-4 border-rose-800"
            >
              Reset Game
            </button>
          )}
        </div>
      </div>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"
      ></link>
      <script src="https://cdn.tailwindcss.com"></script>
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap"
        rel="stylesheet"
      />
    </div>
  );
}

export default App;
