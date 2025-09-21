const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'API is running' }); // Return JSON instead of text
});

// Catch-all for any GET request that's not explicitly handled
router.get('*', (req, res) => {
  res.status(200).json({ message: 'Login API is running' });
});

// Fallback login to keep admin/wissem working post-migration
async function handleLogin(req, res, next) {
  try {
    console.log('Login handler reached with body:', req.body);
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Fallback credentials to unblock access if DB user seeding is missing
    if (username === 'admin' && password === 'wissem') {
      console.log('Admin credentials matched, returning token');
      return res.status(200).json({
        token: 'dev-admin',
        user: { username: 'admin', role: 'admin' }
      });
    }

    // Check for required fields
    if (!username || !password) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }

    console.log('Login attempt:', username);

    // Authenticate user
    const authResult = await User.authenticate(username, password);
    if (!authResult) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    res.json(authResult);
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Invalid credentials' });
  }
}

// @route   POST /login
// @desc    Authenticate user & get token
// @access  Public
// Make sure these routes are in this specific order
router.post('/authenticate', handleLogin);
router.post('/login', handleLogin);
router.post('/', handleLogin);

module.exports = router;
