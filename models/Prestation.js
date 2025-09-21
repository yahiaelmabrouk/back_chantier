const db = require('../config/database');

class Prestation {
  static async getAll() {
    try {
      const query = 'SELECT * FROM prestations ORDER BY id DESC';
      console.log('Executing query:', query);
      const [rows] = await db.execute(query);
      console.log('Query result:', rows);
      return rows;
    } catch (error) {
      console.error('Error in Prestation.getAll:', error);
      throw error;
    }
  }

  static async getById(id) {
    try {
      const query = 'SELECT * FROM prestations WHERE id = ?';
      console.log('Executing query:', query, 'with id:', id);
      const [rows] = await db.execute(query, [id]);
      return rows[0];
    } catch (error) {
      console.error('Error in Prestation.getById:', error);
      throw error;
    }
  }

  static async create(prestationData) {
    try {
      const { name, prix_heure } = prestationData;
      const query = 'INSERT INTO prestations (name, prix_heure) VALUES (?, ?)';
      console.log('Executing query:', query, 'with data:', { name, prix_heure });
      const [result] = await db.execute(query, [name, prix_heure]);
      
      // Return the created prestation
      return this.getById(result.insertId);
    } catch (error) {
      console.error('Error in Prestation.create:', error);
      throw error;
    }
  }

  static async update(id, prestationData) {
    try {
      const { name, prix_heure } = prestationData;
      const query = 'UPDATE prestations SET name = ?, prix_heure = ? WHERE id = ?';
      await db.execute(query, [name, prix_heure, id]);
      
      // Return the updated prestation
      return this.getById(id);
    } catch (error) {
      console.error('Error in Prestation.update:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      const query = 'DELETE FROM prestations WHERE id = ?';
      const [result] = await db.execute(query, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error in Prestation.delete:', error);
      throw error;
    }
  }
}

module.exports = Prestation;

