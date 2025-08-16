const express = require("express");
const Salarie = require("../models/Salarie");
const router = express.Router();

// Get all salariés
router.get("/", async (req, res) => {
  try {
    const salaries = await Salarie.find();
    res.json(Array.isArray(salaries) ? salaries : []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a salarié
router.post("/", async (req, res) => {
  try {
    const { matricule, nom, tauxHoraire, aCamion } = req.body;
    // Robust boolean conversion for aCamion
    const isCamion =
      aCamion === true ||
      aCamion === "true" ||
      aCamion === 1 ||
      aCamion === "1";
    const salarie = new Salarie({
      matricule,
      nom,
      tauxHoraire,
      aCamion: isCamion,
    });
    await salarie.save();
    res.status(201).json(salarie);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update a salarié
router.put("/:id", async (req, res) => {
  try {
    const { matricule, nom, tauxHoraire, aCamion } = req.body;
    // Robust boolean conversion for aCamion
    const isCamion =
      aCamion === true ||
      aCamion === "true" ||
      aCamion === 1 ||
      aCamion === "1";
    const updated = await Salarie.findByIdAndUpdate(
      req.params.id,
      {
        matricule,
        nom,
        tauxHoraire,
        aCamion: isCamion,
      },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: "Salarié non trouvé" });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a salarié
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Salarie.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Salarié non trouvé" });
    res.json({ message: "Salarié supprimé" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
