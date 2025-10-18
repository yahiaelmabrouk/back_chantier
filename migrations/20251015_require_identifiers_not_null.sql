-- 1) Backfill any NULL/empty values with deterministic placeholders
UPDATE chantiers
SET numAttachement = CONCAT('ATT-', LPAD(id, 6, '0'))
WHERE numAttachement IS NULL OR TRIM(numAttachement) = '';

UPDATE chantiers
SET numeroCommande = CONCAT('CMD-', LPAD(id, 6, '0'))
WHERE numeroCommande IS NULL OR TRIM(numeroCommande) = '';

-- 2) Enforce NOT NULL constraints
ALTER TABLE chantiers
  MODIFY COLUMN numAttachement VARCHAR(255) NOT NULL,
  MODIFY COLUMN numeroCommande VARCHAR(255) NOT NULL;
