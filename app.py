import ipaddress
import os
import re
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps
from markupsafe import Markup, escape

from dotenv import load_dotenv
from flask import (
    Flask,
    render_template,
    redirect,
    url_for,
    request,
    flash,
    abort,
    session,
    g,
)
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_mail import Mail, Message
from flask_login import (
    LoginManager,
    UserMixin,
    login_user,
    logout_user,
    login_required,
    current_user,
)
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

load_dotenv()

app = Flask(__name__)

SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY missing")

app.config["SECRET_KEY"] = SECRET_KEY
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL", "sqlite:///portfolio.db"
)
app.config["UPLOAD_FOLDER"] = os.path.join("static", "uploads", "blog_images")
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024
app.config["SESSION_COOKIE_SECURE"] = True
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)
app.config["REMEMBER_COOKIE_SECURE"] = True
app.config["REMEMBER_COOKIE_SAMESITE"] = "Lax"
app.config["REMEMBER_COOKIE_DURATION"] = timedelta(days=14)

app.config["MAIL_SERVER"] = "smtp.gmail.com"
app.config["MAIL_PORT"] = 587
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME")
app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD")
app.config["MAIL_DEFAULT_SENDER"] = os.getenv("MAIL_USERNAME")

db = SQLAlchemy(app)
migrate = Migrate(app, db)
mail = Mail(app)
login_manager = LoginManager(app)
login_manager.login_view = "admin_login"
login_manager.login_message_category = "info"

ALLOWED_EXT = {"png", "jpg", "jpeg", "gif", "webp"}

# ── Blog Categories ───────────────────────────────────────────────────────────
CATEGORIES = ["Data Analytics", "Data Science & AI", "Freelance & Consulting"]


@app.template_filter("nl2br")
def nl2br_filter(value):
    """Jinja2 filter: HTML-escape value then replace newlines with <br> tags."""
    return escape(value or "").replace("\n", Markup("<br>\n"))


# Maps contact-form inquiry_type field values to human-readable labels used in the notification email.
INQUIRY_LABELS = {
    "freelance": "Freelance / Consulting",
    "collab": "Collaboration",
    "general": "General",
}

# One plain address: rejects "a@b", comma/semicolon lists, spaces and angle brackets.
EMAIL_RE = re.compile(r"[^@\s,;<>\"']+@[^@\s,;<>\"']+\.[^@\s,;<>\"'.]{2,}")

# Checked when the email matches no admin, so a wrong email costs as much time as a
# wrong password and response timing cannot reveal which address is the admin's.
DUMMY_PASSWORD_HASH = generate_password_hash(secrets.token_hex(16))

# Inline <script> tags must carry nonce="{{ csp_nonce }}"; inline on*= handlers are blocked.
CSP = (
    "default-src 'self'; "
    "script-src 'self' 'nonce-{nonce}' https://cdnjs.cloudflare.com; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com; "
    "img-src 'self' data:; "
    "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
)


def csp_nonce():
    """Per-request nonce shared by the CSP header and the inline scripts in templates."""
    if "csp_nonce" not in g:
        g.csp_nonce = secrets.token_urlsafe(16)
    return g.csp_nonce


# ── Rate limiting ─────────────────────────────────────────────────────────────
# In-memory, per worker process, reset on reload. Enough to stop scripted password
# guessing and contact-form floods on a one-admin site without a new dependency.
# Each action has a per-IP key and a site-wide key, e.g. ("login", ip) and ("login-all",).
# The site-wide caps hold even if the IP header can be spoofed, and because hits are only
# recorded below those caps, the number of keys stays small whatever an attacker sends.
_hits = {}


def client_ip():
    """Visitor address from PythonAnywhere's X-Real-IP header (remote_addr is the proxy).
    Anything that is not an IP address is ignored, so the header cannot inject text into logs."""
    try:
        return str(ipaddress.ip_address(request.headers.get("X-Real-IP", "")))
    except ValueError:
        return request.remote_addr


def too_many(key, limit, window):
    """True if `key` already has `limit` hits within the last `window` seconds."""
    now = time.monotonic()
    if len(_hits) > 10_000:  # memory cap: forget keys idle longer than the longest window (1 h)
        for k in [k for k, v in _hits.items() if now - v[-1] > 3600]:
            del _hits[k]
    recent = [t for t in _hits.get(key, []) if now - t < window]
    if recent:
        _hits[key] = recent
    else:
        _hits.pop(key, None)
    return len(recent) >= limit


def record_hit(key):
    _hits.setdefault(key, []).append(time.monotonic())


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT


def is_image(file):
    """True if the upload starts with a PNG, JPEG, GIF or WebP signature (the client's filename and type are not trusted)."""
    head = file.stream.read(12)
    file.stream.seek(0)
    return head.startswith((b"\x89PNG\r\n\x1a\n", b"\xff\xd8\xff", b"GIF87a", b"GIF89a")) or (
        head[:4] == b"RIFF" and head[8:12] == b"WEBP"
    )


def save_uploaded_images(files, post_id):
    """Save each valid uploaded file to UPLOAD_FOLDER and return a list of unsaved BlogImage instances."""
    upload_dir = os.path.join(app.root_path, app.config["UPLOAD_FOLDER"])
    os.makedirs(upload_dir, exist_ok=True)
    images = []
    for f in files:
        if f.filename and allowed_file(f.filename):
            if not is_image(f):
                app.logger.warning("Rejected upload %r: not a PNG/JPEG/GIF/WebP file", f.filename)
                flash(f"Skipped {secure_filename(f.filename)}: not a valid image file.", "warning")
                continue
            fname = f"{post_id}_{uuid.uuid4().hex}_{secure_filename(f.filename)}"
            f.save(os.path.join(upload_dir, fname))
            images.append(BlogImage(image_path=fname, post_id=post_id))
    return images


def delete_image_file(image_path):
    """Delete an image file from disk; log an error if the deletion fails."""
    full_path = os.path.join(app.root_path, app.config["UPLOAD_FOLDER"], image_path)
    try:
        os.remove(full_path)
    except FileNotFoundError:
        pass  # already gone — desired state achieved
    except OSError:
        app.logger.error(
            "Failed to delete image file %s — orphaned file may remain on disk",
            image_path,
            exc_info=True,
        )


def sanitize_header(value):
    """Strip characters that would allow SMTP header injection."""
    return value.replace("\r", "").replace("\n", "").replace("\0", "")


def admin_required(f):
    """Send anonymous visitors to the login page; refuse any logged-in user who is not an admin."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated:
            return login_manager.unauthorized()
        if not current_user.is_admin:
            abort(403)
        return f(*args, **kwargs)

    return decorated


class User(UserMixin, db.Model):
    __tablename__ = "user"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(180), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def set_password(self, p):
        self.password_hash = generate_password_hash(p)

    def check_password(self, p):
        return check_password_hash(self.password_hash, p)


class BlogPost(db.Model):
    __tablename__ = "blog_post"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    # nullable so existing posts without a category are not broken
    category = db.Column(db.String(50), nullable=True, default=None)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    author_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    author = db.relationship("User", backref="posts")
    images = db.relationship(
        "BlogImage", backref="post", lazy=True, cascade="all, delete-orphan"
    )

    @property
    def images_on_disk(self):
        """Images whose file still exists; public pages skip rows whose file was deleted from disk."""
        folder = os.path.join(app.root_path, app.config["UPLOAD_FOLDER"])
        return [img for img in self.images if os.path.isfile(os.path.join(folder, img.image_path))]


class BlogImage(db.Model):
    __tablename__ = "blog_image"
    id = db.Column(db.Integer, primary_key=True)
    image_path = db.Column(db.String(512), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey("blog_post.id"), nullable=False)


class ContactMessage(db.Model):
    __tablename__ = "contact_message"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(180), nullable=False)
    inquiry_type = db.Column(db.String(40), nullable=True)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


@app.before_request
def csrf_handler():
    """One-time CSRF token: each POST consumes it, then a fresh one is issued before the view renders."""
    if request.endpoint == "static":
        return  # static files need no session, which keeps them cookie-free and cacheable
    if request.method == "POST":
        token = session.pop("_csrf_token", "")
        form_token = request.form.get("_csrf_token", "")
        if not token or not secrets.compare_digest(token.encode(), form_token.encode()):
            abort(403)
    if "_csrf_token" not in session:
        session["_csrf_token"] = secrets.token_hex(32)


@app.url_defaults
def static_url_version(endpoint, values):
    """Add ?v=<file mtime> to static URLs so browsers can cache them for a year yet refetch after a deploy."""
    if endpoint == "static" and "filename" in values:
        try:
            values["v"] = int(os.stat(os.path.join(app.static_folder, values["filename"])).st_mtime)
        except OSError:
            pass


@app.after_request
def set_security_headers(response):
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    if response.mimetype == "text/html":
        response.headers["Content-Security-Policy"] = CSP.format(nonce=csp_nonce())
    endpoint = request.endpoint or ""
    if endpoint.startswith("admin") or endpoint == "logout":
        # Admin pages show contact-form PII: keep them out of every cache and search index.
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Robots-Tag"] = "noindex, nofollow"
    elif endpoint == "static" and "v" in request.args and response.status_code == 200:
        # Versioned URL (see static_url_version): its content never changes.
        response.cache_control.no_cache = None
        response.cache_control.public = True
        response.cache_control.max_age = 31536000
        response.cache_control.immutable = True
    return response


@app.context_processor
def inject_globals():
    """Inject csrf_token (plain string, not callable), csp_nonce and the CATEGORIES list into every template context."""
    return dict(
        csrf_token=session.get("_csrf_token", ""),
        csp_nonce=csp_nonce(),
        CATEGORIES=CATEGORIES,
    )


# ── Public Routes ────────────────────────────────────────────────────────────


@app.route("/")
def home():
    return render_template("home.html")


@app.route("/about")
def about():
    return render_template("about.html")


@app.route("/services")
def services():
    return render_template("services.html")


@app.route("/projects")
def projects():
    return render_template("projects.html")


@app.route("/blog")
def blog():
    page = min(request.args.get("page", 1, type=int), 10_000)  # huge pages overflow SQLite's INTEGER offset
    active_category = request.args.get("category", "").strip()
    if active_category not in CATEGORIES:
        active_category = ""   # treat unknown / missing as "All"

    query = BlogPost.query.order_by(BlogPost.created_at.desc())
    if active_category:
        query = query.filter(BlogPost.category == active_category)

    posts = query.paginate(page=page, per_page=6, error_out=False)
    if page > max(posts.pages, 1):  # a stale or hand-typed page past the end lands on the last page
        return redirect(url_for("blog", page=posts.pages if posts.pages > 1 else None,
                                category=active_category or None))
    return render_template(
        "blog.html",
        posts=posts,
        active_category=active_category,
    )


@app.route("/blog/<int:post_id>")
def blog_post(post_id):
    post = db.get_or_404(BlogPost, post_id)
    return render_template("blog_post.html", post=post)


@app.route("/contact", methods=["GET", "POST"])
def contact():
    if request.method == "POST":
        if request.form.get("hp_field"):
            # Honeypot: hidden from people, filled in by bots. Drop it but look successful.
            flash("Message sent! I will get back to you soon.", "success")
            return redirect(url_for("contact"))
        ip_key = ("contact", client_ip())
        # Site-wide cap also keeps Gmail notifications far below its ~500/day sending limit.
        if too_many(ip_key, 5, 60 * 60) or too_many(("contact-all",), 10, 60 * 60):
            flash("Too many messages have been sent recently. Please try again later.", "warning")
            return render_template("contact.html"), 429
        # Stored as typed ("Revenue < 10k" must survive); every template autoescapes on output.
        name = sanitize_header(request.form.get("name", "").strip())
        email = sanitize_header(request.form.get("email", "").strip())
        inquiry_type = request.form.get("inquiry_type", "").strip()
        if inquiry_type not in INQUIRY_LABELS:
            inquiry_type = None
        message = request.form.get("message", "").strip()
        if not name or not email or not message:
            flash("All fields are required.", "danger")
        elif not EMAIL_RE.fullmatch(email):
            flash("Please enter a valid email address.", "danger")
        elif len(name) > 120 or len(email) > 180 or len(message) > 5000:
            flash("Your name, email or message is longer than the form allows.", "danger")
        else:
            msg = ContactMessage(name=name, email=email, inquiry_type=inquiry_type, message=message)
            db.session.add(msg)
            db.session.commit()
            record_hit(ip_key)
            record_hit(("contact-all",))
            try:
                inquiry_label = INQUIRY_LABELS.get(inquiry_type, "Not specified")
                email_body = (
                    f"Name: {name}\n"
                    f"Email: {email}\n"
                    f"Inquiry Type: {inquiry_label}\n\n"
                    f"Message:\n{message}"
                )
                notification = Message(
                    subject=f"Portfolio Contact: {name}",
                    recipients=[os.getenv("NOTIFICATION_EMAIL", "mustafanoman128@gmail.com")],
                    body=email_body,
                    reply_to=email,
                )
                mail.send(notification)
            except Exception:
                app.logger.error("Contact form email failed (sender: %s)", email, exc_info=True)
            flash("Message sent! I will get back to you soon.", "success")
            return redirect(url_for("contact"))
    return render_template("contact.html")


# ── Auth Routes ──────────────────────────────────────────────────────────────


@app.route("/logout")
@login_required
def logout():
    logout_user()
    flash("You have been logged out.", "info")
    return redirect(url_for("home"))


# ── Admin Routes ─────────────────────────────────────────────────────────────


@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if current_user.is_authenticated and current_user.is_admin:
        return redirect(url_for("admin_dashboard"))

    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        remember = bool(request.form.get("remember"))
        # Site-wide failure cap: an attacker can use it to block new logins for a while, but a
        # correct password cannot be allowed to skip it or guessing would never be stopped.
        ip = client_ip()
        ip_key = ("login", ip)
        if too_many(ip_key, 5, 15 * 60) or too_many(("login-all",), 20, 15 * 60):
            app.logger.warning("Admin login rate-limited for %s", ip)
            flash("Too many failed attempts. Try again in 15 minutes.", "danger")
            return render_template("admin_login.html"), 429
        admin = User.query.filter_by(email=email, is_admin=True).first()

        if admin and admin.check_password(password):
            login_user(admin, remember=remember)
            app.logger.warning("Admin login from %s", ip)  # WARNING so it reaches PythonAnywhere's error log
            flash("Admin access granted.", "success")
            return redirect(url_for("admin_dashboard"))

        if not admin:
            check_password_hash(DUMMY_PASSWORD_HASH, password)
        record_hit(ip_key)
        record_hit(("login-all",))
        app.logger.warning("Failed admin login from %s", ip)
        flash("Invalid admin credentials.", "danger")
    return render_template("admin_login.html")


@app.route("/admin")
@admin_required
def admin_dashboard():
    stats = {
        "posts": BlogPost.query.count(),
        "messages": ContactMessage.query.count(),
    }
    recent_messages = (
        ContactMessage.query.order_by(ContactMessage.created_at.desc()).limit(5).all()
    )
    return render_template(
        "admin/dashboard.html", stats=stats, recent_messages=recent_messages
    )


@app.route("/admin/blogs")
@admin_required
def admin_blogs():
    posts = BlogPost.query.order_by(BlogPost.created_at.desc()).all()
    return render_template("admin/blogs.html", posts=posts)


@app.route("/admin/blogs/new", methods=["GET", "POST"], defaults={"post_id": None})
@app.route("/admin/blogs/edit/<int:post_id>", methods=["GET", "POST"])
@admin_required
def admin_edit_blog(post_id):
    """Create a post (no post_id) or edit an existing one; both use the same form."""
    post = None if post_id is None else db.get_or_404(BlogPost, post_id)
    if request.method == "POST":
        title = request.form.get("title", "").strip()
        content = request.form.get("content", "").strip()
        if not title or not content:
            flash("Title and content required.", "danger")
            return render_template("admin/edit_blog.html", post=post)
        if len(title) > 255:  # the column size; PostgreSQL would reject a longer value
            flash("Title must be 255 characters or fewer.", "danger")
            return render_template("admin/edit_blog.html", post=post)
        if post is None:
            post = BlogPost(author_id=current_user.id)
            db.session.add(post)
        post.title = title
        post.content = content
        category = request.form.get("category", "").strip()
        post.category = category if category in CATEGORIES else None
        db.session.flush()  # a new post needs its id for the image filenames
        db.session.add_all(save_uploaded_images(request.files.getlist("images"), post.id))
        db.session.commit()
        flash("Blog post created!" if post_id is None else "Blog post updated!", "success")
        return redirect(url_for("admin_blogs"))
    return render_template("admin/edit_blog.html", post=post)


@app.route("/admin/blogs/delete/<int:post_id>", methods=["POST"])
@admin_required
def admin_delete_blog(post_id):
    post = db.get_or_404(BlogPost, post_id)

    for img in post.images:
        delete_image_file(img.image_path)

    db.session.delete(post)
    db.session.commit()
    flash("Blog post and all associated images deleted.", "success")
    return redirect(url_for("admin_blogs"))


@app.route("/admin/blogs/delete-image/<int:image_id>", methods=["POST"])
@admin_required
def admin_delete_image(image_id):
    img = db.get_or_404(BlogImage, image_id)
    post_id = img.post_id
    delete_image_file(img.image_path)
    db.session.delete(img)
    db.session.commit()
    flash("Image deleted.", "success")
    return redirect(url_for("admin_edit_blog", post_id=post_id))


@app.route("/admin/messages")
@admin_required
def admin_messages():
    messages = ContactMessage.query.order_by(ContactMessage.created_at.desc()).all()
    return render_template("admin/messages.html", messages=messages)


@app.route("/admin/messages/delete/<int:message_id>", methods=["POST"])
@admin_required
def admin_delete_message(message_id):
    msg = db.get_or_404(ContactMessage, message_id)
    db.session.delete(msg)
    db.session.commit()
    flash("Message deleted.", "success")
    return redirect(url_for("admin_messages"))


# ── Error Pages ──────────────────────────────────────────────────────────────


@app.errorhandler(404)
def not_found(e):
    return render_template(
        "error.html", code=404, title="Page not found",
        message="That page doesn't exist or has moved.",
    ), 404


@app.errorhandler(500)
def server_error(e):
    return render_template(
        "error.html", code=500, title="Something went wrong",
        message="An error on my side stopped this page from loading. Please try again in a moment.",
    ), 500


# ── CLI ──────────────────────────────────────────────────────────────────────


@app.cli.command("seed-admin")
def seed_admin():
    email = os.getenv("ADMIN_EMAIL")
    password = os.getenv("ADMIN_PASSWORD")
    name = os.getenv("ADMIN_NAME", "Mustafa Noman")
    if not email or not password:
        print("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first.")
        return
    existing = User.query.filter_by(email=email).first()
    if existing:
        print(f"Admin {email} already exists.")
        return
    admin = User(name=name, email=email, is_admin=True)
    admin.set_password(password)
    db.session.add(admin)
    db.session.commit()
    print(f"Admin {email} created successfully.")


if __name__ == "__main__":
    app.run(debug=False)
