/* =================================================================
   My Health Journal — Email Templates
   =================================================================
   Contents:
   1. Shared standard (header, watermark, footer, CSS)
   2. Template registry (code, subject, trigger, type, variables, body)
   3. Helper functions (device detection, profile diff, colour resolution)
   4. renderEmailTemplate(templateName, userData, extraData)
   5. sendEmailTemplate(templateName, userData, extraData)

   Navigation paths updated to match the reorganized Settings modal:
     Old: Profile → Security
     New: Settings → Account Management → Security Settings

     Old: Settings → Automatic Drive Backup
     New: Settings → Backup & Exports → Automatic Google Drive Backup

     Old: Settings → Advanced → Connect Your Google Drive
     New: Settings → Backup & Exports → Connect Your Google Drive
   ================================================================= */

/* -----------------------------------------------------------------
   1. SHARED STANDARD
   ----------------------------------------------------------------- */

const MHJ_EMAIL_LOGO_URL =
  'https://raw.githubusercontent.com/myhealthjournalapp/MyHealthJournal/main/reporting-logo.png';

const MHJ_EMAIL_WATERMARK_URL =
  'https://raw.githubusercontent.com/myhealthjournalapp/MyHealthJournal/main/app-logo.png';

const MHJ_EMAIL_BRAND_ORANGE = '#FF8308';
const MHJ_EMAIL_TEXT_NAVY = '#101A31';
const MHJ_EMAIL_TEXT_GREY = '#A0AEC0';
const MHJ_EMAIL_BRAND_GREY = '#4A5568';
const MHJ_EMAIL_DIVIDER_GREY = '#E2E8F0';

/* Jeweller Google profile links */
const MHJ_WHITEMOON_URL = 'https://share.google/bWfGrw0Q622ZebL1s';
const MHJ_ASAD_URL = 'https://share.google/jHB4SvgAeMeM0FXPk';

/* The universal <style> block. Copied verbatim from the OTP email. */
const MHJ_EMAIL_STYLE = `
  body {
    font-family: Arial, sans-serif;
    color: #101A31;
    margin: 0;
    padding: 0;
    background-color: #f7fafc;
  }
  .container {
    max-width: 500px;
    margin: 20px auto;
    padding: 24px;
    background-color: #ffffff;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.95)),
      url('${MHJ_EMAIL_WATERMARK_URL}');
    background-repeat: no-repeat;
    background-position: center;
    background-size: 250px auto;
    border-radius: 8px;
  }
  .header {
    background: transparent;
    border: none;
    padding: 0 0 5px 0;
    text-align: center;
  }
  .logo {
    max-width: 300px;
    height: auto;
    display: block;
    margin: 0 auto;
  }
  .code {
    font-size: 32px;
    font-weight: bold;
    color: #FF8308;
    text-align: center;
    padding: 20px 0;
    letter-spacing: 4px;
  }
  .footer {
    text-align: center;
    font-size: 12px;
    color: #A0AEC0;
    margin-top: 2px;
    padding-top: 2px;
  }
  .journal-highlight {
    color: #FF8308;
    font-weight: bold;
  }
  .brand {
    color: #4A5568;
  }
  .divider {
    margin: 0 4px;
  }
.jeweller-link {
  color: #FF8308;
  text-decoration: none;
  border-bottom: 1px dotted #FF8308;
  padding-bottom: 1px;
}
.jeweller-link:hover {
  color: #101A31;
  border-bottom-color: #101A31;
}

.contact-link {
  color: #A0AEC0;
  text-decoration: none;
  border-bottom: 1px dotted #A0AEC0;
  padding-bottom: 1px;
}
.contact-link:hover {
  color: #FF8308;
  border-bottom-color: #FF8308;
}
`;

/* The universal header block. */
function mhjEmailHeader() {
  return `
    <div class="header">
      <img src="${MHJ_EMAIL_LOGO_URL}" alt="My Health Journal Logo" class="logo">
    </div>
  `;
}

/* The universal footer block — verbatim OTP footer with jeweller links. */
function mhjEmailFooter() {
  const jewellerStyle = "color:#FF8308;text-decoration:none;border-bottom:1px dotted #FF8308;padding-bottom:1px;";
  const contactStyle  = "color:#A0AEC0;text-decoration:none;border-bottom:1px dotted #A0AEC0;padding-bottom:1px;";

  return `
    <div class="footer">
      <p>Developed &amp; Maintained by</p>
      <p>
        <a href="${MHJ_WHITEMOON_URL}" target="_blank" rel="noopener" style="${jewellerStyle}">WhiteMoon Jeweller</a>
        <span class="divider">|</span>
        <a href="${MHJ_ASAD_URL}" target="_blank" rel="noopener" style="${jewellerStyle}">Asad Jewellers, Okara</a>
      </p>
      <div class="copyright-line">
        <span style="color:#A0AEC0;">Copyright</span> &copy; <span class="journal-highlight">{{EMAIL_YEAR}} My Health Journal</span>. All rights reserved.
      </div>
      <div class="contact-info" style="text-align: center; margin-top: 10px; padding-top: 1px; line-height: 20px;">
        <p style="margin: 0; color: #A0AEC0; font-size: 12px; line-height: 20px;">
          <span style="display: inline-block; white-space: nowrap; margin-right: 6px;">
            <img src="https://raw.githubusercontent.com/myhealthjournalapp/MyHealthJournal/main/whatsapp_icon.png"
                 alt="" width="12" height="12"
                 style="vertical-align: middle; display: inline-block; border: 0; margin: 0 3px 0 0; padding: 0; position: relative; top: -1px;" />
            <a href="https://wa.me/923110177836" style="${contactStyle}">+92 311 0177836</a>
          </span>
          <span style="display: inline-block; color: #E2E8F0; margin: 0 6px; vertical-align: middle;">|</span>
          <span style="display: inline-block; white-space: nowrap;">
            <img src="https://raw.githubusercontent.com/myhealthjournalapp/MyHealthJournal/main/email_icon.png"
                 alt="" width="12" height="12"
                 style="vertical-align: middle; display: inline-block; border: 0; margin: 0 3px 0 0; padding: 0; position: relative; top: -1px;" />
            <a href="mailto:myhealthjournalapp@gmail.com" style="${contactStyle}">myhealthjournalapp@gmail.com</a>
          </span>
        </p>
      </div>
    </div>
  `;
}

/* Three mandatory closing lines appended to every body. */
const MHJ_EMAIL_CLOSING = `
  <p>Thanks for downloading <span class="journal-highlight">My Health Journal</span> app.</p>
  <p>Sincerely,</p>
  <p>The <span class="journal-highlight">My Health Journal</span> App Team.</p>
`;

/* -----------------------------------------------------------------
   2. TEMPLATE REGISTRY
   ----------------------------------------------------------------- */

const EMAIL_TEMPLATES = {
  /* Group 1 — Authentication & Registration */
  OTP_VERIFICATION: 'OTP Verification',
  WELCOME: 'Welcome',
  FORGOT_PASSWORD_OTP: 'Forgot Password OTP',
  FORGOT_PIN_OTP: 'Forgot PIN OTP',
  PSWD_RESET_REQUEST: 'Password Reset Requested',
  PIN_RESET_REQUEST: 'PIN Reset Requested',
  PASSWORD_CHANGE_CONFIRMATION: 'Password Change Confirmation',
  PIN_CHANGE_CONFIRMATION: 'PIN Change Confirmation',

  /* Group 2 — Email Address Changes */
  PRIMARY_EMAIL_CHANGED: 'Primary Email Changed',
  RECOVERY_EMAIL_CHANGED: 'Recovery Email Changed',
  PRIMARY_EMAIL_VERIFIED: 'Primary Email Verified',
  RECOVERY_EMAIL_VERIFIED: 'Recovery Email Verified',

  /* Group 3 — Backup Codes & Recovery */
  BACKUP_CODES_GENERATED: 'Backup Codes Generated',
  BACKUP_CODES_USED: 'Backup Codes Used',
  BACKUP_CODES_REMAINING: 'Backup Codes Remaining',
  ACCOUNT_RECOVERED: 'Account Recovered',

  /* Group 4 — Login & Devices */
  LOGIN_ALERT: 'Login Alert',
  LOGOUT: 'Logged Out',
  DEVICE_ADDED: 'Device Added',

  /* Group 5 — Security Alerts */
  SUSPICIOUS_ACTIVITY: 'Suspicious Activity',
  SECURITY_ALERT: 'Security Alert',
  TWO_FA_ENABLE: '2FA Enable',
  TWO_FA_DISABLE: '2FA Disable',
  SECURITY_KEY_ADDED: 'Security Key Added',

  /* Group 6 — PIN & App Lock */
  PIN_ENABLED_TOGGLE_TURNED_ON: 'PIN Enabled',
  PIN_DISABLED_TOGGLE_TURNED_OFF: 'PIN Disabled',

  /* Group 7 — Profile */
  PROFILE_UPDATED: 'Profile Updated',

  /* Group 8 — Readings */
  READING_CREATED: 'Reading Created',
  READING_UPDATED: 'Reading Updated',
  READING_DELETED: 'Reading Deleted',
  READING_REMINDER: 'Reading Reminder',
  DATA_SYNC_COMPLETE: 'Data Sync Complete',

  /* Group 9 — Backup */
  FULL_DATA_BACKUP_CONFIRMATION: 'Full Data Backup Confirmation',
  BACKUP_FAILED: 'Backup Failed',
  AUTO_BACKUP_ENABLED: 'Auto Backup Enabled',
  AUTO_BACKUP_DISABLED: 'Auto Backup Disabled',
  AUTO_BACKUP_COMPLETED: 'Auto Backup Completed',
  AUTO_BACKUP_SCHEDULE_CHANGED: 'Auto Backup Schedule Changed',

  /* Group 10 — Export & Import */
  DATA_EXPORT_READY: 'Data Export Ready',
  CHANGE_LOGS_DOWNLOADED: 'Change Logs Downloaded',
  EMAIL_LOGS_DOWNLOADED: 'Email Logs Downloaded',
  DATA_IMPORTED: 'Data Imported',
  GOOGLE_DRIVE_CONNECTED: 'Google Drive Connected',
  MEDICAL_RECORD_ADDED: 'Medical Record Added',
  MEDICAL_RECORD_REMOVED: 'Medical Record Removed',

  /* Group 11 — Summaries */
  DAILY_SUMMARY: 'Daily Summary',
  WEEKLY_SUMMARY: 'Weekly Summary',
  FORTNIGHTLY_SUMMARY: 'Fortnightly Summary',
  MONTHLY_SUMMARY: 'Monthly Summary',

  /* Group 12 — Account Deletion */
  ACCOUNT_DELETION_REQUEST: 'Account Deletion Requested',
  ACCOUNT_DELETED_CONFIRMATION: 'Account Deleted Confirmation',

  /* Group 13 — Local Data */
  LOCAL_DATA_CLEARED: 'Local Data Cleared',
  JOURNAL_CLEARED: 'Journal Cleared',

  /* Group 14 — Administrator */
  DEVELOPER_NOTIFICATION: 'Administrator Notification'
};

/* Trigger text and Type (Routine / Security-Critical). */
const EMAIL_TRIGGERS = {
  OTP_VERIFICATION: { trigger: 'User requests OTP during registration or email verification.', type: 'Security-Critical' },
  WELCOME: { trigger: 'Fires immediately after a new user completes registration.', type: 'Routine' },
  FORGOT_PASSWORD_OTP: { trigger: 'User requests password reset OTP.', type: 'Security-Critical' },
  FORGOT_PIN_OTP: { trigger: 'User requests PIN reset OTP.', type: 'Security-Critical' },
  PSWD_RESET_REQUEST: { trigger: 'Password-reset OTP delivery succeeded.', type: 'Security-Critical' },
  PIN_RESET_REQUEST: { trigger: 'PIN-reset OTP delivery succeeded.', type: 'Security-Critical' },
  PASSWORD_CHANGE_CONFIRMATION: { trigger: 'Password was successfully changed.', type: 'Security-Critical' },
  PIN_CHANGE_CONFIRMATION: { trigger: 'PIN was successfully changed.', type: 'Security-Critical' },
  PRIMARY_EMAIL_CHANGED: { trigger: 'Primary email changed.', type: 'Security-Critical' },
  RECOVERY_EMAIL_CHANGED: { trigger: 'Recovery email changed.', type: 'Security-Critical' },
  PRIMARY_EMAIL_VERIFIED: { trigger: 'Primary email verification completed.', type: 'Routine' },
  RECOVERY_EMAIL_VERIFIED: { trigger: 'Recovery email verification completed.', type: 'Routine' },
  BACKUP_CODES_GENERATED: { trigger: 'A new backup code was generated.', type: 'Security-Critical' },
  BACKUP_CODES_USED: { trigger: 'A backup code was consumed for a reset.', type: 'Security-Critical' },
  BACKUP_CODES_REMAINING: { trigger: 'Backup code consumption left zero usable codes.', type: 'Security-Critical' },
  ACCOUNT_RECOVERED: { trigger: 'Password or PIN reset authorised by a consumed backup code succeeded.', type: 'Security-Critical' },
  LOGIN_ALERT: { trigger: 'Successful login via password or PIN.', type: 'Security-Critical' },
  LOGOUT: { trigger: 'User signed out through the ordinary logout action.', type: 'Routine' },
  DEVICE_ADDED: { trigger: 'Login from a previously unseen browser.', type: 'Security-Critical' },
  SUSPICIOUS_ACTIVITY: { trigger: 'Rate limit on PIN/recovery attempts reached.', type: 'Security-Critical' },
  SECURITY_ALERT: { trigger: 'Rate-limit threshold reached on OTP/PIN/recovery attempts.', type: 'Security-Critical' },
  TWO_FA_ENABLE: { trigger: '2FA enabled after real enrollment.', type: 'Security-Critical' },
  TWO_FA_DISABLE: { trigger: '2FA disabled after authenticated removal.', type: 'Security-Critical' },
  SECURITY_KEY_ADDED: { trigger: 'WebAuthn security key enrolled.', type: 'Security-Critical' },
  PIN_ENABLED_TOGGLE_TURNED_ON: { trigger: 'PIN toggle changed false → true.', type: 'Routine' },
  PIN_DISABLED_TOGGLE_TURNED_OFF: { trigger: 'PIN toggle changed true → false.', type: 'Security-Critical' },
  PROFILE_UPDATED: { trigger: 'One or more profile fields were changed.', type: 'Routine' },
  READING_CREATED: { trigger: 'A reading was created.', type: 'Routine' },
  READING_UPDATED: { trigger: 'An existing reading was modified.', type: 'Routine' },
  READING_DELETED: { trigger: 'A reading was removed.', type: 'Routine' },
  READING_REMINDER: { trigger: '09:00 UTC when enabled and no reading exists for the day.', type: 'Routine' },
  DATA_SYNC_COMPLETE: { trigger: 'A batch of locally changed readings was committed to Firestore.', type: 'Routine' },
  FULL_DATA_BACKUP_CONFIRMATION: { trigger: 'Full data backup completed to both Drives.', type: 'Routine' },
  BACKUP_FAILED: { trigger: 'A requested Drive upload failed.', type: 'Security-Critical' },
  AUTO_BACKUP_ENABLED: { trigger: 'User toggled automatic backup on.', type: 'Routine' },
  AUTO_BACKUP_DISABLED: { trigger: 'User toggled automatic backup off.', type: 'Routine' },
  AUTO_BACKUP_COMPLETED: { trigger: 'Scheduled automatic backup completed.', type: 'Routine' },
  AUTO_BACKUP_SCHEDULE_CHANGED: { trigger: 'Active auto-backup interval changed.', type: 'Routine' },
  DATA_EXPORT_READY: { trigger: 'A PDF, CSV, or backup export was archived successfully.', type: 'Routine' },
  CHANGE_LOGS_DOWNLOADED: { trigger: 'A filtered change-log export was generated.', type: 'Routine' },
  EMAIL_LOGS_DOWNLOADED: { trigger: 'Email delivery log export generated.', type: 'Routine' },
  DATA_IMPORTED: { trigger: 'Validated backup file merged into account.', type: 'Routine' },
  GOOGLE_DRIVE_CONNECTED: { trigger: 'User connected their Google Drive.', type: 'Routine' },
  MEDICAL_RECORD_ADDED: { trigger: 'A PDF was uploaded to Medical Records.', type: 'Routine' },
  MEDICAL_RECORD_REMOVED: { trigger: 'A PDF was deleted from Medical Records.', type: 'Routine' },
  DAILY_SUMMARY: { trigger: '09:00 UTC the following day, when enabled.', type: 'Routine' },
  WEEKLY_SUMMARY: { trigger: 'Monday 09:00 UTC when enabled.', type: 'Routine' },
  FORTNIGHTLY_SUMMARY: { trigger: 'Every second Monday, 09:00 UTC, when enabled.', type: 'Routine' },
  MONTHLY_SUMMARY: { trigger: 'First day of month, 09:00 UTC, when enabled.', type: 'Routine' },
  ACCOUNT_DELETION_REQUEST: { trigger: 'User confirmed the delete-account dialog (before deletion completes).', type: 'Security-Critical' },
  ACCOUNT_DELETED_CONFIRMATION: { trigger: 'Account deleted after user confirmed.', type: 'Security-Critical' },
  LOCAL_DATA_CLEARED: { trigger: 'User cleared local account data from this device.', type: 'Routine' },
  JOURNAL_CLEARED: { trigger: 'Server cleared the journal while keeping the account.', type: 'Routine' },
  DEVELOPER_NOTIFICATION: { trigger: 'An audited action was recorded. Administrator only.', type: 'Routine' }
};

/* Variables each template consumes. */
const EMAIL_VARIABLES = {
  OTP_VERIFICATION: ['name', 'otp'],
  WELCOME: ['name', 'email'],
  FORGOT_PASSWORD_OTP: ['name', 'otp'],
  FORGOT_PIN_OTP: ['name', 'otp'],
  PSWD_RESET_REQUEST: ['name', 'timestamp'],
  PIN_RESET_REQUEST: ['name', 'timestamp'],
  PASSWORD_CHANGE_CONFIRMATION: ['name', 'timestamp'],
  PIN_CHANGE_CONFIRMATION: ['name', 'timestamp'],
  PRIMARY_EMAIL_CHANGED: ['name', 'oldEmail', 'newEmail', 'timestamp'],
  RECOVERY_EMAIL_CHANGED: ['name', 'newEmail', 'timestamp'],
  PRIMARY_EMAIL_VERIFIED: ['name', 'email'],
  RECOVERY_EMAIL_VERIFIED: ['name', 'email'],
  BACKUP_CODES_GENERATED: ['name', 'timestamp'],
  BACKUP_CODES_USED: ['name', 'action', 'timestamp'],
  BACKUP_CODES_REMAINING: ['name', 'remaining', 'timestamp'],
  ACCOUNT_RECOVERED: ['name', 'timestamp'],
  LOGIN_ALERT: ['name', 'device', 'loginMethod', 'timestamp'],
  LOGOUT: ['name', 'timestamp'],
  DEVICE_ADDED: ['name', 'device', 'timestamp'],
  SUSPICIOUS_ACTIVITY: ['name', 'device', 'timestamp'],
  SECURITY_ALERT: ['name', 'alert', 'attempts', 'window', 'timestamp'],
  TWO_FA_ENABLE: ['name', 'timestamp'],
  TWO_FA_DISABLE: ['name', 'timestamp'],
  SECURITY_KEY_ADDED: ['name', 'timestamp'],
  PIN_ENABLED_TOGGLE_TURNED_ON: ['name', 'timestamp'],
  PIN_DISABLED_TOGGLE_TURNED_OFF: ['name', 'timestamp'],
  PROFILE_UPDATED: ['name', 'changesDetailed', 'timestamp'],
  READING_CREATED: ['name', 'readingBP', 'readingPulse', 'readingGlucose', 'readingCategory', 'readingClassification', 'readingTimestamp', 'bpColor', 'pulseColor', 'glucoseColor'],
  READING_UPDATED: ['name', 'readingBP', 'readingPulse', 'readingGlucose', 'readingCategory', 'readingClassification', 'readingTimestamp', 'bpColor', 'pulseColor', 'glucoseColor'],
  READING_DELETED: ['name', 'readingTimestamp'],
  READING_REMINDER: ['name', 'bpTarget', 'pulseTarget', 'fastingTarget', 'preMealTarget', 'postMealTarget', 'bedtimeTarget', 'randomTarget'],
  DATA_SYNC_COMPLETE: ['name', 'readingsCount', 'timestamp'],
  FULL_DATA_BACKUP_CONFIRMATION: ['name', 'readingsCount', 'timestamp'],
  BACKUP_FAILED: ['name', 'error', 'timestamp'],
  AUTO_BACKUP_ENABLED: ['name', 'backupInterval', 'timestamp'],
  AUTO_BACKUP_DISABLED: ['name', 'timestamp'],
  AUTO_BACKUP_COMPLETED: ['name', 'readingsCount', 'timestamp'],
  AUTO_BACKUP_SCHEDULE_CHANGED: ['name', 'oldInterval', 'newInterval', 'timestamp'],
  DATA_EXPORT_READY: ['name', 'exportType', 'timestamp'],
  CHANGE_LOGS_DOWNLOADED: ['name', 'logRange', 'logTypes', 'timestamp'],
  EMAIL_LOGS_DOWNLOADED: ['name', 'email', 'timestamp'],
  DATA_IMPORTED: ['name', 'importedName', 'importedEmail', 'importedRecoveryEmail', 'importedPhone', 'readingsCount', 'avatarImported', 'settingsImported', 'backupVersion', 'backupExportedAt', 'timestamp'],
  GOOGLE_DRIVE_CONNECTED: ['name', 'driveEmail', 'timestamp'],
  MEDICAL_RECORD_ADDED: ['name', 'recordTitle', 'recordSize', 'recordUploadedAt'],
  MEDICAL_RECORD_REMOVED: ['name', 'recordTitle', 'recordRemovedAt'],
  DAILY_SUMMARY: ['name', 'periodLabel', 'bpAvg', 'bpHigh', 'bpLow', 'bpClass', 'pulseAvg', 'pulseHigh', 'pulseLow', 'pulseClass', 'fastingAvg', 'fastingClass', 'preMealAvg', 'preMealClass', 'postMealAvg', 'postMealClass', 'bedtimeAvg', 'bedtimeClass', 'randomAvg', 'randomClass', 'totalReadings', 'overallScore'],
  WEEKLY_SUMMARY: ['name', 'periodLabel', 'bpAvg', 'bpHigh', 'bpLow', 'bpClass', 'pulseAvg', 'pulseHigh', 'pulseLow', 'pulseClass', 'fastingAvg', 'fastingClass', 'preMealAvg', 'preMealClass', 'postMealAvg', 'postMealClass', 'bedtimeAvg', 'bedtimeClass', 'randomAvg', 'randomClass', 'totalReadings', 'overallScore'],
  FORTNIGHTLY_SUMMARY: ['name', 'periodLabel', 'bpAvg', 'bpHigh', 'bpLow', 'bpClass', 'pulseAvg', 'pulseHigh', 'pulseLow', 'pulseClass', 'fastingAvg', 'fastingClass', 'preMealAvg', 'preMealClass', 'postMealAvg', 'postMealClass', 'bedtimeAvg', 'bedtimeClass', 'randomAvg', 'randomClass', 'totalReadings', 'overallScore'],
  MONTHLY_SUMMARY: ['name', 'periodLabel', 'bpAvg', 'bpHigh', 'bpLow', 'bpClass', 'pulseAvg', 'pulseHigh', 'pulseLow', 'pulseClass', 'fastingAvg', 'fastingClass', 'preMealAvg', 'preMealClass', 'postMealAvg', 'postMealClass', 'bedtimeAvg', 'bedtimeClass', 'randomAvg', 'randomClass', 'totalReadings', 'overallScore'],
  ACCOUNT_DELETION_REQUEST: ['name', 'backupChoice', 'timestamp'],
  ACCOUNT_DELETED_CONFIRMATION: ['name', 'backupChoice', 'timestamp'],
  LOCAL_DATA_CLEARED: ['name', 'timestamp'],
  JOURNAL_CLEARED: ['name', 'timestamp'],
  DEVELOPER_NOTIFICATION: ['name', 'email', 'action', 'timestamp']
};

/* -----------------------------------------------------------------
   3. BODY CONTENT — one entry per template
   ----------------------------------------------------------------- */

const EMAIL_BODIES = {
  /* Group 1 — Authentication & Registration */
  OTP_VERIFICATION: `<p>Hello {{name}},</p><p>To complete your verification, please use the following One Time Password (OTP):</p><div class="code">{{otp}}</div><p>This OTP is valid for <strong>15 minutes</strong> and can be used once. Do not share it with anyone.</p><p>If you did not request this code, you can safely ignore this email. <span class="journal-highlight">My Health Journal</span> will never contact you about this email or ask for any login codes or links. Beware of phishing scams.</p>`,
  WELCOME: `<p>Hello {{name}},</p><p>Welcome to <span class="journal-highlight">My Health Journal</span>. Your account is now active and ready to use.</p><p>You can start logging blood pressure, pulse, and blood glucose readings, view trends, and export reports for your doctor.</p><p>We're glad to have you with us.</p>`,
  FORGOT_PASSWORD_OTP: `<p>Hello {{name}},</p><p>We received a request to reset your password. Please use the following One Time Password (OTP) to continue:</p><div class="code">{{otp}}</div><p>This OTP is valid for <strong>15 minutes</strong> and can be used once.</p><p>If you did not request a password reset, please ignore this email and consider changing your password for added security.</p>`,
  FORGOT_PIN_OTP: `<p>Hello {{name}},</p><p>We received a request to reset your app PIN. Please use the following One Time Password (OTP) to continue:</p><div class="code">{{otp}}</div><p>This OTP is valid for <strong>15 minutes</strong> and can be used once.</p><p>If you did not request a PIN reset, please ignore this email.</p>`,
  PSWD_RESET_REQUEST: `<p>Hello {{name}},</p><p>We received a request to reset your account password on {{timestamp}}.</p><p>If you made this request, follow the steps in the app to set a new password.</p><p>If you did not request this, please ignore this email and consider changing your password.</p>`,
  PIN_RESET_REQUEST: `<p>Hello {{name}},</p><p>We received a request to reset your app PIN on {{timestamp}}.</p><p>If you made this request, no further action is needed — follow the steps in the app.</p><p>If you did not request this, please ignore this email and consider changing your password.</p>`,
  PASSWORD_CHANGE_CONFIRMATION: `<p>Hello {{name}},</p><p>Your account password was successfully changed on {{timestamp}}.</p><p>If you made this change, no further action is needed. You can continue using the app normally.</p><p>If you did not make this change, please reset your password immediately and review the security settings on your account. Contact us right away if you suspect unauthorised access.</p>`,
  PIN_CHANGE_CONFIRMATION: `<p>Hello {{name}},</p><p>Your account PIN was successfully changed on {{timestamp}}.</p><p>If you made this change, no further action is needed.</p><p>If you did not make this change, please reset your PIN immediately and review your account security.</p>`,

  /* Group 2 — Email Address Changes */
  PRIMARY_EMAIL_CHANGED: `<p>Hello {{name}},</p><p>The primary email on your account was changed on {{timestamp}}.</p><p>Previous email: {{oldEmail}}<br>New email: {{newEmail}}</p><p>If you made this change, no further action is needed.</p><p>If you did not, please contact us immediately and review your account security.</p>`,
  RECOVERY_EMAIL_CHANGED: `<p>Hello {{name}},</p><p>The recovery email on your account was changed on {{timestamp}}.</p><p>New recovery email: {{newEmail}}</p><p>Your recovery email is used to regain access to your account if you forget your password or PIN. If you did not make this change, please contact us immediately.</p>`,
  PRIMARY_EMAIL_VERIFIED: `<p>Hello {{name}},</p><p>Your primary email ({{email}}) has been successfully verified.</p><p>You now have full access to all features of <span class="journal-highlight">My Health Journal</span>.</p>`,
  RECOVERY_EMAIL_VERIFIED: `<p>Hello {{name}},</p><p>Your recovery email ({{email}}) has been successfully verified.</p><p>Your account is now more secure.</p>`,

  /* Group 3 — Backup Codes & Recovery */
  BACKUP_CODES_GENERATED: `<p>Hello {{name}},</p><p>A new backup code was generated for your account on {{timestamp}}.</p><p>Please save this code in a safe place. It can be used once to recover access to your account if you lose access to your email OTP.</p><p>Previously issued codes are no longer valid. You can download the new code from <strong>Settings → Account Management → Security Settings → Backup Codes → Generate New Code</strong>.</p>`,
  BACKUP_CODES_USED: `<p>Hello {{name}},</p><p>A backup code was used on {{timestamp}} to authorise the following action:</p><p><strong>{{action}}</strong></p><p>If you did not perform this action, please change your password and PIN immediately from <strong>Settings → Account Management → Security Settings</strong>, then generate a fresh backup code.</p>`,
  BACKUP_CODES_REMAINING: `<p>Hello {{name}},</p><p>You have <strong>{{remaining}}</strong> usable backup codes remaining as of {{timestamp}}.</p><p>Each code is single-use. Once used, it cannot be reused. Because of this, we recommend always keeping at least one unused code saved in a safe place.</p><p><strong>To generate a new backup code:</strong></p><ol><li>Open <span class="journal-highlight">My Health Journal</span>.</li><li>Open the avatar menu (top-right).</li><li>Go to <strong>Settings → Account Management → Security Settings</strong>.</li><li>Tap <strong>Generate New Code</strong>.</li><li>Tap <strong>Download Code</strong> and store it safely.</li></ol>`,
  ACCOUNT_RECOVERED: `<p>Hello {{name}},</p><p>Your account was successfully recovered on {{timestamp}} using a backup code.</p><p>You now have full access to your account. For your security, please generate a new backup code from <strong>Settings → Account Management → Security Settings → Backup Codes</strong>.</p>`,

  /* Group 4 — Login & Devices */
  LOGIN_ALERT: `<p>Hello {{name}},</p><p>A new login to your account was recorded on {{timestamp}}.</p><p><strong>Login method:</strong> {{loginMethod}}</p><p><strong>Device:</strong> {{device}}</p><p>If this was you, no action is needed.</p><p>If you did not log in, please change <strong>both</strong> your password and PIN immediately using these steps:</p><ol><li>Open <span class="journal-highlight">My Health Journal</span>.</li><li>Open the avatar menu (top-right).</li><li>Go to <strong>Settings → Account Management → Security Settings</strong>.</li><li>Set a new password, then set a new PIN.</li><li>Tap <strong>Save Security Settings</strong>.</li></ol>`,
  LOGOUT: `<p>Hello {{name}},</p><p>You were signed out of <span class="journal-highlight">My Health Journal</span> on {{timestamp}}.</p><p>If you did not sign out, please change your password immediately.</p>`,
  DEVICE_ADDED: `<p>Hello {{name}},</p><p>A new device was used to sign in to your account on {{timestamp}}.</p><p><strong>Device:</strong> {{device}}</p><p>If this was you, no action is needed.</p><p>If you did not recognise this device, please change <strong>both</strong> your password and PIN immediately from <strong>Settings → Account Management → Security Settings</strong>.</p>`,

  /* Group 5 — Security Alerts */
  SUSPICIOUS_ACTIVITY: `<p>Hello {{name}},</p><p>We detected unusual activity on your account on {{timestamp}}.</p><p><strong>Device:</strong> {{device}}</p><p>This may indicate that someone is attempting to access your account. The signal is a repeated rate-limit trigger, not proof of compromise.</p><p>Please change <strong>both</strong> your password and PIN immediately:</p><ol><li>Open <span class="journal-highlight">My Health Journal</span>.</li><li>Open the avatar menu (top-right).</li><li>Go to <strong>Settings → Account Management → Security Settings</strong>.</li><li>Set a new password, then set a new PIN.</li><li>Tap <strong>Save Security Settings</strong>.</li></ol><p>If this was you, you can safely ignore this email.</p>`,
  SECURITY_ALERT: `<p>Hello {{name}},</p><p>A security alert was triggered on your account on {{timestamp}}.</p><p><strong>Alert:</strong> {{alert}}</p><p><strong>What happened:</strong> more than {{attempts}} verification requests (OTP, PIN, or recovery) were made from your account within {{window}}. To protect you, we paused further requests temporarily.</p><p>This is an informational alert, not a claim that your account has been compromised. If this was you, no action is needed.</p><p>If you did not initiate these requests, please change <strong>both</strong> your password and PIN immediately from <strong>Settings → Account Management → Security Settings</strong>.</p>`,
  TWO_FA_ENABLE: `<p>Hello {{name}},</p><p>Two-factor authentication (2FA) was enabled on your account on {{timestamp}}.</p><p><strong>What 2FA does:</strong> it adds a second step — usually a one-time code sent to your email — every time you sign in from a new device. Even if someone learns your password or PIN, they cannot sign in without the code.</p><p><strong>What happens next:</strong> on your next login from a new device, you will be asked for your password or PIN, followed by a 6-digit code.</p><p>If you did not make this change, please change <strong>both</strong> your password and PIN immediately.</p><p><strong>To disable 2FA in future:</strong></p><ol><li>Open <span class="journal-highlight">My Health Journal</span>.</li><li>Open the avatar menu (top-right).</li><li>Go to <strong>Settings → Account Management → Security Settings</strong>.</li><li>Locate <strong>Two-Factor Authentication</strong>.</li><li>Turn it off and confirm.</li></ol>`,
  TWO_FA_DISABLE: `<p>Hello {{name}},</p><p>Two-factor authentication (2FA) was disabled on your account on {{timestamp}}.</p><p><strong>What this means:</strong> from now on, your account can be accessed with only your <strong>password</strong> (or your <strong>PIN</strong>, if enabled). Without the second step, a stolen password or PIN is enough to reach your data.</p><p>If you did not make this change, please change <strong>both</strong> your password and PIN immediately and re-enable 2FA.</p><p><strong>To re-enable 2FA:</strong></p><ol><li>Open <span class="journal-highlight">My Health Journal</span>.</li><li>Open the avatar menu (top-right).</li><li>Go to <strong>Settings → Account Management → Security Settings</strong>.</li><li>Locate <strong>Two-Factor Authentication</strong>.</li><li>Turn it on and complete the verification.</li></ol>`,
  SECURITY_KEY_ADDED: `<p>Hello {{name}},</p><p>A new security key was added to your account on {{timestamp}}.</p><p><strong>What a security key does:</strong> it is a physical or built-in device (like a YubiKey or your phone's secure hardware) that you tap during login. It replaces the need to type a code and is resistant to phishing.</p><p>If you did not add this key, please contact us immediately and remove any unfamiliar keys from your account.</p><p><strong>To manage or remove security keys:</strong></p><ol><li>Open <span class="journal-highlight">My Health Journal</span>.</li><li>Open the avatar menu (top-right).</li><li>Go to <strong>Settings → Account Management → Security Settings</strong>.</li><li>Open <strong>Security Keys</strong>.</li><li>Review the list and remove anything unfamiliar.</li></ol>`,

  /* Group 6 — PIN & App Lock */
  PIN_ENABLED_TOGGLE_TURNED_ON: `<p>Hello {{name}},</p><p>Your app PIN was enabled on {{timestamp}}.</p><p>You will now be asked for your 5-digit PIN whenever the app opens.</p><p><strong>If you wish to disable this in future:</strong></p><ol><li>Open <span class="journal-highlight">My Health Journal</span>.</li><li>Open the avatar menu (top-right).</li><li>Go to <strong>Settings → Account Management → Security Settings</strong>.</li><li>Turn off <strong>Enable PIN</strong>.</li><li>Tap <strong>Save Security Settings</strong>.</li></ol>`,
  PIN_DISABLED_TOGGLE_TURNED_OFF: `<p>Hello {{name}},</p><p>Your app PIN was disabled on {{timestamp}}.</p><p>Your account is now accessible with <strong>password only</strong>. If you did not make this change, please re-enable the PIN and change your password immediately.</p><p><strong>To re-enable the PIN:</strong></p><ol><li>Open <span class="journal-highlight">My Health Journal</span>.</li><li>Open the avatar menu (top-right).</li><li>Go to <strong>Settings → Account Management → Security Settings</strong>.</li><li>Turn on <strong>Enable PIN</strong>.</li><li>Set your 5-digit PIN and confirm.</li><li>Tap <strong>Save Security Settings</strong>.</li></ol>`,

  /* Group 7 — Profile */
  PROFILE_UPDATED: `<p>Hello {{name}},</p><p>Your profile was updated on {{timestamp}}.</p><p><strong>Changes made:</strong></p><div>{{changesDetailed}}</div><p>If you did not make these changes, please contact us immediately.</p>`,

  /* Group 8 — Readings */
  READING_CREATED: `<p>Hello {{name}},</p><p>Your reading was recorded on {{readingTimestamp}}.</p><p><span style="color:#FF8308;font-weight:bold;">Blood Pressure:</span> <span style="font-weight:bold;color:{{bpColor}};">{{readingBP}}</span><br><span style="color:#FF8308;font-weight:bold;">Pulse:</span> <span style="font-weight:bold;color:{{pulseColor}};">{{readingPulse}}</span><br><span style="color:#FF8308;font-weight:bold;">Blood Glucose:</span> <span style="font-weight:bold;color:{{glucoseColor}};">{{readingGlucose}}</span> — {{readingCategory}} — {{readingClassification}}</p><p>You can review this reading in your journal at any time.</p>`,
  READING_UPDATED: `<p>Hello {{name}},</p><p>Your reading was updated on {{readingTimestamp}}.</p><p><span style="color:#FF8308;font-weight:bold;">Blood Pressure:</span> <span style="font-weight:bold;color:{{bpColor}};">{{readingBP}}</span><br><span style="color:#FF8308;font-weight:bold;">Pulse:</span> <span style="font-weight:bold;color:{{pulseColor}};">{{readingPulse}}</span><br><span style="color:#FF8308;font-weight:bold;">Blood Glucose:</span> <span style="font-weight:bold;color:{{glucoseColor}};">{{readingGlucose}}</span> — {{readingCategory}} — {{readingClassification}}</p><p>You can review this reading in your journal at any time.</p>`,
  READING_DELETED: `<p>Hello {{name}},</p><p>A reading recorded on {{readingTimestamp}} was deleted from your account.</p><p>If you did not delete this reading, please review your account activity.</p>`,
  READING_REMINDER: `<p>Hello {{name}},</p><p>This is your daily reminder to log your blood pressure, pulse, and blood glucose readings.</p><p><strong>Targets for a 100% Measurement Score:</strong></p><ul><li>Blood Pressure: {{bpTarget}}</li><li>Pulse: {{pulseTarget}}</li><li>Glucose — Fasting: {{fastingTarget}}</li><li>Glucose — Pre Meal: {{preMealTarget}}</li><li>Glucose — Post Meal: {{postMealTarget}}</li><li>Glucose — Bedtime: {{bedtimeTarget}}</li><li>Glucose — Random: {{randomTarget}}</li></ul><p>Regular tracking helps you and your doctor see clear trends over time.</p>`,
  DATA_SYNC_COMPLETE: `<p>Hello {{name}},</p><p>Your data was synced on {{timestamp}}.</p><p>Readings synced: {{readingsCount}}</p>`,

  /* Group 9 — Backup */
  FULL_DATA_BACKUP_CONFIRMATION: `<p>Hello {{name}},</p><p>Your full data backup completed successfully on {{timestamp}}.</p><p>Readings included: {{readingsCount}}</p><p>Your backup is stored in your Google Drive and a mirror copy is stored in the Administrator's Drive.</p>`,
  BACKUP_FAILED: `<p>Hello {{name}},</p><p>Your backup attempt on {{timestamp}} did not complete.</p><p><strong>Error:</strong> {{error}}</p><p>Please check your internet connection and Google Drive access, then try the backup again from the app.</p>`,
  AUTO_BACKUP_ENABLED: `<p>Hello {{name}},</p><p>Automatic backup was enabled on {{timestamp}}.</p><p>Your data will now be backed up <strong>{{backupInterval}}</strong> while the app is open. Keep Google Drive connected to ensure both copies are saved.</p><p>You can change this schedule at any time from <strong>Settings → Backup &amp; Exports → Automatic Google Drive Backup</strong>.</p>`,
  AUTO_BACKUP_DISABLED: `<p>Hello {{name}},</p><p>Automatic backup was disabled on {{timestamp}}.</p><p>You can re-enable it at any time from <strong>Settings → Backup &amp; Exports → Automatic Google Drive Backup</strong>.</p>`,
  AUTO_BACKUP_COMPLETED: `<p>Hello {{name}},</p><p>Your automatic backup completed successfully on {{timestamp}}.</p><p>Readings included: {{readingsCount}}</p><p>Both your Google Drive and the Administrator's Drive received a copy.</p>`,
  AUTO_BACKUP_SCHEDULE_CHANGED: `<p>Hello {{name}},</p><p>Your automatic backup schedule was updated on {{timestamp}}.</p><p><strong>Previous schedule:</strong> {{oldInterval}}</p><p><strong>New schedule:</strong> {{newInterval}}</p><p>Supported intervals include Daily, Every 3 Days, Every 7 Days, Every 14 Days, Every 30 Days, Every 60 Days, Every 90 Days, Every 180 Days, and Custom (any number of days you choose).</p><p>You can change this at any time from <strong>Settings → Backup &amp; Exports → Automatic Google Drive Backup</strong>.</p>`,

  /* Group 10 — Export & Import */
  DATA_EXPORT_READY: `<p>Hello {{name}},</p><p>Your <strong>{{exportType}}</strong> is ready as of {{timestamp}}.</p><p>The file has been downloaded to your device and uploaded to your Google Drive. A mirror copy has been stored in the Administrator's Drive.</p>`,
  CHANGE_LOGS_DOWNLOADED: `<p>Hello {{name}},</p><p>Your change log export was generated on {{timestamp}}.</p><p><strong>Date range:</strong> {{logRange}}</p><p><strong>Log types included:</strong> {{logTypes}}</p><p>The file contains your account activity history for the selected range.</p>`,
  EMAIL_LOGS_DOWNLOADED: `<p>Hello {{name}},</p><p>Your email delivery log export was generated on {{timestamp}}.</p><p>It was sent to <strong>{{email}}</strong>, your account's primary email address. The log contains the full history of emails dispatched to your account from <span class="journal-highlight">My Health Journal</span>.</p>`,
  DATA_IMPORTED: `<p>Hello {{name}},</p><p>Your backup file was imported on {{timestamp}}.</p><p><strong>Profile details from the backup:</strong></p><ul><li>Name: {{importedName}}</li><li>Primary Email: {{importedEmail}}</li><li>Recovery Email: {{importedRecoveryEmail}}</li><li>Phone: {{importedPhone}}</li></ul><p><strong>Readings imported:</strong> {{readingsCount}}</p><p><strong>Avatar imported:</strong> {{avatarImported}}</p><p><strong>Settings imported:</strong> {{settingsImported}}</p><p><strong>Backup version:</strong> {{backupVersion}}</p><p><strong>Backup exported at:</strong> {{backupExportedAt}}</p>`,
  GOOGLE_DRIVE_CONNECTED: `<p>Hello {{name}},</p><p>Your Google Drive was connected on {{timestamp}}.</p><p><strong>Connected account:</strong> {{driveEmail}}</p><p>Future backups and exports will be saved to your Google Drive under <em>/My Health Journal/</em>. A mirror copy will also be stored in the Administrator's Drive.</p><p>You can disconnect at any time from <strong>Settings → Backup &amp; Exports → Connect Your Google Drive → Disconnect</strong>.</p>`,
  MEDICAL_RECORD_ADDED: `<p>Hello {{name}},</p><p>A new medical record was added to your account on {{recordUploadedAt}}.</p><p><strong>Title:</strong> {{recordTitle}}<br><strong>Size:</strong> {{recordSize}}</p><p>The file is stored in your Google Drive under <em>/My Health Journal/Medical Records/</em> and a mirror copy has been stored in the Administrator's Drive.</p>`,
  MEDICAL_RECORD_REMOVED: `<p>Hello {{name}},</p><p>A medical record was removed from your account on {{recordRemovedAt}}.</p><p><strong>Title:</strong> {{recordTitle}}</p><p>If you did not remove this record, please contact us immediately.</p>`,

  /* Group 11 — Summaries */
  DAILY_SUMMARY: `<p>Hello {{name}},</p><p>Here is your <strong>{{periodLabel}}</strong> health summary.</p><p><strong>Blood Pressure:</strong> Average {{bpAvg}} · Highest {{bpHigh}} · Lowest {{bpLow}} · {{bpClass}}</p><p><strong>Pulse:</strong> Average {{pulseAvg}} · Highest {{pulseHigh}} · Lowest {{pulseLow}} · {{pulseClass}}</p><p><strong>Blood Glucose (by category):</strong></p><ul><li>Fasting: {{fastingAvg}} — {{fastingClass}}</li><li>Pre Meal: {{preMealAvg}} — {{preMealClass}}</li><li>Post Meal: {{postMealAvg}} — {{postMealClass}}</li><li>Bedtime: {{bedtimeAvg}} — {{bedtimeClass}}</li><li>Random: {{randomAvg}} — {{randomClass}}</li></ul><p><strong>Total readings logged:</strong> {{totalReadings}}</p><p><strong>Measurement Score:</strong> {{overallScore}}</p>`,
  WEEKLY_SUMMARY: `<p>Hello {{name}},</p><p>Here is your <strong>{{periodLabel}}</strong> health summary.</p><p><strong>Blood Pressure:</strong> Average {{bpAvg}} · Highest {{bpHigh}} · Lowest {{bpLow}} · {{bpClass}}</p><p><strong>Pulse:</strong> Average {{pulseAvg}} · Highest {{pulseHigh}} · Lowest {{pulseLow}} · {{pulseClass}}</p><p><strong>Blood Glucose (by category):</strong></p><ul><li>Fasting: {{fastingAvg}} — {{fastingClass}}</li><li>Pre Meal: {{preMealAvg}} — {{preMealClass}}</li><li>Post Meal: {{postMealAvg}} — {{postMealClass}}</li><li>Bedtime: {{bedtimeAvg}} — {{bedtimeClass}}</li><li>Random: {{randomAvg}} — {{randomClass}}</li></ul><p><strong>Total readings logged:</strong> {{totalReadings}}</p><p><strong>Measurement Score:</strong> {{overallScore}}</p>`,
  FORTNIGHTLY_SUMMARY: `<p>Hello {{name}},</p><p>Here is your <strong>{{periodLabel}}</strong> health summary.</p><p><strong>Blood Pressure:</strong> Average {{bpAvg}} · Highest {{bpHigh}} · Lowest {{bpLow}} · {{bpClass}}</p><p><strong>Pulse:</strong> Average {{pulseAvg}} · Highest {{pulseHigh}} · Lowest {{pulseLow}} · {{pulseClass}}</p><p><strong>Blood Glucose (by category):</strong></p><ul><li>Fasting: {{fastingAvg}} — {{fastingClass}}</li><li>Pre Meal: {{preMealAvg}} — {{preMealClass}}</li><li>Post Meal: {{postMealAvg}} — {{postMealClass}}</li><li>Bedtime: {{bedtimeAvg}} — {{bedtimeClass}}</li><li>Random: {{randomAvg}} — {{randomClass}}</li></ul><p><strong>Total readings logged:</strong> {{totalReadings}}</p><p><strong>Measurement Score:</strong> {{overallScore}}</p>`,
  MONTHLY_SUMMARY: `<p>Hello {{name}},</p><p>Here is your <strong>{{periodLabel}}</strong> health summary.</p><p><strong>Blood Pressure:</strong> Average {{bpAvg}} · Highest {{bpHigh}} · Lowest {{bpLow}} · {{bpClass}}</p><p><strong>Pulse:</strong> Average {{pulseAvg}} · Highest {{pulseHigh}} · Lowest {{pulseLow}} · {{pulseClass}}</p><p><strong>Blood Glucose (by category):</strong></p><ul><li>Fasting: {{fastingAvg}} — {{fastingClass}}</li><li>Pre Meal: {{preMealAvg}} — {{preMealClass}}</li><li>Post Meal: {{postMealAvg}} — {{postMealClass}}</li><li>Bedtime: {{bedtimeAvg}} — {{bedtimeClass}}</li><li>Random: {{randomAvg}} — {{randomClass}}</li></ul><p><strong>Total readings logged:</strong> {{totalReadings}}</p><p><strong>Measurement Score:</strong> {{overallScore}}</p>`,

  /* Group 12 — Account Deletion */
  ACCOUNT_DELETION_REQUEST: `<p>Hello {{name}},</p><p>We received a request to delete your <span class="journal-highlight">My Health Journal</span> account on {{timestamp}}.</p><p><strong>Backup decision at request time:</strong> {{backupChoice}}</p><p>If you chose to download a backup, the file is now in your downloads folder and a copy has been uploaded to your Google Drive.</p><p>If you chose to proceed without a backup, please be aware that once deletion completes, the data cannot be recovered.</p><p>Deletion will complete within the next few minutes. If you did not request this, contact us immediately.</p>`,
  ACCOUNT_DELETED_CONFIRMATION: `<p>Hello {{name}},</p><p>Your <span class="journal-highlight">My Health Journal</span> account was permanently deleted on {{timestamp}}.</p><p><strong>Backup taken before deletion:</strong> {{backupChoice}}</p><p>Your profile and all readings have been removed from our database. Any backup you downloaded or saved to Google Drive remains in your possession and is untouched.</p><p>If you did not request this deletion, please contact us immediately.</p>`,

  /* Group 13 — Local Data */
  LOCAL_DATA_CLEARED: `<p>Hello {{name}},</p><p>Your locally stored data was cleared from this device on {{timestamp}}.</p><p>Your cloud account and readings remain available. Sign in again to restore them.</p>`,
  JOURNAL_CLEARED: `<p>Hello {{name}},</p><p>Your journal was cleared on {{timestamp}}.</p><p>All readings have been removed from your account. Your profile and account remain active.</p><p>If you did not perform this action, please contact us immediately.</p>`,

  /* Group 14 — Administrator */
  DEVELOPER_NOTIFICATION: `<p>Administrator Notification</p><p>An audited action was recorded on the platform. This email is sent only to the Administrator for support and account-safety purposes.</p><p><strong>Action:</strong> {{action}}</p><p><strong>User:</strong> {{name}} ({{email}})</p><p><strong>Time:</strong> {{timestamp}}</p>`
};

/* -----------------------------------------------------------------
   4. HELPERS
   ----------------------------------------------------------------- */

function mhjDetectDevice() {
  const ua = (navigator.userAgent || '').toString();
  let os = 'Unknown Device';
  if (/Windows NT/i.test(ua)) os = 'Windows PC';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'MacBook';
  else if (/Android/i.test(ua)) os = 'Android Phone';
  else if (/iPhone/i.test(ua)) os = 'Apple iPhone';
  else if (/iPad/i.test(ua)) os = 'Apple iPad';
  else if (/Linux/i.test(ua)) os = 'Linux PC';

  let browser = 'Browser';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';

  return `${os} (${browser})`;
}

function mhjGet(obj, path, fallback = '') {
  try {
    const parts = String(path).split('.');
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return fallback;
      cur = cur[p];
    }
    return cur == null ? fallback : cur;
  } catch { return fallback; }
}

function mhjColorForBP(sys, dia) {
  if (typeof getBPStatus !== 'function') return '#A0AEC0';
  const s = getBPStatus(sys, dia);
  switch (s.class) {
    case 'status-normal': return '#10B981';
    case 'status-elevated': return '#D97706';
    case 'status-stage1': return '#EA580C';
    case 'status-stage2': return '#9333EA';
    case 'status-crisis': return '#B91C1C';
    case 'status-hypotension': return '#2563EB';
    default: return '#A0AEC0';
  }
}

function mhjColorForPulse(pulse) {
  if (typeof getPulseStatus !== 'function') return '#A0AEC0';
  const s = getPulseStatus(pulse);
  switch (s.class) {
    case 'pulse-normal': return '#10B981';
    case 'pulse-brady': return '#D97706';
    case 'pulse-tachy-mild': return '#EA580C';
    case 'pulse-tachy-severe': return '#B91C1C';
    case 'pulse-brady-severe': return '#2563EB';
    default: return '#A0AEC0';
  }
}

function mhjColorForGlucose(value, category, unit) {
  if (typeof getGlucoseStatus !== 'function') return '#A0AEC0';
  const s = getGlucoseStatus(value, category, unit);
  switch (s.class) {
    case 'glucose-normal': return '#10B981';
    case 'glucose-elevated': return '#D97706';
    case 'glucose-high': return '#B91C1C';
    case 'glucose-low': return '#2563EB';
    default: return '#A0AEC0';
  }
}

function mhjFormatReading(reading) {
  const bpPresent = typeof hasBP === 'function'
    ? hasBP(reading)
    : (typeof reading.sys === 'number' && typeof reading.dia === 'number');
  const hasPulse = typeof isPresent === 'function' ? isPresent(reading.pulse) : !!reading.pulse;
  const hasGlucose = typeof normaliseGlucoseToMgDl === 'function'
    ? normaliseGlucoseToMgDl(reading.glucoseValue, reading.glucoseUnit) !== null
    : !!reading.glucoseValue;

  const bpValue = bpPresent ? `${reading.sys}/${reading.dia} mmHg` : '--/-- mmHg';
  const pulseValue = hasPulse ? `${reading.pulse} BPM` : '-- BPM';
  const glucoseValue = hasGlucose
    ? `${typeof formatGlucosePrimary === 'function' ? formatGlucosePrimary(reading.glucoseValue, reading.glucoseUnit) : reading.glucoseValue}`
    : '-- mg/dL';

  const bpColor = bpPresent ? mhjColorForBP(reading.sys, reading.dia) : '#A0AEC0';
  const pulseColor = hasPulse ? mhjColorForPulse(reading.pulse) : '#A0AEC0';
  const glucoseColor = hasGlucose
    ? mhjColorForGlucose(reading.glucoseValue, reading.glucoseCategory, reading.glucoseUnit)
    : '#A0AEC0';

  const bpClass = bpPresent && typeof getBPStatus === 'function'
    ? getBPStatus(reading.sys, reading.dia).label.replace(/[^\w\s()\-]/g, '').trim()
    : '--';
  const pulseClass = hasPulse && typeof getPulseStatus === 'function'
    ? getPulseStatus(reading.pulse).label.replace(/[^\w\s()\-]/g, '').trim()
    : '--';
  const glucoseClass = hasGlucose && typeof getGlucoseStatus === 'function'
    ? getGlucoseStatus(reading.glucoseValue, reading.glucoseCategory, reading.glucoseUnit).label
    : '--';
  const glucoseCat = hasGlucose && typeof GLUCOSE_LABELS !== 'undefined'
    ? GLUCOSE_LABELS[reading.glucoseCategory] || '--'
    : '--';

  return {
    readingBP: bpValue,
    readingPulse: pulseValue,
    readingGlucose: glucoseValue,
    readingCategory: glucoseCat,
    readingClassification: `${bpClass === '--' ? '' : bpClass}${glucoseClass !== '--' ? ' · ' + glucoseClass : ''}`.trim() || '--',
    readingTimestamp: reading.timestamp
      ? new Date(reading.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      : '--',
    bpColor,
    pulseColor,
    glucoseColor
  };
}

function mhjBuildChangesDetailed(oldProfile, newProfile) {
  if (!oldProfile || !newProfile) return '<em>No details available.</em>';
  const fields = [
    ['name', 'Full Name'],
    ['email', 'Primary Email'],
    ['recoveryEmail', 'Recovery Email'],
    ['phone', 'Phone'],
    ['dob', 'Date of Birth'],
    ['gender', 'Gender'],
    ['address', 'Address'],
    ['bloodGroup', 'Blood Group'],
    ['emergencyContact', 'Emergency Contact'],
    ['notes', 'Notes']
  ];
  const lines = [];
  for (const [key, label] of fields) {
    const oldVal = (oldProfile[key] ?? '').toString().trim();
    const newVal = (newProfile[key] ?? '').toString().trim();
    if (oldVal === newVal) continue;
    if (!oldVal && newVal) {
      lines.push(`<li><strong>${label}:</strong> Added &ldquo;${mhjEscape(newVal)}&rdquo;</li>`);
    } else if (oldVal && !newVal) {
      lines.push(`<li><strong>${label}:</strong> Removed (was &ldquo;${mhjEscape(oldVal)}&rdquo;)</li>`);
    } else {
      lines.push(`<li><strong>${label}:</strong> &ldquo;${mhjEscape(oldVal)}&rdquo; &rarr; &ldquo;${mhjEscape(newVal)}&rdquo;</li>`);
    }
  }
  if (!lines.length) return '<em>No field changes were detected.</em>';
  return `<ul>${lines.join('')}</ul>`;
}

function mhjEscape(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function mhjNow() {
  return new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

/* -----------------------------------------------------------------
   5. renderEmailTemplate(templateName, userData, extraData)
   ----------------------------------------------------------------- */

function renderEmailTemplate(templateName, userData = {}, extraData = {}) {
  if (!EMAIL_TEMPLATES[templateName]) {
    throw new Error(`Unknown email template: ${templateName}`);
  }

  const body = EMAIL_BODIES[templateName];
  if (!body) {
    throw new Error(`Missing body for template: ${templateName}`);
  }

  const user = userData || {};
  const extra = { ...extraData };

  const variables = {
    recordTitle: extra.recordTitle || '--',
    recordSize: extra.recordSize || '--',
    recordUploadedAt: extra.recordUploadedAt || mhjNow(),
    recordRemovedAt: extra.recordRemovedAt || mhjNow(),
    name: user.name || 'there',
    email: user.email || '',
    otp: extra.otp || '',
    device: extra.device || mhjDetectDevice(),
    loginMethod: extra.loginMethod || 'Password',
    timestamp: extra.timestamp || mhjNow(),
    action: extra.action || '',
    alert: extra.alert || '',
    attempts: extra.attempts || '',
    window: extra.window || '',
    oldEmail: extra.oldEmail || '',
    newEmail: extra.newEmail || '',
    readingsCount: extra.readingsCount ?? 0,
    totalReadings: extra.totalReadings ?? extra.readingsCount ?? 0,
    remaining: extra.remaining ?? 0,
    error: extra.error || '',
    backupChoice: extra.backupChoice || 'Not specified',
    backupInterval: extra.backupInterval || 'Daily',
    oldInterval: extra.oldInterval || 'Daily',
    newInterval: extra.newInterval || 'Daily',
    exportType: extra.exportType || 'Export',
    logRange: extra.logRange || 'All time',
    logTypes: extra.logTypes || 'All logs',
    driveEmail: extra.driveEmail || user.email || '',
    periodLabel: extra.periodLabel || 'Daily',
    bpAvg: extra.bpAvg || '--',
    bpHigh: extra.bpHigh || '--',
    bpLow: extra.bpLow || '--',
    bpClass: extra.bpClass || '--',
    pulseAvg: extra.pulseAvg || '--',
    pulseHigh: extra.pulseHigh || '--',
    pulseLow: extra.pulseLow || '--',
    pulseClass: extra.pulseClass || '--',
    fastingAvg: extra.fastingAvg || '--',
    fastingClass: extra.fastingClass || '--',
    preMealAvg: extra.preMealAvg || '--',
    preMealClass: extra.preMealClass || '--',
    postMealAvg: extra.postMealAvg || '--',
    postMealClass: extra.postMealClass || '--',
    bedtimeAvg: extra.bedtimeAvg || '--',
    bedtimeClass: extra.bedtimeClass || '--',
    randomAvg: extra.randomAvg || '--',
    randomClass: extra.randomClass || '--',
    overallScore: extra.overallScore || '--',
    bpTarget: '3 readings',
    pulseTarget: '3 readings',
    fastingTarget: '1 reading',
    preMealTarget: '3 readings',
    postMealTarget: '3 readings',
    bedtimeTarget: '1 reading',
    randomTarget: '1 reading',
    changesDetailed: extra.changesDetailed || (extra.oldProfile && extra.newProfile
      ? mhjBuildChangesDetailed(extra.oldProfile, extra.newProfile)
      : '<em>No details available.</em>'),
    importedName: extra.importedName || '--',
    importedEmail: extra.importedEmail || '--',
    importedRecoveryEmail: extra.importedRecoveryEmail || '--',
    importedPhone: extra.importedPhone || '--',
    avatarImported: extra.avatarImported || 'No',
    settingsImported: extra.settingsImported || 'No',
    backupVersion: extra.backupVersion || '1.0.0',
    backupExportedAt: extra.backupExportedAt || '--',
    readingBP: extra.readingBP || '--',
    readingPulse: extra.readingPulse || '--',
    readingGlucose: extra.readingGlucose || '--',
    readingCategory: extra.readingCategory || '--',
    readingClassification: extra.readingClassification || '--',
    readingTimestamp: extra.readingTimestamp || mhjNow(),
    bpColor: extra.bpColor || '#A0AEC0',
    pulseColor: extra.pulseColor || '#A0AEC0',
    glucoseColor: extra.glucoseColor || '#A0AEC0'
  };

  if (extra.reading && typeof extra.reading === 'object') {
    const formatted = mhjFormatReading(extra.reading);
    Object.assign(variables, formatted);
  }

  let resolvedBody = body;
  resolvedBody = resolvedBody.replace(/\{\{([a-zA-Z]+)\}\}/g, (_, key) => {
    const val = variables[key];
    return val == null ? '' : String(val);
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${EMAIL_TEMPLATES[templateName]}</title>
  <style>${MHJ_EMAIL_STYLE}</style>
</head>
<body>
  <div class="container">
    ${mhjEmailHeader()}
    ${resolvedBody}
    ${MHJ_EMAIL_CLOSING}
    ${mhjEmailFooter().replace('{{EMAIL_YEAR}}', new Date().getFullYear())}
  </div>
</body>
</html>`;

  const subject = `My Health Journal — ${EMAIL_TEMPLATES[templateName]}`;

  return { subject, htmlBody: html };
}

/* -----------------------------------------------------------------
   6. sendEmailTemplate(templateName, userData, extraData)
   ----------------------------------------------------------------- */

async function sendEmailTemplate(templateName, userData = null, extraData = {}) {
  try {
    const user = userData || (typeof APP !== 'undefined' ? APP.user : null) || {};
    const { subject, htmlBody } = renderEmailTemplate(templateName, user, extraData);

    if (typeof mhjApi !== 'function') {
      console.warn('mhjApi not available — email not sent:', templateName);
      return false;
    }

    const result = await mhjApi('event', {
      templateName,
      subject,
      html: htmlBody,
      to: user.email,
      cc: user.recoveryEmail || '',
      userEmail: user.email,
      userName: user.name,
      eventId: (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : String(Date.now())
    });

    return !!result?.success;
  } catch (e) {
    console.error(`sendEmailTemplate(${templateName}):`, e);
    return false;
  }
}

/* Expose for other modules. */
if (typeof window !== 'undefined') {
  window.EMAIL_TEMPLATES = EMAIL_TEMPLATES;
  window.EMAIL_TRIGGERS = EMAIL_TRIGGERS;
  window.EMAIL_VARIABLES = EMAIL_VARIABLES;
  window.renderEmailTemplate = renderEmailTemplate;
  window.sendEmailTemplate = sendEmailTemplate;
  window.mhjDetectDevice = mhjDetectDevice;
  window.mhjBuildChangesDetailed = mhjBuildChangesDetailed;
  window.mhjFormatReading = mhjFormatReading;
}

if (typeof module !== 'undefined') {
  module.exports = {
    EMAIL_TEMPLATES,
    EMAIL_TRIGGERS,
    EMAIL_VARIABLES,
    renderEmailTemplate,
    sendEmailTemplate,
    mhjDetectDevice,
    mhjBuildChangesDetailed,
    mhjFormatReading
  };
}