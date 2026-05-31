# Mustafa Noman — Portfolio Website

> A full-stack personal portfolio built with Flask — dimensional dark aesthetic with electric teal-to-violet gradients, cinematic GSAP entrance animations, and everything a serious data analyst needs to make an impression.

Live at **[mustafanoman128.pythonanywhere.com](https://mustafanoman128.pythonanywhere.com)**

---

## What's Inside

### Pages
- **Home** — Hero with particle canvas, GSAP entrance sequence, word-scramble cycling headline, animated stat cards, scrolling tech stack strip, featured projects, certifications, blog teaser, and CTA
- **About** — Full biography, career timeline, skills & tools grid, education, contact links
- **Projects** — Detailed project breakdowns with outcome metrics, tech tags, GitHub and live demo links
- **Blog** — Full CMS: create, edit, delete posts with image uploads, categories, and pagination
- **Contact** — Inquiry form with email delivery via Gmail SMTP (Flask-Mail)

### System
- **User Auth** — Public signup, login, remember-me, secure password hashing (pbkdf2:sha256)
- **Comments** — Authenticated users comment on blog posts; admin moderates
- **Admin Dashboard** — Separate login at `/admin/login`, stats overview, full control over users, posts, comments, and messages
- **Email Notifications** — Contact form submissions delivered to inbox with inquiry type and message body

---

## Tech Stack

| Layer      | Technology                                          |
|------------|-----------------------------------------------------|
| Backend    | Python · Flask · SQLite                             |
| ORM        | Flask-SQLAlchemy · Flask-Migrate                    |
| Auth       | Flask-Login · Werkzeug                              |
| Email      | Flask-Mail · Gmail SMTP                             |
| Frontend   | HTML · Vanilla CSS (~3200 lines) · Vanilla JS       |
| Animation  | GSAP 3.12 · ScrollTrigger · Canvas 2D               |
| Typography | Montserrat · Roboto Slab · IBM Plex Mono            |
| Deployment | PythonAnywhere                                      |

---

## Local Setup

```bash
# 1. Clone
git clone https://github.com/mustafanoman128/Website.git
cd Website

# 2. Virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

# 3. Dependencies
pip install -r requirements.txt

# 4. Environment variables — create a .env file
SECRET_KEY=your-strong-secret-key
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=yourpassword
ADMIN_NAME=Mustafa Noman
DATABASE_URL=sqlite:///portfolio.db
MAIL_USERNAME=you@gmail.com
MAIL_PASSWORD=your-gmail-app-password

# 5. Database
flask db upgrade

# 6. Create admin account
flask seed-admin

# 7. Run
flask run
```

Visit `http://127.0.0.1:5000` — admin panel at `http://127.0.0.1:5000/admin/login`.

---

## Environment Variables

| Variable          | Description                                  |
|-------------------|----------------------------------------------|
| `SECRET_KEY`      | Flask session encryption key                 |
| `ADMIN_EMAIL`     | Admin login email                            |
| `ADMIN_PASSWORD`  | Admin login password                         |
| `ADMIN_NAME`      | Admin display name                           |
| `DATABASE_URL`    | SQLAlchemy DB URI (SQLite or PostgreSQL)      |
| `MAIL_USERNAME`   | Gmail address for outbound email             |
| `MAIL_PASSWORD`   | Gmail App Password (not your account password) |

---

## Security

- Passwords hashed with `pbkdf2:sha256` — plaintext never stored
- CSRF tokens on all POST routes
- Admin routes protected by `@admin_required` decorator — separate from public login
- User input (comments, contact forms) stripped of HTML via `sanitize_html()` before saving
- File uploads validated by extension + sanitized filenames, max 10 MB
- `.env` gitignored — secrets never committed

---

## Project Structure

```
Website/
├── app.py                  # Entire backend — models, routes, config (~550 lines)
├── requirements.txt
├── .env                    # Not committed
├── migrations/
├── templates/
│   ├── base.html
│   ├── home.html
│   ├── about.html
│   ├── projects.html
│   ├── blog.html
│   ├── blog_post.html
│   ├── contact.html
│   ├── login.html
│   ├── signup.html
│   ├── admin_login.html
│   └── admin/
│       ├── dashboard.html
│       ├── users.html
│       ├── blogs.html
│       ├── edit_blog.html
│       ├── comments.html
│       └── messages.html
└── static/
    ├── css/style.css       # Full design system — no frameworks
    ├── js/main.js
    ├── img/
    └── pdfs/
```

---

## Deployment (PythonAnywhere)

```bash
cd ~/Website
git pull origin main
# Reload via Web tab
```

For frontend-only changes (CSS, JS, templates), `git pull` + reload is all that's needed — no pip install or migrations. Run those only when `requirements.txt` or database models change.

Set all environment variables in your PythonAnywhere WSGI config before the first deploy.

---

© 2026 Mustafa Noman
