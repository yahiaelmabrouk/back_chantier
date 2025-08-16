const express = require("express");
const router = express.Router();
const Chantier = require("../models/Chantier");

router.get("/", async (req, res) => {
  try {
    const chantiers = await Chantier.find().sort({ createdAt: -1 });
    res.json(chantiers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const chantier = await Chantier.findById(req.params.id);
    if (!chantier) {
      return res.status(404).json({ message: "Chantier non trouvé" });
    }
    res.json(chantier);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const chantier = new Chantier(req.body);
    const savedChantier = await chantier.save();

    // --- Add 30% achat charge if prixPrestation is set and > 0 ---
    if (savedChantier.prixPrestation && savedChantier.prixPrestation > 0) {
      const Charge = require("../models/Charge");
      const achatBudget = Number(savedChantier.prixPrestation) * 0.3;
      await Charge.create({
        chantierId: savedChantier._id,
        type: "Achat",
        name: "Achat initial (30% du budget travaux)",
        budget: achatBudget,
        description: "Charge ajoutée automatiquement lors de la création du chantier (30% du budget travaux)",
      });
    }

    res.status(201).json(savedChantier);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: "Numéro d'attachement déjà existant" });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
});

router.put("/:id", async (req, res) => {
  try {
    const chantier = await Chantier.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!chantier) {
      return res.status(404).json({ message: "Chantier non trouvé" });
    }
    res.json(chantier);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const chantier = await Chantier.findByIdAndDelete(req.params.id);
    if (!chantier) {
      return res.status(404).json({ message: "Chantier non trouvé" });
    }
    res.json({ message: "Chantier supprimé avec succès" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Set chantier to provisoire
router.patch("/:id/provisoire", async (req, res) => {
  try {
    const chantier = await Chantier.findByIdAndUpdate(
      req.params.id,
      { etat: "provisoire" },
      { new: true }
    );
    if (!chantier) {
      return res.status(404).json({ message: "Chantier non trouvé" });
    }
    // Delete the initial 30% achat charge if it exists
    const Charge = require("../models/Charge");
    await Charge.deleteMany({
      chantierId: chantier._id,
      type: "Achat",
      name: "Achat initial (30% du budget travaux)",
    });
    res.json(chantier);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Close a chantier (set etat to "fermé") only if currently "provisoire"
router.patch("/:id/close", async (req, res) => {
  try {
    const chantier = await Chantier.findById(req.params.id);
    if (!chantier) {
      return res.status(404).json({ message: "Chantier non trouvé" });
    }
    if (chantier.etat !== "provisoire") {
      return res.status(400).json({ message: "Le chantier doit être provisoire pour être fermé." });
    }
    chantier.etat = "fermé";
    await chantier.save();
    res.json(chantier);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

   
router.post("/", async (req, res) => {
  try {
    const chantier = new Chantier(req.body);
    const savedChantier = await chantier.save();

    // --- Add 30% achat charge if prixPrestation is set and > 0 ---
    if (savedChantier.prixPrestation && savedChantier.prixPrestation > 0) {
      const Charge = require("../models/Charge");
      const achatBudget = Number(savedChantier.prixPrestation) * 0.3;
      await Charge.create({
        chantierId: savedChantier._id,
        type: "Achat",
        name: "Achat initial (30% du budget travaux)",
        budget: achatBudget,
        description: "Charge ajoutée automatiquement lors de la création du chantier (30% du budget travaux)",
      });
    }

    res.status(201).json(savedChantier);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: "Numéro d'attachement déjà existant" });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
});

/**
 * @swagger
 * /api/chantiers/{id}:
 *   put:
 *     summary: Update a chantier
 *     tags: [Chantiers]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The chantier id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Chantier'
 *     responses:
 *       200:
 *         description: Chantier updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Chantier'
 *       404:
 *         description: Chantier not found
 */
router.put("/:id", async (req, res) => {
  try {
    const chantier = await Chantier.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!chantier) {
      return res.status(404).json({ message: "Chantier non trouvé" });
    }
    res.json(chantier);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

/**
 * @swagger
 * /api/chantiers/{id}:
 *   delete:
 *     summary: Delete a chantier
 *     tags: [Chantiers]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The chantier id
 *     responses:
 *       200:
 *         description: Chantier deleted successfully
 *       404:
 *         description: Chantier not found
 */
router.delete("/:id", async (req, res) => {
  try {
    const chantier = await Chantier.findByIdAndDelete(req.params.id);
    if (!chantier) {
      return res.status(404).json({ message: "Chantier non trouvé" });
    }
    res.json({ message: "Chantier supprimé avec succès" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Set chantier to provisoire
router.patch("/:id/provisoire", async (req, res) => {
  try {
    const chantier = await Chantier.findByIdAndUpdate(
      req.params.id,
      { etat: "provisoire" },
      { new: true }
    );
    if (!chantier) {
      return res.status(404).json({ message: "Chantier non trouvé" });
    }
    // Delete the initial 30% achat charge if it exists
    const Charge = require("../models/Charge");
    await Charge.deleteMany({
      chantierId: chantier._id,
      type: "Achat",
      name: "Achat initial (30% du budget travaux)",
    });
    res.json(chantier);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Close a chantier (set etat to "fermé") only if currently "provisoire"
router.patch("/:id/close", async (req, res) => {
  try {
    const chantier = await Chantier.findById(req.params.id);
    if (!chantier) {
      return res.status(404).json({ message: "Chantier non trouvé" });
    }
    if (chantier.etat !== "provisoire") {
      return res.status(400).json({ message: "Le chantier doit être provisoire pour être fermé." });
    }
    chantier.etat = "fermé";
    await chantier.save();
    res.json(chantier);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
