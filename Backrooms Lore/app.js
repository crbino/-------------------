// ============================================================
// THE BACKROOMS — Interactive Lore Archive — Application Logic
// ============================================================

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────
  const state = {
    currentTab: 'levels',
    currentItem: null,
    searchQuery: '',
    dangerFilter: 'all',
    audioEnabled: false,
    audioCtx: null,
    audioNodes: null
  };

  // ── DOM References ─────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    listView: $('#list-view'),
    detailView: $('#detail-view'),
    content: $('#content'),
    searchInput: $('#search-input'),
    noclipBtn: $('#noclip-btn'),
    noclipOverlay: $('#noclip-overlay'),
    audioToggle: $('#audio-toggle'),
    audioIcon: $('#audio-icon')
  };

  // ── Data Access ────────────────────────────────────────────
  const DATA = window.BACKROOMS_DATA;

  function getData(category) {
    return DATA[category] || [];
  }

  function getItemById(category, id) {
    return getData(category).find(item => item.id === id);
  }

  function findItemGlobal(id) {
    for (const cat of ['levels', 'entities', 'groups', 'objects']) {
      const item = getItemById(cat, id);
      if (item) return { category: cat, item };
    }
    return null;
  }

  // ── Classification Labels ──────────────────────────────────
  const dangerLabels = {
    1: 'Safe',
    2: 'Caution',
    3: 'Unsafe',
    4: 'Hostile',
    5: 'Deadzone'
  };

  const dangerClasses = {
    1: 'badge-safe',
    2: 'badge-caution',
    3: 'badge-unsafe',
    4: 'badge-hostile',
    5: 'badge-deadzone'
  };

  // ── Utility ────────────────────────────────────────────────
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function truncate(str, len) {
    if (str.length <= len) return str;
    return str.slice(0, len).trim() + '...';
  }

  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // ── Routing ────────────────────────────────────────────────
  function parseHash() {
    const hash = location.hash.slice(1); // remove #
    if (!hash) return { tab: 'levels', id: null };

    const parts = hash.split('/');
    const tab = parts[0] || 'levels';
    const id = parts[1] || null;
    return { tab, id };
  }

  function setHash(tab, id) {
    if (id) {
      location.hash = `#${tab}/${id}`;
    } else {
      location.hash = `#${tab}`;
    }
  }

  function handleRoute() {
    const { tab, id } = parseHash();

    // Update tab
    if (['levels', 'entities', 'groups', 'objects'].includes(tab)) {
      state.currentTab = tab;
    }
    state.currentItem = id;

    // Update tab UI
    $$('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === state.currentTab);
    });

    // Glitch transition
    dom.content.classList.add('glitch-transition');
    setTimeout(() => dom.content.classList.remove('glitch-transition'), 350);

    // Render
    if (state.currentItem) {
      renderDetailView(state.currentTab, state.currentItem);
    } else {
      renderListView(state.currentTab);
    }
  }

  // ── Filtering ──────────────────────────────────────────────
  function getFilteredData(category) {
    let items = getData(category);

    // Search filter
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      items = items.filter(item => {
        const searchFields = [
          item.name,
          item.subtitle || '',
          item.fullName || '',
          item.description || '',
          ...(item.tags || [])
        ].join(' ').toLowerCase();
        return searchFields.includes(q);
      });
    }

    // Danger filter
    if (state.dangerFilter !== 'all') {
      const level = parseInt(state.dangerFilter);
      items = items.filter(item => item.danger === level);
    }

    return items;
  }

  // ── Render: List View ──────────────────────────────────────
  function renderListView(category) {
    dom.listView.classList.remove('hidden');
    dom.detailView.classList.add('hidden');

    const items = getFilteredData(category);

    if (items.length === 0) {
      dom.listView.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">∅</div>
          <div class="empty-state-text">No results found in the void...</div>
        </div>
      `;
      return;
    }

    dom.listView.innerHTML = items.map(item => renderCard(item, category)).join('');

    // Attach click handlers
    dom.listView.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', () => {
        setHash(category, card.dataset.id);
      });
    });
  }

  function renderCard(item, category) {
    const danger = item.danger || 0;
    const subtitle = item.subtitle || item.fullName || '';
    const excerpt = truncate(item.description || '', 150);
    const classification = item.classification || item.alignment || dangerLabels[danger] || '';
    const tags = (item.tags || []).slice(0, 4);

    // For groups, use alignment instead of danger
    const dangerClass = item.alignment
      ? ''
      : `danger-${danger}`;

    const alignClass = item.alignment
      ? `alignment-${item.alignment.toLowerCase()}`
      : '';

    return `
      <div class="card ${dangerClass}" data-id="${item.id}">
        <div class="card-visual" style="background: ${item.visual && item.visual.bg ? item.visual.bg : 'linear-gradient(135deg, #1a1a1a, #2a2a2a)'}">
          <span class="card-visual-icon">${item.visual && item.visual.icon ? item.visual.icon : ''}</span>
        </div>
        <div class="card-header">
          <div>
            <div class="card-title">${escapeHtml(item.name)}</div>
            ${subtitle ? `<div class="card-subtitle">${escapeHtml(subtitle)}</div>` : ''}
          </div>
          ${item.alignment
            ? `<span class="alignment-badge ${alignClass}">${escapeHtml(item.alignment)}</span>`
            : danger
              ? `<span class="danger-badge">${escapeHtml(classification)}</span>`
              : ''
          }
        </div>
        <div class="card-excerpt">${escapeHtml(excerpt)}</div>
        ${tags.length ? `
          <div class="card-tags">
            ${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  // ── Render: Detail View ────────────────────────────────────
  function renderDetailView(category, id) {
    const item = getItemById(category, id);
    if (!item) {
      setHash(category, null);
      return;
    }

    dom.listView.classList.add('hidden');
    dom.detailView.classList.remove('hidden');

    let html = '';

    // Back button
    html += `<button class="detail-back" id="back-btn">← Back to ${category}</button>`;

    // Visual banner
    html += `<div class="detail-visual" style="background: ${item.visual && item.visual.bg ? item.visual.bg : 'linear-gradient(135deg, #1a1a1a, #2a2a2a)'}">`;
    html += `<span class="detail-visual-icon">${item.visual && item.visual.icon ? item.visual.icon : ''}</span>`;
    html += `</div>`;

    // Header
    const subtitle = item.subtitle || item.fullName || '';
    const danger = item.danger || 0;
    const classification = item.classification || item.alignment || dangerLabels[danger] || '';

    html += `<div class="detail-header">`;
    html += `<div class="detail-title">${escapeHtml(item.name)}</div>`;
    if (subtitle) html += `<div class="detail-subtitle">${escapeHtml(subtitle)}</div>`;
    html += `<div class="detail-meta">`;

    if (item.alignment) {
      const alignClass = `alignment-${item.alignment.toLowerCase()}`;
      html += `<span class="alignment-badge ${alignClass}">${escapeHtml(item.alignment)}</span>`;
    } else if (danger) {
      html += `<span class="danger-badge ${dangerClasses[danger] || ''}">${escapeHtml(classification)}</span>`;
    }

    if (item.environment) {
      html += `<span class="env-tag">${escapeHtml(item.environment)}</span>`;
    }

    if (item.tags) {
      item.tags.forEach(t => {
        html += `<span class="tag">${escapeHtml(t)}</span>`;
      });
    }

    html += `</div>`; // meta

    if (danger) {
      html += `<div class="detail-danger-bar danger-${danger}"></div>`;
    }

    html += `</div>`; // header

    // Description
    html += `<div class="detail-section">`;
    html += `<div class="detail-section-title">Description</div>`;
    html += `<div class="detail-description">${escapeHtml(item.description || '')}</div>`;
    html += `</div>`;

    // History
    if (item.history) {
      html += `<div class="detail-section">`;
      html += `<div class="detail-section-title">History</div>`;
      html += `<div class="detail-history">${escapeHtml(item.history)}</div>`;
      html += `</div>`;
    }

    // Atmosphere
    if (item.atmosphere) {
      html += `<div class="detail-section">`;
      html += `<div class="detail-section-title">Atmosphere</div>`;
      html += `<div class="detail-atmosphere">${escapeHtml(item.atmosphere)}</div>`;
      html += `</div>`;
    }

    // Origin
    if (item.origin) {
      html += `<div class="detail-section">`;
      html += `<div class="detail-section-title">Origin</div>`;
      html += `<div class="detail-origin">${escapeHtml(item.origin)}</div>`;
      html += `</div>`;
    }

    // Info grid
    if (item.environment || item.danger || item.classification) {
      html += `<div class="detail-section">`;
      html += `<div class="detail-section-title">Classification</div>`;
      html += `<div class="detail-info-grid">`;
      if (item.environment) {
        html += `<div class="info-item"><span class="info-label">Environment</span><span class="info-value">${escapeHtml(item.environment)}</span></div>`;
      }
      if (item.danger) {
        html += `<div class="info-item"><span class="info-label">Danger Level</span><span class="info-value">${escapeHtml(dangerLabels[item.danger] || String(item.danger))}</span></div>`;
      }
      if (item.classification) {
        html += `<div class="info-item"><span class="info-label">Classification</span><span class="info-value">${escapeHtml(item.classification)}</span></div>`;
      }
      if (item.alignment) {
        html += `<div class="info-item"><span class="info-label">Alignment</span><span class="info-value">${escapeHtml(item.alignment)}</span></div>`;
      }
      html += `</div>`;
      html += `</div>`;
    }

    // Behavior (entities)
    if (item.behavior) {
      html += `<div class="detail-section">`;
      html += `<div class="detail-section-title">Behavior</div>`;
      html += `<div class="detail-description">${escapeHtml(item.behavior)}</div>`;
      html += `</div>`;
    }

    // Effects (objects)
    if (item.effects) {
      html += `<div class="detail-section">`;
      html += `<div class="detail-section-title">Effects</div>`;
      html += `<div class="detail-description">${escapeHtml(item.effects)}</div>`;
      html += `</div>`;
    }

    // Goals (groups)
    if (item.goals) {
      html += `<div class="detail-section">`;
      html += `<div class="detail-section-title">Goals</div>`;
      html += `<div class="detail-description">${escapeHtml(item.goals)}</div>`;
      html += `</div>`;
    }

    // Survival tips
    if (item.survivalTips && item.survivalTips.length) {
      html += `<div class="detail-section">`;
      html += `<div class="detail-section-title">Survival Guide</div>`;
      html += `<ul class="detail-tips">`;
      item.survivalTips.forEach(tip => {
        html += `<li>${escapeHtml(tip)}</li>`;
      });
      html += `</ul></div>`;
    }

    // Connections (levels)
    if (item.connections && item.connections.length) {
      html += `<div class="detail-section">`;
      html += `<div class="detail-section-title">Connected Levels</div>`;
      html += `<div class="connection-list" id="connection-chips">`;
      item.connections.forEach(connId => {
        const conn = getItemById('levels', connId);
        const label = conn ? conn.name : connId;
        html += `<button class="connection-chip" data-target="${connId}">${escapeHtml(label)}</button>`;
      });
      html += `</div>`;
      // Mini map
      html += renderConnectionMap(item);
      html += `</div>`;
    }

    // Found in (entities, objects)
    if (item.foundIn && item.foundIn.length) {
      html += `<div class="detail-section">`;
      html += `<div class="detail-section-title">Found In</div>`;
      html += `<div class="connection-list" id="found-in-chips">`;
      item.foundIn.forEach(levelId => {
        const level = getItemById('levels', levelId);
        const label = level ? level.name : levelId;
        html += `<button class="connection-chip" data-target="${levelId}">${escapeHtml(label)}</button>`;
      });
      html += `</div></div>`;
    }

    // Operates in (groups)
    if (item.operatesIn && item.operatesIn.length) {
      html += `<div class="detail-section">`;
      html += `<div class="detail-section-title">Operates In</div>`;
      html += `<div class="connection-list" id="operates-chips">`;
      item.operatesIn.forEach(levelId => {
        const level = getItemById('levels', levelId);
        const label = level ? level.name : levelId;
        html += `<button class="connection-chip" data-target="${levelId}">${escapeHtml(label)}</button>`;
      });
      html += `</div></div>`;
    }

    dom.detailView.innerHTML = html;

    // Event: back button
    const backBtn = dom.detailView.querySelector('#back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => setHash(state.currentTab, null));
    }

    // Event: connection chips
    dom.detailView.querySelectorAll('.connection-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const targetId = chip.dataset.target;
        setHash('levels', targetId);
      });
    });
  }

  // ── Connection Map (SVG) ───────────────────────────────────
  function renderConnectionMap(item) {
    const connections = item.connections || [];
    if (connections.length === 0) return '';

    const width = 600;
    const height = 260;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 50;

    let svg = `<div class="connection-map"><svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

    // Draw lines from center to each connected level
    connections.forEach((connId, i) => {
      const angle = (2 * Math.PI * i) / connections.length - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);

      svg += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#2a2a1a" stroke-width="1" stroke-dasharray="4,4"/>`;
    });

    // Draw connected level nodes
    connections.forEach((connId, i) => {
      const conn = getItemById('levels', connId);
      const label = conn ? conn.name : connId;
      const danger = conn ? conn.danger : 0;
      const colors = {
        1: '#4a9', 2: '#ca4', 3: '#e83', 4: '#d33', 5: '#a3f'
      };
      const color = colors[danger] || '#555';

      const angle = (2 * Math.PI * i) / connections.length - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);

      svg += `<circle cx="${x}" cy="${y}" r="6" fill="${color}" opacity="0.7"/>`;
      svg += `<circle cx="${x}" cy="${y}" r="6" fill="none" stroke="${color}" stroke-width="1" opacity="0.4"/>`;
      svg += `<text x="${x}" y="${y + 20}" fill="#8a8a6a" font-family="'Courier New', monospace" font-size="10" text-anchor="middle">${escapeHtml(label)}</text>`;
    });

    // Center node
    const itemDanger = item.danger || 0;
    const centerColors = { 1: '#4a9', 2: '#ca4', 3: '#e83', 4: '#d33', 5: '#a3f' };
    const centerColor = centerColors[itemDanger] || '#c4a84a';

    svg += `<circle cx="${cx}" cy="${cy}" r="12" fill="${centerColor}" opacity="0.8"/>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="18" fill="none" stroke="${centerColor}" stroke-width="1" opacity="0.3"/>`;
    svg += `<circle cx="${cx}" cy="${cy}" r="24" fill="none" stroke="${centerColor}" stroke-width="0.5" opacity="0.15"/>`;
    svg += `<text x="${cx}" y="${cy - 28}" fill="#d4c87a" font-family="'Courier New', monospace" font-size="11" text-anchor="middle" font-weight="bold">${escapeHtml(item.name)}</text>`;

    svg += `</svg></div>`;
    return svg;
  }

  // ── Tab Counts ─────────────────────────────────────────────
  function updateCounts() {
    ['levels', 'entities', 'groups', 'objects'].forEach(cat => {
      const countEl = $(`#count-${cat}`);
      if (countEl) countEl.textContent = getData(cat).length;
    });
  }

  // ── Navigation Setup ───────────────────────────────────────
  function setupNavigation() {
    $$('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        state.searchQuery = '';
        state.dangerFilter = 'all';
        dom.searchInput.value = '';
        resetDangerFilter();
        setHash(tab, null);
      });
    });

    window.addEventListener('hashchange', handleRoute);
  }

  // ── Search Setup ───────────────────────────────────────────
  function setupSearch() {
    dom.searchInput.addEventListener('input', debounce(() => {
      state.searchQuery = dom.searchInput.value.trim();
      if (!state.currentItem) {
        renderListView(state.currentTab);
      }
    }, 200));

    // Enter key triggers search immediately
    dom.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        state.searchQuery = dom.searchInput.value.trim();
        if (state.currentItem) {
          setHash(state.currentTab, null);
        } else {
          renderListView(state.currentTab);
        }
      }
    });
  }

  // ── Danger Filter Setup ────────────────────────────────────
  function setupDangerFilter() {
    $$('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.dangerFilter = btn.dataset.danger;
        if (!state.currentItem) {
          renderListView(state.currentTab);
        }
      });
    });
  }

  function resetDangerFilter() {
    $$('.filter-btn').forEach(b => b.classList.remove('active'));
    const allBtn = $('.filter-btn[data-danger="all"]');
    if (allBtn) allBtn.classList.add('active');
    state.dangerFilter = 'all';
  }

  // ── Noclip Button ──────────────────────────────────────────
  function setupNoclip() {
    dom.noclipBtn.addEventListener('click', () => {
      const levels = getData('levels');
      const randomLevel = levels[Math.floor(Math.random() * levels.length)];

      // Show overlay
      dom.noclipOverlay.classList.remove('hidden');
      dom.noclipOverlay.classList.add('active');

      setTimeout(() => {
        setHash('levels', randomLevel.id);
        setTimeout(() => {
          dom.noclipOverlay.classList.remove('active');
          dom.noclipOverlay.classList.add('hidden');
        }, 600);
      }, 900);
    });
  }

  // ── Ambient Audio (Web Audio API) ──────────────────────────
  function setupAudio() {
    dom.audioToggle.addEventListener('click', () => {
      if (!state.audioEnabled) {
        startAudio();
      } else {
        stopAudio();
      }
    });
  }

  function startAudio() {
    try {
      if (!state.audioCtx) {
        state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }

      if (state.audioCtx.state === 'suspended') {
        state.audioCtx.resume();
      }

      const ctx = state.audioCtx;

      // 60Hz base hum
      const osc1 = ctx.createOscillator();
      osc1.frequency.value = 60;
      osc1.type = 'sine';
      const gain1 = ctx.createGain();
      gain1.gain.value = 0.06;

      // 120Hz harmonic
      const osc2 = ctx.createOscillator();
      osc2.frequency.value = 120;
      osc2.type = 'sine';
      const gain2 = ctx.createGain();
      gain2.gain.value = 0.03;

      // 4kHz fluorescent buzz
      const osc3 = ctx.createOscillator();
      osc3.frequency.value = 4000;
      osc3.type = 'sawtooth';
      const gain3 = ctx.createGain();
      gain3.gain.value = 0.005;

      // Low rumble
      const osc4 = ctx.createOscillator();
      osc4.frequency.value = 30;
      osc4.type = 'sine';
      const gain4 = ctx.createGain();
      gain4.gain.value = 0.04;

      // Master gain for fade in/out
      const master = ctx.createGain();
      master.gain.value = 0;
      master.gain.linearRampToValueAtTime(1, ctx.currentTime + 1);

      osc1.connect(gain1).connect(master);
      osc2.connect(gain2).connect(master);
      osc3.connect(gain3).connect(master);
      osc4.connect(gain4).connect(master);
      master.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc3.start();
      osc4.start();

      state.audioNodes = { osc1, osc2, osc3, osc4, master };
      state.audioEnabled = true;
      dom.audioIcon.textContent = '🔊';
      dom.audioToggle.classList.add('active');
    } catch (e) {
      console.warn('Audio not supported:', e);
    }
  }

  function stopAudio() {
    if (state.audioNodes) {
      const { osc1, osc2, osc3, osc4, master } = state.audioNodes;
      const ctx = state.audioCtx;

      // Fade out
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

      setTimeout(() => {
        try {
          osc1.stop();
          osc2.stop();
          osc3.stop();
          osc4.stop();
        } catch (e) { /* already stopped */ }
        state.audioNodes = null;
      }, 600);
    }

    state.audioEnabled = false;
    dom.audioIcon.textContent = '🔇';
    dom.audioToggle.classList.remove('active');
  }

  // ── Dust Particle System ───────────────────────────────────
  function initDustParticles() {
    const canvas = $('#dust-canvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animId;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    function createParticles() {
      particles = [];
      const count = Math.min(70, Math.floor((canvas.width * canvas.height) / 20000));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: Math.random() * 0.2 + 0.05,
          size: Math.random() * 2 + 0.5,
          opacity: Math.random() * 0.25 + 0.05
        });
      }
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y > canvas.height) {
          p.y = 0;
          p.x = Math.random() * canvas.width;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(196, 168, 74, ${p.opacity})`;
        ctx.fill();
      });

      animId = requestAnimationFrame(animate);
    }

    resize();
    createParticles();
    animate();

    window.addEventListener('resize', () => {
      resize();
      createParticles();
    });

    // Respect reduced motion
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      cancelAnimationFrame(animId);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    mq.addEventListener('change', () => {
      if (mq.matches) {
        cancelAnimationFrame(animId);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        animate();
      }
    });
  }

  // ── Initialize ─────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    updateCounts();
    setupNavigation();
    setupSearch();
    setupDangerFilter();
    setupNoclip();
    setupAudio();
    initDustParticles();
    handleRoute();
  });

})();
