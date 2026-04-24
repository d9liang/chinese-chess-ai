const {
  CELL,
  COLS,
  ROWS,
  MARGIN,
  RED,
  BLACK,
  LABELS,
  DEPTH_LABEL,
  createInitialBoard,
  generateMoves,
  applyMove,
  getCheckInfo,
  findKing,
  inBounds,
} = window.ChessEngine;

const { analyzeAIMoves, estimateThinkTime, formatSeconds } = window.ChessAI;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

const resetBtn = document.getElementById('resetBtn');
const depthInput = document.getElementById('depth');
const depthVal = document.getElementById('depthVal');
const turnEl = document.getElementById('turn');
const msgEl = document.getElementById('msg');
const aiLevelEl = document.getElementById('aiLevel');

let board = [];
let selected = null;
let legalMoves = [];
let turn = RED;
let gameOver = false;
let aiBusy = false;
let aiTimer = null;
let animation = null;
let checkInfo = null;
let renderLoopActive = false;

function initBoard() {
  if (aiTimer) {
    clearTimeout(aiTimer);
    aiTimer = null;
  }

  board = createInitialBoard();
  selected = null;
  legalMoves = [];
  turn = RED;
  gameOver = false;
  aiBusy = false;
  animation = null;
  checkInfo = null;
  setMessage('请走子');
  draw(performance.now());
}

function setMessage(msg, options = {}) {
  msgEl.textContent = msg;
  msgEl.classList.toggle('check', Boolean(options.check));
  turnEl.textContent = turn === RED ? '红方' : '黑方';
}

function updateDepthLabel() {
  const depth = Number(depthInput.value);
  depthVal.textContent = depth;
  aiLevelEl.textContent = DEPTH_LABEL[depth] || `深度 ${depth}`;
}

function draw(now = performance.now()) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBoard();
  drawPieces(now);
  drawHighlights(now);
  drawCheckMarks(now);
}

function drawBoard() {
  ctx.save();
  ctx.strokeStyle = '#7a5a3b';
  ctx.lineWidth = 2;

  for (let r = 0; r < ROWS; r += 1) {
    const y = MARGIN + r * CELL;
    ctx.beginPath();
    ctx.moveTo(MARGIN, y);
    ctx.lineTo(MARGIN + CELL * 8, y);
    ctx.stroke();
  }

  for (let c = 0; c < COLS; c += 1) {
    const x = MARGIN + c * CELL;
    ctx.beginPath();
    ctx.moveTo(x, MARGIN);
    ctx.lineTo(x, MARGIN + CELL * 4);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, MARGIN + CELL * 5);
    ctx.lineTo(x, MARGIN + CELL * 9);
    ctx.stroke();
  }

  drawPalace(MARGIN + CELL * 3, MARGIN, MARGIN + CELL * 5, MARGIN + CELL * 2);
  drawPalace(MARGIN + CELL * 3, MARGIN + CELL * 7, MARGIN + CELL * 5, MARGIN + CELL * 9);

  ctx.fillStyle = '#7a5a3b';
  ctx.font = '24px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('楚 河', MARGIN + CELL * 2.5, MARGIN + CELL * 4.5);
  ctx.fillText('汉 界', MARGIN + CELL * 5.5, MARGIN + CELL * 4.5);
  ctx.restore();
}

function drawPalace(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y1);
  ctx.lineTo(x1, y2);
  ctx.stroke();
}

function drawPiece(piece, x, y, options = {}) {
  const color = piece > 0 ? RED : BLACK;
  const type = Math.abs(piece);
  const scale = options.scale || 1;
  const alpha = options.alpha == null ? 1 : options.alpha;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.beginPath();
  ctx.fillStyle = '#fdf7ec';
  ctx.strokeStyle = color === RED ? '#c0392b' : '#2c2c2c';
  ctx.lineWidth = 2;
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color === RED ? '#c0392b' : '#2c2c2c';
  ctx.font = '24px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(color === RED ? LABELS[type].r : LABELS[type].b, 0, 1);
  ctx.restore();
}

function drawPieces(now) {
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const piece = board[r][c];
      if (piece === 0) continue;

      if (animation && animation.phase === 'move') {
        if (r === animation.move.from.r && c === animation.move.from.c) continue;
        if (r === animation.move.to.r && c === animation.move.to.c) continue;
      }

      drawPiece(piece, MARGIN + c * CELL, MARGIN + r * CELL);
    }
  }

  if (!animation || animation.phase !== 'move') return;

  const progress = easeInOut(clamp((now - animation.phaseStart) / animation.moveDuration, 0, 1));
  const fromX = MARGIN + animation.move.from.c * CELL;
  const fromY = MARGIN + animation.move.from.r * CELL;
  const toX = MARGIN + animation.move.to.c * CELL;
  const toY = MARGIN + animation.move.to.r * CELL;
  drawPiece(animation.piece, lerp(fromX, toX, progress), lerp(fromY, toY, progress), {
    scale: 1 + 0.06 * Math.sin(progress * Math.PI),
  });
  drawMoveTrail(animation.move.from, animation.move.to, progress);
}

function drawMoveTrail(from, to, progress) {
  const fromX = MARGIN + from.c * CELL;
  const fromY = MARGIN + from.r * CELL;
  const toX = MARGIN + to.c * CELL;
  const toY = MARGIN + to.r * CELL;
  ctx.save();
  ctx.strokeStyle = `rgba(192, 57, 43, ${0.12 + 0.28 * progress})`;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(lerp(fromX, toX, progress), lerp(fromY, toY, progress));
  ctx.stroke();
  ctx.restore();
}

function drawPulse(coord, opacity, color) {
  const x = MARGIN + coord.c * CELL;
  const y = MARGIN + coord.r * CELL;
  ctx.save();
  ctx.strokeStyle = rgba(color, 0.25 + 0.45 * opacity);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, 28 + 5 * opacity, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = rgba(color, 0.08 + 0.18 * opacity);
  ctx.beginPath();
  ctx.arc(x, y, 22 + 3 * opacity, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHighlights(now) {
  if (selected) {
    const x = MARGIN + selected.c * CELL;
    const y = MARGIN + selected.r * CELL;
    ctx.save();
    ctx.strokeStyle = '#3b7a57';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.stroke();

    for (const move of legalMoves) {
      ctx.fillStyle = 'rgba(59, 122, 87, 0.25)';
      ctx.beginPath();
      ctx.arc(MARGIN + move.to.c * CELL, MARGIN + move.to.r * CELL, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (!animation) return;

  if (animation.phase === 'pre') {
    drawPulse(animation.move.from, blinkOpacity(now, animation.phaseStart, animation.preDuration, 2), '#c0392b');
  } else if (animation.phase === 'post') {
    drawPulse(animation.move.to, blinkOpacity(now, animation.phaseStart, animation.postDuration, 3), '#3b7a57');
  }
}

function drawCheckMarks(now) {
  if (!checkInfo) return;
  const opacity = 0.45 + 0.25 * Math.sin(now / 140);
  drawThreatRing(checkInfo.attacker, rgba('#d32f2f', opacity), 26 + 2 * Math.sin(now / 120), 4);
  drawThreatRing(checkInfo.king, rgba('#d32f2f', opacity * 0.9), 26 + 2 * Math.cos(now / 120), 4);
}

function drawThreatRing(coord, stroke, radius, width) {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(MARGIN + coord.c * CELL, MARGIN + coord.r * CELL, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function handlePointerDown(evt) {
  if (gameOver || turn !== RED || aiBusy || animation) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (evt.clientX - rect.left) * scaleX;
  const y = (evt.clientY - rect.top) * scaleY;
  const c = Math.round((x - MARGIN) / CELL);
  const r = Math.round((y - MARGIN) / CELL);
  if (!inBounds(r, c)) return;

  const piece = board[r][c];
  if (selected) {
    const move = legalMoves.find((item) => item.to.r === r && item.to.c === c);
    if (move) {
      applyMove(board, move);
      selected = null;
      legalMoves = [];
      if (checkForGameOverAfterMove(RED)) return;
      turn = BLACK;

      checkInfo = getCheckInfo(BLACK, board);
      setMessage(checkInfo ? '黑方被将军，AI正在思考...' : 'AI正在思考...', { check: Boolean(checkInfo) });

      draw(performance.now());
      startAIMove();
      return;
    }
  }

  if (piece !== 0 && Math.sign(piece) === RED) {
    selected = { r, c };
    legalMoves = generateMoves(RED, board).filter((move) => move.from.r === r && move.from.c === c);
  } else {
    selected = null;
    legalMoves = [];
  }
  draw(performance.now());
}

function startAIMove() {
  if (gameOver || turn !== BLACK) return;

  const depth = Number(depthInput.value);
  const analysis = analyzeAIMoves(board, depth);
  if (!analysis) {
    gameOver = true;
    aiBusy = false;
    setMessage('黑方无棋可走，红方胜', { check: true });
    draw(performance.now());
    return;
  }

  aiBusy = true;
  const thinkMs = estimateThinkTime(analysis, depth);
  setMessage(`AI思考中... 约 ${formatSeconds(thinkMs)}`);
  draw(performance.now());

  aiTimer = setTimeout(() => {
    aiTimer = null;
    if (gameOver || turn !== BLACK) {
      aiBusy = false;
      return;
    }
    beginAIMoveAnimation(analysis);
  }, thinkMs);
}

function beginAIMoveAnimation(analysis) {
  const move = analysis.move;
  animation = {
    piece: board[move.from.r][move.from.c],
    move,
    phase: 'pre',
    phaseStart: performance.now(),
    preDuration: 560,
    moveDuration: clamp(700 + analysis.legalCount * 8, 700, 980),
    postDuration: 900,
  };
  if (!renderLoopActive) {
    renderLoopActive = true;
    requestAnimationFrame(renderAnimationFrame);
  }
}

function renderAnimationFrame(now) {
  if (!animation) {
    renderLoopActive = false;
    draw(now);
    return;
  }

  updateAnimation(now);
  draw(now);
  requestAnimationFrame(renderAnimationFrame);
}

function updateAnimation(now) {
  const elapsed = now - animation.phaseStart;

  if (animation.phase === 'pre' && elapsed >= animation.preDuration) {
    animation.phase = 'move';
    animation.phaseStart = now;
    setMessage('黑方走子中...');
    return;
  }

  if (animation.phase === 'move' && elapsed >= animation.moveDuration) {
    applyMove(board, animation.move);
    turn = RED;
    checkInfo = getCheckInfo(RED, board);
    setMessage(checkInfo ? '红方被将军，请应对' : '请走子', { check: Boolean(checkInfo) });
    animation.phase = 'post';
    animation.phaseStart = now;
    if (checkForGameOverAfterMove(BLACK)) {
      animation = null;
      aiBusy = false;
    }
    return;
  }

  if (animation.phase === 'post' && elapsed >= animation.postDuration) {
    animation = null;
    aiBusy = false;
    if (!gameOver) {
      setMessage(checkInfo ? '红方被将军，请应对' : '请走子', { check: Boolean(checkInfo) });
    }
  }
}

function checkForGameOverAfterMove(moverColor) {
  const redKing = findKing(RED, board);
  const blackKing = findKing(BLACK, board);
  if (!redKing || !blackKing) {
    gameOver = true;
    setMessage(moverColor === RED ? '红方胜' : '黑方胜', { check: true });
    return true;
  }

  const nextColor = moverColor === RED ? BLACK : RED;
  if (generateMoves(nextColor, board).length === 0) {
    gameOver = true;
    setMessage(moverColor === RED ? '红方胜' : '黑方胜', { check: true });
    return true;
  }
  return false;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function blinkOpacity(now, start, duration, blinks) {
  const elapsed = now - start;
  if (elapsed < 0 || elapsed > duration) return 0;
  const cycle = (elapsed / duration) * blinks * 2 * Math.PI;
  const wave = Math.sin(cycle);
  return wave > 0 ? Math.abs(wave) : 0;
}

function rgba(color, alpha) {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const value = hex.length === 3 ? hex.split('').map((ch) => ch + ch).join('') : hex;
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

resetBtn.addEventListener('click', initBoard);
canvas.addEventListener('pointerdown', handlePointerDown);
depthInput.addEventListener('input', updateDepthLabel);

updateDepthLabel();
initBoard();
