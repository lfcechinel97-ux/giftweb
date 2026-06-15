
-- Create two sistema users and grant admin access
DO $$
DECLARE
  v_uid uuid;
  v_users jsonb := '[
    {"email":"joao@giftwebbrindes.com.br","password":"123456789"},
    {"email":"dyego@giftwebbrindes.com.br","password":"123456789"}
  ]'::jsonb;
  u jsonb;
BEGIN
  FOR u IN SELECT * FROM jsonb_array_elements(v_users) LOOP
    SELECT id INTO v_uid FROM auth.users WHERE email = u->>'email';
    IF v_uid IS NULL THEN
      v_uid := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token, recovery_token, email_change_token_new, email_change
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
        u->>'email', crypt(u->>'password', gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, '', '', '', ''
      );
      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), v_uid, jsonb_build_object('sub', v_uid::text, 'email', u->>'email'), 'email', v_uid::text, now(), now(), now());
    END IF;
    INSERT INTO public.admin_users (id, email) VALUES (v_uid, u->>'email')
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;
