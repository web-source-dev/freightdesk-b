-- FreightDesk USER database: schema + default admin user
-- Can be run in Supabase SQL Editor, or via: npm run seed:admin (with USER_SUPABASE_DB_PASSWORD in .env)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password TEXT,
  email TEXT,
  phone_support TEXT,
  anydesk_id TEXT,
  data_source_container TEXT NOT NULL DEFAULT 'A',
  accessed_websites TEXT DEFAULT '{ datone }',
  subscription_expiry TIMESTAMPTZ,
  max_tabs INTEGER DEFAULT 8,
  max_browser_instances INTEGER DEFAULT 1,
  account_manager TEXT,
  is_blocked BOOLEAN DEFAULT false,
  block_reason TEXT,
  failed_login_attempts INTEGER DEFAULT 0,
  last_login TIMESTAMPTZ,
  role TEXT DEFAULT 'user',
  is_admin BOOLEAN DEFAULT false,
  auto_load_enabled BOOLEAN DEFAULT false,
  device_fingerprint TEXT,
  device_registered_at TIMESTAMPTZ,
  last_device_change TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.users (
  username,
  password_hash,
  password,
  email,
  data_source_container,
  accessed_websites,
  subscription_expiry,
  max_tabs,
  max_browser_instances,
  role,
  is_admin,
  is_blocked,
  created_at,
  updated_at
) VALUES (
  'admin',
  'Admin@FreightDesk2026',
  'Admin@FreightDesk2026',
  'admin@freightdesk.local',
  'A',
  '{ datone }',
  now() + interval '365 days',
  8,
  1,
  'admin',
  true,
  false,
  now(),
  now()
)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  password = EXCLUDED.password,
  email = EXCLUDED.email,
  data_source_container = EXCLUDED.data_source_container,
  subscription_expiry = EXCLUDED.subscription_expiry,
  role = 'admin',
  is_admin = true,
  is_blocked = false,
  updated_at = now();
