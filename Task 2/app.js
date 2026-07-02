/**
 * Tic-Tac-Toe AI
 * ===============
 * AI uses the Minimax algorithm with Alpha-Beta Pruning for perfect play.
 * Difficulty levels modify the AI's decision-making:
 *   - Easy:   random moves
 *   - Medium: 50% minimax, 50% random
 *   - Hard:   full minimax (unbeatable)
 */

'use strict';

/* ======================================================
   CONSTANTS
   ====================================================== */
const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

const WIN_LINE_COORDS = {
  // rows  (y = row * 110 + 55)
  '0,1,2': { x1: 10,  y1: 50,  x2: 290, y2: 50  },
  '3,4,5': { x1: 10,  y1: 150, x2: 290, y2: 150 },
  '6,7,8': { x1: 10,  y1: 250, x2: 290, y2: 250 },
  // cols  (x = col * 110 + 55)
  '0,3,6': { x1: 50,  y1: 10,  x2: 50,  y2: 290 },
  '1,4,7': { x1: 150, y1: 10,  x2: 150, y2: 290 },
  '2,5,8': { x1: 250, y1: 10,  x2: 250, y2: 290 },
  // diagonals
  '0,4,8': { x1: 20,  y1: 20,  x2: 280, y2: 280 },
  '2,4,6': { x1: 280, y1: 20,  x2: 20,  y2: 280 },
};

/* ======================================================
   STATE
   ====================================================== */
const state = {
  mode: 'vs-ai',         // 'vs-ai' | 'vs-human'
  humanSide: 'X',        // 'X' | 'O'
  difficulty: 'hard',    // 'easy' | 'medium' | 'hard'
  board: Array(9).fill(null),
  currentPlayer: 'X',
  gameOver: false,
  scores: { X: 0, O: 0, ties: 0 },
};

/* ======================================================
   DOM REFERENCES
   ====================================================== */
const $ = id => document.getElementById(id);

const el = {
  screenMode:    $('screen-mode'),
  screenGame:    $('screen-game'),
  btnVsAI:       $('btn-vs-ai'),
  btnVsHuman:    $('btn-vs-human'),
  sideSelect:    $('side-select'),
  diffSelect:    $('difficulty-select'),
  btnPlayX:      $('btn-play-x'),
  btnPlayO:      $('btn-play-o'),
  btnEasy:       $('btn-easy'),
  btnMedium:     $('btn-medium'),
  btnHard:       $('btn-hard'),
  btnStart:      $('btn-start'),
  board:         $('board'),
  cells:         Array.from(document.querySelectorAll('.cell')),
  statusBar:     $('status-bar'),
  turnIndicator: $('turn-indicator'),
  statusMsg:     $('status-msg'),
  scoreX:        $('score-x'),
  scoreO:        $('score-o'),
  scoreTies:     $('score-ties'),
  scoreXName:    $('score-x-name'),
  scoreOName:    $('score-o-name'),
  btnBack:       $('btn-back'),
  btnRestart:    $('btn-restart'),
  aiThinking:    $('ai-thinking'),
  modalOverlay:  $('modal-overlay'),
  modalIcon:     $('modal-icon'),
  modalTitle:    $('modal-title'),
  modalSub:      $('modal-sub'),
  btnModalAgain: $('btn-modal-play-again'),
  btnModalMenu:  $('btn-modal-menu'),
  winLineSvg:    $('win-line-svg'),
  winLine:       $('win-line'),
};

/* ======================================================
   MINIMAX WITH ALPHA-BETA PRUNING
   ====================================================== */

/**
 * Returns the winner symbol ('X' or 'O') or null if no winner yet.
 * @param {Array} board
 * @returns {string|null}
 */
function getWinner(board) {
  for (const [a, b, c] of WINNING_COMBOS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

/**
 * Returns whether the board is completely filled.
 * @param {Array} board
 * @returns {boolean}
 */
function isBoardFull(board) {
  return board.every(cell => cell !== null);
}

/**
 * Minimax with Alpha-Beta Pruning.
 * @param {Array}   board       - Current board state (9-element array).
 * @param {boolean} isMaximizing - True when it's the AI's turn.
 * @param {string}  aiSymbol    - The AI's symbol ('X' or 'O').
 * @param {string}  humanSymbol - The human's symbol.
 * @param {number}  alpha       - Alpha value for pruning.
 * @param {number}  beta        - Beta value for pruning.
 * @param {number}  depth       - Current depth (for preferring faster wins).
 * @returns {number} Score.
 */
function minimax(board, isMaximizing, aiSymbol, humanSymbol, alpha, beta, depth) {
  const winner = getWinner(board);
  if (winner === aiSymbol)    return 10 - depth;
  if (winner === humanSymbol) return depth - 10;
  if (isBoardFull(board))     return 0;

  const emptyIndices = board.reduce((acc, val, idx) => (val === null ? [...acc, idx] : acc), []);

  if (isMaximizing) {
    let best = -Infinity;
    for (const idx of emptyIndices) {
      board[idx] = aiSymbol;
      const score = minimax(board, false, aiSymbol, humanSymbol, alpha, beta, depth + 1);
      board[idx] = null;
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break; // Beta cut-off
    }
    return best;
  } else {
    let best = Infinity;
    for (const idx of emptyIndices) {
      board[idx] = humanSymbol;
      const score = minimax(board, true, aiSymbol, humanSymbol, alpha, beta, depth + 1);
      board[idx] = null;
      best = Math.min(best, score);
      beta = Math.min(beta, best);
      if (beta <= alpha) break; // Alpha cut-off
    }
    return best;
  }
}

/**
 * Returns the best move index for the AI.
 * @param {Array}  board
 * @param {string} aiSymbol
 * @param {string} humanSymbol
 * @param {string} difficulty
 * @returns {number} Best cell index.
 */
function getBestMove(board, aiSymbol, humanSymbol, difficulty) {
  const empty = board.reduce((acc, val, idx) => (val === null ? [...acc, idx] : acc), []);

  // Easy: always random
  if (difficulty === 'easy') {
    return empty[Math.floor(Math.random() * empty.length)];
  }

  // Medium: 50% chance of random move
  if (difficulty === 'medium' && Math.random() < 0.5) {
    return empty[Math.floor(Math.random() * empty.length)];
  }

  // Hard (and Medium's other 50%): full minimax
  let bestScore = -Infinity;
  let bestMove = empty[0];

  for (const idx of empty) {
    board[idx] = aiSymbol;
    const score = minimax(board, false, aiSymbol, humanSymbol, -Infinity, Infinity, 0);
    board[idx] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMove = idx;
    }
  }

  return bestMove;
}

/* ======================================================
   GAME LOGIC
   ====================================================== */

/**
 * Returns the winning combo indices if the current board state has a winner.
 * @returns {Array|null}
 */
function getWinningCombo() {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c]) {
      return combo;
    }
  }
  return null;
}

/**
 * Applies a move by the given player at the given index.
 * @param {number} index
 * @param {string} player - 'X' or 'O'
 */
function applyMove(index, player) {
  if (state.board[index] !== null || state.gameOver) return;

  state.board[index] = player;
  renderCell(index, player);

  const winCombo = getWinningCombo();

  if (winCombo) {
    state.gameOver = true;
    state.scores[player]++;
    updateScoreboard();
    highlightWinningCells(winCombo);
    drawWinLine(winCombo);
    updateStatus(`${player === 'X' ? '✕' : '○'}`, `wins!`);

    setTimeout(() => {
      const isHumanWin = state.mode === 'vs-ai' && player === state.humanSide;
      const isAIWin    = state.mode === 'vs-ai' && player !== state.humanSide;
      if (isHumanWin) {
        showModal('🎉', `You Win!`, `Impressive! You managed to beat the AI on ${difficultyLabel()}.`);
        spawnConfetti();
      } else if (isAIWin) {
        showModal('🤖', `AI Wins!`, `The Minimax algorithm found the optimal path. Try again!`);
      } else {
        const winnerName = player === 'X' ? 'Player X' : 'Player O';
        showModal('🏆', `${winnerName} Wins!`, `Well played! Go again?`);
        spawnConfetti();
      }
    }, 900);
    return;
  }

  if (isBoardFull(state.board)) {
    state.gameOver = true;
    state.scores.ties++;
    updateScoreboard();
    updateStatus('🤝', 'Draw!');
    setTimeout(() => showModal('🤝', `It\'s a Draw!`, `Perfectly matched. Neither side could break through!`), 700);
    return;
  }

  // Switch turn
  state.currentPlayer = player === 'X' ? 'O' : 'X';
  updateStatus(
    state.currentPlayer === 'X' ? '✕' : '○',
    getTurnMessage()
  );

  // AI turn
  if (state.mode === 'vs-ai' && state.currentPlayer !== state.humanSide && !state.gameOver) {
    triggerAIMove();
  }
}

/**
 * Triggers the AI to make its move with a short delay for UX.
 */
function triggerAIMove() {
  setCellsDisabled(true);
  showAIThinking(true);

  const aiSymbol    = state.humanSide === 'X' ? 'O' : 'X';
  const humanSymbol = state.humanSide;

  // Small delay so UI updates first
  setTimeout(() => {
    const bestMove = getBestMove([...state.board], aiSymbol, humanSymbol, state.difficulty);
    showAIThinking(false);
    setCellsDisabled(false);
    applyMove(bestMove, aiSymbol);
  }, 400 + Math.random() * 300);
}

/**
 * Resets the board for a new round, keeping scores.
 */
function newRound() {
  state.board = Array(9).fill(null);
  state.currentPlayer = 'X';
  state.gameOver = false;

  el.cells.forEach(cell => {
    cell.className = 'cell';
    cell.textContent = '';
    cell.disabled = false;
    cell.setAttribute('aria-label', `Cell ${parseInt(cell.dataset.index) + 1}, empty`);
  });

  // Reset win line
  el.winLine.setAttribute('x1', 0);
  el.winLine.setAttribute('y1', 0);
  el.winLine.setAttribute('x2', 0);
  el.winLine.setAttribute('y2', 0);
  el.winLineSvg.classList.remove('visible');

  showAIThinking(false);
  updateStatus('✕', getTurnMessage());

  // If AI goes first
  if (state.mode === 'vs-ai' && state.humanSide === 'O') {
    triggerAIMove();
  }
}

/* ======================================================
   RENDERING HELPERS
   ====================================================== */

function renderCell(index, player) {
  const cell = el.cells[index];
  cell.textContent = player === 'X' ? '✕' : '○';
  cell.classList.add(player === 'X' ? 'x-cell' : 'o-cell');
  cell.disabled = true;
  cell.setAttribute('aria-label', `Cell ${index + 1}, ${player}`);
}

function highlightWinningCells(combo) {
  combo.forEach(idx => el.cells[idx].classList.add('winning'));
}

function drawWinLine(combo) {
  const key = combo.join(',');
  const coords = WIN_LINE_COORDS[key];
  if (!coords) return;

  el.winLine.setAttribute('x1', coords.x1);
  el.winLine.setAttribute('y1', coords.y1);
  el.winLine.setAttribute('x2', coords.x2);
  el.winLine.setAttribute('y2', coords.y2);

  // Trigger animation
  requestAnimationFrame(() => {
    el.winLineSvg.classList.add('visible');
  });
}

function updateStatus(symbol, message) {
  el.turnIndicator.textContent = symbol;
  el.turnIndicator.className = 'turn-indicator';
  if (symbol === '✕') el.turnIndicator.classList.add('x-turn');
  if (symbol === '○') el.turnIndicator.classList.add('o-turn');
  el.statusMsg.textContent = message;
}

function updateScoreboard() {
  el.scoreX.textContent    = state.scores.X;
  el.scoreO.textContent    = state.scores.O;
  el.scoreTies.textContent = state.scores.ties;
}

function setCellsDisabled(disabled) {
  el.cells.forEach(cell => {
    if (cell.textContent === '') cell.disabled = disabled;
  });
}

function showAIThinking(visible) {
  el.aiThinking.classList.toggle('visible', visible);
  el.aiThinking.setAttribute('aria-hidden', String(!visible));
}

function getTurnMessage() {
  if (state.mode === 'vs-ai') {
    return state.currentPlayer === state.humanSide ? 'Your turn' : 'AI is playing…';
  }
  return state.currentPlayer === 'X' ? 'Player X\'s turn' : 'Player O\'s turn';
}

function difficultyLabel() {
  return { easy: 'Easy', medium: 'Medium', hard: 'Hard (Unbeatable)' }[state.difficulty];
}

/* ======================================================
   MODAL
   ====================================================== */

function showModal(icon, title, sub) {
  el.modalIcon.textContent  = icon;
  el.modalTitle.textContent = title;
  el.modalSub.textContent   = sub;
  el.modalOverlay.classList.remove('hidden');
}

function hideModal() {
  el.modalOverlay.classList.add('hidden');
}

/* ======================================================
   CONFETTI
   ====================================================== */

function spawnConfetti() {
  const colors = ['#a78bfa', '#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#f87171'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `
      left: ${Math.random() * 100}vw;
      width: ${6 + Math.random() * 8}px;
      height: ${10 + Math.random() * 10}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${1.5 + Math.random() * 2}s;
      animation-delay: ${Math.random() * 0.6}s;
    `;
    document.body.appendChild(piece);
    piece.addEventListener('animationend', () => piece.remove());
  }
}

/* ======================================================
   SCREEN MANAGEMENT
   ====================================================== */

function showScreen(name) {
  el.screenMode.classList.toggle('hidden', name !== 'mode');
  el.screenGame.classList.toggle('hidden', name !== 'game');
}

function startGame() {
  // Set player names in scoreboard
  if (state.mode === 'vs-ai') {
    if (state.humanSide === 'X') {
      el.scoreXName.textContent = 'You';
      el.scoreOName.textContent = 'AI';
    } else {
      el.scoreXName.textContent = 'AI';
      el.scoreOName.textContent = 'You';
    }
  } else {
    el.scoreXName.textContent = 'Player X';
    el.scoreOName.textContent = 'Player O';
  }

  // Reset scores when starting fresh from menu
  state.scores = { X: 0, O: 0, ties: 0 };
  updateScoreboard();

  showScreen('game');
  newRound();
}

/* ======================================================
   EVENT LISTENERS
   ====================================================== */

// Mode selection
el.btnVsAI.addEventListener('click', () => {
  state.mode = 'vs-ai';
  el.btnVsAI.classList.add('active');
  el.btnVsAI.setAttribute('aria-pressed', 'true');
  el.btnVsHuman.classList.remove('active');
  el.btnVsHuman.setAttribute('aria-pressed', 'false');
  el.sideSelect.classList.remove('hidden');
  el.diffSelect.classList.remove('hidden');
});

el.btnVsHuman.addEventListener('click', () => {
  state.mode = 'vs-human';
  el.btnVsHuman.classList.add('active');
  el.btnVsHuman.setAttribute('aria-pressed', 'true');
  el.btnVsAI.classList.remove('active');
  el.btnVsAI.setAttribute('aria-pressed', 'false');
  el.sideSelect.classList.add('hidden');
  el.diffSelect.classList.add('hidden');
});

// Side selection
el.btnPlayX.addEventListener('click', () => {
  state.humanSide = 'X';
  el.btnPlayX.classList.add('active');
  el.btnPlayX.setAttribute('aria-pressed', 'true');
  el.btnPlayO.classList.remove('active');
  el.btnPlayO.setAttribute('aria-pressed', 'false');
});

el.btnPlayO.addEventListener('click', () => {
  state.humanSide = 'O';
  el.btnPlayO.classList.add('active');
  el.btnPlayO.setAttribute('aria-pressed', 'true');
  el.btnPlayX.classList.remove('active');
  el.btnPlayX.setAttribute('aria-pressed', 'false');
});

// Difficulty selection
[el.btnEasy, el.btnMedium, el.btnHard].forEach(btn => {
  btn.addEventListener('click', () => {
    state.difficulty = btn.dataset.level;
    [el.btnEasy, el.btnMedium, el.btnHard].forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Start button
el.btnStart.addEventListener('click', startGame);

// Cell clicks
el.cells.forEach(cell => {
  cell.addEventListener('click', () => {
    if (state.gameOver) return;
    const index = parseInt(cell.dataset.index);

    // vs AI: only allow human side
    if (state.mode === 'vs-ai' && state.currentPlayer !== state.humanSide) return;

    applyMove(index, state.currentPlayer);
  });

  // Hover ghost symbol for empty cells
  cell.addEventListener('mouseenter', () => {
    if (cell.textContent !== '' || state.gameOver) return;
    if (state.mode === 'vs-ai' && state.currentPlayer !== state.humanSide) return;
    cell.dataset.hover = state.currentPlayer === 'X' ? '✕' : '○';
  });
});

// Restart (new round, keep scores)
el.btnRestart.addEventListener('click', () => {
  hideModal();
  newRound();
});

// Back to menu
el.btnBack.addEventListener('click', () => {
  hideModal();
  showScreen('mode');
});

// Modal buttons
el.btnModalAgain.addEventListener('click', () => {
  hideModal();
  newRound();
});

el.btnModalMenu.addEventListener('click', () => {
  hideModal();
  showScreen('mode');
});

// Close modal on overlay click
el.modalOverlay.addEventListener('click', e => {
  if (e.target === el.modalOverlay) hideModal();
});

/* ======================================================
   INIT
   ====================================================== */

// Set initial hover data attribute for cells
el.cells.forEach(cell => {
  cell.dataset.hover = '✕';
});

// Show mode screen on load
showScreen('mode');

console.log(
  '%c Tic-Tac-Toe AI ',
  'background: #7c3aed; color: white; font-size: 14px; font-weight: bold; border-radius: 4px; padding: 4px 10px;',
  '\nAlgorithm: Minimax + Alpha-Beta Pruning\nHard mode is truly unbeatable — best you can do is a draw!'
);
