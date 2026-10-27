# Firestore smoke from the NAS

Cloud Shell is not part of the current test path. The runner is prepared to use
the existing dedicated project `notes-lab-56f0f` and its existing `(default)`
Firestore database directly from the NAS. It requires Node 24 and a separate
Google user ADC identity with `roles/datastore.user`. The current shell has no
ADC file, so no Cloud Firestore request has yet been made.

The ARM64 Google Cloud CLI 590.0.1 is installed privately at
`/home/admin/.local/opt/notes-google-cloud-cli`. Its archive SHA-256 was checked
against Google's published Linux Arm checksum. The wrapper
`/home/admin/bin/notes-gcloud` fixes `HOME` and `CLOUDSDK_CONFIG` to
`/home/admin/.local/state/notes-gcloud-home`; it does not modify shell profiles,
service environment, or any existing Google credentials.

The single interactive authorization action is:

```sh
/home/admin/bin/notes-gcloud auth application-default login --no-launch-browser --disable-quota-project
```

Open the displayed Google URL on the phone/iPad, sign in to the intended Google
account, then enter Google's one-time code directly at the NAS terminal prompt.
Do not send the code to Codex/chat. This writes only the isolated ADC file:
`/home/admin/.local/state/notes-gcloud-home/.config/gcloud/application_default_credentials.json`.
The login command does not enable billing or set a quota project. Google may
require that the signed-in account already has project data access.

After the authorization step, Codex can run the prepared Node 24 smoke
automatically. It is fixed to project `notes-lab-56f0f` and refuses a different
selected project or an emulator endpoint. It creates two random vaults beneath
`notesVaults/` for synthetic-only testing, verifies save/open/CAS, share/revoke,
folder deletion, trash/restore/purge, and count/hash snapshot restore, then
recursively deletes those two vaults. It emits no credential, note body,
capability token, or private response. If interrupted, the non-secret run ID
supports exact-vault cleanup through the same script.

The local `npm test` fixtures are not cloud proof. Cloud latency and server-side
transaction retry behavior become verified only after the runner returns
`PASS`; no project/database provisioning or billing change is part of this test.
For the separate Vercel identity setup, see [FIRESTORE-NATIVE.md](FIRESTORE-NATIVE.md).

Official references:

- [Google Cloud CLI Linux Arm installation and checksum](https://docs.cloud.google.com/sdk/docs/install-sdk)
- [ADC local development login](https://docs.cloud.google.com/docs/authentication/set-up-adc-local-dev-environment)
- [Login with a browser on another device](https://docs.cloud.google.com/sdk/gcloud/reference/auth/application-default/login)
- [Firestore IAM roles](https://docs.cloud.google.com/firestore/docs/security/iam)
