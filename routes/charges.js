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
})  ;

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
  // ... (unchanged)
}

// Apply transport fees handler
async function applyTransportFees(req, res) {
  // ... (unchanged)
}

// Attach the handler to the router object so it can be imported by honoraires.js
router.applyTransportFees = applyTransportFees;

// -------------------- NEW: billable evaluate endpoint --------------------
router.post("/billable/evaluate", async (req, res) => {
  try {
    const payload = req.body || {};
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    const excludeChargeId = payload.excludeChargeId;

    // Collect target dates set
    const datesSet = new Set();
    const pairs = [];
    for (const e of entries) {
      const salarieId = String(e?.salarieId || '');
      if (!salarieId) continue;
      const dates = Array.isArray(e?.dates) ? e.dates : [];
      for (const d of dates) {
        if (!d) continue;
        datesSet.add(d);
        pairs.push({ salarieId, date: d });
      }
    }

    // Reuse model helper
    // We cannot import the helper directly here; use the model to get map via a tiny adapter:
    // Implement a minimal copy using the model's SQL helper if needed, but to keep code isolated,
    // we'll re-use ChargeModel via a temporary normalizer call:
    // We'll fake a normalize with empty personnel; instead we implement a direct small query here:

    const rows = await ChargeModel.getChargesByChantier ? null : null; // not used; we go direct via DB inside model file
    const { pool } = require('../config/database');
    const [rawRows] = await pool.execute('SELECT id, personnel_data FROM charges WHERE type = ?', ['Charges de personnel']);
    const firstMap = new Map();
    for (const row of rawRows || []) {
      let personnel = [];
      try { personnel = row.personnel_data ? JSON.parse(row.personnel_data) : []; } catch { personnel = []; }
      for (const p of personnel) {
        const sid = String(p?.salarieId || '');
        if (!sid) continue;
        for (const dd of Array.isArray(p?.dates) ? p.dates : []) {
          const dt = dd?.date;
          if (!dt || !datesSet.has(dt)) continue;
          const key = `${sid}|${dt}`;
          const prev = firstMap.get(key);
          if (!prev || Number(row.id) < Number(prev)) {
            firstMap.set(key, Number(row.id));
          }
        }
      }
    }

    const resultMap = {};
    for (const pair of pairs) {
      const key = `${pair.salarieId}|${pair.date}`;
      const earliest = firstMap.get(key);
      // Billable if none exists, or if the earliest is the current (excludeChargeId on edit)
      const billable = earliest == null ? true : (excludeChargeId ? Number(excludeChargeId) === Number(earliest) : false);
      resultMap[key] = billable;
    }

    res.json({ map: resultMap });
  } catch (err) {
    console.error("POST /api/charges/billable/evaluate error", err);
    res.status(500).json({ error: "Failed to evaluate billable flags" });
  }
});

module.exports = router;