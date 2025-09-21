const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { distributeDailyPrixOuvrageCharges } = require('../services/chargeScheduler');

// GET all prix ouvrage charges
router.get("/", async (req, res) => {
  try {
    const query = "SELECT * FROM prix_ouvrage ORDER BY nom";
    const [rows] = await db.execute(query);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching prix ouvrage:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des données" });
  }
});

// GET single prix ouvrage charge by id
router.get("/:id", async (req, res) => {
  try {
    const query = "SELECT * FROM prix_ouvrage WHERE id = ?";
    const [rows] = await db.execute(query, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Charge non trouvée" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching prix ouvrage:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des données" });
  }
});

// POST create new prix ouvrage charge
router.post("/", async (req, res) => {
  try {
    const { nom, prix_mois } = req.body;

    if (!nom || prix_mois === undefined) {
      return res.status(400).json({ error: "Nom et prix_mois sont requis" });
    }

    const query = "INSERT INTO prix_ouvrage (nom, prix_mois) VALUES (?, ?)";
    const [result] = await db.execute(query, [nom, prix_mois]);

    // Return the created record
    const [newRecord] = await db.execute(
      "SELECT * FROM prix_ouvrage WHERE id = ?",
      [result.insertId]
    );
    res.status(201).json(newRecord[0]);
  } catch (error) {
    console.error("Error creating prix ouvrage:", error);
    res.status(500).json({ error: "Erreur lors de la création" });
  }
});

// PUT update prix ouvrage charge
router.put("/:id", async (req, res) => {
  try {
    const { nom, prix_mois } = req.body;

    if (!nom || prix_mois === undefined) {
      return res.status(400).json({ error: "Nom et prix_mois sont requis" });
    }

    const query = "UPDATE prix_ouvrage SET nom = ?, prix_mois = ? WHERE id = ?";
    const [result] = await db.execute(query, [nom, prix_mois, req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Charge non trouvée" });
    }

    // Return the updated record
    const [updatedRecord] = await db.execute(
      "SELECT * FROM prix_ouvrage WHERE id = ?",
      [req.params.id]
    );
    res.json(updatedRecord[0]);
  } catch (error) {
    console.error("Error updating prix ouvrage:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

// DELETE prix ouvrage charge
router.delete("/:id", async (req, res) => {
  try {
    const query = "DELETE FROM prix_ouvrage WHERE id = ?";
    const [result] = await db.execute(query, [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Charge non trouvée" });
    }

    res.json({ message: "Charge supprimée avec succès" });
  } catch (error) {
    console.error("Error deleting prix ouvrage:", error);
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// Manual trigger for daily charge distribution (for testing/admin use)
router.post("/distribute-daily-charges", async (req, res) => {
  try {
    // Allow manual execution to force distribution even if already run today
    const force = req.body.force === true;
    console.log(`Manual trigger for daily Prix Ouvrage distribution (force=${force})`);
    const result = await distributeDailyPrixOuvrageCharges(force);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Daily Prix Ouvrage charges distributed successfully',
        details: result
      });
    } else {
      // For skipped executions, return 200 status with success=false
      res.status(result.error ? 400 : 200).json({ 
        success: false, 
        message: result.message || 'No charges were distributed',
        details: result
      });
    }
  } catch (error) {
    console.error("Error distributing charges:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error distributing charges", 
      error: error.message 
    });
  }
});

module.exports = router;
