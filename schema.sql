-- ============================================================
-- NEXDIV AGENCY — SUPABASE SQL SCHEMA
-- Run this in Supabase SQL Editor (Project → SQL Editor → New query)
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. SETTINGS TABLE  (Global site content)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key           TEXT UNIQUE NOT NULL,          -- e.g. 'hero_title'
  value         TEXT,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Seed default settings
INSERT INTO public.settings (key, value) VALUES
  ('hero_title',       'We Build Digital Futures'),
  ('hero_subtitle',    'Nexdiv crafts world-class products — from strategy to launch.'),
  ('hero_cta_text',    'Start a Project'),
  ('hero_cta_link',    '#contact'),
  ('hero_image_url',   ''),
  ('about_text',       'Nexdiv is a full-stack digital agency specialising in web, mobile, and brand experiences.'),
  ('services_title',   'What We Do'),
  ('process_title',    'Our Process'),
  ('portfolio_title',  'Selected Works'),
  ('contact_email',    'hello@nexdiv.com'),
  ('footer_tagline',   '© 2026 Nexdiv. All rights reserved.')
ON CONFLICT (key) DO NOTHING;

-- ──────────────────────────────────────────────
-- 2. ADMIN USERS TABLE (explicit role management)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_users (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  role          TEXT DEFAULT 'admin',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────
-- 3. SERVICES TABLE (dynamic service cards)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.services (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  icon          TEXT DEFAULT '◆',
  sort_order    INT DEFAULT 0,
  status        TEXT DEFAULT 'published',        -- published | draft
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Seed default services
INSERT INTO public.services (title, description, icon, sort_order) VALUES
  ('Web Development',     'Performant, scalable web applications built on modern stacks. From SPA dashboards to high-traffic marketing sites.', '🌐', 1),
  ('Mobile Apps',         'Cross-platform iOS and Android apps that feel native. Flutter and React Native expertise for smooth experiences.',     '📱', 2),
  ('Brand & Identity',    'Strategic visual identities that stand out. Logo systems, design tokens, and brand guidelines built to last.',        '🎨', 3),
  ('Product Strategy',    'Discovery sprints, roadmapping, and user research to validate ideas before a single line of code is written.',         '⚙️', 4),
  ('Cloud & DevOps',      'CI/CD pipelines, container orchestration, and infrastructure-as-code for zero-downtime deployments.',                  '☁️', 5),
  ('AI Integration',      'LLM-powered features, intelligent automation, and data pipelines that make your product smarter over time.',            '🤖', 6)
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────
-- 4. PORTFOLIO TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.portfolio (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL DEFAULT 'Web',   -- e.g. Web, Mobile, Brand
  tags          TEXT[],
  image_url     TEXT,
  live_url      TEXT,
  featured      BOOLEAN DEFAULT false,
  sort_order    INT DEFAULT 0,
  status        TEXT DEFAULT 'published',       -- published | draft
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Sample data
INSERT INTO public.portfolio (title, description, category, tags, image_url, live_url, featured, sort_order) VALUES
  ('FinFlow Dashboard', 'Real-time financial analytics platform with AI-driven insights.', 'Web',   ARRAY['React','Node','PostgreSQL'], '', 'https://example.com', true,  1),
  ('Orbis Mobile App',  'Cross-platform fitness tracking app used by 200k+ users.',       'Mobile', ARRAY['Flutter','Firebase'],        '', 'https://example.com', true,  2),
  ('Lumé Branding',     'Full identity system for a luxury skincare DTC brand.',           'Brand',  ARRAY['Figma','Illustrator'],        '', 'https://example.com', false, 3);

-- ──────────────────────────────────────────────
-- 5. ADMIT CARDS TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admit_cards (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_number   TEXT UNIQUE NOT NULL,           -- auto-generated ref e.g. NDV-2024-001
  user_name     TEXT NOT NULL,
  user_email    TEXT NOT NULL,
  user_id_ref   TEXT,                           -- external / custom user ID
  event_name    TEXT NOT NULL,
  event_date    DATE,
  valid_until   DATE,
  card_data     JSONB DEFAULT '{}',             -- flexible extra fields
  file_url      TEXT,                           -- uploaded PDF/image
  status        TEXT DEFAULT 'active',          -- active | revoked | expired
  issued_at     TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────
-- 6. PENDING CATEGORIES TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pending_categories (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_name  TEXT NOT NULL,
  requester_email TEXT,
  category_name   TEXT NOT NULL,
  description     TEXT,
  reason          TEXT,
  status          TEXT DEFAULT 'pending',       -- pending | approved | rejected
  admin_note      TEXT,
  submitted_at    TIMESTAMPTZ DEFAULT now(),
  reviewed_at     TIMESTAMPTZ
);

-- Sample data
INSERT INTO public.pending_categories (requester_name, requester_email, category_name, description, reason) VALUES
  ('Alice Johnson', 'alice@example.com', 'AR/VR Development', 'Augmented and virtual reality experiences.', 'Growing client demand for immersive tech.'),
  ('Bob Smith',     'bob@example.com',   'Blockchain & Web3',  'Smart contracts and dApp development.',        'Several enterprise clients requesting this.');

-- ──────────────────────────────────────────────
-- 7. CONTACT MESSAGES TABLE
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  company     TEXT,
  message     TEXT NOT NULL,
  budget      TEXT,
  status      TEXT DEFAULT 'unread',            -- unread | read | archived
  submitted_at TIMESTAMPTZ DEFAULT now()
);

-- ──────────────────────────────────────────────
-- 8. ROW LEVEL SECURITY (RLS)
-- ──────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE public.settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admit_cards        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages   ENABLE ROW LEVEL SECURITY;

-- ── SETTINGS ──────────────────────────────────
-- Public can READ settings (needed for frontend)
CREATE POLICY "settings_public_read"
  ON public.settings FOR SELECT USING (true);

-- Only authenticated users (admins) can write
CREATE POLICY "settings_admin_write"
  ON public.settings FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── PORTFOLIO ─────────────────────────────────
-- Public read published items
CREATE POLICY "portfolio_public_read"
  ON public.portfolio FOR SELECT
  USING (status = 'published');

-- Admins full access
CREATE POLICY "portfolio_admin_all"
  ON public.portfolio FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── ADMIT CARDS ───────────────────────────────
-- Only admins can read/write admit cards
CREATE POLICY "admit_cards_admin_only"
  ON public.admit_cards FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── PENDING CATEGORIES ────────────────────────
-- Anyone can INSERT a request (public submission)
CREATE POLICY "pending_categories_public_insert"
  ON public.pending_categories FOR INSERT
  WITH CHECK (true);

-- Admins can read and update
CREATE POLICY "pending_categories_admin_manage"
  ON public.pending_categories FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── ADMIN USERS ───────────────────────────────
-- Any authenticated user can check if they're an admin
CREATE POLICY "admin_users_read"
  ON public.admin_users FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can register as admin (bootstrap)
CREATE POLICY "admin_users_insert"
  ON public.admin_users FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ── SERVICES ──────────────────────────────────
-- Public read published services
CREATE POLICY "services_public_read"
  ON public.services FOR SELECT
  USING (status = 'published');

-- Admins full access
CREATE POLICY "services_admin_all"
  ON public.services FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── CONTACT MESSAGES ──────────────────────────
-- Anyone can submit a contact message
CREATE POLICY "contact_public_insert"
  ON public.contact_messages FOR INSERT
  WITH CHECK (true);

-- Admins can read/manage
CREATE POLICY "contact_admin_manage"
  ON public.contact_messages FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ──────────────────────────────────────────────
-- 9. STORAGE BUCKET (for uploads)
-- ──────────────────────────────────────────────
-- Run in Supabase Dashboard → Storage → New Bucket
-- Name: nexdiv-assets | Public: true
-- Then add policy: allow authenticated uploads

-- ──────────────────────────────────────────────
-- 10. UPDATED_AT TRIGGER (auto-update timestamps)
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_portfolio_updated_at
  BEFORE UPDATE ON public.portfolio
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_admit_cards_updated_at
  BEFORE UPDATE ON public.admit_cards
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
