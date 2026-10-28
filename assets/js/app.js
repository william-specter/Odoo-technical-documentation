/* =========================================================
   Odoo Internals Field Manual — client
   No framework, no network calls, works from file://
   ========================================================= */
(() => {
  'use strict';

  const DATA = window.ODOO_DOCS;
  const IS_ES = (DATA?.locale || document.documentElement.lang || 'en').toLowerCase().startsWith('es');
  if (!DATA) {
    document.getElementById('article').innerHTML = IS_ES
      ? '<div class="mermaid-error">No se encontraron los datos de la documentación. Ejecuta <code>node build.mjs</code> primero.</div>'
      : '<div class="mermaid-error">Documentation data not found. Run <code>node build.mjs</code> first.</div>';
    return;
  }

  const T = IS_ES ? {
    searchPlaceholder: 'Buscar en el manual…  /',
    searchAria: 'Buscar en el manual',
    tocTitle: 'En esta página',
    previous: 'Anterior',
    next: 'Siguiente',
    minRead: 'min de lectura',
    words: 'palabras',
    sections: 'secciones',
    copy: 'Copiar',
    copied: 'Copiado',
    copyFailed: 'Error',
    noResults: (query) => `No hay resultados para “${query}”. Prueba un término más amplio o un nombre de modelo como <code>stock.move</code>.`,
    results: (count) => `${count} resultado${count === 1 ? '' : 's'}`,
    returnHome: 'Volver a la introducción',
    notFound: 'No encontrado',
    notFoundTitle: 'Página no encontrada',
    notFoundDesc: (slug) => `Ningún documento coincide con <code>${slug}</code>. Puede que se haya renombrado o que aún no se haya compilado.`,
    markdownFailed: 'Error al renderizar Markdown',
    diagramError: 'Mermaid no pudo renderizar el diagrama. El código fuente se conserva a continuación.',
    themeLight: 'Cambiar al tema claro',
    themeDark: 'Cambiar al tema oscuro',
    backToTop: 'Volver arriba',
  } : {
    searchPlaceholder: 'Search the manual…  /',
    searchAria: 'Search the manual',
    tocTitle: 'On this page',
    previous: 'Previous',
    next: 'Next',
    minRead: 'min read',
    words: 'words',
    sections: 'sections',
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Failed',
    noResults: (query) => `No matches for “${query}”. Try a broader term or a model name such as <code>stock.move</code>.`,
    results: (count) => `${count} result${count === 1 ? '' : 's'}`,
    returnHome: 'Return to the introduction',
    notFound: 'Not found',
    notFoundTitle: 'Page not found',
    notFoundDesc: (slug) => `No document matches <code>${slug}</code>. It may have been renamed or not yet built.`,
    markdownFailed: 'Markdown render failed',
    diagramError: 'Diagram could not be rendered by Mermaid. The source is preserved below.',
    themeLight: 'Switch to light theme',
    themeDark: 'Switch to dark theme',
    backToTop: 'Back to top',
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const slugify = (text) => text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'section';

  const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  const pageBySlug = new Map(DATA.pages.map(p => [p.slug, p]));
  const flatSlugs = DATA.pages.map(p => p.slug);
  const sectionById = new Map(DATA.sections.map(s => [s.id, s]));

  const els = {
    nav: $('#nav'),
    article: $('#article'),
    tocNav: $('#tocNav'),
    pager: $('#pager'),
    search: $('#search'),
    results: $('#searchResults'),
    sidebar: $('#sidebar'),
    scrim: $('#scrim'),
    menuToggle: $('#menuToggle'),
    themeToggle: $('#themeToggle'),
    progress: $('#progress span'),
    backTop: $('#backTop'),
    generated: $('#generated'),
  };

  let currentSlug = null;
  let searchIndex = null;
  let searchActive = -1;
  let mermaidTheme = null;
  let pendingAnchor = '';

  function applyStaticUi() {
    els.search.placeholder = T.searchPlaceholder;
    els.search.setAttribute('aria-label', T.searchAria);
    $('.toc-title')?.replaceChildren(T.tocTitle);
    els.backTop?.setAttribute('aria-label', T.backToTop);
    els.backTop?.setAttribute('title', T.backToTop);
  }
  applyStaticUi();

  const localeSwitch = $('#localeSwitch');
  localeSwitch?.addEventListener('click', (ev) => {
    const target = localeSwitch.dataset.target || localeSwitch.getAttribute('href');
    if (!target) return;
    ev.preventDefault();
    location.href = target + location.hash;
  });

  /* ---------- theme ---------- */
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('odoo-docs-theme', theme); } catch (_) {}
    els.themeToggle?.setAttribute('aria-label', theme === 'dark' ? T.themeLight : T.themeDark);
    els.themeToggle?.setAttribute('title', theme === 'dark' ? T.themeLight : T.themeDark);
  }
  function initTheme() {
    let theme = null;
    try { theme = localStorage.getItem('odoo-docs-theme'); } catch (_) {}
    if (!theme) theme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(theme);
  }
  initTheme();

  els.themeToggle?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    if (currentSlug) renderPage(currentSlug, { keepScroll: true, skipHistory: true });
  });

  /* ---------- sidebar ---------- */
  function collapsedSections() {
    try { return new Set(JSON.parse(localStorage.getItem('odoo-docs-collapsed') || '[]')); }
    catch (_) { return new Set(); }
  }
  function saveCollapsed(set) {
    try { localStorage.setItem('odoo-docs-collapsed', JSON.stringify([...set])); } catch (_) {}
  }

  function renderSidebar() {
    const collapsed = collapsedSections();
    const frag = document.createDocumentFragment();

    for (const section of DATA.sections) {
      const wrap = document.createElement('section');
      wrap.className = 'nav-section' + (collapsed.has(section.id) ? ' collapsed' : '');
      wrap.dataset.section = section.id;

      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'nav-section-head';
      head.setAttribute('aria-expanded', String(!collapsed.has(section.id)));
      head.innerHTML = `<span class="num">${escapeHtml(section.icon || '')}</span>
        <span class="label">${escapeHtml(section.title)}</span>
        <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
      head.addEventListener('click', () => {
        const isCollapsed = wrap.classList.toggle('collapsed');
        head.setAttribute('aria-expanded', String(!isCollapsed));
        const set = collapsedSections();
        if (isCollapsed) set.add(section.id); else set.delete(section.id);
        saveCollapsed(set);
      });

      const list = document.createElement('ul');
      list.className = 'nav-pages';
      for (const slug of section.pages) {
        const page = pageBySlug.get(slug);
        if (!page) continue;
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = 'nav-link';
        a.href = `#/${slug}`;
        a.dataset.slug = slug;
        a.textContent = page.title;
        a.title = page.title;
        li.appendChild(a);
        list.appendChild(li);
      }
      wrap.append(head, list);
      frag.appendChild(wrap);
    }
    els.nav.replaceChildren(frag);
  }

  function setActiveNav(slug) {
    $$('.nav-link').forEach(a => {
      const active = a.dataset.slug === slug;
      a.classList.toggle('active', active);
      if (active) {
        a.setAttribute('aria-current', 'page');
        const section = a.closest('.nav-section');
        if (section?.classList.contains('collapsed')) {
          section.classList.remove('collapsed');
          const head = $('.nav-section-head', section);
          head?.setAttribute('aria-expanded', 'true');
        }
        // keep the active link in view without scrolling the page
        const rect = a.getBoundingClientRect();
        const scroller = a.closest('.sidebar-scroll');
        if (scroller) {
          const box = scroller.getBoundingClientRect();
          if (rect.top < box.top + 8 || rect.bottom > box.bottom - 8) {
            scroller.scrollTop += rect.top - box.top - 40;
          }
        }
      } else {
        a.removeAttribute('aria-current');
      }
    });
    const section = pageBySlug.get(slug)?.section;
    $$('.nav-section').forEach(s => s.classList.toggle('current', s.dataset.section === section));
  }

  /* ---------- markdown ---------- */
  function configureMarked() {
    if (!window.marked) return;
    window.marked.setOptions({ gfm: true, breaks: false });
  }
  configureMarked();

  function stripMarkdown(md) {
    return md
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/[*_>#|~-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function buildSearchIndex() {
    searchIndex = DATA.pages.map(page => ({
      ...page,
      text: stripMarkdown(DATA.content[page.slug] || ''),
      lower: stripMarkdown(DATA.content[page.slug] || '').toLowerCase(),
    }));
  }

  function decorate(article) {
    // remove duplicate H1 from the markdown body
    const body = article.querySelector('.article-body');
    const first = body?.querySelector(':scope > h1:first-child');
    if (first) first.remove();

    // tables -> scroll containers
    $$('table', article).forEach(table => {
      if (table.parentElement?.classList.contains('table-scroll')) return;
      const wrap = document.createElement('div');
      wrap.className = 'table-scroll';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });

    // heading ids + anchors
    const used = new Map();
    const headings = [];
    $$('h2, h3, h4', article).forEach(h => {
      let id = slugify(h.textContent);
      const n = (used.get(id) || 0) + 1;
      used.set(id, n);
      if (n > 1) id = `${id}-${n}`;
      h.id = id;
      const a = document.createElement('a');
      a.className = 'anchor';
      a.href = `#/${currentSlug}::${id}`;
      a.setAttribute('aria-label', `Link to ${h.textContent}`);
      a.textContent = '#';
      h.appendChild(a);
      if (h.tagName === 'H2' || h.tagName === 'H3') {
        headings.push({ level: Number(h.tagName.slice(1)), id, text: h.textContent.replace(/#$/, '').trim() });
      }
    });

    // mermaid code blocks -> divs
    $$('pre > code.language-mermaid', article).forEach(code => {
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-wrap';
      const diagram = document.createElement('div');
      diagram.className = 'mermaid';
      diagram.textContent = code.textContent;
      wrapper.appendChild(diagram);
      code.parentElement.replaceWith(wrapper);
    });

    // code copy buttons
    $$('pre', article).forEach(pre => {
      if (pre.closest('.mermaid-wrap')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-btn';
      btn.textContent = T.copy;
      btn.addEventListener('click', async () => {
        const code = pre.querySelector('code');
        const text = code ? code.textContent : pre.textContent;
        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = T.copied;
        } catch (_) {
          const ta = document.createElement('textarea');
          ta.value = text; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); btn.textContent = T.copied; } catch (_) { btn.textContent = T.copyFailed; }
          ta.remove();
        }
        setTimeout(() => { btn.textContent = T.copy; }, 1400);
      });
      pre.appendChild(btn);
    });

    // external links
    $$('a[href]', article).forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      if (/^https?:\/\//i.test(href)) {
        a.target = '_blank'; a.rel = 'noopener noreferrer';
        return;
      }
      if (href.endsWith('.md') || href.includes('.md#')) {
        a.addEventListener('click', ev => {
          ev.preventDefault();
          const target = resolveMdLink(href);
          if (target?.external) {
            location.href = target.external + location.hash;
          } else if (target) {
            go(target.slug, target.anchor);
          }
        });
      }
    });

    return headings;
  }

  function resolveMdLink(href) {
    let raw = href;
    let anchor = '';
    if (raw.includes('#')) [raw, anchor] = raw.split('#');
    if (/^(?:\.\/)?README\.es\.md$/i.test(raw)) {
      return IS_ES ? { slug: 'intro', anchor } : { external: 'index.es.html' };
    }
    if (/^(?:\.\/)?README\.md$/i.test(raw)) {
      return IS_ES ? { external: 'index.html' } : { slug: 'intro', anchor };
    }
    try {
      const base = 'https://local.invalid/' + currentSlug + '.md';
      const url = new URL(raw, base);
      let path = decodeURIComponent(url.pathname.replace(/^\//, '')).replace(/\.md$/i, '');
      // README links use repository-relative paths (docs/..., docs/es/...), while page slugs omit prefixes
      path = path.replace(/^docs\/es\//i, '').replace(/^docs\//i, '');
      if (path === 'README') return { slug: 'intro', anchor };
      if (pageBySlug.has(path)) return { slug: path, anchor };
      // also try section-relative
      const section = currentSlug.split('/')[0];
      const alt = `${section}/${path}`;
      if (pageBySlug.has(alt)) return { slug: alt, anchor };
    } catch (_) {}
    return null;
  }

  function renderToc(headings) {
    if (!headings.length) {
      els.tocNav.innerHTML = '';
      return;
    }
    const frag = document.createDocumentFragment();
    for (const h of headings) {
      const a = document.createElement('a');
      a.href = `#/${currentSlug}::${h.id}`;
      a.textContent = h.text;
      a.dataset.target = h.id;
      if (h.level === 3) a.classList.add('l3');
      a.addEventListener('click', ev => {
        ev.preventDefault();
        go(currentSlug, h.id);
      });
      frag.appendChild(a);
    }
    els.tocNav.replaceChildren(frag);
  }

  function setupScrollSpy() {
    const links = $$('#tocNav a');
    if (!links.length) return;
    const targets = links.map(a => document.getElementById(a.dataset.target)).filter(Boolean);
    const onScroll = () => {
      const top = window.scrollY + 100;
      let active = targets[0];
      for (const el of targets) {
        if (el.offsetTop <= top) active = el;
      }
      links.forEach(a => a.classList.toggle('active', a.dataset.target === active?.id));
    };
    window.removeEventListener('scroll', window.__tocSpy || (() => {}));
    window.__tocSpy = onScroll;
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  async function renderMermaid() {
    const nodes = $$('.mermaid');
    if (!nodes.length || !window.mermaid) return;
    const theme = document.documentElement.dataset.theme;
    if (mermaidTheme !== theme) {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: theme === 'dark' ? 'dark' : 'base',
        securityLevel: 'strict',
        suppressErrorRendering: true,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        themeVariables: theme === 'dark'
          ? { primaryColor: '#2c2329', primaryTextColor: '#efe9ec', primaryBorderColor: '#5b4a54', lineColor: '#9a8f96', secondaryColor: '#242f2e', tertiaryColor: '#211c1f' }
          : { primaryColor: '#f0e8ed', primaryTextColor: '#1f1a1d', primaryBorderColor: '#c9b6c3', lineColor: '#714b67', secondaryColor: '#e6f4f2', tertiaryColor: '#f6f3f0' },
      });
      mermaidTheme = theme;
    }
    try {
      await window.mermaid.run({ nodes, suppressErrors: true });
      // mermaid may leave an error svg; detect and provide a readable fallback
      nodes.forEach(node => {
        if (!node.querySelector('svg')) {
          const text = node.textContent.trim();
          const err = document.createElement('div');
          err.className = 'mermaid-error';
          err.innerHTML = `${T.diagramError}<br><code></code>`;
          err.querySelector('code').textContent = text;
          node.replaceWith(err);
        }
      });
    } catch (err) {
      console.warn('Mermaid render failed', err);
    }
  }

  function findPage(slug) {
    return pageBySlug.get(slug) || null;
  }

  function renderNotFound(slug) {
    const main = document.getElementById('article');
    main.innerHTML = `
      <div class="page-head">
        <div class="page-kicker"><span class="pill">404</span> ${T.notFound}</div>
        <h1>${T.notFoundTitle}</h1>
        <p class="page-desc">${T.notFoundDesc(escapeHtml(slug))}</p>
      </div>
      <p><a href="#/intro">${T.returnHome}</a></p>`;
    els.tocNav.innerHTML = '';
    els.pager.innerHTML = '';
  }

  function renderPage(slug, opts = {}) {
    const page = findPage(slug);
    if (!page) {
      currentSlug = slug;
      renderNotFound(slug);
      setActiveNav('');
      return;
    }
    currentSlug = slug;
    const md = DATA.content[slug] || '';
    let html = '';
    try {
      html = window.marked ? window.marked.parse(md) : `<pre>${escapeHtml(md)}</pre>`;
    } catch (err) {
      html = `<div class="mermaid-error">${T.markdownFailed}: ${escapeHtml(err.message)}</div>`;
    }

    const section = sectionById.get(page.section);
    const header = `
      <header class="page-head">
        <div class="page-kicker">
          <span class="pill">${escapeHtml(section?.short || section?.title || page.section)}</span>
          <span>${escapeHtml(section?.title || '')}</span>
        </div>
        <h1>${escapeHtml(page.title)}</h1>
        <p class="page-desc">${escapeHtml(page.description || '')}</p>
        <div class="page-meta">
          <span><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${page.minutes} ${T.minRead}</span>
          <span><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h6"/></svg>${page.words.toLocaleString()} ${T.words}</span>
          <span><svg viewBox="0 0 24 24"><path d="M3 7h18M3 12h18M3 17h18"/></svg>${page.headings?.length || 0} ${T.sections}</span>
        </div>
      </header>`;

    els.article.innerHTML = header + `<div class="article-body">${html}</div>`;
    const headings = decorate(els.article);
    renderToc(headings);
    setActiveNav(slug);
    renderPager(slug);
    setupScrollSpy();
    const anchor = opts.anchor || '';
    pendingAnchor = (!opts.keepScroll && anchor) ? anchor : '';
    renderMermaid().then(() => {
      if (currentSlug === slug && pendingAnchor) {
        const el = document.getElementById(pendingAnchor);
        if (el) el.scrollIntoView({ block: 'start', behavior: 'auto' });
        pendingAnchor = '';
      }
    });

    // update document title
    document.title = page.slug === 'intro'
      ? DATA.title
      : `${page.title} · ${DATA.title}`;

    // scroll behaviour
    if (opts.keepScroll) {
      // preserve position
    } else if (anchor) {
      requestAnimationFrame(() => {
        const el = document.getElementById(anchor);
        if (el) {
          el.scrollIntoView({ block: 'start', behavior: 'auto' });
        } else {
          window.scrollTo({ top: 0, behavior: 'auto' });
        }
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    if (opts.push !== false && !opts.skipHistory) {
      const hash = `#/${slug}${anchor ? '::' + anchor : ''}`;
      if (location.hash !== hash) history.pushState(null, '', hash);
    }
    closeSidebar();
    els.search.blur();
    hideSearch();
  }

  function renderPager(slug) {
    const idx = flatSlugs.indexOf(slug);
    const prev = idx > 0 ? pageBySlug.get(flatSlugs[idx - 1]) : null;
    const next = idx >= 0 && idx < flatSlugs.length - 1 ? pageBySlug.get(flatSlugs[idx + 1]) : null;
    const frag = document.createDocumentFragment();
    const mk = (page, dir) => {
      if (!page) {
        const s = document.createElement('span');
        s.className = 'spacer';
        return s;
      }
      const a = document.createElement('a');
      a.href = `#/${page.slug}`;
      a.className = dir;
      a.innerHTML = `<span class="dir">${dir === 'prev' ? T.previous : T.next}</span><span class="ttl">${escapeHtml(page.title)}</span>`;
      a.addEventListener('click', ev => { ev.preventDefault(); go(page.slug); });
      return a;
    };
    frag.append(mk(prev, 'prev'), mk(next, 'next'));
    els.pager.replaceChildren(frag);
  }

  /* ---------- routing ---------- */
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    if (!raw) return { slug: 'intro', anchor: '' };
    const [slugPart, ...anchorParts] = raw.split('::');
    let slug = slugPart;
    try { slug = decodeURIComponent(slugPart); } catch (_) {}
    let anchor = anchorParts.join('::');
    try { anchor = decodeURIComponent(anchor); } catch (_) {}
    return { slug: slug.replace(/\/+$/, '') || 'intro', anchor };
  }

  function go(slug, anchor = '') {
    if (slug === currentSlug && anchor) {
      const el = document.getElementById(anchor);
      if (el) {
        el.scrollIntoView({ block: 'start', behavior: 'smooth' });
        history.replaceState(null, '', `#/${slug}::${anchor}`);
        return;
      }
    }
    if (slug === currentSlug && !anchor) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    location.hash = `#/${slug}${anchor ? '::' + anchor : ''}`;
  }

  window.addEventListener('hashchange', () => {
    const { slug, anchor } = parseHash();
    renderPage(slug, { anchor });
  });

  /* ---------- search ---------- */
  function ensureSearchIndex() {
    if (!searchIndex) buildSearchIndex();
  }

  function snippet(text, terms) {
    if (!terms.length) return text.slice(0, 140);
    const lower = text.toLowerCase();
    let at = -1;
    for (const t of terms) {
      const i = lower.indexOf(t);
      if (i >= 0 && (at < 0 || i < at)) at = i;
    }
    if (at < 0) return text.slice(0, 140);
    const start = Math.max(0, at - 55);
    let out = text.slice(start, start + 180).trim();
    if (start > 0) out = '…' + out;
    if (start + 180 < text.length) out += '…';
    return out;
  }

  function highlight(text, terms) {
    let out = escapeHtml(text);
    for (const term of terms) {
      if (!term) continue;
      const re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      out = out.replace(re, '<mark>$1</mark>');
    }
    return out;
  }

  function runSearch(query) {
    ensureSearchIndex();
    const q = query.trim().toLowerCase();
    searchActive = -1;
    if (q.length < 2) { hideSearch(); return; }
    const terms = [...new Set(q.split(/\s+/).filter(t => t.length > 1))];
    const scored = [];
    for (const page of searchIndex) {
      const title = page.title.toLowerCase();
      const sec = (page.sectionTitle || '').toLowerCase();
      const text = page.lower;
      let score = 0;
      let all = true;
      for (const t of terms) {
        let s = 0;
        if (title.includes(t)) s += 12;
        if (sec.includes(t)) s += 4;
        const count = text.split(t).length - 1;
        if (count) s += Math.min(8, 2 + Math.log2(count + 1));
        if (!s) all = false;
        score += s;
      }
      if (!all) continue;
      scored.push({ page, score });
    }
    scored.sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title));
    const top = scored.slice(0, 18);
    if (!top.length) {
      els.results.innerHTML = `<div class="search-empty">${T.noResults(escapeHtml(query))}</div>`;
      els.results.hidden = false;
      return;
    }
    const frag = document.createDocumentFragment();
    const head = document.createElement('div');
    head.className = 'sr-head';
    head.textContent = T.results(scored.length);
    frag.appendChild(head);
    top.forEach(({ page }) => {
      const a = document.createElement('a');
      a.className = 'search-result';
      a.href = `#/${page.slug}`;
      a.dataset.slug = page.slug;
      a.setAttribute('role', 'option');
      const snip = snippet(page.text, terms);
      a.innerHTML = `<span class="sr-title"><span>${highlight(page.title, terms)}</span><span class="sr-sec">${escapeHtml(page.sectionTitle || '')}</span></span>
        <span class="sr-snippet">${highlight(snip, terms)}</span>`;
      a.addEventListener('click', ev => {
        ev.preventDefault();
        go(page.slug);
        els.search.value = '';
        hideSearch();
      });
      frag.appendChild(a);
    });
    els.results.replaceChildren(frag);
    els.results.hidden = false;
  }

  function hideSearch() {
    els.results.hidden = true;
    els.results.innerHTML = '';
    searchActive = -1;
  }

  function moveSearch(delta) {
    const items = $$('.search-result', els.results);
    if (!items.length) return;
    searchActive = (searchActive + delta + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle('active', i === searchActive));
    items[searchActive].scrollIntoView({ block: 'nearest' });
  }

  let searchTimer = null;
  els.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(els.search.value), 110);
  });
  els.search.addEventListener('focus', () => {
    if (els.search.value.trim().length >= 2) runSearch(els.search.value);
  });
  els.search.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { els.search.value = ''; hideSearch(); els.search.blur(); }
    else if (ev.key === 'ArrowDown') { ev.preventDefault(); moveSearch(1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); moveSearch(-1); }
    else if (ev.key === 'Enter') {
      const items = $$('.search-result', els.results);
      if (items.length) {
        ev.preventDefault();
        (items[searchActive] || items[0]).click();
      }
    }
  });

  document.addEventListener('click', (ev) => {
    if (!ev.target.closest('.search-wrap')) hideSearch();
  });

  /* ---------- global keyboard ---------- */
  document.addEventListener('keydown', (ev) => {
    const tag = (ev.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.key === '/') {
      ev.preventDefault();
      els.search.focus();
      els.search.select();
    }
  });

  /* ---------- sidebar mobile ---------- */
  function openSidebar() {
    els.sidebar.classList.add('open');
    els.scrim.hidden = false;
    els.menuToggle.setAttribute('aria-expanded', 'true');
  }
  function closeSidebar() {
    els.sidebar.classList.remove('open');
    els.scrim.hidden = true;
    els.menuToggle.setAttribute('aria-expanded', 'false');
  }
  els.menuToggle?.addEventListener('click', () => {
    if (els.sidebar.classList.contains('open')) closeSidebar(); else openSidebar();
  });
  els.scrim?.addEventListener('click', closeSidebar);

  /* ---------- scroll fx ---------- */
  function onScroll() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0;
    if (els.progress) els.progress.style.width = pct + '%';
    els.backTop.classList.toggle('show', window.scrollY > 600);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  els.backTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ---------- download ---------- */
  const downloadLink = $('a[download]');
  downloadLink?.addEventListener('click', (ev) => {
    ev.preventDefault();
    if (!currentSlug) return;
    const md = DATA.content[currentSlug] || '';
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentSlug.replace(/\//g, '-') + '.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });

  /* ---------- boot ---------- */
  renderSidebar();
  ensureSearchIndex();
  if (els.generated) els.generated.textContent = new Date(DATA.generated).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  const initial = parseHash();
  renderPage(initial.slug, { anchor: initial.anchor, push: false });
  onScroll();
})();
