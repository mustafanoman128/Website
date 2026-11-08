# Mustafa Noman — Portfolio Website

Personal portfolio and freelance site for a freelance analytics engineer, built with Flask. Light "Soft & Friendly" design, GSAP entrance animations, a small blog CMS and a contact form that emails inquiries.

Live at **[mustafanoman128.pythonanywhere.com](https://mustafanoman128.pythonanywhere.com)**

---

## Features

- **Pages** — Home, Services (offerings + pricing), Work (projects & certifications), About (bio, process, track record, skills), Blog, Contact
- **Blog CMS** — admin creates/edits/deletes posts with image uploads, categories and pagination
- **Contact form** — saved to the database and emailed via Gmail SMTP (Flask-Mail)
- **Admin panel** — login at `/admin/login` (admin accounts only, created via `flask seed-admin`); manage posts and contact messages

## Tech Stack

| Layer      | Technology                                        |
|------------|---------------------------------------------------|
| Backend    | Python · Flask · Flask-Login · Flask-Mail         |
| Database   | SQLite (local) / PostgreSQL via `DATABASE_URL` · Flask-SQLAlchemy · Flask-Migrate |
| Frontend   | Jinja templates · vanilla CSS · vanilla JS         |
| Animation  | GSAP 3.12 core (CDN), first-visit hero entrance    |
| Fonts      | Bricolage Grotesque · DM Sans · DM Mono           |
| Hosting    | PythonAnywhere                                    |

## Prerequisites

- Python 3.11+
- A Gmail account with an App Password (only needed for contact-form email)

## Setup

```bash
git clone https://github.com/mustafanoman128/Website.git
cd Website
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
```

Create a `.env` file in the project root:

| Variable             | Required | Description                                          |
|----------------------|----------|------------------------------------------------------|
| `SECRET_KEY`         | yes      | Flask session key — the app refuses to start without it |
| `DATABASE_URL`       | no       | SQLAlchemy URI; defaults to `sqlite:///portfolio.db` (stored in `instance/`) |
| `ADMIN_EMAIL`        | for seeding | Admin login email                                 |
| `ADMIN_PASSWORD`     | for seeding | Admin login password                              |
| `ADMIN_NAME`         | no       | Admin display name                                   |
| `MAIL_USERNAME`      | for email | Gmail address used to send                          |
| `MAIL_PASSWORD`      | for email | Gmail App Password                                  |
| `NOTIFICATION_EMAIL` | no       | Where contact-form notifications go                  |

Then initialise the database and admin account:

```bash
flask db upgrade
flask seed-admin
```

## Run

```bash
flask run          # http://127.0.0.1:5000 — admin at /admin/login
```

Set `FLASK_DEBUG=1` for auto-reload during development.

## Tests & Build

Security regression tests (stdlib `unittest`, in-memory DB, mail stubbed — safe to run anywhere):

```bash
python -m unittest discover tests
```

There is no linter config or build step — CSS and JS are served as-is from `static/`. Verify visual changes by running the app locally and checking the affected pages.

## Deployment (PythonAnywhere)

```bash
cd ~/Website && git pull origin main
# then Reload in the PythonAnywhere Web tab
```

Template, CSS and JS changes need only a pull + reload. Run `pip install -r requirements.txt` when dependencies change and `flask db upgrade` when models change. Environment variables are set in the PythonAnywhere WSGI config.

## Project Structure

```
Website/
├── app.py              # Entire backend: config, models, routes, CLI (no blueprints)
├── requirements.txt
├── migrations/         # Alembic migrations (Flask-Migrate)
├── tests/              # Security regression tests (unittest)
├── templates/
│   ├── base.html       # Public layout: nav, flash messages, footer
│   ├── home.html  services.html  projects.html  about.html
│   ├── blog.html  blog_post.html  contact.html
│   ├── admin_login.html
│   └── admin/          # Admin panel — extends admin/_base.html
└── static/
    ├── css/style.css   # Full design system, no framework
    ├── js/main.js
    ├── img/
    └── pdfs/           # Certification PDFs
```

## Security Notes

- Passwords hashed with Werkzeug; plaintext never stored
- One-time CSRF token required on every POST (single `before_request` hook)
- Admin routes guarded by `@admin_required`; admin login rate-limited per IP, with constant-cost checks so timing does not reveal the admin address
- Contact form: allow-listed inquiry types, single-address email check, length limits, honeypot field, per-IP rate limit; headers sanitised against SMTP injection
- Uploads restricted by extension *and* file signature (PNG/JPEG/GIF/WebP), renamed with a UUID prefix, max 10 MB
- Nonce-based Content-Security-Policy, HSTS, `Permissions-Policy`, COOP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`
- Admin responses are `Cache-Control: no-store` + `noindex`; versioned static files are cached for a year
- Third-party scripts pinned with Subresource Integrity hashes

---

© 2026 Mustafa Noman
