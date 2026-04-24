(function () {
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

  function createInitialBoard() {
    const board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
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

    return board;
  }

  function cloneBoard(state) {
    return state.map((row) => row.slice());
  }

  function applyMove(state, move) {
    const piece = state[move.from.r][move.from.c];
    state[move.from.r][move.from.c] = 0;
    state[move.to.r][move.to.c] = piece;
  }

  function inBounds(r, c) {
    return r >= 0 && r < ROWS && c >= 0 && c < COLS;
  }

  function findKing(color, state) {
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

  function crossedRiver(r, color) {
    return color === RED ? r <= 4 : r >= 5;
  }

  function generateMoves(color, state) {
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
    return moves.filter((move) => isLegalMove(move, color, state));
  }

  function getCheckInfo(defenderColor, state) {
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

  function isLegalMove(move, color, state) {
    const next = cloneBoard(state);
    applyMove(next, move);
    return !getCheckInfo(color, next);
  }

  function isSameSide(a, b) {
    return a !== 0 && b !== 0 && Math.sign(a) === Math.sign(b);
  }

  function isPalace(r, c, color) {
    if (c < 3 || c > 5) return false;
    return color === RED ? r >= 7 && r <= 9 : r >= 0 && r <= 2;
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

    for (const step of steps) {
      const br = r + step.br;
      const bc = c + step.bc;
      const nr = r + step.dr;
      const nc = c + step.dc;
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

    for (const step of steps) {
      const nr = r + step.dr;
      const nc = c + step.dc;
      const br = r + step.br;
      const bc = c + step.bc;
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

    for (const pattern of patterns) {
      if (pattern.dr === dr && pattern.dc === dc) {
        const br = r + pattern.br;
        const bc = c + pattern.bc;
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

  window.ChessEngine = {
    ROWS,
    COLS,
    MARGIN,
    CELL,
    RED,
    BLACK,
    PIECE,
    LABELS,
    DEPTH_LABEL,
    createInitialBoard,
    cloneBoard,
    applyMove,
    inBounds,
    findKing,
    crossedRiver,
    generateMoves,
    getCheckInfo,
  };
}());
