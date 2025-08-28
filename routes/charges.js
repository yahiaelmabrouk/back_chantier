const express = require("express");
const router = express.Router();
const Charge = require("../models/Charge");
const Honoraire = require("../models/Honoraire");
const Salarie = require("../models/Salarie"); // NEW: needed to find salariés avec camion

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
      }
      req.body.budget = req.body.personnel.reduce(
        (sum, p) => sum + (p.total || 0),
        0
      );
      // Save the personnel charge
      const charge = new Charge(req.body);
      const savedCharge = await charge.save();

      // Create honoraires for each personnel row (always 7h)
      try {
        const honorairesToInsert = [];
        for (const p of savedCharge.personnel || []) {
          if (!p.salarieId) continue;
          const taux = Number(p.tauxHoraire || p.taux || 0);
          const montant = Number((taux * 7).toFixed(2));
          honorairesToInsert.push({
            salarieId: p.salarieId,
            date: new Date(),
            montant,
            chargeId: savedCharge._id,
          });
        }
        if (honorairesToInsert.length > 0) {
          await Honoraire.insertMany(honorairesToInsert);
        }
      } catch (hErr) {
        console.error("[HONORAIRES] error creating on charge create:", hErr);
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
      }
      req.body.budget = req.body.personnel.reduce(
        (sum, p) => sum + (p.total || 0),
        0
      );
      const updatedCharge = await Charge.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      });
      if (!updatedCharge) {
        return res.status(404).json({ message: "Charge non trouvée" });
      }

      // Create honoraires for any personnel rows not already honored (always 7h)
      try {
        const existingHonoraires = await Honoraire.find({ chargeId: updatedCharge._id });
        const existingSalarieIds = new Set(existingHonoraires.map(h => String(h.salarieId)));
        const honorairesToInsert = [];
        for (const p of updatedCharge.personnel || []) {
          if (!p.salarieId) continue;
          if (existingSalarieIds.has(String(p.salarieId))) continue;
          const taux = Number(p.tauxHoraire || p.taux || 0);
          const montant = Number((taux * 7).toFixed(2));
          honorairesToInsert.push({
            salarieId: p.salarieId,
            date: new Date(),
            montant,
            chargeId: updatedCharge._id,
          });
        }
        if (honorairesToInsert.length > 0) {
          await Honoraire.insertMany(honorairesToInsert);
        }
      } catch (hErr) {
        console.error("[HONORAIRES] error creating on charge update:", hErr);
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

// NEW: extract the transport fees handler so server.js can reuse it
const applyTransportFees = async (req, res) => {
  try {
    const { date: dateInput, salarieId, montant: montantInput } = req.body || {};
    const date =
      dateInput && typeof dateInput === "string"
        ? dateInput
        : new Date().toISOString().split("T")[0];

    let montant = Number(montantInput);
    if (!(montant > 0)) {
      // Try to read from config if available (robust fallback)
      try {
        const Config = require("../models/FraisTransportConfig");
        const latest = await Config.findOne().sort({ createdAt: -1 });
        if (latest) {
          // Try all possible config fields
          if (latest.montant > 0) {
            montant = Number(latest.montant);
          } else if (latest.montantTransport > 0) {
            montant = Number(latest.montantTransport);
          } else {
            // Sum all relevant fields
            montant =
              Number(latest.camion || 0) +
              Number(latest.assurance || 0) +
              Number(latest.carburant || 0) +
              (Array.isArray(latest.custom)
                ? latest.custom.reduce((sum, c) => sum + Number(c.montant || 0), 0)
                : 0);
          }
        }
      } catch (e) {
        // Model not present or no config; ignore and rely on body montant
      }
    }
    if (!(montant > 0)) {
      return res.status(400).json({
        message:
          "Montant des frais de transport non défini. Fournissez 'montant' ou configurez-le.",
      });
    }

    // Build the set/list of salariés avec camion à traiter
    let salariesCamion = [];
    if (salarieId) {
      const s = await Salarie.findById(salarieId);
      if (!s || !s.aCamion) {
        return res
          .status(400)
          .json({ message: "Salarié invalide ou n'a pas de camion." });
      }
      salariesCamion = [s];
    } else {
      salariesCamion = await Salarie.find({ aCamion: true });
    }
    if (!salariesCamion.length) {
      return res.json({
        message: "Aucun salarié avec camion pour appliquer des frais.",
        date,
        montant,
        created: 0,
        skipped: 0,
      });
    }
    const camionIds = salariesCamion.map((s) => String(s._id));

    // Find personnel charges that include these salariés on the given date
    const charges = await Charge.find({
      type: "Charges de personnel",
      "personnel.dates.date": date,
      "personnel.salarieId": { $in: camionIds },
    }).select("chantierId personnel");

    // Map: salarieId -> Set(chantierIds) worked that date
    const chantierIdsBySalarie = new Map();
    for (const chg of charges) {
      for (const p of chg.personnel || []) {
        const sid = p?.salarieId ? String(p.salarieId) : null;
        if (!sid || !camionIds.includes(sid)) continue;
        const workedThatDate = Array.isArray(p.dates)
          ? p.dates.some((d) => d?.date === date)
          : false;
        if (!workedThatDate) continue;
        if (!chantierIdsBySalarie.has(sid))
          chantierIdsBySalarie.set(sid, new Set());
        chantierIdsBySalarie.get(sid).add(String(chg.chantierId));
      }
    }

    // Ensure only one "Frais de transport" per chantier/date even if many salariés avec camion worked there
    let created = 0;
    let skipped = 0;
    const processedChantierDates = new Set(); // key = `${chantierId}|${date}`

    for (const [sid, chantierSet] of chantierIdsBySalarie.entries()) {
      const chantierIds = Array.from(chantierSet);
      const count = chantierIds.length;
      if (count === 0) continue;

      const share = Number((montant / count).toFixed(2));
      for (const cId of chantierIds) {
        const key = `${cId}|${date}`;

        // Skip if already processed in this run
        if (processedChantierDates.has(key)) {
          skipped++;
          continue;
        }

        // Idempotency across runs: skip if already exists in DB for this chantier/date
        const exists = await Charge.findOne({
          chantierId: cId,
          type: "Charges fixes",
          name: "Frais de transport",
          "details.transportDate": date,
        }).select("_id");
        if (exists) {
          skipped++;
          processedChantierDates.add(key);
          continue;
        }

        await Charge.create({
          chantierId: cId,
          type: "Charges fixes",
          name: "Frais de transport",
          budget: share,
          description: `Frais de transport du ${date} (part ${share.toFixed(
            2
          )} € - réparti sur ${count} chantier(s))`,
          details: {
            transportDate: date,
            generatedBy: "transport-fees",
            salarieId: sid,
            baseMontant: montant,
            repartitionCount: count,
          },
        });

        created++;
        processedChantierDates.add(key);
      }
    }

    return res.json({
      message: "Frais de transport appliqués.",
      date,
      montant,
      created,
      skipped,
    });
  } catch (error) {
    console.error("[transport-fees] error:", error);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// Keep the original endpoint bound to this handler
router.post("/transport-fees/apply", applyTransportFees);

// Expose the handler for reuse in server.js alias route
router.applyTransportFees = applyTransportFees;

module.exports = router;

