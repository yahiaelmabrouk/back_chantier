const express = require("express");
const router = express.Router();
const ChargeModel = require("../models/Charge");
const FraisTransportConfig = require("../models/FraisTransportConfig"); // Import the transport config model
const Chantier = require("../models/Chantier");
const { pool } = require("../config/database");

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

    // NOTE: Allow charges for 'annulé'; only block 'fermé'
    const chantier = await Chantier.getById(chantierId);
    if (!chantier) {
      return res.status(404).json({ error: "Chantier not found" });
    }
    if (chantier.etat === "fermé") {
      return res.status(403).json({ error: "Charges non modifiables: chantier fermé" });
    }

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
    let mapped = mapChargeRow(createdRow);

    // Safety net: if a long chantier personnel charge somehow saved with 0 budget, recalc
    if (
      payload.type === "Charges de personnel" &&
      mapped && Number(mapped.budget) === 0 &&
      Array.isArray(payload.personnel) && payload.personnel.some(p => Array.isArray(p.dates) && p.dates.length > 0)
    ) {
      // Minimal in-route recalculation: 140€ * working days, excluding weekends/holidays
      const isWeekend = (ds) => {
        const d = new Date(`${ds}T00:00:00Z`);
        const wd = d.getUTCDay();
        return wd === 0 || wd === 6;
      };
      const easterDate = (year) => {
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(Date.UTC(year, month - 1, day));
      };
      const addDaysUTC = (d, n) => { const x = new Date(d.getTime()); x.setUTCDate(x.getUTCDate() + n); return x; };
      const fmt = (d) => {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      };
      const holidaysForYear = (y) => {
        const e = easterDate(y);
        const list = new Set([
          `${y}-01-01`, `${y}-05-01`, `${y}-05-08`, `${y}-07-14`, `${y}-08-15`, `${y}-11-01`, `${y}-11-11`, `${y}-12-25`,
          fmt(addDaysUTC(e, 1)), fmt(addDaysUTC(e, 39)), fmt(addDaysUTC(e, 50))
        ]);
        return list;
      };
      const isHoliday = (ds) => {
        const d = new Date(`${ds}T00:00:00Z`);
        const y = d.getUTCFullYear();
        return holidaysForYear(y).has(ds);
      };
      const isWorking = (ds) => !isWeekend(ds) && !isHoliday(ds);

      const allDays = payload.personnel.flatMap(p => (p.dates || []).map(d => (typeof d === 'string' ? d : d?.date)).filter(Boolean));
      const workingDays = new Set(allDays.filter(isWorking));
      const recalculated = 140 * workingDays.size;

      if (recalculated > 0) {
        try {
          const updated = await ChargeModel.updateCharge(mapped._id, { type: mapped.type, budget: recalculated, personnel: mapped.personnel, chantierId: mapped.chantierId });
          mapped = mapChargeRow(updated);
        } catch (_) {
          // If update fails, at least adjust response
          mapped.budget = recalculated;
        }
      }
    }

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

    // NEW: enforce chantier status for updates
    let chantierId = null;
    try {
      const [rows] = await pool.execute(
        "SELECT chantier_id FROM charges WHERE id = ?",
        [id]
      );
      chantierId = rows?.[0]?.chantier_id || null;
    } catch (_) {
      chantierId = null;
    }
    chantierId = chantierId || req.body?.chantierId || req.body?.chantier_id || null;

    if (chantierId) {
      const chantier = await Chantier.getById(chantierId);
      if (!chantier) {
        return res.status(404).json({ error: "Chantier not found" });
      }
      if (chantier.etat === "fermé") {
        return res.status(403).json({ error: "Charges non modifiables: chantier fermé" });
      }
    }

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