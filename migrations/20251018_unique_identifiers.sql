-- Ensure unique values for numAttachement and numeroCommande in chantiers
-- 0) Make sure both columns exist; numeroCommande migration already added earlier
-- If your schema uses snake_case, adapt accordingly.

-- 1) Trim spaces and normalize empty strings to NULL temporarily
UPDATE chantiers SET numAttachement = TRIM(numAttachement);
UPDATE chantiers SET numeroCommande = TRIM(numeroCommande);
UPDATE chantiers SET numAttachement = NULL WHERE numAttachement IS NOT NULL AND numAttachement = '';
UPDATE chantiers SET numeroCommande = NULL WHERE numeroCommande IS NOT NULL AND numeroCommande = '';

-- 2) Backfill NULLs with deterministic placeholders so we can enforce NOT NULL safely
UPDATE chantiers SET numAttachement = CONCAT('ATT-', LPAD(id, 6, '0')) WHERE numAttachement IS NULL;
UPDATE chantiers SET numeroCommande = CONCAT('CMD-', LPAD(id, 6, '0')) WHERE numeroCommande IS NULL;

-- 3) Resolve duplicates by keeping the smallest id's value and suffixing others with -DUP-<id>
-- MySQL 5.7+ compatible approach using user-defined variables (no window functions)

-- For numAttachement
SET @grp := NULL, @rn := 0;
UPDATE chantiers c
JOIN (
  SELECT id,
         IF(@grp = k, @rn := @rn + 1, @rn := 1) AS rn,
         @grp := k AS grp
  FROM (
    SELECT id, TRIM(numAttachement) AS k
    FROM chantiers
    ORDER BY k, id
  ) t
  CROSS JOIN (SELECT @grp := NULL, @rn := 0) vars
) r ON c.id = r.id
SET c.numAttachement = CONCAT(c.numAttachement, '-DUP-', c.id)
WHERE r.rn > 1;

-- For numeroCommande
SET @grp2 := NULL, @rn2 := 0;
UPDATE chantiers c
JOIN (
  SELECT id,
         IF(@grp2 = k, @rn2 := @rn2 + 1, @rn2 := 1) AS rn,
         @grp2 := k AS grp
  FROM (
    SELECT id, TRIM(numeroCommande) AS k
    FROM chantiers
    ORDER BY k, id
  ) t
  CROSS JOIN (SELECT @grp2 := NULL, @rn2 := 0) vars
) r ON c.id = r.id
SET c.numeroCommande = CONCAT(c.numeroCommande, '-DUP-', c.id)
WHERE r.rn > 1;

-- 4) Make both columns NOT NULL and add unique indexes
ALTER TABLE chantiers
  MODIFY COLUMN numAttachement VARCHAR(255) NOT NULL,
  MODIFY COLUMN numeroCommande VARCHAR(255) NOT NULL;

-- 5) Add unique indexes (names are explicit to make error messages detectable)
CREATE UNIQUE INDEX uc_chantiers_numAttachement ON chantiers (numAttachement);
CREATE UNIQUE INDEX uc_chantiers_numeroCommande ON chantiers (numeroCommande);
