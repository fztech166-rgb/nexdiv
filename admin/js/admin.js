// ============================================================
// admin/js/admin.js — Upgraded Administrative Dashboards Logic
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initAuthGate();
  initPushNotifications();
  setupSyncListeners();
});

// ── Web Audio API Notification Synthesizer ──────────────────
function playNotificationChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const playTone = (freq, time, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.2, time + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.start(time);
      osc.stop(time + dur);
    };
    // Double ding chime
    playTone(587.33, ctx.currentTime, 0.25); // D5
    playTone(880.00, ctx.currentTime + 0.12, 0.4); // A5
  } catch (e) {
    console.warn('Failed to synthesize chime audio:', e);
  }
}

// ── Web Push Notifications Controller ────────────────────────
function initPushNotifications() {
  const banner = document.getElementById('push-permission-banner');
  const btn = document.getElementById('btn-request-push');

  if (!banner || !btn) return;

  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      banner.style.display = 'block';
      btn.addEventListener('click', async () => {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          banner.style.display = 'none';
          showToast('Desktop notifications enabled!');
        }
      });
    }
  }
}

function triggerDesktopNotification(title, text) {
  playNotificationChime();
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: text,
      icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"%3E%3Cpath fill="%236dffe0" d="M96 96h80v160l160-160h112v320h-80V256L208 416H96z"/%3E%3C/svg%3E'
    });
  } else {
    showToast(`${title}: ${text}`, 'info');
  }
}

// Listen for LocalStorage updates from other browser tabs
function setupSyncListeners() {
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('nexdiv_db_')) {
      const table = e.key.replace('nexdiv_db_', '');
      
      // Filter out standard non-inbox events to prevent spam
      if (['bookings', 'orders', 'contact_messages', 'newsletter'].includes(table)) {
        let name = 'Someone';
        try {
          const rows = JSON.parse(e.newValue);
          if (rows && rows.length) {
            const latest = rows[rows.length - 1];
            name = latest.name || latest.email || 'Someone';
          }
        } catch(err) {}

        const titles = {
          bookings: 'New Consultation Booking!',
          orders: 'New Project Order Placed!',
          contact_messages: 'New Inbox Message!',
          newsletter: 'New Newsletter Subscriber!'
        };
        const texts = {
          bookings: `${name} requested a strategic meeting.`,
          orders: `${name} placed an order template request.`,
          contact_messages: `${name} sent a contact form entry.`,
          newsletter: `${name} subscribed to email listings.`
        };

        triggerDesktopNotification(titles[table], texts[table]);
        
        // Refresh active section if currently viewed
        const activeLink = document.querySelector('.sidebar-nav a.active');
        if (activeLink && activeLink.dataset.section === table) {
          loadSection(table);
        }
      }
    }
  });

  // Listen to same-tab dynamic events
  window.addEventListener('nexdiv_db_update', (e) => {
    const table = e.detail?.table;
    const activeLink = document.querySelector('.sidebar-nav a.active');
    if (table && activeLink && activeLink.dataset.section === table) {
      loadSection(table);
    }
  });
}

// ── Auth Gate ─────────────────────────────────────────────────
async function initAuthGate() {
  const { data: { session } } = await sb.auth.getSession();

  if (session) {
    showAdminApp(session.user);
  } else {
    showLoginScreen();
  }

  sb.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      showAdminApp(session.user);
    } else {
      showLoginScreen();
    }
  });
}

function showLoginScreen() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('admin-app').style.display    = 'none';
  initLoginForm();
}

function showAdminApp(user) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-app').style.display    = 'flex';
  document.querySelector('.admin-user-email').textContent = user.email;
  initAdminApp();
}

// ── Login Form ────────────────────────────────────────────────
function initLoginForm() {
  const form = document.getElementById('login-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Signing in…';

    const { error } = await sb.auth.signInWithPassword({
      email:    form.email.value.trim(),
      password: form.password.value,
    });

    btn.disabled = false;
    btn.textContent = 'Sign In';

    if (error) {
      document.getElementById('login-error').textContent = error.message;
    }
  });
}

// ── Cache Helper ──────────────────────────────────────────────
async function q(queryFn) {
  const { data, error } = await queryFn();
  if (error) { console.error(error); throw error; }
  return data || [];
}

// ── Admin App Init ────────────────────────────────────────────
function initAdminApp() {
  initSidebar();
  loadSection('dashboard');

  document.querySelector('.admin-logout')?.addEventListener('click', async () => {
    await sb.auth.signOut();
  });
}

// ── Sidebar Navigation ────────────────────────────────────────
function initSidebar() {
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    // Prevent duplicate binding
    link.replaceWith(link.cloneNode(true));
  });

  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-nav a').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      loadSection(link.dataset.section);
    });
  });
}

async function loadSection(name) {
  const main = document.getElementById('admin-main');
  const title = document.getElementById('section-title');

  const sections = {
    dashboard:      { label: 'Dashboard Overview',       fn: renderDashboard },
    settings:       { label: 'Global Content Customizer',fn: renderSettings },
    services:       { label: 'Services Catalog',         fn: renderServicesAdmin },
    portfolio:      { label: 'Portfolio Works Manager',  fn: renderPortfolio },
    upcoming:       { label: 'SaaS Products & Timers',   fn: renderUpcomingProducts },
    domains:        { label: 'Domain Extensions Pricing', fn: renderDomains },
    'admit-cards':  { label: 'Admit Cards',             fn: renderAdmitCards },
    'pending-cats': { label: 'Pending Categories Requests', fn: renderPendingCategories },
    bookings:       { label: 'Meeting Bookings',         fn: renderBookings },
    orders:         { label: 'Customer Orders Inbox',    fn: renderOrders },
    messages:       { label: 'Contact Messages Inbox',   fn: renderMessages },
    newsletter:     { label: 'Newsletter Subscriptions', fn: renderNewsletter },
  };

  const sec = sections[name];
  if (!sec) return;

  title.textContent = sec.label;
  main.innerHTML = '<div class="loading-state"><div class="spinner"></div><span>Loading administrative data…</span></div>';

  try {
    await sec.fn(main);
  } catch (err) {
    main.innerHTML = `<div class="error-state">Error loading section: ${err.message}</div>`;
  }
}

// ════════════════════════════════════════════════════════════════
// 1. DASHBOARD OVERVIEW
// ════════════════════════════════════════════════════════════════
async function renderDashboard(el) {
  const [
    { count: portfolioCount }, 
    { count: bookingsCount }, 
    { count: ordersCount }, 
    { count: upcomingCount }, 
    { count: servicesCount },
    { count: msgCount },
    { count: newsCount }
  ] = await Promise.all([
    sb.from('portfolio').select('*', { count: 'exact', head: true }),
    sb.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('upcoming_products').select('*', { count: 'exact', head: true }),
    sb.from('services').select('*', { count: 'exact', head: true }),
    sb.from('contact_messages').select('*', { count: 'exact', head: true }).eq('status', 'unread'),
    sb.from('newsletter').select('*', { count: 'exact', head: true })
  ]);

  el.innerHTML = `
    <div class="dash-stats">
      <div class="stat-card" style="border-top: 4px solid var(--accent2);">
        <div class="stat-icon">📅</div>
        <div class="stat-value">${bookingsCount ?? 0}</div>
        <div class="stat-label">Pending Bookings</div>
      </div>
      <div class="stat-card" style="border-top: 4px solid var(--accent);">
        <div class="stat-icon">🛒</div>
        <div class="stat-value">${ordersCount ?? 0}</div>
        <div class="stat-label">Pending Orders</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⏳</div>
        <div class="stat-value">${upcomingCount ?? 0}</div>
        <div class="stat-label">Upcoming SaaS</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🔧</div>
        <div class="stat-value">${servicesCount ?? 0}</div>
        <div class="stat-label">Services</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🗂</div>
        <div class="stat-value">${portfolioCount ?? 0}</div>
        <div class="stat-label">Portfolio Items</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📧</div>
        <div class="stat-value">${newsCount ?? 0}</div>
        <div class="stat-label">Subscribers</div>
      </div>
    </div>
    <div class="dash-welcome">
      <h2>Welcome back to Nexdiv control panels 👋</h2>
      <p>Manage customer orders, newsletters, consultation bookings, domain extension price tags, and upcoming release clocks live from this unified console.</p>
    </div>`;
}

// ════════════════════════════════════════════════════════════════
// 2. GLOBAL CONTENT SETTINGS
// ════════════════════════════════════════════════════════════════
async function renderSettings(el) {
  const cfg = await fetchSettings();

  const fields = [
    { key: 'hero_title',      label: 'Hero Title',        type: 'text' },
    { key: 'hero_subtitle',   label: 'Hero Subtitle',     type: 'textarea' },
    { key: 'hero_cta_text',   label: 'CTA Button Text',   type: 'text' },
    { key: 'hero_cta_link',   label: 'CTA Button Link',   type: 'text' },
    { key: 'hero_image_url',  label: 'Hero Banner Image URL', type: 'text' },
    { key: 'whatsapp_number', label: 'WhatsApp CTA Target Phone Number', type: 'text' },
    { key: 'whatsapp_default_msg', label: 'WhatsApp Default Message Text', type: 'textarea' },
    { key: 'contact_email',   label: 'Contact Email Address', type: 'email' },
    { key: 'footer_tagline',  label: 'Footer License Tagline', type: 'text' }
  ];

  const rows = fields.map(f => `
    <div class="form-row">
      <label class="form-label" for="s_${f.key}">${f.label}</label>
      ${f.type === 'textarea'
        ? `<textarea class="form-control" id="s_${f.key}" name="${f.key}" rows="3">${cfg[f.key] || ''}</textarea>`
        : `<input class="form-control" type="${f.type}" id="s_${f.key}" name="${f.key}" value="${cfg[f.key] || ''}">`}
    </div>`).join('');

  el.innerHTML = `
    <div class="panel">
      <h3 class="panel-title">Global Landing Pages Customizer</h3>
      <div class="panel-body">
        
        <!-- Upload Banner Row with Explicit Size Guidance -->
        <div id="settings-upload-row" class="form-row" style="background:rgba(255,255,255,0.01); border:1px dashed var(--border); padding:20px; border-radius:8px; margin-bottom:24px;">
          <label class="form-label" style="color:var(--accent2)">Upload Hero Banner Image</label>
          <span style="font-size:0.78rem; color:var(--muted); display:block; margin:-4px 0 12px 0;">
            Constraints: <strong>Recommended Size: 1920x1080 px, Max 2MB, formats: PNG/JPG/WEBP</strong>
          </span>
          <div style="display:flex; gap:12px; align-items:center;">
            <input type="file" id="hero-image-upload" class="form-control" accept="image/*" style="padding:7px;">
            <button class="btn btn-secondary" id="upload-hero-btn">Upload Asset</button>
          </div>
        </div>

        <div id="settings-fields">${rows}</div>
        <button class="btn btn-primary" id="save-settings-btn" style="margin-top:12px;">Save Global Settings</button>
      </div>
    </div>`;

  document.getElementById('upload-hero-btn').addEventListener('click', async () => {
    const file = document.getElementById('hero-image-upload').files[0];
    if (!file) { showToast('Choose an image first', 'error'); return; }
    showToast('Uploading asset…', 'info');
    const url = await uploadFile(file, 'hero');
    if (url) {
      document.getElementById('s_hero_image_url').value = url;
      showToast('Banner image uploaded!');
    }
  });

  document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const updates = fields.map(f => ({
      key: f.key,
      value: document.getElementById(`s_${f.key}`).value,
    }));

    const btn = document.getElementById('save-settings-btn');
    btn.disabled = true; btn.textContent = 'Saving settings…';

    const { error } = await sb.from('settings').upsert(
      updates.map(u => ({ ...u, updated_at: new Date().toISOString() })),
      { onConflict: 'key' }
    );

    btn.disabled = false; btn.textContent = 'Save Global Settings';
    showToast(error ? error.message : 'Global parameters configured!', error ? 'error' : 'success');
  });
}

// ════════════════════════════════════════════════════════════════
// 3. SERVICES MANAGER
// ════════════════════════════════════════════════════════════════
async function renderServicesAdmin(el) {
  const items = await q(() => sb.from('services').select('*').order('sort_order'));

  el.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h3 class="panel-title">Active Service Items</h3>
        <button class="btn btn-primary" id="add-service-btn">+ Add Service Card</button>
      </div>
      <div class="panel-body">
        <div id="services-table-wrap">${buildServicesTable(items)}</div>
      </div>
    </div>
    <div id="service-modal" class="modal" style="display:none"></div>`;

  document.getElementById('add-service-btn').addEventListener('click', () => openServiceModal());
  attachServiceTableListeners();
}

function buildServicesTable(items) {
  if (!items?.length) return '<p class="empty-state">No services registered yet.</p>';
  const rows = items.map(i => `
    <tr data-id="${i.id}">
      <td>${i.icon || '◆'}</td>
      <td><strong>${i.title}</strong></td>
      <td>Order: ${i.sort_order}</td>
      <td><span class="badge ${i.status === 'published' ? 'badge-green' : 'badge-grey'}">${i.status}</span></td>
      <td class="td-actions">
        <button class="btn btn-sm btn-secondary edit-service" data-id="${i.id}">Edit</button>
        <button class="btn btn-sm btn-danger delete-service" data-id="${i.id}">Delete</button>
      </td>
    </tr>`).join('');
  return `<table class="admin-table">
    <thead><tr><th>Icon</th><th>Service Title</th><th>Sorting</th><th>State</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function attachServiceTableListeners() {
  document.querySelectorAll('.edit-service').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { data } = await sb.from('services').select('*').eq('id', btn.dataset.id).single();
      if (data) openServiceModal(data);
    });
  });

  document.querySelectorAll('.delete-service').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this service permanently?')) return;
      const { error } = await sb.from('services').delete().eq('id', btn.dataset.id);
      showToast(error ? error.message : 'Service card deleted.', error ? 'error' : 'success');
      if (!error) { loadSection('services'); }
    });
  });
}

function openServiceModal(item = null) {
  const isEdit = !!item;
  const modal  = document.getElementById('service-modal');

  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3>${isEdit ? 'Edit Service Details' : 'Add New Service'}</h3>
        <button class="modal-close" id="close-svc-modal">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label class="form-label">Service Title *</label>
          <input class="form-control" id="svc-title" type="text" value="${item?.title || ''}">
        </div>
        <div class="form-row">
          <label class="form-label">Short Description *</label>
          <textarea class="form-control" id="svc-desc" rows="3">${item?.description || ''}</textarea>
        </div>
        <div class="form-grid-2">
          <div class="form-row">
            <label class="form-label">Icon (emoji)</label>
            <input class="form-control" id="svc-icon" type="text" value="${item?.icon || '◆'}" placeholder="🌐">
          </div>
          <div class="form-row">
            <label class="form-label">Order Priority</label>
            <input class="form-control" id="svc-order" type="number" value="${item?.sort_order ?? 0}">
          </div>
        </div>
        <div class="form-row">
          <label class="form-label">Publication Status</label>
          <select class="form-control" id="svc-status">
            <option ${item?.status === 'published' ? 'selected' : ''}>published</option>
            <option ${item?.status === 'draft' ? 'selected' : ''}>draft</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="close-svc-modal2">Cancel</button>
        <button class="btn btn-primary" id="save-service-btn">${isEdit ? 'Update Card' : 'Create Card'}</button>
      </div>
    </div>`;

  const close = () => { modal.style.display = 'none'; };
  document.getElementById('close-svc-modal').onclick = close;
  document.getElementById('close-svc-modal2').onclick = close;

  document.getElementById('save-service-btn').onclick = async () => {
    const payload = {
      title:       document.getElementById('svc-title').value.trim(),
      description: document.getElementById('svc-desc').value.trim(),
      icon:        document.getElementById('svc-icon').value.trim() || '◆',
      sort_order:  parseInt(document.getElementById('svc-order').value) || 0,
      status:      document.getElementById('svc-status').value,
    };

    if (!payload.title || !payload.description) {
      showToast('Title and description are required.', 'error');
      return;
    }

    const { error } = isEdit
      ? await sb.from('services').update(payload).eq('id', item.id)
      : await sb.from('services').insert(payload);

    showToast(error ? error.message : (isEdit ? 'Service updated!' : 'Service created!'), error ? 'error' : 'success');
    if (!error) { close(); loadSection('services'); }
  };
}

// ════════════════════════════════════════════════════════════════
// 4. PORTFOLIO Works Manager
// ════════════════════════════════════════════════════════════════
async function renderPortfolio(el) {
  const items = await q(() => sb.from('portfolio').select('*').order('sort_order'));

  el.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h3 class="panel-title">Portfolio Catalog</h3>
        <button class="btn btn-primary" id="add-work-btn">+ Add Portfolio Work</button>
      </div>
      <div class="panel-body">
        <div id="portfolio-table-wrap">${buildPortfolioTable(items)}</div>
      </div>
    </div>
    <div id="work-modal" class="modal" style="display:none"></div>`;

  document.getElementById('add-work-btn').addEventListener('click', () => openWorkModal());
  attachPortfolioTableListeners();
}

function buildPortfolioTable(items) {
  if (!items?.length) return '<p class="empty-state">No portfolio items registered yet.</p>';
  const rows = items.map(i => `
    <tr data-id="${i.id}">
      <td><strong>${i.title}</strong></td>
      <td><span class="badge badge-web">${i.category}</span></td>
      <td><span class="badge ${i.status === 'published' ? 'badge-green' : 'badge-grey'}">${i.status}</span></td>
      <td>${i.featured ? '⭐' : '—'}</td>
      <td class="td-actions">
        <button class="btn btn-sm btn-secondary edit-work" data-id="${i.id}">Edit</button>
        <button class="btn btn-sm btn-danger delete-work" data-id="${i.id}">Delete</button>
      </td>
    </tr>`).join('');
  return `<table class="admin-table">
    <thead><tr><th>Project Title</th><th>Category Class</th><th>State</th><th>Featured</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function attachPortfolioTableListeners() {
  document.querySelectorAll('.edit-work').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { data } = await sb.from('portfolio').select('*').eq('id', btn.dataset.id).single();
      if (data) openWorkModal(data);
    });
  });

  document.querySelectorAll('.delete-work').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this portfolio project permanently?')) return;
      const { error } = await sb.from('portfolio').delete().eq('id', btn.dataset.id);
      showToast(error ? error.message : 'Project deleted.', error ? 'error' : 'success');
      if (!error) { loadSection('portfolio'); }
    });
  });
}

function openWorkModal(item = null) {
  const isEdit = !!item;
  const modal  = document.getElementById('work-modal');

  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3>${isEdit ? 'Edit Portfolio Work' : 'Add New Portfolio Project'}</h3>
        <button class="modal-close" id="close-modal">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label class="form-label">Project Title *</label>
          <input class="form-control" id="w-title" type="text" value="${item?.title || ''}">
        </div>
        <div class="form-row">
          <label class="form-label">Short Description</label>
          <textarea class="form-control" id="w-desc" rows="3">${item?.description || ''}</textarea>
        </div>
        
        <div class="form-grid-2">
          <div class="form-row">
            <label class="form-label">Category Class *</label>
            <select class="form-control" id="w-cat">
              ${['Web','SaaS Platforms','Automations','E-commerce','Tools','Other'].map(c =>
                `<option ${item?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-row">
            <label class="form-label">State</label>
            <select class="form-control" id="w-status">
              <option ${item?.status === 'published' ? 'selected' : ''}>published</option>
              <option ${item?.status === 'draft' ? 'selected' : ''}>draft</option>
            </select>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-row">
            <label class="form-label">Live Preview Demo URL</label>
            <input class="form-control" id="w-url" type="url" value="${item?.live_url || ''}">
          </div>
          <div class="form-row">
            <label class="form-label">Sorting Priority</label>
            <input class="form-control" id="w-order" type="number" value="${item?.sort_order ?? 0}">
          </div>
        </div>

        <div class="form-row">
          <label class="form-label">Tags (comma-separated list)</label>
          <input class="form-control" id="w-tags" type="text" value="${(item?.tags || []).join(', ')}" placeholder="Figma, CSS, Supabase">
        </div>

        <!-- Asset Upload with Size Guidelines -->
        <div class="form-row" style="background:rgba(255,255,255,0.01); border:1px dashed var(--border); padding:16px; border-radius:8px; margin-top:8px;">
          <label class="form-label">Project Cover Image</label>
          <span style="font-size:0.75rem; color:var(--muted); display:block; margin:-4px 0 10px 0;">
            Constraints: <strong>Recommended Size: 800x600 px (4:3 aspect ratio), Max 1MB</strong>
          </span>
          <input type="file" class="form-control" id="w-image-file" accept="image/*" style="padding:6px; margin-bottom:10px;">
          <input class="form-control" id="w-image-url" type="url" placeholder="Or paste absolute image URL link" value="${item?.image_url || ''}">
        </div>

        <div class="form-row form-check" style="margin-top:12px;">
          <input type="checkbox" id="w-featured" ${item?.featured ? 'checked' : ''}>
          <label for="w-featured">Feature on Landing Page</label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="close-modal2">Cancel</button>
        <button class="btn btn-primary" id="save-work-btn">${isEdit ? 'Update Project' : 'Create Project'}</button>
      </div>
    </div>`;

  const close = () => { modal.style.display = 'none'; };
  document.getElementById('close-modal').onclick = close;
  document.getElementById('close-modal2').onclick = close;

  document.getElementById('save-work-btn').onclick = async () => {
    const imageFile = document.getElementById('w-image-file').files[0];
    let imageUrl = document.getElementById('w-image-url').value;

    if (imageFile) {
      showToast('Uploading project image…', 'info');
      imageUrl = await uploadFile(imageFile, 'portfolio') || imageUrl;
    }

    const payload = {
      title:       document.getElementById('w-title').value.trim(),
      description: document.getElementById('w-desc').value.trim(),
      category:    document.getElementById('w-cat').value,
      status:      document.getElementById('w-status').value,
      live_url:    document.getElementById('w-url').value.trim(),
      sort_order:  parseInt(document.getElementById('w-order').value) || 0,
      tags:        document.getElementById('w-tags').value.split(',').map(t => t.trim()).filter(Boolean),
      image_url:   imageUrl,
      featured:    document.getElementById('w-featured').checked,
    };

    if (!payload.title) {
      showToast('Project title is required.', 'error');
      return;
    }

    const { error } = isEdit
      ? await sb.from('portfolio').update(payload).eq('id', item.id)
      : await sb.from('portfolio').insert(payload);

    showToast(error ? error.message : (isEdit ? 'Work updated!' : 'Work created!'), error ? 'error' : 'success');
    if (!error) { close(); loadSection('portfolio'); }
  };
}

// ════════════════════════════════════════════════════════════════
// 5. SAAS & COUNTDOWN PRODUCTS MANAGER
// ════════════════════════════════════════════════════════════════
async function renderUpcomingProducts(el) {
  const items = await q(() => sb.from('upcoming_products').select('*').order('sort_order'));

  el.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h3 class="panel-title">SaaS Products & Countdown Releases</h3>
        <button class="btn btn-primary" id="add-up-btn">+ Add Product Release</button>
      </div>
      <div class="panel-body">
        <div id="upcoming-table-wrap">${buildUpcomingTable(items)}</div>
      </div>
    </div>
    <div id="upcoming-modal" class="modal" style="display:none"></div>`;

  document.getElementById('add-up-btn').addEventListener('click', () => openUpcomingModal());
  attachUpcomingTableListeners();
}

function buildUpcomingTable(items) {
  if (!items?.length) return '<p class="empty-state">No upcoming software registered yet.</p>';
  const rows = items.map(i => `
    <tr data-id="${i.id}">
      <td><strong>${i.title}</strong></td>
      <td><span class="badge badge-mobile">${i.category}</span></td>
      <td><code>${new Date(i.countdown_date).toLocaleString()}</code></td>
      <td><span class="badge badge-orange">${i.status}</span></td>
      <td class="td-actions">
        <button class="btn btn-sm btn-secondary edit-up" data-id="${i.id}">Edit</button>
        <button class="btn btn-sm btn-danger delete-up" data-id="${i.id}">Delete</button>
      </td>
    </tr>`).join('');
  return `<table class="admin-table">
    <thead><tr><th>Product Name</th><th>Classification</th><th>Target Launch Countdown Date</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function attachUpcomingTableListeners() {
  document.querySelectorAll('.edit-up').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { data } = await sb.from('upcoming_products').select('*').eq('id', btn.dataset.id).single();
      if (data) openUpcomingModal(data);
    });
  });

  document.querySelectorAll('.delete-up').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this upcoming release permanently?')) return;
      const { error } = await sb.from('upcoming_products').delete().eq('id', btn.dataset.id);
      showToast(error ? error.message : 'Upcoming product deleted.', error ? 'error' : 'success');
      if (!error) { loadSection('upcoming'); }
    });
  });
}

function openUpcomingModal(item = null) {
  const isEdit = !!item;
  const modal  = document.getElementById('upcoming-modal');

  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3>${isEdit ? 'Edit Upcoming Release' : 'Add New Upcoming Release'}</h3>
        <button class="modal-close" id="close-up-modal">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label class="form-label">Product Name *</label>
          <input class="form-control" id="up-title" type="text" value="${item?.title || ''}">
        </div>
        <div class="form-row">
          <label class="form-label">Short Description</label>
          <textarea class="form-control" id="up-desc" rows="3">${item?.description || ''}</textarea>
        </div>
        <div class="form-grid-2">
          <div class="form-row">
            <label class="form-label">Classification Category</label>
            <select class="form-control" id="up-cat">
              <option ${item?.category === 'SaaS Platforms' ? 'selected' : ''}>SaaS Platforms</option>
              <option ${item?.category === 'E-commerce' ? 'selected' : ''}>E-commerce</option>
              <option ${item?.category === 'Tools' ? 'selected' : ''}>Tools</option>
              <option ${item?.category === 'Other' ? 'selected' : ''}>Other Specialty</option>
            </select>
          </div>
          <div class="form-row">
            <label class="form-label">Countdown Date & Time *</label>
            <input class="form-control" id="up-date" type="datetime-local" value="${item?.countdown_date ? item.countdown_date.substring(0, 16) : ''}">
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-row">
            <label class="form-label">Sorting Weight</label>
            <input class="form-control" id="up-order" type="number" value="${item?.sort_order ?? 0}">
          </div>
          <div class="form-row">
            <label class="form-label">Display Status</label>
            <select class="form-control" id="up-status">
              <option ${item?.status === 'upcoming' ? 'selected' : ''}>upcoming</option>
              <option ${item?.status === 'published' ? 'selected' : ''}>published</option>
            </select>
          </div>
        </div>

        <div class="form-row" style="background:rgba(255,255,255,0.01); border:1px dashed var(--border); padding:16px; border-radius:8px;">
          <label class="form-label">Product Icon/Image Cover</label>
          <span style="font-size:0.75rem; color:var(--muted); display:block; margin:-4px 0 10px 0;">
            Constraints: <strong>Recommended Size: 600x400 px, Max 1MB</strong>
          </span>
          <input type="file" class="form-control" id="up-image-file" accept="image/*" style="padding:6px; margin-bottom:10px;">
          <input class="form-control" id="up-image-url" type="url" placeholder="Or paste absolute image URL link" value="${item?.image_url || ''}">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="close-up-modal2">Cancel</button>
        <button class="btn btn-primary" id="save-up-btn">${isEdit ? 'Update Release' : 'Register Release'}</button>
      </div>
    </div>`;

  const close = () => { modal.style.display = 'none'; };
  document.getElementById('close-up-modal').onclick = close;
  document.getElementById('close-up-modal2').onclick = close;

  document.getElementById('save-up-btn').onclick = async () => {
    const imageFile = document.getElementById('up-image-file').files[0];
    let imageUrl = document.getElementById('up-image-url').value;

    if (imageFile) {
      showToast('Uploading product image…', 'info');
      imageUrl = await uploadFile(imageFile, 'portfolio') || imageUrl;
    }

    const payload = {
      title:          document.getElementById('up-title').value.trim(),
      description:    document.getElementById('up-desc').value.trim(),
      category:       document.getElementById('up-cat').value,
      countdown_date: new Date(document.getElementById('up-date').value).toISOString(),
      sort_order:     parseInt(document.getElementById('up-order').value) || 0,
      status:         document.getElementById('up-status').value,
      image_url:      imageUrl,
    };

    if (!payload.title || !document.getElementById('up-date').value) {
      showToast('Title and Countdown Date are required.', 'error');
      return;
    }

    const { error } = isEdit
      ? await sb.from('upcoming_products').update(payload).eq('id', item.id)
      : await sb.from('upcoming_products').insert(payload);

    showToast(error ? error.message : (isEdit ? 'Product updated!' : 'Product registered!'), error ? 'error' : 'success');
    if (!error) { close(); loadSection('upcoming'); }
  };
}

// ════════════════════════════════════════════════════════════════
// 6. DOMAIN REGISTRAR PRICER
// ════════════════════════════════════════════════════════════════
async function renderDomains(el) {
  const cfg = await fetchSettings();

  const priceRow = (ext, key, defVal) => `
    <div class="form-row">
      <label class="form-label" style="font-weight:700;">${ext} Annual Pricing ($/yr)</label>
      <input class="form-control domain-price-field" type="number" step="0.01" data-key="${key}" value="${cfg[key] || defVal}">
    </div>
  `;

  el.innerHTML = `
    <div class="panel">
      <h3 class="panel-title">Domain Availability Extension Pricer</h3>
      <div class="panel-body">
        <p style="font-size:0.88rem; color:var(--muted); margin-bottom:24px;">Configure the annual prices displayed when search targets check name queries on the registrar.</p>
        
        ${priceRow('.COM Extensions', 'domain_price_com', '9.99')}
        ${priceRow('.NET Extensions', 'domain_price_net', '11.99')}
        ${priceRow('.ORG Extensions', 'domain_price_org', '12.99')}
        ${priceRow('.XYZ Extensions', 'domain_price_xyz', '1.99')}
        ${priceRow('.INFO Extensions', 'domain_price_info', '4.99')}

        <button class="btn btn-primary" id="save-domain-prices-btn" style="margin-top:16px;">Save Pricing Settings</button>
      </div>
    </div>`;

  document.getElementById('save-domain-prices-btn').addEventListener('click', async () => {
    const fields = document.querySelectorAll('.domain-price-field');
    const updates = Array.from(fields).map(f => ({
      key: f.dataset.key,
      value: parseFloat(f.value).toFixed(2)
    }));

    const btn = document.getElementById('save-domain-prices-btn');
    btn.disabled = true; btn.textContent = 'Saving prices…';

    const { error } = await sb.from('settings').upsert(
      updates.map(u => ({ ...u, updated_at: new Date().toISOString() })),
      { onConflict: 'key' }
    );

    btn.disabled = false; btn.textContent = 'Save Pricing Settings';
    showToast(error ? error.message : 'Registrar prices updated!', error ? 'error' : 'success');
  });
}

// ════════════════════════════════════════════════════════════════
// 7. MEETING BOOKINGS INBOX
// ════════════════════════════════════════════════════════════════
async function renderBookings(el) {
  const items = await q(() => sb.from('bookings').select('*').order('created_at', { ascending: false }));

  el.innerHTML = `
    <div class="panel">
      <h3 class="panel-title">Consultation Meetings Intake</h3>
      <div class="panel-body">
        ${!items?.length ? '<p class="empty-state">No consultation bookings in pipeline.</p>' : `
          <table class="admin-table">
            <thead><tr><th>Client Email</th><th>WhatsApp/Phone</th><th>Profession</th><th>Organization</th><th>Budget</th><th>State</th><th>Action</th></tr></thead>
            <tbody>${items.map(m => `
              <tr>
                <td><strong>${m.email}</strong></td>
                <td><a href="https://wa.me/${m.phone.replace(/[^0-9]/g, '')}" target="_blank">${m.phone}</a></td>
                <td>${m.profession}</td>
                <td>${m.company}</td>
                <td><strong style="color:var(--accent)">${m.budget}</strong></td>
                <td><span class="badge ${m.status === 'pending' ? 'badge-orange' : 'badge-green'}">${m.status}</span></td>
                <td class="td-actions">
                  <button class="btn btn-sm btn-secondary view-booking" data-id="${m.id}">Detail Message</button>
                  ${m.status === 'pending' ? `<button class="btn btn-sm btn-success confirm-booking" data-id="${m.id}">Schedule</button>` : ''}
                  <button class="btn btn-sm btn-danger delete-booking" data-id="${m.id}">Delete</button>
                </td>
              </tr>`).join('')}
            </tbody></table>`}
      </div>
    </div>
    <div id="booking-modal" class="modal" style="display:none"></div>`;

  attachBookingListeners();
}

function attachBookingListeners() {
  document.querySelectorAll('.view-booking').forEach(btn => {
    btn.onclick = async () => {
      const { data } = await sb.from('bookings').select('*').eq('id', btn.dataset.id).single();
      if (!data) return;

      const modal = document.getElementById('booking-modal');
      modal.style.display = 'flex';
      modal.innerHTML = `
        <div class="modal-box">
          <div class="modal-header"><h3>Consultation Specifications from ${data.email}</h3><button class="modal-close" id="close-bk">✕</button></div>
          <div class="modal-body" style="line-height:1.8;">
            <p><strong>Service Requested:</strong> ${data.service} (${data.category})</p>
            <p><strong>Budget boundaries:</strong> ${data.budget}</p>
            <p><strong>Client Profile:</strong> ${data.profession} at ${data.company}</p>
            <hr style="border:none; border-top:1px solid var(--border); margin:16px 0;">
            <p><strong>Detailed Requirements:</strong></p>
            <p style="white-space:pre-wrap; background:var(--dark); padding:16px; border-radius:8px; border:1px solid var(--border);">${data.details}</p>
          </div>
          <div class="modal-footer"><button class="btn btn-primary" id="close-bk2">Dismiss</button></div>
        </div>`;
      document.getElementById('close-bk').onclick = () => { modal.style.display = 'none'; };
      document.getElementById('close-bk2').onclick = () => { modal.style.display = 'none'; };
    };
  });

  document.querySelectorAll('.confirm-booking').forEach(btn => {
    btn.onclick = async () => {
      const { error } = await sb.from('bookings').update({ status: 'scheduled' }).eq('id', btn.dataset.id);
      showToast(error ? error.message : 'Consultation status scheduled.', error ? 'error' : 'success');
      if (!error) loadSection('bookings');
    };
  });

  document.querySelectorAll('.delete-booking').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Remove this booking permanently?')) return;
      const { error } = await sb.from('bookings').delete().eq('id', btn.dataset.id);
      showToast(error ? error.message : 'Booking removed.', error ? 'error' : 'success');
      if (!error) loadSection('bookings');
    };
  });
}

// ════════════════════════════════════════════════════════════════
// 8. CUSTOMER ORDERS INBOX
// ════════════════════════════════════════════════════════════════
async function renderOrders(el) {
  const items = await q(() => sb.from('orders').select('*').order('created_at', { ascending: false }));

  el.innerHTML = `
    <div class="panel">
      <h3 class="panel-title">Customer Project Orders</h3>
      <div class="panel-body">
        ${!items?.length ? '<p class="empty-state">No project orders received yet.</p>' : `
          <table class="admin-table">
            <thead><tr><th>Client</th><th>WhatsApp</th><th>Product / Domain</th><th>Budget</th><th>State</th><th>Action</th></tr></thead>
            <tbody>${items.map(m => `
              <tr>
                <td><strong>${m.name}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">${m.email}</span></td>
                <td><a href="https://wa.me/${m.whatsapp.replace(/[^0-9]/g, '')}" target="_blank">${m.whatsapp}</a></td>
                <td><strong>${m.product_name}</strong></td>
                <td><strong style="color:var(--accent)">${m.budget}</strong></td>
                <td>
                  <select class="form-control order-status-select" data-id="${m.id}" style="padding:6px; font-size:0.8rem; width:120px;">
                    <option ${m.status === 'pending' ? 'selected' : ''}>pending</option>
                    <option ${m.status === 'processing' ? 'selected' : ''}>processing</option>
                    <option ${m.status === 'completed' ? 'selected' : ''}>completed</option>
                  </select>
                </td>
                <td class="td-actions">
                  <button class="btn btn-sm btn-secondary view-order" data-id="${m.id}">View Requirements</button>
                  <button class="btn btn-sm btn-danger delete-order" data-id="${m.id}">Delete</button>
                </td>
              </tr>`).join('')}
            </tbody></table>`}
      </div>
    </div>
    <div id="order-view-modal" class="modal" style="display:none"></div>`;

  attachOrderListeners();
}

function attachOrderListeners() {
  document.querySelectorAll('.order-status-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const status = sel.value;
      const { error } = await sb.from('orders').update({ status }).eq('id', sel.dataset.id);
      showToast(error ? error.message : 'Order status updated to ' + status, error ? 'error' : 'success');
    });
  });

  document.querySelectorAll('.view-order').forEach(btn => {
    btn.onclick = async () => {
      const { data } = await sb.from('orders').select('*').eq('id', btn.dataset.id).single();
      if (!data) return;

      const modal = document.getElementById('order-view-modal');
      modal.style.display = 'flex';
      modal.innerHTML = `
        <div class="modal-box">
          <div class="modal-header"><h3>Order Specifications - ${data.product_name}</h3><button class="modal-close" id="close-or">✕</button></div>
          <div class="modal-body" style="line-height:1.8;">
            <p><strong>Client:</strong> ${data.name} (${data.email})</p>
            <p><strong>WhatsApp Line:</strong> ${data.whatsapp}</p>
            <p><strong>Budget Target:</strong> ${data.budget}</p>
            <hr style="border:none; border-top:1px solid var(--border); margin:16px 0;">
            <p><strong>Customization Details:</strong></p>
            <p style="white-space:pre-wrap; background:var(--dark); padding:16px; border-radius:8px; border:1px solid var(--border);">${data.details}</p>
          </div>
          <div class="modal-footer"><button class="btn btn-primary" id="close-or2">Dismiss</button></div>
        </div>`;
      document.getElementById('close-or').onclick = () => { modal.style.display = 'none'; };
      document.getElementById('close-or2').onclick = () => { modal.style.display = 'none'; };
    };
  });

  document.querySelectorAll('.delete-order').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Remove this order permanently?')) return;
      const { error } = await sb.from('orders').delete().eq('id', btn.dataset.id);
      showToast(error ? error.message : 'Order deleted.', error ? 'error' : 'success');
      if (!error) loadSection('orders');
    };
  });
}

// ════════════════════════════════════════════════════════════════
// 9. NEWSLETTER SUBSCRIPTIONS & EXCEL DOWNLOADS
// ════════════════════════════════════════════════════════════════
async function renderNewsletter(el) {
  const items = await q(() => sb.from('newsletter').select('*').order('created_at', { ascending: false }));

  el.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h3 class="panel-title">Newsletter Email Listings <span class="badge badge-orange">${items.length}</span></h3>
        <button class="btn btn-success" id="btn-export-csv" ${!items.length ? 'disabled' : ''}>📥 Export to CSV / Excel</button>
      </div>
      <div class="panel-body">
        ${!items?.length ? '<p class="empty-state">No email registrations received.</p>' : `
          <table class="admin-table">
            <thead><tr><th>Email Address</th><th>Status</th><th>Registration Date</th><th>Action</th></tr></thead>
            <tbody>${items.map(m => `
              <tr>
                <td><strong>${m.email}</strong></td>
                <td><span class="badge badge-green">${m.status}</span></td>
                <td>${new Date(m.created_at).toLocaleString()}</td>
                <td>
                  <button class="btn btn-sm btn-danger delete-news" data-id="${m.id}">Unsubscribe</button>
                </td>
              </tr>`).join('')}
            </tbody></table>`}
      </div>
    </div>`;

  if (items.length) {
    document.getElementById('btn-export-csv').addEventListener('click', () => exportNewsletterToCSV(items));
  }
  attachNewsletterListeners();
}

function attachNewsletterListeners() {
  document.querySelectorAll('.delete-news').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Unsubscribe this email listing?')) return;
      const { error } = await sb.from('newsletter').delete().eq('id', btn.dataset.id);
      showToast(error ? error.message : 'Email entry removed.', error ? 'error' : 'success');
      if (!error) loadSection('newsletter');
    };
  });
}

// Client-side Excel compatible CSV String Generator
function exportNewsletterToCSV(items) {
  let csvContent = '\ufeffEmail Address,Status,Registration Date\r\n'; // Include BOM for proper Excel UTF-8 display
  
  items.forEach(item => {
    const email = `"${item.email.replace(/"/g, '""')}"`;
    const status = `"${item.status}"`;
    const date = `"${new Date(item.created_at).toLocaleString().replace(/"/g, '""')}"`;
    csvContent += `${email},${status},${date}\r\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', `nexdiv_newsletter_${Date.now()}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Newsletter CSV exported successfully!');
}

// ════════════════════════════════════════════════════════════════
// 10. CONTACT MESSAGES
// ════════════════════════════════════════════════════════════════
async function renderMessages(el) {
  const msgs = await q(() => sb.from('contact_messages').select('*').order('submitted_at', { ascending: false }));

  el.innerHTML = `
    <div class="panel">
      <h3 class="panel-title">General Inquiries Inbox</h3>
      <div class="panel-body">
        ${!msgs?.length ? '<p class="empty-state">No contact messages received.</p>' : `
          <table class="admin-table">
            <thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Budget</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead>
            <tbody>${msgs.map(m => `
              <tr>
                <td><strong>${m.name}</strong></td>
                <td><a href="mailto:${m.email}">${m.email}</a></td>
                <td>${m.company || '—'}</td>
                <td>${m.budget || '—'}</td>
                <td><span class="badge badge-${m.status === 'unread' ? 'orange' : 'grey'}">${m.status}</span></td>
                <td>${new Date(m.submitted_at || m.created_at).toLocaleDateString()}</td>
                <td class="td-actions">
                  <button class="btn btn-sm btn-secondary view-msg" data-id="${m.id}" data-msg="${encodeURIComponent(m.message)}" data-name="${m.name}">View Message</button>
                  ${m.status === 'unread' ? `<button class="btn btn-sm btn-success mark-read" data-id="${m.id}">Mark Read</button>` : ''}
                  <button class="btn btn-sm btn-danger delete-msg" data-id="${m.id}">Delete</button>
                </td>
              </tr>`).join('')}
            </tbody></table>`}
      </div>
    </div>
    <div id="msg-modal" class="modal" style="display:none"></div>`;

  attachMessageListeners();
}

function attachMessageListeners() {
  document.querySelectorAll('.view-msg').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = document.getElementById('msg-modal');
      modal.style.display = 'flex';
      modal.innerHTML = `
        <div class="modal-box">
          <div class="modal-header"><h3>Inquiry from ${btn.dataset.name}</h3><button class="modal-close" id="close-msg">✕</button></div>
          <div class="modal-body"><p style="white-space:pre-wrap; background:var(--dark); padding:16px; border-radius:8px; border:1px solid var(--border);">${decodeURIComponent(btn.dataset.msg)}</p></div>
          <div class="modal-footer"><button class="btn btn-primary" id="close-msg2">Close</button></div>
        </div>`;
      document.getElementById('close-msg').onclick = () => { modal.style.display = 'none'; };
      document.getElementById('close-msg2').onclick = () => { modal.style.display = 'none'; };
    });
  });

  document.querySelectorAll('.mark-read').forEach(btn => {
    btn.addEventListener('click', async () => {
      await sb.from('contact_messages').update({ status: 'read' }).eq('id', btn.dataset.id);
      loadSection('messages');
    });
  });

  document.querySelectorAll('.delete-msg').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this inquiry message permanently?')) return;
      await sb.from('contact_messages').delete().eq('id', btn.dataset.id);
      showToast('Message inquiry removed.');
      loadSection('messages');
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 11. ADMIT CARDS MANAGER
// ════════════════════════════════════════════════════════════════
async function renderAdmitCards(el) {
  const cards = await q(() => sb.from('admit_cards').select('*').order('issued_at', { ascending: false }));

  el.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <h3 class="panel-title">Admit Cards</h3>
        <button class="btn btn-primary" id="add-card-btn">+ Issue New Card</button>
      </div>
      <div class="panel-body">
        <div id="cards-table-wrap">${buildCardsTable(cards)}</div>
      </div>
    </div>
    <div id="card-modal" class="modal" style="display:none"></div>`;

  document.getElementById('add-card-btn').addEventListener('click', () => openCardModal());
  attachCardTableListeners();
}

function buildCardsTable(cards) {
  if (!cards?.length) return '<p class="empty-state">No admit cards issued yet.</p>';
  const rows = cards.map(c => `
    <tr data-id="${c.id}">
      <td><code>${c.card_number}</code></td>
      <td><strong>${c.user_name}</strong></td>
      <td>${c.user_email}</td>
      <td>${c.event_name}</td>
      <td>${c.event_date || '—'}</td>
      <td><span class="badge ${c.status === 'active' ? 'badge-green' : 'badge-grey'}">${c.status}</span></td>
      <td class="td-actions">
        <button class="btn btn-sm btn-secondary edit-card" data-id="${c.id}">Edit</button>
        <button class="btn btn-sm btn-danger revoke-card" data-id="${c.id}" ${c.status === 'revoked' ? 'disabled' : ''}>Revoke</button>
      </td>
    </tr>`).join('');
  return `<table class="admin-table">
    <thead><tr><th>Card #</th><th>Name</th><th>Email</th><th>Event</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function attachCardTableListeners() {
  document.querySelectorAll('.edit-card').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { data } = await sb.from('admit_cards').select('*').eq('id', btn.dataset.id).single();
      if (data) openCardModal(data);
    });
  });

  document.querySelectorAll('.revoke-card').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Revoke this admit card? This cannot be easily undone.')) return;
      const { error } = await sb.from('admit_cards').update({ status: 'revoked' }).eq('id', btn.dataset.id);
      showToast(error ? error.message : 'Card revoked.', error ? 'error' : 'success');
      if (!error) { loadSection('admit-cards'); }
    });
  });
}

function generateCardNumber() {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `NDV-${year}-${rand}`;
}

function openCardModal(card = null) {
  const isEdit = !!card;
  const modal  = document.getElementById('card-modal');
  modal.style.display = 'flex';

  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3>${isEdit ? 'Edit Admit Card Specs' : 'Issue Admit Card Event'}</h3>
        <button class="modal-close" id="close-card-modal">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label class="form-label">Card Unique Number</label>
          <input class="form-control" id="c-number" type="text" value="${card?.card_number || generateCardNumber()}" ${isEdit ? 'readonly' : ''}>
        </div>
        <div class="form-grid-2">
          <div class="form-row">
            <label class="form-label">Recipient Full Name *</label>
            <input class="form-control" id="c-name" type="text" value="${card?.user_name || ''}">
          </div>
          <div class="form-row">
            <label class="form-label">Recipient Email *</label>
            <input class="form-control" id="c-email" type="email" value="${card?.user_email || ''}">
          </div>
        </div>
        <div class="form-row">
          <label class="form-label">External User ID / Reference</label>
          <input class="form-control" id="c-ref" type="text" value="${card?.user_id_ref || ''}" placeholder="e.g. EMP-001, STU-2024">
        </div>
        <div class="form-row">
          <label class="form-label">Event Name *</label>
          <input class="form-control" id="c-event" type="text" value="${card?.event_name || ''}">
        </div>
        <div class="form-grid-2">
          <div class="form-row">
            <label class="form-label">Event Date</label>
            <input class="form-control" id="c-date" type="date" value="${card?.event_date || ''}">
          </div>
          <div class="form-row">
            <label class="form-label">Valid Until</label>
            <input class="form-control" id="c-valid" type="date" value="${card?.valid_until || ''}">
          </div>
        </div>
        <div class="form-row">
          <label class="form-label">Upload Card File (PDF/Image)</label>
          <input type="file" class="form-control" id="c-file" accept="image/*,.pdf">
          ${card?.file_url ? `<a href="${card.file_url}" target="_blank" class="file-preview-link">View existing file ↗</a>` : ''}
        </div>
        <div class="form-row">
          <label class="form-label">Status</label>
          <select class="form-control" id="c-status">
            <option ${card?.status === 'active' ? 'selected' : ''}>active</option>
            <option ${card?.status === 'revoked' ? 'selected' : ''}>revoked</option>
            <option ${card?.status === 'expired' ? 'selected' : ''}>expired</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="close-card-modal2">Cancel</button>
        <button class="btn btn-primary" id="save-card-btn">${isEdit ? 'Update Card' : 'Issue Card'}</button>
      </div>
    </div>`;

  const close = () => { modal.style.display = 'none'; };
  document.getElementById('close-card-modal').onclick = close;
  document.getElementById('close-card-modal2').onclick = close;

  document.getElementById('save-card-btn').onclick = async () => {
    const fileInput = document.getElementById('c-file').files[0];
    let fileUrl = card?.file_url || null;

    if (fileInput) {
      showToast('Uploading file specs…', 'info');
      fileUrl = await uploadFile(fileInput, 'admit-cards') || fileUrl;
    }

    const payload = {
      card_number:  document.getElementById('c-number').value.trim(),
      user_name:    document.getElementById('c-name').value.trim(),
      user_email:   document.getElementById('c-email').value.trim(),
      user_id_ref:  document.getElementById('c-ref').value.trim() || null,
      event_name:   document.getElementById('c-event').value.trim(),
      event_date:   document.getElementById('c-date').value || null,
      valid_until:  document.getElementById('c-valid').value || null,
      file_url:     fileUrl,
      status:       document.getElementById('c-status').value,
    };

    if (!payload.user_name || !payload.user_email || !payload.event_name) {
      showToast('Name, Email and Event are required fields.', 'error');
      return;
    }

    const { error } = isEdit
      ? await sb.from('admit_cards').update(payload).eq('id', card.id)
      : await sb.from('admit_cards').insert(payload);

    showToast(error ? error.message : (isEdit ? 'Card updated!' : 'Card issued!'), error ? 'error' : 'success');
    if (!error) { close(); loadSection('admit-cards'); }
  };
}

// ════════════════════════════════════════════════════════════════
// 12. PENDING CATEGORIES REQUESTS
// ════════════════════════════════════════════════════════════════
async function renderPendingCategories(el) {
  const items = await q(() => sb.from('pending_categories').select('*').order('submitted_at', { ascending: false }));

  const pending  = items?.filter(i => i.status === 'pending') || [];
  const reviewed = items?.filter(i => i.status !== 'pending') || [];

  el.innerHTML = `
    <div class="panel">
      <h3 class="panel-title">Pending Requests <span class="badge badge-orange">${pending.length}</span></h3>
      <div class="panel-body">
        ${pending.length
          ? pending.map(i => buildCategoryCard(i)).join('')
          : '<p class="empty-state">No pending requests 🎉</p>'}
      </div>
    </div>
    <div class="panel" style="margin-top:24px">
      <h3 class="panel-title">Reviewed Category Requests</h3>
      <div class="panel-body">
        ${reviewed.length
          ? `<table class="admin-table">
              <thead><tr><th>Requested Category</th><th>Requester Profile</th><th>State</th><th>Admin Note</th><th>Reviewed Date</th></tr></thead>
              <tbody>${reviewed.map(i => `
                <tr>
                  <td><strong>${i.category_name}</strong></td>
                  <td>${i.requester_name}<br><span style="font-size:0.75rem; color:var(--text-muted);">${i.requester_email || ''}</span></td>
                  <td><span class="badge badge-${i.status === 'approved' ? 'green' : 'red'}">${i.status}</span></td>
                  <td>${i.admin_note || '—'}</td>
                  <td>${i.reviewed_at ? new Date(i.reviewed_at).toLocaleDateString() : '—'}</td>
                </tr>`).join('')}
              </tbody></table>`
          : '<p class="empty-state">No reviewed requests yet.</p>'}
      </div>
    </div>`;

  attachPendingListeners();
}

function buildCategoryCard(item) {
  return `
    <div class="pending-card" data-id="${item.id}" style="background:var(--surface2); border:1px solid var(--border); padding:20px; border-radius:10px; margin-bottom:16px;">
      <div class="pending-card__top" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
        <div>
          <h4 class="pending-card__name" style="font-size:1.1rem; color:var(--white);">${item.category_name}</h4>
          <p class="pending-card__meta" style="font-size:0.78rem; color:var(--muted); margin-top:3px;">By <strong>${item.requester_name}</strong>${item.requester_email ? ` · ${item.requester_email}` : ''} · ${new Date(item.submitted_at).toLocaleDateString()}</p>
        </div>
        <span class="badge badge-orange">pending</span>
      </div>
      <p class="pending-card__desc" style="font-size:0.88rem; color:var(--text); margin-bottom:8px;">${item.description || ''}</p>
      <p class="pending-card__reason" style="font-size:0.82rem; color:var(--muted); margin-bottom:16px;"><em>Reason:</em> ${item.reason || '—'}</p>
      <div class="pending-card__note-row" style="margin-bottom:12px;">
        <input class="form-control" type="text" id="note-${item.id}" placeholder="Admin note (optional)">
      </div>
      <div class="pending-card__actions" style="display:flex; gap:8px;">
        <button class="btn btn-sm btn-success approve-cat" data-id="${item.id}">✓ Approve Request</button>
        <button class="btn btn-sm btn-danger reject-cat"  data-id="${item.id}">✕ Reject Request</button>
      </div>
    </div>`;
}

function attachPendingListeners() {
  document.querySelectorAll('.approve-cat').forEach(btn => {
    btn.onclick = () => reviewCategory(btn.dataset.id, 'approved');
  });
  document.querySelectorAll('.reject-cat').forEach(btn => {
    btn.onclick = () => reviewCategory(btn.dataset.id, 'rejected');
  });
}

async function reviewCategory(id, status) {
  const note = document.getElementById(`note-${id}`)?.value || null;
  const { error } = await sb.from('pending_categories').update({
    status,
    admin_note:  note,
    reviewed_at: new Date().toISOString(),
  }).eq('id', id);

  showToast(error ? error.message : `Category ${status}!`, error ? 'error' : 'success');
  if (!error) { loadSection('pending-cats'); }
}
