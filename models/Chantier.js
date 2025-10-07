const { pool } = require('../config/database');

class Chantier {
  static async getAll() {
    try {
      // Use ORDER BY id DESC for compatibility (dateSaisie may not always exist)
      const [rows] = await pool.execute('SELECT * FROM chantiers ORDER BY id DESC');
      return rows;
    } catch (error) {
      console.error('Error in getAll:', error);
      throw error;
    }
  }

  static async getById(id) {
    try {
      const [rows] = await pool.execute('SELECT * FROM chantiers WHERE id = ?', [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error in getById:', error);
      throw error;
    }
  }

  static async create(data) {
    try {
      const {
        nomChantier,
        numAttachement,
        numeroCommande, // NEW
        client,
        natureTravail,
        adresseExecution,
        lieu,
        prixPrestation,
        dateDebut,
        heureDebut,
        dateFin,
        heureFin,
        dateSaisie,
        etat,
        numBonFacture
      } = data;

      // normalize helpers
      const toMySQLDate = (v) => {
        if (!v) return null;
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
        const d = v instanceof Date ? v : new Date(v);
        return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      };
      const toNumberOrNull = (v) => {
        if (v === null || v === undefined || v === '') return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      const toTime = (v) => {
        if (!v) return null;
        if (/^\d{2}:\d{2}$/.test(v)) return v;
        if (typeof v === 'string' && v.includes('T')) {
          // ISO string
          return v.split('T')[1]?.substring(0,5) || null;
        }
        return null;
      };

      // Insert with all columns
      const sql = `
        INSERT INTO chantiers (
          nomChantier, 
          numAttachement, 
          numeroCommande,         -- NEW
          client, 
          natureTravail, 
          adresseExecution, 
          lieu, 
          prixPrestation, 
          dateDebut, 
          heureDebut,
          dateFin, 
          heureFin,
          dateSaisie, 
          etat,
          numBonFacture
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        nomChantier,
        (numAttachement && String(numAttachement).trim()) || null,
        (numeroCommande && String(numeroCommande).trim()) || null,
        client,
        natureTravail,
        adresseExecution || null,
        lieu || null,
        toNumberOrNull(prixPrestation),
        toMySQLDate(dateDebut),
        toTime(heureDebut),
        toMySQLDate(dateFin),
        toTime(heureFin),
        toMySQLDate(dateSaisie) || new Date().toISOString().split('T')[0],
        etat || 'en cours',
        numBonFacture || null
      ];

      console.log('SQL:', sql);
      console.log('Values:', values);

      const [result] = await pool.execute(sql, values);
      
      // Return the created chantier
      return await this.getById(result.insertId);
    } catch (error) {
      console.error('Error in create:', error);
      throw error;
    }
  }

  static async update(id, data) {
    try {
      const {
        nomChantier,
        numAttachement,
        numeroCommande, // NEW
        client,
        natureTravail,
        adresseExecution,
        lieu,
        prixPrestation,
        dateDebut,
        heureDebut,
        dateFin,
        heureFin,
        dateSaisie,
        etat,
        numBonFacture
      } = data;

      // normalize helpers
      const toMySQLDate = (v) => {
        if (!v) return null;
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
        const d = v instanceof Date ? v : new Date(v);
        return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      };
      const toNumberOrNull = (v) => {
        if (v === null || v === undefined || v === '') return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      const toTime = (v) => {
        if (!v) return null;
        if (/^\d{2}:\d{2}$/.test(v)) return v;
        if (typeof v === 'string' && v.includes('T')) {
          // ISO string
          return v.split('T')[1]?.substring(0,5) || null;
        }
        return null;
      };

      const sql = `
        UPDATE chantiers SET
          nomChantier = ?,
          numAttachement = ?,
          numeroCommande = ?,   -- NEW
          client = ?,
          natureTravail = ?,
          adresseExecution = ?,
          lieu = ?,
          prixPrestation = ?,
          dateDebut = ?,
          heureDebut = ?,
          dateFin = ?,
          heureFin = ?,
          dateSaisie = ?,
          etat = ?,
          numBonFacture = ?
        WHERE id = ?
      `;

      const values = [
        nomChantier,
        (numAttachement && String(numAttachement).trim()) || null,
        (numeroCommande && String(numeroCommande).trim()) || null,
        client,
        natureTravail,
        adresseExecution || null,
        lieu || null,
        toNumberOrNull(prixPrestation),
        toMySQLDate(dateDebut),
        toTime(heureDebut),
        toMySQLDate(dateFin),
        toTime(heureFin),
        toMySQLDate(dateSaisie) || new Date().toISOString().split('T')[0],
        etat || 'en cours',
        numBonFacture || null,
        id
      ];

      const [result] = await pool.execute(sql, values);
      
      if (result.affectedRows === 0) {
        return null;
      }
      
      return await this.getById(id);
    } catch (error) {
      console.error('Error in update:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      const [result] = await pool.execute('DELETE FROM chantiers WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in delete:', error);
      throw error;
    }
  }

  // NEW: Build a map { chantierId: 'Plombier Name' } from charges.personnel JSON (more robust)
  static async getPlombiersMap() {
    const tableExists = async (table) => {
      const [rows] = await pool.execute(
        `SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
        [table]
      );
      return rows?.[0]?.c > 0;
    };
    const columnExists = async (table, column) => {
      const [rows] = await pool.execute(
        `SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        [table, column]
      );
      return rows?.[0]?.c > 0;
    };

    try {
      if (!(await tableExists('charges'))) return {};

      if (!(await columnExists('charges', 'personnel'))) return {};

      const idCandidates = ['chantierId', 'chantier_id', 'id_chantier', 'idChantier', 'chantier'];
      let cidCol = null;
      for (const c of idCandidates) {
        if (await columnExists('charges', c)) { cidCol = c; break; }
      }
      if (!cidCol) return {};

      // Prefetch prestations (id -> lowercased name) and salaries (id -> nom)
      let prestationsById = {};
      if (await tableExists('prestations')) {
        const [pr] = await pool.execute('SELECT id, name FROM prestations');
        pr.forEach(r => { prestationsById[String(r.id)] = (r.name || '').toString().trim().toLowerCase(); });
      }
      let salariesById = {};
      if (await tableExists('salaries')) {
        const [sr] = await pool.execute('SELECT id, nom FROM salaries');
        sr.forEach(r => { salariesById[String(r.id)] = r.nom; });
      }

      const sql = `
        SELECT id, ${cidCol} AS chantierId, personnel
        FROM charges
        WHERE personnel IS NOT NULL AND TRIM(personnel) <> ''
      `;
      const [rows] = await pool.execute(sql);
      const map = {};

      const normLower = (v) => (v ?? '').toString().trim().toLowerCase();
      const isPlombier = (v) => normLower(v) === 'plombier';

      const extractPrestationNameLower = (p) => {
        if (p?.prestation && typeof p.prestation === 'object') {
          return normLower(p.prestation.name);
        }
        const candidates = [
          p?.prestationType, p?.prestation, p?.prestation_name, p?.prestationName,
          p?.prestation_type, p?.typePrestation, p?.type
        ];
        const first = candidates.find(val => typeof val === 'string' && val.trim().length > 0);
        return normLower(first);
      };

      const extractPrestationId = (p) => p?.prestationId ?? p?.prestation_id ?? p?.prestationID ?? (
        (typeof p?.prestation === 'number' || /^\d+$/.test((p?.prestation || '').toString())) ? p.prestation : null
      );
      const extractSalarieId = (p) =>
        p?.salarieId ?? p?.salarie_id ?? p?.salarieID ?? p?.idSalarie ?? p?.id_salarie;

      for (const row of rows) {
        let parsed;
        try {
          parsed = JSON.parse(row.personnel || '[]');
        } catch {
          continue;
        }
        // Accept both plain arrays and wrapped shapes
        let personnelArr = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.entries) ? parsed.entries
          : Array.isArray(parsed?.data) ? parsed.data
          : Array.isArray(parsed?.list) ? parsed.list
          : Array.isArray(parsed?.rows) ? parsed.rows
          : [];

        if (!Array.isArray(personnelArr) || personnelArr.length === 0) continue;

        const plumber = personnelArr.find(p => {
          if (isPlombier(extractPrestationNameLower(p))) return true;
          const pid = extractPrestationId(p);
          if (pid != null && isPlombier(prestationsById[String(pid)])) return true;
          return false;
        });

        if (!plumber) continue;

        let plumberName =
          plumber.nom ||
          plumber.name ||
          plumber.salarie_nom ||
          (() => {
            const sid = extractSalarieId(plumber);
            return sid != null ? salariesById[String(sid)] : null;
          })() ||
          null;

        if (plumberName) {
          map[row.chantierId] = plumberName;
        }
      }

      return map;
    } catch (error) {
      console.error('Error in getPlombiersMap:', error);
      return {};
    }
  }
}
  

module.exports = Chantier;