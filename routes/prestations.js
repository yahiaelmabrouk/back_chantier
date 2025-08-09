const express = require("express");
const router = express.Router();
const Prestation = require("../models/Prestation");

// Get all prestations
router.get("/", async (req, res) => {
  try {
    const prestations = await Prestation.find();
    res.json(prestations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get one prestation
router.get("/:id", async (req, res) => {
  try {
    const prestation = await Prestation.findById(req.params.id);
    if (!prestation) return res.status(404).json({ error: "Not found" });
    res.json(prestation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create prestation
router.post("/", async (req, res) => {
  try {
    const { typePrestation, prixHeure } = req.body;
    const prestation = new Prestation({ typePrestation, prixHeure });
    await prestation.save();
    res.status(201).json(prestation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update prestation
router.put("/:id", async (req, res) => {
  try {
    const { typePrestation, prixHeure } = req.body;
    const prestation = await Prestation.findByIdAndUpdate(
      req.params.id,
      { typePrestation, prixHeure },
      { new: true, runValidators: true }
    );
    if (!prestation) return res.status(404).json({ error: "Not found" });
    res.json(prestation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete prestation
router.delete("/:id", async (req, res) => {
  try {
    const prestation = await Prestation.findByIdAndDelete(req.params.id);
    if (!prestation) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Prestation supprimée" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
