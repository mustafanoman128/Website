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
```

**Windows dev server — always kill before restarting** (stale processes stack silently on port 5000 and serve old content):
```powershell
Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { taskkill /PID $_ /F 2>$null }
Start-Process -FilePath "venv\Scripts\python.exe" -ArgumentList "-m flask run" -WorkingDirectory (Get-Location) -WindowStyle Hidden
```

## Architecture

Single-file Flask app (`app.py`) — all models, routes, and config in one file. No blueprints.

**Database models:** `User`, `BlogPost`, `BlogImage`, `Comment`, `ContactMessage` — Flask-SQLAlchemy + Flask-Migrate. Cascading deletes: User→Comments, BlogPost→Comments/BlogImages.

**Auth:** Two separate login flows — public users via `/login`, admins via `/admin/login`. `@admin_required` checks `current_user.is_admin`, not just auth state. Admin accounts are created only via `flask seed-admin`.

**CSRF:** Token generated per-session, checked on every POST. Injected into all templates via `@app.context_processor` as `csrf_token`. New forms need `{{ csrf_token() }}` hidden input; the `admin_login` route is explicitly exempted in `csrf_protect()`.

**File uploads:** Blog images go to `static/uploads/blog_images/` (gitignored, must exist on server). Sanitized via `secure_filename()`. Max 10 MB; allowed: png, jpg, jpeg, gif, webp.

**HTML sanitization:** `sanitize_html()` strips tags via regex. Applied at save time on all user-facing text inputs (comments, contact form). Blog post content is not sanitized — admin-only.

**Frontend:** Pure CSS (~3000 lines) in `static/css/style.css`, vanilla JS in `static/js/main.js`. Primary accent is `--teal` (#00d4aa). Three-font system: Montserrat (display/headings), Roboto Slab (body), IBM Plex Mono (labels/tags/mono).

**CSS structure:** Design tokens → base/reset → components → responsive breakpoints (900px, 768px) → mobile override blocks A–Q (390px floor) → iOS/Android polish → `prefers-reduced-motion` override block at the very end. Append new mobile overrides to the labeled blocks, not inline with components.

**Scroll reveal:** `.reveal`, `.reveal-left`, `.reveal-right`, `.reveal-scale` start hidden and become visible via IntersectionObserver (`threshold: 0.08`, `rootMargin: 0px 0px -40px 0px`, 80ms sibling stagger). Above-fold elements — anything inside `.hero` or `.page-hero` — have a CSS override forcing `opacity: 1 !important` so they are never invisible on load. Do not add `.reveal` to hero elements.

**Flash messages:** Rendered server-side by Flask, positioned bottom-right (desktop) / bottom-center (mobile). Success/info auto-dismiss after 5s; danger/warning persist until manually closed.

**Blog categories:** Fixed list defined in `app.py` as `CATEGORIES = ["Data Analytics", "Data Science & AI", "Career"]`. Stored as freeform strings — no DB enum. The blog page shows a post count below the filter tabs using `posts.total` from the paginator.

**Form inputs:** `.has-value` class is toggled by JS when a field has content — targets `color: var(--teal)` via CSS for visual confirmation. Select elements additionally get `font-weight: 500`.

**CTA buttons:** `.btn--primary` and `.btn--hero` have a shimmer `::after` sweep animation (3.5s loop). Disabled via the `prefers-reduced-motion` block in CSS.

## Deployment

Hosted on PythonAnywhere. Deploy:
```bash
cd ~/Website && git pull origin main
# Then reload via the PythonAnywhere Web tab
```

No pip installs or migrations needed for frontend-only changes. `DATABASE_URL` env var switches between SQLite (default) and PostgreSQL. There are no automated tests or CI pipelines.
