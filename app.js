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
    dateFormat: 'DD/MM/YYYY'
  },
  gdriveConfig: {
    scriptUrl: 'https://script.google.com/macros/s/AKfycbw5sgzUBXZtkAXMcx_9h_d60tBPxSH7iu_wGKc03g-CXUBDpm3WPaS6UmLdQ5EwkCNeUg/exec',
    folderId: '1dMnCqrDz6TGBgrQon-5NgbUFP3R4zosM'
  },
  otpCode: null,
  otpEmail: null,
  otpPurpose: null // 'register' or 'reset'
};

// ===== DOM REFS =====
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  APP.isLoggedIn = false;

  setupEventListeners();
  updateClock();
  setInterval(updateClock, 1000);
  setupPhoneFormatting();
  setupNameCapitalization();

  setTimeout(() => {
    document.getElementById('splash').classList.add('hide');
    document.getElementById('app').classList.add('active');
    showScreen('login');
  }, 1500);
});

// ===== SCREEN NAVIGATION =====
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

// ===== GO TO HOME =====
function goToHome() {
  if (!APP.user) {
    showScreen('login');
    return;
  }
  updateAvatarDisplay();
  document.getElementById('homeUserDisplay').textContent = APP.user.name;
  document.getElementById('readyName').textContent = APP.user.name;
  document.getElementById('greetingMsg').textContent = getGreeting() + ', ' + APP.user.name;
  showScreen('home');
  updateHome();
}

// ===== CLOCK =====
function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  const date = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const topTime = document.getElementById('topTime');
  const homeDate = document.getElementById('homeDate');
  if (topTime) topTime.textContent = time;
  if (homeDate) homeDate.textContent = `${date} · ${time}`;
}

// ===== GREETING =====
function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// ===== BP CLASSIFICATION =====
function getBPStatus(sys, dia) {
  let sysCategory = null;
  let diaCategory = null;

  if (sys > 180) sysCategory = 'crisis';
  else if (sys >= 140) sysCategory = 'stage2';
  else if (sys >= 130) sysCategory = 'stage1';
  else if (sys >= 121) sysCategory = 'elevated';
  else if (sys >= 90) sysCategory = 'normal';
  else if (sys >= 21) sysCategory = 'hypotension';
  else sysCategory = 'normal';

  if (dia > 120) diaCategory = 'crisis';
  else if (dia >= 90) diaCategory = 'stage2';
  else if (dia >= 81) diaCategory = 'stage1';
  else if (dia >= 60 && dia < 80) diaCategory = 'normal';
  else if (dia < 60 && dia >= 40) diaCategory = 'hypotension';
  else if (dia < 40) diaCategory = 'hypotension';
  else diaCategory = 'normal';

  const severityOrder = ['crisis', 'stage2', 'stage1', 'elevated', 'normal', 'hypotension'];
  const sysIndex = severityOrder.indexOf(sysCategory);
  const diaIndex = severityOrder.indexOf(diaCategory);
  const finalIndex = Math.min(sysIndex, diaIndex);
  const finalCategory = severityOrder[finalIndex];

  switch (finalCategory) {
    case 'crisis':
      return { label: '🔴 Hypertensive Crisis', class: 'status-crisis' };
    case 'stage2':
      return { label: '🟣 Stage 2 Hypertension', class: 'status-stage2' };
    case 'stage1':
      return { label: '🟠 Stage 1 Hypertension', class: 'status-stage1' };
    case 'elevated':
      return { label: '🟡 Elevated', class: 'status-elevated' };
    case 'normal':
      return { label: '🟢 Normal', class: 'status-normal' };
    case 'hypotension':
      if (sys < 90 || dia < 60) {
        return { label: '🔵 Hypotension (Low)', class: 'status-hypotension' };
      }
      return { label: '🟢 Normal', class: 'status-normal' };
    default:
      return { label: '🟢 Normal', class: 'status-normal' };
  }
}

// ===== HEART RATE CLASSIFICATION =====
function getPulseStatus(pulse) {
  if (pulse > 120) return { label: '🔴 Severe Tachycardia', class: 'pulse-tachy-severe' };
  if (pulse >= 101) return { label: '🟣 Mild Tachycardia', class: 'pulse-tachy-mild' };
  if (pulse >= 60 && pulse <= 100) return { label: '🟢 Normal', class: 'pulse-normal' };
  if (pulse >= 40 && pulse < 60) return { label: '🟡 Low (Bradycardia)', class: 'pulse-brady' };
  return { label: '🟠 Severe Bradycardia', class: 'pulse-brady-severe' };
}

// ===== CONSISTENCY GRADE =====
function getConsistencyGrade(pct) {
  if (pct >= 90) return { label: 'Excellent', class: 'consistency-grade-excellent' };
  if (pct >= 80) return { label: 'Good', class: 'consistency-grade-good' };
  if (pct >= 70) return { label: 'Average', class: 'consistency-grade-average' };
  if (pct >= 60) return { label: 'Below Average', class: 'consistency-grade-below' };
  if (pct >= 40) return { label: 'Poor', class: 'consistency-grade-poor' };
  return { label: 'Awful', class: 'consistency-grade-awful' };
}

// ===== AUTO-CALCULATE AGE =====
function calculateAge(dob) {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function displayAge(dob) {
  const age = calculateAge(dob);
  if (age !== null) {
    return `${age} years`;
  }
  return '';
}

// ===== LOGIN =====
function loginUser(identifier, password = null, pin = null) {
  const stored = loadData(identifier);

  if (stored && stored.user) {
    const user = stored.user;
    const identifierMatch =
      (identifier && (identifier === user.email || identifier === user.phone || identifier === user.name));

    if (!identifierMatch) {
      showToast('User not found');
      return false;
    }

    if (password && user.password !== password) {
      showToast('Invalid password');
      return false;
    }

    if (pin && user.pin !== pin) {
      showToast('Invalid PIN');
      return false;
    }

    APP.user = user;
    APP.readings = stored.readings || [];
    APP.avatar = stored.avatar || '';
    APP.avatarType = stored.avatarType || 'initials';
    APP.settings = { ...APP.settings, ...(stored.settings || {}) };
    APP.isLoggedIn = true;
    localStorage.setItem('mhj:lastActive', user.email.toLowerCase());
    saveData();
  } else {
    showToast('No account found. Please register.');
    showScreen('register');
    return false;
  }

  goToHome();
  showToast('Welcome back, ' + APP.user.name + '!');
  return true;
}

// ===== LOGOUT =====
function logoutUser() {
  APP.isLoggedIn = false;
  APP.user = null;
  APP.avatar = '';
  APP.avatarType = 'initials';
  APP.pinBuffer = '';
  document.querySelectorAll('.screen-view').forEach(v => v.classList.remove('active'));
  showScreen('login');
  document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
  showToast('Logged out successfully');
}

// ===== AVATAR =====
function updateAvatarDisplay() {
  const avatarEl = document.getElementById('topAvatar');
  const profileAvatarEl = document.getElementById('profileAvatarInitials');

  if (!avatarEl) return;

  if (APP.avatarType === 'photo' && APP.avatar && APP.avatar.startsWith('data:image')) {
    avatarEl.innerHTML = `<img src="${APP.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`;
    if (profileAvatarEl) {
      profileAvatarEl.parentElement.innerHTML =
        `<img src="${APP.avatar}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;" />`;
    }
  } else if (APP.avatar && APP.avatar.length === 1 && !APP.avatar.match(/[a-zA-Z]/)) {
    avatarEl.innerHTML = `<span class="avatar-emoji">${APP.avatar}</span>`;
    if (profileAvatarEl) {
      profileAvatarEl.textContent = APP.avatar;
      profileAvatarEl.style.fontSize = '32px';
    }
  } else if (APP.user && APP.user.name) {
    const initials = APP.user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    avatarEl.innerHTML = `<span>${initials}</span>`;
    if (profileAvatarEl) {
      profileAvatarEl.textContent = initials;
      profileAvatarEl.style.fontSize = '24px';
    }
  }
}

// ===== OTP FUNCTIONS - SIMPLE WORKING VERSION =====
function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOTP(email, name, purpose) {
  const otp = generateOTP();
  APP.otpCode = otp;
  APP.otpEmail = email;
  APP.otpPurpose = purpose;

  // SHOW OTP IN ALERT FOR TESTING
  alert(`Your OTP is: ${otp}\n\nEmail: ${email}\nPurpose: ${purpose}`);
  console.log('OTP:', otp, 'Email:', email, 'Purpose:', purpose);
  showToast(`OTP sent! Check alert/console`);

  // Try Apps Script (doesn't block if fails)
  try {
    const response = await fetch(APP.gdriveConfig.scriptUrl, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sendotp',
        email: email,
        name: name,
        otp: otp
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Apps Script OTP sent:', result);
    } else {
      console.warn('Apps Script failed with status:', response.status);
    }
  } catch (error) {
    console.warn('Apps Script error (non-blocking):', error.message);
  }

  return true;
}

function verifyOTP(enteredOTP) {
  if (!APP.otpCode) {
    showToast('No OTP found. Please request a new one.');
    return false;
  }

  if (enteredOTP === APP.otpCode) {
    APP.otpCode = null;
    return true;
  } else {
    showToast('Invalid OTP. Please try again.');
    return false;
  }
}

// ===== HOME =====
function updateHome() {
  const today = new Date().toDateString();
  const todayReadings = APP.readings.filter(r =>
    new Date(r.timestamp).toDateString() === today
  );

  const count = todayReadings.length;

  const windows = ['Morning', 'Afternoon', 'Evening'];
  const windowElements = ['wMorning', 'wAfternoon', 'wEvening'];
  windows.forEach((win, i) => {
    const el = document.getElementById(windowElements[i]);
    if (!el) return;
    const has = todayReadings.some(r => r.window === win);
    const statusEl = el.querySelector('.window-status');
    if (statusEl) {
      if (has) {
        statusEl.textContent = '✅ Completed';
        statusEl.className = 'window-status completed';
      } else {
        statusEl.textContent = '⏳ Pending';
        statusEl.className = 'window-status pending';
      }
    }
  });

  if (todayReadings.length > 0) {
    const latest = todayReadings[todayReadings.length - 1];
    const currentBP = document.getElementById('currentBP');
    const currentPulse = document.getElementById('currentPulse');
    const currentStatus = document.getElementById('currentStatus');
    const currentReadingTime = document.getElementById('currentReadingTime');

    if (currentBP) currentBP.textContent = `${latest.sys}/${latest.dia}`;
    if (currentPulse) currentPulse.textContent = `Pulse ${latest.pulse} BPM`;
    if (currentStatus) {
      const status = getBPStatus(latest.sys, latest.dia);
      currentStatus.textContent = status.label;
      currentStatus.className = `reading-status ${status.class}`;
    }
    if (currentReadingTime) {
      const d = new Date(latest.timestamp);
      currentReadingTime.textContent = d.toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
  }

  if (todayReadings.length > 0) {
    const sysValues = todayReadings.map(r => r.sys);
    const diaValues = todayReadings.map(r => r.dia);
    const pulseValues = todayReadings.map(r => r.pulse);

    const avgSys = Math.round(sysValues.reduce((a, b) => a + b, 0) / sysValues.length);
    const avgDia = Math.round(diaValues.reduce((a, b) => a + b, 0) / diaValues.length);
    const avgPulse = Math.round(pulseValues.reduce((a, b) => a + b, 0) / pulseValues.length);

    const avgBP = document.getElementById('todayAvgBP');
    const avgPulseEl = document.getElementById('todayAvgPulse');
    const highestBP = document.getElementById('todayHighestBP');
    const lowestBP = document.getElementById('todayLowestBP');
    const highestPulse = document.getElementById('todayHighestPulse');
    const lowestPulse = document.getElementById('todayLowestPulse');
    const consistency = document.getElementById('todayConsistency');
    const consistencyGrade = document.getElementById('todayConsistencyGrade');

    if (avgBP) avgBP.textContent = `${avgSys}/${avgDia}`;
    if (avgPulseEl) avgPulseEl.textContent = `${avgPulse} BPM`;
    if (highestBP) highestBP.textContent = `${Math.max(...sysValues)}/${Math.max(...diaValues)}`;
    if (lowestBP) lowestBP.textContent = `${Math.min(...sysValues)}/${Math.min(...diaValues)}`;
    if (highestPulse) highestPulse.textContent = `${Math.max(...pulseValues)} BPM`;
    if (lowestPulse) lowestPulse.textContent = `${Math.min(...pulseValues)} BPM`;

    const pct = Math.min(100, Math.round((count / 3) * 100));
    const grade = getConsistencyGrade(pct);
    if (consistency) consistency.textContent = `${pct}%`;
    if (consistencyGrade) {
      consistencyGrade.textContent = grade.label;
      consistencyGrade.className = `consistency-grade ${grade.class}`;
    }

    const list = document.getElementById('todayReadingsList');
    if (list) {
      list.innerHTML = '';
      todayReadings.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      todayReadings.forEach(r => {
        const div = document.createElement('div');
        div.className = 'today-reading-item';
        div.innerHTML = `
          <span class="reading-bp">${r.sys}/${r.dia}</span>
          <span>❤️ ${r.pulse} BPM</span>
          <span class="reading-time-sm">${new Date(r.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
        `;
        list.appendChild(div);
      });
    }
  } else {
    const fields = ['todayAvgBP', 'todayAvgPulse', 'todayHighestBP', 'todayLowestBP', 'todayHighestPulse', 'todayLowestPulse'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '--';
    });
    const consistency = document.getElementById('todayConsistency');
    const consistencyGrade = document.getElementById('todayConsistencyGrade');
    if (consistency) consistency.textContent = '0%';
    if (consistencyGrade) {
      consistencyGrade.textContent = 'Awful';
      consistencyGrade.className = 'consistency-grade consistency-grade-awful';
    }

    const list = document.getElementById('todayReadingsList');
    if (list) {
      list.innerHTML = '<div style="text-align:center;color:var(--gray);padding:8px 0;font-size:13px;">No readings today</div>';
    }
  }

  const greetingMsg = document.getElementById('greetingMsg');
  if (greetingMsg && APP.user) {
    greetingMsg.textContent = getGreeting() + ', ' + APP.user.name;
  }
}

// ===== DATA PERSISTENCE =====
function saveData() {
  try {
    if (!APP.user?.email) return;
    const email = APP.user.email.trim().toLowerCase();
    localStorage.setItem(`mhj:account:${email}`, JSON.stringify({
      user: APP.user,
      readings: APP.readings,
      avatar: APP.avatar,
      avatarType: APP.avatarType,
      settings: APP.settings,
      gdriveConfig: APP.gdriveConfig
    }));
    const accounts = JSON.parse(localStorage.getItem('mhj:accounts') || '[]');
    if (!accounts.includes(email)) {
      accounts.push(email);
      localStorage.setItem('mhj:accounts', JSON.stringify(accounts));
    }
    localStorage.setItem('mhj:lastActive', email);
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

// ===== TOAST NOTIFICATIONS =====
function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '90px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#101A31',
    color: 'white',
    padding: '10px 24px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '500',
    zIndex: '9999',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    maxWidth: '90%',
    textAlign: 'center',
    animation: 'fadeSlide 0.3s ease'
  });
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== AUTO-FORMATTING =====
function setupPhoneFormatting() {
  document.querySelectorAll('input[type="tel"]').forEach(input => {
    input.addEventListener('input', function(e) {
      let value = this.value.replace(/\D/g, '');
      if (value.length > 4) {
        value = value.slice(0, 4) + '-' + value.slice(4, 11);
      }
      this.value = value;
    });
  });
}

function setupNameCapitalization() {
  document.querySelectorAll('input[autocomplete="name"], #regName, #editName, #loginName').forEach(input => {
    if (!input) return;
    input.addEventListener('blur', function() {
      this.value = this.value.split(' ').map(w =>
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' ');
    });
  });
}

// ===== HISTORY =====
let historyDays = 7;
let historyCustomFrom = null;
let historyCustomTo = null;

function renderHistory() {
  const container = document.getElementById('historyList');
  if (!container) return;

  let filtered = [...APP.readings];

  if (historyCustomFrom && historyCustomTo) {
    const from = new Date(historyCustomFrom);
    const to = new Date(historyCustomTo);
    to.setHours(23, 59, 59, 999);
    filtered = filtered.filter(r => {
      const d = new Date(r.timestamp);
      return d >= from && d <= to;
    });
    document.getElementById('historyDateDisplay').textContent =
      `📅 ${new Date(historyCustomFrom).toLocaleDateString()} - ${new Date(historyCustomTo).toLocaleDateString()}`;
  } else if (historyDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - historyDays);
    filtered = filtered.filter(r => new Date(r.timestamp) >= cutoff);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - historyDays);
    document.getElementById('historyDateDisplay').textContent =
      `📅 Last ${historyDays} days (${fromDate.toLocaleDateString()} - ${new Date().toLocaleDateString()})`;
  } else {
    document.getElementById('historyDateDisplay').textContent = '📅 All time';
  }

  filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  container.innerHTML = '';
  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--gray);padding:20px 0;">No readings found</div>';
    return;
  }

  filtered.forEach((r) => {
    const d = new Date(r.timestamp);
    const status = getBPStatus(r.sys, r.dia);
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="left">
        <div class="bp">${r.sys}/${r.dia}</div>
        <div class="meta">${d.toLocaleDateString()} · ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
      </div>
      <div class="right">
        <div class="tag ${status.class}">${status.label.replace(/[🟢🟡🟠🟣🔴🔵]\s*/, '')}</div>
        <div style="font-size:12px;color:var(--gray);margin-top:2px;">❤️ ${r.pulse} BPM</div>
      </div>
    `;
    div.addEventListener('click', () => showDetail(r));
    container.appendChild(div);
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
      <div class="reading-value">${reading.sys}/${reading.dia}</div>
      <div class="reading-status ${status.class}">${status.label}</div>
      <div class="reading-pulse">❤️ ${reading.pulse} BPM <span class="status ${pulseStatus.class}" style="font-size:12px;padding:2px 10px;display:inline-block;margin-left:8px;">${pulseStatus.label}</span></div>
    </div>
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
    <button class="btn-outline danger-btn mt-8" id="deleteReadingBtn">Delete Reading</button>
  `;

  document.getElementById('deleteReadingBtn')?.addEventListener('click', () => {
    if (confirm('Delete this reading?')) {
      APP.readings = APP.readings.filter(r => r !== reading);
      saveData();
      navigateTo('history');
    }
  });

  navigateTo('detail');
}

// ===== TRENDS =====
let currentTrendDays = 14;
let customTrendFrom = null;
let customTrendTo = null;
let currentChartType = 'bp';

function updateTrends() {
  let filtered = [...APP.readings];

  if (customTrendFrom && customTrendTo) {
    const from = new Date(customTrendFrom);
    const to = new Date(customTrendTo);
    to.setHours(23, 59, 59, 999);
    filtered = filtered.filter(r => {
      const d = new Date(r.timestamp);
      return d >= from && d <= to;
    });
    document.getElementById('trendDateDisplay').textContent =
      `📅 ${new Date(customTrendFrom).toLocaleDateString()} - ${new Date(customTrendTo).toLocaleDateString()}`;
  } else if (currentTrendDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - currentTrendDays);
    filtered = filtered.filter(r => new Date(r.timestamp) >= cutoff);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - currentTrendDays);
    document.getElementById('trendDateDisplay').textContent =
      `📅 Last ${currentTrendDays} days (${fromDate.toLocaleDateString()} - ${new Date().toLocaleDateString()})`;
  } else {
    document.getElementById('trendDateDisplay').textContent = '📅 All time';
  }

  const count = filtered.length;

  if (count === 0) {
    const ids = ['trendAvgBP', 'trendAvgPulse', 'trendHighestBP', 'trendLowestBP', 'trendHighestPulse', 'trendLowestPulse'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '--';
    });
    const percent = document.getElementById('trendConsistencyPercent');
    const grade = document.getElementById('trendConsistencyGrade');
    const detail = document.getElementById('trendConsistencyDetail');
    if (percent) percent.textContent = '0%';
    if (grade) {
      grade.textContent = 'Awful';
      grade.className = 'consistency-grade consistency-grade-awful';
    }
    if (detail) detail.textContent = '0 of 0 expected readings';
    const bpChart = document.getElementById('bpChart');
    const pulseChart = document.getElementById('pulseChart');
    if (bpChart) bpChart.innerHTML = '📊 No data to display';
    if (pulseChart) pulseChart.innerHTML = '📈 No data to display';
    return;
  }

  const sysValues = filtered.map(r => r.sys);
  const diaValues = filtered.map(r => r.dia);
  const pulseValues = filtered.map(r => r.pulse);

  const avgSys = Math.round(sysValues.reduce((a, b) => a + b, 0) / sysValues.length);
  const avgDia = Math.round(diaValues.reduce((a, b) => a + b, 0) / diaValues.length);
  const avgPulse = Math.round(pulseValues.reduce((a, b) => a + b, 0) / pulseValues.length);

  const avgBP = document.getElementById('trendAvgBP');
  const avgPulseEl = document.getElementById('trendAvgPulse');
  if (avgBP) avgBP.textContent = `${avgSys}/${avgDia}`;
  if (avgPulseEl) avgPulseEl.textContent = `${avgPulse} BPM`;

  const maxSys = Math.max(...sysValues);
  const minSys = Math.min(...sysValues);
  const maxDia = Math.max(...diaValues);
  const minDia = Math.min(...diaValues);
  const highestBP = document.getElementById('trendHighestBP');
  const lowestBP = document.getElementById('trendLowestBP');
  if (highestBP) highestBP.textContent = `${maxSys}/${maxDia}`;
  if (lowestBP) lowestBP.textContent = `${minSys}/${minDia}`;

  const maxPulse = Math.max(...pulseValues);
  const minPulse = Math.min(...pulseValues);
  const highestPulse = document.getElementById('trendHighestPulse');
  const lowestPulse = document.getElementById('trendLowestPulse');
  if (highestPulse) highestPulse.textContent = `${maxPulse} BPM`;
  if (lowestPulse) lowestPulse.textContent = `${minPulse} BPM`;

  const days = customTrendFrom && customTrendTo ?
    Math.ceil((new Date(customTrendTo) - new Date(customTrendFrom)) / (1000 * 60 * 60 * 24)) + 1 :
    currentTrendDays;
  const expected = days * 3;
  const actual = count;
  const pct = Math.min(100, Math.round((actual / expected) * 100));
  const grade = getConsistencyGrade(pct);

  const percent = document.getElementById('trendConsistencyPercent');
  const gradeEl = document.getElementById('trendConsistencyGrade');
  const detail = document.getElementById('trendConsistencyDetail');
  if (percent) percent.textContent = `${pct}%`;
  if (gradeEl) {
    gradeEl.textContent = grade.label;
    gradeEl.className = `consistency-grade ${grade.class}`;
  }
  if (detail) detail.textContent = `${actual} of ${expected} expected readings (${days} days × 3 measurements/day)`;

  renderCharts(filtered);
}

function renderCharts(readings) {
  const sorted = [...readings].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (sorted.length < 2) {
    const bpChart = document.getElementById('bpChart');
    const pulseChart = document.getElementById('pulseChart');
    if (bpChart) bpChart.innerHTML = '📊 Need at least 2 readings for trend chart';
    if (pulseChart) pulseChart.innerHTML = '📈 Need at least 2 readings for trend chart';
    return;
  }

  const chartType = currentChartType;

  const bpContainer = document.getElementById('bpChart');
  if (!bpContainer) return;
  bpContainer.innerHTML = '<canvas id="bpChartCanvas"></canvas>';
  const bpCanvas = document.getElementById('bpChartCanvas');
  if (!bpCanvas) return;
  const bpCtx = bpCanvas.getContext('2d');
  bpCanvas.width = bpContainer.clientWidth || 400;
  bpCanvas.height = 200;

  const padding = { top: 20, bottom: 20, left: 40, right: 20 };
  const chartWidth = bpCanvas.width - padding.left - padding.right;
  const chartHeight = bpCanvas.height - padding.top - padding.bottom;

  const allSys = sorted.map(r => r.sys);
  const allDia = sorted.map(r => r.dia);
  const allPulse = sorted.map(r => r.pulse);

  let maxVal = 0;
  if (chartType === 'bp' || chartType === 'combined') {
    maxVal = Math.max(maxVal, ...allSys, ...allDia);
  }
  if (chartType === 'pulse' || chartType === 'combined') {
    maxVal = Math.max(maxVal, ...allPulse);
  }
  maxVal = Math.ceil(maxVal / 10) * 10 + 10;

  bpCtx.clearRect(0, 0, bpCanvas.width, bpCanvas.height);

  bpCtx.strokeStyle = '#EDF2F7';
  bpCtx.lineWidth = 1;
  const numGridLines = Math.min(Math.ceil(maxVal / 10), 20);
  for (let i = 0; i <= numGridLines; i++) {
    const val = (maxVal / numGridLines) * i;
    const y = padding.top + chartHeight - (val / maxVal) * chartHeight;
    bpCtx.beginPath();
    bpCtx.moveTo(padding.left, y);
    bpCtx.lineTo(padding.left + chartWidth, y);
    bpCtx.stroke();
    bpCtx.fillStyle = '#A0AEC0';
    bpCtx.font = '9px Inter';
    bpCtx.fillText(Math.round(val), 2, y + 3);
  }

  function drawLine(values, color, label) {
    const points = values.map((v, i) => ({
      x: padding.left + (i / (values.length - 1)) * chartWidth,
      y: padding.top + chartHeight - (v / maxVal) * chartHeight
    }));

    bpCtx.strokeStyle = color;
    bpCtx.lineWidth = 2.5;
    bpCtx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) bpCtx.moveTo(p.x, p.y);
      else bpCtx.lineTo(p.x, p.y);
    });
    bpCtx.stroke();

    points.forEach(p => {
      bpCtx.fillStyle = color;
      bpCtx.beginPath();
      bpCtx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      bpCtx.fill();
    });

    bpCtx.fillStyle = color;
    bpCtx.fillRect(padding.left + 10, padding.top - 4 + (Object.keys(drawLine.labels || {}).length * 20), 12, 4);
    bpCtx.fillStyle = '#2D3748';
    bpCtx.font = '10px Inter';
    bpCtx.fillText(label, padding.left + 24, padding.top - 6 + (Object.keys(drawLine.labels || {}).length * 20));
    if (!drawLine.labels) drawLine.labels = {};
    drawLine.labels[label] = true;
  }

  drawLine.labels = {};

  if (chartType === 'bp' || chartType === 'combined') {
    drawLine(allSys, '#FF8308', 'Systolic');
    drawLine(allDia, '#101A31', 'Diastolic');
  }

  if (chartType === 'pulse') {
    drawLine(allPulse, '#553C9A', 'Pulse');
  }

  if (chartType === 'combined') {
    drawLine(allPulse, '#553C9A', 'Pulse');
  }

  bpCtx.fillStyle = '#A0AEC0';
  bpCtx.font = '9px Inter';
  const step = Math.max(1, Math.floor(sorted.length / 10));
  for (let i = 0; i < sorted.length; i += step) {
    const x = padding.left + (i / (sorted.length - 1)) * chartWidth;
    const d = new Date(sorted[i].timestamp);
    bpCtx.fillText(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), x - 15, bpCanvas.height - 2);
  }

  if (chartType === 'combined' || chartType === 'pulse') {
    const pulseContainer = document.getElementById('pulseChart');
    if (pulseContainer) {
      pulseContainer.innerHTML = '<canvas id="pulseChartCanvas"></canvas>';
      const pulseCanvas = document.getElementById('pulseChartCanvas');
      if (pulseCanvas) {
        const pulseCtx = pulseCanvas.getContext('2d');
        pulseCanvas.width = pulseContainer.clientWidth || 400;
        pulseCanvas.height = 150;

        const pPadding = { top: 20, bottom: 20, left: 40, right: 20 };
        const pWidth = pulseCanvas.width - pPadding.left - pPadding.right;
        const pHeight = pulseCanvas.height - pPadding.top - pPadding.bottom;

        const pMax = Math.max(...allPulse, 100);
        const pMin = Math.min(...allPulse, 40);
        const pRange = pMax - pMin || 1;

        pulseCtx.clearRect(0, 0, pulseCanvas.width, pulseCanvas.height);

        pulseCtx.strokeStyle = '#EDF2F7';
        pulseCtx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
          const val = pMin + (pRange / 10) * i;
          const y = pPadding.top + pHeight - ((val - pMin) / pRange) * pHeight;
          pulseCtx.beginPath();
          pulseCtx.moveTo(pPadding.left, y);
          pulseCtx.lineTo(pPadding.left + pWidth, y);
          pulseCtx.stroke();
          pulseCtx.fillStyle = '#A0AEC0';
          pulseCtx.font = '8px Inter';
          pulseCtx.fillText(Math.round(val), 2, y + 3);
        }

        const points = allPulse.map((v, i) => ({
          x: pPadding.left + (i / (allPulse.length - 1)) * pWidth,
          y: pPadding.top + pHeight - ((v - pMin) / pRange) * pHeight
        }));

        pulseCtx.strokeStyle = '#553C9A';
        pulseCtx.lineWidth = 2.5;
        pulseCtx.beginPath();
        points.forEach((p, i) => {
          if (i === 0) pulseCtx.moveTo(p.x, p.y);
          else pulseCtx.lineTo(p.x, p.y);
        });
        pulseCtx.stroke();

        points.forEach(p => {
          pulseCtx.fillStyle = '#553C9A';
          pulseCtx.beginPath();
          pulseCtx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          pulseCtx.fill();
        });

        pulseCtx.fillStyle = '#A0AEC0';
        pulseCtx.font = '8px Inter';
        for (let i = 0; i < sorted.length; i += step) {
          const x = pPadding.left + (i / (sorted.length - 1)) * pWidth;
          const d = new Date(sorted[i].timestamp);
          pulseCtx.fillText(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), x - 10, pulseCanvas.height - 2);
        }
      }
    }
  } else {
    const pulseContainer = document.getElementById('pulseChart');
    if (pulseContainer) {
      pulseContainer.innerHTML = '<div style="text-align:center;color:var(--gray);padding:20px;">📈 Pulse chart hidden (select "Pulse Only" or "Combined")</div>';
    }
  }
}

// ===== PROFILE =====
function updateProfile() {
  if (!APP.user) return;
  const u = APP.user;
  const fields = {
    pName: u.name || '--',
    pEmail: u.email || '--',
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
  if (ageEl && u.dob) {
    const age = calculateAge(u.dob);
    ageEl.textContent = age !== null ? `(${age} years)` : '';
  }

  updateAvatarDisplay();
}

// ===== SETUP RECORD =====
function setupRecord() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8);
  const dateInput = document.getElementById('recDate');
  const timeInput = document.getElementById('recTime');
  if (dateInput) dateInput.value = dateStr;
  if (timeInput) timeInput.value = timeStr;
}

function saveReading() {
  const sys = parseInt(document.getElementById('recSys')?.value) || 120;
  const dia = parseInt(document.getElementById('recDia')?.value) || 80;
  const pulse = parseInt(document.getElementById('recPulse')?.value) || 72;
  const dateVal = document.getElementById('recDate')?.value || '';
  const timeVal = document.getElementById('recTime')?.value || '';

  const symptomsSelect = document.getElementById('recSymptoms');
  let symptoms = [];
  if (symptomsSelect) {
    symptoms = Array.from(symptomsSelect.selectedOptions).map(opt => opt.value);
  }
  const otherSymptom = document.getElementById('recOtherSymptom')?.value || '';
  if (symptoms.includes('Other') && otherSymptom) {
    symptoms = symptoms.filter(s => s !== 'Other');
    symptoms.push(otherSymptom);
  }

  let timestamp;
  if (dateVal && timeVal) {
    timestamp = new Date(dateVal + 'T' + timeVal).toISOString();
  } else if (dateVal) {
    timestamp = new Date(dateVal).toISOString();
  } else {
    timestamp = new Date().toISOString();
  }

  const dt = new Date(timestamp);
  const hour = dt.getHours();
  let window = 'Evening';
  if (hour >= 6 && hour < 12) window = 'Morning';
  else if (hour >= 12 && hour < 17) window = 'Afternoon';

  const reading = {
    sys,
    dia,
    pulse,
    timestamp,
    window,
    symptoms: symptoms.join(', '),
    arm: document.getElementById('recArm')?.value || 'Left',
    position: document.getElementById('recPos')?.value || 'Sitting',
    medication: document.getElementById('recMed')?.value || 'Not applicable',
    meal: document.getElementById('recMeal')?.value || 'Not applicable',
    activity: document.getElementById('recAct')?.value || 'Resting',
    intake: document.getElementById('recIntake')?.value || 'None',
    extraNote: document.getElementById('recExtraNote')?.value || ''
  };

  APP.readings.push(reading);
  saveData();

  const status = getBPStatus(sys, dia);
  const pulseStatus = getPulseStatus(pulse);

  const resultBP = document.getElementById('resultBP');
  const resultStatus = document.getElementById('resultStatus');
  const resultPulse = document.getElementById('resultPulse');
  const resultTime = document.getElementById('resultTime');

  if (resultBP) resultBP.textContent = `${sys}/${dia}`;
  if (resultStatus) {
    resultStatus.textContent = status.label;
    resultStatus.className = `result-status ${status.class}`;
  }
  if (resultPulse) resultPulse.textContent = `Pulse: ${pulse} BPM (${pulseStatus.label})`;
  if (resultTime) {
    resultTime.textContent = `Recorded at ${dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;
  }

  const todayReadings = APP.readings.filter(r =>
    new Date(r.timestamp).toDateString() === new Date().toDateString()
  );
  const avgSys = Math.round(todayReadings.reduce((a, r) => a + r.sys, 0) / todayReadings.length);
  const avgDia = Math.round(todayReadings.reduce((a, r) => a + r.dia, 0) / todayReadings.length);

  const resultAvg = document.getElementById('resultAvg');
  const resultCount = document.getElementById('resultCount');
  if (resultAvg) resultAvg.textContent = `Today's average: ${avgSys}/${avgDia}`;
  if (resultCount) resultCount.textContent = `${todayReadings.length} of 3 recommended daily readings`;

  navigateTo('result');
}

// ===== EXPORT FUNCTIONS =====
function getReadingsInRange(fromDate, toDate) {
  let filtered = [...APP.readings];
  if (fromDate) {
    const from = new Date(fromDate);
    filtered = filtered.filter(r => new Date(r.timestamp) >= from);
  }
  if (toDate) {
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);
    filtered = filtered.filter(r => new Date(r.timestamp) <= to);
  }
  return filtered;
}

function generateFileName(prefix, fromDate, toDate) {
  const name = APP.user ? APP.user.name.replace(/\s/g, '_') : 'user';
  const from = fromDate || 'start';
  const to = toDate || 'end';
  return `${name}_${from}_to_${to}.${prefix}`;
}

function exportCSV(fromDate, toDate) {
  const readings = getReadingsInRange(fromDate, toDate);
  if (readings.length === 0) {
    showToast('No readings to export');
    return;
  }

  let csv = 'Date,Time,Window,Systolic,Diastolic,Pulse,Symptoms,Position,Arm,Medication,Meal,Activity,Intake,Notes\n';
  readings.forEach(r => {
    const d = new Date(r.timestamp);
    csv += `${d.toLocaleDateString()},${d.toLocaleTimeString()},${r.window},${r.sys},${r.dia},${r.pulse},"${r.symptoms || ''}","${r.position || ''}","${r.arm || ''}","${r.medication || ''}","${r.meal || ''}","${r.activity || ''}","${r.intake || ''}","${r.extraNote || ''}"\n`;
  });

  const fileName = generateFileName('csv', fromDate, toDate);
  downloadFile(csv, fileName, 'text/csv');
  showToast('📊 CSV exported successfully');
}

function exportBackup(fromDate, toDate) {
  const readings = getReadingsInRange(fromDate, toDate);
  if (readings.length === 0) {
    showToast('No readings to backup');
    return;
  }

  const data = {
    user: APP.user,
    readings: readings,
    avatar: APP.avatar,
    avatarType: APP.avatarType,
    settings: APP.settings,
    exportedAt: new Date().toISOString(),
    dateRange: { from: fromDate, to: toDate }
  };

  const json = JSON.stringify(data, null, 2);
  const fileName = generateFileName('backup', fromDate, toDate);
  downloadFile(json, fileName, 'application/json');
  showToast('💾 Backup file downloaded');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  // ===== LOGIN =====
  document.getElementById('loginBtn')?.addEventListener('click', () => {
    const identifier = document.getElementById('loginEmail')?.value?.trim() || '';
    const password = document.getElementById('loginPassword')?.value || '';
    loginUser(identifier, password);
  });

  document.getElementById('loginPassword')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('loginBtn')?.click();
  });

  // ===== PIN LOGIN =====
  document.getElementById('legacyPinLoginBtn')?.addEventListener('click', () => {
    const pin = document.getElementById('loginPin')?.value || '';
    if (pin.length !== 5) {
      showToast('PIN must be exactly 5 digits');
      return;
    }
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

  // ===== FORGOT PASSWORD =====
  document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    showScreen('forgot');
  });

  document.getElementById('sendResetOtpBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('forgotEmail')?.value?.trim() || '';
    if (!email) {
      showToast('Please enter your email');
      return;
    }
    const stored = loadData();
    if (!stored || !stored.user || stored.user.email !== email) {
      showToast('No account found with this email');
      return;
    }
    const success = await sendOTP(email, stored.user.name, 'reset');
    if (success) {
      showScreen('otp');
      document.getElementById('otpEmailDisplay').textContent = email;
    }
  });

  document.getElementById('backToLoginFromForgot')?.addEventListener('click', () => {
    showScreen('login');
  });

  // ===== OTP VERIFICATION =====
  document.getElementById('verifyOtpBtn')?.addEventListener('click', () => {
    const otp = document.getElementById('otpInput')?.value || '';
    if (otp.length !== 6) {
      showToast('Please enter 6-digit OTP');
      return;
    }
    if (verifyOTP(otp)) {
      if (APP.otpPurpose === 'reset') {
        showScreen('reset');
      } else if (APP.otpPurpose === 'register') {
        completeRegistration();
      } else if (APP.otpPurpose === 'security' && APP._pendingSecurity) {
        if (APP._pendingSecurity.password) APP.user.password = APP._pendingSecurity.password;
        if (APP._pendingSecurity.pin) APP.user.pin = APP._pendingSecurity.pin;
        APP._pendingSecurity = null;
        APP.otpPurpose = null;
        saveData();
        showScreen('profile');
        showToast('Security settings updated after email verification');
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
      const name = stored?.user?.name || 'User';
      await sendOTP(email, name, APP.otpPurpose);
      showToast('OTP resent successfully');
    }
  });

  document.getElementById('cancelOtpBtn')?.addEventListener('click', () => {
    APP.otpCode = null;
    APP.otpPurpose = null;
    showScreen('login');
  });

  // ===== RESET PASSWORD =====
  document.getElementById('resetPasswordBtn')?.addEventListener('click', () => {
    const newPw = document.getElementById('resetNewPw')?.value || '';
    const confirmPw = document.getElementById('resetNewPwConfirm')?.value || '';
    if (newPw.length < 5) {
      showToast('Password must be at least 5 characters');
      return;
    }
    if (newPw !== confirmPw) {
      showToast('Passwords do not match');
      return;
    }
    if (APP.user) {
      APP.user.password = newPw;
      saveData();
      showToast('Password reset successfully');
      showScreen('login');
    }
  });

  document.getElementById('backToLoginFromReset')?.addEventListener('click', () => {
    showScreen('login');
  });

  // ===== REGISTER =====
  document.getElementById('goRegister')?.addEventListener('click', (e) => {
    e.preventDefault();
    showScreen('register');
  });

  document.getElementById('backToLogin')?.addEventListener('click', () => {
    showScreen('login');
  });

  // ===== REGISTRATION - Age Calculation =====
  document.getElementById('regDob')?.addEventListener('change', function() {
    const age = calculateAge(this.value);
    const ageDisplay = document.getElementById('regAge');
    if (ageDisplay && age !== null) {
      ageDisplay.textContent = `Age: ${age} years`;
    }
  });

  // ===== FINISH REGISTRATION =====
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

    let valid = true;

    if (!name) { showToast('Full Name is required'); valid = false; }
    if (!email) { showToast('Email is required'); valid = false; }
    if (!phone) { showToast('Phone Number is required'); valid = false; }
    if (!dob) { showToast('Date of Birth is required'); valid = false; }

    if (password.length < 5) {
      document.getElementById('regPasswordError').style.display = 'block';
      valid = false;
    } else {
      document.getElementById('regPasswordError').style.display = 'none';
    }

    if (password !== passwordConfirm) {
      document.getElementById('regPasswordMatchError').style.display = 'block';
      valid = false;
    } else {
      document.getElementById('regPasswordMatchError').style.display = 'none';
    }

    if (pin.length !== 5 || !/^\d{5}$/.test(pin)) {
      document.getElementById('regPinError').style.display = 'block';
      valid = false;
    } else {
      document.getElementById('regPinError').style.display = 'none';
    }

    if (pin !== pinConfirm) {
      document.getElementById('regPinMatchError').style.display = 'block';
      valid = false;
    } else {
      document.getElementById('regPinMatchError').style.display = 'none';
    }

    const accounts = JSON.parse(localStorage.getItem('mhj:accounts') || '[]');
    if (accounts.length >= 5 && !accounts.includes(email.toLowerCase())) {
      showToast('This device has reached the maximum limit of 5 accounts.');
      valid = false;
    }
    const stored = loadData(email);
    if (stored && stored.user && stored.user.email.toLowerCase() === email.toLowerCase()) {
      showToast('Email already registered. Please login.');
      valid = false;
    }

    if (!valid) return;

    APP.otpPurpose = 'register';
    const success = await sendOTP(email, name, 'register');
    if (success) {
      APP._tempRegistration = {
        name, email, phone, dob, gender, address, bloodGroup,
        relation, emergencyContact: emerg, notes, password, pin
      };
      showScreen('otp');
      document.getElementById('otpEmailDisplay').textContent = email;
    }
  });

  // ===== COMPLETE REGISTRATION =====
  function completeRegistration() {
    const data = APP._tempRegistration;
    if (!data) return;

    APP.user = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      dob: data.dob,
      gender: data.gender,
      address: data.address,
      bloodGroup: data.bloodGroup,
      relation: data.relation,
      emergencyContact: data.emergencyContact,
      notes: data.notes,
      password: data.password,
      pin: data.pin
    };
    APP.readings = [];
    APP.isLoggedIn = true;
    APP._tempRegistration = null;
    APP.otpPurpose = null;

    saveData();
    document.getElementById('readyName').textContent = data.name;
    showScreen('ready');
    showToast('Account created successfully!');
  }

  // ===== START JOURNAL =====
  document.getElementById('startJournalBtn')?.addEventListener('click', () => {
    goToHome();
  });

  // ===== RECORD =====
  document.getElementById('recordFromHome')?.addEventListener('click', () => {
    setupRecord();
    navigateTo('record');
  });

  document.getElementById('cancelRecord')?.addEventListener('click', () => {
    navigateTo('home');
  });

  document.getElementById('resultDoneBtn')?.addEventListener('click', () => {
    navigateTo('home');
  });

  // ===== FAB =====
  document.getElementById('fabRecord')?.addEventListener('click', () => {
    if (APP.isLoggedIn) {
      setupRecord();
      navigateTo('record');
    } else {
      showToast('Please login first');
      showScreen('login');
    }
  });

  // ===== NAVIGATION =====
  document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const screen = btn.dataset.screen;
      if (screen && APP.isLoggedIn) {
        navigateTo(screen);
      } else if (screen) {
        showToast('Please login first');
        showScreen('login');
      }
    });
  });

  // ===== HISTORY FILTERS =====
  document.querySelectorAll('.filter-btn-small').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn-small').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const days = btn.dataset.history;
      const customRange = document.getElementById('historyCustomRange');
      if (days === 'custom') {
        customRange.style.display = 'block';
        historyDays = 0;
      } else {
        customRange.style.display = 'none';
        historyDays = parseInt(days);
        historyCustomFrom = null;
        historyCustomTo = null;
        renderHistory();
      }
    });
  });

  document.getElementById('applyHistoryFilter')?.addEventListener('click', () => {
    const from = document.getElementById('historyFrom')?.value;
    const to = document.getElementById('historyTo')?.value;
    if (from && to) {
      historyCustomFrom = from;
      historyCustomTo = to;
      renderHistory();
    } else {
      showToast('Please select both dates');
    }
  });

  // ===== BACK FROM DETAIL =====
  document.getElementById('backFromDetail')?.addEventListener('click', () => {
    navigateTo('history');
  });

  // ===== TRENDS FILTERS =====
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const days = btn.dataset.days;
      const customRange = document.getElementById('customDateRange');
      if (days === 'custom') {
        customRange.style.display = 'block';
        currentTrendDays = 0;
      } else {
        customRange.style.display = 'none';
        currentTrendDays = parseInt(days);
        customTrendFrom = null;
        customTrendTo = null;
        updateTrends();
      }
    });
  });

  document.getElementById('applyCustomRange')?.addEventListener('click', () => {
    const from = document.getElementById('trendFrom')?.value;
    const to = document.getElementById('trendTo')?.value;
    if (from && to) {
      customTrendFrom = from;
      customTrendTo = to;
      updateTrends();
    } else {
      showToast('Please select both dates');
    }
  });

  // ===== CHART OPTIONS =====
  document.querySelectorAll('.chart-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chart-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentChartType = btn.dataset.chart;
      updateTrends();
    });
  });

  // ===== PROFILE =====
  document.getElementById('editProfileBtn')?.addEventListener('click', () => {
    const u = APP.user;
    if (!u) return;

    document.getElementById('profileView').style.display = 'none';
    document.getElementById('profileEdit').style.display = 'block';

    document.getElementById('editName').value = u.name || '';
    document.getElementById('editEmail').value = u.email || '';
    document.getElementById('editPhone').value = u.phone || '';
    document.getElementById('editDob').value = u.dob || '';
    document.getElementById('editGender').value = u.gender || 'Male';
    document.getElementById('editAddress').value = u.address || '';
    document.getElementById('editBlood').value = u.bloodGroup || 'A+';
    document.getElementById('editEmerg').value = u.emergencyContact || '';
    document.getElementById('editNotes').value = u.notes || '';
  });

  document.getElementById('cancelEditProfile')?.addEventListener('click', () => {
    document.getElementById('profileView').style.display = 'block';
    document.getElementById('profileEdit').style.display = 'none';
  });

  document.getElementById('saveProfileBtn')?.addEventListener('click', () => {
    if (APP.user) {
      APP.user.name = document.getElementById('editName').value.trim() || APP.user.name;
      APP.user.email = document.getElementById('editEmail').value.trim() || APP.user.email;
      APP.user.phone = document.getElementById('editPhone').value.trim() || APP.user.phone;
      APP.user.dob = document.getElementById('editDob').value || APP.user.dob;
      APP.user.gender = document.getElementById('editGender').value || APP.user.gender;
      APP.user.address = document.getElementById('editAddress').value || APP.user.address;
      APP.user.bloodGroup = document.getElementById('editBlood').value || APP.user.bloodGroup;
      APP.user.emergencyContact = document.getElementById('editEmerg').value || APP.user.emergencyContact;
      APP.user.notes = document.getElementById('editNotes').value || APP.user.notes;

      saveData();
      document.getElementById('profileView').style.display = 'block';
      document.getElementById('profileEdit').style.display = 'none';
      updateProfile();
      updateAvatarDisplay();
      document.getElementById('greetingMsg').textContent = getGreeting() + ', ' + APP.user.name;
      showToast('Profile updated successfully');
    }
  });

  // ===== PROFILE AVATAR CLICK =====
  document.getElementById('legacyTopAvatar')?.addEventListener('click', () => {
    if (APP.isLoggedIn) {
      navigateTo('profile');
      setTimeout(() => document.getElementById('editProfileBtn')?.click(), 300);
    }
  });

  // ===== AVATAR UPLOAD =====
  document.getElementById('uploadAvatarBtn')?.addEventListener('click', () => {
    document.getElementById('avatarFileInput')?.click();
  });

  document.getElementById('avatarFileInput')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      showToast('File too large. Please select under 500KB');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
      APP.avatar = event.target.result;
      APP.avatarType = 'photo';
      saveData();
      updateAvatarDisplay();
      showToast('Avatar updated successfully');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  document.getElementById('chooseEmojiBtn')?.addEventListener('click', () => {
    document.getElementById('avatarModal').classList.add('open');
  });

  document.querySelectorAll('.avatar-option').forEach(opt => {
    opt.addEventListener('click', () => {
      APP.avatar = opt.dataset.avatar;
      APP.avatarType = 'emoji';
      saveData();
      updateAvatarDisplay();
      document.getElementById('avatarModal').classList.remove('open');
      showToast('Avatar updated');
    });
  });

  document.getElementById('closeAvatarModal')?.addEventListener('click', () => {
    document.getElementById('avatarModal').classList.remove('open');
  });

  // ===== SECURITY =====
  document.getElementById('securityBtn')?.addEventListener('click', () => {
    document.getElementById('securityModal').classList.add('open');
  });

  document.getElementById('saveSecurityBtn')?.addEventListener('click', async () => {
    const newPw = document.getElementById('secNewPw')?.value || '';
    const newPwConfirm = document.getElementById('secNewPwConfirm')?.value || '';
    const newPin = document.getElementById('secNewPin')?.value || '';
    const newPinConfirm = document.getElementById('secNewPinConfirm')?.value || '';

    if (newPw && newPw.length < 5) {
      showToast('Password must be at least 5 characters');
      return;
    }
    if (newPw && newPw !== newPwConfirm) {
      showToast('Passwords do not match');
      return;
    }
    if (newPin && (newPin.length !== 5 || !/^\d{5}$/.test(newPin))) {
      showToast('PIN must be exactly 5 digits');
      return;
    }
    if (newPin && newPin !== newPinConfirm) {
      showToast('PINs do not match');
      return;
    }

    if (APP.user) {
      if (!newPw && !newPin) return showToast('Enter a new password, PIN, or both');
      APP._pendingSecurity = { password: newPw, pin: newPin };
      const sent = await sendOTP(APP.user.email, APP.user.name, 'security');
      if (!sent) { APP._pendingSecurity = null; return; }
      document.getElementById('securityModal').classList.remove('open');
      document.getElementById('otpEmailDisplay').textContent = APP.user.email;
      showScreen('otp');
      ['secNewPw', 'secNewPwConfirm', 'secNewPin', 'secNewPinConfirm'].forEach(id => {
        document.getElementById(id).value = '';
      });
    }
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

      if (type === 'gdrive') {
        backupToDrive();
        return;
      }

      if (APP.readings.length === 0) {
        showToast('No readings to export');
        return;
      }

      if (type === 'pdf') {
        exportPDF(from, to);
      } else if (type === 'csv') {
        exportCSV(from, to);
      } else if (type === 'backup') {
        exportBackup(from, to);
      }
    });
  });

  // ===== GOOGLE DRIVE =====
  document.getElementById('gdriveConnectBtn')?.addEventListener('click', () => {
    const scriptUrl = document.getElementById('gdriveScriptUrl')?.value?.trim() || '';
    const folderId = document.getElementById('gdriveFolderId')?.value?.trim() || '';

    if (!scriptUrl) {
      showToast('Please enter your Google Apps Script URL');
      return;
    }

    APP.gdriveConfig.scriptUrl = scriptUrl;
    APP.gdriveConfig.folderId = folderId;
    saveData();

    document.getElementById('gdriveModal').classList.remove('open');
    showToast('☁️ Google Drive setup complete');
  });

  document.getElementById('closeGdriveModal')?.addEventListener('click', () => {
    document.getElementById('gdriveModal').classList.remove('open');
  });

  // ===== IMPORT =====
  document.getElementById('importBackupBtn')?.addEventListener('click', () => {
    document.getElementById('fileInput').accept = '.json';
    document.getElementById('fileInput').click();
  });

  document.getElementById('fileInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target.result;
        const preview = document.getElementById('importPreview');
        if (!preview) return;

        const data = JSON.parse(content);
        if (!data.readings || !Array.isArray(data.readings)) {
          preview.innerHTML = '❌ Invalid backup file format';
          return;
        }

        if (data.user && APP.user && data.user.email !== APP.user.email) {
          preview.innerHTML = `⚠️ Patient email mismatch. Found: ${data.user.email}, Current: ${APP.user.email}`;
          return;
        }

        if (data.user && APP.user && data.user.name !== APP.user.name) {
          preview.innerHTML = `⚠️ Patient name mismatch. Found: ${data.user.name}, Current: ${APP.user.name}`;
          return;
        }

        preview.innerHTML = `
          ✅ ${data.readings.length} readings found<br>
          📅 ${data.user ? 'Patient: ' + data.user.name : 'Unknown'}<br>
          📆 ${new Date(data.readings[0]?.timestamp).toLocaleDateString()} - ${new Date(data.readings[data.readings.length-1]?.timestamp).toLocaleDateString()}
          <br><br>
          <button class="btn-primary" id="confirmImportBtn">Import Data</button>
        `;

        document.getElementById('confirmImportBtn')?.addEventListener('click', () => {
          APP.readings = [...APP.readings, ...data.readings];
          saveData();
          preview.innerHTML = `✅ ${data.readings.length} readings successfully added!`;
          showToast(`✅ Imported ${data.readings.length} readings`);
        });
      } catch (err) {
        document.getElementById('importPreview').innerHTML = `❌ Error: ${err.message}`;
        console.error('Import error:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('closeImport')?.addEventListener('click', () => {
    document.getElementById('importModal').classList.remove('open');
  });

  // ===== LOGOUT =====
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
      logoutUser();
    }
  });

  // ===== SETTINGS =====
  document.getElementById('settingsBtn')?.addEventListener('click', () => {
    document.getElementById('appLockToggle').checked = APP.settings.appLock || false;
    document.getElementById('settingsModal').classList.add('open');
  });

  document.getElementById('closeSettingsModal')?.addEventListener('click', () => {
    APP.settings.appLock = document.getElementById('appLockToggle').checked;
    saveData();
    document.getElementById('settingsModal').classList.remove('open');
    showToast('Settings saved');
  });

  document.getElementById('settingsImportBtn')?.addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('open');
    document.getElementById('importModal').classList.add('open');
  });

  document.getElementById('settingsDeleteBtn')?.addEventListener('click', () => {
    if (confirm('⚠️ Are you sure you want to delete ALL data? This cannot be undone!')) {
      if (confirm('Please export your data first as PDF and CSV before deleting.')) {
        if (confirm('Would you like to export your data now?')) {
          document.getElementById('settingsModal').classList.remove('open');
          document.getElementById('exportModal').classList.add('open');
          APP._pendingDelete = true;
          return;
        }
        localStorage.removeItem('bpJournal');
        APP.readings = [];
        APP.user = null;
        APP.isLoggedIn = false;
        document.getElementById('settingsModal').classList.remove('open');
        document.querySelectorAll('.screen-view').forEach(v => v.classList.remove('active'));
        showScreen('login');
        showToast('Account and data deleted');
      }
    }
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

  // ===== TOGGLE PASSWORD VISIBILITY =====
  document.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (target) {
        target.type = target.type === 'password' ? 'text' : 'password';
        btn.textContent = target.type === 'password' ? '👁' : '👁‍🗨';
      }
    });
  });

  // ===== SYMPTOMS MULTI-SELECT =====
  document.getElementById('recSymptoms')?.addEventListener('change', function() {
    const otherGroup = document.getElementById('otherSymptomGroup');
    if (otherGroup) {
      const selected = Array.from(this.selectedOptions).map(opt => opt.value);
      otherGroup.style.display = selected.includes('Other') ? 'block' : 'none';
    }
  });

  // ===== EXPAND DETAILS =====
  document.getElementById('expandDetailsBtn')?.addEventListener('click', () => {
    const extraDetails = document.getElementById('extraDetails');
    if (extraDetails) {
      extraDetails.style.display = extraDetails.style.display === 'none' ? 'block' : 'none';
    }
  });

  // ===== SAVE READING =====
  document.getElementById('saveReadingBtn')?.addEventListener('click', saveReading);

  // ===== MODAL CLOSE ON OVERLAY CLICK =====
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('open');
      }
    });
  });

  // ===== KEYBOARD SHORTCUTS =====
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });

  // ===== RESIZE CHARTS =====
  window.addEventListener('resize', () => {
    if (APP.currentScreen === 'trends') {
      setTimeout(updateTrends, 300);
    }
  });

  console.log('My Health Journal v1.1.0 loaded');
}

// Make functions globally available
window.sendOTP = sendOTP;
window.exportPDF = exportPDF;
window.exportCSV = exportCSV;
window.backupToDrive = backupToDrive;