# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```powershell
# Set up environment
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# Database
flask db upgrade               # Apply migrations
flask db migrate -m "message"  # Generate migration after model changes

# Create admin account
flask seed-admin               # Uses ADMIN_EMAIL / ADMIN_PASSWORD env vars

# Security regression tests (in-memory DB, mail stubbed — never touches real data)
python -m unittest discover tests
```

Required `.env` file:
```
SECRET_KEY=your-secret-key
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=yourpassword
ADMIN_NAME=Your Name
DATABASE_URL=sqlite:///portfolio.db
MAIL_USERNAME=you@gmail.com
MAIL_PASSWORD=your-gmail-app-password
NOTIFICATION_EMAIL=you@gmail.com   # optional — contact-form recipient
```

**Windows dev server — always kill before restarting** (stale processes stack silently on port 5000 and serve old content):
```powershell
Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { taskkill /PID $_ /F 2>$null }
$env:FLASK_DEBUG = "1"
Start-Process -FilePath "venv\Scripts\python.exe" -ArgumentList "-m flask run" -WorkingDirectory (Get-Location) -WindowStyle Hidden
```

`FLASK_DEBUG=1` enables hot-reload; omit it in production.

## Architecture

Single-file Flask app (`app.py`) — all models, routes, and config in one file. No blueprints.

**Database models:** `User`, `BlogPost`, `BlogImage`, `ContactMessage` — Flask-SQLAlchemy + Flask-Migrate. Cascading delete: BlogPost→BlogImages. The comment feature and public accounts were removed in Nov 2026 (migration `1da4b2464115` drops the `comment` table); `User` rows are now admins only, though old non-admin rows may remain in production — they cannot log in anywhere. All datetime columns use `datetime.now(timezone.utc)`; never use the deprecated `datetime.utcnow()`. Use `db.get_or_404(Model, id)` — not the deprecated `Model.query.get_or_404(id)`.

**Auth:** Admin-only. The single login is `/admin/login` (`login_manager.login_view = "admin_login"`), which only accepts users with `is_admin=True`. `@admin_required` decorator checks `current_user.is_admin`, not just auth state. Admin accounts are created only via `flask seed-admin`. Login is rate-limited (5 failures per IP *or* 20 site-wide per 15 min → 429 — the site-wide cap holds even if the IP header is spoofed, at the cost that an attacker can block new logins for a while; existing sessions are unaffected, and a correct password deliberately does not bypass the cap); an unknown email still runs a password-hash check against `DUMMY_PASSWORD_HASH` so response time can't reveal the admin address. Successful, failed and rate-limited logins are logged at WARNING (the level PythonAnywhere's error log keeps). Remember-me cookie: Secure, SameSite=Lax, 14 days.

**CSRF:** Handled entirely by a single `csrf_handler()` `before_request` hook — no exemptions except the `static` endpoint (skipped so static files never get a session cookie). On every POST it pops the session token and compares it (constant-time) with the form's; then, if the session has no token, it issues a fresh one *in the same request* — so a form re-rendered after a failed POST (e.g. wrong password) carries a valid token. The current token is injected into every template as the plain string `csrf_token` (via `inject_globals()` context processor). New forms need:
```html
<input type="hidden" name="_csrf_token" value="{{ csrf_token }}">
```
No parentheses — it's a string, not a callable.

**CSP and security headers:** `set_security_headers()` (after_request) sends HSTS (1 year, no includeSubDomains/preload), `Permissions-Policy`, COOP `same-origin`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, and on HTML responses a nonce-based `CSP` (constant in `app.py`). Rules that follow from it:
- Every inline `<script>` must be `<script nonce="{{ csp_nonce }}">` (`csp_nonce` is injected into every template).
- No inline event handlers (`onclick=` etc.) — they are blocked; bind with `addEventListener` inside a nonce'd script.
- A new external origin (script CDN, font host, iframe such as a Power BI embed → needs `frame-src`) must be added to `CSP` or it will be blocked.
- Inline `style=` attributes are allowed (`style-src 'unsafe-inline'`).
- The GSAP `<script>` tags carry SRI `integrity` hashes; changing the GSAP version requires new hashes (cdnjs publishes them).

**Rate limiting:** `too_many(key, limit, window)` / `record_hit(key)` — an in-memory dict of timestamp lists keyed by tuples, per worker process, reset on reload. Keys in use: `("login", ip)` 5/15 min, `("login-all",)` 20/15 min, `("contact", ip)` 5/hour, `("contact-all",)` 10/hour (also keeps Gmail far below its daily send limit). Hits are recorded only below the site-wide caps, so the key count stays small even with a spoofed IP header; over 10,000 keys it evicts keys idle > 1 h — never a blanket reset. Don't add attacker-chosen values (emails, usernames) as keys. `client_ip()` reads PythonAnywhere's `X-Real-IP` header but only if it parses as an IP address (falls back to `remote_addr`), so it can't inject text into logs; revisit it if the host changes.

**Caching:** `static_url_version()` (`@app.url_defaults`) appends `?v=<file mtime>` to every `url_for('static', ...)`; versioned static responses get `public, max-age=31536000, immutable`, unversioned ones keep Flask's `no-cache`. Always reference static files through `url_for` so they get versioned. Admin endpoints (and `logout`) send `Cache-Control: no-store` + `X-Robots-Tag: noindex, nofollow`.

**Helpers in app.py:**
- `save_uploaded_images(files, post_id)` — validates, renames with UUID prefix, saves to `UPLOAD_FOLDER`, returns unsaved `BlogImage` instances. Call once per route; add instances to `db.session` and commit.
- `delete_image_file(image_path)` — removes file from disk; silently ignores `FileNotFoundError`; logs `OSError` with traceback.
- `sanitize_html(text)` — strips HTML tags via regex. Applied to the contact form and admin post titles. Blog post content is **not** sanitized — admin-only.
- `sanitize_header(value)` — strips `\r`, `\n`, `\0` to prevent SMTP header injection. Applied to `name` and `email` before building the contact notification email.
- `allowed_file(filename)` — checks extension against `ALLOWED_EXT = {"png", "jpg", "jpeg", "gif", "webp"}`.
- `is_image(file)` — checks the first 12 bytes for a PNG/JPEG/GIF/WebP signature. `save_uploaded_images` skips (logs + flashes) files that fail it.
- `client_ip()`, `too_many()`, `record_hit()`, `csp_nonce()` — see Rate limiting and CSP below/above.

**File uploads:** Blog images go to `static/uploads/blog_images/` (gitignored; created on first upload). Extension allow-list + file-signature check. Max 10 MB per request.

**Template filter:** `nl2br` is registered as a Jinja2 filter (`@app.template_filter("nl2br")`). It HTML-escapes the value then replaces `\n` with `<br>`. Used in `blog_post.html` as `{{ post.content | nl2br | safe }}`. Must remain registered — removing it crashes blog post rendering.

**Contact form validation:** A filled hidden honeypot field (`hp_field`) is dropped silently with the normal success flash. Otherwise: per-IP rate limit (5/hour → 429), `inquiry_type` must be a key of `INQUIRY_LABELS` (else `None`), email must match `EMAIL_RE` (one plain address), and name/email/message must fit 120/180/5000 chars (the DB column sizes; 5000 leaves headroom over the textarea's 2000 because browsers submit newlines as CRLF).

**Contact form email:** Valid submissions are always saved to DB (`ContactMessage`). A notification email is sent to `NOTIFICATION_EMAIL` (env var, defaulting to `mustafanoman128@gmail.com`; not `MAIL_USERNAME`) with `reply_to` set to the sender's address. `inquiry_type` values are mapped to labels via `INQUIRY_LABELS` dict. Mail failures are logged via `app.logger.error` with traceback but do not surface to the user — the success flash still shows.

**Blog categories:** Fixed list `CATEGORIES = ["Data Analytics", "Data Science & AI", "Freelance & Consulting"]` in `app.py`. Stored as freeform strings — no DB enum. Injected into every template via `inject_globals()`. The blog page filters by `?category=` query param with pagination (`per_page=6`); unknown values fall back to "All".

**Route map:**
- Public: `/`, `/about`, `/services`, `/projects`, `/blog`, `/blog/<post_id>`, `/contact`
- Auth: `/admin/login`, `/logout`
- Admin (all require `@admin_required`): `/admin`, `/admin/blogs`, `/admin/blogs/new`, `/admin/blogs/edit/<id>`, `/admin/blogs/delete/<id>`, `/admin/blogs/delete-image/<id>`, `/admin/messages`, `/admin/messages/delete/<id>`
- Admin templates live in `templates/admin/` and extend `admin/_base.html`, which owns the admin styles (light `--bg` background, sidebar that becomes a scrollable top strip ≤768px) and the shared delete-confirmation modal script. A page opts in by rendering `#deleteModal` (with `#deleteConfirmForm`, `#modalTargetName` and a `.btn-cancel` button) and `.btn-danger[data-url][data-name]` triggers. Never put markup outside `{% block %}` tags in a child template — Jinja renders it before the parent's `<!DOCTYPE>` and the page drops into quirks mode.

## Frontend

**CSS** (`static/css/style.css`, ~3430 lines) and **JS** (`static/js/main.js`) — both vanilla, no framework.

**Design system ("Soft & Friendly" light theme):** Core tokens in `:root` — `--bg: #f3f7f4`, `--surface`, `--ink: #0f2138`, `--body`, `--accent: #0c8f5d`, `--accent-deep`, `--accent-tint`, `--accent-bright`. A "backward-compat aliases" block maps old names onto them (`--teal` → `--accent`, `--white` → `--ink`, `--grad-primary` = accent→accent-deep, etc.); templates and admin styles still use the aliases. Fonts: Bricolage Grotesque (display), DM Sans (body), DM Mono (mono); the admin panel loads Syne + IBM Plex Mono separately in `admin/_base.html`. Gradient text uses `-webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text`.

**CSS structure:** Design tokens → base/reset → components → responsive breakpoints (1100/900/768/480px) → category tabs → mobile override blocks A–T (390px floor) → iOS/Android polish → `prefers-reduced-motion` block → "UI/UX Enhancements v3.1" components (testimonials, logos strip, services, pricing) with their mobile blocks U–V at the end. Append new mobile overrides to the labeled blocks, not inline with components.

**Scroll reveal:** `.reveal` elements start hidden and become visible via IntersectionObserver (`threshold: 0.08`, `rootMargin: 0px 0px -40px 0px`, 80ms sibling stagger). Above-fold elements — anything inside `.hero` or `.page-hero` — have a CSS override forcing `opacity: 1 !important`. Do not add `.reveal` to hero elements; GSAP needs opacity control over them.

**JS function inventory** (IIFE in `main.js`, run in this order; public pages only — admin pages don't load `main.js`):
- `initLoader()` — hides `#page-loader` after 800ms, then fires `initHeroEntrance()` after the 520ms fade. Must run first. The load-event listener uses `{ once: true }` and clears a 2200ms fallback timer to prevent double-firing.
- `initHeroEntrance()` — GSAP timeline animating `.hero__left`, `.hero__right`, `.hero__avail`, `.hero__float--left/right`. Called only from inside `initLoader`'s callback, never directly.
- `initScrollProgress()` — injects a `.scroll-progress` bar and sets its width from scroll position.
- `initNav()` — adds `.scrolled` past 40px; hides the nav on scroll-down past 300px.
- `initBurger()` — mobile menu toggle (`.open` on `#navLinks`), closes on link click or Escape.
- `initReveal()` — IntersectionObserver for `.reveal`.
- `initCounters()` — counts up `.hero__float-val` numbers (keeps `$` prefix and `K/M/%/+` suffix) when scrolled into view.
- `initParallax()` — mouse-move offset on `.hero__frame`. Disabled on `pointer: coarse`.
- `initSkillsStrip()` — pauses the `.skills-strip__track` marquee on hover.
- `initFlash()`, `initForms()` — flash auto-dismiss/close; `.focused` / `.has-value` toggles on `.form-control`.
- `initSmoothScroll()` — Native anchor smooth-scroll via `window.scrollTo({ behavior: 'smooth' })`, offset by nav height.
- `initScrollParallax()` — GSAP ScrollTrigger parallax on `.hero__glow--1/2/3`. Disabled entirely on `pointer: coarse` (touch devices).
- `initScrollTop()` — Shows/hides `#scrollTop` button (`.scroll-top`) after 500px scroll; uses `throttle()`.
- `initReadingTime()` — Reads `.post-content` word count and writes estimated minutes to `#reading-time`.

Page-specific inline scripts (all carry `nonce="{{ csp_nonce }}"`): `blog.html` (image gallery modal), `admin/messages.html` (`.msg-toggle` expand/collapse), `admin/edit_blog.html` (confirm before removing an image), `admin/_base.html` (shared delete modal).

**External CDN scripts** (loaded with `defer` in `base.html` before `main.js`, pinned with SRI hashes): GSAP 3.12.5 and ScrollTrigger 3.12.5. `gsap.registerPlugin(ScrollTrigger)` is called inside `initScrollParallax()`. Lenis was evaluated and removed — native scroll is used instead.

**Flash messages:** Rendered server-side by Flask, positioned bottom-right (desktop) / bottom-center (mobile). Success/info auto-dismiss after 5s; danger/warning persist until manually closed.

**Form inputs:** `.has-value` class is toggled by JS when a field has content — targets `color: var(--teal)` via CSS. Select elements additionally get `font-weight: 500`.

**CTA buttons:** `.btn--primary` / `.btn--hero` (solid accent), `.btn--ghost` / `.btn--hero-ghost`, and `.btn--outline-teal` (not `--outline-teall`) for ghost-style accent buttons.

## Deployment

Hosted on PythonAnywhere. Deploy:
```bash
cd ~/Website && git pull origin main
# Then reload via the PythonAnywhere Web tab
```

No pip installs or migrations needed for frontend-only changes; run `pip install -r requirements.txt` when it changes (Flask 3.1 / Werkzeug 3.1 / python-dotenv 1.2.2 need Python ≥ 3.10 in the PythonAnywhere virtualenv). `DATABASE_URL` env var switches between SQLite (default) and PostgreSQL. Tests live in `tests/` (run them before deploying); there is no CI pipeline. Static files are served through Flask (no PythonAnywhere static-files mapping), which is why the security headers and cache headers above apply to them.
