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

# Production
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

## Architecture

Single-file Flask app (`app.py`) — all models, routes, and config live in one ~550-line file. No blueprints, no packages.

**Database models:** `User`, `BlogPost`, `BlogImage`, `Comment`, `ContactMessage` — managed by Flask-SQLAlchemy + Flask-Migrate. Cascading deletes wire User→Comments and BlogPost→Comments/BlogImages.

**Auth:** Two separate login flows — regular users via `/login` and admins via `/admin/login`. The `@admin_required` decorator enforces admin-only access; it checks `current_user.is_admin`, not just login state.

**CSRF protection:** A token generated per-session is checked on all POST routes. The token is injected into templates via `@app.context_processor` as `csrf_token`. New forms must include `{{ csrf_token() }}` and the route must call `validate_csrf()`.

**File uploads:** Blog images upload to `static/uploads/blog_images/` at runtime. This path is gitignored and must exist on the server. Files are sanitized via `secure_filename()`. Max size 10 MB; allowed types: png, jpg, jpeg, gif, webp.

**HTML sanitization:** User-facing text input (comments, contact messages) passes through `sanitize_html()` which strips HTML tags via regex. This is applied at save time, not render time.

**Frontend:** Pure CSS (no frameworks) in `static/css/style.css` (~2600 lines). Vanilla JS in `static/js/main.js`. The design system uses CSS variables — `--electric-teal` (#00d4aa) is the primary accent. Light/dark theme toggling is handled by `light.js` + `light.css`.

**Blog categories** are a fixed set defined in templates: Python, Data Science, Crypto, Machine Learning. They are stored as freeform strings in the DB — no enum constraint.

## Deployment

Hosted on PythonAnywhere (based on recent git history). The `Procfile` (`web: gunicorn app:app`) is for Heroku-compatible platforms. `DATABASE_URL` switches between SQLite (default) and PostgreSQL — `psycopg2-binary` is installed for Postgres support.

There are no automated tests or CI pipelines in this repo.
