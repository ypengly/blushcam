# Privacy & data handling

| Data | Where it lives | When it leaves the device |
|---|---|---|
| Camera video | Browser memory only | Never. Only a still frame you capture is kept, locally |
| Photos being edited | Browser memory | Never, unless you choose below |
| "Save in browser" projects | IndexedDB on this device | Never |
| "Save to account" photos & projects | Server storage (local disk or S3), private, owner-scoped | Only after an explicit confirmation dialog |
| AI tool input | Processed in memory, not stored or logged | Only when you tick the per-request consent box. External-provider tools additionally send it to the named third party |
| Account | Email, Argon2id hash, session hashes | – |

* **Camera**: requested only after a button press; a visible "Camera on" indicator is shown; tracks are stopped on leave/stop; no audio is ever requested; `Permissions-Policy` restricts camera to the site itself.
* **Logging**: request logs contain method, path (no query string), status, duration and a request id. Never bodies, cookies, tokens, passwords or images.
* **Retention**: sessions expire (`SESSION_TTL_HOURS`) and expired rows are purged; reset tokens expire after `PASSWORD_RESET_TTL_MINUTES` and are single-use; **unreferenced uploads older than 24 h are deleted hourly**; deleting an account deletes stored objects and all rows.
* **Third-party AI** (operator responsibility): if you set `AI_PROVIDER`, name the provider and link its retention terms in `frontend/app/privacy/page.tsx`. The UI already labels such tools "external provider" and requires consent.
* **Operators**: the bundled privacy/terms text is a template, not legal advice.
