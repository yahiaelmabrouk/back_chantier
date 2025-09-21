-- database-schema.sql
-- First create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS chantierdb;

-- Use the database
USE chantierdb;

-- Drop tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS charges;
DROP TABLE IF EXISTS prestations;
DROP TABLE IF EXISTS honoraires;
DROP TABLE IF EXISTS frais_transport_config;
DROP TABLE IF EXISTS prix_ouvrage;
DROP TABLE IF EXISTS fournisseurs;
DROP TABLE IF EXISTS salaries;
DROP TABLE IF EXISTS chantiers;
DROP TABLE IF EXISTS users;

-- Create Users table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Chantiers table
CREATE TABLE chantiers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom_chantier VARCHAR(255) NOT NULL,
  num_attachement VARCHAR(100),
  client VARCHAR(255),
  nature_travail VARCHAR(255),
  adresse_execution VARCHAR(255),
  lieu VARCHAR(255),
  prix_prestation DECIMAL(15, 2),
  date_debut DATE,
  heure_debut VARCHAR(10),
  date_fin DATE,
  heure_fin VARCHAR(10),
  date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  etat VARCHAR(20) DEFAULT 'en cours'
);

-- Create Salaries table
CREATE TABLE IF NOT EXISTS `salaries` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nom` VARCHAR(150) NOT NULL,
  `prenom` VARCHAR(150) NOT NULL,
  `poste` VARCHAR(150) NULL,
  `salaire_horaire` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `telephone` VARCHAR(50) NULL,
  `email` VARCHAR(255) NULL,
  `statut` ENUM('actif','inactif') NOT NULL DEFAULT 'actif',
  `date_embauche` DATE NULL,
  `adresse` TEXT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_salaries_nom` (`nom`),
  KEY `idx_salaries_prenom` (`prenom`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create Fournisseurs table
CREATE TABLE fournisseurs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  tel VARCHAR(20),
  email VARCHAR(255),
  adresse VARCHAR(255),
  type VARCHAR(100),
  date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Prix Ouvrage table
CREATE TABLE prix_ouvrage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  designation VARCHAR(255) NOT NULL,
  unite VARCHAR(50),
  prix_unitaire DECIMAL(15, 2),
  date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create FraisTransportConfig table
CREATE TABLE frais_transport_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  prix DECIMAL(10, 2) NOT NULL
);

-- Create Honoraires table
CREATE TABLE honoraires (
  id INT AUTO_INCREMENT PRIMARY KEY,
  chantier_id INT,
  montant DECIMAL(15, 2),
  mois INT,
  annee INT,
  date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chantier_id) REFERENCES chantiers(id) ON DELETE CASCADE
);

-- Create Prestations table (updated)
-- Remove legacy FK/indexes and chantier-specific columns
DROP TABLE IF EXISTS prestations;
CREATE TABLE prestations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  prix_heure DECIMAL(10,2) NOT NULL DEFAULT 0
);

-- Create Charges table
CREATE TABLE charges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  chantier_id INT,
  type VARCHAR(50),
  description VARCHAR(255),
  budget DECIMAL(15, 2),
  fournisseur_id INT NULL,
  salarie_id INT NULL,
  date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chantier_id) REFERENCES chantiers(id) ON DELETE CASCADE,
  FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id) ON DELETE SET NULL,
  FOREIGN KEY (salarie_id) REFERENCES salaries(id) ON DELETE SET NULL
);

-- Insert initial frais_transport_config
INSERT INTO frais_transport_config (tarif_km) VALUES (0.50);

-- Insert an admin user (password: admin123)
INSERT INTO users (username, password, role) VALUES ('admin', '$2a$10$KbG4Yhwk1eSQiAHs.aBfXOb3T2F9cRCh9CjbYKPbFsazaCKW3Yjx.', 'admin');

-- Optional migration helpers to fix an existing inconsistent table
-- If your table is named `salarie` or has camelCase columns, run the statements that apply.
-- RENAME TABLE salarie TO salaries;
-- ALTER TABLE salaries CHANGE COLUMN salaireHoraire salaire_horaire DECIMAL(10,2) NOT NULL DEFAULT 0;
-- ALTER TABLE salaries CHANGE COLUMN dateEmbauche date_embauche DATE NULL;
-- ALTER TABLE salaries ADD COLUMN IF NOT EXISTS statut ENUM('actif','inactif') NOT NULL DEFAULT 'actif';
-- ALTER TABLE salaries ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- ALTER TABLE salaries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
-- ALTER TABLE salaries MODIFY COLUMN nom VARCHAR(150) NOT NULL, MODIFY COLUMN prenom VARCHAR(150) NOT NULL;

-- ============================
-- Migration: update legacy salaries table to the new schema
-- Run these queries against your existing DB that currently has columns:
-- id, nom, prenom, tel, profession, taux_horaire, actif, date_creation
-- Note: Uncomment and execute in order. If your table is named `salarie`, rename it first.

-- RENAME TABLE salarie TO salaries;

-- 1) Convert table charset/collation
-- ALTER TABLE salaries CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2) Rename legacy columns to new names and adjust types
-- ALTER TABLE salaries CHANGE COLUMN tel telephone VARCHAR(50) NULL;
-- ALTER TABLE salaries CHANGE COLUMN profession poste VARCHAR(150) NULL;
-- ALTER TABLE salaries CHANGE COLUMN taux_horaire salaire_horaire DECIMAL(10,2) NOT NULL DEFAULT 0;

-- 3) Add new columns
-- ALTER TABLE salaries ADD COLUMN email VARCHAR(255) NULL AFTER telephone;
-- ALTER TABLE salaries ADD COLUMN statut ENUM('actif','inactif') NOT NULL DEFAULT 'actif' AFTER email;
-- ALTER TABLE salaries ADD COLUMN date_embauche DATE NULL AFTER statut;
-- ALTER TABLE salaries ADD COLUMN adresse TEXT NULL AFTER date_embauche;
-- ALTER TABLE salaries ADD COLUMN notes TEXT NULL AFTER adresse;

-- 4) Migrate actif -> statut, then drop actif
-- UPDATE salaries SET statut = CASE WHEN actif = 1 THEN 'actif' ELSE 'inactif' END;
-- ALTER TABLE salaries DROP COLUMN actif;

-- 5) Rename timestamps and add updated_at
-- ALTER TABLE salaries CHANGE COLUMN date_creation created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
-- ALTER TABLE salaries ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- 6) Tweak sizes for names
-- ALTER TABLE salaries MODIFY COLUMN nom VARCHAR(150) NOT NULL, MODIFY COLUMN prenom VARCHAR(150) NOT NULL;

-- 7) Add helpful indexes
-- CREATE INDEX idx_salaries_nom ON salaries(nom);
-- CREATE INDEX idx_salaries_prenom ON salaries(prenom);
-- ============================

-- ============================
-- EXECUTABLE migration to align existing `salaries` table with the new schema
-- Run these in production/staging to migrate your current columns:
-- id, nom, prenom, tel, profession, taux_horaire, actif, date_creation
ALTER TABLE salaries CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE salaries CHANGE COLUMN tel telephone VARCHAR(50) NULL;
ALTER TABLE salaries CHANGE COLUMN profession poste VARCHAR(150) NULL;
ALTER TABLE salaries CHANGE COLUMN taux_horaire salaire_horaire DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE salaries ADD COLUMN email VARCHAR(255) NULL AFTER telephone;
ALTER TABLE salaries ADD COLUMN statut ENUM('actif','inactif') NOT NULL DEFAULT 'actif' AFTER email;
ALTER TABLE salaries ADD COLUMN date_embauche DATE NULL AFTER statut;
ALTER TABLE salaries ADD COLUMN adresse TEXT NULL AFTER date_embauche;
ALTER TABLE salaries ADD COLUMN notes TEXT NULL AFTER adresse;

UPDATE salaries SET statut = CASE WHEN actif = 1 THEN 'actif' ELSE 'inactif' END;
ALTER TABLE salaries DROP COLUMN actif;

ALTER TABLE salaries CHANGE COLUMN date_creation created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE salaries ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

ALTER TABLE salaries MODIFY COLUMN nom VARCHAR(150) NOT NULL, MODIFY COLUMN prenom VARCHAR(150) NOT NULL;

CREATE INDEX idx_salaries_nom ON salaries(nom);
CREATE INDEX idx_salaries_prenom ON salaries(prenom);
-- ============================

-- ============================
-- Migration: reshape salaries table to minimal attributes used by the app
-- Keep id PK for relations; keep created_at/updated_at optional

-- If the table has many extra columns, drop the ones not needed
ALTER TABLE salaries
  DROP COLUMN IF EXISTS prenom,
  DROP COLUMN IF EXISTS telephone,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS statut,
  DROP COLUMN IF EXISTS date_embauche,
  DROP COLUMN IF EXISTS adresse,
  DROP COLUMN IF EXISTS notes,
  DROP COLUMN IF EXISTS poste;

-- Ensure required columns exist and have proper types
ALTER TABLE salaries
  ADD COLUMN IF NOT EXISTS matricule VARCHAR(255) NOT NULL AFTER id,
  ADD COLUMN IF NOT EXISTS nom VARCHAR(255) NOT NULL AFTER matricule,
  ADD COLUMN IF NOT EXISTS taux_horaire INT NULL AFTER nom,
  ADD COLUMN IF NOT EXISTS acamion TINYINT(1) NOT NULL DEFAULT 0 AFTER taux_horaire;

-- If taux_horaire exists with wrong type, fix it
ALTER TABLE salaries MODIFY COLUMN taux_horaire INT NULL;
-- Ensure acamion is boolean-like
ALTER TABLE salaries MODIFY COLUMN acamion TINYINT(1) NOT NULL DEFAULT 0;

-- Optional: keep timestamps
ALTER TABLE salaries
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER acamion,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- Indexes helpful for lookups
CREATE INDEX IF NOT EXISTS idx_salaries_nom ON salaries(nom);
CREATE INDEX IF NOT EXISTS idx_salaries_matricule ON salaries(matricule);
-- ============================