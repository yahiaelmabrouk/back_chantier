const express = require('express');
const router = express.Router();
const fournisseurService = require('../services/fournisseurService');

// Get all fournisseurs
router.get('/', async (req, res) => {
  try {
    const fournisseurs = await fournisseurService.getAll();
    res.json(fournisseurs);
  } catch (error) {
    console.error('Error in GET /fournisseurs:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des fournisseurs' });
  }
});

// Get fournisseur by ID
router.get('/:id', async (req, res) => {
  try {
    const fournisseur = await fournisseurService.getById(req.params.id);
    if (!fournisseur) {
      return res.status(404).json({ error: 'Fournisseur non trouvé' });
    }
    res.json(fournisseur);
  } catch (error) {
    console.error('Error in GET /fournisseurs/:id:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du fournisseur' });
  }
});

// Create new fournisseur
router.post('/', async (req, res) => {
  try {
    const { name, budget } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Le nom est requis' });
    }

    const fournisseur = await fournisseurService.create({ name, budget });
    res.status(201).json(fournisseur);
  } catch (error) {
    console.error('Error in POST /fournisseurs:', error);
    res.status(500).json({ error: 'Erreur lors de la création du fournisseur' });
  }
});

// Update fournisseur
router.put('/:id', async (req, res) => {
  try {
    const { name, budget } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Le nom est requis' });
    }

    const fournisseur = await fournisseurService.update(req.params.id, { name, budget });
    res.json(fournisseur);
  } catch (error) {
    console.error('Error in PUT /fournisseurs/:id:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du fournisseur' });
  }
});

// Delete fournisseur
router.delete('/:id', async (req, res) => {
  try {
    await fournisseurService.delete(req.params.id);
    res.json({ message: 'Fournisseur supprimé avec succès' });
  } catch (error) {
    console.error('Error in DELETE /fournisseurs/:id:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du fournisseur' });
  }
});

module.exports = router;
