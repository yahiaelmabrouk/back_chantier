const express = require("express");
const router = express.Router();
const FraisTransportConfig = require("../models/FraisTransportConfig");

// GET: Always return the latest config, create if none exists
router.get("/", async (req, res) => {
  let config = await FraisTransportConfig.findOne();
  if (!config) {
    config = await FraisTransportConfig.create({
      camion: 0,
      assurance: 0,
      carburant: 0,
      custom: [],
    });
  }
  res.json(config);
});

// PUT: Update the single config document (always update the same one)
router.put("/", async (req, res) => {
  try {
    let config = await FraisTransportConfig.findOne();
    if (!config) {
      config = await FraisTransportConfig.create({
        camion: 0,
        assurance: 0,
        carburant: 0,
        custom: [],
      });
    }
    config.camion = Number(req.body.camion) || 0;
    config.assurance = Number(req.body.assurance) || 0;
    config.carburant = Number(req.body.carburant) || 0;
    config.custom = Array.isArray(req.body.custom) ? req.body.custom : [];
    await config.save();
    res.json(config);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
