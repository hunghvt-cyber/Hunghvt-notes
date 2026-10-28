# Firestore cutover execution — 2026-10-28

## User decision

The user selected Firestore as the sole Notes source: GCP project `notes-lab-56f0f`, database `(default)`, vault `notes-production`. The user accepts Koofr-only differences and directs no merge or further cross-store analysis. This supersedes earlier merge/parity gates. Preserve every Firestore note, history, trash, share, revocation, receipt, tombstone, namespace and session/auth behavior.

Keep the verified Firestore backup/restore and private baseline from [baseline run 40649120419](https://github.com/hunghvt-cyber/web-notes/actions/runs/40649120419). No private snapshot or note body belongs in this repository.

## Read-only pre-deploy evidence

- Vercel project: `hunghvt-notes`, ID `prj_c4sEp6nB4msWTsPiGoALSuVutVTK`; no Git link is configured.
- Before this change, Production `NOTES_BACKEND` existed but was empty. No Production variables `NOTES_FIRESTORE_PRODUCTION_REVIEW`, `NOTES_FIRESTORE_PROJECT_ID`, `NOTES_FIRESTORE_VAULT_ID`, or `NOTES_FIRESTORE_WIF_CONFIG` were present. Existing Notes mode, project ID, base URL, namespace, Homepage auth mode and Code Inbox OIDC mode were present; sensitive values were not read.
- Production WIF provider `projects/989224849517/locations/global/workloadIdentityPools/vercel-notes-production/providers/notes-production` is ACTIVE. Issuer `https://oidc.vercel.com/hunghvt`, audience `https://vercel.com/hunghvt`, subject condition is exactly `owner:hunghvt:project:hunghvt-notes:environment:production`.
- Service account `notes-production-firestore@notes-lab-56f0f.iam.gserviceaccount.com` grants `roles/iam.workloadIdentityUser` only to that principal. Its data access is `roles/datastore.user` with condition `resource.name == "projects/notes-lab-56f0f/databases/(default)"`. Database metadata confirms Firestore Native in `asia-southeast1`. No IAM or billing change was made.
- Before cutover, the primary alias pointed to `dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1`; secondary alias pointed to `dpl_7rdKgAjtDKryMVMApjyQHj2ZMY9B`. Neither alias has yet been moved by this execution.

## Source and pre-deploy verification

- Canonical main base commit/tree: `f225e63005fc076d4da1e0cfaf7b4c45d2933e28` / `d97b80ca073745028dca75a24ea6b6f607e3c0cb`.
- Added a read-only health check for the explicit Firestore backend. It reads only the configured vault root document and returns backend/project/vault identifiers and whether that root exists; it never returns Notes content or writes data.
- Tested Node 24.22.1: focused Firestore/runtime tests 20/20 PASS; offline suite 191/191 PASS. Changes were committed to canonical main in commits `6c3267047b9d01d415d68efc523a69cae819f8ae`, `fd1ffcf1f0cd299e36d42d2a958bb959e97c2a82`, `2f200ca27b0022b0b5014360d353731a12cfb481`, and `9a6b37e3dad928e45183095567748baeba8be328`. No deployment or alias switch is claimed by these source commits.

## Cutover outcome

Pending. Record the exact deployment ID/URL, per-deployment config, live Firestore health response, aliases, old writer isolation, post-cutover backup/restore run, and exact namespace cleanup result here as each is verified. Do not delete the Koofr namespace until the new Firestore deployment and post-cutover restore qualification pass.
