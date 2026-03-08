CREATE INDEX IF NOT EXISTS idx_hall_assignments_roll ON hall_assignments(roll_number);
CREATE INDEX IF NOT EXISTS idx_hall_assignments_college_roll ON hall_assignments(college_id, roll_number);