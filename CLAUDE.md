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

**Auth:** Admin-only. The single login is `/admin/login` (`login_manager.login_view = "admin_login"`), which only accepts users with `is_admin=True`. `@admin_required` decorator checks `current_user.is_admin`, not just auth state. Admin accounts are created only via `flask seed-admin`.

**CSRF:** Handled entirely by a single `csrf_handler()` `before_request` hook. It generates a token into the session if absent, then on every POST it pops and validates it — no exemptions. The current token is injected into every template as the plain string `csrf_token` (via `inject_globals()` context processor). New forms need:
```html
<input type="hidden" name="_csrf_token" value="{{ csrf_token }}">
```
No parentheses — it's a string, not a callable. Because the token is popped on each POST, `csrf_handler()` immediately re-creates a fresh one for the next request.

**Helpers in app.py:**
- `save_uploaded_images(files, post_id)` — validates, renames with UUID prefix, saves to `UPLOAD_FOLDER`, returns unsaved `BlogImage` instances. Call once per route; add instances to `db.session` and commit.
- `delete_image_file(image_path)` — removes file from disk; silently ignores `FileNotFoundError`; logs `OSError` with traceback.
- `sanitize_html(text)` — strips HTML tags via regex. Applied to the contact form and admin post titles. Blog post content is **not** sanitized — admin-only.
- `sanitize_header(value)` — strips `\r`, `\n`, `\0` to prevent SMTP header injection. Applied to `name` and `email` before building the contact notification email.
- `allowed_file(filename)` — checks extension against `ALLOWED_EXT = {"png", "jpg", "jpeg", "gif", "webp"}`.

**File uploads:** Blog images go to `static/uploads/blog_images/` (gitignored, must exist on server). Max 10 MB.

**Template filter:** `nl2br` is registered as a Jinja2 filter (`@app.template_filter("nl2br")`). It HTML-escapes the value then replaces `\n` with `<br>`. Used in `blog_post.html` as `{{ post.content | nl2br | safe }}`. Must remain registered — removing it crashes blog post rendering.

**Contact form email:** Submissions are always saved to DB (`ContactMessage`). A notification email is sent to `NOTIFICATION_EMAIL` (env var, defaulting to `mustafanoman128@gmail.com`; not `MAIL_USERNAME`) with `reply_to` set to the sender's address. `inquiry_type` values are mapped to labels via `INQUIRY_LABELS` dict. Mail failures are logged via `app.logger.error` with traceback but do not surface to the user — the success flash still shows.

**Blog categories:** Fixed list `CATEGORIES = ["Data Analytics", "Data Science & AI", "Freelance & Consulting"]` in `app.py`. Stored as freeform strings — no DB enum. Injected into every template via `inject_globals()`. The blog page filters by `?category=` query param with pagination (`per_page=6`); unknown values fall back to "All".

**Route map:**
- Public: `/`, `/about`, `/services`, `/projects`, `/blog`, `/blog/<post_id>`, `/contact`
- Auth: `/admin/login`, `/logout`
- Admin (all require `@admin_required`): `/admin`, `/admin/blogs`, `/admin/blogs/new`, `/admin/blogs/edit/<id>`, `/admin/blogs/delete/<id>`, `/admin/blogs/delete-image/<id>`, `/admin/messages`, `/admin/messages/delete/<id>`
- Admin templates live in `templates/admin/` and extend `admin/_base.html`, which owns the shared delete-confirmation modal script. A page opts in by rendering `#deleteModal` (with `#deleteConfirmForm`, `#modalTargetName`) and `.btn-danger[data-url][data-name]` triggers.
- Admin pages `{% include "components/navbar.html" %}` outside any block, so it renders *before* `<!DOCTYPE html>` (known issue — quirks mode).

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

Page-specific inline scripts: `blog.html` (image gallery modal), `admin/messages.html` (`toggleMsg` expand/collapse), `admin/_base.html` (shared delete modal).

**External CDN scripts** (loaded with `defer` in `base.html` before `main.js`): GSAP 3.12.5 and ScrollTrigger 3.12.5. `gsap.registerPlugin(ScrollTrigger)` is called inside `initScrollParallax()`. Lenis was evaluated and removed — native scroll is used instead.

**Flash messages:** Rendered server-side by Flask, positioned bottom-right (desktop) / bottom-center (mobile). Success/info auto-dismiss after 5s; danger/warning persist until manually closed.

**Form inputs:** `.has-value` class is toggled by JS when a field has content — targets `color: var(--teal)` via CSS. Select elements additionally get `font-weight: 500`.

**CTA buttons:** `.btn--primary` / `.btn--hero` (solid accent), `.btn--ghost` / `.btn--hero-ghost`, and `.btn--outline-teal` (not `--outline-teall`) for ghost-style accent buttons.

## Deployment

Hosted on PythonAnywhere. Deploy:
```bash
cd ~/Website && git pull origin main
# Then reload via the PythonAnywhere Web tab
```

No pip installs or migrations needed for frontend-only changes. `DATABASE_URL` env var switches between SQLite (default) and PostgreSQL. There are no automated tests or CI pipelines.
