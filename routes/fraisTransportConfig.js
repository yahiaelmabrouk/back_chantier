const express = require("express");
const router = express.Router();
const db = require("../config/database"); // Adjust path as needed

// GET all frais transport charges
router.get("/", async (req, res) => {
  try {
    const query = "SELECT * FROM frais_transport_config ORDER BY name";
    const [rows] = await db.execute(query);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching frais transport:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des données" });
  }
});

// GET single frais transport charge by id
router.get("/:id", async (req, res) => {
  try {
    const query = "SELECT * FROM frais_transport_config WHERE id = ?";
    const [rows] = await db.execute(query, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Charge non trouvée" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching frais transport:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des données" });
  }
});

// POST create new frais transport charge
router.post("/", async (req, res) => {
  try {
    const { name, prix } = req.body;

    if (!name || prix === undefined) {
      return res.status(400).json({ error: "Name et prix sont requis" });
    }

    const query = "INSERT INTO frais_transport_config (name, prix) VALUES (?, ?)";
    const [result] = await db.execute(query, [name, prix]);

    // Return the created record
    const [newRecord] = await db.execute(
      "SELECT * FROM frais_transport_config WHERE id = ?",
      [result.insertId]
    );
    res.status(201).json(newRecord[0]);
  } catch (error) {
    console.error("Error creating frais transport:", error);
    res.status(500).json({ error: "Erreur lors de la création" });
  }
});

// PUT update frais transport charge
router.put("/:id", async (req, res) => {
  try {
    const { name, prix } = req.body;

    if (!name || prix === undefined) {
      return res.status(400).json({ error: "Name et prix sont requis" });
    }

    const query =
      "UPDATE frais_transport_config SET name = ?, prix = ? WHERE id = ?";
    const [result] = await db.execute(query, [name, prix, req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Charge non trouvée" });
    }

    // Return the updated record
    const [updatedRecord] = await db.execute(
      "SELECT * FROM frais_transport_config WHERE id = ?",
      [req.params.id]
    );
    res.json(updatedRecord[0]);
  } catch (error) {
    console.error("Error updating frais transport:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

// DELETE frais transport charge
router.delete("/:id", async (req, res) => {
  try {
    const query = "DELETE FROM frais_transport_config WHERE id = ?";
    const [result] = await db.execute(query, [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Charge non trouvée" });
    }

    res.json({ message: "Charge supprimée avec succès" });
  } catch (error) {
    console.error("Error deleting frais transport:", error);
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// GET total frais transport (sum of all prix)
router.get("/total", async (req, res) => {
  try {
    const query = "SELECT SUM(prix) as total FROM frais_transport_config";
    const [rows] = await db.execute(query);
    const total = rows[0]?.total || 0;
    res.json({ total: Number(total) });
  } catch (error) {
    console.error("Error fetching frais transport total:", error);
    res.status(500).json({ error: "Erreur lors du calcul du total" });
  }
});

module.exports = router;
