const { pool } = require('../config/database');

// Get all frais de transport configurations
async function find() {
  try {
    const [rows] = await pool.execute('SELECT * FROM frais_transport_config');
    return rows;
  } catch (error) {
    console.error("Error fetching frais_transport_config:", error);
    // Fallback: try querying with different column names
    try {
      const [rows] = await pool.execute('SELECT id, name, prix FROM frais_transport_config');
      return rows;
    } catch (fallbackError) {
      console.error("Fallback query failed:", fallbackError);
      return [];
    }
  }
}

// Create a new frais de transport configuration
async function create(data) {
  try {
    const [result] = await pool.execute(
      'INSERT INTO frais_transport_config (name, prix) VALUES (?, ?)',
      [data.name, data.prix]
    );
    
    return {
      id: result.insertId,
      name: data.name,
      prix: data.prix
    };
  } catch (error) {
    console.error("Error creating frais_transport_config:", error);
    throw error;
  }
}

// Update a frais de transport configuration
async function update(id, data) {
  try {
    await pool.execute(
      'UPDATE frais_transport_config SET name = ?, prix = ? WHERE id = ?',
      [data.name, data.prix, id]
    );
    
    return {
      id,
      name: data.name,
      prix: data.prix
    };
  } catch (error) {
    console.error("Error updating frais_transport_config:", error);
    throw error;
  }
}

// Delete a frais de transport configuration
async function remove(id) {
  try {
    await pool.execute('DELETE FROM frais_transport_config WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error("Error deleting frais_transport_config:", error);
    throw error;
  }
}

module.exports = {
  find,
  create,
  update,
  remove
};
