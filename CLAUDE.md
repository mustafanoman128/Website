# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Set up environment
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt

# Database
flask db upgrade               # Apply migrations
flask db migrate -m "message"  # Generate new migration after model changes

# Create admin account
flask seed-admin               # Uses ADMIN_EMAIL / ADMIN_PASSWORD env vars

# Run dev server
flask run                      # Uses .env for config

# Production (PythonAnywhere)
gunicorn app:app
```

Required `.env` file:
```
SECRET_KEY=your-secret-key
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=yourpassword
ADMIN_NAME=Your Name
DATABASE_URL=sqlite:///portfolio.db   # or postgresql://...
```

**Windows dev server note:** Multiple Flask processes can silently stack on port 5000 and serve stale content. Always kill before restarting:
```powershell
Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { taskkill /PID $_ /F 2>$null }
Start-Process -FilePath "venv\Scripts\python.exe" -ArgumentList "-m flask run" -WorkingDirectory (Get-Location) -WindowStyle Hidden
```

## Architecture

Single-file Flask app (`app.py`) — all models, routes, and config live in one file. No blueprints, no packages.

**Database models:** `User`, `BlogPost`, `BlogImage`, `Comment`, `ContactMessage` — managed by Flask-SQLAlchemy + Flask-Migrate. Cascading deletes wire User→Comments and BlogPost→Comments/BlogImages.

**Auth:** Two separate login flows — regular users via `/login` and admins via `/admin/login`. The `@admin_required` decorator enforces admin-only access; it checks `current_user.is_admin`, not just login state.

**CSRF protection:** A token generated per-session is checked on all POST routes. The token is injected into templates via `@app.context_processor` as `csrf_token`. New forms must include `{{ csrf_token() }}` and the route must call `validate_csrf()`.

**File uploads:** Blog images upload to `static/uploads/blog_images/` at runtime. This path is gitignored and must exist on the server. Files are sanitized via `secure_filename()`. Max size 10 MB; allowed types: png, jpg, jpeg, gif, webp.

**HTML sanitization:** User-facing text input (comments, contact messages) passes through `sanitize_html()` which strips HTML tags via regex. Applied at save time, not render time.

**Frontend:** Pure CSS (no frameworks) in `static/css/style.css` (~2950 lines). Vanilla JS in `static/js/main.js`. The design system uses CSS variables — `--teal` (#00d4aa) is the primary accent. Fonts are Montserrat (display), Roboto Slab (body), IBM Plex Mono (mono).

**CSS structure:** Base variables and resets at the top, component styles in the middle, then responsive breakpoints (mostly `max-width: 900px` and `max-width: 768px`), then a large mobile overrides block (sections A–Q) appended at the end covering every page component down to 390px. iOS/Android-specific polish (tap highlights, safe-area insets, touch-action) lives at the very end.

**Scroll reveal:** Elements with `.reveal` start at `opacity: 0` + `translateY(32px)` and get `.visible` added by an IntersectionObserver in `main.js`. Elements inside `.page-hero` override this with `opacity: 1 !important` since they're always above the fold.

**Blog categories** are a fixed set defined in templates: Python, Data Science, Crypto, Machine Learning. Stored as freeform strings in the DB — no enum constraint.

## Deployment

Hosted on PythonAnywhere. Deploy by pushing to GitHub then pulling on PythonAnywhere:
```bash
cd ~/Website && git pull origin main
```
Then reload the web app from the PythonAnywhere dashboard. `DATABASE_URL` switches between SQLite (default) and PostgreSQL — `psycopg2-binary` is installed for Postgres support.

There are no automated tests or CI pipelines in this repo.
