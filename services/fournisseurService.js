const db = require('../config/database');

const fournisseurService = {
  // Get all fournisseurs
  getAll: async () => {
    try {
      const [rows] = await db.execute('SELECT * FROM fournisseurs ORDER BY name');
      return rows;
    } catch (error) {
      console.error('Error getting fournisseurs:', error);
      throw error;
    }
  },

  // Get fournisseur by ID
  getById: async (id) => {
    try {
      const [rows] = await db.execute('SELECT * FROM fournisseurs WHERE id = ?', [id]);
      return rows[0];
    } catch (error) {
      console.error('Error getting fournisseur by ID:', error);
      throw error;
    }
  },

  // Create new fournisseur
  create: async (fournisseurData) => {
    try {
      const { name, budget } = fournisseurData;
      const [result] = await db.execute(
        'INSERT INTO fournisseurs (name, budget) VALUES (?, ?)',
        [name, budget || 0]
      );
      return { id: result.insertId, name, budget: budget || 0 };
    } catch (error) {
      console.error('Error creating fournisseur:', error);
      throw error;
    }
  },

  // Update fournisseur
  update: async (id, fournisseurData) => {
    try {
      const { name, budget } = fournisseurData;
      await db.execute(
        'UPDATE fournisseurs SET name = ?, budget = ? WHERE id = ?',
        [name, budget, id]
      );
      return { id, name, budget };
    } catch (error) {
      console.error('Error updating fournisseur:', error);
      throw error;
    }
  },

  // Delete fournisseur
  delete: async (id) => {
    try {
      await db.execute('DELETE FROM fournisseurs WHERE id = ?', [id]);
      return { success: true };
    } catch (error) {
      console.error('Error deleting fournisseur:', error);
      throw error;
    }
  }
};

module.exports = fournisseurService;
