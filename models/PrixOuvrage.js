const { pool } = require('../config/database');

class PrixOuvrage {
  static async getAll() {
    try {
      const [rows] = await pool.query('SELECT * FROM prix_ouvrage ORDER BY nom');
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async getById(id) {
    try {
      const [rows] = await pool.query('SELECT * FROM prix_ouvrage WHERE id = ?', [id]);
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async create(prixOuvrageData) {
    try {
      const query = `
        INSERT INTO prix_ouvrage 
        (nom, prix_mois) 
        VALUES (?, ?)
      `;
      
      const [result] = await pool.query(query, [
        prixOuvrageData.nom,
        prixOuvrageData.prix_mois
      ]);
      
      return { id: result.insertId, ...prixOuvrageData };
    } catch (error) {
      throw error;
    }
  }

  static async update(id, prixOuvrageData) {
    try {
      const query = `
        UPDATE prix_ouvrage 
        SET nom = ?, 
            prix_mois = ?
        WHERE id = ?
      `;
      
      await pool.query(query, [
        prixOuvrageData.nom,
        prixOuvrageData.prix_mois,
        id
      ]);
      
      return { id, ...prixOuvrageData };
    } catch (error) {
      throw error;
    }
  }

  static async delete(id) {
    try {
      await pool.query('DELETE FROM prix_ouvrage WHERE id = ?', [id]);
      return { id };
    } catch (error) {
      throw error;
    }
  }
}


module.exports = PrixOuvrage;
