const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

const resetBtn = document.getElementById('resetBtn');
const depthInput = document.getElementById('depth');
const depthVal = document.getElementById('depthVal');
const turnEl = document.getElementById('turn');
const msgEl = document.getElementById('msg');
const aiLevelEl = document.getElementById('aiLevel');

const ROWS = 10;
const COLS = 9;
const MARGIN = 30;
const CELL = 60;

const RED = 1;
const BLACK = -1;

const PIECE = {
  K: 1,
  A: 2,
  B: 3,
  N: 4,
  R: 5,
  C: 6,
  P: 7,
};

const VALUE = {
  [PIECE.K]: 10000,
  [PIECE.R]: 500,
  [PIECE.C]: 450,
  [PIECE.N]: 300,
  [PIECE.B]: 200,
  [PIECE.A]: 200,
  [PIECE.P]: 100,
};

const LABELS = {
  [PIECE.K]: { r: '帅', b: '将' },
  [PIECE.A]: { r: '仕', b: '士' },
  [PIECE.B]: { r: '相', b: '象' },
  [PIECE.N]: { r: '马', b: '马' },
  [PIECE.R]: { r: '车', b: '车' },
  [PIECE.C]: { r: '炮', b: '炮' },
  [PIECE.P]: { r: '兵', b: '卒' },
};

const DEPTH_LABEL = { 2: '入门', 3: '普通', 4: '进阶' };
const AI_THINK_BUDGET_MS = 10000;

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

  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

  const backRow = [PIECE.R, PIECE.N, PIECE.B, PIECE.A, PIECE.K, PIECE.A, PIECE.B, PIECE.N, PIECE.R];

  for (let c = 0; c < COLS; c += 1) {
    board[0][c] = -backRow[c];
    board[9][c] = backRow[c];
  }

  board[2][1] = -PIECE.C;
  board[2][7] = -PIECE.C;
  board[7][1] = PIECE.C;
  board[7][7] = PIECE.C;

  for (let c = 0; c < COLS; c += 2) {
    board[3][c] = -PIECE.P;
    board[6][c] = PIECE.P;
  }

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

  ctx.strokeStyle = '#7a5a3b';
  ctx.lineWidth = 2;
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
  const label = color === RED ? LABELS[type].r : LABELS[type].b;
  ctx.fillText(label, 0, 1);
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

      const x = MARGIN + c * CELL;
      const y = MARGIN + r * CELL;
      drawPiece(piece, x, y);
    }
  }

  if (!animation || animation.phase !== 'move') return;

  const progress = easeInOut(clamp((now - animation.phaseStart) / animation.moveDuration, 0, 1));
  const fromX = MARGIN + animation.move.from.c * CELL;
  const fromY = MARGIN + animation.move.from.r * CELL;
  const toX = MARGIN + animation.move.to.c * CELL;
  const toY = MARGIN + animation.move.to.r * CELL;
  const x = lerp(fromX, toX, progress);
  const y = lerp(fromY, toY, progress);
  const scale = 1 + 0.06 * Math.sin(progress * Math.PI);
  drawPiece(animation.piece, x, y, { scale });
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
    const { r, c } = selected;
    const x = MARGIN + c * CELL;
    const y = MARGIN + r * CELL;
    ctx.save();
    ctx.strokeStyle = '#3b7a57';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.stroke();

    for (const move of legalMoves) {
      const mx = MARGIN + move.to.c * CELL;
      const my = MARGIN + move.to.r * CELL;
      ctx.fillStyle = 'rgba(59, 122, 87, 0.25)';
      ctx.beginPath();
      ctx.arc(mx, my, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (!animation) return;

  if (animation.phase === 'pre') {
    const opacity = blinkOpacity(now, animation.phaseStart, animation.preDuration, 2);
    drawPulse(animation.move.from, opacity, '#c0392b');
  } else if (animation.phase === 'post') {
    const opacity = blinkOpacity(now, animation.phaseStart, animation.postDuration, 3);
    drawPulse(animation.move.to, opacity, '#3b7a57');
  }
}

function drawCheckMarks(now) {
  if (!checkInfo) return;
  const opacity = 0.45 + 0.25 * Math.sin(now / 140);
  drawThreatRing(checkInfo.attacker, rgba('#d32f2f', opacity), 26 + 2 * Math.sin(now / 120), 4);
  drawThreatRing(checkInfo.king, rgba('#d32f2f', opacity * 0.9), 26 + 2 * Math.cos(now / 120), 4);
}

function drawThreatRing(coord, stroke, radius, width) {
  const x = MARGIN + coord.c * CELL;
  const y = MARGIN + coord.r * CELL;
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function inBounds(r, c) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

function findKing(color, state = board) {
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const piece = state[r][c];
      if (piece !== 0 && Math.abs(piece) === PIECE.K && Math.sign(piece) === color) {
        return { r, c };
      }
    }
  }
  return null;
}

function isSameSide(a, b) {
  return a !== 0 && b !== 0 && Math.sign(a) === Math.sign(b);
}

function isPalace(r, c, color) {
  if (c < 3 || c > 5) return false;
  return color === RED ? r >= 7 && r <= 9 : r >= 0 && r <= 2;
}

function crossedRiver(r, color) {
  return color === RED ? r <= 4 : r >= 5;
}

function generateMoves(color, state = board) {
  const moves = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const piece = state[r][c];
      if (piece === 0 || Math.sign(piece) !== color) continue;
      const type = Math.abs(piece);
      if (type === PIECE.R) genRook(r, c, color, state, moves);
      if (type === PIECE.C) genCannon(r, c, color, state, moves);
      if (type === PIECE.N) genKnight(r, c, color, state, moves);
      if (type === PIECE.B) genElephant(r, c, color, state, moves);
      if (type === PIECE.A) genAdvisor(r, c, color, state, moves);
      if (type === PIECE.K) genKing(r, c, color, state, moves);
      if (type === PIECE.P) genPawn(r, c, color, state, moves);
    }
  }
  return moves.filter((m) => isLegalMove(m, color, state));
}

function addMove(moves, from, to, state) {
  const target = state[to.r][to.c];
  if (!isSameSide(state[from.r][from.c], target)) {
    moves.push({ from, to, capture: target });
  }
}

function genRook(r, c, color, state, moves) {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dr, dc] of dirs) {
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc)) {
      if (state[nr][nc] === 0) {
        moves.push({ from: { r, c }, to: { r: nr, c: nc }, capture: 0 });
      } else {
        if (Math.sign(state[nr][nc]) !== color) {
          moves.push({ from: { r, c }, to: { r: nr, c: nc }, capture: state[nr][nc] });
        }
        break;
      }
      nr += dr;
      nc += dc;
    }
  }
}

function genCannon(r, c, color, state, moves) {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dr, dc] of dirs) {
    let nr = r + dr;
    let nc = c + dc;
    let jumped = false;
    while (inBounds(nr, nc)) {
      if (!jumped) {
        if (state[nr][nc] === 0) {
          moves.push({ from: { r, c }, to: { r: nr, c: nc }, capture: 0 });
        } else {
          jumped = true;
        }
      } else if (state[nr][nc] !== 0) {
        if (Math.sign(state[nr][nc]) !== color) {
          moves.push({ from: { r, c }, to: { r: nr, c: nc }, capture: state[nr][nc] });
        }
        break;
      }
      nr += dr;
      nc += dc;
    }
  }
}

function genKnight(r, c, color, state, moves) {
  const steps = [
    { dr: -2, dc: -1, br: -1, bc: 0 },
    { dr: -2, dc: 1, br: -1, bc: 0 },
    { dr: 2, dc: -1, br: 1, bc: 0 },
    { dr: 2, dc: 1, br: 1, bc: 0 },
    { dr: -1, dc: -2, br: 0, bc: -1 },
    { dr: 1, dc: -2, br: 0, bc: -1 },
    { dr: -1, dc: 2, br: 0, bc: 1 },
    { dr: 1, dc: 2, br: 0, bc: 1 },
  ];
  for (const s of steps) {
    const br = r + s.br;
    const bc = c + s.bc;
    const nr = r + s.dr;
    const nc = c + s.dc;
    if (!inBounds(nr, nc)) continue;
    if (!inBounds(br, bc) || state[br][bc] !== 0) continue;
    addMove(moves, { r, c }, { r: nr, c: nc }, state);
  }
}

function genElephant(r, c, color, state, moves) {
  const steps = [
    { dr: -2, dc: -2, br: -1, bc: -1 },
    { dr: -2, dc: 2, br: -1, bc: 1 },
    { dr: 2, dc: -2, br: 1, bc: -1 },
    { dr: 2, dc: 2, br: 1, bc: 1 },
  ];
  for (const s of steps) {
    const nr = r + s.dr;
    const nc = c + s.dc;
    const br = r + s.br;
    const bc = c + s.bc;
    if (!inBounds(nr, nc)) continue;
    if (state[br][bc] !== 0) continue;
    if (color === RED && nr < 5) continue;
    if (color === BLACK && nr > 4) continue;
    addMove(moves, { r, c }, { r: nr, c: nc }, state);
  }
}

function genAdvisor(r, c, color, state, moves) {
  const steps = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  for (const [dr, dc] of steps) {
    const nr = r + dr;
    const nc = c + dc;
    if (!inBounds(nr, nc)) continue;
    if (!isPalace(nr, nc, color)) continue;
    addMove(moves, { r, c }, { r: nr, c: nc }, state);
  }
}

function genKing(r, c, color, state, moves) {
  const steps = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dr, dc] of steps) {
    const nr = r + dr;
    const nc = c + dc;
    if (!inBounds(nr, nc)) continue;
    if (!isPalace(nr, nc, color)) continue;
    addMove(moves, { r, c }, { r: nr, c: nc }, state);
  }

  const enemyKing = findKing(-color, state);
  if (enemyKing && enemyKing.c === c) {
    const dir = enemyKing.r > r ? 1 : -1;
    let clear = true;
    for (let rr = r + dir; rr !== enemyKing.r; rr += dir) {
      if (state[rr][c] !== 0) {
        clear = false;
        break;
      }
    }
    if (clear) {
      moves.push({ from: { r, c }, to: { r: enemyKing.r, c }, capture: state[enemyKing.r][c] });
    }
  }
}

function genPawn(r, c, color, state, moves) {
  const forward = color === RED ? -1 : 1;
  const nr = r + forward;
  if (inBounds(nr, c)) {
    addMove(moves, { r, c }, { r: nr, c }, state);
  }
  if (crossedRiver(r, color)) {
    for (const dc of [-1, 1]) {
      const nc = c + dc;
      if (inBounds(r, nc)) {
        addMove(moves, { r, c }, { r, c: nc }, state);
      }
    }
  }
}

function isLegalMove(move, color, state) {
  const next = cloneBoard(state);
  applyMove(next, move);
  return !isInCheck(color, next);
}

function cloneBoard(state) {
  return state.map((row) => row.slice());
}

function applyMove(state, move) {
  const piece = state[move.from.r][move.from.c];
  state[move.from.r][move.from.c] = 0;
  state[move.to.r][move.to.c] = piece;
}

function isInCheck(color, state) {
  return Boolean(getCheckInfo(color, state));
}

function getCheckInfo(defenderColor, state = board) {
  const king = findKing(defenderColor, state);
  if (!king) return null;

  const attackerColor = -defenderColor;
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const piece = state[r][c];
      if (piece === 0 || Math.sign(piece) !== attackerColor) continue;
      const type = Math.abs(piece);
      if (canAttack(type, attackerColor, r, c, king.r, king.c, state)) {
        return {
          attacker: { r, c },
          king,
          attackerColor,
          defenderColor,
        };
      }
    }
  }
  return null;
}

function canAttack(type, color, r, c, tr, tc, state) {
  if (type === PIECE.R) return rookAttack(r, c, tr, tc, state);
  if (type === PIECE.C) return cannonAttack(r, c, tr, tc, state);
  if (type === PIECE.N) return knightAttack(r, c, tr, tc, state);
  if (type === PIECE.B) return elephantAttack(color, r, c, tr, tc, state);
  if (type === PIECE.A) return advisorAttack(color, r, c, tr, tc);
  if (type === PIECE.K) return kingAttack(color, r, c, tr, tc, state);
  if (type === PIECE.P) return pawnAttack(color, r, c, tr, tc);
  return false;
}

function rookAttack(r, c, tr, tc, state) {
  if (r !== tr && c !== tc) return false;
  const dr = tr === r ? 0 : tr > r ? 1 : -1;
  const dc = tc === c ? 0 : tc > c ? 1 : -1;
  let rr = r + dr;
  let cc = c + dc;
  while (rr !== tr || cc !== tc) {
    if (state[rr][cc] !== 0) return false;
    rr += dr;
    cc += dc;
  }
  return true;
}

function cannonAttack(r, c, tr, tc, state) {
  if (r !== tr && c !== tc) return false;
  const dr = tr === r ? 0 : tr > r ? 1 : -1;
  const dc = tc === c ? 0 : tc > c ? 1 : -1;
  let rr = r + dr;
  let cc = c + dc;
  let blocks = 0;
  while (rr !== tr || cc !== tc) {
    if (state[rr][cc] !== 0) blocks += 1;
    rr += dr;
    cc += dc;
  }
  return blocks === 1;
}

function knightAttack(r, c, tr, tc, state) {
  const dr = tr - r;
  const dc = tc - c;
  const patterns = [
    { dr: -2, dc: -1, br: -1, bc: 0 },
    { dr: -2, dc: 1, br: -1, bc: 0 },
    { dr: 2, dc: -1, br: 1, bc: 0 },
    { dr: 2, dc: 1, br: 1, bc: 0 },
    { dr: -1, dc: -2, br: 0, bc: -1 },
    { dr: 1, dc: -2, br: 0, bc: -1 },
    { dr: -1, dc: 2, br: 0, bc: 1 },
    { dr: 1, dc: 2, br: 0, bc: 1 },
  ];
  for (const p of patterns) {
    if (p.dr === dr && p.dc === dc) {
      const br = r + p.br;
      const bc = c + p.bc;
      return inBounds(br, bc) && state[br][bc] === 0;
    }
  }
  return false;
}

function elephantAttack(color, r, c, tr, tc, state) {
  const dr = tr - r;
  const dc = tc - c;
  if (Math.abs(dr) !== 2 || Math.abs(dc) !== 2) return false;
  const br = r + dr / 2;
  const bc = c + dc / 2;
  if (!inBounds(br, bc) || state[br][bc] !== 0) return false;
  if (color === RED && tr < 5) return false;
  if (color === BLACK && tr > 4) return false;
  return true;
}

function advisorAttack(color, r, c, tr, tc) {
  if (Math.abs(tr - r) !== 1 || Math.abs(tc - c) !== 1) return false;
  return isPalace(tr, tc, color);
}

function kingAttack(color, r, c, tr, tc, state) {
  const dr = Math.abs(tr - r);
  const dc = Math.abs(tc - c);
  if (dr + dc === 1) {
    return isPalace(tr, tc, color);
  }
  if (c === tc) {
    const dir = tr > r ? 1 : -1;
    let rr = r + dir;
    while (rr !== tr) {
      if (state[rr][c] !== 0) return false;
      rr += dir;
    }
    return true;
  }
  return false;
}

function pawnAttack(color, r, c, tr, tc) {
  const forward = color === RED ? -1 : 1;
  if (tr === r + forward && tc === c) return true;
  if (crossedRiver(r, color) && tr === r && Math.abs(tc - c) === 1) return true;
  return false;
}

function evaluate(state) {
  let score = 0;
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const piece = state[r][c];
      if (piece === 0) continue;
      const color = Math.sign(piece);
      const type = Math.abs(piece);
      let val = VALUE[type];
      if (type === PIECE.P) {
        const advanced = color === RED ? 9 - r : r;
        val += advanced * 8;
      }
      score += val * color;
    }
  }
  return score;
}

function negamax(state, depth, alpha, beta, color) {
  const moves = generateMoves(color, state);
  if (depth === 0 || moves.length === 0) {
    return color * evaluate(state);
  }

  let best = -Infinity;
  for (const move of moves) {
    const next = cloneBoard(state);
    applyMove(next, move);
    const score = -negamax(next, depth - 1, -beta, -alpha, -color);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function analyzeAIMoves(depth) {
  const moves = generateMoves(BLACK, board);
  if (moves.length === 0) return null;

  const scored = [];
  for (const move of moves) {
    const next = cloneBoard(board);
    applyMove(next, move);
    const score = -negamax(next, depth - 1, -Infinity, Infinity, RED);
    const givesCheck = Boolean(getCheckInfo(RED, next));
    scored.push({ move, score, givesCheck });
  }

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const runnerUp = scored[1] || null;
  const forced = moves.length === 1 || Boolean(getCheckInfo(BLACK, board));
  return {
    moves: scored,
    move: best.move,
    bestScore: best.score,
    runnerUpScore: runnerUp ? runnerUp.score : best.score,
    scoreGap: runnerUp ? Math.abs(best.score - runnerUp.score) : 0,
    legalCount: moves.length,
    forced,
    givesCheck: best.givesCheck,
  };
}

function estimateThinkTime(analysis, depth) {
  if (analysis.forced) {
    return randomBetween(450, 900);
  }

  let ms = 1100 + depth * 350;
  ms += Math.min(analysis.legalCount, 30) * 85;
  if (analysis.move.capture) ms += 500;
  if (analysis.givesCheck) ms += 700;
  if (analysis.scoreGap < 60) ms += 2500;
  else if (analysis.scoreGap < 180) ms += 1800;
  else if (analysis.scoreGap < 360) ms += 1100;
  else if (analysis.scoreGap < 700) ms += 500;
  ms += randomBetween(0, 1400);
  return clamp(ms, 1000, AI_THINK_BUDGET_MS);
}

function formatSeconds(ms) {
  return `${(ms / 1000).toFixed(ms >= 1000 ? 1 : 2)}秒`;
}

function randomBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
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
    const value = hex.length === 3
      ? hex.split('').map((ch) => ch + ch).join('')
      : hex;
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

function handleClick(evt) {
  if (gameOver || turn !== RED || aiBusy || animation) return;
  const rect = canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;
  const c = Math.round((x - MARGIN) / CELL);
  const r = Math.round((y - MARGIN) / CELL);
  if (!inBounds(r, c)) return;

  const piece = board[r][c];
  if (selected) {
    const move = legalMoves.find((m) => m.to.r === r && m.to.c === c);
    if (move) {
      applyMove(board, move);
      selected = null;
      legalMoves = [];
      if (checkForGameOverAfterMove(RED)) return;
      turn = BLACK;

      checkInfo = getCheckInfo(BLACK, board);
      if (checkInfo) {
        setMessage('黑方被将军，AI正在思考...', { check: true });
      } else {
        setMessage('AI正在思考...');
      }

      draw(performance.now());
      startAIMove();
      return;
    }
  }

  if (piece !== 0 && Math.sign(piece) === RED) {
    selected = { r, c };
    legalMoves = generateMoves(RED, board).filter((m) => m.from.r === r && m.from.c === c);
  } else {
    selected = null;
    legalMoves = [];
  }
  draw(performance.now());
}

function startAIMove() {
  if (gameOver || turn !== BLACK) return;

  const depth = Number(depthInput.value);
  const analysis = analyzeAIMoves(depth);
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

  if (animation.phase === 'move') {
    if (elapsed >= animation.moveDuration) {
      applyMove(board, animation.move);
      turn = RED;
      checkInfo = getCheckInfo(RED, board);
      if (checkInfo) {
        setMessage('红方被将军，请应对', { check: true });
      } else {
        setMessage('请走子');
      }
      animation.phase = 'post';
      animation.phaseStart = now;
      if (checkForGameOverAfterMove(BLACK)) {
        animation = null;
        aiBusy = false;
      }
      return;
    }
    return;
  }

  if (animation.phase === 'post' && elapsed >= animation.postDuration) {
    animation = null;
    aiBusy = false;
    if (!gameOver) {
      if (checkInfo) {
        setMessage('红方被将军，请应对', { check: true });
      } else {
        setMessage('请走子');
      }
    }
  }
}

function checkForGameOverAfterMove(moverColor) {
  const redKing = findKing(RED, board);
  const blackKing = findKing(BLACK, board);
  if (!redKing) {
    gameOver = true;
    setMessage(moverColor === RED ? '红方胜' : '黑方胜', { check: true });
    return true;
  }
  if (!blackKing) {
    gameOver = true;
    setMessage(moverColor === RED ? '红方胜' : '黑方胜', { check: true });
    return true;
  }

  const nextColor = moverColor === RED ? BLACK : RED;
  const moves = generateMoves(nextColor, board);
  if (moves.length === 0) {
    gameOver = true;
    setMessage(moverColor === RED ? '红方胜' : '黑方胜', { check: true });
    return true;
  }
  return false;
}

resetBtn.addEventListener('click', initBoard);
canvas.addEventListener('click', handleClick);
depthInput.addEventListener('input', updateDepthLabel);

updateDepthLabel();
initBoard();
