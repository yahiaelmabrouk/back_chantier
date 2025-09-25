require('dotenv').config();
const mysql = require('mysql2/promise');
const { Sequelize } = require('sequelize');

// Log the environment variables for debugging
console.log('Database config:', {
  name: process.env.DB_NAME || 'chantier_db',
  user: process.env.DB_USER || 'root',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306
});

// MySQL2 pool for raw queries (remove invalid options)
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chantier_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Sequelize instance for ORM
const sequelize = new Sequelize(
  process.env.DB_NAME || 'chantier_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Test the connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL2 connection successful');
    connection.release();
    
    await sequelize.authenticate();
    console.log('✅ Sequelize connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Please check your database configuration:');
    console.error('- Host:', process.env.DB_HOST || 'localhost');
    console.error('- User:', process.env.DB_USER || 'root');
    console.error('- Database:', process.env.DB_NAME || 'chantier_db');
  }
};

// Test connection on startup
testConnection();

// Add debugging for query execution
const originalExecute = pool.execute;
if (pool && typeof pool.execute === 'function') {
  pool.execute = async function(query, params) {
    console.log('DEBUG: Executing query:', query);
    console.log('DEBUG: With params:', params || []);
    try {
      const result = await originalExecute.call(this, query, params);
      console.log('DEBUG: Query success, result:', result);
      return result;
    } catch (error) {
      console.error('DEBUG: Query failed:', error.message);
      throw error;
    }
  };
}

// Export both for compatibility
module.exports = sequelize; // Default export for Sequelize models
module.exports.pool = pool; // Named export for raw MySQL2 queries
module.exports.execute = pool.execute.bind(pool); // For backward compatibility
