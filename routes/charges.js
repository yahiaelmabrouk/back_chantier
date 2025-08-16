const express = require("express");
const router = express.Router();
const Charge = require("../models/Charge");

// Récupérer toutes les charges d'un chantier
router.get("/chantier/:chantierId", async (req, res) => {
  try {
    const charges = await Charge.find({ chantierId: req.params.chantierId });
    res.json(charges);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Créer une nouvelle charge
router.post("/", async (req, res) => {
  try {
    console.log("[POST /api/charges] Payload:", JSON.stringify(req.body)); // Debug log
    if (req.body.type === "Charges de personnel") {
      if (
        !Array.isArray(req.body.personnel) ||
        req.body.personnel.length === 0
      ) {
        return res.status(400).json({ message: "Aucun salarié sélectionné." });
      }
      // Calculate total hours if not provided
      const transportCharges = [];
      for (const p of req.body.personnel) {
        if (!p.totalHeures && Array.isArray(p.dates)) {
          let totalHeures = 0;
          p.dates.forEach((d) => {
            if (
              typeof d.heureDebut === "number" &&
              typeof d.heureFin === "number" &&
              d.heureFin > d.heureDebut
            ) {
              totalHeures += d.heureFin - d.heureDebut;
            }
          });
          p.totalHeures = totalHeures;
          p.total = (p.tauxHoraire || 0) * totalHeures;
        }
        // Add fraisCamion if salarie has a camion
        if (p.salarieId) {
          const Salarie = require("../models/Salarie");
          const salarie = await Salarie.findById(p.salarieId);
          if (salarie && salarie.aCamion) {
            p.fraisCamion = 85;
            p.total = (p.total || 0) + 85;
            // Add frais de transport charge
            transportCharges.push({
              chantierId: req.body.chantierId,
              type: "Autre",
              customType: "frais de transport",
              name: "transport",
              budget: 85,
              description: `Frais de transport pour le salarié ${salarie.nom}`,
            });
          }
        }
      }
      req.body.budget = req.body.personnel.reduce(
        (sum, p) => sum + (p.total || 0),
        0
      );
      // Save the personnel charge
      const charge = new Charge(req.body);
      const savedCharge = await charge.save();
      // Save transport charges if any
      if (transportCharges.length > 0) {
        await Charge.insertMany(transportCharges);
      }
      return res.status(201).json(savedCharge);
    }
    // Optionally, validate structure based on type here
    const charge = new Charge(req.body);
    const savedCharge = await charge.save();
    res.status(201).json(savedCharge);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Mettre à jour une charge
router.put("/:id", async (req, res) => {
  try {
    console.log("[PUT /api/charges/:id] Payload:", JSON.stringify(req.body)); // Debug log
    // Special logic for replacing initial 30% achat charge
    const charge = await Charge.findById(req.params.id);
    if (!charge) {
      return res.status(404).json({ message: "Charge non trouvée" });
    }

    // If it's the initial achat charge and user is editing it
    if (
      charge.type === "Achat" &&
      charge.name === "Achat initial (30% du budget travaux)" &&
      req.body.type === "Achat" &&
      req.body.name !== "Achat initial (30% du budget travaux)"
    ) {
      // Replace with user-entered achat details
      charge.name = req.body.name;
      charge.budget = req.body.budget;
      charge.pieces = req.body.pieces;
      charge.description = req.body.description;
      // Optionally update other fields if needed
      await charge.save();
      return res.json(charge);
    }

    // --- Add fraisCamion logic for update ---
    if (req.body.type === "Charges de personnel" && Array.isArray(req.body.personnel)) {
      const transportCharges = [];
      for (const p of req.body.personnel) {
        if (!p.totalHeures && Array.isArray(p.dates)) {
          let totalHeures = 0;
          p.dates.forEach((d) => {
            if (
              typeof d.heureDebut === "number" &&
              typeof d.heureFin === "number" &&
              d.heureFin > d.heureDebut
            ) {
              totalHeures += d.heureFin - d.heureDebut;
            }
          });
          p.totalHeures = totalHeures;
          p.total = (p.tauxHoraire || 0) * totalHeures;
        }
        // Add fraisCamion if salarie has a camion
        if (p.salarieId) {
          const Salarie = require("../models/Salarie");
          const salarie = await Salarie.findById(p.salarieId);
          if (salarie && salarie.aCamion) {
            p.fraisCamion = 85;
            p.total = (p.total || 0) + 85;
            // Add frais de transport charge
            transportCharges.push({
              chantierId: req.body.chantierId,
              type: "Autre",
              customType: "frais de transport",
              name: "transport",
              budget: 85,
              description: `Frais de transport pour le salarié ${salarie.nom}`,
            });
          }
        }
      }
      req.body.budget = req.body.personnel.reduce(
        (sum, p) => sum + (p.total || 0),
        0
      );
      // Normal update
      const updatedCharge = await Charge.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
      // Save transport charges if any
      if (transportCharges.length > 0) {
        await Charge.insertMany(transportCharges);
      }
      if (!updatedCharge) {
        return res.status(404).json({ message: "Charge non trouvée" });
      }
      return res.json(updatedCharge);
    }

    // Normal update
    const updatedCharge = await Charge.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updatedCharge) {
      return res.status(404).json({ message: "Charge non trouvée" });
    }
    res.json(updatedCharge);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Supprimer une charge
router.delete("/:id", async (req, res) => {
  try {
    const charge = await Charge.findByIdAndDelete(req.params.id);
    if (!charge) {
      return res.status(404).json({ message: "Charge non trouvée" });
    }
    res.json({ message: "Charge supprimée avec succès" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Calculer les totaux pour un chantier
router.get("/totaux/:chantierId", async (req, res) => {
  try {
    const charges = await Charge.find({ chantierId: req.params.chantierId });

    const totaux = {
      personnel: 0,
      chargesFixes: 0,
      servicesExterieurs: 0,
      interim: 0,
      achat: 0,
      autre: 0,
      total: 0,
    };

    charges.forEach((charge) => {
      // Add to appropriate total based on charge type
      switch (charge.type) {
        case "Charges de personnel":
          totaux.personnel += charge.budget;
          break;
        case "Charges fixes":
          totaux.chargesFixes += charge.budget;
          break;
        case "Services extérieurs":
          totaux.servicesExterieurs += charge.budget;
          break;
        case "Interim":
          totaux.interim += charge.budget;
          break;
        case "Achat":
          totaux.achat += charge.budget;
          break;
        case "Autre":
          totaux.autre += charge.budget;
          break;
      }
    });

    totaux.total =
      totaux.personnel +
      totaux.chargesFixes +
      totaux.servicesExterieurs +
      totaux.interim +
      totaux.achat +
      totaux.autre;

    res.json(totaux);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
