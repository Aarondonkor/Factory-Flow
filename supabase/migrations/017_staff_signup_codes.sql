-- FactoryFlow: staff/employee signup now requires an admin-generated code.
--
-- WHY THIS IS ENFORCED IN THE DATABASE: the signup form is only a convenience.
-- Anyone can call the Supabase signup API directly with the public anon key,
-- so a check that lives only in the web page would not stop abuse. The check
-- below runs inside the signup trigger and cannot be bypassed from the browser.
--
-- ALSO CLOSES AN EXISTING HOLE: until now a non-customer signup took its role
-- from whatever the client sent in the signup metadata, so anybody could have
-- signed up as 'admin' by calling the API directly. The role for staff accounts
-- now comes ONLY from the code the admin generated.
--
-- Customers are unchanged: they self-register and still wait for admin approval.
--
-- FIRST ADMIN ON A BRAND-NEW DATABASE: nobody can sign up as staff without a
-- code, and codes are made by an admin. Bootstrap by creating a user in the
-- Supabase dashboard (Authentication -> Users) and setting their profiles.role
-- to 'admin'. Existing accounts are not affected by this migration.

-- ============ 1. Codes ============

-- Random, readable code like 'A3F9-0C71-9B2E' (48 bits, from the database's
-- cryptographically secure UUID generator).
CREATE OR REPLACE FUNCTION generate_staff_invite_code()
RETURNS TEXT AS $$
DECLARE
  v_hex TEXT := UPPER(REPLACE(gen_random_uuid()::TEXT, '-', ''));
BEGIN
  RETURN SUBSTR(v_hex, 1, 4) || '-' || SUBSTR(v_hex, 5, 4) || '-' || SUBSTR(v_hex, 9, 4);
END;
$$ LANGUAGE plpgsql VOLATILE SET search_path = public;

CREATE TABLE staff_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL DEFAULT generate_staff_invite_code(),
  code_key TEXT GENERATED ALWAYS AS (REPLACE(code, '-', '')) STORED,
  role user_role NOT NULL DEFAULT 'staff',
  note TEXT,
  max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses >= 1 AND max_uses <= 100),
  use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staff_invite_codes_code_key_unique UNIQUE (code_key),
  -- A code can never create an admin or a customer. Admin accounts are
  -- promoted by hand (see Settings), customers sign up on their own page.
  CONSTRAINT staff_invite_codes_role_allowed CHECK (
    role IN ('staff', 'sales_staff', 'production_supervisor', 'hr_officer')
  )
);

COMMENT ON TABLE staff_invite_codes IS
  'Admin-generated codes that new employees must enter when signing up. Checked inside handle_new_user().';

-- Who signed up with which code (audit trail).
CREATE TABLE staff_invite_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES staff_invite_codes(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_invite_uses_invite ON staff_invite_uses(invite_id);

-- ============ 2. Row level security: admins only ============

ALTER TABLE staff_invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_invite_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage invite codes" ON staff_invite_codes
  FOR ALL USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "Admin read invite uses" ON staff_invite_uses
  FOR SELECT USING (get_user_role() = 'admin');

-- ============ 3. Signup trigger: require and consume a code ============

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_is_customer BOOLEAN := COALESCE(NEW.raw_user_meta_data->>'role', '') = 'customer';
  v_role user_role;
  v_invite staff_invite_codes%ROWTYPE;
  v_key TEXT;
BEGIN
  IF v_is_customer THEN
    v_role := 'customer';
  ELSE
    -- Staff account. The role the client claims is ignored entirely; only a
    -- valid, unexpired, unused code can create one, and the code decides the role.
    v_key := REGEXP_REPLACE(UPPER(COALESCE(NEW.raw_user_meta_data->>'invite_code', '')), '[^A-Z0-9]', '', 'g');

    IF v_key = '' THEN
      RAISE EXCEPTION 'A staff signup code is required';
    END IF;

    -- Lock the row so two people can't both use the last remaining use.
    SELECT * INTO v_invite
    FROM staff_invite_codes
    WHERE code_key = v_key
      AND NOT revoked
      AND use_count < max_uses
      AND expires_at > NOW()
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid, expired or already used staff signup code';
    END IF;

    v_role := v_invite.role;

    UPDATE staff_invite_codes SET use_count = use_count + 1 WHERE id = v_invite.id;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    v_role
  );

  IF v_is_customer THEN
    INSERT INTO public.customers (
      owner_profile_id, name, business_name, contact_phone, contact_email, address, approval_status
    ) VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      NEW.raw_user_meta_data->>'business_name',
      NEW.raw_user_meta_data->>'contact_phone',
      NEW.email,
      NEW.raw_user_meta_data->>'address',
      'pending'
    );
  ELSE
    INSERT INTO public.employees (
      profile_id, full_name, role_title, contact_phone, contact_email, hire_date
    ) VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'role_title', ''), INITCAP(REPLACE(v_role::text, '_', ' '))),
      NEW.raw_user_meta_data->>'contact_phone',
      NEW.email,
      CURRENT_DATE
    );

    INSERT INTO public.staff_invite_uses (invite_id, profile_id) VALUES (v_invite.id, NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
