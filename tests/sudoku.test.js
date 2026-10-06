// Запуск: node tests/sudoku.test.js
const assert = require('assert');
const path = require('path');
const Sudoku = require(path.join(__dirname, '..', 'public', 'sudoku.js'));

function isValidSolution(grid) {
  for (let k = 0; k < 9; k++) {
    const row = new Set(), col = new Set(), box = new Set();
    for (let m = 0; m < 9; m++) {
      row.add(grid[k * 9 + m]);
      col.add(grid[m * 9 + k]);
      const r = Math.floor(k / 3) * 3 + Math.floor(m / 3);
      const c = (k % 3) * 3 + (m % 3);
      box.add(grid[r * 9 + c]);
    }
    for (const s of [row, col, box]) {
      if (s.size !== 9 || s.has(0)) return false;
    }
  }
  return true;
}

// Решатель на известной задаче.
const known = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'
  .split('').map(Number);
const solved = Sudoku.solve(known);
assert.ok(solved && isValidSolution(solved), 'solver returns a valid grid');
assert.strictEqual(Sudoku.countSolutions(known), 1, 'known puzzle has a unique solution');
assert.strictEqual(Sudoku.countSolutions(new Array(81).fill(0), 2), 2, 'empty grid has many solutions');

for (const level of Object.keys(Sudoku.DIFFICULTIES)) {
  for (let n = 0; n < 5; n++) {
    const t = Date.now();
    const { puzzle, solution } = Sudoku.generate(level);
    const ms = Date.now() - t;
    assert.ok(isValidSolution(solution), `${level}: solution is valid`);
    assert.strictEqual(Sudoku.countSolutions(puzzle), 1, `${level}: unique solution`);
    puzzle.forEach((v, i) => {
      if (v) assert.strictEqual(v, solution[i], `${level}: clues match solution`);
    });
    console.log(`${level.padEnd(7)} clues=${Sudoku.countClues(puzzle)} ${ms}ms`);
  }
}

console.log('All tests passed');
