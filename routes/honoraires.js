const express = require("express");
const router = express.Router();
const Honoraire = require("../models/Honoraire");
const Charge = require("../models/Charge");
const Salarie = require("../models/Salarie");
const Chantier = require("../models/Chantier");
const FraisTransportConfig = require("../models/FraisTransportConfig");

// List all honoraires
router.get("/", async (req, res) => {
  try {
    const honoraires = await Honoraire.find().sort({ date: -1 });
    res.json(honoraires);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Calculate honoraires for a personnel charge and persist them
// Creates one honoraire per salarié in the charge with montant = tauxHoraire * 7
router.post("/calc-for-charge/:chargeId", async (req, res) => {
  try {
    const { chargeId } = req.params;
    const charge = await Charge.findById(chargeId);
    if (!charge) return res.status(404).json({ message: "Charge non trouvée" });

    if (charge.type !== "Charges de personnel")
      return res.status(400).json({ message: "La charge n'est pas de type 'Charges de personnel'." });

    if (charge.pending === false)
      return res.status(400).json({ message: "Honoraires déjà calculés pour cette charge." });

    const personnel = Array.isArray(charge.personnel) ? charge.personnel : [];
    const honorairesToInsert = [];

    for (const p of personnel) {
      if (!p.salarieId) continue;
      const taux = Number(p.tauxHoraire || p.taux || 0);
      // Always consider 7 hours for honoraires calculation
      const montant = Number((taux * 7).toFixed(2));
      honorairesToInsert.push({
        salarieId: p.salarieId,
        date: new Date(),
        montant,
        chargeId: charge._id,
      });
    }

    let created = [];
    if (honorairesToInsert.length > 0) {
      created = await Honoraire.insertMany(honorairesToInsert);
    }

    // Mark charge as processed (no longer pending)
    charge.pending = false;
    await charge.save();

    res.json({ createdCount: created.length, honoraires: created });
  } catch (err) {
    console.error("[HONORAIRES] Error:", err);
    res.status(500).json({ message: "Erreur serveur lors du calcul des honoraires." });
  }
});

// Add frais de transport for salariés with camion, divided by chantiers for a given date
// Forward to the canonical handler in charges router to avoid duplication and bugs.
router.post("/add-frais-transport/:date", async (req, res) => {
  try {
    const chargesRouter = require("./charges");
    const handler = chargesRouter?.applyTransportFees;
    if (typeof handler !== "function") {
      return res.status(500).json({ message: "Transport fees handler indisponible." });
    }
    req.body = { ...(req.body || {}), date: req.params.date };
    return handler(req, res);
  } catch (err) {
    console.error("[HONORAIRES] add-frais-transport forward error:", err);
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
});

module.exports = router;
