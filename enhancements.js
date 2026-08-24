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
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;

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

    // ===== COLORS =====
    const colors = {
      primary: [255, 131, 8],
      navy: [16, 26, 49],
      gray: [160, 174, 192],
      white: [255, 255, 255],
      black: [26, 26, 26],
      borderGray: [220, 220, 220]
    };

    // ===== ADD WATERMARK LOGO (FADED) =====
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = 'https://raw.githubusercontent.com/myhealthjournalapp/MyHealthJournal/main/app-logo.png';
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        setTimeout(resolve, 1500);
      });
      if (img.complete && img.naturalWidth > 0) {
        const imgWidth = 80;
        const imgHeight = (img.naturalHeight / img.naturalWidth) * imgWidth;
        doc.setGState(new doc.GState({ opacity: 0.12 }));
        doc.addImage(img, 'PNG', (pageWidth/2) - (imgWidth/2), (pageHeight/2) - (imgHeight/2), imgWidth, imgHeight);
        doc.setGState(new doc.GState({ opacity: 1.0 }));
      }
    } catch(e) {
      console.log('Watermark not added:', e);
    }

    // ===== HEADER =====
    let y = 20;
    
    // Top-Right Logo (Larger - 25% scale)
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = 'https://raw.githubusercontent.com/myhealthjournalapp/MyHealthJournal/main/reporting-logo.png';
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        setTimeout(resolve, 1500);
      });
      if (img.complete && img.naturalWidth > 0) {
        const imgWidth = 45;
        const imgHeight = (img.naturalHeight / img.naturalWidth) * imgWidth;
        doc.addImage(img, 'PNG', pageWidth - 50, 10, imgWidth, imgHeight);
      }
    } catch(e) {
      console.log('Top logo not added:', e);
    }

    // Title (Bold, Carbon Black, no slogan)
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    doc.text('BP & Pulse Report', margin, y);
    y += 14;

    // ===== SECTION 1 & 2: PATIENT DETAILS + REPORT DETAILS (Side-by-Side) =====
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    
    const leftColX = margin;
    const rightColX = 110;
    const labelColor = [160, 174, 192];
    const valueColor = [16, 26, 49];
    const lineHeight = 6;
    let leftY = y;
    let rightY = y;

    // Patient Details (Left Column)
    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Patient Details', leftColX, leftY);
    leftY += 6;
    
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
      doc.text(field[1], leftColX + 22, leftY);
      leftY += lineHeight;
    });

    // Report Details (Right Column)
    const fromStr = fromDate ? formatDateForReport(new Date(fromDate)) : 'All';
    const toStr = toDate ? formatDateForReport(new Date(toDate)) : 'All';
    const totalDays = fromDate && toDate ? 
      Math.ceil((new Date(toDate) - new Date(fromDate)) / (1000 * 60 * 60 * 24)) + 1 : 
      0;
    const reportGenerated = formatDateForReport(new Date());

    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Report Details', rightColX, rightY);
    rightY += 6;
    
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
      doc.text(field[1], rightColX + 32, rightY);
      rightY += lineHeight;
    });

    y = Math.max(leftY, rightY) + 10;

    // ===== SECTION 3: CLINICAL DATA =====
    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Clinical Data', margin, y);
    y += 8;

    // Clinical Data: Only BP & Pulse Metrics Table (3 columns, 4 rows)
    // totalTableWidth matches the Readings table: 12+45+18+18+20+50 = 163
    const readingsTableTotalWidth = 163;
    const tableX = (pageWidth - readingsTableTotalWidth) / 2;
    const tableColWidths = [54, 54, 55]; // total = 163, matching Readings table
    const tableRowHeight = 7;
    const metricsData = [
      ['', 'BP', 'Pulse'],
      ['Average', `${avgSys}/${avgDia} mmHg`, `${avgPulse} BPM`],
      ['Lowest', `${minSys}/${minDia} mmHg`, `${minPulse} BPM`],
      ['Highest', `${maxSys}/${maxDia} mmHg`, `${maxPulse} BPM`]
    ];

    // Draw table
    doc.setFontSize(8);
    const headerColor = [255, 131, 8];
    const headerTextColor = [255, 255, 255];
    
    metricsData.forEach((row, rowIndex) => {
      const rowY = y + (rowIndex * tableRowHeight);
      let xPos = tableX;
      
      row.forEach((cell, colIndex) => {
        // Cell border
        doc.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
        doc.setLineWidth(0.1);
        doc.rect(xPos, rowY, tableColWidths[colIndex], tableRowHeight, 'S');
        
        // Cell content
        if (rowIndex === 0) {
          // Header row - Orange background
          doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
          doc.rect(xPos, rowY, tableColWidths[colIndex], tableRowHeight, 'F');
          doc.setTextColor(headerTextColor[0], headerTextColor[1], headerTextColor[2]);
          doc.setFont('helvetica', 'bold');
        } else if (colIndex === 0) {
          // First column - labels
          doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
          doc.setFont('helvetica', 'normal');
        } else {
          // Data cells - color coded
          doc.setFont('helvetica', 'bold');
          if (colIndex === 1) {
            // BP values
            let bpColor = getStatusColor(avgSys, avgDia);
            if (rowIndex === 2) bpColor = getStatusColor(minSys, minDia);
            if (rowIndex === 3) bpColor = getStatusColor(maxSys, maxDia);
            doc.setTextColor(bpColor[0], bpColor[1], bpColor[2]);
          } else if (colIndex === 2) {
            // Pulse values
            let pulseColor = getPulseColor(avgPulse);
            if (rowIndex === 2) pulseColor = getPulseColor(minPulse);
            if (rowIndex === 3) pulseColor = getPulseColor(maxPulse);
            doc.setTextColor(pulseColor[0], pulseColor[1], pulseColor[2]);
          }
        }
        
        // Center align text
        const textWidth = doc.getStringUnitWidth(String(cell)) * doc.internal.getFontSize() / doc.internal.scaleFactor;
        const textX = xPos + (tableColWidths[colIndex] / 2) - (textWidth / 2);
        const textY = rowY + (tableRowHeight / 2) + 2.5;
        doc.text(String(cell), textX, textY);
        
        xPos += tableColWidths[colIndex];
      });
    });
    
    y += metricsData.length * tableRowHeight + 10;

    // ===== SECTION 4: READINGS TABLE =====
    const tableStartY = y;
    const tableCols = [12, 45, 18, 18, 20, 50];
    const tableHeaders = ['#', 'Date & Time', 'SYS', 'DIA', 'Pulse', 'Status'];
    const totalTableWidth = tableCols.reduce((a, b) => a + b, 0);
    const tableStartX = (pageWidth - totalTableWidth) / 2;

    // Table Header - Orange ribbon matching table width
    doc.setFillColor(255, 131, 8);
    doc.rect(tableStartX, tableStartY - 3, totalTableWidth, 7, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    let headerX = tableStartX;
    tableHeaders.forEach((h, i) => {
      const textWidth = doc.getStringUnitWidth(h) * doc.internal.getFontSize() / doc.internal.scaleFactor;
      const textX = headerX + (tableCols[i] / 2) - (textWidth / 2);
      doc.text(h, textX, tableStartY + 2);
      headerX += tableCols[i];
    });

    let tableY = tableStartY + 7;
    const maxRows = 50;
    const shown = rows.slice(0, maxRows);

    // Draw table rows
    shown.forEach((r, i) => {
      const d = new Date(r.timestamp);
      const rowY = tableY + (i * 7);
      
      if (rowY > pageHeight - 80) return;
      
      // Draw cell borders
      doc.setDrawColor(colors.borderGray[0], colors.borderGray[1], colors.borderGray[2]);
      doc.setLineWidth(0.1);
      
      let x = tableStartX;
      tableCols.forEach((colWidth) => {
        doc.rect(x, rowY - 3, colWidth, 7, 'S');
        x += colWidth;
      });
      
      // Data - Center aligned
      const statusColor = getStatusColor(r.sys, r.dia);
      const pulseColor = getPulseColor(r.pulse);
      const statusObj = getBPStatus(r.sys, r.dia);
      let statusText = statusObj.label.replace(/[^\w\s]/g, '').trim();
      
      // Function to center text in cell
      const centerText = (text, colIndex) => {
        const textWidth = doc.getStringUnitWidth(String(text)) * doc.internal.getFontSize() / doc.internal.scaleFactor;
        const xPos = tableStartX + tableCols.slice(0, colIndex).reduce((a, b) => a + b, 0);
        const textX = xPos + (tableCols[colIndex] / 2) - (textWidth / 2);
        doc.text(String(text), textX, rowY + 1);
      };
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      
      // # - Center
      doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
      centerText(i + 1, 0);
      
      // Date & Time - Center
      doc.setTextColor(colors.navy[0], colors.navy[1], colors.navy[2]);
      centerText(formatDateForReport(d), 1);
      
      // SYS - Center, color coded
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      centerText(r.sys, 2);
      
      // DIA - Center, color coded
      centerText(r.dia, 3);
      
      // Pulse - Center, color coded
      doc.setTextColor(pulseColor[0], pulseColor[1], pulseColor[2]);
      centerText(r.pulse, 4);
      
      // Status - Center, color coded (Status column wide enough for full text)
      doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      centerText(statusText, 5);
    });

    y = tableStartY + (shown.length * 7) + 15;

    // ===== CLASSIFICATION LEGEND =====
    if (y > pageHeight - 75) {
      // If not enough space, start on next page
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    doc.text('Classification Reference', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    // BP Classification (Left)
    const bpCategories = [
      ['Hypotension:', '< 90 / < 60', [60, 140, 220]],
      ['Normal:', '90-120 / 60-80', [60, 180, 100]],
      ['Elevated:', '121-129 / < 80', [210, 190, 60]],
      ['Stage 1:', '130-139 / 81-89', [220, 150, 50]],
      ['Stage 2:', '140-180 / 90-120', [120, 80, 200]],
      ['Crisis:', '> 180 / > 120', [200, 50, 50]]
    ];

    // Pulse Classification (Center)
    const pulseCategories = [
      ['Severe Bradycardia:', '< 40 BPM', [220, 150, 50]],
      ['Low Bradycardia:', '40-59 BPM', [210, 190, 60]],
      ['Normal:', '60-100 BPM', [60, 180, 100]],
      ['Mild Tachycardia:', '101-120 BPM', [120, 80, 200]],
      ['Severe Tachycardia:', '> 120 BPM', [200, 50, 50]]
    ];

    // Consistency Classification (Right)
    const consistencyCategories = [
      ['Awful:', '≤ 39%', [120, 80, 200]],
      ['Poor:', '40-59%', [200, 50, 50]],
      ['Below Average:', '60-69%', [220, 150, 50]],
      ['Average:', '70-79%', [210, 190, 60]],
      ['Good:', '80-89%', [100, 200, 130]],
      ['Excellent:', '≥ 90%', [60, 180, 100]]
    ];

    const legendColWidth = 60;
    const legendX1 = margin;
    const legendX2 = margin + legendColWidth + 5;
    const legendX3 = margin + (legendColWidth + 5) * 2;
    const legendRowHeight = 5.5;

    // Draw BP Legend
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    doc.text('BP Classification', legendX1, y);
    doc.setFont('helvetica', 'normal');
    
    bpCategories.forEach((cat, i) => {
      const rowY = y + 4 + (i * legendRowHeight);
      doc.setTextColor(cat[2][0], cat[2][1], cat[2][2]);
      doc.text(cat[0] + ' ' + cat[1], legendX1, rowY);
    });

    // Draw Pulse Legend
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    doc.text('Pulse Classification', legendX2, y);
    doc.setFont('helvetica', 'normal');
    
    pulseCategories.forEach((cat, i) => {
      const rowY = y + 4 + (i * legendRowHeight);
      doc.setTextColor(cat[2][0], cat[2][1], cat[2][2]);
      doc.text(cat[0] + ' ' + cat[1], legendX2, rowY);
    });

    // Draw Consistency Legend
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(colors.black[0], colors.black[1], colors.black[2]);
    doc.text('Consistency Grade', legendX3, y);
    doc.setFont('helvetica', 'normal');
    
    consistencyCategories.forEach((cat, i) => {
      const rowY = y + 4 + (i * legendRowHeight);
      doc.setTextColor(cat[2][0], cat[2][1], cat[2][2]);
      doc.text(cat[0] + ' ' + cat[1], legendX3, rowY);
    });

    y += 4 + (consistencyCategories.length * legendRowHeight) + 10;

    // ===== FOOTER =====
    const footerY = pageHeight - 20;
    doc.setDrawColor(colors.gray[0], colors.gray[1], colors.gray[2]);
    doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);
    
    // Center-aligned footer with hyperlinks
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
    doc.text('Developed & Maintained by', pageWidth / 2, footerY, { align: 'center' });
    
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    doc.setFontSize(8);
    doc.text('WhiteMoon Jeweller | Asad Jewellers, Okara', pageWidth / 2, footerY + 5, { align: 'center' });
    
    doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
    doc.setFontSize(7);
    
    // Create clickable hyperlinks
    const linkY = footerY + 11;
    const linkText1 = '+92 311 0177836';
    const linkText2 = 'myhealthjournalapp@gmail.com';
    const fullText = linkText1 + ' | ' + linkText2;
    
    // Calculate positions for center alignment
    const fullTextWidth = doc.getStringUnitWidth(fullText) * 7 / doc.internal.scaleFactor;
    const startX = (pageWidth - fullTextWidth) / 2;
    
    // Draw WhatsApp link
    doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
    const waX = startX;
    const waWidth = doc.getStringUnitWidth(linkText1) * 7 / doc.internal.scaleFactor;
    doc.text(linkText1, waX, linkY);
    doc.link(waX, linkY - 2, waWidth, 5, { url: 'https://wa.me/923110177836' });
    
    // Draw separator
    const sepX = waX + waWidth + 2;
    doc.text('|', sepX, linkY);
    
    // Draw Email link
    const emailX = sepX + 4;
    const emailWidth = doc.getStringUnitWidth(linkText2) * 7 / doc.internal.scaleFactor;
    doc.text(linkText2, emailX, linkY);
    doc.link(emailX, linkY - 2, emailWidth, 5, { url: 'mailto:myhealthjournalapp@gmail.com' });

    // ===== SAVE =====
    const fileName = generateFileName('pdf', fromDate, toDate);
    doc.save(fileName);
    showToast('PDF exported successfully');
    console.log('PDF saved');

  } catch (error) {
    console.error('PDF error:', error);
    showToast('PDF error: ' + error.message);
  }
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
