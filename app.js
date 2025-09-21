// Load environment variables early
require("dotenv").config();

const express = require("express");
const cors = require("cors");

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const chargeRoutes = require('./routes/charges');
const fournisseurRoutes = require('./routes/fournisseurs');
const salarieRoutes = require('./routes/salaries');
const prestationRoutes = require('./routes/prestations');
const prixOuvrageRoutes = require('./routes/prixOuvrage');
const chantierRoutes = require('./routes/chantiers');
const fraisTransportConfigRoutes = require('./routes/fraisTransportConfig');
const loginRoutes = require('./routes/login');

// Use routes
app.use('/api/charges', chargeRoutes);
app.use('/api/fournisseurs', fournisseurRoutes);
app.use('/api/salaries', salarieRoutes);
app.use('/api/prestations', prestationRoutes);
app.use('/api/prix-ouvrage', prixOuvrageRoutes);
app.use('/api/chantiers', chantierRoutes);
app.use('/api/frais-transport-config', fraisTransportConfigRoutes);
app.use('/api/honoraires', honoraireRoutes);
app.use('/api', loginRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;