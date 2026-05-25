// ============================================================
// app-integration.js — Complete App Integration & Orchestration
// ============================================================
// This script acts as the central hub connecting:
// - Supabase backend
// - Frontend UI (index.html)
// - Admin panel (index admin.html)
// - Authentication & Authorization
// - API & Database operations
// ============================================================

/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║ APPLICATION STATE & CONFIGURATION MANAGEMENT             ║
 * ╚══════════════════════════════════════════════════════════╝
 */

class AppState {
  constructor() {
    this.currentUser = null;
    this.settings = {};
    this.portfolio = [];
    this.messages = [];
    this.isAdmin = false;
    this.theme = localStorage.getItem('nexdiv-theme') || 'dark';
    this.observers = new Map();
  }

  setState(key, value) {
    const oldValue = this[key];
    this[key] = value;
    this.notifyObservers(key, { oldValue, newValue: value });
  }

  subscribe(key, callback) {
    if (!this.observers.has(key)) {
      this.observers.set(key, []);
    }
    this.observers.get(key).push(callback);
  }

  notifyObservers(key, change) {
    const callbacks = this.observers.get(key) || [];
    callbacks.forEach(cb => cb(change));
  }

  reset() {
    this.currentUser = null;
    this.isAdmin = false;
    this.portfolio = [];
    this.messages = [];
  }
}

/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║ AUTHENTICATION LAYER                                     ║
 * ╚══════════════════════════════════════════════════════════╝
 */

class AuthManager {
  constructor(supabaseClient, appState) {
    this.sb = supabaseClient;
    this.state = appState;
  }

  async initialize() {
    const { data: { session } } = await this.sb.auth.getSession();
    if (session) {
      await this.setCurrentUser(session.user);
    }

    // Listen for auth changes
    this.sb.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        await this.setCurrentUser(session.user);
      } else {
        this.logout();
      }
    });
  }

  async setCurrentUser(user) {
    this.state.setState('currentUser', user);
    
    const { data: adminData } = await this.sb
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    
    this.state.setState('isAdmin', !!adminData);
  }

  async login(email, password) {
    try {
      const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }

  async signup(email, password) {
    try {
      const { data, error } = await this.sb.auth.signUp({ email, password });
      if (error) throw new Error(error.message);
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: error.message };
    }
  }

  async logout() {
    await this.sb.auth.signOut();
    this.state.reset();
  }

  isLoggedIn() {
    return !!this.state.currentUser;
  }

  isAdminUser() {
    return this.state.isAdmin && this.isLoggedIn();
  }
}

/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║ DATA MANAGEMENT LAYER                                    ║
 * ╚══════════════════════════════════════════════════════════╝
 */

class DataManager {
  constructor(supabaseClient, appState) {
    this.sb = supabaseClient;
    this.state = appState;
  }

  // ── Settings ──────────────────────────────────────────────
  async fetchSettings() {
    try {
      const { data, error } = await this.sb
        .from('settings')
        .select('key, value');
      
      if (error) throw error;
      
      const settings = {};
      data.forEach(row => {
        settings[row.key] = row.value;
      });
      
      this.state.setState('settings', settings);
      return settings;
    } catch (error) {
      console.error('Fetch settings error:', error);
      return {};
    }
  }

  async updateSetting(key, value) {
    try {
      const { error } = await this.sb
        .from('settings')
        .upsert({ key, value }, { onConflict: 'key' });
      
      if (error) throw error;
      
      // Update local state
      const updated = { ...this.state.settings, [key]: value };
      this.state.setState('settings', updated);
      
      return { success: true };
    } catch (error) {
      console.error('Update setting error:', error);
      return { success: false, error: error.message };
    }
  }

  // ── Portfolio ─────────────────────────────────────────────
  async fetchPortfolio(published = true) {
    try {
      let query = this.sb.from('portfolio').select('*');
      if (published) {
        query = query.eq('status', 'published');
      }
      
      const { data, error } = await query.order('sort_order', { ascending: true });
      
      if (error) throw error;
      
      this.state.setState('portfolio', data || []);
      return data || [];
    } catch (error) {
      console.error('Fetch portfolio error:', error);
      return [];
    }
  }

  async createPortfolioItem(item) {
    try {
      const { data, error } = await this.sb
        .from('portfolio')
        .insert([item])
        .select();
      
      if (error) throw error;
      
      // Update local state
      const updated = [...this.state.portfolio, ...data];
      this.state.setState('portfolio', updated);
      
      return { success: true, data: data[0] };
    } catch (error) {
      console.error('Create portfolio error:', error);
      return { success: false, error: error.message };
    }
  }

  async updatePortfolioItem(id, updates) {
    try {
      const { data, error } = await this.sb
        .from('portfolio')
        .update(updates)
        .eq('id', id)
        .select();
      
      if (error) throw error;
      
      // Update local state
      const updated = this.state.portfolio.map(item => 
        item.id === id ? { ...item, ...updates } : item
      );
      this.state.setState('portfolio', updated);
      
      return { success: true, data: data[0] };
    } catch (error) {
      console.error('Update portfolio error:', error);
      return { success: false, error: error.message };
    }
  }

  async deletePortfolioItem(id) {
    try {
      const { error } = await this.sb
        .from('portfolio')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Update local state
      const updated = this.state.portfolio.filter(item => item.id !== id);
      this.state.setState('portfolio', updated);
      
      return { success: true };
    } catch (error) {
      console.error('Delete portfolio error:', error);
      return { success: false, error: error.message };
    }
  }

  // ── Messages ──────────────────────────────────────────────
  async fetchMessages() {
    try {
      const { data, error } = await this.sb
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      this.state.setState('messages', data || []);
      return data || [];
    } catch (error) {
      console.error('Fetch messages error:', error);
      return [];
    }
  }

  async sendMessage(message) {
    try {
      const { data, error } = await this.sb
        .from('contact_messages')
        .insert([{
          name: message.name,
          email: message.email,
          phone: message.phone,
          subject: message.subject,
          body: message.body,
          created_at: new Date().toISOString()
        }])
        .select();
      
      if (error) throw error;
      
      return { success: true, data: data[0] };
    } catch (error) {
      console.error('Send message error:', error);
      return { success: false, error: error.message };
    }
  }

  async markMessageAsRead(id) {
    try {
      const { error } = await this.sb
        .from('contact_messages')
        .update({ is_read: true })
        .eq('id', id);
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Mark message error:', error);
      return { success: false, error: error.message };
    }
  }
}

/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║ STORAGE & FILE MANAGEMENT                                ║
 * ╚══════════════════════════════════════════════════════════╝
 */

class StorageManager {
  constructor(supabaseClient) {
    this.sb = supabaseClient;
    this.bucket = 'nexdiv-assets';
  }

  async uploadFile(file, folder = 'general') {
    try {
      const ext = file.name.split('.').pop();
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const path = `${folder}/${filename}`;

      const { error: uploadError } = await this.sb.storage
        .from(this.bucket)
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = this.sb.storage
        .from(this.bucket)
        .getPublicUrl(path);

      return { success: true, url: publicUrl, path };
    } catch (error) {
      console.error('Upload error:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteFile(path) {
    try {
      const { error } = await this.sb.storage
        .from(this.bucket)
        .remove([path]);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Delete file error:', error);
      return { success: false, error: error.message };
    }
  }

  getPublicUrl(path) {
    const { data: { publicUrl } } = this.sb.storage
      .from(this.bucket)
      .getPublicUrl(path);
    return publicUrl;
  }
}

/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║ UI HELPERS & NOTIFICATIONS                               ║
 * ╚══════════════════════════════════════════════════════════╝
 */

class UIManager {
  static showToast(message, type = 'success', duration = 3200) {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('toast--show'), 10);
    setTimeout(() => {
      toast.classList.remove('toast--show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  static showLoading(message = 'Loading...') {
    const loader = document.createElement('div');
    loader.className = 'loader loader--show';
    loader.id = 'app-loader';
    loader.innerHTML = `
      <div class="spinner"></div>
      <p>${message}</p>
    `;
    document.body.appendChild(loader);
    return loader;
  }

  static hideLoading() {
    const loader = document.getElementById('app-loader');
    if (loader) {
      loader.classList.remove('loader--show');
      setTimeout(() => loader.remove(), 300);
    }
  }

  static showModal(title, content, actions = []) {
    const modal = document.createElement('div');
    modal.className = 'modal modal--show';
    modal.innerHTML = `
      <div class="modal__overlay"></div>
      <div class="modal__content">
        <h2>${title}</h2>
        <div class="modal__body">${content}</div>
        <div class="modal__actions">
          ${actions.map(a => `<button class="btn ${a.class}">${a.label}</button>`).join('')}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    actions.forEach((action, i) => {
      const btn = modal.querySelector('button:nth-child(' + (i + 1) + ')');
      btn.addEventListener('click', () => {
        action.callback();
        modal.classList.remove('modal--show');
        setTimeout(() => modal.remove(), 300);
      });
    });
    
    return modal;
  }
}

/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║ MAIN APPLICATION CONTROLLER                              ║
 * ╚══════════════════════════════════════════════════════════╝
 */

class NexdivApp {
  constructor() {
    // Reuse global `sb` from supabase-client.js
    if (typeof sb === 'undefined') {
      throw new Error('supabase-client.js must be loaded before app-integration.js');
    }

    this.state = new AppState();
    this.sb = sb;
    this.auth = null;
    this.data = null;
    this.storage = null;
    this.ui = UIManager;

    this.isInitialized = false;
  }

  async initialize() {
    try {
      this.auth = new AuthManager(this.sb, this.state);
      this.data = new DataManager(this.sb, this.state);
      this.storage = new StorageManager(this.sb);

      await this.auth.initialize();
      this.detectPage();
      await this.data.fetchSettings();

      this.isInitialized = true;
      console.log('✓ Nexdiv App initialized successfully');
      return { success: true };
    } catch (error) {
      console.error('App initialization error:', error);
      return { success: false, error: error.message };
    }
  }

  detectPage() {
    const path = window.location.pathname;
    
    if (path.includes('admin') || document.body.classList.contains('admin-page')) {
      this.initAdminPanel();
    } else {
      this.initFrontend();
    }
  }

  async initFrontend() {
    console.log('Initializing frontend...');
    
    // Load portfolio
    await this.data.fetchPortfolio(true);
    
    // Setup event listeners
    this.setupFrontendListeners();
  }

  async initAdminPanel() {
    console.log('Initializing admin panel...');
    
    // Check authorization
    if (!this.auth.isAdminUser()) {
      console.warn('Unauthorized access to admin panel');
      window.location.href = '/';
      return;
    }

    // Load all data
    await this.data.fetchPortfolio(false);
    await this.data.fetchMessages();
    
    // Setup event listeners
    this.setupAdminListeners();
  }

  setupFrontendListeners() {
    // Contact form
    const contactForm = document.querySelector('[data-form="contact"]');
    if (contactForm) {
      contactForm.addEventListener('submit', (e) => this.handleContactSubmit(e));
    }

    // State observers for dynamic updates
    this.state.subscribe('settings', ({ newValue }) => {
      this.updateFrontendContent(newValue);
    });
  }

  setupAdminListeners() {
    // Admin specific listeners will be added here
    document.addEventListener('admin:ready', () => {
      console.log('Admin panel ready');
    });
  }

  async handleContactSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    this.ui.showLoading('Sending message...');
    
    const result = await this.data.sendMessage({
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      subject: formData.get('subject'),
      body: formData.get('message')
    });

    this.ui.hideLoading();

    if (result.success) {
      this.ui.showToast('Message sent successfully!', 'success');
      form.reset();
    } else {
      this.ui.showToast('Failed to send message: ' + result.error, 'error');
    }
  }

  updateFrontendContent(settings) {
    // Update hero section
    if (settings.hero_title) {
      const heroTitle = document.querySelector('[data-key="hero_title"]');
      if (heroTitle) heroTitle.textContent = settings.hero_title;
    }

    if (settings.hero_subtitle) {
      const heroSubtitle = document.querySelector('[data-key="hero_subtitle"]');
      if (heroSubtitle) heroSubtitle.textContent = settings.hero_subtitle;
    }

    // Update services
    if (settings.services_title) {
      const servicesTitle = document.querySelector('[data-key="services_title"]');
      if (servicesTitle) servicesTitle.textContent = settings.services_title;
    }

    // Update CTA
    if (settings.hero_cta_text) {
      const cta = document.querySelector('[data-key="hero_cta"]');
      if (cta) cta.textContent = settings.hero_cta_text;
    }
  }

  // Public API
  async login(email, password) {
    return await this.auth.login(email, password);
  }

  async logout() {
    return await this.auth.logout();
  }

  getCurrentUser() {
    return this.state.currentUser;
  }

  isAdmin() {
    return this.auth.isAdminUser();
  }

  getState() {
    return this.state;
  }
}

/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║ GLOBAL INSTANCE & AUTO-INITIALIZATION                    ║
 * ╚══════════════════════════════════════════════════════════╝
 */

let nexdivApp = null;

/**
 * Manual initialization — call this from your own script if you
 * want to use the class-based orchestration layer instead of
 * the simpler main.js / admin.js approach.
 *
 * Usage:
 *   <script src="js/supabase-client.js"></script>
 *   <script src="js/app-integration.js"></script>
 *   <script>
 *     document.addEventListener('DOMContentLoaded', async () => {
 *       await initializeNexdivApp();
 *       window.dispatchEvent(new CustomEvent('nexdiv:ready'));
 *     });
 *   </script>
 */
async function initializeNexdivApp() {
  nexdivApp = new NexdivApp();
  return await nexdivApp.initialize();
}

// NOTE: Auto-init is disabled to avoid conflict with main.js/admin.js.
// Uncomment the block below if you use app-integration.js standalone.
// document.addEventListener('DOMContentLoaded', async () => {
//   await initializeNexdivApp();
// });

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NexdivApp, AppState, AuthManager, DataManager, StorageManager, UIManager };
}
