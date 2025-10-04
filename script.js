(() => {
  // Elements
  const el = id => document.getElementById(id);
  const qs = sel => document.querySelector(sel);
  const qsa = sel => Array.from(document.querySelectorAll(sel));

  const lengthEl = el('length');
  const lengthVal = el('lengthVal');
  const lower = el('lower');
  const upper = el('upper');
  const numbers = el('numbers');
  const symbols = el('symbols');
  const ambiguous = el('ambiguous');
  const generateBtn = el('generate');
  const randomizeBtn = el('randomize');
  const resultInput = el('result');
  const copyBtn = el('copyBtn');
  const exportBtn = el('exportBtn');
  const strengthText = el('strengthText');
  const barInner = el('barInner');
  const rulesList = el('rulesList');
  const presets = qsa('.preset');
  const themeBtn = el('themeBtn');

  // Character sets
  const SETS = {
    lower: 'abcdefghijklmnopqrstuvwxyz',
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    numbers: '0123456789',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>/?'
  };
  const AMBIG = 'il1Lo0O';

  // Local storage keys
  const LS = { theme: 'passguard_theme', prefs: 'passguard_prefs' };

  // Helpers
   const randInt = n => {
  const arr = new Uint32Array(1);
  window.crypto.getRandomValues(arr);
  return arr[0] % n;
  };
  const savePrefs = prefs => localStorage.setItem(LS.prefs, JSON.stringify(prefs));
  const loadPrefs = () => JSON.parse(localStorage.getItem(LS.prefs) || '{}');

  // Initialize UI
  function init() {
    // restore prefs
    const prefs = loadPrefs();
    lengthEl.value = prefs.length || 8;
    if (prefs.lower !== undefined) lower.checked = prefs.lower;
    if (prefs.upper !== undefined) upper.checked = prefs.upper;
    if (prefs.numbers !== undefined) numbers.checked = prefs.numbers;
    symbols.checked = prefs.symbols === undefined ? false : prefs.symbols;

    lengthVal.textContent = lengthEl.value;

    // theme
    const forcedTheme = localStorage.getItem(LS.theme);
    if (forcedTheme === 'dark' || (!forcedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.body.classList.add('dark');
      themeBtn.textContent = '🌞';
      themeBtn.setAttribute('aria-pressed', 'true');
    } else {
      document.body.classList.remove('dark');
      themeBtn.textContent = '🌙';
      themeBtn.setAttribute('aria-pressed', 'false');
    }

    // populate rules UI
    updateRules();
    
    // initial generate
    setTimeout(() => generate(), 80);
  }

  // Build character pool
  function buildPool(opts) {
    let pool = '';
    if (opts.lower) pool += SETS.lower;
    if (opts.upper) pool += SETS.upper;
    if (opts.numbers) pool += SETS.numbers;
    if (opts.symbols) pool += SETS.symbols;
    if (opts.excludeAmbig) pool = pool.split('').filter(ch => !AMBIG.includes(ch)).join('');
    return pool;
  }

  // Generate password
  function generate() {
    const len = parseInt(lengthEl.value, 10);
    const opts = { lower: lower.checked, upper: upper.checked, numbers: numbers.checked, symbols: symbols.checked, excludeAmbig: ambiguous.checked };
    const pool = buildPool(opts);
    if (!pool.length) { alert('Select at least one character type.'); return; }

    let pw = '';
    for (let i=0;i<len;i++) pw += pool[randInt(pool.length)];

    // Ensure at least one char from each selected set when length allows
    const selectedSets = Object.entries(opts).filter(([k,v]) => ['lower','upper','numbers','symbols'].includes(k) && v).map(([k]) => SETS[k]);
    if (selectedSets.length && len >= selectedSets.length) {
      // place one guaranteed char from each selected set
      const pwArr = pw.split('');
      for (let i=0;i<selectedSets.length;i++) {
        const pos = i; // overwrite early positions
        pwArr[pos] = selectedSets[i][randInt(selectedSets[i].length)];
      }
      pw = pwArr.join('');
    }

    resultInput.value = pw;
    updateStrength(pw, opts);
    savePrefs({ length: len, lower: opts.lower, upper: opts.upper, numbers: opts.numbers, symbols: opts.symbols });
  }

  // Strength meter (simple heuristic)
  function updateStrength(pw, opts) {
    
    // compute pool size
  let poolSize = 0;
  if (opts.lower) poolSize += SETS.lower.length;
  if (opts.upper) poolSize += SETS.upper.length;
  if (opts.numbers) poolSize += SETS.numbers.length;
  if (opts.symbols) poolSize += SETS.symbols.length;
  // if ambiguous excluded, subtract ambiguous chars present in pool
  if (opts.excludeAmbig) {
    const ambCount = Array.from(AMBIG).filter(ch =>
      (opts.lower && SETS.lower.includes(ch)) ||
      (opts.upper && SETS.upper.includes(ch)) ||
      (opts.numbers && SETS.numbers.includes(ch)) ||
      (opts.symbols && SETS.symbols.includes(ch))
    ).length;
    poolSize = Math.max(1, poolSize - ambCount);
  }
  // bits of entropy = log2(poolSize) * length
  const bitsPerChar = poolSize > 1 ? Math.log2(poolSize) : 0;
  return Math.round(bitsPerChar * pw.length);
}

function updateStrength(pw, opts) {
  const entropy = estimateEntropy(pw, opts); // bits
  // map entropy to percentage: 0 bits -> 0%, 80 bits -> 100% (adjustable)
  const MAX_BITS = 80;
  const pct = Math.min(100, Math.round((entropy / MAX_BITS) * 100));

  // choose label thresholds (bits-based)
  let label = 'Very weak';
  if (entropy >= 80) label = 'Very strong';
  else if (entropy >= 60) label = 'Strong';
  else if (entropy >= 40) label = 'Medium';
  else if (entropy >= 24) label = 'Weak';

  // update bar
  barInner.style.width = pct + '%';
  strengthText.textContent = `Strength: ${label}`;

  // color gradient by pct
  if (pct > 80) barInner.style.background = 'linear-gradient(90deg,#31d0a8,#2bd19a)';
  else if (pct > 60) barInner.style.background = 'linear-gradient(90deg,#7ee787,#31d0a8)';
  else if (pct > 40) barInner.style.background = 'linear-gradient(90deg,#ffd166,#ffb36b)';
  else barInner.style.background = 'linear-gradient(90deg,#ff6b6b,#ff8f8f)';

  updateRules();
}

  // Rules preview
  function updateRules() {
    const rules = [];
    rules.push(`Length: ${lengthEl.value}`);
    if (lower.checked) rules.push('Includes lowercase');
    if (upper.checked) rules.push('Includes uppercase');
    if (numbers.checked) rules.push('Includes numbers');
    if (symbols.checked) rules.push('Includes symbols');
    if (ambiguous.checked) rules.push('Excludes ambiguous characters: il1Lo0O');
    rulesList.innerHTML = rules.map(r => `<li>${r}</li>`).join('');
  }


  // Export (download TXT)
function exportResult() {
  const text = resultInput.value;
  if (!text) return alert('No password to export.');

  const now = new Date();
  const timestamp = now.toLocaleString();
  const fnTimestamp = now.toISOString().replace(/[:.]/g, '-');
  const content = [
    'PassGuard Password Export',
    `Date: ${timestamp}`,
    '',
    `Password: ${text}`
  ].join('\n');

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `passguard-${fnTimestamp}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  }

  // Copy to clipboard
  async function copyToClipboard() {
    const text = resultInput.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Copied';
      setTimeout(()=> copyBtn.textContent = 'Copy',1400);
    } catch {
      alert('Copy failed. Select the password and copy manually.');
    }
  }

  // Theme toggle
  function toggleTheme() {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem(LS.theme, isDark ? 'dark' : 'light');
    themeBtn.textContent = isDark ? '🌞' : '🌙';
    themeBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
  }

  // Attach events
  lengthEl.addEventListener('input', () => { lengthVal.textContent = lengthEl.value; updateRules(); });
  [lower,upper,numbers,symbols,ambiguous].forEach(inp => inp.addEventListener('change', () => updateRules()));
  generateBtn.addEventListener('click', generate);
  randomizeBtn.addEventListener('click', () => {
    const cur = resultInput.value;
    if (!cur) return;
    resultInput.value = cur.split('').sort(()=>Math.random()-0.5).join('');
    updateStrength(resultInput.value, { lower: lower.checked, upper: upper.checked, numbers: numbers.checked, symbols: symbols.checked });
  });
  copyBtn.addEventListener('click', copyToClipboard);
  exportBtn.addEventListener('click', exportResult);
  presets.forEach(btn => {
  btn.addEventListener('click', e => {
    // apply preset values
    const len = btn.dataset.length;
    lengthEl.value = len;
    lengthVal.textContent = len;

    const types = (btn.dataset.types || '').split(',').map(s => s.trim());
    lower.checked = types.includes('lower');
    upper.checked = types.includes('upper');
    numbers.checked = types.includes('numbers');
    symbols.checked = types.includes('symbols');

    updateRules();
    generate();

    // visual feedback (single, short-lived class)
    btn.classList.add('preset--active');
    setTimeout(() => btn.classList.remove('preset--active'), 260);
  });
});

 // register theme handler (single listener)
themeBtn.addEventListener('click', toggleTheme);
  
  // Init
  init();
})();

