-- Migration: Add sousEtat (substatus) column to chantiers table
-- This allows tracking substatus like 'facturé' when an invoice number is assigned
ALTER TABLE chantiers ADD COLUMN sousEtat VARCHAR(30) DEFAULT NULL;

-- Backfill: mark existing chantiers that already have a numBonFacture as 'facturé'
UPDATE chantiers SET sousEtat = 'facturé' WHERE numBonFacture IS NOT NULL AND TRIM(numBonFacture) != '';
