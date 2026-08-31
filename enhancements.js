/* My Health Journal v1.1 enhancements. Kept separate to preserve the original feature code. */
(function () {
  const byId = id => document.getElementById(id);
  const accountIndex = () => JSON.parse(localStorage.getItem('mhj:accounts') || '[]');

  function toggleSheet(id, show) { const el = byId(id); if (el) el.hidden = !show; }
  function syncLoginOptions() {
    const email = localStorage.getItem('mhj:lastActive');
    const record = email ? JSON.parse(localStorage.getItem(`mhj:account:${email}`) || 'null') : null;
    if (byId('pinLoginBtn')) byId('pinLoginBtn').hidden = !record?.settings?.appLock;
    if (byId('biometricLoginBtn')) byId('biometricLoginBtn').hidden = !record?.settings?.biometric;
  }
  byId('openLoginSheet')?.addEventListener('click', () => { toggleSheet('pinSheet', false); toggleSheet('loginSheet', true); });
  byId('closeLoginSheet')?.addEventListener('click', () => toggleSheet('loginSheet', false));
  byId('pinLoginBtn')?.addEventListener('click', () => { toggleSheet('loginSheet', false); toggleSheet('pinSheet', true); });
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
document.querySelectorAll('[data-recovery]').forEach(btn => {
  btn.addEventListener('click', () => { 
    const type = btn.dataset.recovery;
    if (type === 'pin') {
      showScreen('pin-reset');
    } else {
      showScreen('forgot');
    }
  });
});
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
    if (action === 'import') byId('importModal')?.classList.add('open');
    if (action === 'drive') backupToDrive();
  });

  function selectedReadings() {
    const ids = [...document.querySelectorAll('.history-select:checked')].map(x => x.dataset.id);
    return APP.readings.filter(r => ids.includes(String(r.id || r.timestamp)));
  }
  function updateBulkButtons() {
    const count = document.querySelectorAll('.history-select:checked').length;
    if (byId('historyBulk')) byId('historyBulk').hidden = !count;
    document.querySelectorAll('.history-select').forEach(cb => { cb.hidden = !count && !cb.checked; });
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
      cb.hidden = true;
      cb.addEventListener('click', e => { e.stopPropagation(); updateBulkButtons(); });
      item.addEventListener('contextmenu', e => { e.preventDefault(); cb.hidden = false; cb.checked = true; updateBulkButtons(); });
      item.prepend(cb);
    });
  };

  function csvCell(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }
  function exportRowsCSV(rows, filename) {
    if (!rows.length) return showToast('No readings selected');
    const header = ['Date','Time','Window','Systolic','Diastolic','Pulse','Symptoms','Position','Arm','Medication','Meal','Activity','Intake','Notes'];
    const lines = rows.map(r => { const d = new Date(r.timestamp); return [d.toLocaleDateString(),d.toLocaleTimeString(),r.window,r.sys,r.dia,r.pulse,r.symptoms,r.position,r.arm,r.medication,r.meal,r.activity,r.intake,r.extraNote].map(csvCell).join(','); });
    downloadFile('\ufeff' + [header.join(','), ...lines].join('\r\n'), filename, 'text/csv;charset=utf-8'); showToast('CSV exported successfully');
  }

  // ===== AUTO-FETCH APP VERSION FROM MANIFEST =====
  async function fetchAppVersion() {
    try {
      const response = await fetch('manifest.json');
      if (!response.ok) throw new Error('Manifest not found');
      const manifest = await response.json();
      // Try to get version from manifest, fallback to hardcoded
      const version = manifest.version || 'v1.1.0';
      return version;
    } catch (error) {
      console.warn('Could not fetch manifest, using fallback version:', error);
      return 'v1.1.0';
    }
  }

  // ===== UPDATE ABOUT MODAL WITH VERSION AND YEAR =====
  async function updateAboutModal() {
    const versionEl = byId('aboutVersion');
    const yearEl = byId('aboutYear');
    
    // Auto-calculate current year
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
    }
    
    // Auto-fetch version from manifest
    if (versionEl) {
      const version = await fetchAppVersion();
      versionEl.textContent = version;
    }
  }

  // ===== OPEN ABOUT MODAL =====
  byId('openAboutBtn')?.addEventListener('click', async () => {
    byId('settingsModal')?.classList.remove('open');
    await updateAboutModal();
    byId('aboutModal')?.classList.add('open');
  });

  byId('closeAboutModal')?.addEventListener('click', () => byId('aboutModal')?.classList.remove('open'));
  
  ['recAct','recIntake'].forEach(id => byId(id)?.addEventListener('change', e => { 
    const custom = byId(id === 'recAct' ? 'recCustomAct' : 'recCustomIntake'); 
    if (custom) custom.hidden = !Array.from(e.target.selectedOptions).some(o => o.value === 'Custom'); 
  }));
  
  syncLoginOptions();

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

// ===== EXPORT PDF - Enhanced Version =====
window.exportPDF = async function (fromDate, toDate, rowsOverride) {
  try {
    console.log('PDF export started...');
    const rows = rowsOverride || getReadingsInRange(fromDate, toDate);
    console.log('Rows found:', rows.length);

    if (!rows.length) {
      showToast('No readings to export');
      return;
    }

    if (!window.jspdf?.jsPDF) {
      showToast('PDF library not loaded');
      return;
    }

    showToast('Preparing PDF report...');

    const { jsPDF } = window.jspdf;
    
    // ===== HELPER FUNCTIONS =====
    function getStatusColor(sys, dia) {
      const status = getBPStatus(sys, dia);
      switch(status.class) {
        case 'status-crisis': return [200, 50, 50];
        case 'status-stage2': return [120, 80, 200];
        case 'status-stage1': return [220, 150, 50];
        case 'status-elevated': return [210, 190, 60];
        case 'status-normal': return [60, 180, 100];
        case 'status-hypotension': return [60, 140, 220];
        default: return [16, 26, 49];
      }
    }

    function getPulseColor(pulse) {
      if (pulse > 120) return [200, 50, 50];
      if (pulse >= 101) return [120, 80, 200];
      if (pulse >= 60) return [60, 180, 100];
      if (pulse >= 40) return [210, 190, 60];
      return [220, 150, 50];
    }

    function getConsistencyColor(pct) {
      if (pct >= 90) return [60, 180, 100];
      if (pct >= 80) return [100, 200, 130];
      if (pct >= 70) return [210, 190, 60];
      if (pct >= 60) return [220, 150, 50];
      if (pct >= 40) return [200, 50, 50];
      return [120, 80, 200];
    }

    function formatDateForReport(date) {
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, '0');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[d.getMonth()];
      const year = String(d.getFullYear()).slice(-2);
      const time = d.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `${day} ${month} ${year} ${time}`;
    }

    function formatDuration(days) {
      if (days < 1) return '0 days';
      if (days < 30) return `${days} days`;
      if (days < 365) {
        const months = Math.floor(days / 30);
        const remainingDays = days % 30;
        if (remainingDays === 0) return `${months} mon`;
        return `${months} mon, ${remainingDays} days`;
      }
      const years = Math.floor(days / 365);
      const remainingMonths = Math.floor((days % 365) / 30);
      const remainingDays = days % 30;
      let parts = [`${years} yr`];
      if (remainingMonths > 0) parts.push(`${remainingMonths} mon`);
      if (remainingDays > 0) parts.push(`${remainingDays} days`);
      return parts.join(', ');
    }

    function calculateAgeDetails(dob) {
      if (!dob) return { years: 0, months: 0 };
      const birthDate = new Date(dob);
      const today = new Date();
      let years = today.getFullYear() - birthDate.getFullYear();
      let months = today.getMonth() - birthDate.getMonth();
      if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
        years--;
        months += 12;
      }
      if (months < 0) months += 12;
      return { years, months };
    }

    // ===== GET USER DATA =====
    const user = APP.user || {};
    const name = user.name || 'Unknown';
    const email = user.email || 'Not provided';
    const phone = user.phone || 'Not provided';
    const dob = user.dob || null;
    const gender = user.gender || 'Not provided';
    const ageDetails = calculateAgeDetails(dob);
    const ageString = ageDetails.years > 0 || ageDetails.months > 0 ? 
      `${ageDetails.years > 0 ? ageDetails.years + ' yr' : ''}${ageDetails.years > 0 && ageDetails.months > 0 ? ', ' : ''}${ageDetails.months > 0 ? ageDetails.months + ' mon' : ''}` : 
      'N/A';

    // ===== CALCULATE METRICS =====
    const sysValues = rows.map(r => r.sys);
    const diaValues = rows.map(r => r.dia);
    const pulseValues = rows.map(r => r.pulse);

    const avgSys = Math.round(sysValues.reduce((a, b) => a + b, 0) / sysValues.length);
    const avgDia = Math.round(diaValues.reduce((a, b) => a + b, 0) / diaValues.length);
    const avgPulse = Math.round(pulseValues.reduce((a, b) => a + b, 0) / pulseValues.length);
    
    const minSys = Math.min(...sysValues);
    const maxSys = Math.max(...sysValues);
    const minDia = Math.min(...diaValues);
    const maxDia = Math.max(...diaValues);
    const minPulse = Math.min(...pulseValues);
    const maxPulse = Math.max(...pulseValues);

    // ===== CALCULATE CONSISTENCY SCORE =====
    const days = fromDate && toDate ? 
      Math.ceil((new Date(toDate) - new Date(fromDate)) / (1000 * 60 * 60 * 24)) + 1 : 
      14;
    const expected = days * 3;
    const actual = rows.length;
    const consistencyPct = Math.min(100, Math.round((actual / expected) * 100));
    const consistencyGrade = getConsistencyGrade(consistencyPct);

    // ===== GET ACTUAL DATE RANGE FROM READINGS =====
    let startDateStr = 'All';
    let endDateStr = 'All';
    if (rows.length > 0) {
      const sorted = [...rows].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      startDateStr = formatDateForReport(new Date(sorted[0].timestamp));
      endDateStr = formatDateForReport(new Date(sorted[sorted.length - 1].timestamp));
    }

    // ===== COLORS =====
    const colors = {
      primary: [255, 131, 8],
      navy: [16, 26, 49],
      gray: [160, 174, 192],
      lightGray: [200, 204, 210],
      white: [255, 255, 255],
      black: [26, 26, 26],
      borderGray: [220, 220, 220]
    };

    // ===== FIRST PASS: Calculate total height needed =====
    // We'll build content in a temporary doc to measure height
    
    // Start with base positions
    let startY = 34; // After header
    const lineHeight = 5.5;
    const rowHeight = 6;
    
    // Calculate Patient Details height (6 fields)
    const patientHeight = 5 + (6 * lineHeight);
    
    // Calculate Report Details height (6 fields)
    const reportHeight = 5 + (6 * lineHeight);
    
    // Snapshot section height (BP + Pulse)
    const snapshotHeight = 5 + (3 * lineHeight) + 3 + (3 * lineHeight); // BP title + 3 rows + gap + Pulse title + 3 rows
    
    // Table height
    const tableHeaderHeight = 6;
    const tableRowsHeight = rows.length * rowHeight;
    const tableTotalHeight = tableHeaderHeight + tableRowsHeight + 5;
    
    // Classification height
    const classificationRows = 6; // Max rows
    const classificationHeight = 10 + 4 + (classificationRows * 5) + 8;
    
    // Footer height
    const footerHeight = 20;
    
    // Calculate total page height
    const totalContentHeight = startY + patientHeight + 8 + reportHeight + 8 + snapshotHeight + 8 + tableTotalHeight + 10 + classificationHeight + footerHeight + 20;
    
    // Add some padding
    const pageHeight = Math.max(totalContentHeight + 20, 297); // Minimum A4 height
    
    console.log('Calculated page height:', pageHeight, 'mm');
    console.log('Total rows:', rows.length);

    // ===== CREATE ACTUAL DOCUMENT WITH CALCULATED HEIGHT =====
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [210, pageHeight]
    });
    
    const pageWidth = 210;
    const margin = 20;
    let y = 28;

    // ===== 1. ADD WATERMARK LOGO (Centered on the calculated page) =====
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = 'https://raw.githubusercontent.com/myhealthjournalapp/MyHealthJournal/main/app-logo.png';
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        setTimeout(resolve, 3000);
      });
      if (img.complete && img.naturalWidth > 0) {
        const imgWidth = 80;
        const imgHeight = (img.naturalHeight / img.naturalWidth) * imgWidth;
        const centerY = pageHeight / 2;
        doc.setGState(new doc.GState({ opacity: 0.10 }));
        doc.addImage(img, 'PNG', (pageWidth/2) - (imgWidth/2), centerY - (imgHeight/2), imgWidth, imgHeight);
        doc.setGState(new doc.GState({ opacity: 1.0 }));
      }
    } catch(e) {
      console.log('Watermark not added:', e);
    }

// ===== 2. TOP-LEFT REPORTING LOGO =====
try {
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.src = 'https://raw.githubusercontent.com/myhealthjournalapp/MyHealthJournal/main/reporting-logo.png';
  await new Promise((resolve) => {
    img.onload = () => {
      console.log('✅ Header logo loaded successfully');
      resolve();
    };
    img.onerror = () => {
      console.log('❌ Header logo failed to load');
      resolve();
    };
    setTimeout(resolve, 3000);
  });
  if (img.complete && img.naturalWidth > 0) {
    const imgHeight = 25;
    const imgWidth = (img.naturalWidth / img.naturalHeight) * imgHeight;
    doc.addImage(img, 'PNG', margin, 4, imgWidth, imgHeight);
  } else {
    console.log('Header logo not loaded - skipping');
  }
} catch(e) {
  console.log('Top logo error:', e);
}

    // ===== 3. HEADER TITLE =====
    doc.setFontSize(23);  // Bigger
    doc.setFont('helvetica', 'black');  // Thicker/heaviest
    const orangeTitle = 'BP & Pulse';
    const blackTitle = ' Report';
    const titleWidth = doc.getTextWidth(orangeTitle + blackTitle);
    const titleX = (pageWidth - titleWidth) / 2;
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.text(orangeTitle, titleX, 26);
    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    doc.text(blackTitle, titleX + doc.getTextWidth(orangeTitle), 26);
    y = 34;

    // ===== 4. PATIENT DETAILS + REPORT DETAILS (Side-by-Side) =====
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    const leftColX = margin;
    const rightColX = 110;
    const labelColor = [160, 174, 192];
    const valueColor = [16, 26, 49];
    let leftY = y;
    let rightY = y;

    // Patient Details (Left Column)
    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Patient Details', leftColX, leftY);
    leftY += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const patientFields = [
      ['Name:', name],
      ['DOB:', dob || 'Not provided'],
      ['Age:', ageString],
      ['Gender:', gender],
      ['Phone:', phone],
      ['Email:', email]
    ];
    
    patientFields.forEach((field) => {
      doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
      doc.text(field[0], leftColX, leftY);
      doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
      doc.text(field[1], leftColX + 20, leftY);
      leftY += lineHeight;
    });

    // Report Details (Right Column)
    const fromStr = startDateStr;
    const toStr = endDateStr;
    const totalDays = fromDate && toDate ? 
      Math.ceil((new Date(toDate) - new Date(fromDate)) / (1000 * 60 * 60 * 24)) + 1 : 
      0;
    const reportGenerated = formatDateForReport(new Date());

    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Report Details', rightColX, rightY);
    rightY += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const reportFields = [
      ['Start Date:', fromStr],
      ['End Date:', toStr],
      ['Reporting Period:', formatDuration(totalDays)],
      ['Report Generated:', reportGenerated],
      ['Total Readings:', String(rows.length)],
      ['Measurement Score:', `${consistencyGrade.label} (${consistencyPct}%)`]
    ];
    
    reportFields.forEach((field) => {
      doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
      doc.text(field[0], rightColX, rightY);
      doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
      if (field[0] === 'Measurement Score:') {
        const scoreColor = getConsistencyColor(consistencyPct);
        doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      }
      doc.text(field[1], rightColX + 30, rightY);
      rightY += lineHeight;
    });

    y = Math.max(leftY, rightY) + 8;

    // ===== 5. SNAPSHOT SECTION (Side-by-Side - BP Left, Pulse Right - NO DIVIDER) =====
    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Snapshot', margin, y);
    y += 5;

    const tierLabelColor = [160, 174, 192];
    const tierValueColor = [16, 26, 49];
    let bpY = y;
    let pulseY = y;

    // BP Section (Left)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.text('Blood Pressure', leftColX, bpY);
    bpY += 5;
    doc.setFont('helvetica', 'normal');

    const bpMetrics = [
      ['Average BP:', `${avgSys}/${avgDia} mmHg`],
      ['Lowest BP:', `${minSys}/${minDia} mmHg`],
      ['Highest BP:', `${maxSys}/${maxDia} mmHg`]
    ];

    bpMetrics.forEach((metric) => {
      doc.setTextColor(tierLabelColor[0], tierLabelColor[1], tierLabelColor[2]);
      doc.setFontSize(8);
      doc.text(metric[0], leftColX + 3, bpY);
      doc.setTextColor(tierValueColor[0], tierValueColor[1], tierValueColor[2]);
      doc.text(metric[1], leftColX + 30, bpY);
      bpY += lineHeight;
    });

    // Pulse Section (Right)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.text('Pulse', rightColX, pulseY);
    pulseY += 5;
    doc.setFont('helvetica', 'normal');

    const pulseMetrics = [
      ['Average Pulse:', `${avgPulse} BPM`],
      ['Lowest Pulse:', `${minPulse} BPM`],
      ['Highest Pulse:', `${maxPulse} BPM`]
    ];

    pulseMetrics.forEach((metric) => {
      doc.setTextColor(tierLabelColor[0], tierLabelColor[1], tierLabelColor[2]);
      doc.setFontSize(8);
      doc.text(metric[0], rightColX + 3, pulseY);
      doc.setTextColor(tierValueColor[0], tierValueColor[1], tierValueColor[2]);
      doc.text(metric[1], rightColX + 30, pulseY);
      pulseY += lineHeight;
    });

    y = Math.max(bpY, pulseY) + 8;

    // ===== 6. CLINICAL READINGS TABLE (Aligned to margin - NO PAGE BREAKS) =====
    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Clinical Readings', margin, y);
    y += 5;

    const tableStartY = y;
    const tableCols = [12, 45, 28, 20, 50];
    const tableHeaders = ['#', 'Date & Time', 'BP', 'Pulse', 'Status'];
    const totalTableWidth = tableCols.reduce((a, b) => a + b, 0);
    const tableStartX = margin;

    // Table Header - Orange ribbon
    doc.setFillColor(255, 131, 8);
    doc.rect(tableStartX, tableStartY - 2, totalTableWidth, 6, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    let headerX = tableStartX;
    tableHeaders.forEach((h, i) => {
      const textWidth = doc.getStringUnitWidth(h) * doc.internal.getFontSize() / doc.internal.scaleFactor;
      const textX = headerX + (tableCols[i] / 2) - (textWidth / 2);
      doc.text(h, textX, tableStartY + 2);
      headerX += tableCols[i];
    });

    let tableY = tableStartY + 6;
    const shown = rows;

    // Draw table rows - NO PAGE BREAKS, continuous
    shown.forEach((r, i) => {
      const d = new Date(r.timestamp);
      const rowY = tableY + (i * 6);
      
      // Draw cell borders
      doc.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
      doc.setLineWidth(0.1);
      
      let x = tableStartX;
      tableCols.forEach((colWidth) => {
        doc.rect(x, rowY - 2, colWidth, 6, 'S');
        x += colWidth;
      });
      
      const statusColor = getStatusColor(r.sys, r.dia);
      const pulseColor = getPulseColor(r.pulse);
      const statusObj = getBPStatus(r.sys, r.dia);
      let statusText = statusObj.label.replace(/[^\w\s]/g, '').trim();
      
      const centerText = (text, colIndex) => {
        const textWidth = doc.getStringUnitWidth(String(text)) * doc.internal.getFontSize() / doc.internal.scaleFactor;
        const xPos = tableStartX + tableCols.slice(0, colIndex).reduce((a, b) => a + b, 0);
        const textX = xPos + (tableCols[colIndex] / 2) - (textWidth / 2);
        doc.text(String(text), textX, rowY + 1);
      };
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      
      doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
      centerText(i + 1, 0);
      
doc.setTextColor(colors.navy[0], colors.navy[1], colors.navy[2]);
centerText(formatDateForReport(d), 1);

// BP column - show as "SYS/DIA"
doc.setFont('helvetica', 'bold');
doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
centerText(`${r.sys}/${r.dia}`, 2);

doc.setTextColor(pulseColor[0], pulseColor[1], pulseColor[2]);
centerText(r.pulse, 3);

doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
centerText(statusText, 4);
    });

    let finalY = tableY + (shown.length * 6) + 10;

    // ===== 7. CLASSIFICATION REFERENCE (With centered dividers, NO PAGE BREAKS) =====
    doc.setDrawColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
    doc.line(margin, finalY - 2, pageWidth - margin, finalY - 2);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    doc.text('Classification Reference', margin, finalY + 4);
    finalY += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);

    // Calculate 1/3 and 2/3 positions
    const colWidth = (pageWidth - (margin * 2)) / 3;
    const col1X = margin;
    const col2X = margin + colWidth;
    const col3X = margin + (colWidth * 2);

    // BP Classification (Column 1) - Centered
    const bpCategories = [
      ['Hypotension:', '< 90 / < 60', [60, 140, 220]],
      ['Normal:', '90-120 / 60-80', [60, 180, 100]],
      ['Elevated:', '121-129 / < 80', [210, 190, 60]],
      ['Stage 1:', '130-139 / 81-89', [220, 150, 50]],
      ['Stage 2:', '140-180 / 90-120', [120, 80, 200]],
      ['Crisis:', '> 180 / > 120', [200, 50, 50]]
    ];

    // Pulse Classification (Column 2) - Centered
    const pulseCategories = [
      ['Severe Bradycardia:', '< 40 BPM', [220, 150, 50]],
      ['Low (Bradycardia):', '40-59 BPM', [210, 190, 60]],
      ['Normal:', '60-100 BPM', [60, 180, 100]],
      ['Mild Tachycardia:', '101-120 BPM', [120, 80, 200]],
      ['Severe Tachycardia:', '> 120 BPM', [200, 50, 50]]
    ];

    // Measurement Score Classification (Column 3) - Centered
    const scoreCategories = [
      ['Awful:', '≤ 39%', [120, 80, 200]],
      ['Poor:', '40-59%', [200, 50, 50]],
      ['Below Average:', '60-69%', [220, 150, 50]],
      ['Average:', '70-79%', [210, 190, 60]],
      ['Good:', '80-89%', [100, 200, 130]],
      ['Excellent:', '≥ 90%', [60, 180, 100]]
    ];

    const legendRowHeight = 5;
    let maxRows = Math.max(bpCategories.length, pulseCategories.length, scoreCategories.length);

    // Draw BP Legend (Column 1) - Centered
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    const bpTitleWidth = doc.getStringUnitWidth('BP Classification') * 6.5 / doc.internal.scaleFactor;
    doc.text('BP Classification', col1X + (colWidth/2) - (bpTitleWidth/2), finalY);
    doc.setFont('helvetica', 'normal');
    
    bpCategories.forEach((cat, i) => {
      const rowY = finalY + 4 + (i * legendRowHeight);
      doc.setTextColor(cat[2][0], cat[2][1], cat[2][2]);
      
      const fullText = cat[0] + ' ' + cat[1];
      const textWidth = doc.getStringUnitWidth(fullText) * 6.5 / doc.internal.scaleFactor;
      const textX = col1X + (colWidth/2) - (textWidth/2);
      
      doc.setFont('helvetica', 'bold');
      doc.text(cat[0], textX, rowY);
      const boldWidth = doc.getStringUnitWidth(cat[0]) * 6.5 / doc.internal.scaleFactor;
      doc.setFont('helvetica', 'normal');
      doc.text(cat[1], textX + boldWidth, rowY);
    });

    // Vertical divider at 1/3 position (between Column 1 & 2)
    const bpEndY = finalY + 4 + (bpCategories.length * legendRowHeight);
    const dividerY1 = finalY - 2;
    const dividerY2 = finalY + 4 + (maxRows * legendRowHeight);
    doc.setDrawColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
    doc.setLineWidth(0.3);
    doc.line(col1X + colWidth, dividerY1, col1X + colWidth, dividerY2 + 4);

    // Draw Pulse Legend (Column 2) - Centered
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    const pulseTitleWidth = doc.getStringUnitWidth('Pulse Classification') * 6.5 / doc.internal.scaleFactor;
    doc.text('Pulse Classification', col2X + (colWidth/2) - (pulseTitleWidth/2), finalY);
    doc.setFont('helvetica', 'normal');
    
    pulseCategories.forEach((cat, i) => {
      const rowY = finalY + 4 + (i * legendRowHeight);
      doc.setTextColor(cat[2][0], cat[2][1], cat[2][2]);
      
      const fullText = cat[0] + ' ' + cat[1];
      const textWidth = doc.getStringUnitWidth(fullText) * 6.5 / doc.internal.scaleFactor;
      const textX = col2X + (colWidth/2) - (textWidth/2);
      
      doc.setFont('helvetica', 'bold');
      doc.text(cat[0], textX, rowY);
      const boldWidth = doc.getStringUnitWidth(cat[0]) * 6.5 / doc.internal.scaleFactor;
      doc.setFont('helvetica', 'normal');
      doc.text(cat[1], textX + boldWidth, rowY);
    });

    // Vertical divider at 2/3 position (between Column 2 & 3)
    const pulseEndY = finalY + 4 + (pulseCategories.length * legendRowHeight);
    doc.setDrawColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
    doc.setLineWidth(0.3);
    doc.line(col2X + colWidth, dividerY1, col2X + colWidth, dividerY2 + 4);

    // Draw Measurement Score Legend (Column 3) - Centered
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    const scoreTitleWidth = doc.getStringUnitWidth('Measurement Score') * 6.5 / doc.internal.scaleFactor;
    doc.text('Measurement Score', col3X + (colWidth/2) - (scoreTitleWidth/2), finalY);
    doc.setFont('helvetica', 'normal');
    
    scoreCategories.forEach((cat, i) => {
      const rowY = finalY + 4 + (i * legendRowHeight);
      doc.setTextColor(cat[2][0], cat[2][1], cat[2][2]);
      
      const fullText = cat[0] + ' ' + cat[1];
      const textWidth = doc.getStringUnitWidth(fullText) * 6.5 / doc.internal.scaleFactor;
      const textX = col3X + (colWidth/2) - (textWidth/2);
      
      doc.setFont('helvetica', 'bold');
      doc.text(cat[0], textX, rowY);
      const boldWidth = doc.getStringUnitWidth(cat[0]) * 6.5 / doc.internal.scaleFactor;
      doc.setFont('helvetica', 'normal');
      doc.text(cat[1], textX + boldWidth, rowY);
    });

    let footerStartY = finalY + 4 + (maxRows * legendRowHeight) + 10;

    // ===== 8. FOOTER =====
    const footerY = footerStartY + 6;
    
    doc.setDrawColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2]);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
    doc.text('Developed & Maintained by', pageWidth / 2, footerY, { align: 'center' });
    
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.setFontSize(7);
    doc.text('WhiteMoon Jeweller | Asad Jewellers, Okara', pageWidth / 2, footerY + 4.5, { align: 'center' });
    
    doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
    doc.setFontSize(6.5);
    
    const linkY = footerY + 10;
    const linkText1 = '+92 311 0177836';
    const linkText2 = 'myhealthjournalapp@gmail.com';
    const fullText = linkText1 + ' | ' + linkText2;
    
    const fullTextWidth = doc.getStringUnitWidth(fullText) * 6.5 / doc.internal.scaleFactor;
    const startX = (pageWidth - fullTextWidth) / 2;
    
    doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
    const waX = startX;
    const waWidth = doc.getStringUnitWidth(linkText1) * 6.5 / doc.internal.scaleFactor;
    doc.text(linkText1, waX, linkY);
    doc.link(waX, linkY - 2, waWidth, 5, { url: 'https://wa.me/923110177836' });
    
    const sepX = waX + waWidth + 2;
    doc.text('|', sepX, linkY);
    
    const emailX = sepX + 4;
    const emailWidth = doc.getStringUnitWidth(linkText2) * 6.5 / doc.internal.scaleFactor;
    doc.text(linkText2, emailX, linkY);
    doc.link(emailX, linkY - 2, emailWidth, 5, { url: 'mailto:myhealthjournalapp@gmail.com' });

    // ===== 9. SAVE PDF =====
    const fileName = generateFileName('pdf', fromDate, toDate);
    doc.save(fileName);
    showToast('PDF exported successfully');
    console.log('PDF saved');
    console.log('Final page height:', pageHeight, 'mm');

  } catch (error) {
    console.error('PDF error:', error);
    showToast('PDF error: ' + error.message);
  }
};


  // ===== BACKUP TO DRIVE =====
  window.backupToDrive = async function () {
    if (!APP.user) return showToast('Please sign in first'); 
    showToast('Backing up to Google Drive...');
    try { 
      const response = await fetch(APP.gdriveConfig.scriptUrl, { 
        method:'POST', 
        headers:{'Content-Type':'text/plain;charset=utf-8'}, 
        body:JSON.stringify({
          action:'backup',
          folderId:APP.gdriveConfig.folderId,
          fileName:`My_Health_Journal_${Date.now()}.json`,
          data:{user:APP.user,readings:APP.readings,settings:APP.settings}
        }) 
      }); 
      if (!response.ok) throw new Error(`HTTP ${response.status}`); 
      showToast('Google Drive backup completed'); 
    } catch (error) { 
      console.error('Drive backup failed', error); 
      showToast(`Google Drive backup failed: ${error.message}`); 
    }
  };

  // ===== BIOMETRIC LOGIN =====
  byId('biometricLoginBtn')?.addEventListener('click', async () => {
    const email = localStorage.getItem('mhj:lastActive'), record = email && JSON.parse(localStorage.getItem(`mhj:account:${email}`) || 'null');
    if (!record?.settings?.biometric) return showToast('Biometric verification is not enabled for the last active account');
    if (!window.PublicKeyCredential) return showToast('Biometric authentication is not supported by this browser/device');
    showToast('This web version requires a registered WebAuthn credential. Native mobile builds should use the device biometric API.');
  });
  
  byId('biometricToggle')?.addEventListener('change', e => { 
    APP.settings.biometric = e.target.checked; 
    saveData(); 
    showToast(e.target.checked ? 'Biometric option enabled; device registration is required before use' : 'Biometric option disabled'); 
  });
  
  byId('appLockToggle')?.addEventListener('change', e => { 
    APP.settings.appLock = e.target.checked; 
    saveData(); 
    syncLoginOptions(); 
  });
  
  byId('openImportFromLogs')?.addEventListener('click', () => { 
    byId('exportModal')?.classList.remove('open'); 
    byId('importModal')?.classList.add('open'); 
  });

  // ===== INITIALIZE ABOUT MODAL ON LOAD =====
  // Auto-update about modal with version and year when page loads
  document.addEventListener('DOMContentLoaded', () => {
    // Update about modal content with version and year
    setTimeout(async () => {
      const yearEl = byId('aboutYear');
      if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
      }
      
      const versionEl = byId('aboutVersion');
      if (versionEl) {
        const version = await fetchAppVersion();
        versionEl.textContent = version;
      }
    }, 500);
  });

  syncChartLayout();

})();
