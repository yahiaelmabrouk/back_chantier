const express = require('express');
const router = express.Router();
const PrixOuvrage = require('../models/PrixOuvrage');
const { distributeDailyPrixOuvrageCharges } = require('../services/chargeScheduler');

// ...existing routes...

// Manual trigger for daily charge distribution (for testing/admin use)
router.post('/distribute-daily-charges', async (req, res) => {
  try {
    await distributeDailyPrixOuvrageCharges();
    res.json({ success: true, message: 'Daily Prix Ouvrage charges distributed successfully' });
  } catch (error) {
    console.error('Error distributing charges:', error);
    res.status(500).json({ success: false, message: 'Error distributing charges', error: error.message });
  }
});

module.exports = router;
