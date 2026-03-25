-- Diagnostic: Check all vehicle types in database to find inconsistencies
-- Run this to see if there are case/whitespace issues

SELECT 
  'DISTINCT VEHICLE TYPES' as "CHECK",
  v.type as vehicle_type,
  COUNT(*) as driver_count,
  STRING_AGG(d.user_id || ':' || u.first_name, ', ' ORDER BY d.user_id) as driver_ids
FROM vehicles v
LEFT JOIN drivers d ON d.user_id = v.owner_id
LEFT JOIN users u ON u.user_id = d.user_id
GROUP BY v.type
ORDER BY v.type;

-- Check for problematic NULL or empty vehicle types
SELECT 
  COUNT(*) as drivers_with_null_vehicle
FROM drivers d
WHERE d.current_vehicle_id IS NULL
   OR NOT EXISTS (
     SELECT 1 FROM vehicles v 
     WHERE v.vehicle_id = d.current_vehicle_id
   );

-- Check for whitespace issues (leading/trailing spaces)
SELECT 
  v.vehicle_id,
  d.user_id,
  '|' || v.type || '|' as type_with_pipes,
  LENGTH(v.type) as type_length,
  CASE 
    WHEN v.type != TRIM(v.type) THEN 'HAS WHITESPACE'
    WHEN v.type IS NULL THEN 'NULL'
    WHEN v.type = '' THEN 'EMPTY STRING'
    ELSE 'OK'
  END as issue
FROM vehicles v
LEFT JOIN drivers d ON d.user_id = v.owner_id
WHERE v.type IS NULL 
   OR v.type != TRIM(v.type)
   OR v.type = '';

-- Show a sample ride with its service_type for comparison
SELECT 
  r.ride_id,
  r.service_type,
  '|' || r.service_type || '|' as type_with_pipes,
  r.customer_id,
  r.driver_id,
  r.status,
  r.request_time
FROM rides r
ORDER BY r.ride_id DESC
LIMIT 5;
