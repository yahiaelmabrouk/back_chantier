const express = require("express");
const router = express.Router();
const Prestation = require("../models/Prestation");

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "prestations",
    timestamp: new Date().toISOString(),
  });
});

// GET /api/prestations - List all prestations
router.get("/", async (req, res) => {
  try {
    console.log("Fetching all prestations...");
    const prestations = await Prestation.getAll();
    console.log("Prestations found:", prestations.length);
    res.json(prestations);
  } catch (error) {
    console.error("Error fetching prestations:", error);
    res.status(500).json({
      message: "Erreur lors de la récupération des prestations",
      error: error.message,
    });
  }
});

// GET /api/prestations/:id - Get single prestation
router.get("/:id", async (req, res) => {
  try {
    console.log("Fetching prestation with ID:", req.params.id);
    const prestation = await Prestation.getById(req.params.id);
    if (!prestation) {
      return res.status(404).json({ message: "Prestation introuvable" });
    }
    res.json(prestation);
  } catch (error) {
    console.error("Error fetching prestation:", error);
    res.status(500).json({
      message: "Erreur lors de la récupération de la prestation",
      error: error.message,
    });
  }
});

// POST /api/prestations - Create new prestation
router.post("/", async (req, res) => {
  try {
    const { name, prix_heure } = req.body;
    console.log("Creating prestation:", { name, prix_heure });

    // Validation
    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ message: "Le nom de la prestation est requis" });
    }

    if (!prix_heure || isNaN(prix_heure) || parseFloat(prix_heure) <= 0) {
      return res
        .status(400)
        .json({ message: "Le prix par heure doit être un nombre positif" });
    }

    const prestationData = {
      name: name.trim(),
      prix_heure: parseFloat(prix_heure),
    };

    const savedPrestation = await Prestation.create(prestationData);
    console.log("Prestation created:", savedPrestation);
    res.status(201).json(savedPrestation);
  } catch (error) {
    console.error("Error creating prestation:", error);
    res.status(500).json({
      message: "Erreur lors de la création de la prestation",
      error: error.message,
    });
  }
});

// PUT /api/prestations/:id - Update prestation
router.put("/:id", async (req, res) => {
  try {
    const { name, prix_heure } = req.body;
    console.log("Updating prestation:", req.params.id, { name, prix_heure });

    // Validation
    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ message: "Le nom de la prestation est requis" });
    }

    if (!prix_heure || isNaN(prix_heure) || parseFloat(prix_heure) <= 0) {
      return res
        .status(400)
        .json({ message: "Le prix par heure doit être un nombre positif" });
    }

    const prestationData = {
      name: name.trim(),
      prix_heure: parseFloat(prix_heure),
    };

    const updatedPrestation = await Prestation.update(req.params.id, prestationData);
    console.log("Prestation updated:", updatedPrestation);
    res.json(updatedPrestation);
  } catch (error) {
    console.error("Error updating prestation:", error);
    res.status(500).json({
      message: "Erreur lors de la mise à jour de la prestation",
      error: error.message,
    });
  }
});

// DELETE /api/prestations/:id - Delete prestation
router.delete("/:id", async (req, res) => {
  try {
    console.log("Deleting prestation:", req.params.id);
    await Prestation.delete(req.params.id);
    res.json({ message: "Prestation supprimée avec succès" });
  } catch (error) {
    console.error("Error deleting prestation:", error);
    res.status(500).json({
      message: "Erreur lors de la suppression de la prestation",
      error: error.message,
    });
  }
});

module.exports = router;
