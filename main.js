const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:4000/api'
  : 'https://playwise-cda1.onrender.com/api';
const GAME_LIBRARY = window.GAME_LIBRARY || [];
const LAPTOP_LIBRARY = window.LAPTOP_LIBRARY || [];

const FEATURE_IDEAS = [
  'PC Compatibility Checker',
  'Game Optimization Guides',
  'Similar Game Recommendations',
  'Game Length / Time Commitment',
  'Structured Game Rating System',
  'Bug / Stability Indicator',
  'Value Rating (Worth Buying or Wait for Sale)',
  'Player Type Recommendation'
];

const CPU_SCORES = {
  'Intel Core i5-10300H': 44,
  'Intel Core i5-11260H': 52,
  'Intel Core i5-11400H': 55,
  'Intel Core i5-1235U': 50,
  'Intel Core i5-12450H': 62,
  'Intel Core i5-12500H': 74,
  'Intel Core i5-13420H': 72,
  'Intel Core i5-13500H': 78,
  'Intel Core i7-1165G7': 48,
  'Intel Core i7-11800H': 70,
  'Intel Core i7-12650H': 84,
  'Intel Core i7-12700H': 88,
  'Intel Core i7-13620H': 92,
  'Intel Core i7-13650HX': 96,
  'Intel Core i7-13700H': 98,
  'Intel Core i9-13900HX': 118,
  'Intel Core Ultra 5 125H': 86,
  'Intel Core Ultra 7 155H': 102,
  'AMD Ryzen 5 3600': 56,
  'AMD Ryzen 5 5500U': 46,
  'AMD Ryzen 5 5600': 72,
  'AMD Ryzen 5 5600H': 58,
  'AMD Ryzen 5 6600H': 68,
  'AMD Ryzen 5 7535HS': 72,
  'AMD Ryzen 7 5700X': 84,
  'AMD Ryzen 7 5800H': 76,
  'AMD Ryzen 7 6800H': 82,
  'AMD Ryzen 7 6800HS': 80,
  'AMD Ryzen 7 7735HS': 84,
  'AMD Ryzen 7 7840HS': 96,
  'AMD Ryzen 7 8845HS': 100,
  'AMD Ryzen 9 6900HX': 94,
  'AMD Ryzen 9 7940HS': 104,
  'AMD Ryzen AI 9 HX 370': 118,
  'Apple M1': 82,
  'Apple M2': 92,
  'Apple M2 Pro': 108,
  'Apple M3': 104,
  'Apple M3 Pro': 118,
  'Apple M3 Max': 134,
  'Intel Core i3-10100F': 40,
  'Intel Core i5-10400F': 48,
  'Intel Core i5-12400F': 78,
  'Intel Core i7-1265U': 74,
  'Intel Core i7-1365U': 80
};

const GPU_SCORES = {
  'Intel UHD Graphics': 12,
  'Intel Iris Xe Graphics': 20,
  'Intel Arc Graphics': 36,
  'Apple M1 GPU': 40,
  'Apple M2 GPU': 46,
  'Apple M2 Pro GPU': 64,
  'Apple M3 GPU': 54,
  'Apple M3 Pro GPU': 74,
  'Apple M3 Max GPU': 102,
  'NVIDIA GTX 1650': 38,
  'NVIDIA RTX 2050': 44,
  'NVIDIA RTX 3050': 58,
  'NVIDIA RTX 3050 Ti': 62,
  'NVIDIA RTX 3060': 72,
  'NVIDIA RTX 4050': 78,
  'NVIDIA RTX 4060': 90,
  'NVIDIA RTX 4070': 104,
  'NVIDIA RTX 4080': 128,
  'NVIDIA RTX 4090': 145,
  'AMD RX 570': 36,
  'AMD RX 6500M': 46,
  'AMD RX 6600': 64,
  'AMD RX 6600M': 66,
  'AMD RX 6700S': 74,
  'AMD RX 7600': 86,
  'AMD Radeon 680M': 34,
  'AMD Radeon 780M': 46
};


const RAM_OPTIONS = [
  { value: '8', label: '8 GB' },
  { value: '12', label: '12 GB' },
  { value: '16', label: '16 GB' },
  { value: '18', label: '18 GB' },
  { value: '24', label: '24 GB' },
  { value: '32', label: '32 GB' },
  { value: '36', label: '36 GB' },
  { value: '64', label: '64 GB' }
];

let HARDWARE_READY = false;

function replaceObjectValues(target, source) {
  Object.keys(target).forEach((key) => delete target[key]);
  Object.entries(source).forEach(([key, value]) => {
    target[key] = value;
  });
}

async function ensureHardwareCatalog() {
  if (HARDWARE_READY) return;

  try {
    const response = await fetch(`${API_BASE}/hardware/catalog`);
    if (!response.ok) throw new Error('Failed to load hardware catalog');
    const catalog = await response.json();

    const cpuMap = Object.fromEntries((catalog.cpus || []).map((item) => [item.name || item.value || item, item.score || item.value || 0]));
    const gpuMap = Object.fromEntries((catalog.gpus || []).map((item) => [item.name || item.value || item, item.score || item.value || 0]));

    replaceObjectValues(CPU_SCORES, cpuMap);
    replaceObjectValues(GPU_SCORES, gpuMap);

    LAPTOP_LIBRARY.length = 0;
    (catalog.laptops || []).forEach((item) => LAPTOP_LIBRARY.push(item));

    if (Array.isArray(catalog.ramOptions)) {
      RAM_OPTIONS.length = 0;
      catalog.ramOptions.forEach((value) => {
        const numeric = Number(value);
        RAM_OPTIONS.push({ value: String(numeric), label: `${numeric} GB` });
      });
    }

    HARDWARE_READY = true;
  } catch (error) {
    console.warn('Using built-in hardware catalog.', error.message);
    HARDWARE_READY = true;
  }
}

function $(selector, scope = document) {
  return scope.querySelector(selector);
}

function $$(selector, scope = document) {
  return [...scope.querySelectorAll(selector)];
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


function createCustomSelect({ name, placeholder, options }) {
  const normalizedOptions = options.map((option) => {
    if (typeof option === 'string') {
      return { value: option, label: option };
    }
    return option;
  });

  return `
    <div class="custom-select" data-name="${escapeHtml(name)}">
      <input type="hidden" name="${escapeHtml(name)}" value="" />
      <button type="button" class="custom-select-trigger" aria-haspopup="listbox" aria-expanded="false">
        <span>${escapeHtml(placeholder)}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
      </button>
      <div class="custom-select-menu" role="listbox" tabindex="-1">
        ${normalizedOptions.map((option) => `
          <button
            type="button"
            class="custom-select-option"
            role="option"
            data-value="${escapeHtml(option.value)}"
          >${escapeHtml(option.label)}</button>
        `).join('')}
      </div>
    </div>
  `;
}

function getGameBySlug(slug) {
  return [...GAME_LIBRARY, ...(window.OPEN_SOURCE_GAMES || [])].find((game) => game.slug === slug);
}

function scoreToGrade(ratio) {
  if (ratio >= 1.15) return { grade: 'Excellent', pill: 'good' };
  if (ratio >= 0.95) return { grade: 'Good', pill: 'good' };
  if (ratio >= 0.8) return { grade: 'Playable', pill: 'warn' };
  return { grade: 'Poor', pill: 'bad' };
}

function estimatePerformance(game, hardware) {
  const cpuScore = CPU_SCORES[hardware.cpu] || Number(hardware.cpuScore) || 30;
  const gpuScore = GPU_SCORES[hardware.gpu] || Number(hardware.gpuScore) || 25;
  const ram = Number(hardware.ram) || 8;

  const cpuRatio = cpuScore / game.requirements.recommended.cpuScore;
  const gpuRatio = gpuScore / game.requirements.recommended.gpuScore;
  const ramRatio = ram / game.requirements.recommended.ram;
  const overall = (cpuRatio * 0.35) + (gpuRatio * 0.45) + (ramRatio * 0.2);
  const result = scoreToGrade(overall);

  const low = Math.max(20, Math.round(30 + overall * 35));
  const medium = Math.max(18, Math.round(low * 0.8));
  const high = Math.max(15, Math.round(low * 0.65));

  let recommendation = 'Low';
  if (overall >= 1.05) recommendation = 'High';
  else if (overall >= 0.85) recommendation = 'Medium';

  let canRun = 'Yes';
  if (
    cpuScore < game.requirements.minimum.cpuScore ||
    gpuScore < game.requirements.minimum.gpuScore ||
    ram < game.requirements.minimum.ram
  ) {
    canRun = 'Possibly, but below minimum in one or more areas';
  }

  const warning = ram < game.requirements.recommended.ram
    ? `${ram} GB RAM may cause stutter in heavier scenes.`
    : 'No major bottleneck detected for the selected hardware.';

  return {
    canRun,
    performance: result.grade,
    tone: result.pill,
    fps: {
      low: `${low}-${low + 10} FPS`,
      medium: `${medium}-${medium + 8} FPS`,
      high: `${high}-${high + 7} FPS`
    },
    recommendedPreset: recommendation,
    warning,
    source: hardware.source || 'Manual entry'
  };
}

function setupMobileNav() {
  const toggle = $('#mobileNavToggle');
  const nav = $('#siteNav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    nav.classList.toggle('is-open');
  });
}

function renderIdeas() {
  const root = $('#ideasGrid');
  if (!root) return;

  root.innerHTML = FEATURE_IDEAS.map((idea, index) => `
    <article class="idea-card">
      <p class="eyebrow">Feature</p>
      <h3>${escapeHtml(idea)}</h3>
      <p>${getIdeaDescription(idea)}</p>
    </article>
  `).join('');
}

function getIdeaDescription(idea) {
  const descriptions = {
    'PC Compatibility Checker': 'Laptop search plus manual specs gives users a practical way to estimate performance and FPS.',
    'Game Optimization Guides': 'Each game includes tier-based settings suggestions that are easy to understand.',
    'Similar Game Recommendations': 'Players can discover related titles based on feel and mechanics, not only genre labels.',
    'Game Length / Time Commitment': 'Users can quickly tell whether a game fits a short weekend or a long single-player run.',
    'Structured Game Rating System': 'Instead of vague reviews, users get category-based ratings for the parts they care about.',
    'Bug / Stability Indicator': 'The site highlights whether a game is stable, slightly rough, or currently risky to play.',
    'Value Rating (Worth Buying or Wait for Sale)': 'A simple buying recommendation helps users decide when a game feels worth it.',
    'Player Type Recommendation': 'People can instantly see whether a game suits story lovers, stealth fans, or action-first players.'
  };

  return descriptions[idea] || '';
}


function gameCardMarkup(game) {
  const statusTone = game.demandTone || game.bugStatus?.tone || 'blue';
  const statusLabel = game.demandLevel || game.bugStatus?.label || game.licenseTag || game.pricingTag || 'Featured';
  const topPills = [
    `<span class="pill blue">${escapeHtml(game.year)}</span>`,
    game.licenseTag ? `<span class="pill blue">${escapeHtml(game.licenseTag)}</span>` : '',
    game.pricingTag ? `<span class="pill good">${escapeHtml(game.pricingTag)}</span>` : '',
    `<span class="pill ${escapeHtml(statusTone)}">${escapeHtml(statusLabel)}</span>`
  ].filter(Boolean).join('');
  const linkHref = `game.html?slug=${encodeURIComponent(game.slug)}`;

  return `
    <article class="game-card${game.licenseTag ? ' open-source-card' : ''}${game.demandTone === 'bad' || game.demandTone === 'warn' ? ' performance-card' : ''}">
      <a class="card-cover-link" href="${linkHref}">
        <div class="cover" style="background-image: linear-gradient(180deg, transparent, rgba(8,17,31,0.75)), url('${escapeHtml(game.image)}')"></div>
      </a>
      <div class="content">
        <div class="tag-row">${topPills}</div>
        <h3>${escapeHtml(game.title)}</h3>
        <p>${escapeHtml(game.heroTag)}</p>
        <div class="genre-row">${game.genre.map((item) => `<span class="genre-pill">${escapeHtml(item)}</span>`).join('')}</div>
        <div class="hero-actions" style="margin-top: 1rem;">
          <a class="primary-btn" href="${linkHref}">View details</a>
        </div>
      </div>
    </article>
  `;
}

function renderGameGrid(filterText = '') {
  const root = $('#gameGrid');
  if (!root) return;
  const query = filterText.trim().toLowerCase();
  const combinedGames = [...GAME_LIBRARY, ...(window.OPEN_SOURCE_GAMES || [])];
  const games = combinedGames.filter((game) => {
    const tags = [game.title, ...(game.genre || []), game.heroTag || '', game.licenseTag || '', game.pricingTag || ''];
    const haystack = tags.join(' ').toLowerCase();
    return haystack.includes(query);
  });

  if (!games.length) {
    root.innerHTML = '<div class="empty-state">No games matched your search. Try a different title or genre.</div>';
    return;
  }

  root.innerHTML = games.map(gameCardMarkup).join('');
}

function setupSearch() {
  const searchInput = $('#gameSearchInput');
  if (!searchInput) return;
  renderGameGrid();
  searchInput.addEventListener('input', (event) => renderGameGrid(event.target.value));
}

async function submitContactForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const feedback = $('#contactFeedback');
  const formData = Object.fromEntries(new FormData(form).entries());

  try {
    const response = await fetch(`${API_BASE}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (!response.ok) {
      throw new Error('Could not send your message right now.');
    }

    form.reset();
    feedback.textContent = 'Thanks for the message. Your feedback was sent successfully.';
  } catch (error) {
    feedback.textContent = `${error.message} The form will still be useful for project demo purposes.`;
  }
}

function setupContactForm() {
  const contactForm = $('#contactForm');
  if (!contactForm) return;
  contactForm.addEventListener('submit', submitContactForm);
}

function readQuerySlug() {
  const params = new URLSearchParams(window.location.search);
  return params.get('slug') || 'assassins-creed';
}

function ratingCardsMarkup(ratings) {
  return Object.entries(ratings).map(([label, value]) => `
    <article class="rating-card">
      <h3>${escapeHtml(capitalize(label))}</h3>
      <span class="rating-value">${value.toFixed(1)} / 10</span>
      <div class="bar"><span style="width: ${value * 10}%"></span></div>
    </article>
  `).join('');
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}


function formatPriceDate(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

function priceTrackerSectionMarkup(game) {
  if (game.downloadUrl) return '';
  return `
    <section class="panel" id="price-tracker">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Price tracker</p>
          <h2>Price comparison</h2>
          <p class="panel-text">PlayWise checks the current legal store prices for Steam, Epic Games, and the official site when those prices are available from the live provider.</p>
        </div>
      </div>
      <div id="priceTrackerBox" class="price-tracker-shell" data-game-slug="${escapeHtml(game.slug)}">
        <div class="price-loading card-surface">
          <p class="eyebrow">Checking stores</p>
          <h3>Loading the current store prices…</h3>
          <p>We compare the tracked store options so visitors can decide where to go.</p>
        </div>
      </div>
    </section>
  `;
}

function renderPriceTracker(payload) {
  const root = $('#priceTrackerBox');
  if (!root) return;

  if (!payload?.supported) {
    root.innerHTML = `
      <div class="price-grid single">
        <article class="price-card highlight-card">
          <p class="eyebrow">Price tracker</p>
          <h3>Tracking not enabled for this title</h3>
          <p>${escapeHtml(payload?.message || 'This game does not use the paid-game price tracker.')}</p>
        </article>
      </div>
    `;
    return;
  }

  const stores = Array.isArray(payload.stores) ? payload.stores : [];
  const bestDeal = payload.bestDeal;
  const historicalLow = payload.historicalLow;
  const statusPill = payload.live ? '<span class="pill good">Live prices</span>' : '<span class="pill warn">Fallback links</span>';

  root.innerHTML = `
    <div class="price-summary-row">
      <article class="price-card highlight-card">
        <div class="price-card-head">
          <p class="eyebrow">Best current option</p>
          ${statusPill}
        </div>
        <h3>${bestDeal?.currentPrice || 'Price unavailable'}</h3>
        <p>${bestDeal?.store ? `${escapeHtml(bestDeal.store)} currently has the lowest tracked live price.` : escapeHtml(payload.message || 'Store links are available below.')}</p>
        <div class="price-meta-line">
          <span>Regular price: ${bestDeal?.regularPrice || '—'}</span>
          <span>${bestDeal?.cut ? `${bestDeal.cut}% off` : 'No live discount found'}</span>
        </div>
        ${bestDeal?.url ? `<a class="primary-btn" href="${escapeHtml(bestDeal.url)}" target="_blank" rel="noopener noreferrer">Open best deal</a>` : ''}
      </article>
      <article class="price-card secondary-card">
        <p class="eyebrow">Historical low</p>
        <h3>${historicalLow?.price || '—'}</h3>
        <p>${historicalLow?.store ? `${escapeHtml(historicalLow.store)} hit the best tracked low.` : 'Historical low appears when live price data is available.'}</p>
        <div class="price-meta-line">
          <span>${historicalLow?.cut ? `${historicalLow.cut}% off` : '—'}</span>
          <span>${historicalLow?.timestamp ? `Seen on ${escapeHtml(formatPriceDate(historicalLow.timestamp))}` : '—'}</span>
        </div>
      </article>
    </div>
    <div class="price-provider-note">
      <p>${escapeHtml(payload.message || '')}</p>
      <p>Last updated: ${escapeHtml(formatPriceDate(payload.lastUpdated))}${payload.country ? ` • Region: ${escapeHtml(payload.country)}` : ''}</p>
    </div>
    <div class="price-grid">
      ${stores.length ? stores.map((store) => `
        <article class="price-card store-card">
          <div class="price-card-head">
            <h3>${escapeHtml(store.store)}</h3>
            ${store.isBestCurrent ? '<span class="pill good">Best now</span>' : ''}
          </div>
          <strong class="store-price">${escapeHtml(store.currentPrice || 'Price unavailable')}</strong>
          <p>${store.regularPrice ? `Regular: ${escapeHtml(store.regularPrice)}` : 'Regular price: —'}</p>
          <p>${store.cut ? `${store.cut}% off` : (store.note ? escapeHtml(store.note) : 'No live discount found')}</p>
          ${store.historicalLow ? `<p>Store low: ${escapeHtml(store.historicalLow)}${store.historicalLowCut ? ` (${store.historicalLowCut}% off)` : ''}</p>` : ''}
          ${store.url ? `<a class="ghost-btn" href="${escapeHtml(store.url)}" target="_blank" rel="noopener noreferrer">Open ${escapeHtml(store.store)}</a>` : ''}
        </article>
      `).join('') : '<div class="empty-state">No store entries returned yet.</div>'}
    </div>
  `;
}

async function loadPriceTracker(game) {
  if (!game || game.downloadUrl) return;
  const root = $('#priceTrackerBox');
  if (!root) return;

  try {
    const response = await fetch(`${API_BASE}/games/${encodeURIComponent(game.slug)}/prices`);
    if (!response.ok) {
      throw new Error('Price tracker is unavailable right now.');
    }
    const payload = await response.json();
    renderPriceTracker(payload);
  } catch (error) {
    root.innerHTML = `
      <div class="price-grid single">
        <article class="price-card highlight-card">
          <p class="eyebrow">Price tracker</p>
          <h3>Could not refresh prices</h3>
          <p>${escapeHtml(error.message)} You can still use the official store buttons below.</p>
        </article>
      </div>
    `;
  }
}

function createSimilarCards(game) {
  return game.similarGames.map((slug) => {
    const similarGame = getGameBySlug(slug);
    if (!similarGame) return '';
    return `
      <a class="idea-card" href="game.html?slug=${encodeURIComponent(similarGame.slug)}">
        <p class="eyebrow">Similar pick</p>
        <h3>${escapeHtml(similarGame.title)}</h3>
        <p>${escapeHtml(similarGame.heroTag)}</p>
      </a>
    `;
  }).join('');
}



function trailerMarkup(game) {
  if (!game.trailer?.youtubeId) {
    return `
      <div class="empty-state trailer-empty-state">
        <div class="youtube-badge">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23.5 6.2a3.1 3.1 0 0 0-2.2-2.2C19.4 3.5 12 3.5 12 3.5s-7.4 0-9.3.5A3.1 3.1 0 0 0 .5 6.2 32.4 32.4 0 0 0 0 12a32.4 32.4 0 0 0 .5 5.8 3.1 3.1 0 0 0 2.2 2.2c1.9.5 9.3.5 9.3.5s7.4 0 9.3-.5a3.1 3.1 0 0 0 2.2-2.2A32.4 32.4 0 0 0 24 12a32.4 32.4 0 0 0-.5-5.8ZM9.7 15.5V8.5L15.8 12l-6.1 3.5Z"/></svg>
          Trailer placeholder
        </div>
        <p>Add a YouTube trailer link for this game when you are ready.</p>
      </div>`;
  }

  const thumbnail = `https://img.youtube.com/vi/${encodeURIComponent(game.trailer.youtubeId)}/hqdefault.jpg`;
  return `
    <a class="trailer-card" href="${escapeHtml(game.trailer.url)}" target="_blank" rel="noopener noreferrer">
      <div class="trailer-label-row">
        <span class="youtube-badge">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23.5 6.2a3.1 3.1 0 0 0-2.2-2.2C19.4 3.5 12 3.5 12 3.5s-7.4 0-9.3.5A3.1 3.1 0 0 0 .5 6.2 32.4 32.4 0 0 0 0 12a32.4 32.4 0 0 0 .5 5.8 3.1 3.1 0 0 0 2.2 2.2c1.9.5 9.3.5 9.3.5s7.4 0 9.3-.5a3.1 3.1 0 0 0 2.2-2.2A32.4 32.4 0 0 0 24 12a32.4 32.4 0 0 0-.5-5.8ZM9.7 15.5V8.5L15.8 12l-6.1 3.5Z"/></svg>
          YouTube trailer
        </span>
      </div>
      <img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(game.title)} trailer thumbnail" />
      <div class="trailer-overlay">
        <span class="pill blue">Watch on YouTube</span>
        <h3>${escapeHtml(game.trailer.title || 'Watch trailer')}</h3>
        <p>Open trailer in a new tab</p>
      </div>
    </a>
  `;
}

function officialSpecsMarkup(game) {
  if (!game.officialSpecs) return '';
  const sections = [
    ['Minimum', game.officialSpecs.minimum],
    ['Recommended', game.officialSpecs.recommended],
    ['High-end', game.officialSpecs.highEnd]
  ].filter(([, items]) => Array.isArray(items) && items.length);

  if (!sections.length) return '';

  return `
    <section class="panel" id="official-specs">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Official specs</p>
          <h2>System requirements snapshot</h2>
          <p class="panel-text">Quick hardware guidance collected for this title so visitors can compare before they run the checker.</p>
        </div>
      </div>
      <div class="info-grid">
        ${sections.map(([label, items]) => `
          <article class="info-card spec-card">
            <p class="eyebrow">${escapeHtml(label)}</p>
            <ul class="spec-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}


function storeLinksMarkup(game) {
  const links = [];

  if (game.downloadUrl) {
    links.push({ label: 'Download', url: game.downloadUrl, variant: 'primary' });
  }
  if (Array.isArray(game.storeLinks)) {
    game.storeLinks.forEach((item) => links.push({ ...item, variant: item.label === 'Download' ? 'primary' : 'ghost' }));
  }
  if (game.officialSite && !links.some((item) => item.url === game.officialSite)) {
    links.push({ label: 'Official site', url: game.officialSite, variant: 'ghost' });
  }

  const deduped = links.filter((item, index, array) => item?.url && array.findIndex((candidate) => candidate.url === item.url) === index);

  if (!deduped.length) {
    return '<div class="empty-state">No store links added yet.</div>';
  }

  return `<div class="store-link-row">${deduped.map((item) => `
    <a class="store-btn ${item.variant === 'primary' ? 'primary-btn' : 'ghost-btn'}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.label)}</a>
  `).join('')}</div>`;
}

function buildGamePage(game) {
  const root = $('#gameDetailRoot');
  if (!root || !game) return;

  root.innerHTML = `
    <section class="game-hero">
      <div class="game-backdrop" style="background-image: url('${escapeHtml(game.banner)}')"></div>
      <div class="wrapper game-layout">
        <div class="game-cover" style="background-image: linear-gradient(180deg, transparent, rgba(8,17,31,0.25)), url('${escapeHtml(game.image)}')"></div>
        <div class="game-copy">
          <p class="eyebrow">Featured game page</p>
          <div class="title-row">
            <h1>${escapeHtml(game.title)}</h1>
            <span class="pill ${escapeHtml(game.bugStatus.tone)}">${escapeHtml(game.bugStatus.label)}</span>
            ${game.demandLevel ? `<span class="pill ${escapeHtml(game.demandTone || 'blue')}">${escapeHtml(game.demandLevel)}</span>` : ''}
            ${game.licenseTag ? `<span class="pill blue">${escapeHtml(game.licenseTag)}</span>` : ''}
          </div>
          <p class="hero-text">${escapeHtml(game.description)}</p>
          <div class="genre-row">${game.genre.map((item) => `<span class="genre-pill">${escapeHtml(item)}</span>`).join('')}</div>
          <div class="hero-actions" style="margin-top: 1.2rem;">
            <a href="#compatibility" class="primary-btn">Check my PC</a>
            <a href="#trailer" class="ghost-btn">Watch trailer</a>
            ${game.downloadUrl ? `<a href="#where-to-get-it" class="ghost-btn">Download / links</a>` : ''}
            <a href="#where-to-get-it" class="ghost-btn">Where to get it</a>
          </div>
          <div class="hero-stats" style="margin-top: 1.6rem;">
            <div><strong>${escapeHtml(game.timeCommitment.mainStory)}</strong><span>Main story</span></div>
            <div><strong>${game.valueRating.score.toFixed(1)}/10</strong><span>Value rating</span></div>
            <div><strong>${game.structuredRatings.optimization.toFixed(1)}/10</strong><span>Optimization</span></div>
          </div>
        </div>
      </div>
    </section>

    <section class="panel-section game-content">
      <div class="wrapper panel-stack">
        <section class="panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Quick summary</p>
              <h2>Why this page is useful</h2>
            </div>
          </div>
          <div class="metrics-grid">
            <article class="metric-card">
              <p class="eyebrow">Story</p>
              <strong>${escapeHtml(game.story)}</strong>
            </article>
            <article class="metric-card">
              <p class="eyebrow">Buying advice</p>
              <strong>${escapeHtml(game.valueRating.advice)}</strong>
            </article>
            <article class="metric-card">
              <p class="eyebrow">Store insight</p>
              <strong>${escapeHtml(game.storeInsight)}</strong>
            </article>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Time commitment</p>
              <h2>Game Length / Time Commitment</h2>
            </div>
          </div>
          <div class="info-grid">
            <article class="info-card"><p class="eyebrow">Main story</p><strong>${escapeHtml(game.timeCommitment.mainStory)}</strong></article>
            <article class="info-card"><p class="eyebrow">Main + side</p><strong>${escapeHtml(game.timeCommitment.mainPlusSide)}</strong></article>
            <article class="info-card"><p class="eyebrow">Completionist</p><strong>${escapeHtml(game.timeCommitment.completionist)}</strong></article>
          </div>
        </section>

        ${officialSpecsMarkup(game)}

        <section class="panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Structured ratings</p>
              <h2>Structured Game Rating System</h2>
            </div>
          </div>
          <div class="review-grid">
            ${ratingCardsMarkup(game.structuredRatings)}
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Player insight</p>
              <h2>Stability, value, and player fit</h2>
            </div>
          </div>
          <div class="info-grid">
            <article class="info-card">
              <p class="eyebrow">Bug / Stability Indicator</p>
              <strong>${escapeHtml(game.bugStatus.label)}</strong>
              <p>${escapeHtml(game.bugStatus.note)}</p>
            </article>
            <article class="info-card">
              <p class="eyebrow">Value Rating</p>
              <strong>${game.valueRating.score.toFixed(1)} / 10</strong>
              <p>${escapeHtml(game.valueRating.advice)}</p>
            </article>
            <article class="info-card">
              <p class="eyebrow">Player Type Recommendation</p>
              <div class="list-split">
                <div>
                  <strong>Best for</strong>
                  <p>${game.playerTypes.bestFor.map(escapeHtml).join(', ')}</p>
                </div>
                <div>
                  <strong>Not ideal for</strong>
                  <p>${game.playerTypes.notIdealFor.map(escapeHtml).join(', ')}</p>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section class="panel" id="trailer">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Video preview</p>
              <h2>Trailer / gameplay thumbnail</h2>
              <p class="panel-text">Each detail page now includes a YouTube thumbnail so visitors can jump to the trailer quickly.</p>
            </div>
          </div>
          ${trailerMarkup(game)}
        </section>

        ${priceTrackerSectionMarkup(game)}

        <section class="panel" id="where-to-get-it">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Store links</p>
              <h2>Where to get this game</h2>
              <p class="panel-text">${game.downloadUrl ? 'Open-source and free titles keep a direct download button plus the official project site.' : 'Licensed games redirect visitors to official store or publisher pages instead of showing direct downloads.'}</p>
            </div>
          </div>
          ${storeLinksMarkup(game)}
        </section>

        <section class="panel" id="compatibility">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Performance tools</p>
              <h2>PC Compatibility Checker + Optimization Guide</h2>
              <p class="panel-text">Search your laptop model or enter your specs manually. Then compare the result with this game.</p>
            </div>
          </div>
          <div class="compatibility-shell">
            <div class="compatibility-panel card-surface">
              <div class="tab-row">
                <button class="tab-btn active" data-tab="laptop">Search laptop</button>
                <button class="tab-btn" data-tab="manual">Enter specs manually</button>
              </div>
              <form id="compatibilityForm" data-game-slug="${escapeHtml(game.slug)}">
                <div id="laptopFields">
                  <label>
                    <span>Laptop model</span>
                    <input type="text" name="laptop" list="laptopOptions" placeholder="Example: Lenovo LOQ 15 RTX 4060 16GB" />
                    <datalist id="laptopOptions">
                      ${LAPTOP_LIBRARY.map((item) => `<option value="${escapeHtml(item.model)}"></option>`).join('')}
                    </datalist>
                  </label>
                </div>
                <div id="manualFields" class="hidden">
                  <div class="field-grid">
                    <label>
                      <span>CPU</span>
                      ${createCustomSelect({
                        name: 'cpu',
                        placeholder: 'Select CPU',
                        options: Object.keys(CPU_SCORES).sort((a, b) => a.localeCompare(b))
                      })}
                    </label>
                    <label>
                      <span>GPU</span>
                      ${createCustomSelect({
                        name: 'gpu',
                        placeholder: 'Select GPU',
                        options: Object.keys(GPU_SCORES).sort((a, b) => a.localeCompare(b))
                      })}
                    </label>
                    <label>
                      <span>RAM</span>
                      ${createCustomSelect({
                        name: 'ram',
                        placeholder: 'Select RAM',
                        options: RAM_OPTIONS
                      })}
                    </label>
                  </div>
                </div>
                <div class="hero-actions" style="margin-top: 1rem;">
                  <button type="submit" class="primary-btn">Check performance</button>
                </div>
              </form>
            </div>
            <div id="compatibilityResult" class="compatibility-result card-surface">
              <p class="eyebrow">Result</p>
              <h3>Run your check to see if this game fits your system.</h3>
              <p>We estimate performance using game requirements and hardware tiers, then turn that into an understandable result.</p>
            </div>
          </div>
          <div class="guide-grid" style="margin-top: 1rem;">
            ${game.optimizationGuide.map((item) => `
              <article class="guide-card">
                <p class="eyebrow">Optimization guide</p>
                <h3>${escapeHtml(item.tier)}</h3>
                <p><strong>Settings:</strong> ${escapeHtml(item.settings)}</p>
                <p><strong>Expected result:</strong> ${escapeHtml(item.fps)}</p>
                <p>${escapeHtml(item.note)}</p>
              </article>
            `).join('')}
          </div>
        </section>

        <section class="panel" id="recommendations">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Discovery</p>
              <h2>Similar Game Recommendations</h2>
            </div>
          </div>
          <div class="recommend-grid">
            ${createSimilarCards(game)}
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Community</p>
              <h2>Comments</h2>
              <p class="panel-text">This is a lightweight comment section so the project still feels interactive.</p>
            </div>
          </div>
          <form id="commentForm" class="comment-form" data-game-slug="${escapeHtml(game.slug)}">
            <label>
              <span>Name</span>
              <input type="text" name="username" placeholder="Enter your name" required />
            </label>
            <label>
              <span>Comment</span>
              <textarea name="message" placeholder="Write what you think about this game" required></textarea>
            </label>
            <button type="submit" class="primary-btn">Post comment</button>
            <p id="commentFeedback" class="form-feedback"></p>
          </form>
          <div id="commentList" class="comment-list" style="margin-top: 1rem;"></div>
        </section>
      </div>
    </section>
  `;
}

function setupCompatibilityTabs() {
  const buttons = $$('.tab-btn');
  if (!buttons.length) return;
  const laptopFields = $('#laptopFields');
  const manualFields = $('#manualFields');

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      buttons.forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      const mode = button.dataset.tab;
      laptopFields.classList.toggle('hidden', mode !== 'laptop');
      manualFields.classList.toggle('hidden', mode !== 'manual');
    });
  });
}

function setupCustomSelects(scope = document) {
  const selects = $$('.custom-select', scope);
  if (!selects.length) return;

  const closeAll = (except = null) => {
    selects.forEach((select) => {
      if (select === except) return;
      select.classList.remove('open');
      const trigger = $('.custom-select-trigger', select);
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
  };

  selects.forEach((select) => {
    if (select.dataset.bound === 'true') return;
    select.dataset.bound = 'true';

    const trigger = $('.custom-select-trigger', select);
    const hiddenInput = $('input[type="hidden"]', select);
    const triggerLabel = $('.custom-select-trigger span', select);
    const options = $$('.custom-select-option', select);

    trigger?.addEventListener('click', () => {
      const isOpen = select.classList.contains('open');
      closeAll(select);
      select.classList.toggle('open', !isOpen);
      trigger.setAttribute('aria-expanded', String(!isOpen));
    });

    options.forEach((option) => {
      option.addEventListener('click', () => {
        const value = option.dataset.value || '';
        const optionLabel = option.textContent?.trim() || value;
        hiddenInput.value = value;
        triggerLabel.textContent = optionLabel;
        options.forEach((item) => item.classList.remove('selected'));
        option.classList.add('selected');
        closeAll();
      });
    });
  });

  if (!document.body.dataset.customSelectCloseBound) {
    document.body.dataset.customSelectCloseBound = 'true';
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.custom-select')) {
        closeAll();
      }
    });
  }
}

function renderCompatibilityResult(result) {
  const root = $('#compatibilityResult');
  if (!root) return;

  const details = (result.details || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');

  root.innerHTML = `
    <p class="eyebrow">Performance check</p>
    <span class="pill ${escapeHtml(result.tone)}">${escapeHtml(result.performance)}</span>
    <strong>${escapeHtml(result.canRun)}</strong>
    <p>Source used: ${escapeHtml(result.source)}</p>
    <div class="result-meta">
      <div><p class="eyebrow">Recommended preset</p><strong>${escapeHtml(result.recommendedPreset)}</strong></div>
      <div><p class="eyebrow">Expected FPS</p><strong>${escapeHtml(result.expectedFps || `${result.fps.low} / ${result.fps.medium}`)}</strong></div>
      <div><p class="eyebrow">Low settings</p><strong>${escapeHtml(result.fps.low)}</strong></div>
      <div><p class="eyebrow">Medium / High</p><strong>${escapeHtml(result.fps.medium)} / ${escapeHtml(result.fps.high)}</strong></div>
      <div><p class="eyebrow">Warning</p><strong>${escapeHtml(result.warning)}</strong></div>
      <div><p class="eyebrow">Platform</p><strong>${escapeHtml(result.platform || 'windows')}</strong></div>
    </div>
    ${details ? `<ul class="compatibility-details">${details}</ul>` : ''}
  `;
}

function detectHardwarePlatform(hardware = {}) {
  const cpu = String(hardware.cpu || '').toLowerCase();
  const gpu = String(hardware.gpu || '').toLowerCase();
  const source = String(hardware.source || '').toLowerCase();
  if (cpu.includes('apple') || gpu.includes('apple') || source.includes('macbook')) return 'macos';
  return 'windows';
}

async function requestCompatibilityCheck(game, hardware) {
  try {
    const response = await fetch(`${API_BASE}/hardware/compatibility`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game: {
          slug: game.slug,
          title: game.title,
          requirements: game.requirements,
          supportedPlatforms: game.platform || ['Windows']
        },
        hardware
      })
    });

    if (!response.ok) throw new Error('Compatibility API unavailable');
    return await response.json();
  } catch (error) {
    return estimatePerformance(game, hardware);
  }
}

function setupCompatibilityForm(game) {
  const form = $('#compatibilityForm');
  if (!form || !game) return;

  setupCustomSelects(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(form).entries());

    let hardware;
    if (formData.laptop) {
      const laptop = LAPTOP_LIBRARY.find((item) => item.model.toLowerCase() === formData.laptop.trim().toLowerCase());
      if (laptop) {
        hardware = {
          cpu: laptop.cpu,
          gpu: laptop.gpu,
          ram: laptop.ram,
          source: laptop.model,
          platform: laptop.platform || detectHardwarePlatform(laptop)
        };
      }
    }

    if (!hardware) {
      hardware = {
        cpu: formData.cpu,
        gpu: formData.gpu,
        ram: formData.ram,
        source: 'Manual entry',
        platform: detectHardwarePlatform(formData)
      };
    }

    const result = await requestCompatibilityCheck(game, hardware);
    renderCompatibilityResult(result);
  });
}

function getStoredComments(slug) {
  const localKey = `playwise-comments-${slug}`;
  const saved = localStorage.getItem(localKey);
  return saved ? JSON.parse(saved) : [];
}

function saveComment(slug, comment) {
  const localKey = `playwise-comments-${slug}`;
  const comments = getStoredComments(slug);
  comments.unshift(comment);
  localStorage.setItem(localKey, JSON.stringify(comments.slice(0, 8)));
}

function renderComments(slug) {
  const root = $('#commentList');
  if (!root) return;
  const comments = getStoredComments(slug);

  if (!comments.length) {
    root.innerHTML = '<div class="empty-state">No comments yet. Be the first person to leave one.</div>';
    return;
  }

  root.innerHTML = comments.map((comment) => `
    <article class="comment-card">
      <h4>${escapeHtml(comment.username)}</h4>
      <p>${escapeHtml(comment.message)}</p>
      <p class="mini-text">${escapeHtml(comment.createdAt)}</p>
    </article>
  `).join('');
}

function setupCommentForm(game) {
  const form = $('#commentForm');
  const feedback = $('#commentFeedback');
  if (!form || !feedback || !game) return;

  renderComments(game.slug);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(form).entries());
    const comment = {
      username: formData.username,
      message: formData.message,
      createdAt: new Date().toLocaleString()
    };

    saveComment(game.slug, comment);
    form.reset();
    feedback.textContent = 'Comment posted successfully.';
    renderComments(game.slug);
  });
}

async function submitAuthForm(event, endpoint, feedbackId, successMessage) {
  event.preventDefault();
  const form = event.currentTarget;
  const feedback = document.getElementById(feedbackId);
  const body = Object.fromEntries(new FormData(form).entries());

  try {
    const response = await fetch(`${API_BASE}/auth/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || 'Something went wrong.');
    }

    if (payload.token) {
      localStorage.setItem('gamescope-token', payload.token);
    }

    feedback.textContent = successMessage;
    form.reset();
  } catch (error) {
    feedback.textContent = `${error.message} Backend connection can be configured from the backend folder if needed.`;
  }
}

function setupAuthForms() {
  const loginForm = $('#loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (event) => {
      submitAuthForm(event, 'login', 'loginFeedback', 'Login successful. You can now go back to the site.');
    });
  }

  const registerForm = $('#registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', (event) => {
      submitAuthForm(event, 'register', 'registerFeedback', 'Account created successfully.');
    });
  }
}

function initHomePage() {
  renderIdeas();
  setupSearch();
  setupContactForm();
}

async function initGamePage() {
  await ensureHardwareCatalog();
  const slug = readQuerySlug();
  const game = getGameBySlug(slug);
  if (!game) return;
  buildGamePage(game);
  setupCompatibilityTabs();
  setupCompatibilityForm(game);
  setupCommentForm(game);
  loadPriceTracker(game);
}

async function init() {
  setupMobileNav();
  const page = document.body.dataset.page;

  if (page === 'home') initHomePage();
  if (page === 'game') await initGamePage();
  if (page === 'login' || page === 'register') setupAuthForms();
  if (page === 'open-source') initOpenSourcePage();
  if (page === 'hardware-admin') await initHardwareAdmin();
}

document.addEventListener('DOMContentLoaded', () => { init(); });


async function initHardwareAdmin() {
  await ensureHardwareCatalog();
  const cpuList = $('#adminCpuList');
  const gpuList = $('#adminGpuList');
  const laptopList = $('#adminLaptopList');

  if (cpuList) cpuList.innerHTML = Object.entries(CPU_SCORES).sort((a, b) => a[0].localeCompare(b[0])).map(([name, score]) => `<li><strong>${escapeHtml(name)}</strong><span>${score}</span></li>`).join('');
  if (gpuList) gpuList.innerHTML = Object.entries(GPU_SCORES).sort((a, b) => a[0].localeCompare(b[0])).map(([name, score]) => `<li><strong>${escapeHtml(name)}</strong><span>${score}</span></li>`).join('');
  if (laptopList) laptopList.innerHTML = LAPTOP_LIBRARY.map((item) => `<li><strong>${escapeHtml(item.model)}</strong><span>${escapeHtml(item.cpu)} • ${escapeHtml(item.gpu)} • ${escapeHtml(String(item.ram))} GB</span></li>`).join('');

  setupAdminForm('cpuAdminForm', `${API_BASE}/hardware/cpus`, 'CPU saved. Refresh the page to pull it into the client catalog.');
  setupAdminForm('gpuAdminForm', `${API_BASE}/hardware/gpus`, 'GPU saved. Refresh the page to pull it into the client catalog.');
  setupAdminForm('laptopAdminForm', `${API_BASE}/hardware/laptops`, 'Laptop preset saved. Refresh the page to pull it into the client catalog.');
}

function setupAdminForm(formId, endpoint, successMessage) {
  const form = document.getElementById(formId);
  if (!form) return;
  const feedback = form.querySelector('.form-feedback');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    if (payload.score) payload.score = Number(payload.score);
    if (payload.ram) payload.ram = Number(payload.ram);
    if (payload.tags) payload.tags = payload.tags.split(',').map((item) => item.trim()).filter(Boolean);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Save failed');
      if (feedback) feedback.textContent = successMessage;
      form.reset();
    } catch (error) {
      if (feedback) feedback.textContent = error.message;
    }
  });
}


function openSourceCardMarkup(game) {
  const minimumSpecs = game.officialSpecs?.minimum || [];
  return `
    <article class="game-card open-source-card">
      <a class="card-cover-link" href="game.html?slug=${encodeURIComponent(game.slug)}">
        <div class="cover" style="background-image: linear-gradient(180deg, transparent, rgba(8,17,31,0.78)), url('${escapeHtml(game.image)}')"></div>
      </a>
      <div class="content">
        <div class="tag-row">
          <span class="pill blue">${escapeHtml(game.licenseTag)}</span>
          <span class="pill good">${escapeHtml(game.pricingTag)}</span>
          ${game.demandLevel ? `<span class="pill ${escapeHtml(game.demandTone || 'good')}">${escapeHtml(game.demandLevel)}</span>` : ''}
        </div>
        <h3>${escapeHtml(game.title)}</h3>
        <p>${escapeHtml(game.heroTag)}</p>
        <div class="genre-row">${game.genre.map((item) => `<span class="genre-pill">${escapeHtml(item)}</span>`).join('')}</div>
        <p class="card-description">${escapeHtml(game.description)}</p>
        ${minimumSpecs.length ? `<div class="spec-chip-row">${minimumSpecs.slice(0, 3).map((item) => `<span class="spec-chip">${escapeHtml(item)}</span>`).join('')}</div>` : ''}
        ${game.trailer?.youtubeId ? `
          <div class="trailer-label-row compact">
            <span class="youtube-badge">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23.5 6.2a3.1 3.1 0 0 0-2.2-2.2C19.4 3.5 12 3.5 12 3.5s-7.4 0-9.3.5A3.1 3.1 0 0 0 .5 6.2 32.4 32.4 0 0 0 0 12a32.4 32.4 0 0 0 .5 5.8 3.1 3.1 0 0 0 2.2 2.2c1.9.5 9.3.5 9.3.5s7.4 0 9.3-.5a3.1 3.1 0 0 0 2.2-2.2A32.4 32.4 0 0 0 24 12a32.4 32.4 0 0 0-.5-5.8ZM9.7 15.5V8.5L15.8 12l-6.1 3.5Z"/></svg>
              YouTube trailer for ${escapeHtml(game.title)}
            </span>
          </div>
          <a class="mini-trailer-card" href="${escapeHtml(game.trailer.url)}" target="_blank" rel="noopener noreferrer"><img src="https://img.youtube.com/vi/${escapeHtml(game.trailer.youtubeId)}/hqdefault.jpg" alt="${escapeHtml(game.title)} trailer" /></a>` : ''}
        <div class="hero-actions card-actions">
          <a class="primary-btn" href="${escapeHtml(game.downloadUrl)}" target="_blank" rel="noopener noreferrer">Download</a>
          <a class="ghost-btn" href="game.html?slug=${encodeURIComponent(game.slug)}">View details</a>
          <a class="ghost-btn" href="${escapeHtml(game.officialSite)}" target="_blank" rel="noopener noreferrer">Official site</a>
        </div>
      </div>
    </article>
  `;
}

function renderOpenSourceGrid(filterText = '') {
  const root = $('#openSourceGrid');
  if (!root || !window.OPEN_SOURCE_GAMES) return;
  const query = filterText.trim().toLowerCase();
  const games = window.OPEN_SOURCE_GAMES.filter((game) => {
    const haystack = `${game.title} ${game.genre.join(' ')} ${game.heroTag} ${game.description}`.toLowerCase();
    return haystack.includes(query);
  });

  if (!games.length) {
    root.innerHTML = '<div class="empty-state">No open-source games matched your search.</div>';
    return;
  }

  root.innerHTML = games.map(openSourceCardMarkup).join('');
}


function initOpenSourcePage() {
  renderOpenSourceGrid();
  const searchInput = $('#openSourceSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (event) => renderOpenSourceGrid(event.target.value));
  }
}
