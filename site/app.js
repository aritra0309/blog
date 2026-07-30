let allPosts = [];
let activeCategory = 'all';
let searchQuery = '';
let debounceTimer = null;

const categoryColors = ['#2B5D4C', '#C1541C', '#3C5B8C', '#8A5A2B', '#6B4E8C'];
const categoryColorMap = new Map();

function colorFor(category) {
  if (!categoryColorMap.has(category)) {
    categoryColorMap.set(category, categoryColors[categoryColorMap.size % categoryColors.length]);
  }
  return categoryColorMap.get(category);
}

function renderPills(categories) {
  const container = document.getElementById('categoryPills');
  const all = ['all', ...categories];
  container.innerHTML = all
    .map(
      (cat) => `
    <button class="pill ${cat === activeCategory ? 'active' : ''}" data-category="${cat}">
      ${cat === 'all' ? 'All' : cat}
    </button>`
    )
    .join('');

  container.querySelectorAll('.pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.category;
      renderPills(categories);
      renderEntries();
    });
  });
}

function matchesSearch(post, query) {
  if (!query) return true;
  const haystack = `${post.title} ${post.excerpt} ${post.tags.join(' ')}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function renderEntries() {
  const list = document.getElementById('entries');
  const emptyState = document.getElementById('emptyState');
  const filtered = allPosts.filter(
    (p) => (activeCategory === 'all' || p.category === activeCategory) && matchesSearch(p, searchQuery)
  );

  if (filtered.length === 0) {
    list.innerHTML = '';
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  list.innerHTML = filtered
    .map(
      (p) => `
    <li class="entry">
      <a href="${p.url}">
        <span class="dot" style="background:${colorFor(p.category)}"></span>
        <span class="id">#${p.id}</span>
        <span class="date">${p.date}</span>
        <span class="title">${p.title}</span>
        <span class="excerpt">${p.excerpt}</span>
        <span class="tag">${p.category}</span>
      </a>
    </li>`
    )
    .join('');
}

async function init() {
  const res = await fetch('posts.json');
  allPosts = await res.json();

  const categories = [...new Set(allPosts.map((p) => p.category))];
  renderPills(categories);
  renderEntries();

  document.getElementById('search').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = e.target.value;
      renderEntries();
    }, 150);
  });
}

init();
