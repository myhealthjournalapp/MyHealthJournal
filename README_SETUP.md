# My Health Journal — repaired source package

## September 2026 source update

The changed-file package is an overlay: replace the matching files in the original app. It includes the full contents of each changed file, plus the standalone `email-triggers.html`. Keep existing images and configuration files.

Deploy the included `firestore.rules` alongside the app for owner-only medical-record creation/deletion and removal of the account's profile, readings, medical-record metadata, activity logs, and email logs. Existing exported Drive files are retained. Firebase Auth deletion requires a recent sign-in; database and Auth deletion are separate operations, so a service failure may require a retry.

Backup intervals use the requested daily, preset, and custom-day choices. Backups run while the app is open. Client export mirroring is gated on a connected personal Drive; a backup-first destructive action waits for both Drive copies before continuing. The Worker source was not included, so its independent upload/recovery behavior and any server-side summary scheduler have not been changed or verified.

Verified locally: JavaScript syntax, DOM startup and controls with mocked services, chart filtering, shared tables and missing values, session panel state, verification artwork, schedule and preference persistence, backup-code display, legal navigation, email test dispatch, all template renderings, deletion acknowledgement gating, and standalone email-page rendering. No real email was sent and no live cloud data was changed. Visual browser verification was unavailable because the browser download failed. Check live Firebase sign-in, deployed rules, Drive copies, deletion, and inbox delivery in a test account before release.

The older setup notes below describe backend components that are absent from the supplied ZIP. Treat them as historical integration notes, not as evidence that those services are deployed or tested.

This package repairs the supplied application and adds the server components needed for app-owned Gmail delivery, Administrator Drive uploads and authenticated account recovery. **It is not a verified live deployment. Replacing only the HTML/JS files is not sufficient.**

## What changed

- Profile edit is now outside the hidden profile-view container, with a top close button. One visible, copyable Firebase UID. Orange verification badges with accessible labels.
- Profile saves, primary-email changes, password/PIN changes, OTP recovery and deletion use authenticated server operations. A failed save does not overwrite the visible local account with a false success.
- Original branding, supplied logos, journal sections and PDF report layout retained. WhatsApp links work; Settings precedes Logout. Existing medical/report content was not independently clinically reviewed.
- Unified local export routing uploads PDF bytes, CSV, full JSON, backup codes and logs to the appropriate Administrator folder. Pending failed uploads can be retried from Email delivery logs while the tab remains open.
- Full Google Drive backup uses separate Administrator and personal Drive destinations. Both must succeed for the combined success message. A valid personal OAuth token is required.
- Backup files/codes update in place, preserving the last good copy on an upload failure. PDF/CSV/change/email exports retain history. New export types create subfolders under the supplied master.
- All automated email templates, preserved and extended, with a documented trigger matrix. Gmail queue, logs and retry worker. OTP Gmail + EmailJS attempts use the same server-generated code, expiry and attempt limit.
- Realtime Firestore listeners; changed/deleted readings sync without deleting the entire cloud collection first. Account-scoped pending writes are stored locally. Legacy local readings migrate on the first updated login.
- Auto backup intervals: Daily/1 day, 3/7/14/30/60/90/180 days, or custom integer days. **Backup scheduling is browser-open only.** It catches up when the app returns; closed-browser full backup to the user's Drive requires a separate durable authorization/scheduler design.
- Optional daily reading reminders and weekly/monthly summaries run on the server at 09:00 UTC, independently of browser state.
- Clear local data, clear journal while keeping account, backup-first deletion, categorized/date-filtered activity and email logs.
- Manifest remains version 1.0.0. Service-worker cache has a repair suffix to replace old cached files; it never caches API/auth requests or deletes other apps' caches.

## Deployment prerequisites

Use a backed-up development project first. The package contains source only; there are no server secrets, real OAuth tokens, installed Node dependencies or verified deployment credentials.

1. Install Node.js 22 and Firebase CLI on your development computer. In `functions`, run `npm install`. Review and retain the generated lockfile. The supplied backend dependency ranges have not been installed/integration-tested in this session.
2. Select your existing Firebase project (`my-health-journal-application` if that remains correct). Cloud Functions/scheduler requires a billing-enabled project and appropriate Google Cloud permissions. Enable Email/Password Authentication and Firestore.
3. Enable Gmail API, Drive API, and reCAPTCHA Enterprise in the relevant Google Cloud project. Configure OAuth consent and authorized application domains. For the browser create an OAuth **Web application** client, allowing your exact HTTPS origin; put only its public client ID in `runtime-config.js`.
4. Create offline OAuth authorization for the **app mailbox/Drive owner**, `myhealthjournalapp@gmail.com`. Grant `gmail.send` and access sufficient for the six existing Administrator folders. `drive.file` alone does not automatically authorize pre-existing folders; explicitly select those through Google Picker using the same OAuth app, or use an administrator-reviewed `drive` grant for this server-owned integration. Do not publish folder access or put refresh tokens in browser files. If folders belong to another Administrator account, share them privately with the authorized server account.
5. Store a JSON secret using `firebase functions:secrets:set MHJ_GOOGLE_OAUTH`. Paste:
   ```json
   {"clientId":"SERVER_OAUTH_CLIENT_ID","clientSecret":"SERVER_OAUTH_CLIENT_SECRET","refreshToken":"OFFLINE_REFRESH_TOKEN_FOR_APP_ACCOUNT"}
   ```
   Secrets belong in Firebase Secret Manager only. The authorized Gmail account must be the From mailbox or have the configured From address as an authorized alias.
6. Store `MHJ_EMAILJS` with `firebase functions:secrets:set MHJ_EMAILJS`:
   ```json
   {"serviceId":"YOUR_SERVICE_ID","templateId":"YOUR_OTP_TEMPLATE_ID","publicKey":"YOUR_PUBLIC_KEY","privateKey":"YOUR_EMAILJS_PRIVATE_KEY_IF_REQUIRED"}
   ```
   Allow non-browser/server requests in EmailJS as required by your plan/configuration. The template must map `email`, `cc_email`, `bcc_email`, `name`, `otp` and `purpose`. Both providers are attempted for OTP. At least one successful provider allows the verification flow to continue; logs show the individual channel outcomes. Non-OTP emails use Gmail only. Never put the EmailJS private key in `runtime-config.js`.
7. Register the web app in Firebase App Check using a score-based reCAPTCHA Enterprise key, authorize the deployment domain and put its public site key in `runtime-config.js`. Anonymous OTP/registration/PIN/recovery calls deliberately reject missing App Check tokens. Use official Firebase debug tokens only for authorized development testing.
8. Copy `functions/.env.example` to `functions/.env` and set `MHJ_ALLOWED_ORIGINS` to your exact HTTPS app origin(s), comma-separated. No trailing slash. It is empty by default; requests from an unconfigured origin are refused.
9. **Before applying the new Firestore rules**, export/backup existing data, then run `node migrate-legacy.js` from `functions` under an authorized administrator identity for a read-only audit. Review the count. Run `node migrate-legacy.js --apply` when ready. This moves existing PIN hashes to server-only storage and removes plaintext passwords/PINs and deterministic old backup-code fields from profile documents. It preserves journal/profile content. Existing deterministic backup codes must be replaced via Profile → Security → Generate New Code. If the migration is skipped, old PIN accounts must sign in with their password and set a new PIN.
10. Deploy the backend and rules using `firebase deploy --only functions,firestore:rules --project YOUR_PROJECT_ID`. The backend region defaults to `us-central1`; align `runtime-config.js` if you change it. The Cloud Functions runtime identity needs permission to mint Firebase custom tokens; configure the appropriate service-account token-creator/signBlob permission if your project does not already provide it.
11. Serve the updated client from your existing HTTPS host, or use the included Firebase Hosting configuration. Publish the client and new backend together. Hosting excludes functions, tests, documents, secrets and configuration files intended only for deployment.
12. Run the live acceptance checklist below before replacing a production version.

No deployment, email sending, Drive upload, existing-account migration or account deletion was executed against your real services during this repair.

## Live acceptance checklist

- Register a test account; check Gmail and EmailJS OTP deliveries/CC/BCC, matching OTPs, expiry, failed attempts and replay rejection; confirm welcome email.
- Sign in with password and enabled PIN; verify cross-account isolation and two-device live reading create/update/delete behavior.
- Open/save/cancel profile on desktop and mobile. Change primary email after recent sign-in, reverify it, and sign in with the new address. Test recovery email change/verification independently.
- Change/reset password and PIN; old credentials must fail. Generate/download/use a backup code once; reuse must fail. Confirm emails and their navigation text.
- Download full JSON with zero readings, normal/bulk CSV and PDF. Open the resulting PDF from Drive, confirm encoding, UID and numeric registration/creation dates.
- Confirm Administrator and personal full-backup copies appear in separate folders. Disconnect/expire personal OAuth and confirm partial failure is not reported as dual success.
- Repeat data/code backup on a later day and confirm the same tagged Drive file updates. Repeat PDF/CSV/log exports and confirm history is retained.
- Configure interval/custom auto backups and verify missed-run catch-up. Confirm reminders/summaries after enabling the settings.
- Inspect successful/failed email logs, retries, export retries, profile/security/date filters and UTF-8 names.
- Clear local data for one account while another remains intact; clear journal while keeping account; verify backup-first deletion removes Auth plus Firestore journal/profile data and sends the confirmation. Previously exported Drive/local copies are retained.
- Test reload/offline/service-worker update, OAuth popup cancellation, denied Drive access, missing secrets, CORS/App Check rejection and recent-login-required errors.

## Choices and boundaries

- Filename: `MHJ_[TYPE]_[UserName]_[FirebaseUID]_[DDMMYYYY registration]-[DDMMYYYY creation].[ext]`, using UTC. Your notes used “DDMMYY” but gave an 8-digit example (`01012026`); the example is followed. Date of birth is excluded from filenames. Existing DOB in patient profile/PDF content is preserved.
- The explicit retention table controls: data/codes overwrite; PDF/CSV/change/email logs retain all. Legacy untagged files are not automatically deleted because their user ownership cannot be safely inferred from inconsistent old names.
- Full Google Drive backup copies go to both Drives. Local exports go to the Administrator Drive and the user's local device, as specified; they do not additionally force personal Drive authorization.
- Google personal access tokens are kept in memory, expire, and clear at logout/reload. No app-mailbox OAuth secrets are exposed to the client.
- New full-account recovery is server-side. Browser-only OTP verification and a local password assignment cannot reset Firebase Authentication.
- Existing biometric UI is retained, but **WebAuthn enrollment and genuine 2FA are not implemented in the supplied source**. Their three templates remain reserved, and are not falsely triggered by enabling a display toggle. See EMAIL_TRIGGERS.md.
- Recovery OTPs and backup codes provide account access, so the requested Administrator copies/CC/BCC grant sensitive access to their recipients. Keep the configured Administrator accounts and folders privately controlled.
- Failed export bytes are retained in memory for this tab; if it closes before a retry, repeat the export. Email retries are durable server jobs. A rare Gmail success followed by a server crash before recording the message ID can cause a duplicate on retry; this is not an exactly-once email-delivery guarantee.

## Verification performed here

`node --test tests/core.test.js tests/frontend.test.js tests/server.test.js`

41 automated tests passed using mocked DOM, Firebase, Gmail and Drive services. All shipped JavaScript passed syntax checks. HTML was parsed for duplicate IDs, edit-form ancestry and the single UID. Supplied logo bytes were preserved.

These are code/mocked behavior checks, not real-browser screenshots, cross-browser UI QA, Firebase Emulator tests, a dependency-installed server build, or live Google/Firebase integration verification.

## Official integration references

- [Gmail message sending](https://developers.google.com/workspace/gmail/api/guides/sending)
- [Google Drive scope and existing-file access](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Firebase HTTP functions](https://firebase.google.com/docs/functions/http-events)
- [Firebase App Check with reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
