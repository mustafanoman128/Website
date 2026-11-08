"""SEO tests: robots.txt, sitemap, canonical/preview tags and structured data.
Run from the project root:  python -m unittest discover tests  (in-memory database, like test_security)
"""
import html
import json
import os
import re
import sys
import unittest
from xml.etree import ElementTree

os.environ["DATABASE_URL"] = "sqlite://"
os.environ.setdefault("SECRET_KEY", "test-only-key")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app as site  # noqa: E402

LD_RE = re.compile(r'<script type="application/ld\+json" nonce="[^"]+">(.*?)</script>', re.S)
TITLE = "Revenue < 10k </script><script>alert(1)</script>"


class SeoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with site.app.app_context():
            site.db.create_all()
            author = site.User(name="Mustafa Noman", email="seo-author@test.local", password_hash="x")
            site.db.session.add(author)
            site.db.session.flush()
            post = site.BlogPost(title=TITLE, author_id=author.id,
                                 content="First line\r\nRevenue < 10k and churn > 5%.\n" + "word " * 60)
            site.db.session.add(post)
            site.db.session.commit()
            cls.post_id = post.id

    def setUp(self):
        self.c = site.app.test_client()

    def test_robots_points_at_sitemap_without_a_cookie(self):
        r = self.c.get("/robots.txt")
        self.assertEqual(r.mimetype, "text/plain")
        self.assertIn(f"Sitemap: {site.SITE_URL}/sitemap.xml", r.get_data(as_text=True))
        self.assertNotIn("Set-Cookie", r.headers)

    def test_sitemap_lists_public_pages_and_posts_only(self):
        r = self.c.get("/sitemap.xml")
        self.assertEqual(r.mimetype, "application/xml")
        ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        locs = [e.text for e in ElementTree.fromstring(r.data).findall("s:url/s:loc", ns)]
        self.assertIn(site.SITE_URL + "/", locs)
        self.assertIn(f"{site.SITE_URL}/blog/{self.post_id}", locs)
        self.assertFalse([loc for loc in locs if "/admin" in loc])

    def test_public_pages_have_canonical_and_parseable_structured_data(self):
        for path in ["/", "/about", "/services", "/projects", "/blog", "/contact", f"/blog/{self.post_id}"]:
            with self.subTest(path=path):
                page = self.c.get(path).get_data(as_text=True)
                self.assertIn(f'<link rel="canonical" href="{site.SITE_URL}{path}"', page)
                self.assertIn(f'<meta property="og:url" content="{site.SITE_URL}{path}"', page)
                self.assertNotIn("//mustafanoman.com", page)
                blocks = [json.loads(b) for b in LD_RE.findall(page)]  # raises if a value broke the JSON
                person = blocks[0]["@graph"][0]
                self.assertEqual(person["name"], "Mustafa Noman")

    def test_post_title_cannot_escape_structured_data(self):
        page = self.c.get(f"/blog/{self.post_id}").get_data(as_text=True)
        self.assertNotIn("<script>alert(1)", page)
        article = next(json.loads(b) for b in LD_RE.findall(page) if '"BlogPosting"' in b)
        self.assertEqual(article["headline"], TITLE)
        self.assertEqual(article["author"]["name"], "Mustafa Noman")

    def test_post_description_is_a_plain_one_line_excerpt(self):
        page = self.c.get(f"/blog/{self.post_id}").get_data(as_text=True)
        description = html.unescape(re.search(r'<meta name="description"\s+content="([^"]*)"', page).group(1))
        self.assertTrue(description.startswith("First line Revenue < 10k and churn > 5%."))
        self.assertLessEqual(len(description), 160)
        self.assertTrue(description.endswith("…"))


if __name__ == "__main__":
    unittest.main()
