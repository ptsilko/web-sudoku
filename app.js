(function () {
  'use strict';

  const { DIFFICULTIES, PEERS, BOX, generate } = window.Sudoku;
  const STATE_KEY = 'sudoku-state-v1';
  const BEST_KEY = 'sudoku-best-v1';
  const HISTORY_LIMIT = 300;

  const $ = (id) => document.getElementById(id);
  const boardEl = $('board');
  const levelsEl = $('levels');
  const numpadEl = $('numpad');
  const mistakesEl = $('mistakes');
  const timerEl = $('timer');
  const notesBtn = $('notes');
  const notesBadge = $('notes-badge');
  const winEl = $('win');

  let state = null;
  let selected = -1;
  let notesMode = false;
  const cells = [];
  const digitButtons = [];

  // ---------- Хранилище ----------

  function storageGet(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* приватный режим и т.п. */ }
  }

  function save() {
    if (state) storageSet(STATE_KEY, state);
  }

  function isValidState(s) {
    return s && DIFFICULTIES[s.difficulty] &&
      Array.isArray(s.puzzle) && s.puzzle.length === 81 &&
      Array.isArray(s.solution) && s.solution.length === 81 &&
      Array.isArray(s.values) && s.values.length === 81 &&
      Array.isArray(s.notes) && s.notes.length === 81;
  }

  // ---------- Игра ----------

  function newGame(difficulty) {
    const { puzzle, solution } = generate(difficulty);
    state = {
      difficulty,
      puzzle,
      solution,
      values: puzzle.slice(),
      notes: new Array(81).fill(0),
      history: [],
      mistakes: 0,
      hints: 0,
      elapsed: 0,
      solved: false,
    };
    selected = -1;
    winEl.hidden = true;
    boardEl.classList.remove('solved');
    save();
    render();
  }

  function hasProgress() {
    return state && !state.solved && state.values.some((v, i) => v && !state.puzzle[i]);
  }

  function requestNewGame(difficulty) {
    if (hasProgress() && !confirm('Начать новую игру? Текущий прогресс будет потерян.')) return;
    newGame(difficulty);
  }

  function pushHistory() {
    state.history.push({ values: state.values.slice(), notes: state.notes.slice() });
    if (state.history.length > HISTORY_LIMIT) state.history.shift();
  }

  function isEditable(i) {
    return i >= 0 && !state.solved && !state.puzzle[i];
  }

  function clearNoteFromPeers(i, d) {
    const bit = 1 << d;
    for (const p of PEERS[i]) state.notes[p] &= ~bit;
  }

  function input(d) {
    if (!isEditable(selected)) return;
    const i = selected;

    if (notesMode) {
      if (state.values[i]) return;
      pushHistory();
      state.notes[i] ^= 1 << d;
    } else {
      pushHistory();
      if (state.values[i] === d) {
        state.values[i] = 0;
      } else {
        state.values[i] = d;
        state.notes[i] = 0;
        if (d !== state.solution[i]) state.mistakes++;
        else clearNoteFromPeers(i, d);
        pop(i);
      }
    }
    afterChange();
  }

  function erase() {
    if (!isEditable(selected)) return;
    const i = selected;
    if (!state.values[i] && !state.notes[i]) return;
    pushHistory();
    state.values[i] = 0;
    state.notes[i] = 0;
    afterChange();
  }

  function undo() {
    if (!state || state.solved || !state.history.length) return;
    const prev = state.history.pop();
    state.values = prev.values;
    state.notes = prev.notes;
    afterChange();
  }

  function hint() {
    if (!state || state.solved) return;
    let target = -1;
    if (isEditable(selected) && state.values[selected] !== state.solution[selected]) {
      target = selected;
    } else {
      const candidates = [];
      for (let i = 0; i < 81; i++) {
        if (state.values[i] !== state.solution[i]) candidates.push(i);
      }
      if (!candidates.length) return;
      target = candidates[Math.floor(Math.random() * candidates.length)];
    }
    pushHistory();
    const d = state.solution[target];
    state.values[target] = d;
    state.notes[target] = 0;
    clearNoteFromPeers(target, d);
    state.hints++;
    selected = target;
    pop(target);
    afterChange();
  }

  function setNotesMode(on) {
    notesMode = on;
    notesBtn.setAttribute('aria-pressed', String(on));
    notesBadge.textContent = on ? 'вкл' : 'выкл';
    numpadEl.classList.toggle('notes-mode', on);
  }

  function afterChange() {
    if (state.values.every((v, i) => v === state.solution[i])) win();
    save();
    render();
  }

  function win() {
    state.solved = true;
    state.history = [];
    selected = -1;

    const best = storageGet(BEST_KEY) || {};
    const prevBest = best[state.difficulty];
    const isRecord = !state.hints && (prevBest == null || state.elapsed < prevBest);
    if (isRecord) {
      best[state.difficulty] = state.elapsed;
      storageSet(BEST_KEY, best);
    }

    const parts = [
      `${DIFFICULTIES[state.difficulty].label} · ${formatTime(state.elapsed)}`,
      `Ошибки: ${state.mistakes}${state.hints ? ` · Подсказки: ${state.hints}` : ''}`,
    ];
    if (isRecord) parts.push('Новый рекорд!');
    else if (prevBest != null) parts.push(`Рекорд: ${formatTime(prevBest)}`);
    $('win-text').innerHTML = parts.join('<br>');

    boardEl.classList.add('solved');
    setTimeout(() => {
      winEl.hidden = false;
      $('win-new').focus();
    }, 550);
  }

  // ---------- Отрисовка ----------

  function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function pop(i) {
    const el = cells[i].el;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  function buildBoard() {
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9), c = i % 9;
      const el = document.createElement('div');
      el.className = 'cell';
      if (c === 2 || c === 5) el.classList.add('box-r');
      if (r === 2 || r === 5) el.classList.add('box-b');
      if (c === 8) el.classList.add('last-c');
      if (r === 8) el.classList.add('last-r');
      el.setAttribute('role', 'gridcell');

      const value = document.createElement('span');
      value.className = 'value';
      const notes = document.createElement('div');
      notes.className = 'notes';
      const noteSpans = [];
      for (let d = 1; d <= 9; d++) {
        const s = document.createElement('span');
        notes.appendChild(s);
        noteSpans.push(s);
      }
      el.append(value, notes);
      el.addEventListener('pointerdown', () => select(i));
      el.addEventListener('animationend', () => el.classList.remove('pop'));
      boardEl.appendChild(el);
      cells.push({ el, value, notes: noteSpans });
    }
  }

  function buildLevels() {
    for (const [key, { label }] of Object.entries(DIFFICULTIES)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.dataset.level = key;
      b.addEventListener('click', () => requestNewGame(key));
      levelsEl.appendChild(b);
    }
  }

  function buildNumpad() {
    for (let d = 1; d <= 9; d++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Цифра ${d}`);
      b.innerHTML = `<span class="digit">${d}</span><span class="left"></span>`;
      b.addEventListener('click', () => input(d));
      numpadEl.appendChild(b);
      digitButtons.push(b);
    }
  }

  function select(i) {
    selected = i;
    render();
  }

  function render() {
    const { values, notes, puzzle, solution } = state;
    const selValue = selected >= 0 ? values[selected] : 0;
    const selR = Math.floor(selected / 9), selC = selected % 9, selB = selected >= 0 ? BOX[selected] : -1;

    for (let i = 0; i < 81; i++) {
      const { el, value, notes: noteSpans } = cells[i];
      const v = values[i];
      const r = Math.floor(i / 9), c = i % 9;

      value.textContent = v ? v : '';
      el.classList.toggle('given', !!puzzle[i]);
      el.classList.toggle('user', !puzzle[i] && !!v);
      el.classList.toggle('wrong', !!v && v !== solution[i]);
      el.classList.toggle('selected', i === selected);
      el.classList.toggle('same', i !== selected && !!selValue && v === selValue);
      el.classList.toggle('related', selected >= 0 && i !== selected &&
        (r === selR || c === selC || BOX[i] === selB));

      const n = v ? 0 : notes[i];
      for (let d = 1; d <= 9; d++) {
        const on = !!(n & (1 << d));
        const s = noteSpans[d - 1];
        s.textContent = on ? d : '';
        s.classList.toggle('hl', on && d === selValue);
      }
    }

    const placed = new Array(10).fill(0);
    for (let i = 0; i < 81; i++) {
      if (values[i] && values[i] === solution[i]) placed[values[i]]++;
    }
    digitButtons.forEach((b, k) => {
      const left = 9 - placed[k + 1];
      b.querySelector('.left').textContent = left;
      b.classList.toggle('done', left === 0);
    });

    for (const b of levelsEl.children) {
      b.setAttribute('aria-pressed', String(b.dataset.level === state.difficulty));
    }

    mistakesEl.textContent = `Ошибки: ${state.mistakes}`;
    timerEl.textContent = formatTime(state.elapsed);
  }

  // ---------- Управление ----------

  function moveSelection(dr, dc) {
    if (selected < 0) { select(0); return; }
    const r = (Math.floor(selected / 9) + dr + 9) % 9;
    const c = (selected % 9 + dc + 9) % 9;
    select(r * 9 + c);
  }

  document.addEventListener('keydown', (e) => {
    if (!winEl.hidden) {
      if (e.key === 'Escape') winEl.hidden = true;
      return;
    }
    if (e.altKey || e.metaKey && e.key.toLowerCase() !== 'z') return;
    const key = e.key;

    if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if (e.ctrlKey) return;

    if (/^[1-9]$/.test(key)) { input(Number(key)); return; }
    switch (key) {
      case 'Backspace': case 'Delete': case '0': erase(); break;
      case 'ArrowUp': e.preventDefault(); moveSelection(-1, 0); break;
      case 'ArrowDown': e.preventDefault(); moveSelection(1, 0); break;
      case 'ArrowLeft': e.preventDefault(); moveSelection(0, -1); break;
      case 'ArrowRight': e.preventDefault(); moveSelection(0, 1); break;
      case 'n': case 'N': case 'т': case 'Т': setNotesMode(!notesMode); break;
      case 'h': case 'H': case 'р': case 'Р': hint(); break;
      case 'Escape': select(-1); break;
      default: return;
    }
  });

  $('undo').addEventListener('click', undo);
  $('erase').addEventListener('click', erase);
  $('hint').addEventListener('click', hint);
  notesBtn.addEventListener('click', () => setNotesMode(!notesMode));
  $('new-game').addEventListener('click', () => requestNewGame(state.difficulty));
  $('win-new').addEventListener('click', () => newGame(state.difficulty));
  winEl.addEventListener('click', (e) => { if (e.target === winEl) winEl.hidden = true; });

  // Таймер идёт, только пока вкладка видна.
  setInterval(() => {
    if (!state || state.solved || document.hidden) return;
    state.elapsed++;
    timerEl.textContent = formatTime(state.elapsed);
    if (state.elapsed % 5 === 0) save();
  }, 1000);
  document.addEventListener('visibilitychange', save);
  window.addEventListener('pagehide', save);

  // ---------- Старт ----------

  buildLevels();
  buildBoard();
  buildNumpad();

  const saved = storageGet(STATE_KEY);
  if (isValidState(saved)) {
    state = saved;
    state.history = Array.isArray(state.history) ? state.history : [];
    if (state.solved) boardEl.classList.add('solved');
    render();
  } else {
    newGame('medium');
  }
})();
