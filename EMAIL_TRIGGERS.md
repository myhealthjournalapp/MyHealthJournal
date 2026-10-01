# Email Template & Trigger Matrix

**Total active templates: 54**

Subjects and variables below are generated from the live email registry. Email requests are sent to the configured Cloudflare Worker; delivery depends on its Gmail configuration.

| # | Code | Name / Subject Suffix | Trigger | Type | Variables |
| --- | --- | --- | --- | --- | --- |
| 1 | `OTP_VERIFICATION` | OTP Verification | User requests OTP during registration or email verification. | Security-Critical | `name`, `otp` |
| 2 | `WELCOME` | Welcome | Fires immediately after a new user completes registration. | Routine | `name`, `email` |
| 3 | `FORGOT_PASSWORD_OTP` | Forgot Password OTP | User requests password reset OTP. | Security-Critical | `name`, `otp` |
| 4 | `FORGOT_PIN_OTP` | Forgot PIN OTP | User requests PIN reset OTP. | Security-Critical | `name`, `otp` |
| 5 | `PSWD_RESET_REQUEST` | Password Reset Requested | Password-reset OTP delivery succeeded. | Security-Critical | `name`, `timestamp` |
| 6 | `PIN_RESET_REQUEST` | PIN Reset Requested | PIN-reset OTP delivery succeeded. | Security-Critical | `name`, `timestamp` |
| 7 | `PASSWORD_CHANGE_CONFIRMATION` | Password Change Confirmation | Password was successfully changed. | Security-Critical | `name`, `timestamp` |
| 8 | `PIN_CHANGE_CONFIRMATION` | PIN Change Confirmation | PIN was successfully changed. | Security-Critical | `name`, `timestamp` |
| 9 | `PRIMARY_EMAIL_CHANGED` | Primary Email Changed | Primary email changed. | Security-Critical | `name`, `oldEmail`, `newEmail`, `timestamp` |
| 10 | `RECOVERY_EMAIL_CHANGED` | Recovery Email Changed | Recovery email changed. | Security-Critical | `name`, `newEmail`, `timestamp` |
| 11 | `PRIMARY_EMAIL_VERIFIED` | Primary Email Verified | Primary email verification completed. | Routine | `name`, `email` |
| 12 | `RECOVERY_EMAIL_VERIFIED` | Recovery Email Verified | Recovery email verification completed. | Routine | `name`, `email` |
| 13 | `BACKUP_CODES_GENERATED` | Backup Codes Generated | A new backup code was generated. | Security-Critical | `name`, `timestamp` |
| 14 | `BACKUP_CODES_USED` | Backup Codes Used | A backup code was consumed for a reset. | Security-Critical | `name`, `action`, `timestamp` |
| 15 | `BACKUP_CODES_REMAINING` | Backup Codes Remaining | Backup code consumption left zero usable codes. | Security-Critical | `name`, `remaining`, `timestamp` |
| 16 | `ACCOUNT_RECOVERED` | Account Recovered | Password or PIN reset authorised by a consumed backup code succeeded. | Security-Critical | `name`, `timestamp` |
| 17 | `LOGIN_ALERT` | Login Alert | Successful login via password or PIN. | Security-Critical | `name`, `device`, `loginMethod`, `timestamp` |
| 18 | `LOGOUT` | Logged Out | User signed out through the ordinary logout action. | Routine | `name`, `timestamp` |
| 19 | `DEVICE_ADDED` | Device Added | Login from a previously unseen browser. | Security-Critical | `name`, `device`, `timestamp` |
| 20 | `SUSPICIOUS_ACTIVITY` | Suspicious Activity | Rate limit on PIN/recovery attempts reached. | Security-Critical | `name`, `device`, `timestamp` |
| 21 | `SECURITY_ALERT` | Security Alert | Rate-limit threshold reached on OTP/PIN/recovery attempts. | Security-Critical | `name`, `alert`, `attempts`, `window`, `timestamp` |
| 22 | `TWO_FA_ENABLE` | 2FA Enable | 2FA enabled after real enrollment. | Security-Critical | `name`, `timestamp` |
| 23 | `TWO_FA_DISABLE` | 2FA Disable | 2FA disabled after authenticated removal. | Security-Critical | `name`, `timestamp` |
| 24 | `SECURITY_KEY_ADDED` | Security Key Added | WebAuthn security key enrolled. | Security-Critical | `name`, `timestamp` |
| 25 | `PIN_ENABLED_TOGGLE_TURNED_ON` | PIN Enabled | PIN toggle changed false → true. | Routine | `name`, `timestamp` |
| 26 | `PIN_DISABLED_TOGGLE_TURNED_OFF` | PIN Disabled | PIN toggle changed true → false. | Security-Critical | `name`, `timestamp` |
| 27 | `PROFILE_UPDATED` | Profile Updated | One or more profile fields were changed. | Routine | `name`, `changesDetailed`, `timestamp` |
| 28 | `READING_CREATED` | Reading Created | A reading was created. | Routine | `name`, `readingBP`, `readingPulse`, `readingGlucose`, `readingCategory`, `readingClassification`, `readingTimestamp`, `bpColor`, `pulseColor`, `glucoseColor` |
| 29 | `READING_UPDATED` | Reading Updated | An existing reading was modified. | Routine | `name`, `readingBP`, `readingPulse`, `readingGlucose`, `readingCategory`, `readingClassification`, `readingTimestamp`, `bpColor`, `pulseColor`, `glucoseColor` |
| 30 | `READING_DELETED` | Reading Deleted | A reading was removed. | Routine | `name`, `readingTimestamp` |
| 31 | `READING_REMINDER` | Reading Reminder | 09:00 UTC when enabled and no reading exists for the day. | Routine | `name`, `bpTarget`, `pulseTarget`, `fastingTarget`, `preMealTarget`, `postMealTarget`, `bedtimeTarget`, `randomTarget` |
| 32 | `DATA_SYNC_COMPLETE` | Data Sync Complete | A batch of locally changed readings was committed to Firestore. | Routine | `name`, `readingsCount`, `timestamp` |
| 33 | `FULL_DATA_BACKUP_CONFIRMATION` | Full Data Backup Confirmation | Full data backup completed to both Drives. | Routine | `name`, `readingsCount`, `timestamp` |
| 34 | `BACKUP_FAILED` | Backup Failed | A requested Drive upload failed. | Security-Critical | `name`, `error`, `timestamp` |
| 35 | `AUTO_BACKUP_ENABLED` | Auto Backup Enabled | User toggled automatic backup on. | Routine | `name`, `backupInterval`, `timestamp` |
| 36 | `AUTO_BACKUP_DISABLED` | Auto Backup Disabled | User toggled automatic backup off. | Routine | `name`, `timestamp` |
| 37 | `AUTO_BACKUP_COMPLETED` | Auto Backup Completed | Scheduled automatic backup completed. | Routine | `name`, `readingsCount`, `timestamp` |
| 38 | `AUTO_BACKUP_SCHEDULE_CHANGED` | Auto Backup Schedule Changed | Active auto-backup interval changed. | Routine | `name`, `oldInterval`, `newInterval`, `timestamp` |
| 39 | `DATA_EXPORT_READY` | Data Export Ready | A PDF, CSV, or backup export was archived successfully. | Routine | `name`, `exportType`, `timestamp` |
| 40 | `CHANGE_LOGS_DOWNLOADED` | Change Logs Downloaded | A filtered change-log export was generated. | Routine | `name`, `logRange`, `logTypes`, `timestamp` |
| 41 | `EMAIL_LOGS_DOWNLOADED` | Email Logs Downloaded | Email delivery log export generated. | Routine | `name`, `email`, `timestamp` |
| 42 | `DATA_IMPORTED` | Data Imported | Validated backup file merged into account. | Routine | `name`, `importedName`, `importedEmail`, `importedRecoveryEmail`, `importedPhone`, `readingsCount`, `avatarImported`, `settingsImported`, `backupVersion`, `backupExportedAt`, `timestamp` |
| 43 | `GOOGLE_DRIVE_CONNECTED` | Google Drive Connected | User connected their Google Drive. | Routine | `name`, `driveEmail`, `timestamp` |
| 44 | `MEDICAL_RECORD_ADDED` | Medical Record Added | A PDF was uploaded to Medical Records. | Routine | `name`, `recordTitle`, `recordSize`, `recordUploadedAt` |
| 45 | `MEDICAL_RECORD_REMOVED` | Medical Record Removed | A PDF was deleted from Medical Records. | Routine | `name`, `recordTitle`, `recordRemovedAt` |
| 46 | `DAILY_SUMMARY` | Daily Summary | 09:00 UTC the following day, when enabled. | Routine | `name`, `periodLabel`, `bpAvg`, `bpHigh`, `bpLow`, `bpClass`, `pulseAvg`, `pulseHigh`, `pulseLow`, `pulseClass`, `fastingAvg`, `fastingClass`, `preMealAvg`, `preMealClass`, `postMealAvg`, `postMealClass`, `bedtimeAvg`, `bedtimeClass`, `randomAvg`, `randomClass`, `totalReadings`, `overallScore` |
| 47 | `WEEKLY_SUMMARY` | Weekly Summary | Monday 09:00 UTC when enabled. | Routine | `name`, `periodLabel`, `bpAvg`, `bpHigh`, `bpLow`, `bpClass`, `pulseAvg`, `pulseHigh`, `pulseLow`, `pulseClass`, `fastingAvg`, `fastingClass`, `preMealAvg`, `preMealClass`, `postMealAvg`, `postMealClass`, `bedtimeAvg`, `bedtimeClass`, `randomAvg`, `randomClass`, `totalReadings`, `overallScore` |
| 48 | `FORTNIGHTLY_SUMMARY` | Fortnightly Summary | Every second Monday, 09:00 UTC, when enabled. | Routine | `name`, `periodLabel`, `bpAvg`, `bpHigh`, `bpLow`, `bpClass`, `pulseAvg`, `pulseHigh`, `pulseLow`, `pulseClass`, `fastingAvg`, `fastingClass`, `preMealAvg`, `preMealClass`, `postMealAvg`, `postMealClass`, `bedtimeAvg`, `bedtimeClass`, `randomAvg`, `randomClass`, `totalReadings`, `overallScore` |
| 49 | `MONTHLY_SUMMARY` | Monthly Summary | First day of month, 09:00 UTC, when enabled. | Routine | `name`, `periodLabel`, `bpAvg`, `bpHigh`, `bpLow`, `bpClass`, `pulseAvg`, `pulseHigh`, `pulseLow`, `pulseClass`, `fastingAvg`, `fastingClass`, `preMealAvg`, `preMealClass`, `postMealAvg`, `postMealClass`, `bedtimeAvg`, `bedtimeClass`, `randomAvg`, `randomClass`, `totalReadings`, `overallScore` |
| 50 | `ACCOUNT_DELETION_REQUEST` | Account Deletion Requested | User confirmed the delete-account dialog (before deletion completes). | Security-Critical | `name`, `backupChoice`, `timestamp` |
| 51 | `ACCOUNT_DELETED_CONFIRMATION` | Account Deleted Confirmation | Account deleted after user confirmed. | Security-Critical | `name`, `backupChoice`, `timestamp` |
| 52 | `LOCAL_DATA_CLEARED` | Local Data Cleared | User cleared local account data from this device. | Routine | `name`, `timestamp` |
| 53 | `JOURNAL_CLEARED` | Journal Cleared | Server cleared the journal while keeping the account. | Routine | `name`, `timestamp` |
| 54 | `DEVELOPER_NOTIFICATION` | Administrator Notification | An audited action was recorded. Administrator only. | Routine | `name`, `email`, `action`, `timestamp` |

Subject format: `My Health Journal — <Name>`

The list follows the registry’s grouped order: Authentication & Registration; Email Address Changes; Backup Codes & Recovery; Login & Devices; Security Alerts; PIN & App Lock; Profile; Readings; Backup; Export & Import; Summaries; Account Deletion; Local Data; Administrator.
