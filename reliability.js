/* Targeted repairs: authenticated flows, export routing, settings and realtime sync. */
let syncTimer = null, syncBusy = false, syncPaused = false, syncUid = null, unsubscribers = [];
let readingBaseline = new Map(), pendingReadings = new Map(), lastSettings = '';
let autoBackupBusy = false, autoRetryAt = 0;

const $id = id => document.getElementById(id);

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function safeUser(user) {
  const copy = { ...user };
  for (const k of ['password', 'pin', 'backupCode', 'backupCodeRaw', 'backupCodeHashed', 'backupCodes', 'backupCodesHashed']) delete copy[k];
  return copy;
}

/* Restore optional measurements without converting blanks into zero or sample data. */
function validateReading(r) {
  if (!r || !Number.isFinite(new Date(r.timestamp).getTime())) throw Error('Backup contains invalid readings.');
  const result = { ...r, id: String(r.id || r.timestamp) };
  for (const k of ['sys', 'dia', 'pulse', 'glucoseValue']) {
    const raw = r[k];
    result[k] = raw == null || raw === '' ? null : Number(raw);
    if (result[k] !== null && !isPresent(result[k])) throw Error('Backup contains an invalid measurement.');
  }
  result.glucoseUnit = r.glucoseUnit || 'mg/dL';
  result.glucoseCategory = r.glucoseCategory || null;
  if (!['mg/dL', 'mmol/L'].includes(result.glucoseUnit) ||
      (result.glucoseCategory !== null && !GLUCOSE_CATEGORIES.includes(result.glucoseCategory))) {
    throw Error('Backup contains invalid glucose units or timing.');
  }
  if (result.glucoseValue !== null &&
      (result.glucoseValue > (result.glucoseUnit === 'mmol/L' ? 120 : 2000) || !result.glucoseCategory)) {
    throw Error('Backup contains invalid glucose data.');
  }
  if (result.glucoseCategory && result.glucoseValue === null) {
    throw Error('Backup contains glucose timing without a value.');
  }
  if ((result.sys === null) !== (result.dia === null)) throw Error('Systolic and diastolic must both be entered.');
  if (['sys', 'dia', 'pulse'].some(k => result[k] !== null && result[k] >= 1000)) throw Error('Backup contains an invalid measurement.');
  if (['sys', 'dia', 'pulse', 'glucoseValue'].every(k => result[k] === null)) throw Error('Backup contains an empty reading.');
  return result;
}

function readingKey(r) {
  return encodeURIComponent(String(r.id || r.timestamp));
}

function persistOutbox() {
  if (syncUid) localStorage.setItem('mhj:outbox:' + syncUid, JSON.stringify([...pendingReadings]));
}

function scheduleSync() {
  if (syncPaused || !APP.isLoggedIn || !APP.user?.uid || syncUid !== APP.user.uid) return;
  const next = new Map(APP.readings.map(r => [readingKey(r), JSON.stringify(r)]));
  for (const [id, value] of next) if (readingBaseline.get(id) !== value) pendingReadings.set(id, JSON.parse(value));
  for (const id of readingBaseline.keys()) if (!next.has(id)) pendingReadings.set(id, null);
  readingBaseline = next;
  persistOutbox();
  clearTimeout(syncTimer);
  syncTimer = setTimeout(flushSync, 300);
}

async function flushSync() {
  if (syncBusy || syncPaused || !syncUid || firebase.auth().currentUser?.uid !== syncUid) return;
  syncBusy = true;
  const uid = syncUid;
  try {
    const root = firebase.firestore().collection('users').doc(uid);
    while (pendingReadings.size && syncUid === uid) {
      const operations = [...pendingReadings].slice(0, 400);
      const batch = firebase.firestore().batch();
      for (const [id, value] of operations) {
        const ref = root.collection('readings').doc(id);
        value === null ? batch.delete(ref) : batch.set(ref, value);
      }
      await batch.commit();
if (syncUid !== uid) return;
// Only notify when actual readings were written (not on empty sync).
if (operations.length > 0) {
  sendEmailTemplate('DATA_SYNC_COMPLETE', null, { readingsCount: operations.length });
}
for (const [id, value] of operations) {
  if (JSON.stringify(pendingReadings.get(id)) === JSON.stringify(value)) pendingReadings.delete(id);
}
persistOutbox();
    }
    const settings = JSON.stringify(APP.settings);
    if (syncUid === uid && settings !== lastSettings) {
      await root.update({ settings: APP.settings });
      lastSettings = settings;
    }
  } catch (e) {
    console.error('Realtime sync:', e);
    showToast('Saved on this device. Cloud sync is pending; retry when connected.');
  } finally {
    syncBusy = false;
  }
}

function stopSync() {
  clearTimeout(syncTimer);
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
  syncUid = null;
  pendingReadings = new Map();
  readingBaseline = new Map();
}

function startSync() {
  stopSync();
  syncUid = APP.user.uid;
  const uid = syncUid;
  const root = firebase.firestore().collection('users').doc(uid);
  try {
    pendingReadings = new Map(JSON.parse(localStorage.getItem('mhj:outbox:' + uid) || '[]'));
  } catch {
    pendingReadings = new Map();
  }
  readingBaseline = new Map(APP.readings.map(r => [readingKey(r), JSON.stringify(r)]));
  lastSettings = JSON.stringify(APP.settings);
  const onError = e => {
    console.error('Live updates:', e);
    showToast('Cloud updates unavailable. Check your connection and sign in again.');
  };
  unsubscribers.push(root.collection('readings').onSnapshot(snapshot => {
    if (syncUid !== uid) return;
    const rows = new Map(snapshot.docs.map(d => [d.id, { ...d.data(), id: d.data().id || d.id }]));
    for (const [id, value] of pendingReadings) value === null ? rows.delete(id) : rows.set(id, value);
    APP.readings = [...rows.values()];
    readingBaseline = new Map(APP.readings.map(r => [readingKey(r), JSON.stringify(r)]));
    syncPaused = true;
    saveData();
    syncPaused = false;
    if (APP.currentScreen === 'history') renderHistory();
    if (APP.currentScreen === 'home') updateHome();
    if (APP.currentScreen === 'trends') updateTrends();
  }, onError));
  unsubscribers.push(root.onSnapshot(snapshot => {
    if (syncUid !== uid || !snapshot.exists) return;
    const user = snapshot.data();
    APP.user = { ...APP.user, ...safeUser(user), uid };
    if (user.settings && JSON.stringify(APP.settings) === lastSettings) {
      APP.settings = { ...APP.settings, ...user.settings };
      lastSettings = JSON.stringify(APP.settings);
    }
    syncPaused = true;
    saveData();
    syncPaused = false;
    if (APP.currentScreen === 'profile') updateProfile();
  }, onError));
  unsubscribers.push(root.collection('emailLogs').onSnapshot(snapshot => {
    if (syncUid !== uid) return;
    APP.emailLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    syncPaused = true;
    saveData();
    syncPaused = false;
  }, onError));
  flushSync();
}

async function getUserDataFromFirestore(uid) {
  const snap = await firebase.firestore().collection('users').doc(uid).get();
  return snap.exists ? snap.data() : null;
}

async function loadReadingsFromFirestore(uid) {
  const snap = await firebase.firestore().collection('users').doc(uid).collection('readings').get();
  return snap.docs.map(d => ({ ...d.data(), id: d.data().id || d.id }));
}

async function loginWithFirebase(email, password) {
  return (await firebase.auth().signInWithEmailAndPassword(email, password)).user;
}

/* ------------------------------------------------------------------ */
/* Email index (local)                                                 */
/* ------------------------------------------------------------------ */

function _readEmailIndex() {
  try { return JSON.parse(localStorage.getItem('mhj:emailIndex') || '{}'); }
  catch { return {}; }
}
function _writeEmailIndex(map) {
  try { localStorage.setItem('mhj:emailIndex', JSON.stringify(map)); }
  catch (e) { console.error('emailIndex write:', e); }
}
function _setEmailIndex(email, uid) { const m = _readEmailIndex(); m[email] = uid; _writeEmailIndex(m); }
function _delEmailIndex(email) { const m = _readEmailIndex(); delete m[email]; _writeEmailIndex(m); }
function _pinKey(uid) { return 'mhj:pin:' + uid; }

/* ------------------------------------------------------------------ */
/* Login                                                               */
/* ------------------------------------------------------------------ */

async function loginUser(identifier, password = null, pin = null) {
  try {
    const stored = loadData(identifier);
    const email = (identifier.includes('@') ? identifier : stored?.user?.email || '').trim().toLowerCase();
    if (!email) throw Error('Enter your email address.');
    let current;
    if (pin) {
      const uid = _readEmailIndex()[email];
      if (!uid) throw Error('PIN not set for this account. Sign in with email and password once.');
      const rec = JSON.parse(localStorage.getItem(_pinKey(uid)) || 'null');
      if (!rec?.localPin) throw Error('PIN not set for this account. Sign in with email and password once.');
      if (rec.localPin !== btoa(pin + ':' + uid)) throw Error('Incorrect PIN.');
      if (!rec.localCreds) throw Error('PIN login unavailable on this device. Use email and password once.');
      current = (await firebase.auth().signInWithEmailAndPassword(rec.localCreds.email, atob(rec.localCreds.pw))).user;
    } else {
      current = await loginWithFirebase(email, password);
      try {
        const uid = current.uid;
        const rec = JSON.parse(localStorage.getItem(_pinKey(uid)) || '{}');
        rec.localCreds = { email, pw: btoa(password) };
        localStorage.setItem(_pinKey(uid), JSON.stringify(rec));
        _setEmailIndex(email, uid);
      } catch (err) { console.error('Cache creds:', err); }
    }
    await hydrateUser(current, stored);

    sendEmailTemplate('LOGIN_ALERT', null, {
      deviceId: getDeviceId(),
      device: (typeof mhjDetectDevice === 'function') ? mhjDetectDevice() : 'Unknown Device',
      loginMethod: pin ? 'PIN' : 'Password'
    });

    // Fire DEVICE_ADDED only if this device ID has never been seen before
    const seenDevices = JSON.parse(localStorage.getItem('mhj:seenDevices') || '[]');
    const thisDevice = getDeviceId();
    if (!seenDevices.includes(thisDevice)) {
      sendEmailTemplate('DEVICE_ADDED', null, { device: (typeof mhjDetectDevice === 'function') ? mhjDetectDevice() : 'Unknown Device' });
      seenDevices.push(thisDevice);
      localStorage.setItem('mhj:seenDevices', JSON.stringify(seenDevices));
    }

    setTimeout(() => { if (typeof checkScheduledSummaries === 'function') checkScheduledSummaries(); }, 5000);
    goToHome();

    showToast('Welcome back, ' + APP.user.name + '!');
    return true;
  } catch (e) {
    console.error('Login:', e);
    showToast(e.message);
    return false;
  }
}

async function hydrateUser(current, stored) {
  const user = await getUserDataFromFirestore(current.uid);
  if (!user) throw Error('Your profile could not be loaded.');
  APP.user = {
    ...safeUser(user),
    uid: current.uid,
    email: current.email,
    createdAt: user.createdAt || current.metadata.creationTime
  };
  APP.readings = await loadReadingsFromFirestore(current.uid);
  if (stored?.readings?.length && !stored.syncVersion) {
    const cloudKeys = new Set(APP.readings.map(readingKey));
    const legacy = stored.readings.map(validateReading).filter(x => !cloudKeys.has(readingKey(x)));
    let outbox = [];
    try { outbox = JSON.parse(localStorage.getItem('mhj:outbox:' + current.uid) || '[]'); } catch { }
    localStorage.setItem('mhj:outbox:' + current.uid, JSON.stringify([
      ...new Map([...outbox, ...legacy.map(x => [readingKey(x), x])])
    ]));
  }
  APP.avatar = stored?.avatar || '';
  APP.avatarType = stored?.avatarType || 'initials';
  APP.settings = {
    appLock: false, biometric: false, dateFormat: 'DD/MM/YYYY',
    autoBackup: false, autoBackupInterval: 'daily',
    ...(stored?.settings || {}),
    ...(user.settings || {})
  };
  APP.emailLogs = stored?.emailLogs || [];
  APP.isLoggedIn = true;
  APP.lastAutoBackup = APP.settings.lastAutoBackup || null;
  APP._sessionBackupCode = null;
  startSync();
  saveData();
}

async function logoutUser({ notify = true } = {}) {
  if (notify && APP.user) await sendEmailTemplate('LOGOUT');
  await flushSync();
  stopSync();
  await firebase.auth().signOut();
  failedExports.clear();
  APP.user = null;
  APP.isLoggedIn = false;
  APP.readings = [];
  APP.emailLogs = [];
  APP.avatar = '';
  APP.avatarType = 'initials';
  APP.pinBuffer = '';
  APP._sessionBackupCode = null;
  APP._recoveryTicket = null;
  APP._challengeId = null;
  document.querySelectorAll('.modal-overlay').forEach(e => e.classList.remove('open'));
  document.querySelectorAll('.mhj-dialog').forEach(e => e.remove());
  $id('profileView').classList.remove('hidden');
  $id('profileEdit').classList.remove('active');
  showScreen('login');
  showToast('Logged out');
}

/* ------------------------------------------------------------------ */
/* OTP — client-side generation, Worker sends the email                */
/* ------------------------------------------------------------------ */

async function sendOTP(email, name, purpose) {
  try {
    const r = await mhjApi('requestOTP', {
      email, name, purpose,
      recoveryEmail: purpose === 'register' ? $id('regRecoveryEmail')?.value : ''
    });
    // Store the challenge in sessionStorage so we can verify locally.
    sessionStorage.setItem('mhj:otp', JSON.stringify({
      challengeId: r.challengeId,
      code: r.code,
      email,
      purpose,
      expiresAt: r.expiresAt
    }));
    APP._challengeId = r.challengeId;
    APP.otpEmail = email;
    APP.otpPurpose = purpose;
    APP._recoveryTicket = null;
    $id('otpError').style.display = 'none';
    showToast('A verification code has been sent to your email.');
    return true;
  } catch (e) {
    console.error('OTP request:', e);
    showToast(e.message);
    return false;
  }
}

async function verifyOTP(code) {
  try {
    const raw = sessionStorage.getItem('mhj:otp');
    if (!raw) throw new Error('No verification in progress. Please request a new code.');
    const stored = JSON.parse(raw);
    if (Date.now() > stored.expiresAt) {
      sessionStorage.removeItem('mhj:otp');
      throw new Error('This code has expired. Request a new one.');
    }
    if (stored.code !== code) throw new Error('Incorrect code.');
    sessionStorage.removeItem('mhj:otp');
    APP._recoveryTicket = crypto.randomUUID();
    return true;
  } catch (e) {
    console.error('OTP verification:', e);
    showToast(e.message);
    return false;
  }
}

async function confirmEmailVerification(type) {
  const user = await getUserDataFromFirestore(APP.user.uid);
  APP.user = { ...APP.user, ...safeUser(user) };
  saveData();
  updateProfile();
  if (type === 'primary') {
    sendEmailTemplate('PRIMARY_EMAIL_VERIFIED', null, { email: APP.user.email });
  } else {
    sendEmailTemplate('RECOVERY_EMAIL_VERIFIED', null, { email: APP.user.recoveryEmail });
  }
  showToast(type === 'primary' ? 'Primary email verified' : 'Recovery email verified');
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

async function completeRegistration() {
  try {
    const data = APP._tempRegistration;
    if (!data) throw Error('Please complete the registration form again.');
    const cred = await firebase.auth().createUserWithEmailAndPassword(data.email, data.password);
    const current = cred.user;
    const profile = {
      name: data.name,
      email: data.email,
      recoveryEmail: data.recoveryEmail || '',
      phone: data.phone,
      dob: data.dob,
      gender: data.gender,
      address: data.address,
      bloodGroup: data.bloodGroup,
      relation: data.relation,
      emergencyContact: data.emergencyContact,
      notes: data.notes,
      createdAt: new Date().toISOString(),
      emailVerified: false,
      recoveryEmailVerified: false
    };
    await firebase.firestore().collection('users').doc(current.uid).set(profile);
    // Cache PIN locally
    const pinRec = { localPin: btoa(data.pin + ':' + current.uid) };
    localStorage.setItem(_pinKey(current.uid), JSON.stringify(pinRec));
    _setEmailIndex(data.email.toLowerCase(), current.uid);
    // Save local credentials too so PIN login works right away
    pinRec.localCreds = { email: data.email.toLowerCase(), pw: btoa(data.password) };
    localStorage.setItem(_pinKey(current.uid), JSON.stringify(pinRec));
    await hydrateUser(current, null);
    sendEmailTemplate('WELCOME');
    APP._tempRegistration = null;
    APP._recoveryTicket = null;
    APP.otpPurpose = null;
    $id('readyName').textContent = data.name;
    showScreen('ready');
    showToast('Account created successfully');
  } catch (e) {
    console.error('Registration:', e);
    showToast(e.message);
  }
}

/* ------------------------------------------------------------------ */
/* Backup codes — client-side generation, Worker archives a copy       */
/* ------------------------------------------------------------------ */

function getBackupCode() { return APP._sessionBackupCode || null; }

function verifyBackupCode() { throw Error('Enter your backup code to continue.'); }

async function generateNewBackupCode() {
  try {
    const r = await mhjApi('generateCode', { uid: APP.user?.uid });
    APP._sessionBackupCode = r.code;

    // Persist to Firestore so it survives login sessions.
    try {
      await firebase.firestore()
        .collection('users').doc(APP.user.uid)
        .collection('backupCodes').doc('current')
        .set({
          code: r.code,
          createdAt: new Date().toISOString(),
          used: false,
          usedAt: null
        });
    } catch (e) {
      console.error('Failed to persist backup code:', e);
    }

    if (!r.archived) showToast('New code generated, but Drive upload failed. Download it and retry later.');
    return r.code;
  } catch (e) {
    console.error('Backup code:', e);
    showToast(e.message);
    return null;
  }
}

/* Load the current backup code from Firestore (survives sessions). */
async function loadCurrentBackupCode() {
  if (!APP.user?.uid) return null;
  try {
    const doc = await firebase.firestore()
      .collection('users').doc(APP.user.uid)
      .collection('backupCodes').doc('current')
      .get();
    if (!doc.exists) return null;
    return doc.data();
  } catch (e) {
    console.error('Load backup code:', e);
    return null;
  }
}

/* Mark the current backup code as used. */
async function markBackupCodeUsed() {
  if (!APP.user?.uid) return;
  try {
    await firebase.firestore()
      .collection('users').doc(APP.user.uid)
      .collection('backupCodes').doc('current')
      .set({ used: true, usedAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.error('Mark backup code used:', e);
  }
}


/* ------------------------------------------------------------------ */
/* Backup data                                                         */
/* ------------------------------------------------------------------ */

function buildBackupData() {
  return {
    app: 'My Health Journal',
    version: '1.0.0',
    user: safeUser(APP.user),
    readings: APP.readings.map(validateReading),
    avatar: APP.avatar,
    avatarType: APP.avatarType,
    settings: APP.settings,
    exportedAt: new Date().toISOString()
  };
}

function generateFileName(ext) {
  const type = { pdf: 'REPORT', csv: 'CSV', backup: 'DATA', json: 'DATA' }[ext] || ext.toUpperCase();
  return `${generateDriveFileName(type, APP.user.name, APP.user.uid, APP.user.createdAt)}.${ext === 'backup' ? 'json' : ext}`;
}

function localDownload(content, name, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const failedExports = new Map();

function downloadFile(content, name, mime, type) {
  type = type || (mime.startsWith('text/csv') ? 'CSV' : mime === 'application/pdf' ? 'REPORT' : 'DATA');
  const ext = mime.startsWith('text/csv') ? 'csv'
    : mime === 'application/pdf' ? 'pdf'
    : mime === 'text/plain' ? 'txt'
    : 'json';
  const filename = `${generateDriveFileName(type, APP.user.name, APP.user.uid, APP.user.createdAt)}.${ext}`;
  localDownload(content, filename, mime);
  if (!isUserSignedIn()) { showToast('Downloaded locally. Connect Google Drive to save Drive copies.'); return; }
  archiveExport(content, type, ext, mime.split(';')[0]).then(result => {
    const ok = result.adminDrive && result.userDrive;
    if (ok) {
      showToast('Downloaded and saved to Drive');
    } else {
      throw new Error('Drive upload failed');
    }
  }).catch(e => {
    console.error('Export archive:', e);
    const id = crypto.randomUUID();
    failedExports.set(id, { content, type, ext, mime: mime.split(';')[0], uid: APP.user?.uid });
    showToast('Downloaded locally; Drive upload failed. Open Email delivery logs to retry.');
  });
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

function csvCell(v) {
  const s = String(v ?? '');
  return '"' + (/^[=+\-@\t\r]/.test(s) ? "'" : '') + s.replace(/"/g, '""') + '"';
}

function exportCSV(from, to) {
  const rows = getReadingsInRange(from, to);
  if (!rows.length) return showToast('No readings to export');
  const header = ['Date', 'Time', 'Window', 'Systolic', 'Diastolic', 'Pulse',
    'Glucose', 'Glucose Unit', 'Glucose Category', 'Glucose Classification',
    'Symptoms', 'Position', 'Arm', 'Medication', 'Meal', 'Activity', 'Intake', 'Notes'];
  const lines = rows.map(r => {
    const d = new Date(r.timestamp);
    return [
      d.toLocaleDateString(), d.toLocaleTimeString(), r.window,
      isPresent(r.sys) ? r.sys : null,
      isPresent(r.dia) ? r.dia : null,
      isPresent(r.pulse) ? r.pulse : null,
      isPresent(r.glucoseValue) ? r.glucoseValue : null,
      isPresent(r.glucoseValue) ? (r.glucoseUnit || 'mg/dL') : null,
      r.glucoseCategory || null,
      getGlucoseStatus(r.glucoseValue, r.glucoseCategory, r.glucoseUnit).classification,
      r.symptoms, r.position, r.arm, r.medication, r.meal, r.activity, r.intake, r.extraNote
    ].map(csvCell).join(',');
  });
  downloadFile('\ufeff' + [header.join(','), ...lines].join('\r\n'), generateFileName('csv'), 'text/csv', 'CSV');
}

function exportBackup(from, to) {
  const data = buildBackupData();
  data.readings = getReadingsInRange(from, to).map(validateReading);
  data.dateRange = { from: from || null, to: to || null };
  downloadFile(JSON.stringify(data, null, 2), generateFileName('backup'), 'application/json', 'DATA');
}

function downloadBackupCodeFile(value) {
  if (!value) return showToast('Generate a new backup code first.');
  downloadFile(JSON.stringify({
    uid: APP.user.uid,
    code: value,
    createdAt: new Date().toISOString(),
    instructions: 'Single use. Profile > Security > Generate New Code > Download Backup Code.'
  }, null, 2), '', 'application/json', 'CODES');
}

/* ------------------------------------------------------------------ */
/* Dialog helper                                                       */
/* ------------------------------------------------------------------ */

function dialog(title, html) {
  document.querySelector('.mhj-dialog')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'mhj-dialog';
  overlay.innerHTML = `<section class="mhj-dialog-panel" role="dialog" aria-modal="true" aria-label="${escapeHTML(title)}"><div class="dialog-top"><h3>${escapeHTML(title)}</h3><button class="btn-secondary" data-close>Cancel</button></div>${html}</section>`;
  document.body.appendChild(overlay);
  const previous = document.activeElement;
  const close = () => { overlay.remove(); previous?.focus(); };
  overlay.querySelector('[data-close]').onclick = close;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'Tab') {
      const els = [...overlay.querySelectorAll('button,input,select,a[href]')].filter(x => !x.disabled && !x.hidden);
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  overlay.querySelector('button').focus();
  return overlay;
}

/* ------------------------------------------------------------------ */
/* Logs                                                                */
/* ------------------------------------------------------------------ */

async function getLogs() {
  const root = firebase.firestore().collection('users').doc(APP.user.uid);
  let activities = APP.user.changeLogs || [];
  let emails = APP.emailLogs || [];
  try {
    const [a, e] = await Promise.all([root.collection('activityLogs').get(), root.collection('emailLogs').get()]);
    activities = [...activities, ...a.docs.map(d => d.data())];
    emails = e.docs.map(d => d.data());
  } catch (e) {
    console.error('Load logs:', e);
    showToast('Showing logs available on this device; cloud logs could not be loaded.');
  }
  return { activities, emails };
}

async function downloadChangeLogs(range, fields, from, to) {
  const all = await getLogs();
  let logs = [...all.activities, ...all.emails.map(l => ({ ...l, type: 'email' }))];
  if (!fields.includes('complete')) logs = logs.filter(l => fields.includes(l.type));
  let lower = range === 'custom' ? new Date(from + 'T00:00:00')
    : range === 'max' ? new Date(0)
    : new Date(Date.now() - Number.parseInt(range) * 86400000);
  let upper = range === 'custom' ? new Date(to + 'T23:59:59.999') : new Date();
  if (!Number.isFinite(+lower) || !Number.isFinite(+upper) || lower > upper) throw Error('Choose a valid date range.');
  logs = logs.filter(l => new Date(l.timestamp) >= lower && new Date(l.timestamp) <= upper)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const type = fields.length === 1 && fields[0] === 'email' ? 'EMAIL' : 'LOGS';
  downloadFile(JSON.stringify({
    uid: APP.user.uid,
    registeredAt: mhjDate(APP.user.createdAt).toISOString(),
    generatedAt: new Date().toISOString(),
    range: { from: lower.toISOString(), to: upper.toISOString() },
    logs
  }, null, 2), '', 'application/json', type);
    sendEmailTemplate('CHANGE_LOGS_DOWNLOADED', null, {
    logRange: range === 'max' ? 'All time' : `${range} days`,
    logTypes: fields.join(', ')
  });
}

function openLogs() {
  const d = dialog('Download logs', `
    <label>Date range<select id="logRange">
      <option value="max">All time</option>
      ${[1, 3, 7, 14, 30, 60, 90, 180].map(n => `<option value="${n}D">Last ${n} days</option>`).join('')}
      <option value="custom">Custom</option>
    </select></label>
    <div id="logCustom" hidden>
      <label>From<input type="date" id="logFrom"></label>
      <label>To<input type="date" id="logTo"></label>
    </div>
    <label>Log type<select id="logType">
      <option value="complete">All logs</option>
      <option value="profile">Profile changes</option>
      <option value="security">Password, PIN and backup codes</option>
      <option value="email">Email delivery</option>
      <option value="reading">Readings</option>
      <option value="export">Exports</option>
    </select></label>
    <button class="btn-primary" id="downloadLogsBtn">Download</button>`);
  $id('logRange').onchange = () => { $id('logCustom').hidden = $id('logRange').value !== 'custom'; };
  $id('downloadLogsBtn').onclick = async () => {
    try {
      await downloadChangeLogs($id('logRange').value, [$id('logType').value], $id('logFrom').value, $id('logTo').value);
      d.remove();
    } catch (e) { showToast(e.message); }
  };
}

async function openEmailLogs() {
  const { emails } = await getLogs();
  const d = dialog('Email delivery logs', `
    <button class="btn-secondary" id="retryExportsBtn">Retry pending uploads (${[...failedExports.values()].filter(x => x.uid === APP.user.uid).length})</button>
    <button class="btn-secondary" id="downloadEmailLogBtn">Download email logs</button>
    <p class="settings-help">Pending uploads can be retried while this tab remains open.</p>
    ${emails.length
      ? emails.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .map(l => `<div class="log-row"><strong>${escapeHTML(l.template)}</strong><br>${l.success ? 'Sent' : 'Failed'} · ${escapeHTML(l.timestamp)}${l.error ? '<br>' + escapeHTML(l.error) : ''}</div>`).join('')
      : '<p>No delivery logs yet.</p>'}`);
   $id('downloadEmailLogBtn').onclick = () => {
    sendEmailTemplate('EMAIL_LOGS_DOWNLOADED', null, { email: APP.user.email });
    downloadChangeLogs('max', ['email']);
  };
  $id('retryExportsBtn').onclick = async () => {
    let failed = 0;
    for (const [id, item] of failedExports) {
      if (item.uid !== APP.user.uid) continue;
      try {
        await archiveExport(item.content, item.type, item.ext, item.mime);
        failedExports.delete(id);
      } catch (e) { failed++; console.error('Retry upload:', e); }
    }
    showToast(failed ? 'Some uploads still failed.' : 'Pending uploads saved');
    d.remove();
  };
}

/* ------------------------------------------------------------------ */
/* Auto backup timer                                                   */
/* ------------------------------------------------------------------ */

async function checkAutoBackup() {
  if (autoBackupBusy || Date.now() < autoRetryAt || !APP.isLoggedIn || !APP.settings.autoBackup) return;
  const days = Number(APP.settings.autoBackupInterval === 'daily' ? 1 : APP.settings.autoBackupInterval);
  if (!Number.isFinite(days) || days < 1) return;
  const last = Date.parse(APP.settings.lastAutoBackup || 0) || 0;
  if (Date.now() - last < days * 86400000) return;
  autoBackupBusy = true;
  try {
    if (!await backupToDriveV2(true)) autoRetryAt = Date.now() + 15 * 60000;
  } finally {
    autoBackupBusy = false;
  }
}

/* ------------------------------------------------------------------ */
/* Binding helper                                                      */
/* ------------------------------------------------------------------ */

function bind(id, handler) {
  $id(id)?.addEventListener('click', async e => {
    e.preventDefault();
    const button = e.currentTarget;
    if (button.disabled) return;
    button.disabled = true;
    try { await handler(e); }
    catch (err) { console.error(id + ':', err); showToast(err.message); }
    finally { button.disabled = false; }
  });
}

/* ------------------------------------------------------------------ */
/* DOM wiring                                                          */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
  if (window.MHJ_CONFIG?.appCheckSiteKey && firebase.appCheck) {
    firebase.appCheck().activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(MHJ_CONFIG.appCheckSiteKey), true);
  }
  
    bind('saveProfileBtn', async () => {
    const old = APP.user;
    const mapping = {
      name: 'editName', email: 'editEmail', recoveryEmail: 'editRecoveryEmail',
      phone: 'editPhone', dob: 'editDob', gender: 'editGender', address: 'editAddress',
      bloodGroup: 'editBlood', emergencyContact: 'editEmerg', notes: 'editNotes'
    };
    const user = Object.fromEntries(Object.entries(mapping).map(([k, id]) => [k, $id(id).value.trim()]));

    // Save directly to Firestore from the client — no server needed.
    await firebase.firestore().collection('users').doc(APP.user.uid).set(user, { merge: true });
    APP.user = { ...APP.user, ...user };

    if (old.email !== APP.user.email) {
      localStorage.removeItem('mhj:account:' + old.email.toLowerCase());
      const accounts = JSON.parse(localStorage.getItem('mhj:accounts') || '[]').filter(x => x !== old.email.toLowerCase());
      localStorage.setItem('mhj:accounts', JSON.stringify(accounts));
    }
    saveData();
    sendEmailTemplate('PROFILE_UPDATED', null, { oldProfile: old, newProfile: APP.user });
    if (old.email !== APP.user.email) {
      sendEmailTemplate('PRIMARY_EMAIL_CHANGED', null, { oldEmail: old.email, newEmail: APP.user.email });
    }
    if (old.recoveryEmail !== APP.user.recoveryEmail) {
      sendEmailTemplate('RECOVERY_EMAIL_CHANGED', null, { newEmail: APP.user.recoveryEmail });
    }
    $id('profileView').classList.remove('hidden');
    $id('profileEdit').classList.remove('active');
    updateProfile();
    updateAvatarDisplay();
    showToast('Profile updated');
  });

  for (const [id, kind, pw, confirm] of [
    ['resetPasswordBtn', 'password', 'resetNewPw', 'resetNewPwConfirm'],
    ['resetPinBtn', 'pin', 'resetNewPin', 'resetNewPinConfirm']
  ]) {
    bind(id, async () => {
      if ($id(pw).value !== $id(confirm).value) throw Error('Confirmation does not match.');
            if (kind === 'password') {
        await firebase.auth().sendPasswordResetEmail(APP.otpEmail || '');
        sendEmailTemplate('PSWD_RESET_REQUEST');
      } else {
        sendEmailTemplate('PIN_RESET_REQUEST');
      }
      APP._recoveryTicket = null;
      $id(pw).value = '';
      $id(confirm).value = '';
      showScreen('login');
      showToast(kind === 'pin' ? 'PIN reset successfully' : 'Password reset request sent');
    });
  }

  bind('verifyBackupCodeBtn', async () => {
    const kind = APP._pendingBackupAction === 'reset-pin' ? 'pin' : 'password';
    const r = await mhjApi('backupRecover', {
      email: $id('backupCodeEmail').value,
      code: $id('backupCodeInput').value,
      kind
    });
    await markBackupCodeUsed();
    sendEmailTemplate('BACKUP_CODES_USED', null, { action: kind === 'pin' ? 'PIN reset via backup code' : 'Password reset via backup code' });
    sendEmailTemplate('ACCOUNT_RECOVERED');
    APP._recoveryTicket = r.ticket;
    $id('backupCodeVerifyModal').classList.remove('open');
    $id('backupCodeInput').value = '';
    APP._pendingBackupAction = null;
    showScreen(kind === 'pin' ? 'reset-pin' : 'reset');
  });


    bind('saveSecurityBtn', async () => {
    const password = $id('secNewPw').value;
    const pin = $id('secNewPin').value;
    if (password !== $id('secNewPwConfirm').value || pin !== $id('secNewPinConfirm').value) {
      throw Error('Confirmation does not match.');
    }
    const uid = APP.user.uid;
    const rec = JSON.parse(localStorage.getItem(_pinKey(uid)) || '{}');
    if (pin) rec.localPin = btoa(pin + ':' + uid);
    if (password) rec.localCreds = { email: APP.user.email.toLowerCase(), pw: btoa(password) };
    localStorage.setItem(_pinKey(uid), JSON.stringify(rec));
    _setEmailIndex(APP.user.email.toLowerCase(), uid);

    if (password && firebase.auth().currentUser) {
      try { await firebase.auth().currentUser.updatePassword(password); }
      catch (e) { console.warn('Password update:', e); }
    }

    APP.settings.appLock = $id('appLockToggle').checked;
    saveData();

    if (password) sendEmailTemplate('PASSWORD_CHANGE_CONFIRMATION');
    if (pin) sendEmailTemplate('PIN_CHANGE_CONFIRMATION');

    for (const id of ['secNewPw', 'secNewPwConfirm', 'secNewPin', 'secNewPinConfirm']) $id(id).value = '';
    $id('securityModal').classList.remove('open');
    showToast('Security settings updated');
  });


  bind('settingsLogsBtn', openLogs);
  bind('emailLogsBtn', openEmailLogs);

  bind('connectGoogleBtn', async () => {
    if (await signInToGoogle()) {
      sendEmailTemplate('GOOGLE_DRIVE_CONNECTED', null, { driveEmail: APP.googleConnectedEmail || APP.user?.email });
      autoRetryAt = 0;
      renderDriveStatus();
      checkAutoBackup();
    }
  });

  bind('gdriveConnectBtn', async () => {
    if (await signInToGoogle()) $id('gdriveModal').classList.remove('open');
  });

  $id('autoBackupInterval').onchange = () => {
    $id('autoBackupDaysLabel').hidden = $id('autoBackupInterval').value !== 'custom';
  };
    bind('disconnectGoogleBtn', () => {
    disconnectGoogle();
    renderDriveStatus();
    showToast('Google Drive Disconnected');
  });
  
bind('settingsBtn', () => {
  const summaryKeys = ['readingReminder','weeklySummary','fortnightlySummary','monthlySummary'];
  for (const k of summaryKeys) {
    const el = $id(k);
    if (el) el.checked = !!APP.settings[k];
  }
  const auto = $id('autoBackupDaily');
  if (auto) auto.checked = !!APP.settings.autoBackup;

  const value = String(APP.settings.autoBackupInterval === 'daily' ? 1 : APP.settings.autoBackupInterval || 1);
  const known = [...$id('autoBackupInterval').options].some(o => o.value === value);
  $id('autoBackupInterval').value = known ? value : 'custom';
  $id('autoBackupDaysLabel').hidden = known;
  $id('autoBackupDays').value = known ? '' : value;

  if (typeof renderDriveStatus === 'function') renderDriveStatus();
  $id('settingsModal').classList.add('open');
});

bind('saveNotificationSettings', async () => {
  for (const k of ['readingReminder','weeklySummary','fortnightlySummary','monthlySummary']) APP.settings[k]=$id(k).checked;
  saveData(); await flushSync(); showToast('Email Preferences Saved');
});
  bind('saveAutoBackupBtn', async () => {
    const choice=$id('autoBackupInterval').value, days=Number(choice==='custom'?$id('autoBackupDays').value:choice);
    if (!Number.isInteger(days)||days<1||days>3650) throw Error('Enter a whole number of days from 1 to 3650.');
    const wasOn=!!APP.settings.autoBackup, old=APP.settings.autoBackupInterval;
    APP.settings.autoBackup=$id('autoBackupDaily').checked;
    APP.settings.autoBackupInterval=days===1?'daily':String(days);
    saveData(); await flushSync(); autoRetryAt=0;
    const interval=d=>Number(d==='daily'?1:d)===1?'Daily':`Every ${d} Days`;
    const context={backupInterval:interval(APP.settings.autoBackupInterval),oldInterval:interval(old),newInterval:interval(APP.settings.autoBackupInterval)};
    if (!wasOn&&APP.settings.autoBackup) sendEmailTemplate('AUTO_BACKUP_ENABLED',null,context);
    else if (wasOn&&!APP.settings.autoBackup) sendEmailTemplate('AUTO_BACKUP_DISABLED',null,context);
    else if (wasOn&&APP.settings.autoBackup&&interval(old)!==context.newInterval) sendEmailTemplate('AUTO_BACKUP_SCHEDULE_CHANGED',null,context);
    showToast('Backup Schedule Saved'); checkAutoBackup();
  });

  bind('clearLocalBtn', async () => {
    const d = dialog('Clear local data', `<p>This removes this account's saved data from this device and signs you out. Cloud data remains available after you sign in again.</p><button id="confirmClearLocal" class="btn-primary">Clear and sign out</button>`);
    bind('confirmClearLocal', async () => {
      const uid = APP.user.uid, email = APP.user.email.toLowerCase();
      await flushSync();
      if (syncBusy || pendingReadings.size) throw Error('Cloud sync is pending. Connect and sync before clearing local data.');
      sendEmailTemplate('LOCAL_DATA_CLEARED');
      await logoutUser({ notify: false });
      removeLocalAccount(uid, email);
      d.remove();
      showToast('Local Data Cleared');
    });
  });

  bind('clearJournalBtn', () => {
    let backedUp=false;
    const d=dialog('Clear Journal, Keep Account', `<p>Delete all journal readings? Your account and profile will remain.</p><button class="btn-secondary" id="backupBeforeClear">Download Backup First</button><p id="clearBackupStatus" role="status"></p><button class="btn-primary" id="confirmClearJournal">Clear Journal</button>`);
    bind('backupBeforeClear', async()=>{
      $id('confirmClearJournal').disabled=true;
      try { await backupBeforeDestruction(); backedUp=true; $id('clearBackupStatus').textContent='Backup downloaded and saved to both Drives.'; }
      finally { $id('confirmClearJournal').disabled=false; }
    });
    bind('confirmClearJournal',async()=>{
      await flushSync();
      if(syncBusy||pendingReadings.size) throw Error('Sync your pending changes first.');
      syncPaused=true;
      try {
        const root=firebase.firestore().collection('users').doc(APP.user.uid);
        await deleteCollectionInBatches(root.collection('readings'));
        APP.readings=[]; pendingReadings.clear(); readingBaseline.clear(); persistOutbox(); saveData();
        sendEmailTemplate('JOURNAL_CLEARED',null,{backupChoice:backedUp?'Yes, downloaded and saved to both Drives':'No'});
      } finally {syncPaused=false;}
      d.remove();updateHome();showToast(backedUp?'Data Backed Up. Journal Cleared; Account Kept':'Journal Cleared; Account Kept');
    });
  });
  bind('settingsDeleteBtn', () => {
    let backupChoice=null;
    const d=dialog('Download Backup Before Deleting?', `<p>Choose Yes to download a backup and save copies to both Drives, or No to proceed without a backup. Existing exported files are not deleted.</p><button class="btn-secondary" id="backupBeforeDelete">Yes</button><button class="btn-secondary" id="noBackupBeforeDelete">No</button><p id="deleteBackupStatus" role="status"></p><div id="deleteFinalStep" hidden><p><label><input type="checkbox" id="deleteAcknowledge"> I understand that deleting my account and data is permanent.</label></p><button class="btn-primary" id="confirmDeleteAccount" disabled>Delete Account Permanently</button></div>`);
    bind('backupBeforeDelete',async()=>{
      $id('noBackupBeforeDelete').disabled=true;
      $id('confirmDeleteAccount').disabled=true;
      try {
        await backupBeforeDestruction();backupChoice=true;
        $id('deleteBackupStatus').textContent='Backup downloaded and saved to both Drives.';
        $id('deleteFinalStep').hidden=false;
      } finally {$id('noBackupBeforeDelete').disabled=false;$id('confirmDeleteAccount').disabled=backupChoice===null||!$id('deleteAcknowledge').checked;}
    });
    bind('noBackupBeforeDelete',()=>{backupChoice=false;$id('deleteBackupStatus').textContent='Proceeding without a backup.';$id('deleteFinalStep').hidden=false;});
    $id('deleteAcknowledge').onchange=()=>{$id('confirmDeleteAccount').disabled=!$id('deleteAcknowledge').checked;};
    bind('confirmDeleteAccount',async()=>{
      if(backupChoice===null||!$id('deleteAcknowledge').checked) throw Error('Choose a backup option and acknowledge deletion.');
      const user={...APP.user}, uid=user.uid, email=user.email.toLowerCase();
      const context={backupChoice:backupChoice?'Yes, downloaded and saved to both Drives':'No'};
      const authUser=firebase.auth().currentUser;
      if(!authUser||authUser.uid!==uid) throw Error('Sign in again before deleting your account.');
      // Firebase requires recent authentication for Auth deletion. Check before deleting Firestore data.
      const token=await authUser.getIdTokenResult();
      if(Date.now()-Date.parse(token.authTime)>5*60*1000) throw Error('Please sign out and sign in again, then retry account deletion.');
      await flushSync();
      if(syncBusy||pendingReadings.size) throw Error('Sync your pending changes first.');
      await sendEmailTemplate('ACCOUNT_DELETION_REQUEST',user,context);
      syncPaused=true;
      try {
        const root=firebase.firestore().collection('users').doc(uid);
        // These are the subcollections written by this client; deleting a document does not cascade.
        for(const collection of ['readings','medicalRecords','activityLogs','emailLogs']) await deleteCollectionInBatches(root.collection(collection));
        await root.delete();
        await authUser.delete();
        await sendEmailTemplate('ACCOUNT_DELETED_CONFIRMATION',user,context);
        stopSync(); await logoutUser({notify:false});removeLocalAccount(uid,email);
      } finally {syncPaused=false;}
      d.remove();showToast(backupChoice?'Data Backed Up and Account Deleted':'Account and Data Deleted');
    });
  });

  setInterval(checkAutoBackup, 60000);
  window.addEventListener('online', () => { flushSync(); checkAutoBackup(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { flushSync(); checkAutoBackup(); }
  });

  for (const id of ['closeExport', 'closeImport', 'cancelOtpBtn', 'cancelRecord', 'cancelBackupCodeVerify']) {
    const el = $id(id);
    if (el && el.parentElement) el.parentElement.prepend(el);
  }
});

function removeLocalAccount(uid, email) {
  localStorage.removeItem('mhj:account:' + email);
  localStorage.removeItem('mhj:outbox:' + uid);
  localStorage.removeItem(_pinKey(uid));
  _delEmailIndex(email);
  const accounts = JSON.parse(localStorage.getItem('mhj:accounts') || '[]').filter(x => x !== email);
  localStorage.setItem('mhj:accounts', JSON.stringify(accounts));
  if (localStorage.getItem('mhj:lastActive') === email) localStorage.removeItem('mhj:lastActive');
  try {
    const old = JSON.parse(localStorage.getItem('bpJournal') || 'null');
    if (old?.user?.uid === uid || old?.user?.email?.toLowerCase() === email) localStorage.removeItem('bpJournal');
  } catch { }
}

window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled operation:', event.reason);
  showToast('An operation failed. Please retry; details are available in the console.');
});

function getDeviceId() {
  let id = localStorage.getItem('mhj:deviceId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('mhj:deviceId', id);
  }
  return id;
}

async function deleteCollectionInBatches(collection) {
  for (;;) {
    const snapshot=await collection.limit(400).get();
    if(snapshot.empty) return;
    const batch=firebase.firestore().batch();snapshot.docs.forEach(doc=>batch.delete(doc.ref));await batch.commit();
  }
}
async function backupBeforeDestruction() {
  await flushSync();
  if(syncBusy||pendingReadings.size) throw Error('Wait for cloud sync before backing up.');
  if(!isUserSignedIn()&&!(await signInToGoogle())) throw Error('Connect Google Drive to save both backup copies.');
  const content=JSON.stringify(buildBackupData(),null,2);
  const result=await archiveExport(content,'DATA','json','application/json',{userCopy:true});
  if(!result.userDrive||!result.adminDrive) throw Error('Both Drive copies must finish before deletion. Retry the backup or explicitly choose No.');
  localDownload(content,generateFileName('backup'),'application/json');
  await sendEmailTemplate('FULL_DATA_BACKUP_CONFIRMATION',null,{readingsCount:APP.readings.length});
}
function renderDriveStatus() {
  const statusEl = document.getElementById('googleDriveStatus');
  const connectBtn = document.getElementById('connectGoogleBtn');
  const disconnectBtn = document.getElementById('disconnectGoogleBtn');
  if (!statusEl) return;

  const connected = (typeof isDriveConnected === 'function')
    ? isDriveConnected()
    : (typeof isUserSignedIn === 'function' && isUserSignedIn());

  if (connected && APP.googleConnectedEmail) {
    statusEl.textContent = `Connected as: ${APP.googleConnectedEmail}`;
    statusEl.className = 'settings-help connected';
    if (connectBtn) connectBtn.style.display = 'none';
    if (disconnectBtn) disconnectBtn.style.display = 'inline-block';
  } else if (connected) {
    statusEl.textContent = 'Connected';
    statusEl.className = 'settings-help connected';
    if (connectBtn) connectBtn.style.display = 'none';
    if (disconnectBtn) disconnectBtn.style.display = 'inline-block';
    // Try to fetch the email if we don't have it yet.
    if (typeof fetchGoogleAccountEmail === 'function') {
      fetchGoogleAccountEmail().then(email => {
        if (email) {
          APP.googleConnectedEmail = email;
          if (typeof persistGoogleDrive === 'function') persistGoogleDrive();
          statusEl.textContent = `Connected as: ${email}`;
        }
      }).catch(() => {});
    }
  } else {
    statusEl.textContent = 'Not connected. Tap Connect Google Drive to enable backups.';
    statusEl.className = 'settings-help disconnected';
    if (connectBtn) connectBtn.style.display = 'inline-block';
    if (disconnectBtn) disconnectBtn.style.display = 'none';
  }
}