const express = require("express");
const router = express.Router();
const ChargeModel = require("../models/Charge");
const FraisTransportConfig = require("../models/FraisTransportConfig"); // Import the transport config model

function mapChargeRow(row) {
  if (!row) return null;
  let meta = {};
  try {
    if (row.description && typeof row.description === "string") {
      meta = JSON.parse(row.description);
    } else if (row.description && typeof row.description === "object") {
      meta = row.description;
    }
  } catch (e) {
    meta = { description: row.description };
  }
  
  const base = {
    _id: String(row.id ?? meta._id ?? ""),
    chantierId: String(row.chantier_id ?? meta.chantierId ?? ""),
    type: row.type ?? meta.type ?? "Achat",
    name: meta.name || meta.type || row.type || "Charge",
    customType: row.custom_type || meta.customType,
    budget: Number(row.montant ?? row.budget ?? meta.budget ?? 0),
    description:
      typeof meta.description === "string"
        ? meta.description
        : meta.description || "",
    date: row.date || row.date_creation || meta.date,
    pending: row.pending !== undefined ? row.pending : true,
  };

  // Load type-specific data
  if (base.type === "Charges de personnel") {
    try {
      base.personnel = row.personnel_data ? JSON.parse(row.personnel_data) : (Array.isArray(meta.personnel) ? meta.personnel : []);
    } catch (e) {
      base.personnel = Array.isArray(meta.personnel) ? meta.personnel : [];
    }
  }
  if (base.type === "Interim") {
    try {
      base.ouvriers = row.interim_data ? JSON.parse(row.interim_data) : (Array.isArray(meta.ouvriers) ? meta.ouvriers : []);
    } catch (e) {
      base.ouvriers = Array.isArray(meta.ouvriers) ? meta.ouvriers : [];
    }
  }
  if (base.type === "Services extérieurs") {
    try {
      if (row.services_data) {
        base.details = JSON.parse(row.services_data);
      } else if (meta.details) {
        base.details = typeof meta.details === 'string' ? JSON.parse(meta.details) : meta.details;
      } else {
        base.details = {};
      }
      
      // Verify if montant matches sum of services
      const calculatedTotal = Object.values(base.details).reduce((sum, val) => sum + Number(val || 0), 0);
      if (Math.abs(calculatedTotal - base.budget) > 0.01 && calculatedTotal > 0) {
        console.warn(`Services extérieurs montant mismatch: DB=${base.budget}, Calculated=${calculatedTotal}`);
        // Keep the calculated value for consistency
        base.budget = calculatedTotal;
      }
    } catch (e) {
      console.error('Error parsing services_data:', e);
      base.details = meta.details || {};
    }
  }
  if (base.type === "Achat") {
    try {
      base.pieces = row.pieces_data ? JSON.parse(row.pieces_data) : (Array.isArray(meta.pieces) ? meta.pieces : []);
    } catch (e) {
      base.pieces = Array.isArray(meta.pieces) ? meta.pieces : [];
    }
  }
  return base;
}

// List charges by chantier
router.get("/chantier/:id", async (req, res) => {
  try {
    const rows = await ChargeModel.getChargesByChantier(req.params.id);
    const mapped =
      Array.isArray(rows) ? rows.map(mapChargeRow).filter(Boolean) : [];
    res.json(mapped);
  } catch (err) {
    console.error("GET /api/charges/chantier/:id error", err);
    res.status(200).json([]);
  }
});

// Create a new charge
router.post("/", async (req, res) => {
  try {
    const payload = req.body || {};
    const chantierId = payload.chantierId || payload.chantier_id;
    if (!chantierId)
      return res.status(400).json({ error: "chantierId is required" });

    const budget = payload.budget != null
      ? Number(payload.budget)
      : payload.montant != null
      ? Number(payload.montant)
      : null;
    if (budget == null || Number.isNaN(budget))
      return res.status(400).json({ error: "montant/budget is required" });

    const toCreate = {
      ...payload,
      chantier_id: chantierId,
      montant: budget,
    };

    // Ensure personnel entries are persisted properly
    if (payload.type === "Charges de personnel" && Array.isArray(payload.personnel)) {
      try {
        toCreate.personnel_data = JSON.stringify(payload.personnel);
      } catch (_) {
        toCreate.personnel_data = JSON.stringify([]);
      }
    }

    console.log('Creating charge with data:', { ...toCreate, personnel_data: Array.isArray(payload.personnel) ? '[...]' : undefined }); // Debug log

    const createdRow = await ChargeModel.createCharge(toCreate);
    const mapped = mapChargeRow(createdRow);

    // Remove automatic transport fees creation (now handled manually in UI)
    // ...removed auto-apply block...

    res.status(201).json(mapped || createdRow);
  } catch (err) {
    console.error("POST /api/charges error", err);
    res.status(500).json({ error: "Failed to create charge: " + err.message });
  }
});

// PUT /api/charges/:id
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;

    // Ensure personnel entries are persisted properly on update
    const body = { ...req.body };
    if (body.type === "Charges de personnel" && Array.isArray(body.personnel)) {
      try {
        body.personnel_data = JSON.stringify(body.personnel);
      } catch (_) {
        body.personnel_data = JSON.stringify([]);
      }
    }

    const updated = await ChargeModel.updateCharge(id, body);
    const mapped = mapChargeRow(updated);
    res.json(mapped || updated);
  } catch (err) {
    console.error("PUT /api/charges/:id error", err);
    res.status(500).json({ error: "Failed to update charge" });
  }
});

// DELETE /api/charges/:id
router.delete("/:id", async (req, res) => {
  try {
    await ChargeModel.deleteCharge(req.params.id);
    res.status(204).end();
  } catch (err) {
    console.error("DELETE /api/charges/:id error", err);
    res.status(500).json({ error: "Failed to delete charge" });
  }
});

/**
 * Core helper function to add transport fees for a specific date
 * This is used both by the API endpoint and the automatic trigger
 */
async function createTransportChargesForDate(dateString) {
  if (!dateString) throw new Error("Date is required");
  
  console.log(`🔍 Creating transport charges for date: ${dateString}`);
  
  try {
    // 1. Get transport fees configuration and calculate total
    const fraisTransportConfig = await FraisTransportConfig.find();
    console.log(`📊 Found ${fraisTransportConfig.length} transport fee configs`);
    
    const totalFraisTransport = fraisTransportConfig.reduce(
      (total, item) => total + Number(item.prix || 0), 0
    );
    
    console.log(`💰 Total transport fees: ${totalFraisTransport}€`);
    
    if (totalFraisTransport <= 0) {
      throw new Error("Aucun frais de transport configuré ou montant total est zéro");
    }

    // 2. Get all salariés who have a camion - using broader query
    const { pool } = require('../config/database');
    const [salaries] = await pool.execute(
      'SELECT id, nom, aCamion FROM salaries WHERE aCamion IN (1, "1", "true", "TRUE", "oui", "OUI", "yes", "YES")',
      []
    );
    
    console.log(`👥 Found ${salaries.length} salariés with camion`);
    
    if (!salaries.length) {
      throw new Error("Aucun salarié avec camion trouvé");
    }
    
    // Log salariés with camion
    salaries.forEach(s => console.log(`   Salarié with camion: ID=${s.id}, Name=${s.nom}, aCamion=${s.aCamion}`));
    
    const salarieIdsWithCamion = new Set(salaries.map(s => String(s.id)));
    
    // 3. Get personnel charges for the date ORDERED BY ID to ensure consistent "first chantier"
    // Use more flexible date matching
    const [charges] = await pool.execute(
      `SELECT * FROM charges WHERE 
       type = ? AND 
       (date_creation = ? OR 
        DATE(date_creation) = DATE(?))
       ORDER BY id ASC`,
      ['Charges de personnel', dateString, dateString]
    );
    
    console.log(`📋 Found ${charges.length} personnel charges for date ${dateString}`);
    
    // 4. Get existing transport charges for the date to avoid duplicates - using flexible date matching
    const [existingTransportCharges] = await pool.execute(
      `SELECT * FROM charges WHERE 
       type = ? AND name = ? AND 
       (date_creation = ? OR 
        DATE(date_creation) = DATE(?))`,
      ['Charges fixes', 'Frais de transport', dateString, dateString]
    );
    
    console.log(`🔍 Found ${existingTransportCharges.length} existing transport charges for date ${dateString}`);
    
    // Create set of chantier IDs that already have transport charges for this date
    const chantiersWithExistingCharges = new Set();
    for (const charge of existingTransportCharges) {
      const mappedCharge = mapChargeRow(charge);
      if (mappedCharge && (mappedCharge.chantierId || mappedCharge.chantier_id)) {
        const chId = String(mappedCharge.chantierId || mappedCharge.chantier_id);
        chantiersWithExistingCharges.add(chId);
        console.log(`   Chantier ${chId} already has transport charge`);
      }
    }
    
    // 5. Find first chantier for each salarié with camion
    const salarieToChantier = new Map();
    
    console.log(`⚙️ Processing ${charges.length} charges to find first chantier per salarié with camion`);
    
    for (const charge of charges) {
      const mappedCharge = mapChargeRow(charge);
      
      if (!mappedCharge) {
        console.log(`   ⚠️ Skipping charge - could not map: ${charge.id}`);
        continue;
      }
      
      if (!Array.isArray(mappedCharge.personnel) || mappedCharge.personnel.length === 0) {
        console.log(`   ⚠️ Skipping charge - no personnel data: ${charge.id}`);
        continue;
      }
      
      console.log(`   Processing charge ID=${charge.id}, chantier=${mappedCharge.chantierId}, personnel count=${mappedCharge.personnel.length}`);
      
      for (const person of mappedCharge.personnel) {
        const salarieId = String(person.salarieId);
        
        if (!salarieId) {
          console.log(`      ⚠️ Skipping personnel entry - no salarieId`);
          continue;
        }
        
        console.log(`      Checking salarié ${salarieId} - has camion: ${salarieIdsWithCamion.has(salarieId)}`);
        
        // Only add if this salarié has a camion and doesn't already have a chantier
        if (salarieIdsWithCamion.has(salarieId) && !salarieToChantier.has(salarieId)) {
          salarieToChantier.set(salarieId, String(mappedCharge.chantierId));
          console.log(`      ✅ First chantier for salarié ${salarieId} is ${mappedCharge.chantierId}`);
        }
      }
    }
    
    console.log(`🔄 Found first chantier for ${salarieToChantier.size} salariés with camion`);
    
    if (salarieToChantier.size === 0) {
      throw new Error("Aucun salarié avec camion n'a été assigné à un chantier pour cette date");
    }
    
    // 6. Create transport charges for each unique first chantier, avoiding duplicates
    const chantiersToReceiveCharges = new Set();
    for (const [_, chantierId] of salarieToChantier.entries()) {
      chantiersToReceiveCharges.add(String(chantierId));
    }
    
    console.log(`🏗️ Will create transport charges for ${chantiersToReceiveCharges.size} unique chantiers`);
    
    const createdCharges = [];
    for (const chantierId of chantiersToReceiveCharges) {
      // Skip if this chantier already has a transport charge for this date
      if (chantiersWithExistingCharges.has(chantierId)) {
        console.log(`   ⏭️ Skipping chantier ${chantierId}: already has transport charge for ${dateString}`);
        continue;
      }
      
      const chargeData = {
        chantierId,
        type: "Charges fixes",
        name: "Frais de transport",
        budget: totalFraisTransport,
        montant: totalFraisTransport,
        description: `Frais de transport automatique pour la date ${dateString}. Détails: ${fraisTransportConfig.map(f => `${f.name}: ${f.prix}€`).join(', ')}`,
        date: dateString
      };
      
      try {
        console.log(`   🚀 Creating transport charge for chantier ${chantierId} with amount ${totalFraisTransport}€`);
        const createdCharge = await ChargeModel.createCharge(chargeData);
        createdCharges.push(createdCharge);
        console.log(`   ✅ Created transport charge ID=${createdCharge._id || createdCharge.id || 'unknown'}`);
      } catch (error) {
        console.error(`   ❌ Failed to create transport charge for chantier ${chantierId}:`, error);
      }
    }
    
    console.log(`✅ Successfully created ${createdCharges.length} transport charges`);
    
    return {
      success: true,
      message: `Frais de transport ajoutés pour ${createdCharges.length} chantier(s)`,
      totalAmount: totalFraisTransport,
      charges: createdCharges
    };
  } catch (error) {
    console.error(`❌ Error in createTransportChargesForDate: ${error.message}`);
    throw error;
  }
}

/**
 * API endpoint to apply transport fees for a specific date
 */
async function applyTransportFees(req, res) {
  try {
    const { date } = req.body || req.params || {};
    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    // Normalize date format to YYYY-MM-DD
    const dateObj = new Date(date);
    const dateString = dateObj.toISOString().split('T')[0];
    
    const result = await createTransportChargesForDate(dateString);
    return res.json(result);
  } catch (error) {
    console.error("Error applying transport fees:", error);
    return res.status(500).json({ 
      message: "Erreur lors de l'ajout des frais de transport", 
      error: error.message 
    });
  }
}

// Attach the handler to the router object so it can be imported by honoraires.js
router.applyTransportFees = applyTransportFees;

module.exports = router;

