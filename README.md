# Mustafa Noman — Portfolio Website

A production-ready Flask portfolio for data analyst Mustafa Noman. Features a dark editorial design with electric teal accents, a full blog system with image uploads, user authentication, and a secure admin dashboard.

---

## Features

- **Portfolio Home** — hero section, stats, projects, certifications, blog teaser, CTA
- **About Page** — career timeline, skills, education, biography
- **Blog System** — create/edit/delete posts, multiple image uploads per post, pagination
- **Comments** — authenticated users can comment; admin can moderate
- **Contact Form** — messages stored in database, viewable in admin
- **User Auth** — signup, login, remember-me, secure password hashing
- **Admin Dashboard** — separate login, stats overview, user management, blog/comment/message management

---

## Tech Stack

| Layer    | Technology                     |
|----------|-------------------------------|
| Backend  | Python · Flask · SQLite        |
| ORM      | Flask-SQLAlchemy · Flask-Migrate |
| Auth     | Flask-Login · Werkzeug         |
| Config   | python-dotenv                  |
| Frontend | HTML · CSS · Vanilla JS        |
| Fonts    | Syne · IBM Plex Mono · Lora    |

---

## Installation Guide

### 1. Clone the repository
```bash
git clone https://github.com/mustafanoman128/Website.git
cd mustafa-portfolio
```

### 2. Create a virtual environment
```bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Create your .env file
```bash
cp .env.example .env
```
Edit `.env` with your values:
```
SECRET_KEY=your-super-secret-random-string
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=YourStrongPassword123!
ADMIN_NAME=Mustafa Noman
DATABASE_URL=sqlite:///portfolio.db
```

### 5. Initialize the database
```bash
flask db init
flask db migrate -m "initial migration"
flask db upgrade
```

### 6. Create admin account
```bash
flask seed-admin
```

### 7. Run the development server
```bash
python app.py
```

Visit `http://127.0.0.1:5000` in your browser.

### Admin Dashboard
Navigate to `/admin/login` and use the credentials from your `.env` file.

---

## Environment Variables

| Variable         | Description                          |
|------------------|--------------------------------------|
| `SECRET_KEY`     | Flask session encryption key         |
| `ADMIN_EMAIL`    | Admin login email                    |
| `ADMIN_PASSWORD` | Admin login password                 |
| `ADMIN_NAME`     | Display name for admin user          |
| `DATABASE_URL`   | SQLAlchemy database URI              |

---

## Security Best Practices

### Password Hashing
All user passwords are hashed using `werkzeug.security.generate_password_hash` with the `pbkdf2:sha256` algorithm. Plaintext passwords are never stored.

### Environment Variables
Sensitive credentials (secret key, admin password) are loaded from a `.env` file using `python-dotenv`. The `.env` file is excluded from version control via `.gitignore`. **Never commit `.env` to a public repository.**

### Admin Access
- Admin users are stored in the database with `is_admin=True`
- Admin routes are protected with a custom `@admin_required` decorator
- Admin login is on a separate URL (`/admin/login`) isolated from the public login flow

### File Upload Security
- Only allowed extensions (`png`, `jpg`, `jpeg`, `gif`, `webp`) are accepted
- Filenames are sanitized using `werkzeug.utils.secure_filename`
- Files are stored in `static/uploads/blog_images/` outside the templates directory
- Maximum upload size is set to 10 MB

### SQL Injection Prevention
All database queries use SQLAlchemy's ORM, which parameterizes queries automatically, preventing SQL injection.

### XSS Prevention
User-supplied text (comments, contact forms) is stripped of HTML tags via a `sanitize_html()` helper before being stored.

### Deployment Checklist
1. Set `DEBUG=False` in production
2. Use a strong, random `SECRET_KEY` (at least 32 characters)
3. Serve behind a reverse proxy (nginx/Apache) with HTTPS
4. Consider moving to PostgreSQL for production (`DATABASE_URL=postgresql://...`)
5. Set up regular database backups
6. Restrict `static/uploads/` from directory listing in your web server config
7. Use environment variables for all secrets (never hardcode)

---

## Project Structure

```
mustafa_portfolio/
├── app.py                  # All backend logic
├── .env                    # Environment variables (not committed)
├── .env.example            # Template for .env
├── requirements.txt
├── README.md
├── .gitignore
├── migrations/             # Flask-Migrate files
├── templates/
│   ├── base.html
│   ├── home.html
│   ├── about.html
│   ├── blog.html
│   ├── blog_post.html
│   ├── contact.html
│   ├── login.html
│   ├── signup.html
│   ├── admin_login.html
│   └── admin/
│       ├── _base.html
│       ├── dashboard.html
│       ├── users.html
│       ├── blogs.html
│       ├── edit_blog.html
│       ├── comments.html
│       └── messages.html
└── static/
    ├── css/style.css
    ├── js/main.js
    └── uploads/blog_images/
```

---

© 2026 Mustafa Noman
