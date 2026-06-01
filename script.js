const SAVE_KEY = 'spinnerRngSave';
const SAVE_VERSION = 1;
const SPIN_DURATION = 1800;

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const BASE_ODDS = { common: 0.60, uncommon: 0.25, rare: 0.10, epic: 0.04, legendary: 0.01 };
const BASE_REWARDS = { common: 10, uncommon: 25, rare: 60, epic: 150, legendary: 400 };

const RARITY_CLASS = { common: 'rarity-common', uncommon: 'rarity-uncommon', rare: 'rarity-rare', epic: 'rarity-epic', legendary: 'rarity-legendary' };
const RARITY_COLORS = { common: '#9e9e9e', uncommon: '#4caf50', rare: '#2196f3', epic: '#9c27b0', legendary: '#ffb300' };

const SPINNERS = [
  { id: 'wood',    name: 'Wood',    cost: 0,      mult: 1,   luckBoost: 0,  tierClass: 'tier-wood' },
  { id: 'stone',   name: 'Stone',   cost: 500,    mult: 1.2, luckBoost: 1,  tierClass: 'tier-stone' },
  { id: 'iron',    name: 'Iron',    cost: 2000,   mult: 1.5, luckBoost: 2,  tierClass: 'tier-iron' },
  { id: 'gold',    name: 'Gold',    cost: 8000,   mult: 2,   luckBoost: 3,  tierClass: 'tier-gold' },
  { id: 'diamond', name: 'Diamond', cost: 25000,  mult: 3,   luckBoost: 5,  tierClass: 'tier-diamond' },
  { id: 'emerald', name: 'Emerald', cost: 100000, mult: 5,   luckBoost: 8,  tierClass: 'tier-emerald' },
];

const UPGRADES = [
  { id: 'lucky',     name: 'Lucky Charm',       desc: '+0.5x multiplier',         baseCost: 100,   costScale: 1.5, type: 'mult',    value: 0.5 },
  { id: 'horseshoe', name: 'Golden Horseshoe',  desc: '+1x multiplier',           baseCost: 500,   costScale: 1.6, type: 'mult',    value: 1 },
  { id: 'clover',    name: 'Four-Leaf Clover',  desc: '+2x multiplier',           baseCost: 2000,  costScale: 1.7, type: 'mult',    value: 2 },
  { id: 'rabbit',    name: "Rabbit's Foot",     desc: '+5x multiplier',           baseCost: 10000, costScale: 1.8, type: 'mult',    value: 5 },
  { id: 'penny',     name: 'Penny Pincher',     desc: '-5% cost discount',        baseCost: 300,   costScale: 1.4, type: 'discount', value: 5 },
  { id: 'tight',     name: 'Tight Budget',      desc: '-10% cost discount',       baseCost: 1500,  costScale: 1.5, type: 'discount', value: 10 },
  { id: 'frugal',    name: 'Frugal Mind',       desc: '-15% cost discount',       baseCost: 7500,  costScale: 1.6, type: 'discount', value: 15 },
  { id: 'qs1',       name: 'Quick Spin I',      desc: '-50ms auto-spin delay',    baseCost: 400,   costScale: 1.5, type: 'speed',   value: 50 },
  { id: 'qs2',       name: 'Quick Spin II',     desc: '-75ms auto-spin delay',    baseCost: 2500,  costScale: 1.6, type: 'speed',   value: 75 },
  { id: 'qs3',       name: 'Quick Spin III',    desc: '-100ms auto-spin delay',   baseCost: 10000, costScale: 1.7, type: 'speed',   value: 100 },
  { id: 'cb',        name: 'Common Boost',      desc: '+$5 common reward',        baseCost: 200,   costScale: 1.5, type: 'reward',  rarity: 'common',    value: 5 },
  { id: 'ub',        name: 'Uncommon Boost',    desc: '+$10 uncommon reward',     baseCost: 500,   costScale: 1.6, type: 'reward',  rarity: 'uncommon',  value: 10 },
  { id: 'rb',        name: 'Rare Boost',        desc: '+$25 rare reward',         baseCost: 2000,  costScale: 1.7, type: 'reward',  rarity: 'rare',      value: 25 },
  { id: 'eb',        name: 'Epic Boost',        desc: '+$50 epic reward',         baseCost: 8000,  costScale: 1.8, type: 'reward',  rarity: 'epic',      value: 50 },
  { id: 'lb',        name: 'Legendary Boost',   desc: '+$150 legendary reward',   baseCost: 25000, costScale: 2.0, type: 'reward',  rarity: 'legendary', value: 150 },
];

const $ = id => document.getElementById(id);

let state, spinning, saveTimer, lastAutoSpin, sessionSpins, audioCtx;
let cumulativeAngle = 0;
let pendingResult = null;
let spinTimeout = null;

function defaultState() {
  return {
    money: 0,
    totalSpins: 0,
    bestReward: 0,
    activeSpinnerId: 'wood',
    unlockedSpinners: ['wood'],
    purchasedUpgrades: [],
    soundEnabled: true,
    version: SAVE_VERSION,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const def = defaultState();
      return { ...def, ...saved };
    }
  } catch (_) {}
  return defaultState();
}

function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (_) {}
  }, 200);
}

function getActiveSpinner() {
  return SPINNERS.find(s => s.id === state.activeSpinnerId) || SPINNERS[0];
}

function getSpinnerIndex() {
  return SPINNERS.findIndex(s => s.id === state.activeSpinnerId);
}

function getUpgradeCount(id) {
  return state.purchasedUpgrades.filter(u => u === id).length;
}

function getUpgradeCost(upg) {
  const count = getUpgradeCount(upg.id);
  let cost = upg.baseCost * Math.pow(upg.costScale, count);
  const discount = computeDiscount();
  cost *= (1 - discount / 100);
  return Math.ceil(Math.max(cost, 1));
}

function getSpinnerCost(spinner) {
  const discount = computeDiscount();
  const cost = spinner.cost * (1 - discount / 100);
  return Math.ceil(Math.max(cost, 0));
}

function computeBonusMult() {
  return UPGRADES
    .filter(u => u.type === 'mult')
    .reduce((sum, u) => sum + u.value * getUpgradeCount(u.id), 0);
}

function computeMultiplier() {
  return getActiveSpinner().mult * (1 + computeBonusMult());
}

function computeDiscount() {
  return Math.min(UPGRADES
    .filter(u => u.type === 'discount')
    .reduce((sum, u) => sum + u.value * getUpgradeCount(u.id), 0), 50);
}

function computeSpeed() {
  const bonus = UPGRADES
    .filter(u => u.type === 'speed')
    .reduce((sum, u) => sum + u.value * getUpgradeCount(u.id), 0);
  return Math.max(100, 500 - bonus);
}

function computeOdds() {
  const lb = getActiveSpinner().luckBoost;
  const p = {
    legendary: BASE_ODDS.legendary + lb * 0.002,
    epic: BASE_ODDS.epic + lb * 0.005,
    rare: BASE_ODDS.rare + lb * 0.01,
    uncommon: BASE_ODDS.uncommon + lb * 0.01,
  };
  p.common = BASE_ODDS.common - (lb * 0.002 + lb * 0.005 + lb * 0.01 + lb * 0.01);
  RARITIES.forEach(r => { p[r] = Math.max(0, p[r]); });
  const total = RARITIES.reduce((s, r) => s + p[r], 0);
  if (total > 0 && Math.abs(total - 1) > 0.0001) {
    RARITIES.forEach(r => { p[r] /= total; });
  }
  return p;
}

function computeRewards() {
  const r = { ...BASE_REWARDS };
  UPGRADES.filter(u => u.type === 'reward').forEach(u => {
    r[u.rarity] += u.value * getUpgradeCount(u.id);
  });
  return r;
}

function resolveRarity(odds) {
  const roll = Math.random();
  let cumulative = 0;
  for (const r of RARITIES) {
    cumulative += odds[r];
    if (roll < cumulative) return r;
  }
  return 'common';
}

function formatMoney(n) {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + Math.floor(n);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function playBeep(freq, duration) {
  if (!state.soundEnabled) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = 0.08;
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration / 1000);
    osc.start();
    osc.stop(audioCtx.currentTime + duration / 1000);
  } catch (_) {}
}

function playRaritySound(rarity) {
  const freqs = { common: 200, uncommon: 350, rare: 520, epic: 700, legendary: 900 };
  playBeep(freqs[rarity] || 200, rarity === 'legendary' ? 400 : 200);
}

function playBuySound() { playBeep(600, 100); }

function generateTicks() {
  const rotator = $('spinner-rotator');
  rotator.querySelectorAll('.tick-mark').forEach(el => el.remove());

  const vis = $('spinner-visual');
  const size = vis.offsetWidth || 180;
  const ringRadius = size * 0.38;

  const idx = getSpinnerIndex();
  const count = 8 + idx * 2;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 360;
    const tick = document.createElement('div');
    tick.className = 'tick-mark';
    tick.style.transform = 'translateY(-' + ringRadius + 'px) rotate(' + angle + 'deg)';
    rotator.appendChild(tick);
  }
}

function updateHeader() {
  const mult = computeMultiplier();
  $('money-display').textContent = formatMoney(state.money);
  $('spins-display').textContent = state.totalSpins;
  $('mult-display').textContent = mult.toFixed(2) + 'x';
  $('best-display').textContent = formatMoney(state.bestReward);
  const streakEl = $('streak-display');
  if (streakEl) streakEl.textContent = 'Session: ' + sessionSpins;
}

function renderOdds() {
  const odds = computeOdds();
  RARITIES.forEach(r => {
    const el = $('odds-' + r);
    if (el) el.textContent = (odds[r] * 100).toFixed(1);
  });
}

function updateSpinnerVisual() {
  const vis = $('spinner-visual');
  const label = $('spinner-result-label');
  const spinner = getActiveSpinner();

  label.textContent = spinner.name;

  SPINNERS.forEach(s => vis.classList.remove(s.tierClass));
  if (spinner.tierClass) vis.classList.add(spinner.tierClass);
}

function showReward(rarity, amount) {
  const el = $('last-reward');
  el.textContent = capitalize(rarity) + '! +' + formatMoney(amount);
  el.classList.add('highlight');
  el.style.color = RARITY_COLORS[rarity] || '';
  setTimeout(() => {
    el.classList.remove('highlight');
    el.style.color = '';
  }, 3000);
}

function refreshButtons() {
  const spinBtn = $('spin-btn');
  spinBtn.disabled = spinning;
  spinBtn.textContent = spinning ? '...' : 'SPIN';
  const autoBtn = $('autospin-btn');
  autoBtn.textContent = 'Auto: ' + (state.autoSpinEnabled ? 'ON' : 'OFF');
  autoBtn.style.borderColor = state.autoSpinEnabled ? 'var(--rarity-uncommon)' : '';
  $('sound-btn').textContent = 'Sound: ' + (state.soundEnabled ? 'On' : 'Off');
}

function renderUpgrades() {
  const container = $('panel-upgrades');
  container.innerHTML = '';
  UPGRADES.forEach(upg => {
    const count = getUpgradeCount(upg.id);
    const cost = getUpgradeCost(upg);
    const maxed = count >= 10;
    const div = document.createElement('div');
    div.className = 'panel-item' + (maxed ? ' owned' : '');
    const info = document.createElement('div');
    info.className = 'panel-item-info';
    const name = document.createElement('div');
    name.className = 'panel-item-name';
    name.textContent = upg.name + (count > 0 ? ' (' + count + ')' : '');
    const desc = document.createElement('div');
    desc.className = 'panel-item-desc';
    desc.textContent = upg.desc + (maxed ? ' [MAX]' : ' — $' + cost.toLocaleString());
    info.appendChild(name);
    info.appendChild(desc);
    div.appendChild(info);
    if (!maxed) {
      const btn = document.createElement('button');
      btn.className = 'panel-item-btn btn' + (state.money >= cost ? ' affordable' : '');
      btn.textContent = 'Buy';
      btn.disabled = state.money < cost;
      btn.addEventListener('click', e => { e.stopPropagation(); buyUpgrade(upg); });
      div.appendChild(btn);
    }
    container.appendChild(div);
  });
}

function renderSpinners() {
  const container = $('panel-spinners');
  container.innerHTML = '';
  SPINNERS.forEach(sp => {
    const unlocked = state.unlockedSpinners.includes(sp.id);
    const equipped = state.activeSpinnerId === sp.id;
    const cost = getSpinnerCost(sp);
    const div = document.createElement('div');
    div.className = 'panel-item' + (equipped ? ' equipped' : unlocked ? ' owned' : '');
    const info = document.createElement('div');
    info.className = 'panel-item-info';
    const name = document.createElement('div');
    name.className = 'panel-item-name';
    name.textContent = sp.name + (equipped ? ' (active)' : '');
    const desc = document.createElement('div');
    desc.className = 'panel-item-desc';
    if (unlocked) {
      desc.textContent = sp.mult + 'x mult, +' + sp.luckBoost + '% luck boost';
    } else {
      desc.textContent = sp.mult + 'x mult, +' + sp.luckBoost + '% luck — $' + cost.toLocaleString();
    }
    info.appendChild(name);
    info.appendChild(desc);
    div.appendChild(info);
    if (!unlocked) {
      const btn = document.createElement('button');
      btn.className = 'panel-item-btn btn' + (state.money >= cost ? ' affordable' : '');
      btn.textContent = 'Buy';
      btn.disabled = state.money < cost;
      btn.addEventListener('click', e => { e.stopPropagation(); buySpinner(sp); });
      div.appendChild(btn);
    } else if (!equipped) {
      const btn = document.createElement('button');
      btn.className = 'panel-item-btn btn';
      btn.textContent = 'Equip';
      btn.addEventListener('click', e => { e.stopPropagation(); equipSpinner(sp); });
      div.appendChild(btn);
    }
    container.appendChild(div);
  });
}

function renderAll() {
  updateHeader();
  renderOdds();
  updateSpinnerVisual();
  refreshButtons();
  renderUpgrades();
  renderSpinners();
}

function finishSpin() {
  if (!pendingResult) return;
  const { rarity, amount } = pendingResult;
  pendingResult = null;
  spinTimeout = null;

  state.money += amount;
  state.totalSpins++;
  sessionSpins++;
  if (amount > state.bestReward) state.bestReward = amount;

  const rotator = $('spinner-rotator');
  rotator.classList.remove('spinning');

  showReward(rarity, amount);
  playRaritySound(rarity);

  const vis = $('spinner-visual');
  RARITIES.forEach(r => vis.classList.remove(RARITY_CLASS[r]));
  vis.classList.add(RARITY_CLASS[rarity]);
  vis.classList.add('reveal');
  setTimeout(() => {
    RARITIES.forEach(r => vis.classList.remove(RARITY_CLASS[r]));
    vis.classList.remove('reveal');
  }, 800);

  spinning = false;
  lastAutoSpin = performance.now();
  updateHeader();
  refreshButtons();
  saveState();
}

function doSpin() {
  if (spinning || pendingResult || spinTimeout) return;

  const odds = computeOdds();
  const rarity = resolveRarity(odds);
  const rewards = computeRewards();
  const mult = computeMultiplier();
  const amount = Math.floor(rewards[rarity] * mult);

  const extraDeg = 1080 + Math.random() * 720;
  const startAngle = cumulativeAngle;
  cumulativeAngle += extraDeg;

  RARITIES.forEach(r => $('spinner-visual').classList.remove(RARITY_CLASS[r]));
  $('spinner-visual').classList.remove('reveal');

  const rotator = $('spinner-rotator');
  rotator.classList.add('spinning');
  rotator.style.transform = 'rotate(' + cumulativeAngle + 'deg)';

  pendingResult = { rarity, amount };
  spinning = true;
  spinTimeout = setTimeout(finishSpin, SPIN_DURATION);
  refreshButtons();
  playBeep(100, 80);
}

function buyUpgrade(upg) {
  const cost = getUpgradeCost(upg);
  if (state.money < cost) return;
  const count = getUpgradeCount(upg.id);
  if (count >= 10) return;
  state.money -= cost;
  state.purchasedUpgrades.push(upg.id);
  playBuySound();
  renderAll();
  saveState();
}

function buySpinner(sp) {
  const cost = getSpinnerCost(sp);
  if (state.money < cost) return;
  if (state.unlockedSpinners.includes(sp.id)) return;
  state.money -= cost;
  state.unlockedSpinners.push(sp.id);
  state.activeSpinnerId = sp.id;
  generateTicks();
  playBuySound();
  renderAll();
  saveState();
}

function equipSpinner(sp) {
  if (!state.unlockedSpinners.includes(sp.id)) return;
  state.activeSpinnerId = sp.id;
  generateTicks();
  playBeep(440, 80);
  renderAll();
  saveState();
}

function toggleAutoSpin() {
  state.autoSpinEnabled = !state.autoSpinEnabled;
  if (state.autoSpinEnabled) lastAutoSpin = performance.now();
  refreshButtons();
  saveState();
}

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  if (state.soundEnabled && !audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
  }
  refreshButtons();
  saveState();
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector('.tab-btn[data-tab="' + tab + '"]').classList.add('active');
  $('panel-' + tab).classList.add('active');
}

function gameLoop(timestamp) {
  if (state.autoSpinEnabled && !spinning && !pendingResult && !spinTimeout) {
    const speed = computeSpeed();
    if (timestamp - lastAutoSpin >= speed) {
      lastAutoSpin = timestamp;
      doSpin();
    }
  }
  requestAnimationFrame(gameLoop);
}

function init() {
  spinning = false;
  sessionSpins = 0;
  lastAutoSpin = 0;
  cumulativeAngle = 0;
  pendingResult = null;
  spinTimeout = null;
  state = loadState();
  if (state.soundEnabled) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
  }
  generateTicks();
  $('spin-btn').addEventListener('click', doSpin);
  $('autospin-btn').addEventListener('click', toggleAutoSpin);
  $('sound-btn').addEventListener('click', toggleSound);
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); doSpin(); }
    if (e.key === 'b' || e.key === 'B') { e.preventDefault(); toggleAutoSpin(); }
    if (e.key === 'u' || e.key === 'U') { e.preventDefault(); const tab = 'upgrades'; switchTab(tab); }
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); const tab = 'spinners'; switchTab(tab); }
    if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleSound(); }
  });
  renderAll();
  requestAnimationFrame(gameLoop);
}

document.addEventListener('DOMContentLoaded', init);
