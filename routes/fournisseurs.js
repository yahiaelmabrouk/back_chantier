const express = require("express");
const Fournisseur = require("../models/Fournisseur");
const router = express.Router();

// Get all fournisseurs
router.get("/", async (req, res) => {
  try {
    const fournisseurs = await Fournisseur.find();
    res.json(fournisseurs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a fournisseur
router.post("/", async (req, res) => {
  try {
    const { nom, budget } = req.body;
    const fournisseur = new Fournisseur({ nom, budget });
    await fournisseur.save();
    res.status(201).json(fournisseur);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update a fournisseur
router.put("/:id", async (req, res) => {
  try {
    const { nom, budget } = req.body;
    const fournisseur = await Fournisseur.findById(req.params.id);
    if (!fournisseur)
      return res.status(404).json({ error: "Fournisseur non trouvé" });

    fournisseur.nom = nom;
    fournisseur.budget = Number(budget);

    await fournisseur.save();
    res.json(fournisseur);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a fournisseur
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Fournisseur.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ error: "Fournisseur non trouvé" });
    res.json({ message: "Fournisseur supprimé" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
