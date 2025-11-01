Behavior: Auto 30% Achat vs. Provisoire/Réelles
----------------------------------------------

When a new chantier is created, the backend automatically creates an Achat charge equal to 30% of the chantier's budget (prixPrestation). This charge appears in the Provisoires view.

Editing this auto-created 30% Achat does not overwrite it. Instead, the backend creates a new Achat charge marked as real (réelles) with the edited amount and leaves the original provisional 30% charge unchanged. The frontend separates the two modes as follows:

- Provisoires: shows the auto 30% charge and hides any charges marked as isReelle=true.
- Réelles: hides the auto 30% charge and shows the newly created real charge.

Notes for database schema:

- The column `is_reelle` is added by migration `20251029_add_isreelle_to_charges.sql` (MySQL/MariaDB). If your DB doesn't support `ADD COLUMN IF NOT EXISTS`, add the column manually:

	MySQL/MariaDB:
		ALTER TABLE charges ADD COLUMN is_reelle TINYINT(1) DEFAULT 0;

	SQLite:
		ALTER TABLE charges ADD COLUMN is_reelle INTEGER DEFAULT 0;

Even without the column, the flag is stored inside the JSON `description`, and the API will still expose `isReelle` in responses.

