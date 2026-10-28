# Production backend and backup preflight — 2026-10-28

Read-only continuation of the independent audit. No application deployment,
alias change, backend switch, backup run, or data deletion was performed.

## Production deployment and backend selector

Current alias `hunghvt-notes.vercel.app` maps to READY deployment
`dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1` in project
`prj_c4sEp6nB4msWTsPiGoALSuVutVTK`.

The Vercel deployment file tree is available. SHA-1 of the deployed artifact
matches the raw GitHub `main` file for:

- `lib/app-config.mjs`: `1c2c79e2f8b5313fcdce3af0251dad0ce1b9db64`
- `lib/firestore-runtime.mjs`: `6657e459484a2b305e515ff4b279c7f7bb46b1ee`
- `api/inbox.js`: `73603a182092129d84d03e0625a77327f2e39134`
- `vercel.json`: `728ea9e97e62c20f4d2e79ca92f96890b1280d57`
- `.env.production.example`: `1fba9e60bbee6f250f7addc96a4fb93b05eb58db`

This proves the deployed backend selector source matches current `main`;
it does not reveal the environment captured by this deployment. In that
selector, Firestore is chosen only when
`NOTES_BACKEND=firestore-native-v1`. If absent, `createApplicationStore`
constructs the Koofr `NoteStore`. The Firestore branch also requires the
Firestore project/vault/review settings and `NOTES_FIRESTORE_WIF_CONFIG`.

Project-level Production variable metadata currently lists the legacy Koofr
configuration and does not list `NOTES_BACKEND` or the Firestore selector
variables. Project-variable metadata is not the deployment's historical
environment snapshot. Vercel documents that environment changes affect new
deployments and do not change prior deployments; the cutover record reports
that deployment-specific runtime overrides selected Firestore. These facts
leave the effective environment for this exact deployment unresolved.

The Vercel deployment metadata call succeeded but returned
`source=cli`, `meta={}`, and no environment snapshot. The deployment-file
operation returned the source tree and file identifiers, not effective runtime
values. The available Vercel connector has no operation to read this deployment's
captured environment. The public `/api/app?route=health` response is
`configured=true, production=true`; source shows that route only validates
configuration and does not create a store or contact either provider.

**Backend conclusion remains UNKNOWN.** The source default makes Koofr a
credible runtime possibility, while the historical deployment override report
makes Firestore a credible possibility. Reading a Firestore document from
Cloud Shell can verify that identity's Firestore access, but does not prove the
Notes application uses Firestore.

## Exact legacy writer and dependency inventory

- The primary deployment includes `api/app.js` and the app handler. Its normal
  authenticated Notes routes write to whichever backend the selector chooses.
  Thus it may still write the legacy Koofr namespace if the effective selector
  is absent or `koofr-v1`.
- The deployed `lib/inbox.mjs` artifact is not the current `main` file. Its
  initial source declares the old repository claim
  `hunghvt-cyber/Hunghvt-notes` and ref
  `refs/heads/release/minimal-notes`. Project metadata has the Inbox enabled
  flag. This handler can write through the selected Notes backend when it
  accepts a request. The current GitHub OIDC workflow uses the canonical
  repository claims, so live Inbox success after rename is unproven and the
  deployed claim is stale.
- Alias `hunghvt-notes-hunghvt.vercel.app` remains assigned to READY deployment
  `dpl_7rdKgAjtDKryMVMApjyQHj2ZMY9B`, immutable URL
  `hunghvt-notes-de329dlyt-hunghvt.vercel.app`. Its deployment artifact
  contains the Koofr-only `lib/app-config.mjs` and Koofr storage code, with
  no Firestore runtime files. It is an exact legacy Notes writer while it
  remains reachable.
- Vercel project Production metadata identifies the legacy namespace
  `Hunghvt-Notes-Data-78cd53a3-e871-40e5-bf04-5e70ac20901e`, and
  `KOOFR_NOTES_USER` / `KOOFR_NOTES_APP_PASSWORD` variables. Values of
  credentials were not requested or read. Preserve them until every caller is
  disabled and the backup/restore gate passes.
- On branch `release/minimal-notes`, workflow
  `.github/workflows/notes-inbox.yml` sends an OIDC-authenticated inbox
  request to the production URL for changes to `.notes-inbox/request.json`.
  Workflow `.github/workflows/notes-provision.yml` can create the exact
  legacy namespace on a push whose commit message includes
  `[notes-provision]`; it uses the legacy Koofr WebDAV secrets.
- The deployed `POST /api/migration-rollback` handler is present. It is gated
  by `NOTES_MIGRATION_ROLLBACK_ENABLED=restore-firestore-to-koofr-v1`,
  Firestore selector settings, and an exact namespace/baseline confirmation.
  If enabled, it writes the current Firestore snapshot back to the legacy
  Koofr namespace. Project-level variables do not show this flag, but the
  effective deployment snapshot is unavailable; treat the route as a
  conditional writer until that is checked.
- `.github/workflows/notes-cleanup.yml` is scoped to 39 named synthetic test
  roots, not the legacy production namespace. `notes-inventory.yml` is read
  only. Preview qualification routes use synthetic namespace patterns and
  pinned Preview URLs. The Firestore backup workflow writes only the separate
  backup root `Notes-Firestore-Backups`; the restore qualification workflow
  creates and removes a run-specific Firestore test vault
  `notes-restore-<run-id>`.
- Firestore Production target remains project `notes-lab-56f0f`, database
  `(default)`, vault `notes-production`. Do not delete or purge it. Keep
  backup and restore identities separate.

No writer, namespace, project variable, credential, alias, deployment, database,
or object was changed or removed. This inventory does not establish whether
conditional writers are active at runtime.

## Google Cloud Shell read-only preflight

The exact resource names below come from the default-branch backup and restore
workflows. Paste this block into **Google Cloud Shell**. It makes only IAM
reads and one Firestore document GET using an access token impersonated as the
backup service account. The token stays in Python memory and is never printed.
Firestore response fields and Notes content are never printed.

The Firestore GET is limited to the vault root document fields `schema` and
`restoring`. A successful GET proves the backup service account can read that
document; it does not prove the Production app is using Firestore.

```python
import json
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request

PROJECT_ID = "notes-lab-56f0f"
PROJECT_NUMBER = "989224849517"
BACKUP_POOL = "notes-firestore-backup-gha"
BACKUP_PROVIDER = "github-main-backup"
RESTORE_POOL = "notes-firestore-restore-gha"
RESTORE_PROVIDER = "github-manual-restore"
BACKUP_SA = "notes-firestore-backup-gha@notes-lab-56f0f.iam.gserviceaccount.com"
RESTORE_SA = "notes-firestore-restore-gha@notes-lab-56f0f.iam.gserviceaccount.com"

def gcloud(label, args):
    p = subprocess.run(["gcloud", *args, "--format=json"], text=True,
                       capture_output=True)
    if p.returncode:
        codes = re.findall(
            r"PERMISSION_DENIED|UNAUTHENTICATED|NOT_FOUND|INVALID_ARGUMENT|"
            r"SERVICE_DISABLED|FAILED_PRECONDITION",
            p.stdout + "\n" + p.stderr)
        print(json.dumps({"step": label, "status": "BLOCKED",
                          "responseCode": codes[0] if codes else "COMMAND_FAILED"}))
        return None
    try:
        return json.loads(p.stdout)
    except Exception:
        print(json.dumps({"step": label, "status": "BLOCKED",
                          "responseCode": "INVALID_JSON"}))
        return None

project = gcloud("project", ["projects", "describe", PROJECT_ID])
if project is not None:
    print(json.dumps({"step": "project", "projectId": project.get("projectId"),
                      "projectNumber": project.get("projectNumber"),
                      "expectedProjectNumber": PROJECT_NUMBER}))

for pool, provider in ((BACKUP_POOL, BACKUP_PROVIDER),
                       (RESTORE_POOL, RESTORE_PROVIDER)):
    p = gcloud("pool:" + pool, [
        "iam", "workload-identity-pools", "describe", pool,
        "--location=global", "--project=" + PROJECT_ID])
    if p is not None:
        print(json.dumps({"step": "pool:" + pool, "name": p.get("name"),
                          "state": p.get("state")}))

    p = gcloud("provider:" + provider, [
        "iam", "workload-identity-pools", "providers", "describe", provider,
        "--workload-identity-pool=" + pool, "--location=global",
        "--project=" + PROJECT_ID])
    if p is not None:
        oidc = p.get("oidc") or {}
        print(json.dumps({
            "step": "provider:" + provider,
            "name": p.get("name"),
            "state": p.get("state"),
            "issuerUri": oidc.get("issuerUri"),
            "allowedAudiences": oidc.get("allowedAudiences"),
            "attributeMapping": p.get("attributeMapping"),
            "attributeCondition": p.get("attributeCondition")
        }))

for sa, pool in ((BACKUP_SA, BACKUP_POOL), (RESTORE_SA, RESTORE_POOL)):
    p = gcloud("service-account-impersonation:" + sa, [
        "iam", "service-accounts", "get-iam-policy", sa,
        "--project=" + PROJECT_ID])
    if p is not None:
        marker = "workloadIdentityPools/" + pool
        bindings = []
        for b in p.get("bindings", []):
            members = [m for m in b.get("members", []) if marker in m]
            if members and b.get("role") in (
                "roles/iam.workloadIdentityUser",
                "roles/iam.serviceAccountTokenCreator"
            ):
                bindings.append({"role": b.get("role"), "members": members,
                                 "condition": b.get("condition")})
        print(json.dumps({"step": "service-account-impersonation:" + sa,
                          "bindings": bindings}))

p = gcloud("project-data-iam", ["projects", "get-iam-policy", PROJECT_ID])
if p is not None:
    target = {"serviceAccount:" + BACKUP_SA, "serviceAccount:" + RESTORE_SA}
    bindings = []
    for b in p.get("bindings", []):
        members = [m for m in b.get("members", []) if m in target]
        if members:
            bindings.append({"role": b.get("role"), "members": members,
                             "condition": b.get("condition")})
    print(json.dumps({"step": "project-data-iam", "bindings": bindings}))

token_result = subprocess.run([
    "gcloud", "auth", "print-access-token",
    "--impersonate-service-account=" + BACKUP_SA
], text=True, capture_output=True)
if token_result.returncode:
    codes = re.findall(
        r"PERMISSION_DENIED|UNAUTHENTICATED|NOT_FOUND|INVALID_ARGUMENT|"
        r"SERVICE_DISABLED|FAILED_PRECONDITION",
        token_result.stdout + "\n" + token_result.stderr)
    print(json.dumps({"step": "backup-service-account-token",
                      "status": "BLOCKED",
                      "responseCode": codes[0] if codes else "IMPERSONATION_FAILED"}))
else:
    token = token_result.stdout.strip()
    query = urllib.parse.urlencode([
        ("mask.fieldPaths", "schema"),
        ("mask.fieldPaths", "restoring")
    ])
    url = (
        "https://firestore.googleapis.com/v1/projects/"
        + PROJECT_ID
        + "/databases/(default)/documents/notesVaults/notes-production?"
        + query
    )
    request = urllib.request.Request(
        url, headers={"Authorization": "Bearer " + token})
    token = None
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            doc = json.loads(response.read())
            print(json.dumps({"step": "backup-identity-firestore-read",
                              "httpStatus": response.status,
                              "rootDocumentPresent": bool(doc.get("name"))}))
    except urllib.error.HTTPError as e:
        print(json.dumps({"step": "backup-identity-firestore-read",
                          "httpStatus": e.code}))
    except Exception as e:
        print(json.dumps({"step": "backup-identity-firestore-read",
                          "responseCode": type(e).__name__}))
```

## GitHub Actions UI — verify secret, then run manually

The repository secret's **name** can be checked without opening or revealing its
value:

1. Open [Repository Actions secrets](https://github.com/hunghvt-cyber/web-notes/settings/secrets/actions)
   for `hunghvt-cyber/web-notes`.
2. In **Repository secrets**, check whether
   `NOTES_BACKUP_KOOFR_CREDENTIAL` is listed. GitHub does not reveal a saved
   secret's value. If it is listed, leave it untouched. If absent, add only
   that secret using the separate dedicated Koofr backup app password; do not
   paste it into chat or a shell command.
3. After the read-only Cloud Shell results confirm both WIF provider/SA bindings
   and the backup service account's Firestore root read, open
   [the backup workflow](https://github.com/hunghvt-cyber/web-notes/actions/workflows/firestore-backup.yml).
4. Choose **Run workflow**, select branch **main**, and in the required text
   input named `confirm` enter exactly `BACKUP_FIRESTORE`. This input is a
   string, not a dropdown choice. Click **Run workflow** once. Do not use
   **Re-run jobs** for a failed backup; capture the run URL and filtered failure
   code instead.

A successful Cloud Shell read is an IAM/data-access check only. It is not the
manual backup run, Koofr readback, restore parity, or evidence the application
uses Firestore. The scheduled workflow remains distinct from this manual run.
