# Firestore Cloud Shell smoke test

This is a one-off synthetic test of the native repository. It does not create a
Google project/database, enable billing, touch Notes data, deploy the app, or
write credentials into the repository. It creates one random note and share in
an already existing Firestore database, checks read/CAS/share/revocation, then
deletes exactly those generated paths.

## Before opening Cloud Shell

Use a **dedicated non-production Google Cloud project** with an existing
Cloud Firestore Native database named `(default)`. The signed-in user needs
`roles/datastore.user`. That role grants project-level read/write; do not use a
project containing production Notes. If no isolated project/database is
available, stop. This smoke script never provisions one and never enables
billing.

On the phone/iPad:

1. Sign into [Google Cloud Console](https://console.cloud.google.com/) and use
   the project selector to choose that existing non-production project.
2. Open [Cloud Shell](https://shell.cloud.google.com/?show=terminal), accept the
   authorization dialog if shown, and confirm the shell shows the same project.
3. Paste the single command below. It clones this public branch into `/tmp`,
   installs the locked dependencies without lifecycle scripts, and runs the
   probe. It prints only the selected project, random run ID, durations,
   transaction callback attempts and estimated logical document counts. No note
   text, capability, OAuth token or credential is printed.

```sh
set -eu; WORK=/tmp/notes-firestore-cloud-smoke; ARCH="$(uname -m)"; case "$ARCH" in x86_64) NODE_ARCH=x64 ;; aarch64|arm64) NODE_ARCH=arm64 ;; *) echo "Unsupported Cloud Shell architecture: $ARCH" >&2; exit 2 ;; esac; mkdir -p "$WORK"; cd "$WORK"; curl -fsSLO "https://nodejs.org/dist/v24.22.1/node-v24.22.1-linux-${NODE_ARCH}.tar.xz"; tar -xJf "node-v24.22.1-linux-${NODE_ARCH}.tar.xz"; NODE="$WORK/node-v24.22.1-linux-${NODE_ARCH}/bin/node"; "$NODE" --version; git clone --depth 1 --single-branch --branch codex/notes-firestore-cloudshell-20261027 https://github.com/hunghvt-cyber/Hunghvt-notes.git "$WORK/repo"; cd "$WORK/repo"; "$NODE" "$WORK/node-v24.22.1-linux-${NODE_ARCH}/lib/node_modules/npm/bin/npm-cli.js" ci --ignore-scripts --no-audit --no-fund; PROJECT="$(gcloud config get-value project 2>/dev/null)"; test -n "$PROJECT"; GOOGLE_CLOUD_PROJECT="$PROJECT" GCLOUD_PROJECT="$PROJECT" "$NODE" "$WORK/node-v24.22.1-linux-${NODE_ARCH}/lib/node_modules/npm/bin/npm-cli.js" run test:firestore:cloud -- "$PROJECT"
```

The command downloads the official Node.js 24.22.1 Linux binary into `/tmp`
without changing Cloud Shell's system Node. It gets the selected project from
`gcloud config get-value project`. The runner refuses a project mismatch,
refuses emulator mode, and requires Node 24. It uses
Cloud Shell's signed-in identity through the Google client libraries; it does
not accept API keys or service-account JSON.

The output's `wallMs` are real elapsed times from that one Cloud Shell region
and test run. `transactionCallbackAttempts` counts actual SDK callback
invocations (including automatic retries). `estimatedLogicalOps` is the
expected document count for the tested one-version cases; it is not a billing
export. The smoke cannot measure NAS-to-Google network latency or Vercel
production latency.

## If the shell is interrupted

The first output line is a non-secret UUID `runId`. The normal `finally` path
removes that run's note tree, share document and note access guard. If the shell
is killed before cleanup, rerun this exact command after the same project is
selected, replacing `RUN_ID` with the UUID from the `START` line:

```sh
npm run test:firestore:cloud -- --cleanup "$GOOGLE_CLOUD_PROJECT" RUN_ID
```

Cleanup mode only addresses `notes/{RUN_ID}`, `shares/{RUN_ID_WITHOUT_DASHES}`,
and the derived note access-guard document. It does not enumerate a collection
or delete other data. Do not use cleanup mode with an ID that was not printed by
this smoke run.

## Difference from production authentication

This uses a human's short-lived Cloud Shell authorization for a one-off
measurement. It does not need NAS credentials or Vercel configuration. Running
from NAS instead requires Google Cloud CLI plus ADC or an external workload
identity. Vercel production requires a separate Workload Identity Federation
trust scoped to the Vercel project/environment and a dedicated service account;
this smoke does not configure either path.

