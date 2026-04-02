-- ============================================================
-- FIX: Auto-Assign Missing Roles to Existing Users
-- ============================================================
-- This script finds users with records in customers/drivers/owners
-- tables but missing corresponding user_role entries,
-- and assigns the correct roles.

BEGIN;

-- 1. Assign "customer" role to all users in customers table without it
INSERT INTO user_role (user_id, role_id)
SELECT 
  c.user_id,
  r.role_id
FROM customers c
LEFT JOIN user_role ur ON c.user_id = ur.user_id
CROSS JOIN roles r
WHERE ur.id IS NULL
  AND r.role_name = 'customer'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 2. Assign "driver" role to all users in drivers table without it
INSERT INTO user_role (user_id, role_id)
SELECT 
  d.user_id,
  r.role_id
FROM drivers d
LEFT JOIN user_role ur ON d.user_id = ur.user_id
CROSS JOIN roles r
WHERE ur.id IS NULL
  AND r.role_name = 'driver'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 3. Assign "restaurant" role to all users in owners table without it
INSERT INTO user_role (user_id, role_id)
SELECT 
  o.user_id,
  r.role_id
FROM owners o
LEFT JOIN user_role ur ON o.user_id = ur.user_id
CROSS JOIN roles r
WHERE ur.id IS NULL
  AND r.role_name = 'restaurant'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 4. Verify roles were assigned
SELECT 
  u.user_id,
  u.email,
  STRING_AGG(r.role_name, ', ') as assigned_roles
FROM users u
LEFT JOIN user_role ur ON u.user_id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.role_id
WHERE ur.id IS NOT NULL
GROUP BY u.user_id, u.email
ORDER BY u.user_id;

COMMIT;
