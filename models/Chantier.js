const { pool } = require('../config/database');

class Chantier {
  static async getAll() {
    try {
      const [rows] = await pool.execute('SELECT * FROM chantiers ORDER BY dateSaisie DESC');
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
        dateFin,
        dateSaisie,
        etat
      } = data;

      // normalize helpers
      const toMySQLDateTime = (v) => {
        if (!v) return null;
        const d = v instanceof Date ? v : new Date(v);
        return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ');
      };
      const toMySQLDate = (v) => {
        if (!v) return null;
        // if already 'YYYY-MM-DD', keep it
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
        const d = v instanceof Date ? v : new Date(v);
        return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      };
      const toNumberOrNull = (v) => {
        if (v === null || v === undefined || v === '') return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      // Use exact column names from your database schema
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
          dateFin, 
          dateSaisie, 
          etat
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        nomChantier,
        numAttachement,
        client,
        natureTravail,
        adresseExecution || null,
        lieu || null,
        toNumberOrNull(prixPrestation),
        toMySQLDateTime(dateDebut),
        toMySQLDateTime(dateFin),
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
        dateFin,
        dateSaisie,
        etat
      } = data;

      // normalize helpers
      const toMySQLDateTime = (v) => {
        if (!v) return null;
        const d = v instanceof Date ? v : new Date(v);
        return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ');
      };
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
          dateFin = ?, 
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
        toMySQLDateTime(dateDebut),
        toMySQLDateTime(dateFin),
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

