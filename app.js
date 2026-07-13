const SECTION_DEFS = [
  ['spurs', 'Tottenham & Premier League', [
    'Tottenham Hotspur transfer OR injury OR match site:bbc.com/sport OR site:theguardian.com/football OR site:skysports.com OR site:espn.com',
    'Tottenham Hotspur Premier League latest'
  ], 2],
  ['nba', 'Kings & NBA', ['Sacramento Kings NBA latest site:espn.com OR site:nba.com OR site:cbssports.com'], 1],
  ['mlb', 'Giants & MLB', ['San Francisco Giants MLB latest site:mlb.com OR site:espn.com OR site:sfchronicle.com'], 1],
  ['nfl', '49ers & NFL', ['San Francisco 49ers NFL latest site:espn.com OR site:nfl.com OR site:sfchronicle.com'], 1],
  ['news', 'U.S. & World', [
    'top US world news Reuters AP BBC',
    'major world news today Reuters BBC AP'
  ], 2],
  ['work', 'AI, Fraud & Fintech', ['fraud fintech AI cybersecurity latest site:techcrunch.com OR site:theverge.com OR site:reuters.com OR site:finextra.com'], 1],
  ['culture', 'Movies, Music & Pop Culture', ['movies music pop culture latest site:vulture.com OR site:variety.com OR site:rollingstone.com OR site:theguardian.com'], 1],
  ['books', 'Books & Writing', ['books literary fiction essays writing latest site:nytimes.com OR site:theguardian.com OR site:lithub.com OR site:newyorker.com'], 1],
  ['art', 'Art, Museums & Photography', ['Van Gogh Monet modern art museum exhibition photography latest site:artnews.com OR site:hyperallergic.com OR site:theartnewspaper.com OR site:moma.org'], 1],
  ['local', 'NYC · Seattle · SF · Lawrence', [
    'New York City local news today',
    'Seattle local news today',
    'San Francisco local news today',
    'Lawrence Kansas local news today'
  ], 2]
];

const BLOCKED_PHRASES = [
  'top 50 english-language news sites',
  'most popular news sites',
  'newspaper circulation',
  'media industry',
  'press gazette',
  'news website rankings'
];

const PREFERRED_SOURCES = [
  'Reuters', 'Associated Press', 'AP News', 'BBC', 'The Guardian', 'ESPN', 'NBA.com',
  'MLB.com', 'NFL.com', 'Sky Sports', 'The Athletic', 'Variety', 'Vulture',
  'Rolling Stone', 'The New Yorker', 'Literary Hub', 'ARTnews', 'Hyperallergic',
  'The Art Newspaper', 'TechCrunch', 'The Verge', 'San Francisco Chronicle'
];

const readState = JSON.parse(localStorage.getItem('fold-read') || '{}');
let totalStories = 0;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning.' : h < 18 ? 'Good afternoon.' : 'Good evening.';
}

function setTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem('fold-theme', theme);
  document.getElementById('paperBtn').classList.toggle('active', theme === 'newspaper');
  document.getElementById('dashboardBtn').classList.toggle('active', theme === 'dashboard');
}

function googleNewsRss(query) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

function rss2jsonUrl(query) {
  return `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(googleNewsRss(query))}`;
}

function cleanTitle(title = '') {
  return title.replace(/\s+-\s+[^-]+$/, '').trim();
}

function sourceFromTitle(title = '') {
  const parts = title.split(' - ');
  return parts.length > 1 ? parts.at(-1) : 'News';
}

function ageLabel(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Recent';
  const diff = Math.max(0, Date.now() - date.getTime());
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function idFor(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = ((hash << 5) - hash) + input.charCodeAt(i) | 0;
  return Math.abs(hash).toString(36);
}

function sourceScore(source = '') {
  const index = PREFERRED_SOURCES.findIndex(name => source.toLowerCase().includes(name.toLowerCase()));
  return index === -1 ? 0 : 100 - index;
}

function isBlocked(title = '') {
  const lower = title.toLowerCase();
  return BLOCKED_PHRASES.some(phrase => lower.includes(phrase));
}

async function fetchQuery(query) {
  const res = await fetch(rss2jsonUrl(query));
  if (!res.ok) throw new Error('Feed request failed');
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(data.message || 'Feed unavailable');
  return (data.items || []).map(item => ({
    id: idFor(item.link || item.guid || item.title || query),
    title: cleanTitle(item.title),
    source: sourceFromTitle(item.title),
    link: item.link,
    age: ageLabel(item.pubDate),
    date: new Date(item.pubDate || 0).getTime(),
    readMinutes: 1
  })).filter(item => item.title && !isBlocked(item.title));
}

function unique(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rank(items) {
  return [...items].sort((a, b) => {
    const sourceDiff = sourceScore(b.source) - sourceScore(a.source);
    if (sourceDiff) return sourceDiff;
    return b.date - a.date;
  });
}

function updateProgress() {
  const completed = Object.values(readState).filter(Boolean).length;
  document.getElementById('completedCount').textContent = `${Math.min(completed, totalStories)}/${totalStories}`;
  document.getElementById('finishTitle').textContent = totalStories > 0 && completed >= totalStories ? 'You’re caught up.' : 'That’s enough for now.';
}

function storyCard(story, lead = false) {
  const article = document.createElement('article');
  article.className = `story${lead ? ' lead' : ''}${readState[story.id] ? ' isRead' : ''}`;
  article.innerHTML = `
    <div class="storyMeta"><span>${escapeHtml(story.source)}</span><span>${escapeHtml(story.age)}</span></div>
    <h3><a href="${story.link}" target="_blank" rel="noreferrer">${escapeHtml(story.title)}</a></h3>
    <div class="storyFooter"><span>${story.readMinutes} min read</span><button>${readState[story.id] ? 'Unread' : 'Mark read'}</button></div>
  `;
  article.querySelector('button').addEventListener('click', () => {
    readState[story.id] = !readState[story.id];
    localStorage.setItem('fold-read', JSON.stringify(readState));
    article.classList.toggle('isRead', !!readState[story.id]);
    article.querySelector('button').textContent = readState[story.id] ? 'Unread' : 'Mark read';
    updateProgress();
  });
  return article;
}

function escapeHtml(value = '') {
  return value.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

async function loadEdition() {
  const sectionsEl = document.getElementById('sections');
  const navEl = document.getElementById('sectionNav');
  const status = document.getElementById('status');

  const results = await Promise.all(SECTION_DEFS.map(async ([key, label, queries, limit]) => {
    try {
      const groups = await Promise.all(queries.map(fetchQuery));
      return [key, label, rank(unique(groups.flat())).slice(0, limit)];
    } catch {
      return [key, label, []];
    }
  }));

  status.remove();
  let firstStoryRendered = false;
  for (const [key, label, items] of results) {
    if (!items.length) continue;
    totalStories += items.length;

    const nav = document.createElement('a');
    nav.href = `#${key}`;
    nav.textContent = label;
    navEl.appendChild(nav);

    const section = document.createElement('section');
    section.className = 'section';
    section.id = key;
    section.innerHTML = `<div class="sectionHeader"><h2>${escapeHtml(label)}</h2><span>${items.length}</span></div><div class="storyGrid"></div>`;
    const grid = section.querySelector('.storyGrid');
    items.forEach(story => {
      grid.appendChild(storyCard(story, !firstStoryRendered));
      firstStoryRendered = true;
    });
    sectionsEl.appendChild(section);
  }

  if (!totalStories) {
    sectionsEl.innerHTML = '<div class="error">Live feeds are temporarily unavailable. Refresh in a few minutes.</div>';
  }

  document.getElementById('storyCount').textContent = `${totalStories} stories`;
  document.getElementById('readMinutes').textContent = `${Math.max(8, Math.round(totalStories * 1.15))} min`;
  document.getElementById('updatedLabel').textContent = `Updated ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date())}`;
  updateProgress();
}

document.getElementById('greeting').textContent = greeting();
document.getElementById('dateLabel').textContent = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
document.getElementById('paperBtn').addEventListener('click', () => setTheme('newspaper'));
document.getElementById('dashboardBtn').addEventListener('click', () => setTheme('dashboard'));
setTheme(localStorage.getItem('fold-theme') || 'newspaper');
loadEdition();
