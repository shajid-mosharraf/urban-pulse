-- Normalize all existing vehicle types to lowercase for consistency
-- This ensures that the matching logic in rideService works correctly
-- when filtering drivers by vehicle type

UPDATE vehicles 
SET type = LOWER(TRIM(type)) 
WHERE type IS NOT NULL 
  AND type <> LOWER(TRIM(type));

-- Verify the update
-- SELECT vehicle_id, type FROM vehicles WHERE type IS NOT NULL;
