const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadEngine() {
  const enginePath = path.join(__dirname, '..', 'engine.js');
  const source = fs.readFileSync(enginePath, 'utf8');
  const context = {
    window: {},
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'engine.js' });
  return context.window.ChessEngine;
}

const engine = loadEngine();

test('initial board contains both kings in standard positions', () => {
  const board = engine.createInitialBoard();

  assert.equal(board[0][4], -engine.PIECE.K);
  assert.equal(board[9][4], engine.PIECE.K);
});

test('red pawn can move forward before crossing the river', () => {
  const board = engine.createInitialBoard();
  const moves = engine
    .generateMoves(engine.RED, board)
    .filter((move) => move.from.r === 6 && move.from.c === 0);

  assert.equal(JSON.stringify(moves.map((move) => [move.to.r, move.to.c])), JSON.stringify([[5, 0]]));
});

test('facing kings are detected as check', () => {
  const board = Array.from({ length: engine.ROWS }, () => Array(engine.COLS).fill(0));
  board[0][4] = -engine.PIECE.K;
  board[9][4] = engine.PIECE.K;

  const redCheck = engine.getCheckInfo(engine.RED, board);
  const blackCheck = engine.getCheckInfo(engine.BLACK, board);

  assert.ok(redCheck);
  assert.ok(blackCheck);
  assert.equal(redCheck.king.r, 9);
  assert.equal(redCheck.king.c, 4);
  assert.equal(blackCheck.king.r, 0);
  assert.equal(blackCheck.king.c, 4);
});
