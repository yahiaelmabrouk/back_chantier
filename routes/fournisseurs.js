const express = require("express");
const router = express.Router();
const fournisseurService = require("../services/fournisseurService");

router.get("/years", async (_req, res) => {
  try {
    const years = await fournisseurService.getYears();
    res.json(years);
  } catch (error) {
    console.error("Error in GET /fournisseurs/years:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des années" });
  }
});

router.get("/", async (req, res) => {
  try {
    const fournisseurs = await fournisseurService.getAll({
      name: req.query.name || req.query.q || "",
      chantier: req.query.chantier || req.query.chantierName || "",
      numBonEnlevement: req.query.numBonEnlevement || req.query.bon || "",
      filterType: req.query.filterType || "all",
      date: req.query.date || "",
      month: req.query.month || "",
      year: req.query.year || "",
      dateFrom: req.query.dateFrom || "",
      dateTo: req.query.dateTo || "",
    });
    res.json(fournisseurs);
  } catch (error) {
    console.error("Error in GET /fournisseurs:", error);
    res
      .status(500)
      .json({ error: "Erreur lors de la récupération des fournisseurs" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const fournisseur = await fournisseurService.getById(req.params.id);
    if (!fournisseur) {
      return res.status(404).json({ error: "Fournisseur non trouvé" });
    }
    res.json(fournisseur);
  } catch (error) {
    console.error("Error in GET /fournisseurs/:id:", error);
    res.status(500).json({ error: "Erreur lors de la récupération du fournisseur" });
  }
});

router.post("/", async (req, res) => {
  try {
    const name = String(req.body?.name || req.body?.nom || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Le nom est requis" });
    }
    const fournisseur = await fournisseurService.create({ name });
    res.status(201).json(fournisseur);
  } catch (error) {
    console.error("Error in POST /fournisseurs:", error);
    res.status(500).json({ error: "Erreur lors de la création du fournisseur" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const name = String(req.body?.name || req.body?.nom || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Le nom est requis" });
    }
    const fournisseur = await fournisseurService.update(req.params.id, { name });
    if (!fournisseur) {
      return res.status(404).json({ error: "Fournisseur non trouvé" });
    }
    res.json(fournisseur);
  } catch (error) {
    console.error("Error in PUT /fournisseurs/:id:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour du fournisseur" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await fournisseurService.delete(req.params.id);
    res.json({ message: "Fournisseur supprimé avec succès" });
  } catch (error) {
    console.error("Error in DELETE /fournisseurs:", error);
    res.status(500).json({ error: "Erreur lors de la suppression du fournisseur" });
  }
});

module.exports = router;
