# Step 2: content transfer outside the root lease (trial only)

Extends step 1 on `perf/reduce-lock-cycles-20261020`. Koofr remains the source of
truth. No production deployment, production data access, schema change, new service,
additional sockets or changes to mutation fencing/CAS/receipts.

## Read protocol

Normal owner `get` and shared note/folder content reads now:

1. Acquire the collection lease, read the catalog, validate live authorization and
   membership, copy the committed entry/epoch, then release the lease.
2. Fetch the immutable record without holding a collection lease. Verify its outer
   hash, record hash and note identity as before.
3. Acquire a short collection lease again. Recheck restoring state, live authorization,
   membership and exact epoch/version/head/hash/folder. Return content with this
   verified revision and current permission only when the snapshot still matches.

If the head changes, retry the complete read once; repeated changes return 423 BUSY
for the existing bounded GET retry path. Revocation, deletion or moving outside the
shared folder denies the response. Authorization is linearized at final validation;
this cannot retract data already delivered or prevent a later revocation after that
validation. Requests encountering an active writer can still receive 423.

Unchanged owner revision checks retain their one-snapshot path after authorization.
Folder lists, trash/search, backup, save/replay and mutation paths are unchanged.

## Tradeoff and deterministic evidence

| Shared operation | Step 1 provider calls / locks | Step 2 |
| --- | --- | --- |
| List | 3 / 1 | 3 / 1 |
| Open unchanged head | 4 / 1 | 7 / 2 |
| Fresh save | 9 / 1 | 9 / 1 |

Open adds one LOCK/catalog GET/UNLOCK sequence. The expensive immutable GET and
content verification are outside the lease. This is a concurrency tradeoff, not a
claim that single-note latency decreased. The final snapshot does not require the
whole catalog version to remain unchanged; unrelated note writes need not restart it.

Nine new deterministic tests use independent reader/writer instances and controlled
barriers, without sleeps, credentials or real provider traffic. They cover:

- a paused content transfer holds no root lease; a writer completes, then the reader
  retries and returns matching new content/revision;
- revocation during transfer and revoked unchanged-revision requests;
- folder membership changes and deletion during transfer;
- read while save is unpublished: BUSY, then only committed content after release;
- repeated concurrent edits: two attempts maximum, no mixed content/revision;
- corrupt immutable content fails closed with no leaked lease;
- epoch replacement despite identical head/version;
- permission downgrade returned from the final live authorization snapshot.

Node suite: 123/123 pass. Browser CI is required on this updated PR before release
consideration. Tests are simulations, not fresh Koofr qualification or iPad evidence.

## Remaining qualification

The simultaneous initial burst still contends on root catalog snapshots. No claim of
10 concurrent editors + 50 readers is made. Measure real-provider unlocked immutable
GET behavior, lock duration, successful latency and sustained traffic with retries on
a fresh synthetic root before any production release. Production is unchanged.
