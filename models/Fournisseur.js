const { pool } = require('../config/database');

class Fournisseur {
  static async getAll() {
    try {
      const [rows] = await pool.query('SELECT * FROM fournisseurs ORDER BY name');
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async getById(id) {
    try {
      const [rows] = await pool.query('SELECT * FROM fournisseurs WHERE id = ?', [id]);
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async create(fournisseurData) {
    try {
      const query = `
        INSERT INTO fournisseurs 
        (name, budget) 
        VALUES (?, ?)
      `;
      
      const [result] = await pool.query(query, [
        fournisseurData.name,
        fournisseurData.budget || 0
      ]);
      
      return { id: result.insertId, ...fournisseurData };
    } catch (error) {
      throw error;
    }
  }

  static async update(id, fournisseurData) {
    try {
      const query = `
        UPDATE fournisseurs 
        SET name = ?, 
            budget = ?
        WHERE id = ?
      `;
      
      await pool.query(query, [
        fournisseurData.name,
        fournisseurData.budget,
        id
      ]);
      
      return { id, ...fournisseurData };
    } catch (error) {
      throw error;
    }
  }

  static async delete(id) {
    try {
      await pool.query('DELETE FROM fournisseurs WHERE id = ?', [id]);
      return { id };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Fournisseur;
     