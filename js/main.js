// ============================================================
// js/main.js — Frontend Dynamic Content and Modules Logic
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Resolve Preloader quickly to ensure smooth loading transition
  initPreloader();

  // 2. Initialize Core Modules
  initTheme();
  initNav();
  initScrollReveal();
  initSettingsSync(); // Real-time settings sync

  // 3. Load Dynamic Data
  await loadSettings();
  await loadServices();
  await loadPortfolio();
  await loadUpcomingProducts();

  // 4. Initialize Forms & Listeners
  initDomainChecker();
  initBookingForm();
  initNewsletterForm();
  initOrderForm();
});

// ── Preloader ────────────────────────────────────────────────
function initPreloader() {
  const loader = document.getElementById('preloader');
  if (loader) {
    // Graceful fade out
    setTimeout(() => {
      loader.classList.add('preloader--hidden');
      setTimeout(() => loader.remove(), 500);
    }, 400);
  }
}

// ── Real-time Settings Sync ───────────────────────────────────
function initSettingsSync() {
  // Listen for LocalStorage changes from admin panel (cross-tab sync)
  window.addEventListener('storage', async (e) => {
    if (e.key === 'nexdiv_admin_sync_timestamp' || e.key === 'nexdiv_db_settings') {
      console.log('⚡ Admin panel settings change detected, reloading...');
      siteSettings = await fetchSettings();
      updateDynamicContent();
      showToast('Site updated from admin changes!', 'info');
    }
  });

  // Listen for same-tab custom events from Supabase real-time
  window.addEventListener('nexdiv_settings_updated', async () => {
    console.log('⚡ Settings changed, reloading...');
    siteSettings = await fetchSettings();
    updateDynamicContent();
  });

  // Check for theme changes
  window.addEventListener('nexdiv_theme_updated', () => {
    console.log('🎨 Theme change detected, reloading...');
    location.reload();
  });

  // Setup Supabase real-time listener if available
  setupSupabaseRealtimeListener();
}

function setupSupabaseRealtimeListener() {
  // Only if Supabase is configured
  if (!sb || !sb.from) {
    console.log('⚠️ Supabase real-time not available, using LocalStorage sync');
    return;
  }

  try {
    sb.channel('settings-sync')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'settings' },
        async (payload) => {
          console.log('⚡ Real-time Supabase update received:', payload);
          siteSettings = await fetchSettings();
          updateDynamicContent();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Main site real-time listener active');
        }
      });
  } catch (error) {
    console.warn('⚠️ Real-time listener setup failed:', error);
  }
}

function updateDynamicContent() {
  // Update theme dynamically if set
  if (siteSettings.default_theme && !localStorage.getItem('nexdiv-theme')) {
    document.documentElement.setAttribute('data-theme', siteSettings.default_theme);
  }

  // Update global display text elements
  setText('[data-key="hero_title"]', siteSettings.hero_title);
  setText('[data-key="hero_subtitle"]', siteSettings.hero_subtitle);
  setText('[data-key="services_title"]', siteSettings.services_title);
  setText('[data-key="process_title"]', siteSettings.process_title);
  setText('[data-key="portfolio_title"]', siteSettings.portfolio_title);
  setText('[data-key="footer_tagline"]', siteSettings.footer_tagline);

  // Update Hero CTA Action link
  const cta = document.querySelector('[data-key="hero_cta"]');
  if (cta) {
    cta.textContent = siteSettings.hero_cta_text || 'Start a Project';
    cta.href = siteSettings.hero_cta_link || '#booking';
  }

  // Update Hero Image banner background CSS
  if (siteSettings.hero_image_url) {
    const hero = document.querySelector('.hero');
    if (hero) hero.style.setProperty('--hero-bg', `url(${siteSettings.hero_image_url})`);
  }

  // Update Header Branding elements
  const headerLogoImg = document.querySelector('.logo-img');
  if (headerLogoImg) {
    headerLogoImg.src = siteSettings.header_logo || 'assets/logo.svg';
  }
  const headerLogoText = document.getElementById('header-logo-link');
  if (headerLogoText && siteSettings.company_name) {
    headerLogoText.innerHTML = `<img class="logo-img" src="${siteSettings.header_logo || 'assets/logo.svg'}" alt="Nexdiv Logo" style="width: 40px; height: 40px; vertical-align: middle; margin-right: 8px;">${siteSettings.company_name.split(' ').map((w, i) => i === 0 ? w : `<span>${w}</span>`).join(' ')}`;
  }

  // Update Browser Favicon
  if (siteSettings.favicon) {
    const link = document.querySelector("link[rel*='icon']");
    if (link) link.href = siteSettings.favicon;
  }

  // Update Consultation Hotline & Email Contacts
  const hotlineLink = document.querySelector('a[href^="tel:"]');
  if (hotlineLink && siteSettings.hotline_number) {
    hotlineLink.href = `tel:${siteSettings.hotline_number}`;
    hotlineLink.innerHTML = `<span class="detail-icon" aria-hidden="true">☎</span> ${siteSettings.hotline_number}`;
  }

  const emailLink = document.querySelector('a[href^="mailto:"]');
  if (emailLink && siteSettings.contact_email) {
    emailLink.href = `mailto:${siteSettings.contact_email}`;
    emailLink.innerHTML = `<span class="detail-icon" aria-hidden="true">✉</span> ${siteSettings.contact_email}`;
  }

  // Update Footer Branding
  const footerCompanyName = document.getElementById('footer-company-name');
  if (footerCompanyName && siteSettings.company_name) {
    footerCompanyName.innerHTML = siteSettings.company_name.split(' ').map((w, i) => i === 0 ? w : `<span>${w}</span>`).join(' ');
  }

  const footerAddress = document.getElementById('footer-address-text');
  if (footerAddress) {
    footerAddress.textContent = siteSettings.footer_address || 'Bangladesh';
  }

  const footerDescription = document.getElementById('footer-description-text');
  if (footerDescription) {
    footerDescription.textContent = siteSettings.about_text || 'Crafting premier automated SaaS systems and high-end responsive digital products for scaling enterprises.';
  }

  const footerLogoImg = document.querySelector('.footer-logo-img');
  if (footerLogoImg) {
    footerLogoImg.src = siteSettings.footer_logo || 'assets/logo.svg';
  }

  // Update WhatsApp Floating CTA Action
  const waBtn = document.getElementById('whatsapp-floating-button');
  if (waBtn) {
    const phone = (siteSettings.whatsapp_number || '8801700000000').replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(siteSettings.whatsapp_default_msg || 'Hello Nexdiv, I would like to query about your services.');
    waBtn.href = `https://wa.me/${phone}?text=${msg}`;
  }

  console.log('✓ All dynamic content updated');
}

// ── Theme Customization ──────────────────────────────────────
function initTheme() {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;

  const currentTheme = localStorage.getItem('nexdiv-theme') || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);

  btn.addEventListener('click', () => {
    const active = document.documentElement.getAttribute('data-theme');
    const target = active === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', target);
    localStorage.setItem('nexdiv-theme', target);
  });
}

// ── Load Global Settings ──────────────────────────────────────
let siteSettings = {};

async function loadSettings() {
  siteSettings = await fetchSettings();
  updateDynamicContent();
}


function setText(selector, value) {
  if (!value) return;
  document.querySelectorAll(selector).forEach(el => {
    // Allow html parsing in title for <em> italic tags
    if (selector.includes('title')) {
      el.innerHTML = value;
    } else {
      el.textContent = value;
    }
  });
}

// ── Services Dynamic Render & Detail Popups ────────────────────
let activeServices = [];

async function loadServices() {
  const { data, error } = await sb
    .from('services')
    .select('*')
    .eq('status', 'published')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching services:', error);
    return;
  }
  activeServices = data || [];
  renderServices(activeServices);
  populateBookingServicesDropdown(activeServices);
}

function renderServices(items) {
  const grid = document.getElementById('services-grid');
  if (!grid) return;

  grid.innerHTML = '';
  if (!items.length) {
    grid.innerHTML = '<p class="empty-state">No services published yet.</p>';
    return;
  }

  items.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'service-card reveal';
    card.setAttribute('role', 'listitem');
    card.style.animationDelay = `${i * 0.06}s`;

    card.innerHTML = `
      <div class="service-card__icon" aria-hidden="true">${item.icon || '◆'}</div>
      <h3 class="service-card__title">${item.title}</h3>
      <p class="service-card__desc">${item.description}</p>`;
    
    // Add Click listener for detailed modal
    card.addEventListener('click', () => openServiceDetailModal(item));

    grid.appendChild(card);
  });
  observeReveals();
}

function openServiceDetailModal(item) {
  const modal = document.getElementById('service-detail-modal');
  if (!modal) return;

  document.getElementById('modal-service-title').textContent = item.title;
  document.getElementById('modal-service-icon').textContent = item.icon || '🌐';
  document.getElementById('modal-service-desc').textContent = item.description;

  // Add Dynamic Spec details list
  const list = document.getElementById('modal-service-deliverables');
  list.innerHTML = `
    <li>World-class high-performance frontend engineering.</li>
    <li>Fully integrated responsive styling with dark/light themes.</li>
    <li>Robust LocalStorage & Supabase database pipeline synchronization.</li>
    <li>Comprehensive meta tags and analytics integration for solid SEO.</li>
    <li>Direct consultation line via administrative dashboard alerts.</li>
  `;

  modal.style.display = 'flex';

  const close = () => { modal.style.display = 'none'; };
  document.getElementById('close-service-modal').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };

  // Bind CTA button in modal to scroll to booking
  document.getElementById('modal-service-cta-btn').onclick = (e) => {
    close();
    // Pre-select service in booking form
    const select = document.getElementById('booking-service');
    if (select) {
      select.value = item.title;
    }
  };
}

function populateBookingServicesDropdown(services) {
  const select = document.getElementById('booking-service');
  if (!select) return;

  select.innerHTML = '<option value="">Select a service…</option>';
  services.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.title;
    opt.textContent = s.title;
    select.appendChild(opt);
  });
  // Add customized option
  select.innerHTML += '<option value="Custom Project Template">Custom Project Build</option>';
}

// ── Upcoming Products Countdown Tickers ────────────────────────
let countdownIntervals = [];

async function loadUpcomingProducts() {
  const { data, error } = await sb
    .from('upcoming_products')
    .select('*')
    .eq('status', 'upcoming')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching upcoming products:', error);
    return;
  }
  renderUpcomingProducts(data || []);
}

function renderUpcomingProducts(items) {
  const grid = document.getElementById('upcoming-grid');
  if (!grid) return;

  // Clear previous tickers
  countdownIntervals.forEach(clearInterval);
  countdownIntervals = [];

  grid.innerHTML = '';
  if (!items.length) {
    grid.innerHTML = '<p class="empty-state">No upcoming software events scheduled.</p>';
    return;
  }

  items.forEach((item, i) => {
    const card = document.createElement('article');
    card.className = 'upcoming-card reveal';
    card.style.animationDelay = `${i * 0.08}s`;

    const timerId = `timer-${item.id}`;

    card.innerHTML = `
      <span class="upcoming-card__cat">${item.category}</span>
      <h3 class="upcoming-card__title">${item.title}</h3>
      <p class="upcoming-card__desc">${item.description || 'Upcoming software template equipped with advanced UI and fluid layouts.'}</p>
      
      <!-- Live countdown layout -->
      <div class="countdown-box" id="${timerId}">
        <div class="countdown-unit">
          <div class="countdown-value days">00</div>
          <div class="countdown-label">Days</div>
        </div>
        <div class="countdown-unit">
          <div class="countdown-value hours">00</div>
          <div class="countdown-label">Hours</div>
        </div>
        <div class="countdown-unit">
          <div class="countdown-value mins">00</div>
          <div class="countdown-label">Mins</div>
        </div>
        <div class="countdown-unit">
          <div class="countdown-value secs">00</div>
          <div class="countdown-label">Secs</div>
        </div>
      </div>
      
      <div class="upcoming-card__cta" onclick="triggerUpcomingOrder('${item.title}')">
        Pre-Order / Get Notified →
      </div>
    `;

    grid.appendChild(card);
    startCountdown(item.countdown_date, timerId);
  });
  observeReveals();
}

function startCountdown(targetDateStr, timerElementId) {
  const targetDate = new Date(targetDateStr).getTime();
  const box = document.getElementById(timerElementId);
  if (!box) return;

  const daysEl = box.querySelector('.days');
  const hoursEl = box.querySelector('.hours');
  const minsEl = box.querySelector('.mins');
  const secsEl = box.querySelector('.secs');

  const update = () => {
    const now = new Date().getTime();
    const distance = targetDate - now;

    if (distance < 0) {
      box.innerHTML = '<div style="color:var(--accent); font-weight:700; letter-spacing: 0.05em;">RELEASED / COMPLETED</div>';
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
    if (minsEl) minsEl.textContent = String(minutes).padStart(2, '0');
    if (secsEl) secsEl.textContent = String(seconds).padStart(2, '0');
  };

  update();
  const interval = setInterval(update, 1000);
  countdownIntervals.push(interval);
}

function triggerUpcomingOrder(productName) {
  openOrderProjectModal({
    id: 'upcoming-' + productName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    title: productName + ' (Upcoming Product Release)'
  });
}

// ── Domain Checker Registrar Logic ─────────────────────────────
function initDomainChecker() {
  const form = document.getElementById('domain-search-form');
  const input = document.getElementById('domain-input');
  const resultsBox = document.getElementById('domain-results-box');
  const resultsGrid = document.getElementById('domain-results-grid');
  const searchedLabel = document.getElementById('searched-domain-text');

  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawVal = input.value.trim().toLowerCase();
    if (!rawVal) return;

    // Remove extension if user entered one to perform clean search
    const cleanDomain = rawVal.replace(/\.[a-z]{2,}$/g, '');
    if (!cleanDomain) return;

    searchedLabel.textContent = cleanDomain;
    resultsBox.style.display = 'block';
    resultsGrid.innerHTML = '<div class="spinner"></div><span>Querying WHOIS registries…</span>';

    // Detect user currency (default to USD, use BDT for Bangladesh IP)
    const isBangladesh = localStorage.getItem('user-country') === 'BD';
    const currencyMode = isBangladesh ? 'bdt' : 'usd';

    // Mock realistic checker matching prices from settings
    setTimeout(() => {
      resultsGrid.innerHTML = '';
      
      const exts = [
        { name: '.com', priceKeyUSD: 'domain_price_com_usd', priceKeyBDT: 'domain_price_com_bdt', fallbackUSD: '9.99', fallbackBDT: '850' },
        { name: '.net', priceKeyUSD: 'domain_price_net_usd', priceKeyBDT: 'domain_price_net_bdt', fallbackUSD: '11.99', fallbackBDT: '1000' },
        { name: '.org', priceKeyUSD: 'domain_price_org_usd', priceKeyBDT: 'domain_price_org_bdt', fallbackUSD: '12.99', fallbackBDT: '1100' },
        { name: '.xyz', priceKeyUSD: 'domain_price_xyz_usd', priceKeyBDT: 'domain_price_xyz_bdt', fallbackUSD: '1.99', fallbackBDT: '170' },
        { name: '.info', priceKeyUSD: 'domain_price_info_usd', priceKeyBDT: 'domain_price_info_bdt', fallbackUSD: '4.99', fallbackBDT: '420' }
      ];

      exts.forEach((ext, index) => {
        // Mock availability (e.g random check, or keep certain names taken)
        const isAvailable = cleanDomain.length > 3 && (cleanDomain.charCodeAt(index % cleanDomain.length) % 3 !== 0);
        
        let price, currency, priceKey;
        if (currencyMode === 'bdt') {
          price = siteSettings[ext.priceKeyBDT] || ext.fallbackBDT;
          currency = '৳';
          priceKey = ext.priceKeyBDT;
        } else {
          price = siteSettings[ext.priceKeyUSD] || ext.fallbackUSD;
          currency = '$';
          priceKey = ext.priceKeyUSD;
        }
        
        const row = document.createElement('div');
        row.className = 'domain-result-row';

        row.innerHTML = `
          <span class="domain-name-tag">${cleanDomain}${ext.name}</span>
          <div class="domain-status-group">
            ${isAvailable 
              ? `<span class="domain-price">${currency}${price}/yr</span>
                 <button class="btn-order-domain" onclick="triggerDomainPurchase('${cleanDomain}${ext.name}', '${price}', '${currency}')">Register</button>`
              : '<span style="color:var(--text-muted); font-size:0.88rem; font-style:italic;">Taken</span>'}
          </div>
        `;
        resultsGrid.appendChild(row);
      });
    }, 800);
  });
}

function triggerDomainPurchase(domainName, price, currency) {
  openOrderProjectModal({
    id: 'domain-' + domainName.replace(/\./g, '-'),
    title: `Domain Registration (${domainName} - ${currency}${price}/yr)`
  });
}

// ── Portfolio & Works Filters ──────────────────────────────────
let allWorks = [];

async function loadPortfolio() {
  const { data, error } = await sb
    .from('portfolio')
    .select('*')
    .eq('status', 'published')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching portfolio:', error);
    return;
  }
  allWorks = data || [];
  renderPortfolio(allWorks);
  initPortfolioFilter();
}

function renderPortfolio(items) {
  const grid = document.getElementById('portfolio-grid');
  if (!grid) return;

  grid.innerHTML = '';
  if (!items.length) {
    grid.innerHTML = '<p class="empty-state">No projects published yet.</p>';
    return;
  }

  items.forEach((item, i) => {
    const card = document.createElement('article');
    card.className = 'work-card reveal';
    card.style.animationDelay = `${i * 0.08}s`;
    card.dataset.category = item.category;

    const tags = (item.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
    const img  = item.image_url
      ? `<img src="${item.image_url}" alt="${item.title}" loading="lazy">`
      : `<div class="work-card__placeholder"><span>${item.category[0]}</span></div>`;

    card.innerHTML = `
      <div class="work-card__media">${img}</div>
      <div class="work-card__body">
        <span class="work-card__category">${item.category}</span>
        <h3 class="work-card__title">${item.title}</h3>
        <p class="work-card__desc">${item.description || ''}</p>
        <div class="work-card__tags">${tags}</div>
        
        <div class="work-card__actions-row">
          <a href="${item.live_url || '#'}" target="_blank" rel="noopener" class="work-card__link-btn">View Demo ↗</a>
          <button class="btn-order-project" onclick="triggerProjectOrder('${item.id}', '${item.title.replace(/'/g, "\\'")}')">Order Similar Project</button>
        </div>
      </div>`;
    
    grid.appendChild(card);
  });
  observeReveals();
}

function initPortfolioFilter() {
  const btns = document.querySelectorAll('.filter-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.filter;
      const filtered = cat === 'all' ? allWorks : allWorks.filter(w => w.category === cat);
      renderPortfolio(filtered);
    });
  });
}

function triggerProjectOrder(projectId, projectTitle) {
  openOrderProjectModal({ id: projectId, title: projectTitle });
}

// ── Project Order Modal Handler ───────────────────────────────
function openOrderProjectModal(project) {
  const modal = document.getElementById('order-project-modal');
  if (!modal) return;

  document.getElementById('order-project-title-label').textContent = project.title;
  document.getElementById('order-project-id').value = project.id;
  document.getElementById('order-project-name').value = project.title;

  modal.style.display = 'flex';

  const close = () => { modal.style.display = 'none'; };
  document.getElementById('close-order-modal').onclick = close;
  document.getElementById('cancel-order-modal').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };
}

function initOrderForm() {
  const form = document.getElementById('project-order-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('order-client-name').value.trim();
    const email = document.getElementById('order-client-email').value.trim();
    const whatsapp = document.getElementById('order-client-whatsapp').value.trim();
    const details = document.getElementById('order-custom-details').value.trim();
    const budget = document.getElementById('order-client-budget').value;
    const projectId = document.getElementById('order-project-id').value;
    const projectName = document.getElementById('order-project-name').value;

    if (!name || !email || !whatsapp || !details || !budget) {
      showToast('Please fill out all mandatory fields.', 'error');
      return;
    }

    const btn = document.getElementById('submit-order-btn');
    btn.disabled = true;
    btn.textContent = 'Submitting order request…';

    const { error } = await sb.from('orders').insert({
      name,
      email,
      whatsapp,
      product_name: projectName,
      details,
      budget,
      status: 'pending'
    });

    btn.disabled = false;
    btn.textContent = 'Submit Project Order';

    if (error) {
      showToast('Error placing order: ' + error.message, 'error');
    } else {
      showToast('Order placed successfully! We will contact you soon.');
      form.reset();
      document.getElementById('order-project-modal').style.display = 'none';
    }
  });
}

// ── Meeting Booking Form ──────────────────────────────────────
function initBookingForm() {
  const form = document.getElementById('meeting-booking-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('booking-email').value.trim();
    const phone = document.getElementById('booking-phone').value.trim();
    const service = document.getElementById('booking-service').value;
    const category = document.getElementById('booking-category').value;
    const profession = document.getElementById('booking-profession').value.trim();
    const company = document.getElementById('booking-company').value.trim();
    const budget = document.getElementById('booking-budget').value;
    const details = document.getElementById('booking-details').value.trim();

    if (!email || !phone || !service || !category || !profession || !company || !budget || !details) {
      showToast('All fields are required to register booking.', 'error');
      return;
    }

    const btn = document.getElementById('booking-form-submit');
    btn.disabled = true;
    btn.textContent = 'Scheduling meeting…';

    const { error } = await sb.from('bookings').insert({
      email,
      phone,
      service,
      category,
      profession,
      company,
      budget,
      details,
      status: 'pending'
    });

    btn.disabled = false;
    btn.textContent = 'Confirm Consultation Request';

    if (error) {
      showToast('Booking failed: ' + error.message, 'error');
    } else {
      showToast('Meeting request received! We will send you a scheduling email.');
      form.reset();
    }
  });
}

// ── Newsletter subscription ───────────────────────────────────
function initNewsletterForm() {
  const form = document.getElementById('newsletter-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('newsletter-email');
    const email = emailInput.value.trim().toLowerCase();

    if (!email) return;

    const btn = document.getElementById('newsletter-submit-btn');
    btn.disabled = true;

    const { error } = await sb.from('newsletter').insert({
      email,
      status: 'active'
    });

    btn.disabled = false;

    if (error) {
      showToast('Newsletter registration failed: ' + error.message, 'error');
    } else {
      showToast('Thank you for subscribing to Nexdiv!');
      emailInput.value = '';
    }
  });
}

// ── Mobile Burger Menu & Scroll sticky navbar ────────────────
function initNav() {
  const nav  = document.getElementById('site-header');
  const burger = document.getElementById('mobile-menu-burger');
  const menu   = document.getElementById('nav-links-container');

  window.addEventListener('scroll', () => {
    nav?.classList.toggle('nav--scrolled', window.scrollY > 40);
  });

  burger?.addEventListener('click', () => {
    menu?.classList.toggle('nav__links--open');
    burger.classList.toggle('open');
  });

  menu?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      menu.classList.remove('nav__links--open');
      burger?.classList.remove('open');
    });
  });
}

// ── Scroll Reveal anim ────────────────────────────────────────
let _revealObserver = null;

function initScrollReveal() {
  if (_revealObserver) return;
  _revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        _revealObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  observeReveals();
}

function observeReveals() {
  if (!_revealObserver) return;
  document.querySelectorAll('.reveal:not(.revealed)').forEach(el => _revealObserver.observe(el));
}

// Make globally accessible
window.triggerDomainPurchase = triggerDomainPurchase;
window.triggerUpcomingOrder = triggerUpcomingOrder;
window.triggerProjectOrder = triggerProjectOrder;
