# `/api/auth-token` returns 500 in production

**Status:** open, deliberately deferred. Not blocking the AI/ML collection drive.
**First confirmed:** 2026-09-06, on a production deployment that was already 19 days old.
**Severity:** Firebase custom-token sign-in is completely down, so cloud sync and every
Firestore read/write a client attempts is failing. Local (AsyncStorage) use is unaffected,
which is why the app still looks like it works.

---

## Symptom

```
POST /api/auth-token  →  500
A server error has occurred
FUNCTION_INVOCATION_FAILED
```

No JSON body, no handler log line. The function dies before any of its own code runs, so
none of its validation, rate limiting or error handling is reached.

Reproduce:

```bash
curl -s -X POST https://presence-blue.vercel.app/api/auth-token \
  -H 'Content-Type: application/json' -d '{"code":"PRES-ABCDEFG"}'
```

A well-formed code returning `FUNCTION_INVOCATION_FAILED` rather than a 400/404 is the tell:
the crash is at module load, not in request handling.

---

## Root cause

`api/auth-token.js` does:

```js
const { getAuth } = require('firebase-admin/auth');
```

That import chain cannot load on Vercel:

```
firebase-admin@14.0.0
└── jwks-rsa@4.1.0        ← CJS, and declares "jose": "^6.1.3"
    └── jose@6.2.3        ← "type": "module"  (ESM only, no CJS build)
```

`jwks-rsa/src/utils.js` is CommonJS and does `require('jose')`. Requiring an ES module from
CJS was unflagged in Node 22.12, and **this Vercel project runs Node 24.x**, so on paper it
should work — and it does work locally. But Vercel's function runtime wraps module loading in
its own bytecode-caching loader, and that loader does not implement `require(esm)`:

```
Error [ERR_REQUIRE_ESM]: require() of ES Module
  /var/task/node_modules/jose/dist/webapi/index.js
  from /var/task/node_modules/jwks-rsa/src/utils.js not supported.
    at /opt/rust/nodejs.js:2:14482
    at Module.So (/opt/rust/nodejs.js:2:14860)
    at e.<computed>.ut._load (/opt/rust/nodejs.js:2:14452)
    at a (/opt/rust/bytecode.js:2:1127)
  { code: 'ERR_REQUIRE_ESM' }
Node.js process exited with exit status: 1.
```

`/opt/rust/nodejs.js` and `/opt/rust/bytecode.js` are Vercel's loader, not Node's.

**This reproduces only in production.** `node -e "require('firebase-admin/auth')"` succeeds
locally on Node 24, so nothing about local development surfaces it.

### Getting the full error

`vercel logs <url>` renders a fixed-width table and truncates the message to `Error [ERR_R…`,
which is useless. Use JSON:

```bash
vercel logs https://presence-blue.vercel.app --json 2>/dev/null \
  | python3 -c "
import sys, json
for line in sys.stdin:
    line = line.strip()
    if not line.startswith('{'): continue
    try: d = json.loads(line)
    except: continue
    m = str(d.get('message') or '')
    if 'ERR_' in m: print(m[:900])
"
```

Logs only exist for recent invocations, so hit the endpoint first, then read.

---

## Why the test suite stayed green

`api/__tests__/handlers-load.test.js` exists precisely to catch handlers that throw at load.
It did not catch this, because it mocks the module away:

```js
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }));
```

That mock is load-bearing: jest-expo's babel config cannot transform the jwks-rsa/jose chain
either, so without it every suite touching a handler fails to run. But it also makes the module
look loadable, which is exactly the property production disproves.

The mock is still there. Alongside it is a static check that greps the handler sources (with
comments stripped) for the import and asserts the set matches `KNOWN_BROKEN`:

```js
const KNOWN_BROKEN = ['auth-token.js'];
```

It is an exact-match assertion, not a floor. Adding a new handler that imports the module fails
the test — and so does fixing `auth-token.js`, at which point **delete the entry rather than
widening it**.

---

## Scope: what else is affected

| Handler | Imports `firebase-admin/auth`? | State |
|---|---|---|
| `api/auth-token.js` | yes | **broken** — this bug |
| `api/push-subscribe.js` | no, not any more | fixed 2026-09-06, commit `f9fc5e2` |
| everything else | no | fine |

`push-subscribe` was briefly broken by the same cause: the OTP-ticket security commit added
`getAuth().verifyIdToken()` to it, which took a working endpoint to
`FUNCTION_INVOCATION_FAILED`. That is now fixed and is the worked example to copy from.

**The research pipeline is unaffected.** `api/_research.js` and `api/research.js` use
`firebase-admin/firestore` via `_firebase-admin.js`, which loads fine; only the `/auth` subpath
is poisoned. Attendance data collection works with `auth-token` broken.

---

## The fix

Do the same thing `push-subscribe` now does: drop the module and use `crypto` directly.
A Firebase custom token is just an RS256 JWT signed with the service-account private key.

`getAuth().createCustomToken(uid)` produces exactly:

**Header**
```json
{ "alg": "RS256", "typ": "JWT" }
```

**Claims**
```json
{
  "iss": "<service_account.client_email>",
  "sub": "<service_account.client_email>",
  "aud": "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
  "iat": <now seconds>,
  "exp": <now + 3600>,
  "uid": "<the login code>"
}
```

**Signature** — `RSASSA-PKCS1-v1_5 / SHA-256` over `base64url(header) + "." + base64url(claims)`,
signed with `service_account.private_key`. In Node:

```js
const crypto = require('crypto');
const sig = crypto.createSign('RSA-SHA256').update(body).sign(privateKey);
```

`exp` must be at most one hour out; Google rejects longer. `uid` must be 1–128 characters —
`PRES-XXXXXXX` is fine.

Read `private_key` and `client_email` from `JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)`.
`api/_firebase-admin.js` already parses that env var, so the values are there to reuse rather
than re-parse.

### Reference implementation to copy

`api/_verify-id-token.js` is the same shape in the opposite direction (verify instead of sign),
written for this exact reason, with `api/__tests__/verify-id-token.test.js` covering every
rejection path. Mirror both.

### Prerequisites that are easy to miss

- The service account needs the **Service Account Token Creator** IAM role. Hand-signing does
  not go through the IAM signBlob API, so this may no longer be required — but the *client*
  side (`signInWithCustomToken`) still needs **Firebase Authentication enabled** on the project.
  Verify both before concluding the signing code is wrong.
- `firestore.rules` enforces `request.auth.uid == userId`. A custom token whose `uid` does not
  exactly equal the login code will authenticate and then fail every read.

---

## How to verify a fix

1. `npx jest` — remove `'auth-token.js'` from `KNOWN_BROKEN` first; the suite should stay green.
2. Deploy, then confirm the endpoint no longer crashes:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -X POST https://presence-blue.vercel.app/api/auth-token \
     -H 'Content-Type: application/json' -d '{"code":"PRES-ABCDEFG"}'
   ```
   Expect **404** (no such user) or **400** — anything that is not 500 proves the module loads.
3. Sign in on a real device and confirm a Firestore read succeeds. The token can mint fine and
   still be rejected at sign-in, so step 2 alone is not proof.
4. `vercel logs <url> --json` should show no `ERR_REQUIRE_ESM`.

---

## Do not

- **Do not "fix" it by moving the require inside the handler or a try/catch.** The failure moves
  from a crash to a caught error, so the endpoint returns a permanent 401/500 instead of
  `FUNCTION_INVOCATION_FAILED`. That looks like a fix in the logs and is not one. A dynamic
  `await import()` does not help either — the failing `require('jose')` is inside jwks-rsa's own
  CJS, and it runs whichever way the chain is entered.
- **Do not pin `engines.node`.** The project is already on Node 24. The Node version is not the
  problem; Vercel's loader is.
- **Do not downgrade `jose`.** `jwks-rsa@4.1.0` genuinely depends on `^6.1.3`; forcing an older
  jose through an override breaks jwks-rsa's own imports.
- **Do not delete the `jest.mock`** in `handlers-load.test.js` — the suite stops running entirely.
  The static check is the guard.
