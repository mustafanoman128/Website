"""Security regression tests. Run from the project root:  python -m unittest discover tests

Uses an in-memory database and a stubbed mailer, so it never touches the real DB or sends email.
"""
import io
import os
import re
import shutil
import sys
import tempfile
import time
import unittest

os.environ["DATABASE_URL"] = "sqlite://"
os.environ.setdefault("SECRET_KEY", "test-only-key")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app as site  # noqa: E402

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
TOKEN_RE = re.compile(r'name="_csrf_token" value="([^"]*)"')


class SecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sent = []
        site.mail.send = cls.sent.append
        cls.upload_dir = tempfile.mkdtemp()
        site.app.config["UPLOAD_FOLDER"] = cls.upload_dir
        with site.app.app_context():
            site.db.create_all()
            admin = site.User(name="Admin", email="admin@test.local", is_admin=True)
            admin.set_password("Correct-Horse-9")
            site.db.session.add(admin)
            site.db.session.commit()

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.upload_dir, ignore_errors=True)

    def setUp(self):
        site._hits.clear()
        self.c = site.app.test_client()

    def token(self, path="/contact"):
        return TOKEN_RE.search(self.c.get(path).get_data(as_text=True)).group(1)

    def login(self, password="Correct-Horse-9", **extra):
        data = {"_csrf_token": self.token("/admin/login"), "email": "admin@test.local", "password": password, **extra}
        return self.c.post("/admin/login", data=data)

    def contact(self, **fields):
        data = {"_csrf_token": self.token(), "name": "Ann", "email": "ann@example.com", "message": "Hello", **fields}
        return self.c.post("/contact", data=data)

    # ── CSRF ──────────────────────────────────────────────────────────────────
    def test_post_without_or_with_foreign_token_is_rejected(self):
        self.assertEqual(self.c.post("/contact", data={"name": "x"}).status_code, 403)
        foreign = TOKEN_RE.search(site.app.test_client().get("/contact").get_data(as_text=True)).group(1)
        self.assertEqual(self.c.post("/contact", data={"_csrf_token": foreign}).status_code, 403)

    def test_form_rerendered_after_failed_post_has_a_working_token(self):
        html = self.c.post("/admin/login", data={
            "_csrf_token": self.token("/admin/login"), "email": "admin@test.local", "password": "wrong"}).get_data(as_text=True)
        fresh = TOKEN_RE.search(html).group(1)
        self.assertTrue(fresh)
        r = self.c.post("/admin/login", data={"_csrf_token": fresh, "email": "admin@test.local", "password": "Correct-Horse-9"})
        self.assertEqual(r.status_code, 302)

    # ── Admin login ───────────────────────────────────────────────────────────
    def test_login_locks_after_five_failures(self):
        for _ in range(5):
            self.assertEqual(self.login("wrong").status_code, 200)
        self.assertEqual(self.login().status_code, 429)  # even the right password is refused while locked

    def test_rotating_ip_header_does_not_bypass_login_limit(self):
        for i in range(20):
            data = {"_csrf_token": self.token("/admin/login"), "email": "admin@test.local", "password": "wrong"}
            self.c.post("/admin/login", data=data, headers={"X-Real-IP": f"203.0.113.{i}"})
        data = {"_csrf_token": self.token("/admin/login"), "email": "admin@test.local", "password": "Correct-Horse-9"}
        self.assertEqual(self.c.post("/admin/login", data=data, headers={"X-Real-IP": "198.51.100.7"}).status_code, 429)

    def test_non_ip_header_value_is_ignored(self):
        with site.app.test_request_context(headers={"X-Real-IP": "1.2.3.4 Admin login from 9.9.9.9"},
                                           environ_base={"REMOTE_ADDR": "127.0.0.1"}):
            self.assertEqual(site.client_ip(), "127.0.0.1")
        with site.app.test_request_context(headers={"X-Real-IP": "203.0.113.5"}):
            self.assertEqual(site.client_ip(), "203.0.113.5")

    def test_memory_cap_keeps_active_counters(self):
        stale = time.monotonic() - 7200
        site._hits.update({("contact", f"10.0.{i // 256}.{i % 256}"): [stale] for i in range(10_001)})
        for _ in range(5):
            site.record_hit(("login", "198.51.100.1"))
        self.assertTrue(site.too_many(("login", "198.51.100.1"), 5, 900))  # not reset by the cap
        self.assertLess(len(site._hits), 10)                               # stale keys evicted

    def test_remember_cookie_is_secure_and_short_lived(self):
        cookie = next(h for h in self.login(remember="on").headers.getlist("Set-Cookie") if h.startswith("remember_token="))
        self.assertIn("Secure", cookie)
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Lax", cookie)

    def test_admin_pages_need_login_and_are_not_cached(self):
        r = self.c.get("/admin/messages")
        self.assertEqual(r.status_code, 302)
        self.assertIn("/admin/login", r.headers["Location"])
        self.login()
        r = self.c.get("/admin/messages")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.headers["Cache-Control"], "no-store")
        self.assertIn("noindex", r.headers["X-Robots-Tag"])

    def test_logged_in_non_admin_is_refused(self):
        with site.app.app_context():
            user = site.User(name="Visitor", email="visitor@test.local", is_admin=False)
            user.set_password("Visitor-Pass-1")
            site.db.session.add(user)
            site.db.session.commit()
            user_id = user.id
        with self.c.session_transaction() as s:  # a leftover non-admin session (they can no longer log in)
            s["_user_id"] = str(user_id)
            s["_fresh"] = True
        for path in ["/admin", "/admin/blogs", "/admin/blogs/new", "/admin/messages"]:
            with self.subTest(path=path):
                self.assertEqual(self.c.get(path).status_code, 403)

    # ── Blog posts ────────────────────────────────────────────────────────────
    def test_admin_creates_and_edits_post(self):
        self.login()
        data = {"_csrf_token": self.token("/admin/blogs/new"), "title": "<b>First</b>", "content": "Body",
                "category": "Data Analytics"}
        self.assertTrue(self.c.post("/admin/blogs/new", data=data).headers["Location"].endswith("/admin/blogs"))
        with site.app.app_context():
            post = site.BlogPost.query.filter_by(content="Body").one()
            post_id = post.id
            # stored as typed; the page escapes it on output
            self.assertEqual((post.title, post.category, post.author.email), ("<b>First</b>", "Data Analytics", "admin@test.local"))
        self.assertIn("&lt;b&gt;First&lt;/b&gt;", self.c.get(f"/blog/{post_id}").get_data(as_text=True))
        edit = f"/admin/blogs/edit/{post_id}"
        self.c.post(edit, data={"_csrf_token": self.token(edit), "title": "Second", "content": "Body 2", "category": "bogus"})
        self.c.post(edit, data={"_csrf_token": self.token(edit), "title": "", "content": "ignored"})  # rejected
        self.c.post(edit, data={"_csrf_token": self.token(edit), "title": "T" * 256, "content": "ignored"})  # too long
        with site.app.app_context():
            post = site.db.session.get(site.BlogPost, post_id)
            self.assertEqual((post.title, post.content, post.category), ("Second", "Body 2", None))
        for missing in ("/admin/blogs/edit/999999", "/admin/blogs/edit/0"):
            self.assertEqual(self.c.get(missing).status_code, 404)

    # ── Contact form ──────────────────────────────────────────────────────────
    def test_contact_rejects_bad_input(self):
        before = len(self.sent)
        self.contact(email="a@b")
        self.contact(email="me@x.com, other@evil.com")
        self.contact(message="M" * 5001)
        self.contact(name="N" * 121)
        self.assertEqual(len(self.sent), before)

    def test_contact_accepts_valid_message_and_drops_unknown_inquiry_type(self):
        self.assertEqual(self.contact(inquiry_type="<b>bogus</b>").status_code, 302)
        with site.app.app_context():
            self.assertIsNone(site.ContactMessage.query.order_by(site.ContactMessage.id.desc()).first().inquiry_type)
        self.assertEqual(self.sent[-1].reply_to, "ann@example.com")

    def test_contact_keeps_text_that_looks_like_tags(self):
        self.assertEqual(self.contact(message="Revenue < 10k and churn > 5%").status_code, 302)
        with site.app.app_context():
            latest = site.ContactMessage.query.order_by(site.ContactMessage.id.desc()).first()
            self.assertEqual(latest.message, "Revenue < 10k and churn > 5%")

    def test_honeypot_is_silently_dropped(self):
        before = len(self.sent)
        self.assertEqual(self.contact(hp_field="http://spam.example").status_code, 302)
        self.assertEqual(len(self.sent), before)

    def test_contact_rate_limit(self):
        for _ in range(5):
            self.assertEqual(self.contact().status_code, 302)
        self.assertEqual(self.contact().status_code, 429)

    def test_contact_site_wide_cap_holds_when_ip_header_rotates(self):
        def send(ip):
            data = {"_csrf_token": self.token(), "name": "Ann", "email": "ann@example.com", "message": "Hi"}
            return self.c.post("/contact", data=data, headers={"X-Real-IP": ip}).status_code
        for i in range(10):
            self.assertEqual(send(f"203.0.113.{i}"), 302)
        self.assertEqual(send("198.51.100.7"), 429)

    # ── Uploads ───────────────────────────────────────────────────────────────
    def upload(self, content, name):
        self.login()
        data = {"_csrf_token": self.token("/admin/blogs/new"), "title": "T", "content": "C",
                "images": (io.BytesIO(content), name)}
        self.c.post("/admin/blogs/new", data=data, content_type="multipart/form-data")
        return os.listdir(self.upload_dir)

    def test_upload_rejects_non_image_with_image_extension(self):
        self.assertFalse(any("evil" in f for f in self.upload(b"<html><script>alert(1)</script>", "evil.png")))

    def test_upload_accepts_real_image_and_delete_redirects_to_edit_page(self):
        self.assertTrue(any("good" in f for f in self.upload(PNG, "good.png")))
        with site.app.app_context():
            img = site.BlogImage.query.first()
            img_id, post_id = img.id, img.post_id
        r = self.c.post(f"/admin/blogs/delete-image/{img_id}", data={"_csrf_token": self.token("/admin/blogs")},
                        headers={"Referer": "https://evil.example/"})
        self.assertTrue(r.headers["Location"].endswith(f"/admin/blogs/edit/{post_id}"))

    # ── Headers, CSP and caching ──────────────────────────────────────────────
    def test_every_page_has_headers_and_csp_compatible_markup(self):
        public = ["/", "/about", "/services", "/projects", "/blog", "/contact", "/admin/login"]
        responses = [(p, self.c.get(p)) for p in public]
        self.login()
        responses += [(p, self.c.get(p)) for p in ["/admin", "/admin/blogs", "/admin/blogs/new", "/admin/messages"]]
        for path, r in responses:
            html = r.get_data(as_text=True)
            csp = r.headers.get("Content-Security-Policy", "")
            nonce = re.search(r"'nonce-([^']+)'", csp).group(1)
            with self.subTest(path=path):
                self.assertEqual(r.status_code, 200)
                self.assertIn("max-age", r.headers["Strict-Transport-Security"])
                self.assertIn("frame-ancestors", csp)
                for tag in re.findall(r"<script(?![^>]*\bsrc=)[^>]*>", html):
                    self.assertIn(f'nonce="{nonce}"', tag)
                self.assertIsNone(re.search(r"<[^>]+\son[a-z]+\s*=", html), "inline event handler is blocked by CSP")

    def test_blog_page_past_the_end_redirects_to_last_page(self):
        r = self.c.get("/blog?page=99999999999999999999")  # huge pages also overflow SQLite's INTEGER offset
        self.assertEqual(r.status_code, 302)
        self.assertEqual(self.c.get(r.headers["Location"]).status_code, 200)

    def test_versioned_static_is_cached_long_and_cookie_free(self):
        css = re.search(r'href="(/static/css/style\.css\?v=\d+)"', self.c.get("/").get_data(as_text=True)).group(1)
        with site.app.test_client().get(css) as r:
            self.assertIn("immutable", r.headers["Cache-Control"])
            self.assertFalse(any(h.startswith("session=") for h in r.headers.getlist("Set-Cookie")))
        with site.app.test_client().get("/static/css/style.css") as r:  # unversioned URL keeps revalidating
            self.assertIn("no-cache", r.headers["Cache-Control"])


if __name__ == "__main__":
    unittest.main()
