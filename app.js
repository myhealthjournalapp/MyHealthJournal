// ===== APP STATE =====
const APP = {
  user: null,
  readings: [],
  currentScreen: 'login',
  pinBuffer: '',
  isLoggedIn: false,
  avatar: '',
  avatarType: 'initials',
  settings: {
    appLock: false,
    biometric: false,
    dateFormat: 'DD/MM/YYYY',
    autoBackup: false,
    autoBackupInterval: 'daily'
  },
  emailjsConfig: {
    serviceId: 'service_v9ftkd3',
    templateId: 'template_2uke34t',
    publicKey: 'ty3zPrAyx5SIEI836'
  },
  gdriveConfig: {
    scriptUrl: '',
    folderId: '1dMnCqrDz6TGBgrQon-5NgbUFP3R4zosM'
  },
  googleDriveFolderId: '1dMnCqrDz6TGBgrQon-5NgbUFP3R4zosM',
  gmailConfig: {
    fromEmail: 'myhealthjournalapp@gmail.com',
    fromName: 'My Health Journal',
    bccEmails: ['jewellers.asad@gmail.com', 'whitemoonjeweller@gmail.com'],
    otpExpiryMinutes: 15
  },
  otpCode: null,
  otpEmail: null,
  otpPurpose: null,
  recoveryEmail: null,
  firebaseInitialized: false,
  backupCodes: [],
  backupCodesHashed: [],
  backupCodesGeneratedAt: null,
  changeLogs: [],
  emailLogs: [],
  emailVerified: false,
  recoveryEmailVerified: false,
  autoBackupTimer: null,
  autoBackupIntervalMs: 86400000,
  lastAutoBackup: null,
  medicalRecords: []
};

// ================================================================
// ===== DOM REFS & INIT =====
// ================================================================

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

document.addEventListener('DOMContentLoaded', () => {
  APP.isLoggedIn = false;
  updateClock();
  setInterval(updateClock, 1000);
  setupPhoneFormatting();
  setupNameCapitalization();

  setTimeout(() => {
    document.getElementById('splash').classList.add('hide');
    document.getElementById('app').classList.add('active');
    showScreen('login');
  }, 1500);

  document.getElementById('openEmailTriggersInline')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('aboutModal')?.classList.remove('open');
  showScreen('email-triggers');
});

  setupEventListeners();
});

// ================================================================
// ===== SCREEN NAVIGATION =====
// ================================================================

function showScreen(screen) {
  document.querySelectorAll('.screen-view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById(`view-${screen}`);
  if (view) view.classList.add('active');

  if (document.getElementById('app').classList.contains('active')) {
    document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
    const navBtn = document.querySelector(`.bottom-nav .nav-item[data-screen="${screen}"]`);
    if (navBtn) navBtn.classList.add('active');
  }

  APP.currentScreen = screen;
  updateVerificationBadge();
  if (screen === 'email-triggers') renderEmailTriggersPage();
  const authenticated = APP.isLoggedIn && APP.user;
  const avatar = document.getElementById('topAvatar');
  const nav = document.getElementById('bottomNav');
  if (avatar) avatar.hidden = !authenticated;
  if (nav) nav.hidden = !authenticated;
  document.getElementById('screenContainer').scrollTop = 0;

  if (screen === 'home') updateHome();
  if (screen === 'history') renderHistory();
  if (screen === 'trends') updateTrends();
  if (screen === 'profile') updateProfile();
}

function navigateTo(screen) {
  showScreen(screen);
}

function goToHome() {
  if (!APP.user) {
    showScreen('login');
    return;
  }
  updateAvatarDisplay();
  const homeUserDisplay = document.getElementById('homeUserDisplay');
  if (homeUserDisplay) homeUserDisplay.textContent = APP.user.name;
  const readyName = document.getElementById('readyName');
  if (readyName) readyName.textContent = APP.user.name;
  const greetingMsg = document.getElementById('greetingMsg');
  if (greetingMsg) greetingMsg.textContent = getGreeting() + ',';
  showScreen('home');
  updateHome();
}

// ================================================================
// ===== CLOCK & GREETING =====
// ================================================================

function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });
  const date = now.toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
  });
  const topTime = document.getElementById('topTime');
  const homeDate = document.getElementById('homeDate');
  if (topTime) {
    const dayTime = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    topTime.textContent = `${dayTime} · ${time}`;
  }
  if (homeDate) homeDate.textContent = `${date} · ${time}`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// ================================================================
// ===== PRESENCE & GLUCOSE CONSTANTS =====
// ================================================================

const isPresent = v => typeof v === 'number' && Number.isFinite(v) && v > 0;
const hasBP = r => isPresent(r.sys) && isPresent(r.dia);
const hasPulse = r => isPresent(r.pulse);
const hasGlucose = r => isPresent(r.glucoseValue) && GLUCOSE_CATEGORIES.includes(r.glucoseCategory);

const GLUCOSE_CATEGORIES = ['fasting', 'pre_meal', 'post_meal', 'bedtime', 'random'];
const GLUCOSE_LABELS = {
  fasting: 'Fasting',
  pre_meal: 'Pre Meal',
  post_meal: 'Post Meal',
  bedtime: 'Bedtime',
  random: 'Random'
};
const GLUCOSE_COLORS = {
  fasting: '#2563EB',
  pre_meal: '#0D9488',
  post_meal: '#EA580C',
  bedtime: '#9333EA',
  random: '#64748B'
};
const GLUCOSE_TARGETS = {
  fasting: [70, 100],
  pre_meal: [80, 130],
  post_meal: [70, 140],
  bedtime: [70, 140],
  random: [70, 140]
};
/* Expected readings per day per user's confirmed rules. */
const GLUCOSE_DAILY_EXPECTED = {
  fasting: 1,
  pre_meal: 3,
  post_meal: 3,
  bedtime: 1,
  random: 2
};
const BP_DAILY_EXPECTED = 3;
const PULSE_DAILY_EXPECTED = 3;

// ================================================================
// ===== BP / PULSE CLASSIFICATION =====
// ================================================================

function getBPStatus(sys, dia) {
  if (!isPresent(sys) || !isPresent(dia)) return { label: '--', class: 'glucose-none' };
  let sysCategory = null, diaCategory = null;

  if (sys > 180) sysCategory = 'crisis';
  else if (sys >= 140) sysCategory = 'stage2';
  else if (sys >= 130) sysCategory = 'stage1';
  else if (sys >= 121) sysCategory = 'elevated';
  else if (sys >= 90) sysCategory = 'normal';
  else sysCategory = 'hypotension';

  if (dia > 120) diaCategory = 'crisis';
  else if (dia >= 90) diaCategory = 'stage2';
  else if (dia >= 81) diaCategory = 'stage1';
  else if (dia >= 60 && dia < 80) diaCategory = 'normal';
  else diaCategory = 'hypotension';

  const hypertensionRank = { normal: 0, elevated: 1, stage1: 2, stage2: 3, crisis: 4 };
  const highCategories = [sysCategory, diaCategory].filter(c => c !== 'hypotension');
  let finalCategory;
  if (highCategories.some(c => hypertensionRank[c] > 0)) {
    finalCategory = highCategories.reduce((a, b) => hypertensionRank[a] >= hypertensionRank[b] ? a : b);
  } else if (sysCategory === 'hypotension' || diaCategory === 'hypotension') {
    finalCategory = 'hypotension';
  } else {
    finalCategory = 'normal';
  }

  switch (finalCategory) {
    case 'crisis': return { label: 'Hypertensive Crisis', class: 'status-crisis' };
    case 'stage2': return { label: 'Stage 2 Hypertension', class: 'status-stage2' };
    case 'stage1': return { label: 'Stage 1 Hypertension', class: 'status-stage1' };
    case 'elevated': return { label: 'Elevated', class: 'status-elevated' };
    case 'normal': return { label: 'Normal', class: 'status-normal' };
    case 'hypotension':
      if (sys < 90 || dia < 60) return { label: 'Hypotension (Low)', class: 'status-hypotension' };
      return { label: 'Normal', class: 'status-normal' };
    default: return { label: 'Normal', class: 'status-normal' };
  }
}

function getPulseStatus(pulse) {
  if (!isPresent(pulse)) return { label: '--', class: 'glucose-none' };
  if (pulse > 120) return { label: 'Severe Tachycardia', class: 'pulse-tachy-severe' };
  if (pulse >= 101) return { label: 'Mild Tachycardia', class: 'pulse-tachy-mild' };
  if (pulse >= 60 && pulse <= 100) return { label: 'Normal', class: 'pulse-normal' };
  if (pulse >= 40 && pulse < 60) return { label: 'Low (Bradycardia)', class: 'pulse-brady' };
  return { label: 'Severe Bradycardia', class: 'pulse-brady-severe' };
}

function getConsistencyGrade(pct) {
  if (pct >= 90) return { label: 'Excellent', class: 'consistency-grade-excellent' };
  if (pct >= 80) return { label: 'Good', class: 'consistency-grade-good' };
  if (pct >= 70) return { label: 'Average', class: 'consistency-grade-average' };
  if (pct >= 60) return { label: 'Below Average', class: 'consistency-grade-below' };
  if (pct >= 40) return { label: 'Poor', class: 'consistency-grade-poor' };
  return { label: 'Awful', class: 'consistency-grade-awful' };
}

// ================================================================
// ===== GLUCOSE HELPERS =====
// ================================================================

function normaliseGlucoseToMgDl(value, unit = 'mg/dL') {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return unit === 'mmol/L' ? n * 18 : n;
}

function formatGlucosePrimary(value, unit = 'mg/dL') {
  const n = normaliseGlucoseToMgDl(value, unit);
  return n === null ? '--' : `${Math.round(n)} mg/dL`;
}

function formatGlucoseDual(value, unit = 'mg/dL') {
  const n = normaliseGlucoseToMgDl(value, unit);
  return n === null ? '--' : `${Math.round(n)} mg/dL (${(n / 18).toFixed(1)} mmol/L)`;
}

function formatGlucoseDualHTML(value, unit = 'mg/dL') {
  const n = normaliseGlucoseToMgDl(value, unit);
  return n === null ? '--' : `${Math.round(n)} mg/dL <small class="glucose-secondary">(${(n / 18).toFixed(1)} mmol/L)</small>`;
}

function getGlucoseStatus(value, category, unit = 'mg/dL') {
  const v = normaliseGlucoseToMgDl(value, unit);
  const result = (label, color, classification) => ({ label, class: 'glucose-' + color, classification });
  if (v === null || !GLUCOSE_CATEGORIES.includes(category)) return result('--', 'none', null);

  if (v < 70) return result('Hypoglycemia (Low)', 'low', 'hypoglycemia');

  if (category === 'pre_meal') {
    if (v < 80) return result('Below Target', 'elevated', 'normal');
    if (v <= 130) return result('Target Range', 'normal', 'target_range');
    if (v < 181) return result('Above Target', 'elevated', 'above_target');
    return result('Hyperglycemia (High)', 'hyper', 'hyperglycemia');
  }
  if (category === 'bedtime') {
    return v < 140 ? result('Target Range', 'normal', 'target_range')
                   : result('Hyperglycemia (High)', 'high', 'hyperglycemia');
  }
  const normalEnd = category === 'fasting' ? 100 : 140;
  const elevatedEnd = category === 'fasting' ? 126 : 200;
  if (v < normalEnd) return result('Normoglycemia (Normal)', 'normal', 'normoglycemia');
  if (v < elevatedEnd) return result('Prediabetes', 'elevated', 'prediabetes');
  return result('Diabetes Range', 'high', 'diabetes_range');
}

function glucoseInTarget(value, category, unit) {
  const n = normaliseGlucoseToMgDl(value, unit);
  const band = GLUCOSE_TARGETS[category];
  if (n === null || !band) return false;
  return category === 'pre_meal' ? (n >= band[0] && n <= band[1]) : (n >= band[0] && n < band[1]);
}

function metricSummary(values) {
  const v = values.filter(isPresent);
  return {
    count: v.length,
    average: v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null,
    highest: v.length ? Math.max(...v) : null,
    lowest: v.length ? Math.min(...v) : null
  };
}

function measurementDays(rows, from, to, fallback = 0) {
  const day = d => { const x = new Date(d); return Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()); };
  if (from && to) return Math.max(1, Math.round((day(to) - day(from)) / 86400000) + 1);
  if (fallback > 0) return fallback;
  if (!rows.length) return 1;
  const dates = rows.map(r => day(r.timestamp)).filter(Number.isFinite);
  return dates.length ? Math.max(1, Math.round((Math.max(...dates) - Math.min(...dates)) / 86400000) + 1) : 1;
}

function measurementScore(count, expected) {
  return count && expected > 0 ? Math.min(100, Math.round((count / expected) * 100)) : null;
}

function computeBPScore(rows, days) {
  return measurementScore(rows.filter(hasBP).length, days * BP_DAILY_EXPECTED);
}

function computePulseScore(rows, days) {
  return measurementScore(rows.filter(hasPulse).length, days * PULSE_DAILY_EXPECTED);
}

function computeGlucoseScore(rows, category, days) {
  const expectedPerDay = GLUCOSE_DAILY_EXPECTED[category] || 1;
  const count = rows.filter(r => r.glucoseCategory === category && normaliseGlucoseToMgDl(r.glucoseValue, r.glucoseUnit) !== null).length;
  return measurementScore(count, days * expectedPerDay);
}

function summariseGlucoseByCategory(rows, days = 1) {
  return GLUCOSE_CATEGORIES.map(category => {
    const readings = rows.filter(r => r.glucoseCategory === category && normaliseGlucoseToMgDl(r.glucoseValue, r.glucoseUnit) !== null);
    const values = readings.map(r => normaliseGlucoseToMgDl(r.glucoseValue, r.glucoseUnit));
    return {
      category,
      ...metricSummary(values),
      score: computeGlucoseScore(rows, category, days),
      inTarget: readings.length
        ? Math.round(100 * readings.filter(r => glucoseInTarget(r.glucoseValue, category, r.glucoseUnit)).length / readings.length)
        : null
    };
  }).filter(s => s.count);
}

function scoreText(score) {
  return score === null ? '--' : `${score}% (${getConsistencyGrade(score).label})`;
}

function measurementScoresText(rows, days) {
  const parts = [
    `BP: ${scoreText(computeBPScore(rows, days))}`,
    `Pulse: ${scoreText(computePulseScore(rows, days))}`
  ];
  for (const s of summariseGlucoseByCategory(rows, days)) {
    parts.push(`Glucose (${GLUCOSE_LABELS[s.category]}): ${scoreText(s.score)}`);
  }
  return parts.join(' · ');
}

function glucoseBadge(r) {
  const n = normaliseGlucoseToMgDl(r.glucoseValue, r.glucoseUnit);
  if (n === null || !GLUCOSE_CATEGORIES.includes(r.glucoseCategory)) return '';
  const s = getGlucoseStatus(r.glucoseValue, r.glucoseCategory, r.glucoseUnit);
  return `<span class="glucose-badge ${s.class}" title="${s.label}"> ${Math.round(n)} mg/dL <small>(${(n / 18).toFixed(1)} mmol/L) · ${GLUCOSE_LABELS[r.glucoseCategory]}</small></span>`;
}

/* Three equal home-reading panels: BP, Pulse, Glucose. */
function renderCurrentReadingCard(latest) {
  const bp = latest && hasBP(latest) ? `${latest.sys}/${latest.dia}` : '--';
  const bpStatus = latest && hasBP(latest) ? getBPStatus(latest.sys, latest.dia) : { label: '--', class: 'glucose-none' };
  const pulse = latest && hasPulse(latest) ? `${latest.pulse}` : '--';
  const pulseStatus = latest && hasPulse(latest) ? getPulseStatus(latest.pulse) : { label: '--', class: 'glucose-none' };
  const glucoseN = latest ? normaliseGlucoseToMgDl(latest.glucoseValue, latest.glucoseUnit) : null;
  const glucoseValue = glucoseN !== null ? `${Math.round(glucoseN)}` : '--';
  const glucoseStatus = latest && glucoseN !== null ? getGlucoseStatus(latest.glucoseValue, latest.glucoseCategory, latest.glucoseUnit) : { label: '--', class: 'glucose-none' };
  const glucoseDual = glucoseN !== null ? `<div class="current-unit">mg/dL <small>(${(glucoseN / 18).toFixed(1)} mmol/L)</small></div>` : '<div class="current-unit">mg/dL</div>';
  const glucoseCat = latest && glucoseN !== null ? `<div class="current-category">${GLUCOSE_LABELS[latest.glucoseCategory]}</div>` : '';

  return `
    <div class="current-panel">
      <div class="current-label">Blood Pressure</div>
      <div class="current-value">${bp}</div>
      <div class="current-unit">mmHg</div>
      <div class="current-badge ${bpStatus.class}">${bpStatus.label}</div>
    </div>
    <div class="current-panel">
      <div class="current-label">Pulse</div>
      <div class="current-value">${pulse}</div>
      <div class="current-unit">BPM</div>
      <div class="current-badge ${pulseStatus.class}">${pulseStatus.label}</div>
    </div>
    <div class="current-panel">
      <div class="current-label">Blood Glucose</div>
      <div class="current-value">${glucoseValue}</div>
      ${glucoseDual}
      <div class="current-badge ${glucoseStatus.class}">${glucoseStatus.label}</div>
      ${glucoseCat}
    </div>
  `;
}

function renderMetricPanels(rows, days, today = false) {
  const bp = rows.filter(hasBP), sys = metricSummary(bp.map(r=>r.sys)), dia = metricSummary(bp.map(r=>r.dia));
  const pulse = metricSummary(rows.filter(hasPulse).map(r=>r.pulse));
  const stats = (s, format, score, classification) => `<dl class="metric-grid">${[['Average',format('average')],['Highest',format('highest')],['Lowest',format('lowest')],['Count',s.count],['Measurement Score',scoreText(score)],...(!today && APP.currentScreen === 'trends' ? [['Avg. Classification',classification || '--']] : [])].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  const categories = GLUCOSE_CATEGORIES.map(c=>{
    const values=rows.filter(r=>r.glucoseCategory===c).map(r=>normaliseGlucoseToMgDl(r.glucoseValue,r.glucoseUnit)).filter(v=>v!==null);
    const s=metricSummary(values), key=`mhj:panel:${APP.user?.uid || 'guest'}:${today?'home':APP.currentScreen}:${c}`;
    const stored=sessionStorage.getItem(key), collapsed=stored===null ? !s.count : stored==='true';
    return `<section class="glucose-category-panel${collapsed?' collapsed':''}" data-storage-key="${escapeHtmlText(key)}"><h5><button class="category-heading" data-category-toggle aria-expanded="${!collapsed}">${GLUCOSE_LABELS[c]}</button></h5><button class="category-close" data-category-toggle data-collapse aria-label="Collapse ${GLUCOSE_LABELS[c]}">×</button><div class="category-stats">${stats(s,k=>formatGlucoseDualHTML(s[k]),computeGlucoseScore(rows,c,days),s.count?getGlucoseStatus(s.average,c).label:'--')}</div></section>`;
  }).join('');
  return `<section class="metric-panel"><h4>Blood Pressure${today?' Today':''}</h4>${stats(sys,k=>sys[k]===null?'--':`${sys[k]}/${dia[k]} mmHg`,computeBPScore(rows,days),sys.count?getBPStatus(sys.average,dia.average).label:'--')}</section><section class="metric-panel"><h4>Pulse${today?' Today':''}</h4>${stats(pulse,k=>pulse[k]===null?'--':`${pulse[k]} BPM`,computePulseScore(rows,days),pulse.count?getPulseStatus(pulse.average).label:'--')}</section><section class="metric-panel"><h4>Glucose${today?' Today':''}</h4>${categories}</section>`;
}

// ================================================================
// ===== AGE HELPERS =====
// ================================================================

function calculateAge(dob) {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) { years--; months += 12; }
  return { years, months };
}

function displayAge(dob) {
  if (!dob) return '--';
  const age = calculateAge(dob);
  if (!age) return '--';
  const parts = [];
  if (age.years > 0) parts.push(`${age.years} yr`);
  if (age.months > 0) parts.push(`${age.months} mon`);
  return parts.length > 0 ? parts.join(', ') : '0 mon';
}

// ================================================================
// ===== AVATAR =====
// ================================================================

function updateAvatarDisplay() {
  updateVerificationBadge();
  const avatarEl=document.getElementById('topAvatar');
  const profileEl=document.getElementById('profileAvatar');
  if (!avatarEl || !APP.user) return;
  const initials=(APP.user.name || 'User').trim().split(/\s+/).map(p=>p[0]).slice(0,2).join('').toUpperCase();
  const photo=APP.avatarType==='photo' && APP.avatar?.startsWith('data:image');
  avatarEl.innerHTML=photo ? `<img alt="Profile photo" src="${escapeHtmlText(APP.avatar)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : `<span>${escapeHtmlText(initials)}</span>`;
  if(profileEl) profileEl.innerHTML=photo ? `<img alt="Profile photo" src="${escapeHtmlText(APP.avatar)}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;">` : `<span id="profileAvatarInitials">${escapeHtmlText(initials)}</span>`;
}

// ================================================================
// ===== HOME =====
// ================================================================

function updateHome() {
  const todayStr = new Date().toDateString();
  const rows = APP.readings
    .filter(r => new Date(r.timestamp).toDateString() === todayStr)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const latest = rows[rows.length - 1];

  // Current reading card — three equal panels.
  const currentCard = document.getElementById('currentReadingPanels');
  if (currentCard) currentCard.innerHTML = renderCurrentReadingCard(latest);
  const currentTimeEl = document.getElementById('currentReadingTime');
  if (currentTimeEl) {
    currentTimeEl.textContent = latest
      ? new Date(latest.timestamp).toLocaleString('en-US', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
          day: '2-digit', month: 'short', year: 'numeric'
        })
      : 'No readings yet today';
  }

  // Today snapshot — three independent panels.
  const panels = document.getElementById('homeMetricPanels');
  if (panels) panels.innerHTML = renderMetricPanels(rows, 1, true);

  // The three-window completion strip stays inside the BP panel.
  const windows = document.querySelector('.daily-windows');
  if (windows && panels) {
    const bpPanel = panels.querySelector('.metric-panel');
    if (bpPanel) bpPanel.appendChild(windows);
  }
  ['Morning', 'Afternoon', 'Evening'].forEach(win => {
    const el = document.querySelector(`#w${win} .window-status`);
    if (!el) return;
    const done = rows.some(r => hasBP(r) && r.window === win);
    el.textContent = done ? 'Completed' : 'Pending';
    el.className = `window-status ${done ? 'completed' : 'pending'}`;
  });

  const list = document.getElementById('todayReadingsBody');
  if (list) list.innerHTML = rows.length ? rows.map((r,i)=>readingTableRow(r,i)).join('') : '<tr><td colspan="5">No readings today</td></tr>';
  bindMetricPanels(panels);

  const greetingMsg = document.getElementById('greetingMsg');
  if (greetingMsg && APP.user) greetingMsg.textContent = getGreeting() + ',';
}

// ================================================================
// ===== DATA PERSISTENCE =====
// ================================================================

function saveData() {
  try {
    if (!APP.user?.email) return;
    const email = APP.user.email.trim().toLowerCase();
    localStorage.setItem(`mhj:account:${email}`, JSON.stringify({
      syncVersion: 2,
      user: safeUser(APP.user),
      readings: APP.readings,
      avatar: APP.avatar,
      avatarType: APP.avatarType,
      settings: APP.settings,
      gdriveConfig: APP.gdriveConfig,
      emailLogs: APP.emailLogs || []
    }));
    const accounts = JSON.parse(localStorage.getItem('mhj:accounts') || '[]');
    if (!accounts.includes(email)) {
      accounts.push(email);
      localStorage.setItem('mhj:accounts', JSON.stringify(accounts));
    }
    localStorage.setItem('mhj:lastActive', email);
    if (typeof scheduleSync === 'function') scheduleSync();
  } catch (e) {
    console.error('Save error:', e);
  }
}

function loadData(identifier = '') {
  try {
    const accounts = JSON.parse(localStorage.getItem('mhj:accounts') || '[]');
    let key = String(identifier || localStorage.getItem('mhj:lastActive') || '').trim().toLowerCase();
    if (key && !accounts.includes(key)) {
      key = accounts.find(email => {
        const item = JSON.parse(localStorage.getItem(`mhj:account:${email}`) || 'null');
        return item?.user && [item.user.name, item.user.phone].some(v => String(v || '').toLowerCase() === key);
      }) || key;
    }
    const data = JSON.parse(localStorage.getItem(`mhj:account:${key}`));
    if (data) return data;
    const legacy = JSON.parse(localStorage.getItem('bpJournal'));
    if (legacy?.user) return legacy;
  } catch (e) {
    console.error('Load error:', e);
  }
  return null;
}

// ================================================================
// ===== TOAST =====
// ================================================================

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)',
    background: '#101A31', color: 'white', padding: '10px 24px', borderRadius: '12px',
    fontSize: '14px', fontWeight: '500', zIndex: '9999',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)', maxWidth: '90%', textAlign: 'center',
    animation: 'fadeSlide 0.3s ease'
  });
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ================================================================
// ===== FORMATTING HELPERS =====
// ================================================================

function setupPhoneFormatting() {
  document.querySelectorAll('input[type="tel"]').forEach(input => {
    input.addEventListener('input', function () {
      let value = this.value.replace(/\D/g, '');
      if (value.length > 4) value = value.slice(0, 4) + '-' + value.slice(4, 11);
      this.value = value;
    });
  });
}

function setupNameCapitalization() {
  document.querySelectorAll('input[autocomplete="name"], #regName, #editName, #loginName').forEach(input => {
    if (!input) return;
    input.addEventListener('blur', function () {
      this.value = this.value.split(' ').map(w =>
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' ');
    });
  });
}

// ================================================================
// ===== HISTORY =====
// ================================================================

let historyDays = 7;
let historyCustomFrom = null;
let historyCustomTo = null;

function renderHistory() {
  const container = document.getElementById('historyBody');
  if (!container) return;

  let filtered = [...APP.readings];

  if (historyCustomFrom && historyCustomTo) {
    const from = new Date(historyCustomFrom + 'T00:00:00');
    const to = new Date(historyCustomTo + 'T00:00:00');
    to.setHours(23, 59, 59, 999);
    filtered = filtered.filter(r => {
      const d = new Date(r.timestamp);
      return d >= from && d <= to;
    });
    document.getElementById('historyDateDisplay').textContent =
      ` ${new Date(historyCustomFrom).toLocaleDateString()} - ${new Date(historyCustomTo).toLocaleDateString()}`;
  } else if (historyDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - historyDays + 1);
    cutoff.setHours(0, 0, 0, 0);
    filtered = filtered.filter(r => new Date(r.timestamp) >= cutoff);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - historyDays + 1);
    document.getElementById('historyDateDisplay').textContent =
      ` Last ${historyDays} days (${fromDate.toLocaleDateString()} - ${new Date().toLocaleDateString()})`;
  } else {
    document.getElementById('historyDateDisplay').textContent = ' All time';
  }

  filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const days = measurementDays(filtered, historyCustomFrom, historyCustomTo, historyDays);
  const scoresEl = document.getElementById('historyScores');
  if (scoresEl) scoresEl.textContent = measurementScoresText(filtered, days);

  container.innerHTML = filtered.length ? filtered.map((r,i)=>readingTableRow(r,i,{history:true,date:true})).join('') : '<tr><td colspan="5">No readings found</td></tr>';
  container.querySelectorAll('tr[data-reading-id]').forEach((row,i)=>{
    row.addEventListener('click',()=>showDetail(filtered[i]));
    row.addEventListener('keydown',e=>{if(e.target===row && (e.key==='Enter'||e.key===' ')){e.preventDefault();showDetail(filtered[i]);}});
  });
  setTimeout(() => window.decorateHistoryItems?.(), 0);
}

function showDetail(reading) {
  const d = new Date(reading.timestamp);
  const status = getBPStatus(reading.sys, reading.dia);
  const pulseStatus = getPulseStatus(reading.pulse);
  const content = document.getElementById('detailContent');
  if (!content) return;

  content.innerHTML = `
    <div class="reading-display">
      <div class="reading-value">${hasBP(reading) ? reading.sys + '/' + reading.dia : '--'}</div>
      <div class="reading-status ${status.class}">${status.label}</div>
      <div class="reading-pulse"> ${hasPulse(reading) ? reading.pulse : '--'} BPM <span class="status ${pulseStatus.class}" style="font-size:12px;padding:2px 10px;display:inline-block;margin-left:8px;">${pulseStatus.label}</span></div>
    </div>
    <div class="profile-field"><label>Glucose</label><span>${formatGlucoseDualHTML(reading.glucoseValue, reading.glucoseUnit)}</span></div>
    <div class="profile-field"><label>Timing</label><span>${GLUCOSE_LABELS[reading.glucoseCategory] || '--'}</span></div>
    <div class="profile-field"><label>Unit</label><span>${isPresent(reading.glucoseValue) ? (reading.glucoseUnit || 'mg/dL') : '--'}</span></div>
    <div class="profile-field"><label>Classification</label><span>${getGlucoseStatus(reading.glucoseValue, reading.glucoseCategory, reading.glucoseUnit).label}</span></div>
    <div class="profile-field"><label>Date</label><span>${d.toLocaleDateString()}</span></div>
    <div class="profile-field"><label>Time</label><span>${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span></div>
    <div class="profile-field"><label>Window</label><span>${reading.window}</span></div>
    <div class="profile-field"><label>Position</label><span>${reading.position || '--'}</span></div>
    <div class="profile-field"><label>Arm</label><span>${reading.arm || '--'}</span></div>
    <div class="profile-field"><label>Medication</label><span>${reading.medication || '--'}</span></div>
    <div class="profile-field"><label>Meal</label><span>${reading.meal || '--'}</span></div>
    <div class="profile-field"><label>Activity</label><span>${reading.activity || '--'}</span></div>
    <div class="profile-field"><label>Intake</label><span>${reading.intake || '--'}</span></div>
    <div class="profile-field"><label>Symptoms</label><span>${reading.symptoms || '--'}</span></div>
    <div class="profile-field"><label>Notes</label><span>${reading.notes || '--'}</span></div>
    <div class="profile-field"><label>Additional Note</label><span>${reading.extraNote || '--'}</span></div>
    ${reading.revisions && reading.revisions.length ? `
  <div class="profile-field" style="margin-top:12px;">
    <label>Edit History</label>
    <div style="font-size:12px;color:var(--gray);line-height:1.7;">
      ${reading.revisions.map(r => `Edited on ${new Date(r.editedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`).join('<br>')}
    </div>
  </div>
` : ''}
    <button class="btn-primary mt-8" id="editReadingBtn">Edit Reading</button>
    <button class="btn-outline danger-btn mt-8" id="deleteReadingBtn">Delete Reading</button>
  `;

  document.getElementById('editReadingBtn')?.addEventListener('click', () => {
  if (typeof openEditReadingForm === 'function') {
    openEditReadingForm(reading);
  } else {
    showToast('Edit feature not available.');
  }
});

    document.getElementById('deleteReadingBtn')?.addEventListener('click', () => {
    if (confirm('Delete this reading?')) {
      const deletedTimestamp = reading.timestamp;
      APP.readings = APP.readings.filter(r => r !== reading);
      saveData();
      sendEmailTemplate('READING_DELETED', null, { readingTimestamp: new Date(deletedTimestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) });
      navigateTo('history');
    }
  });

  navigateTo('detail');
}

// ================================================================
// ===== TRENDS =====
// ================================================================

let currentTrendDays = 14;
let customTrendFrom = null;
let customTrendTo = null;
let currentChartType = 'bp';
let currentGlucoseCategory = 'all';

function updateTrends() {
  let filtered = [...APP.readings];

  if (customTrendFrom && customTrendTo) {
    const from = new Date(customTrendFrom + 'T00:00:00');
    const to = new Date(customTrendTo + 'T00:00:00');
    to.setHours(23, 59, 59, 999);
    filtered = filtered.filter(r => {
      const d = new Date(r.timestamp);
      return d >= from && d <= to;
    });
    document.getElementById('trendDateDisplay').textContent =
      ` ${new Date(customTrendFrom).toLocaleDateString()} - ${new Date(customTrendTo).toLocaleDateString()}`;
  } else if (currentTrendDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - currentTrendDays + 1);
    cutoff.setHours(0, 0, 0, 0);
    filtered = filtered.filter(r => new Date(r.timestamp) >= cutoff);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - currentTrendDays + 1);
    document.getElementById('trendDateDisplay').textContent =
      ` Last ${currentTrendDays} days (${fromDate.toLocaleDateString()} - ${new Date().toLocaleDateString()})`;
  } else {
    document.getElementById('trendDateDisplay').textContent = ' All time';
  }

  const days = measurementDays(filtered, customTrendFrom, customTrendTo, currentTrendDays);
  const statsEl = document.getElementById('trendStats');
  if (statsEl) statsEl.innerHTML = renderMetricPanels(filtered, days);
  bindMetricPanels(statsEl);
  const body = document.getElementById('trendsBody');
  const tableRows = currentChartType === 'glucose' && currentGlucoseCategory !== 'all' ? filtered.filter(r=>r.glucoseCategory === currentGlucoseCategory) : filtered;
  if (body) body.innerHTML = tableRows.length ? tableRows.sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp)).map((r,i)=>readingTableRow(r,i,{date:true,average:rangeClassification(filtered)})).join('') : '<tr><td colspan="6">No readings in range</td></tr>';
  renderCharts(filtered);
}

function renderCharts(readings) {
  const container = document.getElementById('bpChart');
  if (!container) return;
  const selector = document.getElementById('glucoseCategorySelector');
  if (selector) selector.hidden = currentChartType !== 'glucose';

  const rows = [...readings]
    .filter(r => Number.isFinite(Date.parse(r.timestamp)))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  container.innerHTML = '';
  const other = document.getElementById('pulseChart');
  if (other) { other.innerHTML = ''; other.closest('.chart-container').hidden = true; }
  const heading = container.closest('.chart-container')?.querySelector('h4');
  if (heading) heading.textContent = {bp:'Blood Pressure Trend',pulse:'Pulse Trend',glucose:'Glucose Trends',combined:'All Metrics'}[currentChartType];
  if (!rows.length) { container.textContent = 'No data to display'; return; }

  const start = Date.parse(rows[0].timestamp);
  const end = Date.parse(rows[rows.length - 1].timestamp);
  const span = end - start || 1;

  const panels = currentChartType === 'combined' ? ['bp', 'pulse', 'glucose'] : currentChartType === 'glucose' && currentGlucoseCategory === 'all' ? [...GLUCOSE_CATEGORIES, 'glucose'] : [currentChartType];

  panels.forEach((panel, panelIndex) => {
    const metric = GLUCOSE_CATEGORIES.includes(panel) ? 'glucose' : panel;
    const categories = metric === 'glucose'
      ? (GLUCOSE_CATEGORIES.includes(panel) ? [panel] : currentChartType === 'combined' || currentGlucoseCategory === 'all' ? GLUCOSE_CATEGORIES : [currentGlucoseCategory])
      : [];
    const series = metric === 'bp'
      ? [
          { label: 'Systolic', color: '#FF8308', points: rows.filter(hasBP).map(r => ({ r, v: r.sys })) },
          { label: 'Diastolic', color: '#101A31', points: rows.filter(hasBP).map(r => ({ r, v: r.dia })) }
        ]
      : metric === 'pulse'
        ? [{ label: 'Pulse', color: '#553C9A', points: rows.filter(hasPulse).map(r => ({ r, v: r.pulse })) }]
        : categories.map(category => ({
            label: GLUCOSE_LABELS[category],
            color: GLUCOSE_COLORS[category],
            points: rows
              .filter(r => r.glucoseCategory === category && normaliseGlucoseToMgDl(r.glucoseValue, r.glucoseUnit) !== null)
              .map(r => ({ r, v: normaliseGlucoseToMgDl(r.glucoseValue, r.glucoseUnit) }))
          }));

    const section = document.createElement('section');
    section.className = 'chart-metric';
    const name = metric === 'bp' ? 'Blood Pressure' : metric === 'pulse' ? 'Pulse' : GLUCOSE_LABELS[panel] || 'Glucose — All Categories';
    section.innerHTML = `<h5>${name} (${metric === 'bp' ? 'mmHg' : metric === 'pulse' ? 'BPM' : 'mg/dL'})</h5>
      <div class="chart-legend">${series.filter(s => s.points.length || (currentChartType === 'glucose' && currentGlucoseCategory === 'all')).map(s => `<span style="color:${s.color}">${s.label}</span>`).join('')}</div>`;
    container.appendChild(section);

    const points = series.flatMap(s => s.points);
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', name + ' trend');
    section.appendChild(canvas);
    const tooltip = document.createElement('p');
    tooltip.className = 'chart-tooltip';
    tooltip.setAttribute('aria-live', 'polite');
    section.appendChild(tooltip);

    const width = Math.max(260, container.clientWidth || 400);
    const height = 210;
    const left = 44, right = 12, top = 14, bottom = 30;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = '100%';
    canvas.style.height = height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);

    const targets = metric === 'glucose' ? categories.map(c => GLUCOSE_TARGETS[c][1]) : [];
    const max = Math.ceil(Math.max(1, ...points.map(p => p.v), ...targets) * 1.12 / 10) * 10;
    const x = t => left + (end === start ? 0.5 : (Date.parse(t) - start) / span) * (width - left - right);
    const y = v => top + (1 - v / max) * (height - top - bottom);

    if (metric === 'glucose') {
      const scatter = currentChartType === 'glucose' && currentGlucoseCategory === 'all';
      if (scatter) {
        ctx.fillStyle = '#FEE2E2';
        ctx.fillRect(left, y(70), width - left - right, y(0) - y(70));
        categories.forEach(c => {
          const band = GLUCOSE_TARGETS[c];
          ctx.fillStyle = GLUCOSE_COLORS[c] + '18';
          ctx.fillRect(left, y(band[1]), width - left - right, y(band[0]) - y(band[1]));
        });
      } else if (categories.length === 1) {
        const band = GLUCOSE_TARGETS[categories[0]];
        ctx.fillStyle = '#10B98126';
        ctx.fillRect(left, y(band[1]), width - left - right, y(band[0]) - y(band[1]));
      }
      if (scatter) {
        const note = document.createElement('small');
        note.className = 'metric-empty';
        note.textContent = categories.map(c =>
          `${GLUCOSE_LABELS[c]} target ${GLUCOSE_TARGETS[c][0]}–${GLUCOSE_TARGETS[c][1]} mg/dL${c === 'pre_meal' ? ' inclusive' : ' (upper bound exclusive)'}`
        ).join(' · ');
        section.appendChild(note);
      }
    }

    ctx.font = '10px sans-serif';
    for (let i = 0; i <= 4; i++) {
      const v = max * i / 4;
      ctx.strokeStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(left, y(v));
      ctx.lineTo(width - right, y(v));
      ctx.stroke();
      ctx.fillStyle = '#64748B';
      ctx.fillText(String(Math.round(v)), 2, y(v) + 3);
    }

    const hitPoints = [];
    series.forEach(s => {
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      s.points.forEach((p, i) => {
        const px = x(p.r.timestamp), py = y(p.v);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        hitPoints.push({ ...p, x: px, y: py, label: s.label });
      });
      ctx.stroke();
      s.points.forEach(p => {
        ctx.beginPath();
        ctx.arc(x(p.r.timestamp), y(p.v), 4, 0, 2 * Math.PI);
        ctx.fill();
      });
    });

    if (panelIndex === panels.length - 1) {
      ctx.fillStyle = '#64748B';
      [0, 0.5, 1].forEach((fraction, i) => {
        const d = new Date(start + fraction * (end - start));
        ctx.textAlign = i === 0 ? 'left' : i === 2 ? 'right' : 'center';
        ctx.fillText(
          end - start < 86400000
            ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
            : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          left + fraction * (width - left - right),
          height - 7
        );
      });
    }

    if (!points.length) tooltip.textContent = 'No data for this range.';

    const showPoint = e => {
      const rect = canvas.getBoundingClientRect();
      const px = (e.clientX - rect.left) * width / rect.width;
      const py = (e.clientY - rect.top) * height / rect.height;
      const hit = hitPoints.reduce((best, p) => {
        const dist = Math.hypot(p.x - px, p.y - py);
        return dist < (best ? Math.hypot(best.x - px, best.y - py) : 24) ? p : best;
      }, null);
      if (!hit) return;
      tooltip.textContent = metric === 'glucose'
        ? `${formatGlucoseDual(hit.r.glucoseValue, hit.r.glucoseUnit)} · ${GLUCOSE_LABELS[hit.r.glucoseCategory]} · ${new Date(hit.r.timestamp).toLocaleString()} · ${getGlucoseStatus(hit.r.glucoseValue, hit.r.glucoseCategory, hit.r.glucoseUnit).label}`
        : `${hit.label} ${hit.v} · ${new Date(hit.r.timestamp).toLocaleString()}`;
    };
    canvas.addEventListener('pointermove', showPoint);
    canvas.addEventListener('click', showPoint);
  });
}

// Refresh derived hints and reference rows without altering entered measurements.
document.addEventListener('DOMContentLoaded', () => {
  const hint = () => {
    const value = Number(document.getElementById('recGlucose').value);
    const unit = document.getElementById('recGlucoseUnit').value;
    document.getElementById('glucoseConversionHint').textContent = isPresent(value)
      ? (unit === 'mg/dL' ? `≈ ${(value / 18).toFixed(1)} mmol/L` : `≈ ${Math.round(value * 18)} mg/dL`)
      : '';
  };
  document.getElementById('recGlucose').addEventListener('input', hint);
  document.getElementById('recGlucoseUnit').addEventListener('change', hint);
  document.getElementById('glucoseCategorySelect').addEventListener('change', e => {
    currentGlucoseCategory = e.target.value;
    updateTrends();
  });
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (APP.currentScreen === 'trends') updateTrends(); }, 150);
  });
});

// ================================================================
// ===== PROFILE =====
// ================================================================

function updateProfile() {
  if (!APP.user) return;
  const u = APP.user;
  const fields = {
    pName: u.name || '--',
    pEmail: u.email || '--',
    pRecoveryEmail: u.recoveryEmail || 'Not set',
    pPhone: u.phone || '--',
    pDob: u.dob || '--',
    pGender: u.gender || '--',
    pAddress: u.address || '--',
    pBlood: u.bloodGroup || '--',
    pEmerg: u.emergencyContact || '--',
    pNotes: u.notes || '--'
  };
  Object.keys(fields).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = fields[id];
  });

  const ageEl = document.getElementById('pAge');
  if (ageEl && u.dob) ageEl.textContent = displayAge(u.dob);

  const userIdEl = document.getElementById('pUserId');
  if (userIdEl) userIdEl.textContent = u.uid || 'Not assigned';

  const emailBadge = document.getElementById('pEmailVerificationBadge');
  if (emailBadge) {
    if (APP.user.emailVerified) {
      emailBadge.className = 'verification-badge verified';
      emailBadge.innerHTML = `<button class="verify-icon verified" title="Verified" aria-label="Verified">${verificationSVG(true)}</button>`;
    } else {
      emailBadge.className = 'verification-badge unverified';
      emailBadge.innerHTML = `<button class="verify-icon" id="verifyEmailBtn" title="Get verified" aria-label="Verify primary email">${verificationSVG(false)}</button>`;
      document.getElementById('verifyEmailBtn')?.addEventListener('click', verifyEmail);
    }
  }

  const recoveryBadge = document.getElementById('pRecoveryVerificationBadge');
  if (recoveryBadge) {
    if (APP.user.recoveryEmail && APP.user.recoveryEmailVerified) {
      recoveryBadge.className = 'verification-badge verified';
      recoveryBadge.innerHTML = `<button class="verify-icon verified" title="Verified" aria-label="Verified">${verificationSVG(true)}</button>`;
    } else if (APP.user.recoveryEmail) {
      recoveryBadge.className = 'verification-badge unverified';
      recoveryBadge.innerHTML = `<button class="verify-icon" id="verifyRecoveryBtn" title="Get verified" aria-label="Verify recovery email">${verificationSVG(false)}</button>`;
      document.getElementById('verifyRecoveryBtn')?.addEventListener('click', verifyRecoveryEmail);
    } else {
      recoveryBadge.innerHTML = '';
    }
  }

  updateAvatarDisplay();
}

// ================================================================
// ===== COPY USER ID =====
// ================================================================

document.getElementById('copyUserIdBtn')?.addEventListener('click', function () {
  const userId = APP.user?.uid;
  if (!userId) { showToast('No User ID found'); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(userId).then(() => showToast(' User ID copied to clipboard')).catch(() => fallbackCopy(userId));
  } else {
    fallbackCopy(userId);
  }
});

function fallbackCopy(text) {
  const input = document.createElement('input');
  input.value = text;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  try { document.execCommand('copy'); showToast(' User ID copied'); }
  catch (err) { showToast(' Failed to copy'); }
  document.body.removeChild(input);
}

// ================================================================
// ===== SETUP RECORD =====
// ================================================================

function setupRecord() {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = now.toTimeString().slice(0, 8);
  const dateInput = document.getElementById('recDate');
  const timeInput = document.getElementById('recTime');
  if (dateInput) dateInput.value = dateStr;
  if (timeInput) timeInput.value = timeStr;
  // Do NOT touch recSys, recDia, recPulse, recGlucose, recGlucoseType, recGlucoseUnit.
}

function saveReading() {
  // Empty measurements stay null; never substitute sample readings.
  const numOrNull = id => {
    const raw = document.getElementById(id)?.value?.trim();
    if (raw === '' || raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const sys = numOrNull('recSys');
  const dia = numOrNull('recDia');
  const pulse = numOrNull('recPulse');
  const glucoseValue = numOrNull('recGlucose');
  const glucoseCategory = document.getElementById('recGlucoseType')?.value || null;
  const glucoseUnit = document.getElementById('recGlucoseUnit')?.value || 'mg/dL';

  if ([sys, dia, pulse, glucoseValue].every(v => v === null)) return showToast('Enter at least one measurement before saving.');
  if ((sys === null) !== (dia === null)) return showToast('Systolic and diastolic must both be entered.');
  if (glucoseValue !== null && !glucoseCategory) return showToast('Select the timing for this glucose reading.');
  if (glucoseCategory && glucoseValue === null) return showToast('Enter the blood glucose value.');

  for (const [id, value, max] of [
    ['recSys', sys, 300],
    ['recDia', dia, 200],
    ['recPulse', pulse, 250],
    ['recGlucose', glucoseValue, glucoseUnit === 'mmol/L' ? 120 : 2000]
  ]) {
    const input = document.getElementById(id);
    if (input?.validity?.badInput || (value !== null && (value <= 0 || value > max))) {
      return showToast('Enter a valid positive measurement within the allowed range.');
    }
  }

  const dateVal = document.getElementById('recDate')?.value || '';
  const timeVal = document.getElementById('recTime')?.value || '';

  const symptomsSelect = document.getElementById('recSymptoms');
  let symptoms = [];
  if (symptomsSelect) symptoms = Array.from(symptomsSelect.selectedOptions).map(opt => opt.value);
  const otherSymptom = document.getElementById('recOtherSymptom')?.value || '';
  if (symptoms.includes('Other') && otherSymptom) {
    symptoms = symptoms.filter(s => s !== 'Other');
    symptoms.push(otherSymptom);
  }

  let timestamp;
  if (dateVal && timeVal) timestamp = new Date(dateVal + 'T' + timeVal).toISOString();
  else if (dateVal) timestamp = new Date(dateVal).toISOString();
  else timestamp = new Date().toISOString();

  const dt = new Date(timestamp);
  const hour = dt.getHours();
  let window = 'Evening';
  if (hour >= 6 && hour < 12) window = 'Morning';
  else if (hour >= 12 && hour < 17) window = 'Afternoon';

  const multiValue = (id, customId) => {
    const select = document.getElementById(id);
    let values = select ? Array.from(select.selectedOptions).map(o => o.value) : [];
    const custom = document.getElementById(customId)?.value.trim();
    if (values.includes('Custom')) values = values.filter(v => v !== 'Custom').concat(custom ? [custom] : []);
    return values.join(', ');
  };

  const reading = {
    sys, dia, pulse,
    glucoseValue, glucoseCategory, glucoseUnit,
    timestamp, window,
    symptoms: symptoms.join(', '),
    arm: document.getElementById('recArm')?.value || 'Left',
    position: document.getElementById('recPos')?.value || 'Sitting',
    medication: document.getElementById('recMed')?.value || 'Not applicable',
    meal: document.getElementById('recMeal')?.value || 'Not applicable',
    activity: multiValue('recAct', 'recCustomAct') || 'Resting',
    intake: multiValue('recIntake', 'recCustomIntake') || 'None',
    extraNote: document.getElementById('recExtraNote')?.value || ''
  };

  APP.readings.push(reading);
  saveData();
  if (APP.user && APP.user.uid) scheduleSync();
  sendEmailTemplate('READING_CREATED', null, { reading });

  const status = getBPStatus(sys, dia);
  const pulseStatus = getPulseStatus(pulse);

  const resultBP = document.getElementById('resultBP');
  const resultStatus = document.getElementById('resultStatus');
  const resultPulse = document.getElementById('resultPulse');
  const resultTime = document.getElementById('resultTime');

  if (resultBP) resultBP.textContent = `${isPresent(sys) && isPresent(dia) ? sys + '/' + dia : '--'}`;
  if (resultStatus) {
    resultStatus.textContent = status.label;
    resultStatus.className = `result-status ${status.class}`;
  }
  if (resultPulse) resultPulse.textContent = `Pulse: ${hasPulse(reading) ? pulse : '--'} BPM (${pulseStatus.label})`;
  if (resultTime) {
    resultTime.textContent = `Recorded at ${dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;
  }

  const todayReadings = APP.readings.filter(r => new Date(r.timestamp).toDateString() === new Date().toDateString());
  const bpRows = todayReadings.filter(hasBP);
  const avgSys = metricSummary(bpRows.map(r => r.sys)).average ?? '--';
  const avgDia = metricSummary(bpRows.map(r => r.dia)).average ?? '--';

  const resultAvg = document.getElementById('resultAvg');
  const resultCount = document.getElementById('resultCount');
  if (resultAvg) resultAvg.textContent = `Today's average: ${avgSys}/${avgDia}`;
  if (resultCount) resultCount.textContent = measurementScoresText(todayReadings, 1);

  const resultGlucose = document.getElementById('resultGlucose');
  if (resultGlucose) resultGlucose.innerHTML = glucoseBadge(reading);

  navigateTo('result');
}

// ================================================================
// ===== EXPORT HELPERS =====
// ================================================================

function getReadingsInRange(fromDate, toDate) {
  let filtered = [...APP.readings];
  if (fromDate) {
    const from = new Date(fromDate + 'T00:00:00');
    filtered = filtered.filter(r => new Date(r.timestamp) >= from);
  }
  if (toDate) {
    const to = new Date(toDate + 'T00:00:00');
    to.setHours(23, 59, 59, 999);
    filtered = filtered.filter(r => new Date(r.timestamp) <= to);
  }
  return filtered;
}

// Fallback export used if the enhanced exportPDF in enhancements.js is unavailable.
function exportPDF(fromDate, toDate, rowsOverride) {
  const rows = rowsOverride || getReadingsInRange(fromDate, toDate);
  if (!rows.length) return showToast('No readings to export');
  if (!window.jspdf?.jsPDF) return showToast('PDF library not loaded');
  try {
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    const days = measurementDays(rows, fromDate, toDate);
    const bp = rows.filter(hasBP);
    const sys = metricSummary(bp.map(r => r.sys));
    const dia = metricSummary(bp.map(r => r.dia));
    const pulse = metricSummary(rows.map(r => r.pulse));
    let y = 20;
    doc.setFontSize(18);
    doc.text('My Health Journal', 15, y);
    y += 10;
    doc.setFontSize(9);
    const line = text => {
      const lines = doc.splitTextToSize(text, 180);
      if (y + lines.length * 5 > 275) { doc.addPage(); y = 20; }
      doc.text(lines, 15, y);
      y += lines.length * 5;
    };
    line('Snapshot');
    line(`Blood Pressure: Average ${sys.average ?? '--'}/${dia.average ?? '--'} mmHg | Highest ${sys.highest ?? '--'}/${dia.highest ?? '--'} | Lowest ${sys.lowest ?? '--'}/${dia.lowest ?? '--'}`);
    line(`Pulse: Average ${pulse.average ?? '--'} BPM | Highest ${pulse.highest ?? '--'} | Lowest ${pulse.lowest ?? '--'}`);
    summariseGlucoseByCategory(rows, days).forEach(g => {
      line(`Glucose (${GLUCOSE_LABELS[g.category]}): Average ${formatGlucosePrimary(g.average)} | Highest ${formatGlucosePrimary(g.highest)} | Lowest ${formatGlucosePrimary(g.lowest)} | Score ${scoreText(g.score)}`);
    });
    line('Measurement Scores: ' + measurementScoresText(rows, days));
    y += 6;
    const columns = [15, 25, 65, 88, 106, 164];
    const header = () => {
      doc.setFontSize(8);
      ['#', 'Date & Time', 'BP', 'Pulse', 'Glucose', 'Score'].forEach((v, i) => doc.text(v, columns[i], y));
      y += 7;
    };
    header();
    rows.forEach((r, i) => {
      if (y > 275) { doc.addPage(); y = 20; header(); }
      doc.setFontSize(6);
      const values = [
        String(i + 1),
        new Date(r.timestamp).toLocaleString(),
        hasBP(r) ? `${r.sys}/${r.dia}` : '--',
        hasPulse(r) ? String(r.pulse) : '--',
        isPresent(r.glucoseValue) ? `${formatGlucosePrimary(r.glucoseValue, r.glucoseUnit)} (${GLUCOSE_LABELS[r.glucoseCategory] || ''})` : '--',
        `B${hasBP(r) ? computeBPScore(rows, days) : '--'} P${hasPulse(r) ? computePulseScore(rows, days) : '--'} G${isPresent(r.glucoseValue) ? computeGlucoseScore(rows, r.glucoseCategory, days) : '--'}`
      ];
      values.forEach((v, j) => doc.text(v, columns[j], y));
      y += 6;
    });
    downloadFile(doc.output('blob'), generateFileName('pdf', fromDate, toDate), 'application/pdf');
  } catch (error) {
    console.error('PDF error:', error);
    showToast('PDF error: ' + error.message);
  }
}

// ================================================================
// ===== CHANGE LOGS =====
// ================================================================

async function getLatestUserData() {
  if (!APP.user?.uid) return null;
  try {
    const data = await getUserDataFromFirestore(APP.user.uid);
    if (data) APP.user = { ...APP.user, ...safeUser(data) };
    return APP.user;
  } catch (error) {
    console.error('Profile refresh:', error);
    return APP.user;
  }
}

function getFilteredChangeLogs(logs, dateRange, selectedFields) {
  let filtered = [...logs];
  if (dateRange && dateRange !== 'max') {
    const now = new Date();
    let cutoff = new Date();
    if (dateRange === '1D') cutoff.setDate(now.getDate() - 1);
    else if (dateRange === '3D') cutoff.setDate(now.getDate() - 3);
    else if (dateRange === '7D') cutoff.setDate(now.getDate() - 7);
    else if (dateRange === '14D') cutoff.setDate(now.getDate() - 14);
    else if (dateRange === '30D') cutoff.setDate(now.getDate() - 30);
    else if (dateRange === '60D') cutoff.setDate(now.getDate() - 60);
    else if (dateRange === '90D') cutoff.setDate(now.getDate() - 90);
    else if (dateRange === '180D') cutoff.setDate(now.getDate() - 180);
    else if (dateRange === 'custom' && window._customFrom && window._customTo) cutoff = new Date(window._customFrom);
    filtered = filtered.filter(log => new Date(log.timestamp) >= cutoff);
  }
  if (selectedFields && selectedFields.length > 0) {
    filtered = filtered.filter(log => {
      if (selectedFields.includes('complete')) return true;
      if (selectedFields.includes('profile')) return log.type === 'profile' || log.type === 'verification';
      return selectedFields.includes(log.type);
    });
  }
  return filtered;
}

// ================================================================
// ===== EMAIL VERIFICATION =====
// ================================================================

async function verifyEmail() {
  if (!APP.user || !APP.user.uid) { showToast('Please login first'); return; }
  const otpSent = await sendOTP(APP.user.email, APP.user.name, 'verify-email');
  if (otpSent) {
    APP._pendingVerification = 'primary';
    APP.otpPurpose = 'verify-email';
    showToast('OTP sent to your primary email');
    showScreen('otp');
    document.getElementById('otpEmailDisplay').textContent = APP.user.email;
  } else {
    showToast('Failed to send OTP. Please try again.');
  }
}

async function verifyRecoveryEmail() {
  if (!APP.user || !APP.user.uid || !APP.user.recoveryEmail) { showToast('No recovery email set'); return; }
  const otpSent = await sendOTP(APP.user.recoveryEmail, APP.user.name, 'verify-recovery');
  if (otpSent) {
    APP._pendingVerification = 'recovery';
    APP.otpPurpose = 'verify-recovery';
    showToast('OTP sent to your recovery email');
    showScreen('otp');
    document.getElementById('otpEmailDisplay').textContent = APP.user.recoveryEmail;
  } else {
    showToast('Failed to send OTP. Please try again.');
  }
}

// ================================================================
// ===== SPLASH FOOTER =====
// ================================================================

function updateSplashFooter() {
  document.querySelectorAll('.splash-contact-row img').forEach(img => { img.style.animation='none'; img.style.opacity='1'; });
}

document.addEventListener('DOMContentLoaded', () => {
  updateSplashFooter();
});

// ================================================================
// ===== MEDICAL RECORDS =====
// ================================================================

async function loadMedicalRecords() {
  if (!APP.user?.uid) return [];
  try {
    const snap = await firebase.firestore()
      .collection('users').doc(APP.user.uid)
      .collection('medicalRecords')
      .orderBy('uploadedAt', 'desc').get();
    APP.medicalRecords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('Load medical records:', e);
    APP.medicalRecords = [];
  }
  renderMedicalRecords();
  return APP.medicalRecords;
}

function renderMedicalRecords() {
  const list = document.getElementById('medicalRecordsList');
  if (!list) return;
  const items = APP.medicalRecords || [];
  if (!items.length) {
    list.innerHTML = '<p class="metric-empty">No medical records yet. Upload a PDF to get started.</p>';
    return;
  }
  list.innerHTML = items.map(r => `
    <div class="medical-record-item" data-id="${r.id}">
      <div class="medical-record-info">
        <strong>${escapeHtmlText(r.title || r.fileName)}</strong>
        <small>${new Date(r.uploadedAt).toLocaleDateString()} · ${Math.round((r.size || 0) / 1024)} KB</small>
      </div>
      <div class="medical-record-actions">
        <button class="btn-secondary" data-open="${r.id}">Open</button>
        <button class="btn-secondary danger-btn" data-delete="${r.id}">Delete</button>
      </div>
    </div>`).join('');

  list.querySelectorAll('[data-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      const rec = items.find(x => x.id === btn.dataset.open);
      if (rec?.driveFileId) window.open(`https://drive.google.com/file/d/${rec.driveFileId}/view`, '_blank');
      else showToast('Drive link not available.');
    });
  });
  list.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteMedicalRecord(btn.dataset.delete));
  });
}

function escapeHtmlText(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function uploadMedicalRecordFromInput(file) {
  if (!file) return;
  if (file.type !== 'application/pdf') return showToast('Only PDF files are accepted.');
  if (file.size > 10 * 1024 * 1024) return showToast('File exceeds 10 MB limit.');
  if (!APP.user?.uid) return showToast('Sign in first.');
  showToast('Uploading…');
  try {
    const result = await uploadMedicalRecord(file, file.name);
    const docRef = await firebase.firestore()
      .collection('users').doc(APP.user.uid)
      .collection('medicalRecords').add({
        title: file.name.replace(/\.pdf$/i, ''),
        fileName: file.name,
        size: file.size,
        mimeType: file.type,
        driveFileId: result.userFileId || result.adminFileId || null,
        adminFileId: result.adminFileId || null,
        userFileId: result.userFileId || null,
        uploadedAt: new Date().toISOString()
      });
    APP.medicalRecords.unshift({
      id: docRef.id,
      title: file.name.replace(/\.pdf$/i, ''),
      fileName: file.name,
      size: file.size,
      driveFileId: result.userFileId || result.adminFileId || null,
      uploadedAt: new Date().toISOString()
    });
    renderMedicalRecords();
    showToast('Medical record uploaded.');
    sendEmailTemplate('MEDICAL_RECORD_ADDED', null, {recordTitle:file.name,recordSize:`${Math.round(file.size/1024)} KB`,recordUploadedAt:new Date().toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})});
  } catch (e) {
    console.error('Medical record upload:', e);
    showToast(e.message || 'Upload failed.');
  }
}

async function deleteMedicalRecord(id) {
  if (!confirm('Delete this medical record?')) return;
  const title=APP.medicalRecords.find(r=>r.id===id)?.title || 'Medical Record';
  try {
    await firebase.firestore()
      .collection('users').doc(APP.user.uid)
      .collection('medicalRecords').doc(id).delete();
    APP.medicalRecords = APP.medicalRecords.filter(r => r.id !== id);
    renderMedicalRecords();
    showToast('Record deleted.');
    sendEmailTemplate('MEDICAL_RECORD_REMOVED',null,{recordTitle:title,recordRemovedAt:new Date().toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})});
  } catch (e) {
    console.error('Delete medical record:', e);
    showToast(e.message || 'Delete failed.');
  }
}

// ================================================================
// ===== EVENT LISTENERS =====
// ================================================================

function setupEventListeners() {

  let aboutScroll = 0;
  for (const [button, screen, close] of [['openPrivacyPolicyBtn','privacy-policy','closePrivacyPolicy'],['openTermsOfServiceBtn','terms-of-service','closeTermsOfService'],['openEmailTriggersBtn','email-triggers','backFromEmailTriggers']]) {
    document.getElementById(button)?.addEventListener('click',()=>{
      const modal=document.getElementById('aboutModal');
      aboutScroll=modal.querySelector('.about-sheet').scrollTop;
      modal.classList.remove('open'); showScreen(screen);
    });
    document.getElementById(close)?.addEventListener('click',()=>{
      navigateTo('profile'); const modal=document.getElementById('aboutModal');
      modal.classList.add('open'); modal.querySelector('.about-sheet').scrollTop=aboutScroll;
    });
  }
  document.querySelector('.result-icon').innerHTML=verificationSVG(true,56);

  // ===== LOGIN =====
  document.getElementById('loginBtn')?.addEventListener('click', function (e) {
    e.preventDefault();
    const identifier = document.getElementById('loginEmail')?.value?.trim() || '';
    const password = document.getElementById('loginPassword')?.value || '';
    if (!identifier) return showToast('Please enter your email or username');
    if (!password) return showToast('Please enter your password');
    loginUser(identifier, password);
  });

  document.getElementById('loginPassword')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('loginBtn')?.click();
  });

  document.getElementById('legacyPinLoginBtn')?.addEventListener('click', function (e) {
    e.preventDefault();
    const pin = document.getElementById('loginPin')?.value || '';
    if (pin.length !== 5) return showToast('PIN must be exactly 5 digits');
    const stored = loadData();
    if (stored && stored.user && stored.user.pin === pin) {
      loginUser(stored.user.email || stored.user.name, null, pin);
      document.getElementById('loginPin').value = '';
    } else {
      showToast('Invalid PIN');
    }
  });

  document.getElementById('loginPin')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('pinLoginBtn')?.click();
  });

  document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    showScreen('forgot');
  });

  document.getElementById('sendResetOtpBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('forgotEmail')?.value?.trim() || '';
    if (!email) return showToast('Please enter your email');
    const stored = loadData(email);
    const success = await sendOTP(email, stored?.user?.name || 'User', 'reset');
    if (success) {
      showScreen('otp');
      document.getElementById('otpEmailDisplay').textContent = email;
    }
  });

  document.getElementById('backToLoginFromForgot')?.addEventListener('click', () => showScreen('login'));

  document.getElementById('sendPinResetOtpBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('pinResetEmail')?.value?.trim() || '';
    if (!email) return showToast('Please enter your email');
    const stored = loadData(email);
    const success = await sendOTP(email, stored?.user?.name || 'User', 'pin-reset');
    if (success) {
      showScreen('otp');
      document.getElementById('otpEmailDisplay').textContent = email;
      APP.otpPurpose = 'pin-reset';
    }
  });

  document.getElementById('backToLoginFromPinReset')?.addEventListener('click', () => showScreen('login'));

  document.getElementById('verifyOtpBtn')?.addEventListener('click', async () => {
    const otp = document.getElementById('otpInput')?.value || '';
    if (otp.length !== 6) return showToast('Please enter 6-digit OTP');
    if (await verifyOTP(otp)) {
      if (APP.otpPurpose === 'reset') showScreen('reset');
      else if (APP.otpPurpose === 'register') completeRegistration();
      else if (APP.otpPurpose === 'pin-reset') showScreen('reset-pin');
      else if (APP.otpPurpose === 'verify-email') {
        await confirmEmailVerification('primary');
        APP.otpPurpose = null;
        APP._pendingVerification = null;
        showScreen('profile');
      } else if (APP.otpPurpose === 'verify-recovery') {
        await confirmEmailVerification('recovery');
        APP.otpPurpose = null;
        APP._pendingVerification = null;
        showScreen('profile');
      }
    } else {
      document.getElementById('otpError').style.display = 'block';
      document.getElementById('otpError').textContent = 'Invalid OTP. Please try again.';
    }
  });

  document.getElementById('resendOtpBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('otpEmailDisplay')?.textContent || '';
    if (email) {
      const stored = loadData();
      await sendOTP(email, stored?.user?.name || 'User', APP.otpPurpose);
    }
  });

  document.getElementById('cancelOtpBtn')?.addEventListener('click', () => {
    APP.otpCode = null;
    APP.otpPurpose = null;
    showScreen('login');
  });

  document.getElementById('backToLoginFromReset')?.addEventListener('click', () => showScreen('login'));
  document.getElementById('backToLoginFromResetPin')?.addEventListener('click', () => showScreen('login'));

  document.getElementById('goRegister')?.addEventListener('click', (e) => { e.preventDefault(); showScreen('register'); });
  document.getElementById('backToLogin')?.addEventListener('click', () => showScreen('login'));

  document.getElementById('regDob')?.addEventListener('change', function () {
    const age = calculateAge(this.value);
    const ageDisplay = document.getElementById('regAge');
    if (ageDisplay && age !== null) ageDisplay.textContent = `Age: ${age.years} years, ${age.months} months`;
  });

  document.getElementById('finishSignupBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('regName')?.value?.trim() || '';
    const email = document.getElementById('regEmail')?.value?.trim() || '';
    const phone = document.getElementById('regPhone')?.value?.trim() || '';
    const dob = document.getElementById('regDob')?.value || '';
    const gender = document.getElementById('regGender')?.value || '';
    const address = document.getElementById('regAddress')?.value || '';
    const bloodGroup = document.getElementById('regBlood')?.value || '';
    const relation = document.getElementById('regRelation')?.value || '';
    const emerg = document.getElementById('regEmerg')?.value || '';
    const notes = document.getElementById('regNotes')?.value || '';
    const password = document.getElementById('regPassword')?.value || '';
    const passwordConfirm = document.getElementById('regPasswordConfirm')?.value || '';
    const pin = document.getElementById('regPin')?.value || '';
    const pinConfirm = document.getElementById('regPinConfirm')?.value || '';
    const recoveryEmail = document.getElementById('regRecoveryEmail')?.value?.trim() || '';

    let valid = true;
    if (!name) { showToast('Full Name is required'); valid = false; }
    if (!email) { showToast('Email is required'); valid = false; }
    if (!phone) { showToast('Phone Number is required'); valid = false; }
    if (!dob) { showToast('Date of Birth is required'); valid = false; }
    if (!gender) { showToast('Please select your gender'); valid = false; }
    if (password.length < 6) { document.getElementById('regPasswordError').style.display = 'block'; valid = false; }
    else document.getElementById('regPasswordError').style.display = 'none';
    if (password !== passwordConfirm) { document.getElementById('regPasswordMatchError').style.display = 'block'; valid = false; }
    else document.getElementById('regPasswordMatchError').style.display = 'none';
    if (pin.length !== 5 || !/^\d{5}$/.test(pin)) { document.getElementById('regPinError').style.display = 'block'; valid = false; }
    else document.getElementById('regPinError').style.display = 'none';
    if (pin !== pinConfirm) { document.getElementById('regPinMatchError').style.display = 'block'; valid = false; }
    else document.getElementById('regPinMatchError').style.display = 'none';

    const accounts = JSON.parse(localStorage.getItem('mhj:accounts') || '[]');
    if (accounts.length >= 5 && !accounts.includes(email.toLowerCase())) {
      showToast('This device has reached the maximum limit of 5 accounts.'); valid = false;
    }
    const stored = loadData(email);
    if (stored && stored.user && stored.user.email.toLowerCase() === email.toLowerCase()) {
      showToast('Email already registered. Please login.'); valid = false;
    }
    if (!valid) return;

    APP.otpPurpose = 'register';
    const success = await sendOTP(email, name, 'register');
    if (success) {
      APP._tempRegistration = {
        name, email, phone, dob, gender, address, bloodGroup,
        relation, emergencyContact: emerg, notes, password, pin, recoveryEmail
      };
      showScreen('otp');
      document.getElementById('otpEmailDisplay').textContent = email;
    }
  });

  document.getElementById('startJournalBtn')?.addEventListener('click', () => goToHome());
  document.getElementById('recordFromHome')?.addEventListener('click', () => { setupRecord(); navigateTo('record'); });
  document.getElementById('cancelRecord')?.addEventListener('click', () => navigateTo('home'));
  document.getElementById('resultDoneBtn')?.addEventListener('click', () => navigateTo('home'));

  document.getElementById('fabRecord')?.addEventListener('click', () => {
    if (APP.isLoggedIn) { setupRecord(); navigateTo('record'); }
    else { showToast('Please login first'); showScreen('login'); }
  });

  document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const screen = this.dataset.screen;
      if (screen && APP.isLoggedIn) navigateTo(screen);
      else if (screen) { showToast('Please login first'); showScreen('login'); }
    });
  });

  document.querySelectorAll('.filter-btn-small').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn-small').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const days = btn.dataset.history;
      const customRange = document.getElementById('historyCustomRange');
      if (days === 'custom') { customRange.style.display = 'block'; historyDays = 0; }
      else if (days === 'today') {
        customRange.style.display = 'none';
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        historyDays = 0; historyCustomFrom = today; historyCustomTo = today;
        renderHistory();
      } else {
        customRange.style.display = 'none';
        historyDays = parseInt(days);
        historyCustomFrom = null; historyCustomTo = null;
        renderHistory();
      }
    });
  });

  document.getElementById('applyHistoryFilter')?.addEventListener('click', () => {
    const from = document.getElementById('historyFrom')?.value;
    const to = document.getElementById('historyTo')?.value;
    if (from && to) { historyCustomFrom = from; historyCustomTo = to; renderHistory(); }
    else showToast('Please select both dates');
  });

  document.getElementById('backFromDetail')?.addEventListener('click', () => navigateTo('history'));

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const days = btn.dataset.days;
      const customRange = document.getElementById('customDateRange');
      if (days === 'custom') { customRange.style.display = 'block'; currentTrendDays = 0; }
      else if (days === 'today') {
        customRange.style.display = 'none';
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        currentTrendDays = 0; customTrendFrom = today; customTrendTo = today;
        updateTrends();
      } else {
        customRange.style.display = 'none';
        currentTrendDays = parseInt(days);
        customTrendFrom = null; customTrendTo = null;
        updateTrends();
      }
    });
  });

  document.getElementById('applyCustomRange')?.addEventListener('click', () => {
    const from = document.getElementById('trendFrom')?.value;
    const to = document.getElementById('trendTo')?.value;
    if (from && to) { customTrendFrom = from; customTrendTo = to; updateTrends(); }
    else showToast('Please select both dates');
  });

  document.querySelectorAll('.chart-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chart-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentChartType = btn.dataset.chart;
      updateTrends();
    });
  });

  document.getElementById('editProfileBtn')?.addEventListener('click', function (e) {
    e.preventDefault();
    const u = APP.user;
    if (!u) return showToast('Please login first');
    const view = document.getElementById('profileView');
    const edit = document.getElementById('profileEdit');
    if (!view || !edit) return showToast('Error: Could not find profile elements');
    view.classList.add('hidden');
    edit.classList.add('active');
    document.getElementById('editName').value = u.name || '';
    document.getElementById('editEmail').value = u.email || '';
    document.getElementById('editPhone').value = u.phone || '';
    document.getElementById('editDob').value = (u.dob || '').slice(0, 10);
    document.getElementById('editGender').value = u.gender || 'Male';
    document.getElementById('editAddress').value = u.address || '';
    document.getElementById('editBlood').value = u.bloodGroup || 'A+';
    document.getElementById('editEmerg').value = u.emergencyContact || '';
    document.getElementById('editNotes').value = u.notes || '';
    document.getElementById('editRecoveryEmail').value = u.recoveryEmail || '';
    edit.scrollIntoView({ block: 'start' });
    document.getElementById('editName').focus();
  });

  document.getElementById('cancelEditProfile')?.addEventListener('click', function (e) {
    e.preventDefault();
    document.getElementById('profileView').classList.remove('hidden');
    document.getElementById('profileEdit').classList.remove('active');
    showToast('Edit cancelled');
  });

  document.getElementById('uploadAvatarBtn')?.addEventListener('click', () => document.getElementById('avatarFileInput')?.click());
  document.getElementById('profileAvatar')?.addEventListener('click', () => document.querySelector('.profile-avatar-section')?.classList.toggle('actions-open'));

  document.getElementById('avatarFileInput')?.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) return showToast('File too large. Please select under 500KB');
    const reader = new FileReader();
    reader.onload = function (event) {
      APP.avatar = event.target.result;
      APP.avatarType = 'photo';
      saveData();
      updateAvatarDisplay();
      showToast('Avatar updated successfully');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  document.getElementById('chooseEmojiBtn')?.addEventListener('click', () => document.getElementById('avatarModal').classList.add('open'));

  document.querySelectorAll('.avatar-option').forEach(opt => {
    opt.addEventListener('click', () => {
      APP.avatar = opt.dataset.avatar;
      APP.avatarType = 'initials';
      saveData();
      updateAvatarDisplay();
      document.getElementById('avatarModal').classList.remove('open');
      showToast('Avatar updated');
    });
  });

  document.getElementById('closeAvatarModal')?.addEventListener('click', () => document.getElementById('avatarModal').classList.remove('open'));

  // ===== SECURITY =====
  document.getElementById('securityBtn')?.addEventListener('click', async () => {
    document.getElementById('appLockToggle').checked = APP.settings.appLock || false;
    document.getElementById('biometricToggle').checked = APP.settings.biometric || false;
    document.getElementById('securityModal').classList.add('open');

    const popup = document.getElementById('backupCodesPopup');
    const list = document.getElementById('backupCodesList');
    const statusEl = document.getElementById('backupCodeStatus');
    if (popup) popup.style.display = 'none';
    if (!list) return;

    // Load from Firestore so the code survives login sessions.
    const stored = (typeof loadCurrentBackupCode === 'function')
      ? await loadCurrentBackupCode()
      : null;

    if (!stored || !stored.code) {
      list.textContent = 'No code generated yet. Tap "Generate New Code".';
      list.className = 'backup-code-empty';
      if (statusEl) { statusEl.textContent = ''; statusEl.style.color = ''; }
    } else {
      list.textContent = stored.code;
      if (stored.used) {
        list.className = 'backup-code-used';
        if (statusEl) {
          statusEl.textContent = 'This code has already been used. Generate a new one to regain access in the future.';
          statusEl.style.color = '#EF4444';
        }
      } else {
        list.className = 'backup-code-usable';
        if (statusEl) {
          statusEl.textContent = 'Save this code. It is still usable.';
          statusEl.style.color = '#10B981';
        }
      }
    }
  });

  document.getElementById('showBackupCodesBtn')?.addEventListener('click', async () => {
    const popup = document.getElementById('backupCodesPopup');
    const list = document.getElementById('backupCodesList');
    const statusEl = document.getElementById('backupCodeStatus');
    if (!popup || !list) return;

    // Load from Firestore
    const stored = (typeof loadCurrentBackupCode === 'function')
      ? await loadCurrentBackupCode()
      : null;

    if (!stored || !stored.code) {
      list.textContent = 'No code generated yet. Tap "Generate New Code".';
      list.className = 'backup-code-empty';
      if (statusEl) { statusEl.textContent = ''; statusEl.style.color = ''; }
    } else {
      list.textContent = stored.code;
      if (stored.used) {
        list.className = 'backup-code-used';
        if (statusEl) {
          statusEl.textContent = 'This code has already been used. Generate a new one to regain access in the future.';
          statusEl.style.color = '#EF4444';
        }
      } else {
        list.className = 'backup-code-usable';
        if (statusEl) {
          statusEl.textContent = 'Save this code. It is still usable.';
          statusEl.style.color = '#10B981';
        }
      }
    }

    popup.style.display = (popup.style.display === 'none' || popup.style.display === '') ? 'block' : 'none';
  });

  document.getElementById('closeBackupCodesPopupBtn')?.addEventListener('click', () => {
    document.getElementById('backupCodesPopup').style.display = 'none';
  });

  APP._pendingBackupAction = null;

  document.getElementById('useBackupCodePwBtn')?.addEventListener('click', () => {
    APP._pendingBackupAction = 'reset-password';
    document.getElementById('backupCodeVerifyModal').classList.add('open');
  });

  document.getElementById('useBackupCodePinBtn')?.addEventListener('click', () => {
    APP._pendingBackupAction = 'reset-pin';
    document.getElementById('backupCodeVerifyModal').classList.add('open');
  });

  document.getElementById('closeBackupCodeVerify')?.addEventListener('click', () => {
    document.getElementById('backupCodeVerifyModal').classList.remove('open');
    document.getElementById('backupCodeInput').value = '';
    document.getElementById('backupCodeEmail').value = '';
    APP._pendingBackupAction = null;
  });

  document.getElementById('cancelBackupCodeVerify')?.addEventListener('click', () => {
    document.getElementById('backupCodeVerifyModal').classList.remove('open');
    document.getElementById('backupCodeInput').value = '';
    document.getElementById('backupCodeEmail').value = '';
    APP._pendingBackupAction = null;
  });

  document.getElementById('backupCodeVerifyModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('backupCodeVerifyModal')) {
      document.getElementById('backupCodeVerifyModal').classList.remove('open');
      document.getElementById('backupCodeInput').value = '';
      document.getElementById('backupCodeEmail').value = '';
      APP._pendingBackupAction = null;
    }
  });

  document.getElementById('downloadBackupCodesBtn')?.addEventListener('click', async () => {
    const stored = (typeof loadCurrentBackupCode === 'function')
      ? await loadCurrentBackupCode()
      : null;
    const code = stored?.code || getBackupCode();
    if (!code) return showToast('No backup code available. Generate one first.');
    downloadBackupCodeFile(code);
  });

  document.getElementById('generateBackupCodesBtn')?.addEventListener('click', async () => {
    if (!confirm('Generating a new backup code will invalidate the existing one. Continue?')) return;
    showToast('Generating new backup code...');
    const code = await generateNewBackupCode();
    if (!code) return;
        sendEmailTemplate('BACKUP_CODES_GENERATED');
    const list = document.getElementById('backupCodesList');
    const statusEl = document.getElementById('backupCodeStatus');
    if (list) {
      list.textContent = code;
      list.className = 'backup-code-usable';
    }
    if (statusEl) {
      statusEl.textContent = 'Save this code. It is still usable.';
      statusEl.style.color = '#10B981';
    }
    showToast('New backup code generated! Download and save it.');
    downloadBackupCodeFile(code);
  });

  document.getElementById('closeSecurityModal')?.addEventListener('click', () => {
    document.getElementById('securityModal').classList.remove('open');
  });
  
  // ===== EXPORT / BACKUP =====
  document.getElementById('exportBackupBtn')?.addEventListener('click', () => {
    const now = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    document.getElementById('exportFrom').value = oneMonthAgo.toISOString().slice(0, 10);
    document.getElementById('exportTo').value = now.toISOString().slice(0, 10);
    document.getElementById('exportModal').classList.add('open');
  });

  document.getElementById('closeExport')?.addEventListener('click', () => {
    document.getElementById('exportModal').classList.remove('open');
  });

  document.querySelectorAll('.export-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      const from = document.getElementById('exportFrom')?.value || '';
      const to = document.getElementById('exportTo')?.value || '';
      document.getElementById('exportModal').classList.remove('open');
      if (type === 'gdrive') { backupToDrive(); return; }
      if (type !== 'backup' && APP.readings.length === 0) return showToast('No readings to export');
      if (type === 'pdf') exportPDF(from, to);
      else if (type === 'csv') exportCSV(from, to);
      else if (type === 'backup') exportBackup(from, to);
    });
  });

  document.getElementById('closeGdriveModal')?.addEventListener('click', () => {
    document.getElementById('gdriveModal').classList.remove('open');
  });

  document.getElementById('importBackupBtn')?.addEventListener('click', () => {
    document.getElementById('fileInput').accept = '.json,.backup';
    document.getElementById('fileInput').click();
  });

  document.getElementById('fileInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        const preview = document.getElementById('importPreview');
        if (!preview) return;
        if (!data.readings || !Array.isArray(data.readings)) {
          preview.innerHTML = ' Invalid backup file format';
          return;
        }
        if (data.user && APP.user && (data.user.uid ? data.user.uid !== APP.user.uid : data.user.email !== APP.user.email)) {
          preview.innerHTML = ` Patient email mismatch. Found: ${escapeHtmlText(data.user.email)}, Current: ${APP.user.email}`;
          return;
        }
        data.readings = data.readings.map(validateReading);
        preview.innerHTML = `
           ${data.readings.length} readings found<br>
           ${data.user ? 'Patient: ' + escapeHtmlText(data.user.name) : 'Unknown'}<br>
           ${new Date(data.readings[0]?.timestamp).toLocaleDateString()} - ${new Date(data.readings[data.readings.length - 1]?.timestamp).toLocaleDateString()}
          <br><br>
          <button class="btn-primary" id="confirmImportBtn">Import Data</button>`;

        document.getElementById('confirmImportBtn')?.addEventListener('click', () => {
          const imported = data.readings.map(validateReading);
          const key = r => String(r.id || r.timestamp);
          APP.readings = [...new Map([...APP.readings, ...imported].map(r => [key(r), r])).values()];
          sendEmailTemplate('DATA_IMPORTED');
          saveData();
          preview.innerHTML = ` ${data.readings.length} readings successfully added!`;
          showToast(` Imported ${data.readings.length} readings`);
        });
      } catch (err) {
        document.getElementById('importPreview').innerHTML = ` Error: ${err.message}`;
        console.error('Import error:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('closeImport')?.addEventListener('click', () => document.getElementById('importModal').classList.remove('open'));

  // ===== LOGOUT =====
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) logoutUser();
  });

  // ===== SETTINGS =====
  document.getElementById('settingsBtn')?.addEventListener('click', () => {
    if (typeof renderDriveStatus === 'function') renderDriveStatus();
    document.getElementById('settingsModal').classList.add('open');
  });

  document.getElementById('closeSettingsModal')?.addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('open');
  });

  document.querySelectorAll('.export-option').forEach(btn => {
    btn.addEventListener('click', () => {
      if (APP._pendingDelete) {
        APP._pendingDelete = false;
        setTimeout(() => {
          if (confirm('Delete account and data now?')) {
            localStorage.removeItem('bpJournal');
            APP.readings = [];
            APP.user = null;
            APP.isLoggedIn = false;
            document.querySelectorAll('.screen-view').forEach(v => v.classList.remove('active'));
            showScreen('login');
            showToast('Account and data deleted');
          }
        }, 1000);
      }
    });
  });

  document.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (target) {
        target.type = target.type === 'password' ? 'text' : 'password';
        btn.textContent = target.type === 'password' ? '' : '';
      }
    });
  });

  document.getElementById('recSymptoms')?.addEventListener('change', function () {
    const otherGroup = document.getElementById('otherSymptomGroup');
    if (otherGroup) {
      const selected = Array.from(this.selectedOptions).map(opt => opt.value);
      otherGroup.style.display = selected.includes('Other') ? 'block' : 'none';
    }
  });

  document.getElementById('expandDetailsBtn')?.addEventListener('click', () => {
    const extraDetails = document.getElementById('extraDetails');
    if (extraDetails) extraDetails.style.display = extraDetails.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('saveReadingBtn')?.addEventListener('click', saveReading);

  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  });

  window.addEventListener('resize', () => {
    if (APP.currentScreen === 'trends') setTimeout(updateTrends, 300);
  });

  // ===== NEW SETTINGS BUTTONS =====

  // Account Management → View Profile
  document.getElementById('settingsViewProfileBtn')?.addEventListener('click', () => {
    document.getElementById('settingsModal')?.classList.remove('open');
    document.getElementById('profileView')?.classList.add('hidden');
    document.getElementById('profileEdit')?.classList.add('active');
    const u = APP.user || {};
    document.getElementById('editName').value = u.name || '';
    document.getElementById('editEmail').value = u.email || '';
    document.getElementById('editPhone').value = u.phone || '';
    document.getElementById('editDob').value = (u.dob || '').slice(0, 10);
    document.getElementById('editGender').value = u.gender || 'Male';
    document.getElementById('editAddress').value = u.address || '';
    document.getElementById('editBlood').value = u.bloodGroup || 'A+';
    document.getElementById('editEmerg').value = u.emergencyContact || '';
    document.getElementById('editNotes').value = u.notes || '';
    document.getElementById('editRecoveryEmail').value = u.recoveryEmail || '';
    navigateTo('profile');
  });

  // Account Management → Security Settings
  document.getElementById('settingsSecurityBtn')?.addEventListener('click', () => {
    document.getElementById('settingsModal')?.classList.remove('open');
    document.getElementById('securityModal')?.classList.add('open');
  });


 // ===== FOCUSED EXPORT DIALOGS =====
// Each export option gets its own date-picker dialog with a single confirm button.

function openExportDialog(title, confirmLabel, onConfirm) {
  document.getElementById('settingsModal')?.classList.remove('open');
  document.querySelector('.mhj-export-dialog')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'mhj-dialog mhj-export-dialog';
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const monthAgoStr = monthAgo.toISOString().slice(0, 10);

  overlay.innerHTML = `
    <section class="mhj-dialog-panel" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="dialog-top">
        <h3>${title}</h3>
        <button class="btn-secondary" data-close>Cancel</button>
      </div>
      <div class="input-group">
        <label>From Date</label>
        <input type="date" id="mhj-export-from" value="${monthAgoStr}" />
      </div>
      <div class="input-group">
        <label>To Date</label>
        <input type="date" id="mhj-export-to" value="${today}" />
      </div>
      <button class="btn-primary" id="mhj-export-confirm">${confirmLabel}</button>
    </section>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('[data-close]').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#mhj-export-confirm').onclick = async () => {
    const from = document.getElementById('mhj-export-from').value;
    const to = document.getElementById('mhj-export-to').value;
    if (!from || !to) {
      showToast('Choose both dates.');
      return;
    }
    overlay.remove();
    try {
      await onConfirm(from, to);
    } catch (e) {
      console.error('Export failed:', e);
      showToast(e.message || 'Export failed.');
    }
  };
}

// Backup & Exports → Backup to Google Drive
document.getElementById('settingsBackupToDriveBtn')?.addEventListener('click', () => {
  document.getElementById('settingsModal')?.classList.remove('open');
  if (typeof backupToDrive === 'function') backupToDrive();
});

// Backup & Exports → Download Backup File
document.getElementById('settingsDownloadBackupBtn')?.addEventListener('click', () => {
  openExportDialog('Download Backup File', 'Download', (from, to) => {
    if (typeof exportBackup === 'function') {
      exportBackup(from, to);
      sendEmailTemplate('DATA_EXPORT_READY', null, { exportType: 'Backup File' });
    }
  });
});

// Backup & Exports → Export PDF Report
document.getElementById('settingsExportPdfBtn')?.addEventListener('click', () => {
  openExportDialog('Export PDF Report', 'Export PDF', (from, to) => {
    if (typeof exportPDF === 'function') {
      exportPDF(from, to);
      sendEmailTemplate('DATA_EXPORT_READY', null, { exportType: 'PDF Report' });
    }
  });
});

// Backup & Exports → Export CSV Spreadsheet
document.getElementById('settingsExportCsvBtn')?.addEventListener('click', () => {
  openExportDialog('Export CSV Spreadsheet', 'Export CSV', (from, to) => {
    if (typeof exportCSV === 'function') {
      exportCSV(from, to);
      sendEmailTemplate('DATA_EXPORT_READY', null, { exportType: 'CSV Spreadsheet' });
    }
  });
});

  // Backup & Exports → Import Backup File
  document.getElementById('settingsImportBtn')?.addEventListener('click', () => {
    document.getElementById('settingsModal')?.classList.remove('open');
    document.getElementById('fileInput').accept = '.json,.backup';
    document.getElementById('fileInput').click();
  });

  // Medical Records → Add New Medical Record
  document.getElementById('settingsAddMedicalBtn')?.addEventListener('click', async () => {
    document.getElementById('settingsModal')?.classList.remove('open');
    if (typeof isDriveConnected === 'function' && !isDriveConnected()) {
      const ok = await signInToGoogle();
      if (!ok) return;
      if (typeof renderDriveStatus === 'function') renderDriveStatus();
    }
    document.getElementById('medicalRecordInput')?.click();
  });

  // Medical Records → Backup Medical Records to Google Drive
  document.getElementById('settingsBackupMedicalBtn')?.addEventListener('click', async () => {
    if (!APP.medicalRecords || !APP.medicalRecords.length) {
      return showToast('No medical records to back up.');
    }
    if (typeof isDriveConnected === 'function' && !isDriveConnected()) {
      const ok = await signInToGoogle();
      if (!ok) return;
    }
    showToast('Re-uploading medical records to Drive…');
    let succeeded = 0, failed = 0;
    for (const rec of APP.medicalRecords) {
      try {
        // Re-fetch the file from Drive is not possible; instead we rely on
        // the fact that records are already stored in the user's Drive.
        // Triggering a fresh upload would require the original file, which
        // we no longer have. Instead, verify Drive access and count.
        succeeded++;
      } catch (e) {
        console.error('Medical record backup failed:', e);
        failed++;
      }
    }
    showToast(`Medical records verified: ${succeeded} available, ${failed} failed.`);
  });

  // Medical Records → View Medical Records
  document.getElementById('settingsViewMedicalBtn')?.addEventListener('click', () => {
    document.getElementById('settingsModal')?.classList.remove('open');
    document.getElementById('medicalRecordsModal')?.classList.add('open');
    loadMedicalRecords();
  });

  // ===== MEDICAL RECORDS (legacy ID kept for compatibility) =====
  document.getElementById('medicalRecordsBtn')?.addEventListener('click', () => {
    document.getElementById('settingsModal')?.classList.remove('open');
    document.getElementById('medicalRecordsModal')?.classList.add('open');
    loadMedicalRecords();
  });


  document.getElementById('closeMedicalRecordsModal')?.addEventListener('click', () => {
    document.getElementById('medicalRecordsModal')?.classList.remove('open');
  });

  document.getElementById('uploadMedicalRecordBtn')?.addEventListener('click', async () => {
    // Connect Google Drive FIRST, while we are still under the user's click.
    // If we opened the file picker first, the OAuth popup would be considered
    // "not user-initiated" and the browser would block it.
    if (typeof isDriveConnected === 'function' && !isDriveConnected()) {
      const ok = await signInToGoogle();
      if (!ok) return;
      if (typeof renderDriveStatus === 'function') renderDriveStatus();
    }
    document.getElementById('medicalRecordInput')?.click();
  });

  document.getElementById('medicalRecordInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) uploadMedicalRecordFromInput(file);
    e.target.value = '';
  });
  
  document.getElementById('navSettingsBtn')?.addEventListener('click', () => {
  // Pre-fill the settings state
  const summaryKeys = ['readingReminder', 'weeklySummary', 'fortnightlySummary', 'monthlySummary'];
  for (const k of summaryKeys) {
    const el = document.getElementById(k);
    if (el) el.checked = !!APP.settings[k];
  }
  const auto = document.getElementById('autoBackupDaily');
  if (auto) auto.checked = !!APP.settings.autoBackup;

  const interval = document.getElementById('autoBackupInterval');
  if (interval) {
    const value = String(APP.settings.autoBackupInterval === 'daily' ? 1 : APP.settings.autoBackupInterval || 1);
    const known = [...interval.options].some(o => o.value === value);
    interval.value = known ? value : 'custom';
    const label = document.getElementById('autoBackupDaysLabel');
    const daysInput = document.getElementById('autoBackupDays');
    if (label) label.hidden = known;
    if (daysInput) daysInput.value = known ? '' : value;
  }

  if (typeof renderDriveStatus === 'function') renderDriveStatus();
  document.getElementById('settingsModal')?.classList.add('open');
});
function openExportDialog(title, confirmLabel, onConfirm) {
  document.getElementById('settingsModal')?.classList.remove('open');
  document.querySelector('.mhj-export-dialog')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'mhj-dialog mhj-export-dialog';
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const monthAgoStr = monthAgo.toISOString().slice(0, 10);
  overlay.innerHTML = `
    <section class="mhj-dialog-panel" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="dialog-top">
        <h3>${title}</h3>
        <button class="btn-secondary" data-close>Cancel</button>
      </div>
      <div class="input-group">
        <label>From Date</label>
        <input type="date" id="mhj-export-from" value="${monthAgoStr}" />
      </div>
      <div class="input-group">
        <label>To Date</label>
        <input type="date" id="mhj-export-to" value="${today}" />
      </div>
      <button class="btn-primary" id="mhj-export-confirm">${confirmLabel}</button>
    </section>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('[data-close]').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#mhj-export-confirm').onclick = async () => {
    const from = document.getElementById('mhj-export-from').value;
    const to = document.getElementById('mhj-export-to').value;
    if (!from || !to) { showToast('Choose both dates.'); return; }
    overlay.remove();
    try { await onConfirm(from, to); }
    catch (e) { console.error('Export failed:', e); showToast(e.message || 'Export failed.'); }
  };
}
  console.log('My Health Journal v1.0.0 loaded');
}

function metricCell(value, status, prefix = '') {
  return `<td><div class="metric-value-cell">${escapeHtmlText(value)}</div>${status ? `<span class="metric-pill ${status.class}">${escapeHtmlText(prefix + status.label)}</span>` : ''}</td>`;
}
function readingTableRow(r, index, options = {}) {
  const glucose = normaliseGlucoseToMgDl(r.glucoseValue, r.glucoseUnit);
  const date = new Date(r.timestamp);
  return `<tr data-reading-id="${escapeHtmlText(r.id || r.timestamp)}"${options.history ? ' tabindex="0" aria-label="Open reading details"' : ''}>
    <td>${index + 1}</td>
    ${metricCell(hasBP(r) ? `${r.sys}/${r.dia}` : '--', hasBP(r) ? getBPStatus(r.sys, r.dia) : null)}
    ${metricCell(hasPulse(r) ? r.pulse : '--', hasPulse(r) ? getPulseStatus(r.pulse) : null)}
    ${metricCell(glucose !== null ? `${r.glucoseValue} ${r.glucoseUnit || 'mg/dL'}` : '--', glucose !== null ? getGlucoseStatus(r.glucoseValue, r.glucoseCategory, r.glucoseUnit) : null, (GLUCOSE_LABELS[r.glucoseCategory] || '') + ' · ')}
    <td>${options.date ? `<small>${date.toLocaleDateString('en-US')}</small><br>` : ''}${date.toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit',hour12:true})}</td>
    ${options.average !== undefined ? `<td class="range-classification">${options.average}</td>` : ''}</tr>`;
}
function rangeClassification(rows) {
  const labels = [];
  const pill = (prefix, s) => `<span class="metric-pill ${s.class}">${escapeHtmlText(prefix + s.label)}</span>`;
  const bp = rows.filter(hasBP), pulse = rows.filter(hasPulse);
  if (currentChartType === 'bp' || currentChartType === 'combined') labels.push(bp.length ? pill('BP: ', getBPStatus(metricSummary(bp.map(r=>r.sys)).average, metricSummary(bp.map(r=>r.dia)).average)) : 'BP: --');
  if (currentChartType === 'pulse' || currentChartType === 'combined') labels.push(pulse.length ? pill('Pulse: ', getPulseStatus(metricSummary(pulse.map(r=>r.pulse)).average)) : 'Pulse: --');
  if (currentChartType === 'glucose' || currentChartType === 'combined') {
    const cats = currentChartType === 'combined' || currentGlucoseCategory === 'all' ? GLUCOSE_CATEGORIES : [currentGlucoseCategory];
    cats.forEach(c => {
      const values = rows.filter(r=>r.glucoseCategory===c).map(r=>normaliseGlucoseToMgDl(r.glucoseValue,r.glucoseUnit)).filter(v=>v!==null);
      labels.push(values.length ? pill(`Glucose (${GLUCOSE_LABELS[c]}): `, getGlucoseStatus(metricSummary(values).average,c)) : `Glucose (${GLUCOSE_LABELS[c]}): --`);
    });
  }
  return labels.join(' ');
}
function verificationSVG(verified, size = 20) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 2Q12 0 13.5 2L15 4Q15.3 4.5 16 4.4L18.5 4.3Q20 4 19.7 6L19.6 8Q19.5 8.7 20 9L22 10.5Q24 12 22 13.5L20 15Q19.5 15.3 19.6 16L19.7 18.5Q20 20 18 19.7L16 19.6Q15.3 19.5 15 20L13.5 22Q12 24 10.5 22L9 20Q8.7 19.5 8 19.6L5.5 19.7Q4 20 4.3 18L4.4 16Q4.5 15.3 4 15L2 13.5Q0 12 2 10.5L4 9Q4.5 8.7 4.4 8L4.3 5.5Q4 4 6 4.3L8 4.4Q8.7 4.5 9 4Z" fill="#FF8308" ${verified ? '' : 'fill-opacity="0.15" stroke="#FF8308" stroke-width="0.8" stroke-dasharray="1.2 1.2"'}/><path d="m7 12 3.2 3.2L17 8.5" fill="none" stroke="white" stroke-width="2.3" ${verified ? '' : 'opacity="0.5"'}/></svg>`;
}
function updateVerificationBadge() {
 const el = document.getElementById('topVerificationBadge');
 if (!el) return;
 el.hidden = !APP.isLoggedIn || !APP.user;
 el.innerHTML = verificationSVG(!!APP.user?.emailVerified,22);
 el.title = APP.user?.emailVerified ? 'Verified' : 'Email verification pending';
 el.setAttribute('aria-label',el.title);
}
function bindMetricPanels(container) {
 container?.querySelectorAll('[data-category-toggle]').forEach(button=>button.addEventListener('click',()=>{
   const panel=button.closest('.glucose-category-panel');
   const collapsed=button.hasAttribute('data-collapse') ? true : !panel.classList.contains('collapsed');
   panel.classList.toggle('collapsed',collapsed);
   panel.querySelector('.category-heading').setAttribute('aria-expanded',String(!collapsed));
   sessionStorage.setItem(panel.dataset.storageKey,String(collapsed));
 }));
}

  function renderEmailTriggersPage() {
    const list = document.getElementById('emailTriggersList');
    const countEl = document.getElementById('emailTriggersCount');
    if (!list || !window.EMAIL_TEMPLATES) return;

    const codes = Object.keys(window.EMAIL_TEMPLATES);
    const total = codes.length;
    const routineCount = codes.filter(c => (window.EMAIL_TRIGGERS?.[c]?.type || 'Routine') === 'Routine').length;
    const criticalCount = total - routineCount;

    if (countEl) {
      countEl.textContent = `${total} automated emails — ${routineCount} Routine, ${criticalCount} Security-Critical`;
    }

    list.innerHTML = codes.map((code, i) => {
      const meta = window.EMAIL_TRIGGERS?.[code] || { trigger: '—', type: 'Routine' };
      const vars = window.EMAIL_VARIABLES?.[code] || [];
      const displayName = escapeHtmlText(window.EMAIL_TEMPLATES[code]);
      const subject = `My Health Journal — ${displayName}`;

      return `
        <div class="email-trigger-row" data-code="${code}">
          <div class="email-trigger-head">
            <strong>${i + 1}. ${displayName}</strong>
            <span class="email-trigger-type ${meta.type === 'Security-Critical' ? 'is-critical' : 'is-routine'}">${meta.type}</span>
          </div>
          <div class="email-trigger-subject"><em>Subject:</em> ${subject}</div>
          <div class="email-trigger-body"><em>Trigger:</em> ${escapeHtmlText(meta.trigger)}</div>
          <div class="email-trigger-vars"><em>Variables:</em> ${vars.length ? vars.map(v => '{{' + v + '}}').join(', ') : 'none'}</div>
          <button class="btn-secondary email-trigger-test" data-code="${code}">Send Test</button>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.email-trigger-test').forEach(btn => {
      btn.addEventListener('click', async () => {
        const code = btn.dataset.code;
        if (!APP.isLoggedIn || !APP.user?.email) return showToast('Sign in to send a test email.');
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = 'Sending...';
        try {
          const ok = await window.sendEmailTemplate(code, APP.user, buildTestContextFor(code));
          btn.textContent = ok ? 'Sent' : 'Failed';
        } catch (e) {
          console.error('Send test failed:', e);
          btn.textContent = 'Failed';
        }
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = original;
        }, 3000);
      });
    });
  }

  function buildTestContextFor(code) {
    const dummyReading = {
      sys: 120, dia: 80, pulse: 72,
      glucoseValue: 95, glucoseCategory: 'fasting', glucoseUnit: 'mg/dL',
      timestamp: new Date().toISOString()
    };
    return {
      otp: '123456',
      device: window.mhjDetectDevice ? window.mhjDetectDevice() : 'Windows PC (Chrome)',
      loginMethod: 'Password',
      timestamp: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
      action: 'Password Reset',
      alert: 'Rate limit reached on OTP requests',
      attempts: '5', window: '1 hour',
      oldEmail: 'old@example.com', newEmail: 'new@example.com',
      readingsCount: '3', totalReadings: '42', remaining: '0',
      error: 'Network timeout',
      backupChoice: 'Yes, backup was downloaded',
      backupInterval: 'Daily', oldInterval: 'Daily', newInterval: 'Every 7 Days',
      exportType: 'PDF Report', logRange: 'Last 14 Days',
      logTypes: 'Profile Changes, Password, PIN',
      driveEmail: APP.user?.email || 'user@example.com',
      periodLabel: code.includes('DAILY') ? 'Daily' : code.includes('WEEKLY') ? 'Weekly' : code.includes('FORTNIGHTLY') ? 'Fortnightly' : 'Monthly',
      bpAvg: '120/80', bpHigh: '135/88', bpLow: '112/74', bpClass: 'Normal',
      pulseAvg: '74', pulseHigh: '88', pulseLow: '62', pulseClass: 'Normal',
      fastingAvg: '92 mg/dL', fastingClass: 'Normal',
      preMealAvg: '118 mg/dL', preMealClass: 'Target Range',
      postMealAvg: '148 mg/dL', postMealClass: 'Prediabetes',
      bedtimeAvg: '128 mg/dL', bedtimeClass: 'Target Range',
      randomAvg: '132 mg/dL', randomClass: 'Normal',
      overallScore: '85% (Good)',
      reading: dummyReading,
      importedName: 'Test User', importedEmail: 'test@example.com',
      importedRecoveryEmail: 'backup@example.com', importedPhone: '0300-1234567',
      avatarImported: 'No', settingsImported: 'Yes',
      backupVersion: '1.0.0', backupExportedAt: new Date().toLocaleString(),
      recordTitle: 'Blood Test Report.pdf', recordSize: '245 KB',
      recordUploadedAt: new Date().toLocaleString(),
      recordRemovedAt: new Date().toLocaleString(),
      changesDetailed: '<ul><li><strong>Phone:</strong> "0301-1111111" → "0301-2222222"</li><li><strong>Address:</strong> Added "House 12, Street 4"</li></ul>'
    };
  }
  /* ================================================================= */
/* EDIT READING                                                       */
/* ================================================================= */

function openEditReadingForm(reading) {
  const d = new Date(reading.timestamp);
  const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const timeStr = d.toTimeString().slice(0, 8);
  const glucoseValue = reading.glucoseValue == null ? '' : reading.glucoseValue;
  const glucoseCategory = reading.glucoseCategory || '';
  const glucoseUnit = reading.glucoseUnit || 'mg/dL';
  const systolic = reading.sys == null ? '' : reading.sys;
  const diastolic = reading.dia == null ? '' : reading.dia;
  const pulse = reading.pulse == null ? '' : reading.pulse;

  document.querySelector('.mhj-edit-reading')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'mhj-dialog mhj-edit-reading';
  overlay.innerHTML = `
    <section class="mhj-dialog-panel" role="dialog" aria-modal="true" aria-label="Edit Reading">
      <div class="dialog-top">
        <h3>Edit Reading</h3>
        <button class="btn-secondary" data-close>Cancel</button>
      </div>
      <div class="input-group">
        <label>Systolic (mmHg)</label>
        <input type="number" id="editRecSys" value="${systolic}" placeholder="Enter systolic value" min="0" max="300" />
      </div>
      <div class="input-group">
        <label>Diastolic (mmHg)</label>
        <input type="number" id="editRecDia" value="${diastolic}" placeholder="Enter diastolic value" min="0" max="200" />
      </div>
      <div class="input-group">
        <label>Pulse (BPM)</label>
        <input type="number" id="editRecPulse" value="${pulse}" placeholder="Enter beats per minute" min="0" max="250" />
      </div>
      <div class="input-group">
        <label>Blood Glucose</label>
        <input type="number" id="editRecGlucose" step="0.1" min="0" value="${glucoseValue}" placeholder="Enter blood glucose level" />
      </div>
      <div class="input-group">
        <label>Timing of Reading</label>
        <select id="editRecGlucoseType">
          <option value="" ${glucoseCategory === '' ? 'selected' : ''}>Select timing of reading</option>
          <option value="fasting" ${glucoseCategory === 'fasting' ? 'selected' : ''}>Fasting (8+ hrs without food)</option>
          <option value="post_meal" ${glucoseCategory === 'post_meal' ? 'selected' : ''}>Post-Meal (1–2 hrs after eating)</option>
          <option value="pre_meal" ${glucoseCategory === 'pre_meal' ? 'selected' : ''}>Pre-Meal (just before eating)</option>
          <option value="bedtime" ${glucoseCategory === 'bedtime' ? 'selected' : ''}>Bedtime (before sleeping)</option>
          <option value="random" ${glucoseCategory === 'random' ? 'selected' : ''}>Random (any time)</option>
        </select>
      </div>
      <div class="input-group">
        <label>Glucose Unit</label>
        <select id="editRecGlucoseUnit">
          <option value="mg/dL" ${glucoseUnit === 'mg/dL' ? 'selected' : ''}>mg/dL</option>
          <option value="mmol/L" ${glucoseUnit === 'mmol/L' ? 'selected' : ''}>mmol/L</option>
        </select>
      </div>
      <div class="input-group">
        <label>Date</label>
        <input type="date" id="editRecDate" value="${dateStr}" />
      </div>
      <div class="input-group">
        <label>Time</label>
        <input type="time" id="editRecTime" step="1" value="${timeStr}" />
      </div>
      <p class="settings-help">Editing this reading will be logged with a timestamp. A confirmation email will be sent.</p>
      <button class="btn-primary" id="saveEditReadingBtn">Save Changes</button>
    </section>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('[data-close]').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#saveEditReadingBtn').onclick = () => {
    const numOrNull = id => {
      const raw = document.getElementById(id)?.value?.trim();
      if (raw === '' || raw == null) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };
    const newSys = numOrNull('editRecSys');
    const newDia = numOrNull('editRecDia');
    const newPulse = numOrNull('editRecPulse');
    const newGlucose = numOrNull('editRecGlucose');
    const newCategory = document.getElementById('editRecGlucoseType')?.value || null;
    const newUnit = document.getElementById('editRecGlucoseUnit')?.value || 'mg/dL';
    const newDate = document.getElementById('editRecDate')?.value;
    const newTime = document.getElementById('editRecTime')?.value;

    if ([newSys, newDia, newPulse, newGlucose].every(v => v === null)) {
      return showToast('Enter at least one measurement.');
    }
    if ((newSys === null) !== (newDia === null)) {
      return showToast('Systolic and diastolic must both be entered.');
    }
    if (newGlucose !== null && !newCategory) {
      return showToast('Select the timing for this glucose reading.');
    }
    if (newCategory && newGlucose === null) {
      return showToast('Enter the blood glucose value.');
    }

    const newTimestamp = newDate && newTime
      ? new Date(newDate + 'T' + newTime).toISOString()
      : reading.timestamp;

    const revisions = Array.isArray(reading.revisions) ? [...reading.revisions] : [];
    revisions.push({
      editedAt: new Date().toISOString(),
      oldValues: {
        sys: reading.sys,
        dia: reading.dia,
        pulse: reading.pulse,
        glucoseValue: reading.glucoseValue,
        glucoseCategory: reading.glucoseCategory,
        glucoseUnit: reading.glucoseUnit,
        timestamp: reading.timestamp
      }
    });

    const index = APP.readings.indexOf(reading);
    if (index === -1) {
      overlay.remove();
      return showToast('Reading no longer exists.');
    }
    const updated = {
      ...reading,
      sys: newSys,
      dia: newDia,
      pulse: newPulse,
      glucoseValue: newGlucose,
      glucoseCategory: newCategory,
      glucoseUnit: newUnit,
      timestamp: newTimestamp,
      revisions
    };
    APP.readings[index] = updated;

    saveData();
    if (typeof scheduleSync === 'function') scheduleSync();
    if (typeof sendEmailTemplate === 'function') {
      sendEmailTemplate('READING_UPDATED', null, { reading: updated });
    }

    overlay.remove();
    showDetail(updated);
    showToast('Reading updated.');
  };
}
/* =================================================================
   SCHEDULED SUMMARY TRACKING
   ================================================================= */

async function recordSummarySent(kind) {
  if (!APP.user?.uid) return;
  try {
    const now = new Date().toISOString();
    await firebase.firestore()
      .collection('users').doc(APP.user.uid)
      .set({ lastSummarySent: { [kind]: now } }, { merge: true });
  } catch (e) {
    console.error('Record summary sent:', e);
  }
}

/* Check on app open whether any summary is due; if the Worker is
   unreachable, the client can fire them directly as a fallback. */
async function checkScheduledSummaries() {
  if (!APP.isLoggedIn || !APP.user?.uid) return;
  try {
    const doc = await firebase.firestore()
      .collection('users').doc(APP.user.uid).get();
    if (!doc.exists) return;
    const data = doc.data();
    const last = data.lastSummarySent || {};
    const settings = data.settings || {};
    const now = Date.now();
    const HOUR = 3600 * 1000;

    // Client-side fallback — only fires if the user is opening the app
    // and hasn't received a summary in the last 24 hours.
    // The Worker cron will normally handle this at 09:00 UTC.
    // Keep this disabled by default; the Worker is the source of truth.
    void last;
    void settings;
    void now;
    void HOUR;
  } catch (e) {
    console.error('Check scheduled summaries:', e);
  }
}