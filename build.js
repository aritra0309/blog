const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');
const crypto = require('crypto');

const POSTS_DIR = path.join(__dirname, 'posts');
const SITE_DIR = path.join(__dirname, 'site');
const DIST_DIR = path.join(__dirname, 'dist');

function shortId(slug) {
  return crypto.createHash('md5').update(slug).digest('hex').slice(0, 4);
}

function readTime(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function formatDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function loadPosts() {
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
  const posts = files.map((file) => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
    const { data, content } = matter(raw);

    if (!data.title || !data.date || !data.category) {
      throw new Error(`Post ${file} is missing required front matter (title, date, category)`);
    }

    const slug = data.slug || file.replace(/\.md$/, '');
    return {
      id: shortId(slug),
      slug,
      title: data.title,
      date: formatDate(data.date),
      category: data.category,
      tags: data.tags || [],
      excerpt: data.excerpt || '',
      readTime: readTime(content),
      bodyHtml: marked.parse(content),
      url: `posts/${slug}.html`,
    };
  });
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

function renderTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => (key in vars ? vars[key] : ''));
}

function buildRelatedHtml(post, allPosts) {
  const related = allPosts
    .filter((p) => p.slug !== post.slug && p.category === post.category)
    .slice(0, 3);
  if (related.length === 0) return '';
  const items = related
    .map((p) => `<li><a href="${p.slug}.html">${p.title}</a> <span class="meta">${p.date}</span></li>`)
    .join('\n');
  return `<section class="related"><h3>Related entries</h3><ul>${items}</ul></section>`;
}

function main() {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST_DIR, 'posts'), { recursive: true });

  const posts = loadPosts();

  const indexData = posts.map(({ bodyHtml, ...meta }) => meta);
  fs.writeFileSync(path.join(DIST_DIR, 'posts.json'), JSON.stringify(indexData, null, 2));

  fs.copyFileSync(path.join(SITE_DIR, 'styles.css'), path.join(DIST_DIR, 'styles.css'));
  fs.copyFileSync(path.join(SITE_DIR, 'app.js'), path.join(DIST_DIR, 'app.js'));
  fs.copyFileSync(path.join(SITE_DIR, 'index.html'), path.join(DIST_DIR, 'index.html'));

  const postTemplate = fs.readFileSync(path.join(SITE_DIR, 'post-template.html'), 'utf8');
  posts.forEach((post) => {
    const html = renderTemplate(postTemplate, {
      title: post.title,
      date: post.date,
      category: post.category,
      readTime: post.readTime,
      id: post.id,
      body: post.bodyHtml,
      relatedEntries: buildRelatedHtml(post, posts),
    });
    fs.writeFileSync(path.join(DIST_DIR, 'posts', `${post.slug}.html`), html);
  });

  console.log(`Built ${posts.length} post(s) into dist/`);
}

main();
