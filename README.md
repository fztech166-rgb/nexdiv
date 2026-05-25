# Nexdiv Agency Website + Admin Panel

Pure HTML / CSS / Vanilla JS  ·  Supabase Backend  ·  No frameworks

---

## Project Structure

```
nexdiv/
├── index.html                  ← Public-facing agency website
├── css/
│   └── style.css               ← Frontend styles (dark-luxury editorial)
├── js/
│   ├── supabase-client.js      ← Shared Supabase init + helpers
│   ├── main.js                 ← Frontend dynamic content logic
│   └── app-integration.js      ← App orchestration layer (optional)
├── admin/
│   ├── index.html              ← Admin panel (auth-gated)
│   ├── css/
│   │   └── admin.css           ← Admin UI styles
│   └── js/
│       └── admin.js            ← Full admin CRUD logic
├── schema.sql                  ← Complete Supabase SQL schema + RLS
└── README.md                   ← Project documentation
```

---

## Quick Start

### 1 · Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Note your **Project URL** and **anon/public API key** (Settings → API)

### 2 · Run the SQL Schema

1. Supabase Dashboard → **SQL Editor** → New Query
2. Paste the full contents of `schema.sql` and run it
3. This creates all tables, seeds demo data, and enables RLS policies

### 3 · Create a Storage Bucket

1. Supabase Dashboard → **Storage** → **New Bucket**
2. Name: `nexdiv-assets`  |  Public: ✅ enabled
3. Add an upload policy:
   - Policy name: `Allow authenticated uploads`
   - Operation: INSERT
   - Target roles: `authenticated`
   - `WITH CHECK`: `true`

### 4 · Create an Admin User

1. Supabase Dashboard → **Authentication** → **Users** → **Add User**
2. Enter the admin email and a strong password
3. ✅ That's it — Supabase's auth handles everything via Row Level Security

### 5 · Configure Your Keys

Open `js/supabase-client.js` and replace the placeholders:

```js
const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY';
```

### 6 · Deploy / Serve

The project is pure static HTML — deploy to any host:

- **Netlify / Vercel**: drag-and-drop the `nexdiv/` folder
- **GitHub Pages**: push to a repo and enable Pages
- **Local dev**: `npx serve nexdiv` or Python `http.server`

> ⚠️ Do NOT open HTML files directly via `file://` — Supabase
> requests require a proper HTTP server (CORS restriction).

---

## Feature Map

| Area | Feature | File |
|------|---------|------|
| Frontend | Dynamic hero, services, process | `js/main.js` |
| Frontend | Portfolio fetch + category filter | `js/main.js` |
| Frontend | Contact form → Supabase insert | `js/main.js` |
| Admin | Email/password auth gate | `admin/js/admin.js` |
| Admin | Global content editor (Settings) | `admin/js/admin.js` |
| Admin | Portfolio CRUD + image upload | `admin/js/admin.js` |
| Admin | Admit Card issue / edit / revoke | `admin/js/admin.js` |
| Admin | Pending category approve/reject | `admin/js/admin.js` |
| Admin | Contact message inbox | `admin/js/admin.js` |
| Security | RLS on all tables | `schema.sql` |
| Security | Public read, admin write | `schema.sql` |

---

## Security Notes

- **Row Level Security** is enabled on every table
- Public visitors can: read published portfolio & settings, submit contact forms, submit category requests
- Only **authenticated Supabase users** (admins) can: write settings, CRUD portfolio, manage admit cards, review categories, read messages
- The admin panel checks `sb.auth.getSession()` on load and redirects to login if unauthenticated
- Never commit your `service_role` key to the frontend — the `anon` key is safe with proper RLS

---

## Customisation Checklist

- [ ] Replace `SUPABASE_URL` and `SUPABASE_ANON` in `js/supabase-client.js`
- [ ] Update contact email in `index.html` and Supabase `settings` table
- [ ] Upload your hero image via Admin → Global Content
- [ ] Add your portfolio items via Admin → Portfolio Manager
- [ ] Customise service cards in `index.html` (or extend to a DB table)
- [ ] Point your domain's DNS to your hosting provider
