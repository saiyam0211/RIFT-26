-- Create Admin User for RIFT '26 Platform
-- This script creates a default admin account for initial setup

-- Admin credentials:
-- Email: admin@rift.com
-- Password: admin123

INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at) 
VALUES (
  gen_random_uuid(),
  'admin@rift.com',
  -- Password 'admin123' hashed with bcrypt (cost=10)
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'Admin User',
  'admin',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Verify the admin user was created
SELECT id, email, name, role, created_at 
FROM users 
WHERE email = 'admin@rift.com';
