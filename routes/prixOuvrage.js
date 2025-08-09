const express = require("express");
const router = express.Router();
const PrixOuvrage = require("../models/PrixOuvrage");

// Get all
router.get("/", async (req, res) => {
  try {
    const prix = await PrixOuvrage.find();
    res.json(prix);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get one
router.get("/:id", async (req, res) => {
  try {
    const prix = await PrixOuvrage.findById(req.params.id);
    if (!prix) return res.status(404).json({ message: "Not found" });
    res.json(prix);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create
router.post("/", async (req, res) => {
  try {
    const prix = new PrixOuvrage(req.body);
    await prix.save();
    res.status(201).json(prix);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update
router.put("/:id", async (req, res) => {
  try {
    const prix = await PrixOuvrage.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!prix) return res.status(404).json({ message: "Not found" });
    res.json(prix);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete
router.delete("/:id", async (req, res) => {
  try {
    const prix = await PrixOuvrage.findByIdAndDelete(req.params.id);
    if (!prix) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Supprimé avec succès" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
