-- Migration: Add achat_data column to charges table for storing achat line items
-- This column stores JSON array with fields: date, fournisseur, numBonEnlevement, numeroNexxio, montantHT
-- All existing data is preserved (new column is nullable)

ALTER TABLE charges ADD COLUMN IF NOT EXISTS achat_data TEXT NULL;
