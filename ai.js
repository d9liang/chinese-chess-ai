(function () {
  const { BLACK, RED, PIECE, generateMoves, applyMove, cloneBoard, getCheckInfo } = window.ChessEngine;

  const VALUE = {
    [PIECE.K]: 10000,
    [PIECE.R]: 500,
    [PIECE.C]: 450,
    [PIECE.N]: 300,
    [PIECE.B]: 200,
    [PIECE.A]: 200,
    [PIECE.P]: 100,
  };

  const AI_THINK_BUDGET_MS = 10000;

  function analyzeAIMoves(board, depth) {
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

  function evaluate(state) {
    let score = 0;
    for (let r = 0; r < state.length; r += 1) {
      for (let c = 0; c < state[r].length; c += 1) {
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

  function randomBetween(min, max) {
    return Math.round(min + Math.random() * (max - min));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  window.ChessAI = {
    analyzeAIMoves,
    estimateThinkTime,
    formatSeconds,
  };
}());
