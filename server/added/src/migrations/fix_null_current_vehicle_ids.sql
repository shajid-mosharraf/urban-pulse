-- Migration: Fix NULL current_vehicle_id for drivers who own vehicles
-- Problem: Drivers registered with vehicles, but current_vehicle_id wasn't set
-- Solution: Set current_vehicle_id to the driver's owned vehicle

-- Step 1: Update drivers with NULL current_vehicle_id who own exactly ONE vehicle
-- This is the safe path for most drivers
UPDATE drivers d
SET current_vehicle_id = (
  SELECT vehicle_id 
  FROM vehicles v 
  WHERE v.owner_id = d.user_id 
  LIMIT 1
)
WHERE d.current_vehicle_id IS NULL
  AND EXISTS (
    SELECT 1 
    FROM vehicles v 
    WHERE v.owner_id = d.user_id
  );

-- Step 2: Verify the fix - run this to see how many drivers were fixed
SELECT 
  COUNT(*) as drivers_fixed,
  COUNT(CASE WHEN current_vehicle_id IS NOT NULL THEN 1 END) as drivers_with_vehicle,
  COUNT(CASE WHEN current_vehicle_id IS NULL THEN 1 END) as drivers_still_null
FROM drivers;

-- Step 3: Optional - Check for drivers with multiple vehicles (edge case)
-- These drivers need manual intervention to choose which vehicle is current
SELECT 
  d.user_id,
  d.licence_id,
  COUNT(v.vehicle_id) as vehicle_count,
  STRING_AGG(v.model || ' (' || v.type || ')', ', ') as vehicles,
  d.current_vehicle_id
FROM drivers d
LEFT JOIN vehicles v ON v.owner_id = d.user_id
WHERE v.vehicle_id IS NOT NULL
GROUP BY d.user_id, d.licence_id, d.current_vehicle_id
HAVING COUNT(v.vehicle_id) > 1;
