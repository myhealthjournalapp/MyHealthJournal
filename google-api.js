/* My Health Journal — Google Drive and Worker integration.
   Replaces the missing Firebase Cloud Function with a Cloudflare Worker.
   All server-side calls now go to window.MHJ_CONFIG.workerBaseUrl. */

const MASTER_FOLDER_ID = '1dMnCqrDz6TGBgrQon-5NgbUFP3R4zosM';
const DEV_FOLDER_ID = '1G5PB6HOafBNcb-OYkhsIFjg8ReKGfp7X';

/* Admin-side Drive folders (used by the Worker for mirrors). */
const FOLDER_IDS = {
  FULL_DATA_BACKUP: DEV_FOLDER_ID,
  BACKUP_CODES:     '1bnKZujEUmLroWtR4Yr6-w_n9yDKoDRH7',
  PDF_REPORTS:      '1NRb9nN9OFci_bZ9uQUo7eugrhtQRegBa',
  CSV_EXPORTS:      '1u3mjB7M9PeVDqYGeGbBFHLz88SlCjALA',
  CHANGE_LOGS:      '1A9DuxxLdUk9HGXx9DDHfUTixC3sc7Adp',
  EMAIL_LOGS:       '1VXuE69S3nnxtlmBi7L4bBnwRgY65F8dP',
  MEDICAL_RECORDS:  '1CklF60BOFP1XHzSAabnMaVee9nKkjX-n'
};

/* App kind → Worker type. The app uses internal labels; the Worker expects
   these exact names. */
const WORKER_TYPE_MAP = {
  DATA:            'FULL_DATA_BACKUP',
  REPORT:          'PDF_REPORTS',
  CSV:             'CSV_EXPORTS',
  LOGS:            'CHANGE_LOGS',
  EMAIL:           'EMAIL_LOGS',
  CODES:           'BACKUP_CODES',
  MEDICAL_RECORDS: 'MEDICAL_RECORDS'
};

/* User-side Drive folder names — created on demand in the user's own Drive. */
const USER_FOLDER_NAMES = {
  ROOT:            'My Health Journal',
  BACKUPS:         'Backups',
  EXPORTS:         'Exports',
  MEDICAL_RECORDS: 'Medical Records'
};

const GOOGLE_DRIVE_STORAGE_KEY = 'mhj:googleDrive';

let googleApiToken = null;
let googleTokenExpiresAt = 0;
let googleConnectPromise = null;
let cachedUserRootFolderId = null;

/* ------------------------------------------------------------------ */
/* Restore persisted Drive token on load                               */
/* ------------------------------------------------------------------ */

function restoreGoogleDrive() {
  try {
    const raw = localStorage.getItem(GOOGLE_DRIVE_STORAGE_KEY);
    if (!raw) return;
    const stored = JSON.parse(raw);
    if (stored.expiresAt && Date.now() < stored.expiresAt - 60000) {
      googleApiToken = stored.token;
      googleTokenExpiresAt = stored.expiresAt;
      if (typeof APP !== 'undefined' && APP) {
        APP.googleConnectedEmail = stored.email || null;
      }
    } else {
      localStorage.removeItem(GOOGLE_DRIVE_STORAGE_KEY);
    }
  } catch (e) { /* ignore */ }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', restoreGoogleDrive);
} else {
  restoreGoogleDrive();
}

function persistGoogleDrive() {
  try {
    localStorage.setItem(GOOGLE_DRIVE_STORAGE_KEY, JSON.stringify({
      token: googleApiToken,
      expiresAt: googleTokenExpiresAt,
      email: (typeof APP !== 'undefined' && APP && APP.googleConnectedEmail) || null
    }));
  } catch (e) { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/* Worker client                                                       */
/* ------------------------------------------------------------------ */

async function mhjApi(action, payload = {}) {
  const base = (window.MHJ_CONFIG?.workerBaseUrl || '').trim();
  if (!base) throw new Error('Worker URL is not configured.');
  const headers = { 'Content-Type': 'application/json' };
  try {
    const current = firebase.auth().currentUser;
    if (current) headers.Authorization = `Bearer ${await current.getIdToken()}`;
  } catch (_) { /* auth may not be ready yet; Worker does not require it */ }
  const response = await fetch(base, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...payload }),
    signal: AbortSignal.timeout(action === 'event' ? 15000 : 120000)
  });
  const result = await response.json().catch(() => ({ error: 'The server returned an invalid response.' }));
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

/* ------------------------------------------------------------------ */
/* Google OAuth (user-side)                                            */
/* ------------------------------------------------------------------ */

function isUserSignedIn() {
  return !!googleApiToken && Date.now() < googleTokenExpiresAt - 60000;
}

function isDriveConnected() {
  return isUserSignedIn();
}

function getDriveStatus() {
  if (isDriveConnected()) {
    return { connected: true, email: (APP && APP.googleConnectedEmail) || null };
  }
  return { connected: false, email: null };
}

async function fetchGoogleAccountEmail() {
  if (!googleApiToken) return null;
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${googleApiToken}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.email || null;
  } catch { return null; }
}

async function initGoogleApi(interactive = false) {
  if (isUserSignedIn()) return true;
  if (!interactive) return false;
  if (googleConnectPromise) return googleConnectPromise;

  googleConnectPromise = new Promise((resolve, reject) => {
    const clientId = window.MHJ_CONFIG?.googleClientId;
    if (!clientId) return reject(new Error('Google Drive is not configured. Ask the Administrator to complete Google setup.'));
    if (!window.google?.accounts?.oauth2) return reject(new Error('Google sign-in could not load. Check your connection.'));

    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
      hint: (typeof APP !== 'undefined' && APP && APP.user && typeof APP.user.email === 'string' && APP.user.email.includes('@')) ? APP.user.email : undefined,      callback: async res => {
        if (res.error) return reject(new Error(res.error));
        googleApiToken = res.access_token;
        googleTokenExpiresAt = Date.now() + Number(res.expires_in || 3600) * 1000;
        try {
          const email = await fetchGoogleAccountEmail();
          if (typeof APP !== 'undefined' && APP) APP.googleConnectedEmail = email || null;
        } catch (_) { /* ignore */ }
        persistGoogleDrive();
        resolve(true);
      },
      error_callback: err => reject(new Error(err.type || 'Google sign-in was cancelled.'))
    });
    client.requestAccessToken({ prompt: 'select_account' });
  });

  try { return await googleConnectPromise; }
  finally { googleConnectPromise = null; }
}

async function signInToGoogle() {
  try {
    await initGoogleApi(true);
    showToast('Google Drive connected');
    return true;
  } catch (e) {
    console.error('Google connection:', e);
    showToast(e.message);
    return false;
  }
}

function disconnectGoogle() {
  googleApiToken = null;
  googleTokenExpiresAt = 0;
  cachedUserRootFolderId = null;
  if (typeof APP !== 'undefined' && APP) APP.googleConnectedEmail = null;
  localStorage.removeItem(GOOGLE_DRIVE_STORAGE_KEY);
  localStorage.removeItem('google_api_token');
}

/* ------------------------------------------------------------------ */
/* Drive helpers (user-side, via drive.file scope)                     */
/* ------------------------------------------------------------------ */

async function driveFetch(path, options = {}) {
  if (!isUserSignedIn()) throw new Error('Google Drive is not connected.');
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${googleApiToken}`,
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Drive ${options.method || 'GET'} ${path} failed: ${txt}`);
  }
  return res.json();
}

async function findOrCreateUserFolder(name, parentId) {
  const q = parentId
    ? `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`
    : `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false`;
  const search = await driveFetch(`files?q=${encodeURIComponent(q)}&fields=files(id,name)`);
  if (search.files?.length) return search.files[0].id;
  const body = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) body.parents = [parentId];
  const created = await driveFetch('files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return created.id;
}

async function getUserFolderId(kind) {
  if (!isUserSignedIn()) throw new Error('Google Drive is not connected.');
  if (!cachedUserRootFolderId) {
    cachedUserRootFolderId = await findOrCreateUserFolder(USER_FOLDER_NAMES.ROOT, null);
  }
  if (kind === 'ROOT') return cachedUserRootFolderId;
  return findOrCreateUserFolder(USER_FOLDER_NAMES[kind], cachedUserRootFolderId);
}

async function uploadUserDriveFile(blob, fileName, mimeType, folderKind) {
  const folderId = await getUserFolderId(folderKind);
  const boundary = '-------mhjuser' + Date.now();
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const base64url = await blobToBase64Url(blob);

  // Convert base64url back to standard base64 for Google's upload endpoint.
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const paddingNeeded = (4 - (base64.length % 4)) % 4;
  if (paddingNeeded) base64 += '='.repeat(paddingNeeded);

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n${base64}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${googleApiToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body
    }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`User Drive upload failed: ${txt}`);
  }
  return res.json();
}

async function blobToBase64Url(blob) {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* ------------------------------------------------------------------ */
/* File name helpers                                                    */
/* ------------------------------------------------------------------ */

function mhjDate(value) {
  const date = value?.toDate
    ? value.toDate()
    : value?.seconds
      ? new Date(value.seconds * 1000)
      : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('Registration date is missing or invalid. Sign in again to retrieve your account date.');
  }
  return date;
}

function generateDriveFileName(type, name, uid, registered) {
  if (!uid) throw new Error('A Firebase User ID is required for exports.');
  const numeric = d =>
    `${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCMonth() + 1).padStart(2, '0')}${d.getUTCFullYear()}`;
  const clean = v => String(v).replace(/[^\p{L}\p{N}_-]/gu, '_');
  return `MHJ_${clean(type)}_${clean(name || 'User')}_${clean(uid)}_${numeric(mhjDate(registered))}-${numeric(new Date())}`;
}

/* ------------------------------------------------------------------ */
/* archiveExport — the single entry point for all uploads              */
/* ------------------------------------------------------------------ */

async function archiveExport(content, kind, extension, mimeType, opts = {}) {
  if (!isUserSignedIn()) throw new Error('Connect your Google Drive before sending copies to either Drive.');
  const user = APP.user;
  if (!user?.uid) throw new Error('Sign in before exporting.');
  const fileName = `${generateDriveFileName(kind, user.name, user.uid, user.createdAt)}.${extension}`;
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });

  const result = { fileName, userDrive: false, adminDrive: false, userError: null, adminError: null };

  // 1) Admin side via Worker (Worker holds admin credentials).
  //    Translate the app's kind to the Worker's expected type name.
  const workerType = WORKER_TYPE_MAP[kind] || kind;
  try {
    const base64 = await blobToBase64Url(blob);
    const workerResult = await mhjApi('upload', {
      type: workerType,
      fileName,
      mimeType,
      base64
    });
    if (workerResult?.success) {
      result.adminDrive = true;
      result.adminFileId = workerResult.fileId;
      result.adminWebViewLink = workerResult.webViewLink;
    }
  } catch (e) {
    console.error('Admin Drive upload:', e);
    result.adminError = e.message;
  }

  // 2) User side via user's own OAuth token.
  if (isUserSignedIn()) {
    try {
      const folderKind = kind === 'MEDICAL_RECORDS'
        ? 'MEDICAL_RECORDS'
        : kind === 'DATA'
          ? 'BACKUPS'
          : 'EXPORTS';
      const userResult = await uploadUserDriveFile(blob, fileName, mimeType, folderKind);
      result.userDrive = true;
      result.userFileId = userResult.id;
      result.userWebViewLink = userResult.webViewLink;
    } catch (e) {
      console.error('User Drive upload:', e);
      result.userError = e.message;
    }
  } else if (opts.userCopy) {
    result.userError = 'User Drive not connected.';
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* Backup (full data) to Drive                                         */
/* ------------------------------------------------------------------ */

async function backupToDriveV2(automatic = false) {
  try {
    if (!APP.user) throw new Error('Please sign in first.');
    if (!isUserSignedIn()) {
      if (automatic) {
        // Skip silently once per session rather than spamming errors.
        if (!backupToDriveV2._skipNotified) {
          backupToDriveV2._skipNotified = true;
          showToast('Automatic backup skipped — Google Drive is not connected.');
        }
        return false;
      }
      if (!(await signInToGoogle())) return false;
    }
    showToast('Saving backup…');
    const result = await archiveExport(
      JSON.stringify(buildBackupData(), null, 2),
      'DATA',
      'json',
      'application/json',
      { userCopy: true, automatic }
    );

    // Partial success: accept whichever Drive received the file.
    if (!result.adminDrive && !result.userDrive) {
      if (typeof sendEmailTemplate === 'function') {
        sendEmailTemplate('BACKUP_FAILED', null, {
          error: (result.userError || '') + ' | ' + (result.adminError || '')
        });
      }
      throw new Error('Backup failed. Check your connection and Google Drive access, then retry.');
    }

    sendEmailTemplate(
      automatic ? 'AUTO_BACKUP_COMPLETED' : 'FULL_DATA_BACKUP_CONFIRMATION',
      null,
      { readingsCount: APP.readings.length }
    );

    APP.lastAutoBackup = new Date().toISOString();
    APP.settings.lastAutoBackup = APP.lastAutoBackup;
    saveData();

    if (result.userDrive && result.adminDrive) {
      showToast('Backup saved to both Drives');
    } else if (result.userDrive) {
      showToast('Backup saved to your Drive (Administrator copy failed — will retry later).');
    } else {
      showToast('Backup saved to Administrator Drive (your Drive copy failed).');
    }
    return true;
  } catch (e) {
    console.error('Backup:', e);
    showToast(e.message);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Legacy stubs kept for API compatibility                             */
/* ------------------------------------------------------------------ */

async function sendEmailViaGmail() {
  throw new Error('Use mhjApi("event") to send email.');
}

async function uploadPDFToDrive(blob) {
  return archiveExport(blob, 'REPORT', 'pdf', 'application/pdf');
}

async function uploadCSVToDrive(content) {
  return archiveExport(content, 'CSV', 'csv', 'text/csv');
}

async function uploadChangeLogsToDrive(logs) {
  return archiveExport(JSON.stringify(logs), 'LOGS', 'json', 'application/json');
}

async function uploadEmailLogsToDrive(logs) {
  return archiveExport(JSON.stringify(logs), 'EMAIL', 'json', 'application/json');
}

async function backupCodesToDrive(codes) {
  return archiveExport(JSON.stringify({ codes }), 'CODES', 'json', 'application/json');
}

window.backupToDrive = backupToDriveV2;

/* ------------------------------------------------------------------ */
/* Medical Records upload                                              */
/* ------------------------------------------------------------------ */

async function uploadMedicalRecord(blob, fileName) {
  if (!(blob instanceof Blob)) throw new Error('Invalid file.');
  if (blob.type && blob.type !== 'application/pdf') throw new Error('Only PDF files are accepted.');
  if (blob.size > 10 * 1024 * 1024) throw new Error('File exceeds 10 MB limit.');
  if (!isUserSignedIn()) {
    // The caller (Medical Records button) is responsible for connecting
    // before opening the file picker. If we reach here without a token,
    // it means the caller flow was bypassed.
    throw new Error('Google Drive is not connected. Tap Connect Google Drive in Settings first.');
  }
  const result = await archiveExport(blob, 'MEDICAL_RECORDS', 'pdf', 'application/pdf', { userCopy: true });
  if (!result.adminDrive && !result.userDrive) {
    throw new Error('Medical record upload failed. Please retry.');
  }
  return result;
}