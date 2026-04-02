-- ============================================================
-- DIAGNOSTIC: Check which users are missing role assignments
-- ============================================================

-- 1. See all users and their role count
SELECT 
  u.user_id, 
  u.first_name, 
  u.last_name, 
  u.email, 
  u.phone,
  COUNT(ur.id) as assigned_roles,
  STRING_AGG(r.role_name, ', ') as role_names
FROM users u
LEFT JOIN user_role ur ON u.user_id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.role_id
GROUP BY u.user_id
ORDER BY u.user_id;

-- 2. Find users WITH restaurants but NO "restaurant" role
SELECT 
  u.user_id,
  u.email,
  r.restaurant_id,
  r.name as restaurant_name,
  ur.id as has_role
FROM users u
LEFT JOIN owners o ON u.user_id = o.user_id
LEFT JOIN restaurants r ON o.user_id = r.owner_id
LEFT JOIN user_role ur ON u.user_id = ur.user_id
WHERE r.restaurant_id IS NOT NULL
  AND ur.id IS NULL;

-- 3. Find users WITH customers record but NO "customer" role
SELECT 
  u.user_id,
  u.email,
  c.user_id as customer_exists,
  ur.id as has_role
FROM users u
LEFT JOIN customers c ON u.user_id = c.user_id
LEFT JOIN user_role ur ON u.user_id = ur.user_id
WHERE c.user_id IS NOT NULL
  AND ur.id IS NULL;
