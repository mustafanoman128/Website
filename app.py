import os
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps
from urllib.parse import urlparse, urljoin
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
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["UPLOAD_FOLDER"] = os.path.join("static", "uploads", "blog_images")
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024
app.config["SESSION_COOKIE_SECURE"] = True
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)

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
login_manager.login_view = "login"
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


def is_safe_url(target):
    ref = urlparse(request.host_url)
    test = urlparse(urljoin(request.host_url, target))
    return test.scheme in ("http", "https") and ref.netloc == test.netloc


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT


def save_uploaded_images(files, post_id):
    """Save each valid uploaded file to UPLOAD_FOLDER and return a list of unsaved BlogImage instances."""
    upload_dir = app.config["UPLOAD_FOLDER"]
    os.makedirs(upload_dir, exist_ok=True)
    images = []
    for f in files:
        if f.filename and allowed_file(f.filename):
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


def sanitize_html(text):
    if not text:
        return text
    return re.sub(r"<[^>]+>", "", text)


def sanitize_header(value):
    """Strip characters that would allow SMTP header injection."""
    return (value or "").replace("\r", "").replace("\n", "").replace("\0", "")


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
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
    comments = db.relationship(
        "Comment", backref="author", lazy=True, cascade="all, delete-orphan"
    )

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
    comments = db.relationship(
        "Comment", backref="post", lazy=True, cascade="all, delete-orphan"
    )


class BlogImage(db.Model):
    __tablename__ = "blog_image"
    id = db.Column(db.Integer, primary_key=True)
    image_path = db.Column(db.String(512), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey("blog_post.id"), nullable=False)


class Comment(db.Model):
    __tablename__ = "comment"
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey("blog_post.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


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
    if "_csrf_token" not in session:
        session["_csrf_token"] = secrets.token_hex(32)
    if request.method == "POST":
        token = session.pop("_csrf_token", None)
        form_token = request.form.get("_csrf_token")
        if not token or token != form_token:
            abort(403)


@app.after_request
def set_security_headers(response):
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.context_processor
def inject_globals():
    """Inject csrf_token (plain string, not callable) and CATEGORIES list into every template context."""
    return dict(
        csrf_token=session.get("_csrf_token", ""),
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


@app.route("/blog", methods=["GET"])
def blog():
    page = request.args.get("page", 1, type=int)
    active_category = request.args.get("category", "").strip()
    if active_category not in CATEGORIES:
        active_category = ""   # treat unknown / missing as "All"

    query = BlogPost.query.order_by(BlogPost.created_at.desc())
    if active_category:
        query = query.filter(BlogPost.category == active_category)

    posts = query.paginate(page=page, per_page=6, error_out=False)
    return render_template(
        "blog.html",
        posts=posts,
        active_category=active_category,
    )


@app.route("/blog/<int:post_id>", methods=["GET", "POST"])
def blog_post(post_id):
    post = db.get_or_404(BlogPost, post_id)
    if request.method == "POST":
        if not current_user.is_authenticated:
            flash("Please log in to comment.", "warning")
            return redirect(url_for("login", next=request.url))
        content = sanitize_html(request.form.get("content", "").strip())
        if not content:
            flash("Comment cannot be empty.", "danger")
        elif len(content) > 2000:
            flash("Comment must be under 2000 characters.", "danger")
        else:
            comment = Comment(content=content, user_id=current_user.id, post_id=post.id)
            db.session.add(comment)
            db.session.commit()
            flash("Comment added!", "success")
        return redirect(url_for("blog_post", post_id=post_id))
    comments = (
        Comment.query.filter_by(post_id=post_id).order_by(Comment.created_at).all()
    )
    return render_template("blog_post.html", post=post, comments=comments)


@app.route("/contact", methods=["GET", "POST"])
def contact():
    if request.method == "POST":
        name = sanitize_header(sanitize_html(request.form.get("name", "").strip()))
        email = sanitize_header(sanitize_html(request.form.get("email", "").strip()))
        inquiry_type = sanitize_html(request.form.get("inquiry_type", "").strip())
        message = sanitize_html(request.form.get("message", "").strip())
        if not name or not email or not message:
            flash("All fields are required.", "danger")
        elif "@" not in email:
            flash("Please enter a valid email address.", "danger")
        else:
            msg = ContactMessage(name=name, email=email, inquiry_type=inquiry_type or None, message=message)
            db.session.add(msg)
            db.session.commit()
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


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if current_user.is_authenticated:
        return redirect(url_for("home"))
    if request.method == "POST":
        name = sanitize_html(request.form.get("name", "").strip())
        email = sanitize_html(request.form.get("email", "").strip().lower())
        password = request.form.get("password", "")
        confirm = request.form.get("confirm_password", "")
        if not name or not email or not password:
            flash("All fields are required.", "danger")
        elif "@" not in email:
            flash("Invalid email.", "danger")
        elif len(password) < 8:
            flash("Password must be at least 8 characters.", "danger")
        elif password != confirm:
            flash("Passwords do not match.", "danger")
        elif User.query.filter_by(email=email).first():
            flash("Email already registered.", "danger")
        else:
            user = User(name=name, email=email)
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            login_user(user)
            flash("Account created!", "success")
            return redirect(url_for("home"))
    return render_template("signup.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("home"))
    if request.method == "POST":
        email = sanitize_html(request.form.get("email", "").strip().lower())
        password = request.form.get("password", "")
        user = User.query.filter_by(email=email).first()
        if user and user.check_password(password):
            login_user(user)
            next_page = request.args.get("next")
            if next_page and not is_safe_url(next_page):
                next_page = None
            return redirect(next_page or url_for("home"))
        flash("Invalid email or password.", "danger")
    return render_template("login.html")


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
        admin = User.query.filter_by(email=email, is_admin=True).first()

        if admin and admin.check_password(password):
            login_user(admin, remember=remember)
            flash("Admin access granted.", "success")
            return redirect(url_for("admin_dashboard"))

        flash("Invalid admin credentials.", "danger")
    return render_template("admin_login.html")


@app.route("/admin")
@login_required
@admin_required
def admin_dashboard():
    stats = {
        "users": User.query.filter_by(is_admin=False).count(),
        "posts": BlogPost.query.count(),
        "comments": Comment.query.count(),
        "messages": ContactMessage.query.count(),
    }
    recent_messages = (
        ContactMessage.query.order_by(ContactMessage.created_at.desc()).limit(5).all()
    )
    return render_template(
        "admin/dashboard.html", stats=stats, recent_messages=recent_messages
    )


@app.route("/admin/users")
@login_required
@admin_required
def admin_users():
    users = User.query.filter_by(is_admin=False).order_by(User.created_at.desc()).all()
    return render_template("admin/users.html", users=users)


@app.route("/admin/users/delete/<int:user_id>", methods=["POST"])
@login_required
@admin_required
def admin_delete_user(user_id):
    user = db.get_or_404(User, user_id)
    if user.is_admin:
        flash("Cannot delete admin accounts.", "danger")
    else:
        db.session.delete(user)
        db.session.commit()
        flash("User deleted.", "success")
    return redirect(url_for("admin_users"))


@app.route("/admin/blogs")
@login_required
@admin_required
def admin_blogs():
    posts = BlogPost.query.order_by(BlogPost.created_at.desc()).all()
    return render_template("admin/blogs.html", posts=posts)


@app.route("/admin/blogs/new", methods=["GET", "POST"])
@login_required
@admin_required
def admin_new_blog():
    if request.method == "POST":
        title = sanitize_html(request.form.get("title", "").strip())
        content = request.form.get("content", "").strip()
        category = request.form.get("category", "").strip()
        if category not in CATEGORIES:
            category = None
        if not title or not content:
            flash("Title and content required.", "danger")
        else:
            post = BlogPost(
                title=title,
                content=content,
                category=category,
                author_id=current_user.id,
            )
            db.session.add(post)
            db.session.flush()
            for img in save_uploaded_images(request.files.getlist("images"), post.id):
                db.session.add(img)
            db.session.commit()
            flash("Blog post created!", "success")
            return redirect(url_for("admin_blogs"))
    return render_template("admin/edit_blog.html", post=None)


@app.route("/admin/blogs/edit/<int:post_id>", methods=["GET", "POST"])
@login_required
@admin_required
def admin_edit_blog(post_id):
    post = db.get_or_404(BlogPost, post_id)
    if request.method == "POST":
        title = sanitize_html(request.form.get("title", "").strip())
        content = request.form.get("content", "").strip()
        if not title or not content:
            flash("Title and content required.", "danger")
            return render_template("admin/edit_blog.html", post=post)
        post.title = title
        post.content = content
        category = request.form.get("category", "").strip()
        post.category = category if category in CATEGORIES else None
        for img in save_uploaded_images(request.files.getlist("images"), post.id):
            db.session.add(img)
        db.session.commit()
        flash("Blog post updated!", "success")
        return redirect(url_for("admin_blogs"))
    return render_template("admin/edit_blog.html", post=post)


@app.route("/admin/blogs/delete/<int:post_id>", methods=["POST"])
@login_required
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
@login_required
@admin_required
def admin_delete_image(image_id):
    img = db.get_or_404(BlogImage, image_id)
    delete_image_file(img.image_path)
    db.session.delete(img)
    db.session.commit()
    flash("Image deleted.", "success")
    return redirect(request.referrer or url_for("admin_blogs"))


@app.route("/admin/comments")
@login_required
@admin_required
def admin_comments():
    comments = Comment.query.order_by(Comment.created_at.desc()).all()
    return render_template("admin/comments.html", comments=comments)


@app.route("/admin/comments/delete/<int:comment_id>", methods=["POST"])
@login_required
@admin_required
def admin_delete_comment(comment_id):
    comment = db.get_or_404(Comment, comment_id)
    db.session.delete(comment)
    db.session.commit()
    flash("Comment deleted.", "success")
    return redirect(url_for("admin_comments"))


@app.route("/admin/messages")
@login_required
@admin_required
def admin_messages():
    messages = ContactMessage.query.order_by(ContactMessage.created_at.desc()).all()
    return render_template("admin/messages.html", messages=messages)


@app.route("/admin/messages/delete/<int:message_id>", methods=["POST"])
@login_required
@admin_required
def admin_delete_message(message_id):
    msg = db.get_or_404(ContactMessage, message_id)
    db.session.delete(msg)
    db.session.commit()
    flash("Message deleted.", "success")
    return redirect(url_for("admin_messages"))


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
