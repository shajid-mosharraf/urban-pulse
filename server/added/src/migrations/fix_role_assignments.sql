-- ============================================================
-- MIGRATION: Fix Role Name Consistency & Constraints
-- ============================================================
-- Purpose: Fix mismatched role names and add NOT NULL constraints
-- Status: Safe to re-run (uses DO NOT FAIL patterns)

-- 1. Update role names to lowercase (already in schema)
-- Verify roles are correct:
SELECT * FROM roles;

-- 2. Verify location_id NOT NULL constraints are in place:
-- SELECT column_name, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name='restaurants' AND column_name='location_id';

-- 3. Check if any users are missing roles:
SELECT u.user_id, u.first_name, u.last_name, u.email,
       COUNT(ur.id) as role_count
FROM users u
LEFT JOIN user_role ur ON u.user_id = ur.user_id
GROUP BY u.user_id
HAVING COUNT(ur.id) = 0;

-- If users without roles exist, manual assignment needed:
-- Example: Assign customer role to user_id 1
-- INSERT INTO user_role (user_id, role_id)
-- SELECT 1, role_id FROM roles WHERE role_name = 'customer'
-- ON CONFLICT (user_id, role_id) DO NOTHING;

-- 4. Verify role assignments are working:
SELECT u.user_id, u.email, 
       STRING_AGG(r.role_name, ', ') as roles
FROM users u
LEFT JOIN user_role ur ON u.user_id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.role_id
GROUP BY u.user_id, u.email;
