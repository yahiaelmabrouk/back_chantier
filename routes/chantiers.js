const express = require("express");
const router = express.Router();
const Chantier = require("../models/Chantier");

// GET all chantiers
router.get("/", async (req, res) => {
  try {
    console.log("Fetching all chantiers...");
    const chantiers = await Chantier.find();
    console.log(`Found ${chantiers.length} chantiers`);
    res.json(chantiers);
  } catch (error) {
    console.error("Error fetching chantiers:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET chantier by ID
router.get("/:id", async (req, res) => {
  try {
    const chantier = await Chantier.findById(req.params.id);
    if (!chantier) {
      return res.status(404).json({ error: "Chantier not found" });
    }
    res.json(chantier);
  } catch (error) {
    console.error("Error fetching chantier by ID:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST create new chantier
router.post("/", async (req, res) => {
  try {
    const newChantier = new Chantier(req.body);
    const savedChantier = await newChantier.save();
    res.status(201).json(savedChantier);
  } catch (error) {
    console.error("Error creating chantier:", error);
    res.status(400).json({ error: error.message });
  }
});

// PUT update chantier
router.put("/:id", async (req, res) => {
  try {
    const updatedChantier = await Chantier.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedChantier) {
      return res.status(404).json({ error: "Chantier not found" });
    }
    res.json(updatedChantier);
  } catch (error) {
    console.error("Error updating chantier:", error);
    res.status(400).json({ error: error.message });
  }
});

// DELETE chantier
router.delete("/:id", async (req, res) => {
  try {
    const deletedChantier = await Chantier.findByIdAndDelete(req.params.id);
    if (!deletedChantier) {
      return res.status(404).json({ error: "Chantier not found" });
    }
    res.json({ message: "Chantier deleted successfully" });
  } catch (error) {
    console.error("Error deleting chantier:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
