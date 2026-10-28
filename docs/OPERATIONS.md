# Notes vận hành — 28/10/2026


## Cutover revalidation — 28/10/2026

The explicit Firestore selector and Vercel OIDC implementation are present in canonical `main`, but current project Production metadata lacks the Firestore selector/WIF variables. The exact captured environment of the current primary deployment remains unavailable, so its active datastore remains **UNKNOWN**.

Latest verified Firestore backup/restore is manual PASS (32 notes, 2 folders, 11 shares, 36 receipts, no erased tombstones; fingerprint is recorded in [backup/restore evidence](BACKUP-RESTORE-VERIFIED-20261028.md)). The latest available Koofr export is the older 27/10 cutover baseline (28 notes, 2 folders, 11 shares, 24 receipts, no erased tombstones). These are different checkpoints and must not be compared by timestamp or overwritten without a current Koofr export and semantic merge. Details and filtered Gemini review: [cutover revalidation](FIRESTORE-CUTOVER-REVALIDATION-20261028.md).

A dormant GET-only Koofr export route was merged in `1cc44d882fad9ad383141258c3c41bfaa0375474`; its preview build completed READY and default-disabled probe returned 404. It has not been deployed to the primary Vercel project. No new Firestore deployment, alias switch, final Koofr snapshot, writer isolation, or legacy cleanup was performed. Primary and secondary aliases remain READY. Cron execution remains unverified.

## Current status — verified 2026-10-28