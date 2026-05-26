// ============================================================
// js/supabase-client.js — Shared Hybrid Supabase & LocalStorage Client
// ============================================================

const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY';

// Check if credentials are placeholders
const isSupabaseConfigured = 
  SUPABASE_URL && 
  SUPABASE_ANON && 
  !SUPABASE_URL.includes('YOUR_PROJECT_ID') && 
  !SUPABASE_ANON.includes('YOUR_ANON_PUBLIC_KEY');

let sbReal = null;

if (isSupabaseConfigured && typeof supabase !== 'undefined') {
  try {
    const { createClient } = supabase;
    sbReal = createClient(SUPABASE_URL, SUPABASE_ANON);
  } catch (e) {
    console.warn('Failed to initialize real Supabase client, falling back to LocalStorage DB:', e);
  }
}

// ── LocalStorage Mock Database ─────────────────────────────────
const LS_PREFIX = 'nexdiv_db_';

const MOCK_DATA = {
  settings: [
    { key: 'hero_title', value: 'We Build <em>Digital Futures</em>' },
    { key: 'hero_subtitle', value: 'Nexdiv crafts world-class products — from strategy to launch.' },
    { key: 'hero_cta_text', value: 'Start a Project' },
    { key: 'hero_cta_link', value: '#contact' },
    { key: 'hero_image_url', value: '' },
    { key: 'about_text', value: 'Nexdiv is a full-stack digital agency specialising in web, mobile, and brand experiences.' },
    { key: 'services_title', value: 'Services Built for <span>Growth</span>' },
    { key: 'process_title', value: 'Our <span>Process</span>' },
    { key: 'portfolio_title', value: 'What We\'ve <span>Built</span>' },
    { key: 'contact_email', value: 'hello@nexdiv.com' },
    { key: 'footer_tagline', value: '© 2026 Nexdiv. All rights reserved.' },
    { key: 'whatsapp_number', value: '8801700000000' },
    { key: 'domain_price_com', value: '9.99' },
    { key: 'domain_price_net', value: '11.99' },
    { key: 'domain_price_org', value: '12.99' },
    { key: 'domain_price_xyz', value: '1.99' },
    { key: 'domain_price_info', value: '4.99' }
  ],
  services: [
    { id: '1', title: 'Web Development', description: 'Performant, scalable web applications built on modern stacks. We craft beautiful interfaces and optimize pages to resolve all loading issues.[...]
    { id: '2', title: 'E-commerce Solutions', description: 'Stunning storefronts that wow customers. Fully integrated payment gateways, fluid order checkouts, and premium category setups.', icon: [...]
    { id: '3', title: 'SaaS Product Engineering', description: 'Scalable cloud backends, microservices, and state-of-the-art interactive dashboards designed to grow with your business.', icon: '🧠', sort_order: 2 },
    { id: '4', title: 'Custom Automation Tools', description: 'Optimize your workflows with bots, custom scripts, and smart system integrations. Save hundreds of operational hours.', icon: '🤖', sort_order: 3 },
    { id: '5', title: 'UI/UX Brand Strategy', description: 'Vibrant designs, beautiful dark/light themes, and smooth micro-animations tailored to build unforgettable brand experiences.', icon: '🎨', sort_order: 4 },
    { id: '6', title: 'AI Integration', description: 'Integrate LLMs, predictive search algorithms, and intelligent triggers that adapt to customer behavior dynamically.', icon: '🧠', sort_order: 5 }
  ],
  portfolio: [
    { id: 'p1', title: 'NexGen Corporate Portal', description: 'Premium business website featuring interactive visual blocks and rapid server-side speed.', category: 'Web', tags: ['HTML5', 'Vanilla JS', 'SSG'], sort_order: 0 },
    { id: 'p2', title: 'FlowSaaS Dashboard Platform', description: 'A state-of-the-art administrative hub with glassmorphic cards and live analytics dashboards.', category: 'SaaS Platforms', tags: ['React', 'Supabase', 'API'], sort_order: 1 },
    { id: 'p3', title: 'SalesFlow Automation Bot', description: 'Backend script cluster capable of sync automation and webscraping tasks.', category: 'Automations', tags: ['Node.js', 'Cron', 'Security'], sort_order: 2 },
    { id: 'p4', title: 'UrbanWear E-commerce', description: 'Beautiful clothing catalog with high-fidelity animations, responsive carts, and instant checkout flow.', category: 'E-commerce', tags: ['Next.js', 'Stripe'], sort_order: 3 },
    { id: 'p5', title: 'Apex SEO Optimization Tool', description: 'Lightweight keyword finder web app with Google Search Console indicators.', category: 'Tools', tags: ['SEO', 'Analytics', 'APIs'], sort_order: 4 }
  ],
  upcoming_products: [
    { id: 'up1', title: 'DevFlow Hub', description: 'An all-in-one developer workspace to manage APIs, project deployment timelines, and client pipelines.', category: 'SaaS Platforms', image_url: '', countdown_date: '2026-12-31T23:59:59Z', sort_order: 0, status: 'upcoming' },
    { id: 'up2', title: 'ShopMagic AI', description: 'E-commerce product copy generator built with smart context awareness and instant search optimization templates.', category: 'Tools', image_url: '', countdown_date: '2026-11-30T23:59:59Z', sort_order: 1, status: 'upcoming' }
  ],
  admit_cards: [],
  pending_categories: [],
  contact_messages: [],
  bookings: [],
  orders: [],
  newsletter: []
};

// Initialize LocalStorage DB with default mock values if missing
Object.keys(MOCK_DATA).forEach(table => {
  const key = LS_PREFIX + table;
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, JSON.stringify(MOCK_DATA[table]));
  }
});

// Helper for Mock DB operations
const db = {
  get(table) {
    try {
      return JSON.parse(localStorage.getItem(LS_PREFIX + table)) || [];
    } catch (e) {
      console.error('MockDB Read Error:', e);
      return [];
    }
  },
  set(table, data) {
    try {
      localStorage.setItem(LS_PREFIX + table, JSON.stringify(data));
      
      // Dispatch custom event for real-time dashboard listeners
      window.dispatchEvent(new CustomEvent('nexdiv_db_changed', { 
        detail: { table, action: 'update' } 
      }));
      
      // Also trigger same-tab event for admin panel listeners
      window.dispatchEvent(new CustomEvent('nexdiv_db_update', { 
        detail: { table } 
      }));
      
      return true;
    } catch (e) {
      console.error('MockDB Write Error:', e);
      return false;
    }
  }
};

// ── Mock Auth Gate ─────────────────────────────────────────────
const MOCK_USER = {
  id: 'mock-admin-uuid-1111-2222',
  email: 'admin@nexdiv.com',
  role: 'authenticated'
};

const mockAuth = {
  async getSession() {
    const active = localStorage.getItem('nexdiv_admin_session') === 'true';
    return { data: { session: active ? { user: MOCK_USER } : null }, error: null };
  },
  async signInWithPassword({ email, password }) {
    if (email === 'admin@nexdiv.com' && password === 'admin123') {
      localStorage.setItem('nexdiv_admin_session', 'true');
      setTimeout(() => window.location.reload(), 100);
      return { data: { user: MOCK_USER }, error: null };
    }
    return { data: { user: null }, error: { message: 'Invalid credentials. Use admin@nexdiv.com and admin123' } };
  },
  async signOut() {
    localStorage.removeItem('nexdiv_admin_session');
    setTimeout(() => window.location.reload(), 100);
    return { error: null };
  },
  onAuthStateChange(callback) {
    window.addEventListener('storage', (e) => {
      if (e.key === 'nexdiv_admin_session') {
        const active = e.newValue === 'true';
        callback('SIGNED_IN', active ? { user: MOCK_USER } : null);
      }
    });
    // Call initially
    const active = localStorage.getItem('nexdiv_admin_session') === 'true';
    setTimeout(() => callback('INITIAL', active ? { user: MOCK_USER } : null), 50);
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
};

// ── Hybrid Client Implementation ────────────────────────────────
class HybridClient {
  constructor() {
    this.auth = sbReal ? sbReal.auth : mockAuth;
    // Set storage fallback
    this.storage = {
      from: () => ({
        upload: async (path, file) => {
          // File Mock upload - Convert to local object URL or Base64
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              // Store uploaded file key in local db metadata if needed
              const fakeUrl = reader.result;
              resolve({ data: { path }, error: null });
            };
            reader.readAsDataURL(file);
          });
        },
        getPublicUrl: (path) => {
          // Just return placeholder or data URL mock
          return { data: { publicUrl: path } };
        }
      })
    };
  }

  from(table) {
    if (sbReal) {
      // Return real Supabase client query builder, with seamless catch fail
      const builder = sbReal.from(table);
      // Let's hook a fallback query engine in case the request errors out
      return this._createHybridQueryBuilder(table, builder);
    }
    // Return mock local storage query builder
    return this._createMockQueryBuilder(table);
  }

  _createHybridQueryBuilder(table, realBuilder) {
    const self = this;
    const chain = {
      queryState: { filters: [], ordering: null, countExact: false },
      select(fields = '*', options = {}) {
        chain.queryState.selectFields = fields;
        if (options.count === 'exact') chain.queryState.countExact = true;
        return this;
      },
      eq(col, val) {
        chain.queryState.filters.push({ type: 'eq', col, val });
        return this;
      },
      order(col, options = {}) {
        chain.queryState.ordering = { col, ascending: options.ascending !== false };
        return this;
      },
      async single() {
        try {
          const res = await realBuilder.select(chain.queryState.selectFields).single();
          if (res.error) throw res.error;
          return res;
        } catch (e) {
          console.warn(`Supabase single error for table ${table}, falling back to LocalStorage:`, e);
          return self._createMockQueryBuilder(table).select().single();
        }
      },
      async maybeSingle() {
        try {
          const res = await realBuilder.select(chain.queryState.selectFields).maybeSingle();
          if (res.error) throw res.error;
          return res;
        } catch (e) {
          console.warn(`Supabase maybeSingle error for table ${table}, falling back to LocalStorage:`, e);
          return self._createMockQueryBuilder(table).select().maybeSingle();
        }
      },
      async insert(rows) {
        try {
          const res = await sbReal.from(table).insert(rows).select();
          if (res.error) throw res.error;
          return res;
        } catch (e) {
          console.warn(`Supabase insert error for table ${table}, falling back to LocalStorage:`, e);
          return self._createMockQueryBuilder(table).insert(rows);
        }
      },
      async update(updates) {
        try {
          let req = sbReal.from(table).update(updates);
          chain.queryState.filters.forEach(f => {
            if (f.type === 'eq') req = req.eq(f.col, f.val);
          });
          const res = await req.select();
          if (res.error) throw res.error;
          return res;
        } catch (e) {
          console.warn(`Supabase update error for table ${table}, falling back to LocalStorage:`, e);
          let mockQ = self._createMockQueryBuilder(table);
          chain.queryState.filters.forEach(f => {
            if (f.type === 'eq') mockQ = mockQ.eq(f.col, f.val);
          });
          return mockQ.update(updates);
        }
      },
      async upsert(rows, options = {}) {
        try {
          const res = await sbReal.from(table).upsert(rows, options).select();
          if (res.error) throw res.error;
          return res;
        } catch (e) {
          console.warn(`Supabase upsert error for table ${table}, falling back to LocalStorage:`, e);
          return self._createMockQueryBuilder(table).upsert(rows, options);
        }
      },
      async delete() {
        try {
          let req = sbReal.from(table).delete();
          chain.queryState.filters.forEach(f => {
            if (f.type === 'eq') req = req.eq(f.col, f.val);
          });
          const res = await req.select();
          if (res.error) throw res.error;
          return res;
        } catch (e) {
          console.warn(`Supabase delete error for table ${table}, falling back to LocalStorage:`, e);
          let mockQ = self._createMockQueryBuilder(table);
          chain.queryState.filters.forEach(f => {
            if (f.type === 'eq') mockQ = mockQ.eq(f.col, f.val);
          });
          return mockQ.delete();
        }
      },
      // Promise standard compatibility
      then(onfulfilled, onrejected) {
        let req = realBuilder.select(chain.queryState.selectFields || '*');
        chain.queryState.filters.forEach(f => {
          if (f.type === 'eq') req = req.eq(f.col, f.val);
        });
        if (chain.queryState.ordering) {
          req = req.order(chain.queryState.ordering.col, { ascending: chain.queryState.ordering.ascending });
        }
        return req.then(
          (res) => {
            if (res.error) {
              console.warn(`Supabase query warning, fetching from LocalStorage fallback:`, res.error);
              const fallbackRes = self._executeMockQuery(table, chain.queryState);
              return onfulfilled(fallbackRes);
            }
            return onfulfilled(res);
          },
          (err) => {
            console.warn(`Supabase query rejected, fetching from LocalStorage fallback:`, err);
            const fallbackRes = self._executeMockQuery(table, chain.queryState);
            return onfulfilled(fallbackRes);
          }
        );
      }
    };
    return chain;
  }

  _createMockQueryBuilder(table) {
    const self = this;
    const chain = {
      queryState: { filters: [], ordering: null, countExact: false },
      select(fields = '*', options = {}) {
        chain.queryState.selectFields = fields;
        if (options.count === 'exact') chain.queryState.countExact = true;
        return this;
      },
      eq(col, val) {
        chain.queryState.filters.push({ type: 'eq', col, val });
        return this;
      },
      order(col, options = {}) {
        chain.queryState.ordering = { col, ascending: options.ascending !== false };
        return this;
      },
      async single() {
        const { data } = self._executeMockQuery(table, chain.queryState);
        return { data: data && data.length ? data[0] : null, error: data && data.length ? null : { message: 'No row found' } };
      },
      async maybeSingle() {
        const { data } = self._executeMockQuery(table, chain.queryState);
        return { data: data && data.length ? data[0] : null, error: null };
      },
      async insert(rows) {
        const data = db.get(table);
        const rowsArray = Array.isArray(rows) ? rows : [rows];
        const newRows = rowsArray.map(r => ({
          id: r.id || 'id_' + Math.random().toString(36).substr(2, 9),
          created_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          ...r
        }));
        const updated = [...data, ...newRows];
        db.set(table, updated);
        return { data: newRows, error: null };
      },
      async update(updates) {
        const data = db.get(table);
        let updatedCount = 0;
        const updated = data.map(item => {
          let match = true;
          chain.queryState.filters.forEach(f => {
            if (f.type === 'eq' && item[f.col] !== f.val) match = false;
          });
          if (match) {
            updatedCount++;
            return { ...item, ...updates, updated_at: new Date().toISOString() };
          }
          return item;
        });
        db.set(table, updated);
        return { data: updated.filter(item => {
          let match = true;
          chain.queryState.filters.forEach(f => {
            if (f.type === 'eq' && item[f.col] !== f.val) match = false;
          });
          return match;
        }), error: null };
      },
      async upsert(rows, options = {}) {
        const data = db.get(table);
        const rowsArray = Array.isArray(rows) ? rows : [rows];
        
        let updated = [...data];
        rowsArray.forEach(r => {
          const conflictCol = options.onConflict || 'key';
          const existingIndex = updated.findIndex(item => item[conflictCol] === r[conflictCol]);
          if (existingIndex !== -1) {
            updated[existingIndex] = { ...updated[existingIndex], ...r, updated_at: new Date().toISOString() };
          } else {
            updated.push({
              id: r.id || 'id_' + Math.random().toString(36).substr(2, 9),
              created_at: new Date().toISOString(),
              ...r
            });
          }
        });
        db.set(table, updated);
        return { data: rowsArray, error: null };
      },
      async delete() {
        const data = db.get(table);
        const remaining = data.filter(item => {
          let match = true;
          chain.queryState.filters.forEach(f => {
            if (f.type === 'eq' && item[f.col] !== f.val) match = false;
          });
          return !match;
        });
        db.set(table, remaining);
        return { data: [], error: null };
      },
      then(onfulfilled, onrejected) {
        const res = self._executeMockQuery(table, chain.queryState);
        return Promise.resolve(res).then(onfulfilled, onrejected);
      }
    };
    return chain;
  }

  _executeMockQuery(table, queryState) {
    let list = db.get(table);

    // Apply filters
    queryState.filters.forEach(f => {
      if (f.type === 'eq') {
        list = list.filter(item => item[f.col] === f.val);
      }
    });

    // Apply ordering
    if (queryState.ordering) {
      const { col, ascending } = queryState.ordering;
      list.sort((a, b) => {
        let valA = a[col];
        let valB = b[col];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return ascending ? -1 : 1;
        if (valA > valB) return ascending ? 1 : -1;
        return 0;
      });
    }

    const count = list.length;
    return { data: list, count: queryState.countExact ? count : null, error: null };
  }
}

// Global client instance
const sb = new HybridClient();

// ── Shared Helpers ──────────────────────────────────────────
async function fetchSettings() {
  const { data, error } = await sb.from('settings').select('key, value');
  if (error) { console.error('Settings fetch error:', error); return {}; }
  return data.reduce((acc, row) => { acc[row.key] = row.value; return acc; }, {});
}

async function uploadFile(file, folder = 'general') {
  const res = await sb.storage.from('nexdiv-assets').upload(null, file);
  if (res.error) {
    console.error('Upload error:', res.error);
    return null;
  }
  const { data } = sb.storage.from('nexdiv-assets').getPublicUrl(res.data.path);
  return data.publicUrl;
}

function showToast(msg, type = 'success') {
  // If Toast container doesn't exist, create it or use local body
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('toast--show'), 10);
  setTimeout(() => { 
    t.classList.remove('toast--show'); 
    setTimeout(() => t.remove(), 300); 
  }, 3200);
}
