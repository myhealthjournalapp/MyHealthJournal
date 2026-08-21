/* My Health Journal v1.1 enhancements. Kept separate to preserve the original feature code. */
(function () {
  const byId = id => document.getElementById(id);
  const accountIndex = () => JSON.parse(localStorage.getItem('mhj:accounts') || '[]');

  function toggleSheet(id, show) { const el = byId(id); if (el) el.hidden = !show; }
  byId('openLoginSheet')?.addEventListener('click', () => toggleSheet('loginSheet', true));
  byId('closeLoginSheet')?.addEventListener('click', () => toggleSheet('loginSheet', false));
  byId('pinLoginBtn')?.addEventListener('click', () => toggleSheet('pinSheet', true));
  byId('closePinSheet')?.addEventListener('click', () => toggleSheet('pinSheet', false));
  byId('submitPinLogin')?.addEventListener('click', () => {
    const pin = byId('loginPin')?.value || '';
    const email = localStorage.getItem('mhj:lastActive');
    const record = email ? JSON.parse(localStorage.getItem(`mhj:account:${email}`) || 'null') : null;
    if (!record) return showToast('No recent account is available on this device');
    if (!record.settings?.appLock) return showToast('PIN login is disabled for this account');
    if (pin !== record.user?.pin) return showToast('Invalid PIN');
    loginUser(email, null, pin); toggleSheet('pinSheet', false);
  });
  document.querySelectorAll('[data-recovery]').forEach(btn => btn.addEventListener('click', () => { showScreen('forgot'); }));
  byId('switchAccountBtn')?.addEventListener('click', () => {
    const accounts = accountIndex();
    if (!accounts.length) return showToast('No registered accounts on this device');
    const email = prompt(`Choose an account:\n${accounts.join('\n')}`, accounts[0]);
    if (email && accounts.includes(email)) { byId('loginEmail').value = email; toggleSheet('loginSheet', true); }
  });

  const avatar = byId('topAvatar'), avatarMenu = byId('avatarMenu');
  avatar?.addEventListener('click', e => { if (!APP.isLoggedIn) return; e.stopPropagation(); avatarMenu.hidden = !avatarMenu.hidden; });
  document.addEventListener('click', () => { if (avatarMenu) avatarMenu.hidden = true; });
  avatarMenu?.addEventListener('click', e => {
    const action = e.target.dataset.avatarAction;
    if (!action) return;
    if (action === 'profile') navigateTo('profile');
    if (action === 'security') byId('securityBtn')?.click();
    if (action === 'settings') byId('settingsBtn')?.click();
    if (action === 'logout') logoutUser();
    if (action === 'pdf') exportPDF('', '');
    if (action === 'csv') exportCSV('', '');
    if (action === 'drive') backupToDrive();
  });

  function selectedReadings() {
    const ids = [...document.querySelectorAll('.history-select:checked')].map(x => x.dataset.id);
    return APP.readings.filter(r => ids.includes(String(r.id || r.timestamp)));
  }
  function updateBulkButtons() {
    const count = document.querySelectorAll('.history-select:checked').length;
    ['bulkDeleteBtn', 'bulkExportBtn'].forEach(id => { if (byId(id)) byId(id).disabled = !count; });
  }
  byId('selectAllHistory')?.addEventListener('change', e => { document.querySelectorAll('.history-select').forEach(x => x.checked = e.target.checked); updateBulkButtons(); });
  byId('bulkDeleteBtn')?.addEventListener('click', () => {
    const selected = selectedReadings(); if (!selected.length || !confirm(`Delete ${selected.length} selected readings?`)) return;
    const ids = new Set(selected.map(r => String(r.id || r.timestamp))); APP.readings = APP.readings.filter(r => !ids.has(String(r.id || r.timestamp))); saveData(); renderHistory();
  });
  byId('bulkExportBtn')?.addEventListener('click', () => exportRowsCSV(selectedReadings(), 'selected_readings.csv'));
  document.addEventListener('change', e => { if (e.target.classList?.contains('history-select')) updateBulkButtons(); });

  window.decorateHistoryItems = function () {
    document.querySelectorAll('#historyList .history-item').forEach((item, i) => {
      if (item.querySelector('.history-select')) return;
      const r = [...APP.readings].sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp))[i]; if (!r) return;
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'history-select'; cb.dataset.id = String(r.id || r.timestamp);
      cb.addEventListener('click', e => e.stopPropagation()); item.prepend(cb);
    });
  };

  function csvCell(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }
  function exportRowsCSV(rows, filename) {
    if (!rows.length) return showToast('No readings selected');
    const header = ['Date','Time','Window','Systolic','Diastolic','Pulse','Symptoms','Position','Arm','Medication','Meal','Activity','Intake','Notes'];
    const lines = rows.map(r => { const d = new Date(r.timestamp); return [d.toLocaleDateString(),d.toLocaleTimeString(),r.window,r.sys,r.dia,r.pulse,r.symptoms,r.position,r.arm,r.medication,r.meal,r.activity,r.intake,r.extraNote].map(csvCell).join(','); });
    downloadFile('\ufeff' + [header.join(','), ...lines].join('\r\n'), filename, 'text/csv;charset=utf-8'); showToast('CSV exported successfully');
  }
  window.exportPDF = function (fromDate, toDate, rowsOverride) {
    const rows = rowsOverride || getReadingsInRange(fromDate, toDate); if (!rows.length) return showToast('No readings to export');
    if (!window.jspdf?.jsPDF) return showToast('PDF library could not be loaded. Check your internet connection.');
    showToast('Preparing PDF report...');
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' });
    doc.setFontSize(20); doc.text('My Health Journal', 36, 40); doc.setFontSize(10); doc.text('Log, Track & Live Well!', 36, 57);
    doc.setFontSize(8); const cols = [36,105,175,235,285,345,400,500]; doc.text(['Date','Time','Window','SYS','DIA','Pulse','Status','Symptoms'], cols, 80);
    const maxRows = 48, shown = rows.slice(0, maxRows); shown.forEach((r,i) => { const d = new Date(r.timestamp), y = 100 + i*12; const status = getBPStatus(r.sys,r.dia).label.replace(/[^\x20-\x7E]/g,'').trim(); [d.toLocaleDateString(),d.toLocaleTimeString(),r.window,String(r.sys),String(r.dia),String(r.pulse),status,String(r.symptoms || '-')].forEach((v,j) => doc.text(v.slice(0,j===7?55:22), cols[j], y)); });
    if (rows.length > maxRows) doc.text(`Showing ${maxRows} of ${rows.length} readings to keep this report on one page. Export CSV for the complete dataset.`, 36, 690);
    doc.setFontSize(8); doc.setTextColor(145); doc.text('Developed & Maintained by', 36, 805); doc.setTextColor(85); doc.setFontSize(10); doc.text('WhiteMoon Jeweller | Asad Jewellers, Okara', 36, 820);
    doc.save(generateFileName('pdf', fromDate, toDate)); showToast('PDF exported successfully');
  };
  window.backupToDrive = async function () {
    if (!APP.user) return showToast('Please sign in first'); showToast('Backing up to Google Drive...');
    try { const response = await fetch(APP.gdriveConfig.scriptUrl, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action:'backup',folderId:APP.gdriveConfig.folderId,fileName:`My_Health_Journal_${Date.now()}.json`,data:{user:APP.user,readings:APP.readings,settings:APP.settings}}) }); if (!response.ok) throw new Error(`HTTP ${response.status}`); showToast('Google Drive backup completed'); }
    catch (error) { console.error('Drive backup failed', error); showToast(`Google Drive backup failed: ${error.message}`); }
  };

  byId('biometricLoginBtn')?.addEventListener('click', async () => {
    const email = localStorage.getItem('mhj:lastActive'), record = email && JSON.parse(localStorage.getItem(`mhj:account:${email}`) || 'null');
    if (!record?.settings?.biometric) return showToast('Biometric verification is not enabled for the last active account');
    if (!window.PublicKeyCredential) return showToast('Biometric authentication is not supported by this browser/device');
    showToast('This web version requires a registered WebAuthn credential. Native mobile builds should use the device biometric API.');
  });
  byId('biometricToggle')?.addEventListener('change', e => { APP.settings.biometric = e.target.checked; saveData(); showToast(e.target.checked ? 'Biometric option enabled; device registration is required before use' : 'Biometric option disabled'); });

  function syncChartLayout() {
    const mode = document.querySelector('.chart-option.active')?.dataset.chart || 'bp';
    const containers = document.querySelectorAll('#view-trends .chart-container');
    if (containers[0]) {
      containers[0].hidden = false;
      const title = containers[0].querySelector('h4');
      if (title) title.textContent = mode === 'bp' ? 'Blood Pressure Trend' : mode === 'pulse' ? 'Pulse Trend' : 'BP & Pulse Trend';
    }
    if (containers[1]) containers[1].hidden = true;
  }
  document.querySelectorAll('.chart-option').forEach(button => button.addEventListener('click', () => setTimeout(syncChartLayout, 0)));
  syncChartLayout();

  // Replace pictographic emoji characters with restrained text symbols in both
  // existing and dynamically rendered UI, while leaving user-entered data alone.
  const emojiRange = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
  function normalizeIcons(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (node.parentElement?.matches('input,textarea,option,script,style')) return;
      node.nodeValue = node.nodeValue.replace(emojiRange, '•');
    });
  }
  normalizeIcons(document.body);
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => { if (node.nodeType === 1) normalizeIcons(node); else if (node.nodeType === 3) node.nodeValue = node.nodeValue.replace(emojiRange, '•'); }))).observe(document.body, { childList:true, subtree:true });
})();
