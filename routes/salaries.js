const express = require("express");
const router = express.Router();
const { pool } = require("../config/database");

// GET all salaries
router.get("/", async (req, res) => {
  try {
    // Use 'id' instead of 'created_at' since the column doesn't exist
    const [rows] = await pool.query("SELECT * FROM salaries ORDER BY id DESC");
    res.json(rows);
  } catch (error) {
    console.error("Error fetching salaries:", error);
    res.status(500).json({ error: "Failed to fetch salaries" });
  }
});

// GET salary by ID
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM salaries WHERE id = ?",
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Salary not found" });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching salary:", error);
    res.status(500).json({ error: "Failed to fetch salary" });
  }
});

// POST new salary
router.post("/", async (req, res) => {
  try {
    const { matricule, nom, taux_horaire, acamion } = req.body;

    // Validation
    if (!matricule || !nom) {
      return res.status(400).json({ error: "Matricule and nom are required" });
    }

    const query =
      "INSERT INTO salaries (matricule, nom, taux_horaire, acamion) VALUES (?, ?, ?, ?)";
    const [result] = await pool.query(query, [
      matricule,
      nom,
      taux_horaire || 0,
      acamion || false,
    ]);

    const [newSalarie] = await pool.query("SELECT * FROM salaries WHERE id = ?", [
      result.insertId,
    ]);
    res.status(201).json(newSalarie[0]);
  } catch (error) {
    console.error("Error creating salarie:", error);
    if (error.code === "ER_DUP_ENTRY") {
      res.status(400).json({ error: "Matricule already exists" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// PUT update salary
router.put("/:id", async (req, res) => {
  try {
    const { matricule, nom, taux_horaire, acamion } = req.body;

    const [existing] = await pool.query(
      "SELECT * FROM salaries WHERE id = ?",
      [req.params.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: "Salarie not found" });
    }

    const query =
      "UPDATE salaries SET matricule = ?, nom = ?, taux_horaire = ?, acamion = ? WHERE id = ?";
    await pool.query(query, [
      matricule,
      nom,
      taux_horaire,
      acamion,
      req.params.id,
    ]);

    const [updated] = await pool.query("SELECT * FROM salaries WHERE id = ?", [
      req.params.id,
    ]);
    res.json(updated[0]);
  } catch (error) {
    console.error("Error updating salarie:", error);
    if (error.code === "ER_DUP_ENTRY") {
      res.status(400).json({ error: "Matricule already exists" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// DELETE salary
router.delete("/:id", async (req, res) => {
  try {
    const [existing] = await pool.query(
      "SELECT * FROM salaries WHERE id = ?",
      [req.params.id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: "Salarie not found" });
    }

    await pool.query("DELETE FROM salaries WHERE id = ?", [req.params.id]);
    res.json({ message: "Salarie deleted successfully" });
  } catch (error) {
    console.error("Error deleting salarie:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
module.exports = router;
