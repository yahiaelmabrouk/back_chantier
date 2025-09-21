#!/usr/bin/env node

/**
 * Setup script for initializing the MySQL database
 * Run this with Node.js: node setup.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function question(query) {
  return new Promise(resolve => {
    rl.question(query, answer => {
      resolve(answer);
    });
  });
}

async function setupDatabase() {
  try {
    // Use the pool from config/database for raw connection testing
    const { pool } = require('./config/database');
    
    console.log('Testing database connection...');
    const connection = await pool.getConnection();
    console.log('✅ Database connection established successfully.');
    connection.release();

    // Test basic models that exist
    console.log('Testing model imports...');
    
    // Only import models that actually exist and don't use Sequelize
    const Chantier = require('./models/Chantier');
    const Fournisseur = require('./models/Fournisseur');
    const Prestation = require('./models/Prestation');
    const FraisTransportConfig = require('./models/FraisTransportConfig');
    const Charge = require('./models/Charge');
    
    console.log('✅ All models imported successfully.');

    // Test route imports
    console.log('Testing route imports...');
    try {
      const chantierRoutes = require('./routes/chantiers');
      console.log('✅ Chantier routes imported');
      
      const chargeRoutes = require('./routes/charges');
      console.log('✅ Charge routes imported');
      
      const fournisseurRoutes = require('./routes/fournisseurs');
      console.log('✅ Fournisseur routes imported');
      
      const prestationRoutes = require('./routes/prestations');
      console.log('✅ Prestation routes imported');
      
      console.log('✅ All route modules imported successfully.');
    } catch (routeError) {
      console.error('❌ Route import failed:', routeError.message);
      throw routeError;
    }

    // Test basic operations
    console.log('Testing database operations...');
    
    // Test basic queries
    const chantiers = await Chantier.getAll();
    console.log(`✅ Found ${chantiers.length} chantiers in database.`);
    
    const prestations = await Prestation.getAll();
    console.log(`✅ Found ${prestations.length} prestations in database.`);

    console.log('✅ Database setup completed successfully!');
    console.log('The application is ready to use.');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('Full error:', error);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Access denied. Please check your database credentials in .env file.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('Connection refused. Please make sure MySQL server is running.');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('Database does not exist. Please create the database first.');
    } else if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('Required database tables do not exist. Please create them first.');
    }
    
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the setup
setupDatabase();