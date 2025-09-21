const express = require('express');
const router = express.Router();
const Chantier = require('../models/Chantier');
const ChargeModel = require('../models/Charge'); // add: to auto-create initial charge

// Get all chantiers
router.get('/', async (req, res) => {
  try {
    const chantiers = await Chantier.getAll();
    res.json(chantiers);
  } catch (error) {
    console.error('Error getting chantiers:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single chantier by ID
router.get('/:id', async (req, res) => {
  try {
    const chantier = await Chantier.getById(req.params.id);
    
    if (!chantier) {
      return res.status(404).json({ message: 'Chantier not found' });
    }
    
    res.json(chantier);
  } catch (error) {
    console.error('Error getting chantier:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new chantier
router.post('/', async (req, res) => {
  try {
    console.log('Received data:', req.body);
    
    // Validate required fields
    const requiredFields = ['numAttachement', 'client', 'natureTravail', 'nomChantier'];
    const missingFields = [];
    
    for (const field of requiredFields) {
      if (!req.body[field] || req.body[field].trim() === '') {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }
    
    // Prepare data for database
    const chantierData = {
      nomChantier: req.body.nomChantier.trim(),
      numAttachement: req.body.numAttachement.trim(),
      client: req.body.client.trim(),
      natureTravail: req.body.natureTravail.trim(),
      adresseExecution: req.body.adresseExecution ? req.body.adresseExecution.trim() : null,
      lieu: req.body.lieu || null,
      prixPrestation: req.body.prixPrestation ? parseFloat(req.body.prixPrestation) : null,
      dateDebut: req.body.dateDebut || null,
      dateFin: req.body.dateFin || null,
      dateSaisie: req.body.dateSaisie || new Date().toISOString().split('T')[0],
      etat: req.body.etat || 'en cours'
    };
    
    console.log('Processed data for database:', chantierData);
    
    // Create new chantier using the model method
    const newChantier = await Chantier.create(chantierData);
    console.log('New chantier created with ID:', newChantier.id);

    // Auto-create charge equal to 30% of prixPrestation
    let autoChargeCreated = false;
    let autoChargeAmount = 0;
    let autoChargeError = null;
    let autoCharge = null;
    
    try {
      const budgetTravaux = Number(chantierData.prixPrestation || 0);
      console.log('Budget travaux for auto-charge:', budgetTravaux);
      
      if (!Number.isNaN(budgetTravaux) && budgetTravaux > 0) {
        autoChargeAmount = Number((budgetTravaux * 0.3).toFixed(2));
        
        console.log(`Creating auto charge for chantier ${newChantier.id}: ${autoChargeAmount}€`);
        
        // Create the auto-charge with proper structure
        const autoChargeData = {
          chantierId: Number(newChantier.id), // ensure number
          chantier_id: Number(newChantier.id), // ensure number for snake case too
          type: 'Achat',
          name: 'Acompte budget travaux (30%)',
          budget: autoChargeAmount,
          montant: autoChargeAmount,
          description: 'Ajout automatique lors de la création du chantier (30% du budget travaux)',
          date: new Date().toISOString().slice(0, 10),
        };
        
        console.log('Auto-charge data to create:', autoChargeData);
        
        // Remove verification queries; trust createCharge return
        autoCharge = await ChargeModel.createCharge(autoChargeData);
        autoChargeCreated = !!(
          autoCharge &&
          (autoCharge.id || autoCharge._id || autoCharge.success === true)
        );
      } else {
        autoChargeError = 'No valid budget provided';
      }
    } catch (autoErr) {
      console.error('Failed to create auto charge for chantier:', autoErr);
      console.error('Auto charge error details:', {
        chantierId: newChantier.id,
        prixPrestation: chantierData.prixPrestation,
        errorMessage: autoErr.message,
        stack: autoErr.stack
      });
      autoChargeError = autoErr.message;
    }

    const response = {
      ...newChantier,
      autoChargeCreated,
      autoChargeAmount,
      autoChargeError: autoChargeError || undefined,
      autoCharge, // include for debugging/confirmation
    };

    console.log('Created chantier with response:', response);
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating chantier:', error);
    res.status(400).json({ 
      error: error.message || 'Failed to create chantier'
    });
  }
});

// Update chantier
router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    // Load existing to support partial updates
    const existing = await Chantier.getById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Chantier not found' });
    }

    // Merge existing fields with incoming partial payload
    const merged = { ...existing, ...req.body };

    // Normalize fields if present in payload
    const toNullIfEmpty = (v) => (v === '' ? null : v);
    ['adresseExecution', 'lieu', 'dateDebut', 'dateFin', 'dateSaisie'].forEach((k) => {
      if (k in req.body) merged[k] = toNullIfEmpty(req.body[k]);
    });

    if (req.body.prixPrestation !== undefined && req.body.prixPrestation !== null) {
      merged.prixPrestation = parseFloat(req.body.prixPrestation);
      if (Number.isNaN(merged.prixPrestation)) merged.prixPrestation = null;
    }

    if (typeof req.body.nomChantier === 'string') merged.nomChantier = req.body.nomChantier.trim();
    if (typeof req.body.numAttachement === 'string') merged.numAttachement = req.body.numAttachement.trim();
    if (typeof req.body.client === 'string') merged.client = req.body.client.trim();
    if (typeof req.body.natureTravail === 'string') merged.natureTravail = req.body.natureTravail.trim();
    if (typeof req.body.adresseExecution === 'string') merged.adresseExecution = req.body.adresseExecution.trim();

    const updatedChantier = await Chantier.update(id, merged);
    if (!updatedChantier) {
      return res.status(404).json({ message: 'Chantier not found' });
    }
    res.json(updatedChantier);
  } catch (error) {
    console.error('Error updating chantier:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete chantier
router.delete('/:id', async (req, res) => {
  try {
    const result = await Chantier.delete(req.params.id);
    if (!result) {
      return res.status(404).json({ message: 'Chantier not found' });
    }
    res.json({ message: 'Chantier deleted successfully' });
  } catch (error) {
    console.error('Error deleting chantier:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;