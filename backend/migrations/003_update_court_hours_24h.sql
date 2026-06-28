-- Migration: Update all courts to open 24 hours (00:00 - 23:30)
-- This ensures all time slots from 00:00 to 23:30 are generated

UPDATE courts SET 
    open_time = '00:00',
    close_time = '23:30'
WHERE is_active = 1;
