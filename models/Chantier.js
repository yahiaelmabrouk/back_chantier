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
        etat
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
          etat
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        nomChantier,
        numAttachement,
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
        etat || 'en cours'
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
        etat
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
          etat = ?
        WHERE id = ?
      `;

      const values = [
        nomChantier,
        numAttachement,
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
}

module.exports = Chantier;

