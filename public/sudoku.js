// Генератор и решатель судоку. Работает и в браузере (window.Sudoku), и в Node (module.exports).
(function (root) {
  'use strict';

  const DIFFICULTIES = {
    easy: { label: 'Лёгкий', clues: 40 },
    medium: { label: 'Средний', clues: 32 },
    hard: { label: 'Сложный', clues: 27 },
    expert: { label: 'Эксперт', clues: 22 },
  };

  const BOX = new Array(81);
  for (let i = 0; i < 81; i++) {
    BOX[i] = Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);
  }

  // Индексы клеток, связанных с данной (та же строка, столбец или блок).
  const PEERS = [];
  for (let i = 0; i < 81; i++) {
    const set = new Set();
    for (let j = 0; j < 81; j++) {
      if (j === i) continue;
      if (Math.floor(j / 9) === Math.floor(i / 9) || j % 9 === i % 9 || BOX[j] === BOX[i]) set.add(j);
    }
    PEERS.push([...set]);
  }

  function shuffle(arr, rand) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function popcount(x) {
    let c = 0;
    while (x) { x &= x - 1; c++; }
    return c;
  }

  // Ищет решения перебором с выбором клетки с наименьшим числом кандидатов.
  // Останавливается, найдя `limit` решений. Возвращает { count, solution }.
  function search(grid, limit, rand) {
    const g = grid.slice();
    const rows = new Array(9).fill(0);
    const cols = new Array(9).fill(0);
    const boxes = new Array(9).fill(0);

    for (let i = 0; i < 81; i++) {
      const v = g[i];
      if (!v) continue;
      const bit = 1 << v;
      const r = Math.floor(i / 9), c = i % 9, b = BOX[i];
      if ((rows[r] | cols[c] | boxes[b]) & bit) return { count: 0, solution: null };
      rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
    }

    let count = 0;
    let solution = null;

    function rec() {
      let best = -1, bestMask = 0, bestCount = 10;
      for (let i = 0; i < 81; i++) {
        if (g[i]) continue;
        const mask = ~(rows[Math.floor(i / 9)] | cols[i % 9] | boxes[BOX[i]]) & 0x3fe;
        const n = popcount(mask);
        if (n === 0) return;
        if (n < bestCount) {
          best = i; bestMask = mask; bestCount = n;
          if (n === 1) break;
        }
      }
      if (best === -1) {
        count++;
        if (!solution) solution = g.slice();
        return;
      }

      const digits = [];
      for (let d = 1; d <= 9; d++) if (bestMask & (1 << d)) digits.push(d);
      if (rand) shuffle(digits, rand);

      const r = Math.floor(best / 9), c = best % 9, b = BOX[best];
      for (const d of digits) {
        const bit = 1 << d;
        g[best] = d;
        rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
        rec();
        rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
        g[best] = 0;
        if (count >= limit) return;
      }
    }

    rec();
    return { count, solution };
  }

  function solve(grid) {
    return search(grid, 1).solution;
  }

  function countSolutions(grid, limit = 2) {
    return search(grid, limit).count;
  }

  function countClues(grid) {
    return grid.reduce((n, v) => n + (v ? 1 : 0), 0);
  }

  // Убирает цифры симметричными парами, пока решение остаётся единственным
  // и пока не достигнуто целевое число подсказок.
  function carve(solution, target, rand) {
    const puzzle = solution.slice();
    let clues = 81;
    const order = shuffle([...Array(41).keys()], rand);
    for (const i of order) {
      if (clues <= target) break;
      const j = 80 - i;
      const cells = i === j ? [i] : [i, j];
      if (clues - cells.length < target) continue;
      const saved = cells.map((k) => puzzle[k]);
      cells.forEach((k) => { puzzle[k] = 0; });
      if (countSolutions(puzzle, 2) === 1) {
        clues -= cells.length;
      } else {
        cells.forEach((k, n) => { puzzle[k] = saved[n]; });
      }
    }
    return puzzle;
  }

  function generate(difficulty = 'medium', rand = Math.random) {
    const target = (DIFFICULTIES[difficulty] || DIFFICULTIES.medium).clues;
    // Для сложных уровней делаем несколько попыток и берём самую «пустую» сетку.
    const attempts = target <= 22 ? 40 : target <= 27 ? 8 : 1;
    let best = null;
    for (let a = 0; a < attempts; a++) {
      const solution = search(new Array(81).fill(0), 1, rand).solution;
      const puzzle = carve(solution, target, rand);
      if (!best || countClues(puzzle) < countClues(best.puzzle)) best = { puzzle, solution };
      if (countClues(best.puzzle) <= target) break;
    }
    return best;
  }

  const api = { DIFFICULTIES, PEERS, BOX, generate, solve, countSolutions, countClues };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sudoku = api;
})(typeof window !== 'undefined' ? window : globalThis);
