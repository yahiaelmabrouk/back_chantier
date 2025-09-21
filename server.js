// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log all requests for debugging
app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('Received data:', req.body);
  }
  next();
});

// Test database connection on startup
const testDatabaseConnection = async () => {
  try {
    const { pool } = require('./config/database');
    const connection = await pool.getConnection();
    console.log('✅ Database connection successful');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
};

// Load routes with proper error handling
console.log('Loading routes...');

// Add login route first to ensure it has priority
try {
  app.use('/api/login', require('./routes/login'));
  console.log('✅ Login routes loaded');
} catch (error) {
  console.error('❌ Login routes failed:', error.message);
}

// Core routes
try {
  app.use('/api/chantiers', require('./routes/chantiers'));
  console.log('✅ Chantier routes loaded');
} catch (error) {
  console.error('❌ Chantier routes failed:', error.message);
}

try {
  app.use('/api/prestations', require('./routes/prestations'));
  console.log('✅ Prestation routes loaded');
} catch (error) {
  console.error('❌ Prestation routes failed:', error.message);
}

try {
  app.use('/api/fournisseurs', require('./routes/fournisseurs'));
  console.log('✅ Fournisseur routes loaded');
} catch (error) {
  console.error('❌ Fournisseur routes failed:', error.message);
}

try {
  app.use('/api/charges', require('./routes/charges'));
  console.log('✅ Charge routes loaded');
} catch (error) {
  console.error('❌ Charge routes failed:', error.message);
}

// Optional routes - Remove login from here since we already loaded it
const optionalRoutes = [
  { path: '/api/salaries', file: './routes/salaries', name: 'Salaries' },
  { path: '/api/frais-transport-config', file: './routes/fraisTransportConfig', name: 'Frais Transport Config' },
  { path: '/api/prix-ouvrage', file: './routes/prixOuvrage', name: 'Prix Ouvrage' }
];

optionalRoutes.forEach(route => {
  try {
    const routeModule = require(route.file);
    if (typeof routeModule === 'function' || (routeModule && typeof routeModule.use === 'function')) {
      app.use(route.path, routeModule);
      console.log(`✅ ${route.name} routes loaded`);
    } else {
      console.warn(`⚠️ ${route.name} routes skipped - invalid export`);
    }
  } catch (error) {
    console.warn(`⚠️ ${route.name} routes skipped:`, error.message);
  }
});

// Health check endpoint - make sure this comes AFTER loading the login routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Server error', message: err.message });
});

// Import the charge scheduler
const { initChargeScheduler } = require('./services/chargeScheduler');

// Start server (only once!)
const startServer = async () => {
  try {
    console.log('Starting server...');

    // Test database connection
    await testDatabaseConnection();

    // Initialize the charge scheduler after database connection is confirmed
    console.log('Initializing daily Prix Ouvrage charge scheduler...');
    initChargeScheduler();

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
