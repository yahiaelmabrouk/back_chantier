-- Adds a boolean-like column to mark charges as real (réelles) vs provisional (provisoires)
-- MySQL/MariaDB flavor
ALTER TABLE charges
	ADD COLUMN IF NOT EXISTS is_reelle TINYINT(1) DEFAULT 0;

-- SQLite fallback (will no-op on MySQL); executed separately in SQLite contexts
-- Note: SQLite doesn't support IF NOT EXISTS for columns; wrap execution accordingly in your migration runner
-- ALTER TABLE charges ADD COLUMN is_reelle INTEGER DEFAULT 0;
