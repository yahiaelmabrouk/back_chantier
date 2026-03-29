const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Helper: detect the auto-created provisional 30% Achat charge
function isProvisionalAuto30(row) {
  if (row.type !== 'Achat') return false;
  if (Number(row.isReelle) === 1) return false;
  let meta = {};
  try { meta = JSON.parse(row.description || '{}'); } catch (e) { meta = {}; }
  if (meta.isAutoThirtyPercent === true) return true;
  const name = String(meta.name || '').toLowerCase();
  const desc = String(meta.description || '').toLowerCase();
  return (
    name.includes('30%') ||
    name.includes('acompte budget') ||
    desc.includes('30%') ||
    desc.includes('ajout automatique') ||
    desc.includes('budget travaux')
  );
}

// Build date condition & params from query
function buildDateFilter(query) {
  const { filterType, date, month, year, weekStart, weekEnd } = query;
  let dateCondition = '';
  const params = [];

  if (filterType === 'day' && date) {
    dateCondition = ` AND DATE(ch.dateDebut) = ?`;
    params.push(date);
  } else if (filterType === 'week' && weekStart && weekEnd) {
    dateCondition = ` AND ch.dateDebut BETWEEN ? AND ?`;
    params.push(weekStart, weekEnd);
  } else if (filterType === 'month' && month && year) {
    dateCondition = ` AND YEAR(ch.dateDebut) = ? AND MONTH(ch.dateDebut) = ?`;
    params.push(year, month);
  } else if (filterType === 'year' && year) {
    dateCondition = ` AND YEAR(ch.dateDebut) = ?`;
    params.push(year);
  }

  return { dateCondition, params };
}

// GET /api/prestation-stats/years — available years for filtering
router.get('/years', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT DISTINCT YEAR(ch.dateDebut) as year
      FROM chantiers ch
      WHERE ch.dateDebut IS NOT NULL
      ORDER BY year DESC
    `);

    const currentYear = new Date().getFullYear();
    const years = rows.map(row => row.year).filter(year => year);
    if (!years.includes(currentYear)) {
      years.unshift(currentYear);
      years.sort((a, b) => b - a);
    }

    res.json(years);
  } catch (error) {
    console.error('Error getting years:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// GET /api/prestation-stats/types — list all prestation types from DB
router.get('/types', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, name FROM prestations ORDER BY name ASC');
    res.json(rows);
  } catch (error) {
    console.error('Error getting prestation types:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Shared data loader for both singles and groups endpoints
async function loadData(query) {
  const { dateCondition, params } = buildDateFilter(query);
  const prestationType = (query.prestationType || '').toLowerCase().trim();

  // Get charges with personnel data
  const [chargesRows] = await pool.execute(`
    SELECT 
      c.id as charge_id,
      c.chantier_id,
      c.personnel_data,
      c.montant as charge_amount,
      ch.nomChantier,
      ch.prixPrestation as budget,
      ch.etat,
      ch.dateDebut,
      ch.dateFin,
      ch.dateSaisie
    FROM charges c
    JOIN chantiers ch ON c.chantier_id = ch.id
    WHERE c.type = 'Charges de personnel' 
      AND c.personnel_data IS NOT NULL
      AND ch.etat != 'annulé'
      ${dateCondition}
  `, params);

  // Prestations lookup
  const [prestations] = await pool.execute('SELECT id, name FROM prestations');
  const prestationsMap = {};
  prestations.forEach(p => {
    prestationsMap[p.id] = (p.name || '').toLowerCase().trim();
  });

  // Salaries lookup
  const [salaries] = await pool.execute('SELECT id, nom FROM salaries');
  const salariesMap = {};
  salaries.forEach(s => {
    salariesMap[s.id] = s.nom;
  });

  // All charges per chantier for marge
  const [allChargeRows] = await pool.execute(`
    SELECT c.chantier_id, c.type, c.montant, c.isReelle, c.description
    FROM charges c
    JOIN chantiers ch ON c.chantier_id = ch.id
    WHERE ch.etat != 'annulé' ${dateCondition}
  `, params);

  const chargesByChantier = {};
  allChargeRows.forEach(row => {
    if (isProvisionalAuto30(row)) return;
    const id = row.chantier_id;
    chargesByChantier[id] = (chargesByChantier[id] || 0) + Number(row.montant || 0);
  });

  // Helper: check if a personnel entry matches the requested prestation type
  function matchesPrestation(p) {
    const pType = (p.prestationType || '').toLowerCase().trim();
    const pId = p.prestationId;
    if (pType === prestationType) return true;
    if (pId && prestationsMap[pId] === prestationType) return true;
    return false;
  }

  return { chargesRows, prestationsMap, salariesMap, chargesByChantier, matchesPrestation, prestationType };
}

// GET /api/prestation-stats — solo workers for a given prestationType
router.get('/', async (req, res) => {
  try {
    if (!req.query.prestationType) {
      return res.json([]);
    }

    const { chargesRows, salariesMap, chargesByChantier, matchesPrestation, prestationType } = await loadData(req.query);

    // Count workers per chantier to detect groups
    const workerCountByChantier = new Map();

    chargesRows.forEach(row => {
      try {
        const personnel = JSON.parse(row.personnel_data || '[]');
        if (!Array.isArray(personnel)) return;

        const namesOnThisChantier = workerCountByChantier.get(row.chantier_id) || new Set();

        personnel.forEach(p => {
          if (matchesPrestation(p)) {
            const name = p.nom || (p.salarieId && salariesMap[p.salarieId]) || 'Inconnu';
            namesOnThisChantier.add(name);
          }
        });

        workerCountByChantier.set(row.chantier_id, namesOnThisChantier);
      } catch (e) {
        console.error('Error parsing personnel data for group detection:', e);
      }
    });

    // Grouped chantier IDs (2+ workers of this type)
    const groupedChantierIds = new Set();
    workerCountByChantier.forEach((workerSet, chantierId) => {
      if (workerSet.size >= 2) {
        groupedChantierIds.add(chantierId);
      }
    });

    // Process solo workers (exclude grouped chantiers)
    const workersMap = new Map();

    chargesRows.forEach(row => {
      if (groupedChantierIds.has(row.chantier_id)) return;

      try {
        const personnel = JSON.parse(row.personnel_data || '[]');
        if (!Array.isArray(personnel)) return;

        personnel.forEach(p => {
          if (matchesPrestation(p)) {
            const workerName = p.nom || (p.salarieId && salariesMap[p.salarieId]) || 'Inconnu';

            if (!workersMap.has(workerName)) {
              workersMap.set(workerName, {
                nom: workerName,
                chantiers: new Set(),
                totalBudget: 0,
                totalCharges: 0
              });
            }

            const data = workersMap.get(workerName);
            if (!data.chantiers.has(row.chantier_id)) {
              data.chantiers.add(row.chantier_id);
              data.totalBudget += Number(row.budget || 0);
              data.totalCharges += Number(chargesByChantier[row.chantier_id] || 0);
            }
          }
        });
      } catch (e) {
        console.error('Error parsing personnel data:', e);
      }
    });

    const list = Array.from(workersMap.values()).map(p => ({
      nom: p.nom,
      nombreChantiers: p.chantiers.size,
      chiffreAffaire: p.totalBudget,
      marge: p.totalBudget - p.totalCharges,
      margePercent: p.totalBudget > 0 ? ((p.totalBudget - p.totalCharges) / p.totalBudget) * 100 : 0
    }));

    list.sort((a, b) => b.chiffreAffaire - a.chiffreAffaire);
    res.json(list);
  } catch (error) {
    console.error('Error getting prestation stats:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// GET /api/prestation-stats/groups — grouped workers (2+) for a given prestationType
router.get('/groups', async (req, res) => {
  try {
    if (!req.query.prestationType) {
      return res.json([]);
    }

    const { chargesRows, salariesMap, chargesByChantier, matchesPrestation } = await loadData(req.query);

    // Build worker sets per chantier
    const workersByChantier = new Map();

    for (const row of chargesRows) {
      let personnel;
      try {
        personnel = JSON.parse(row.personnel_data || '[]');
      } catch {
        personnel = [];
      }
      if (!Array.isArray(personnel)) continue;

      const entry = workersByChantier.get(row.chantier_id) || {
        memberIds: new Set(),
        memberNames: new Set(),
        budget: Number(row.budget || 0)
      };

      for (const p of personnel) {
        if (!matchesPrestation(p)) continue;

        const name = p.nom || (p.salarieId && salariesMap[p.salarieId]) || 'Inconnu';
        const idToken = (p.salarieId != null) ? `id:${p.salarieId}` : `name:${name}`;
        entry.memberIds.add(idToken);
        entry.memberNames.add(name);
      }
      entry.budget = Number(row.budget || entry.budget || 0);
      workersByChantier.set(row.chantier_id, entry);
    }

    // Group by exact set of workers (2+)
    const groupsMap = new Map();

    for (const [chantierId, info] of workersByChantier.entries()) {
      const names = Array.from(info.memberNames);
      const ids = Array.from(info.memberIds);
      if (names.length < 2) continue;

      const sortedNames = [...names].sort((a, b) => a.localeCompare(b, 'fr'));
      const sortedIds = [...ids].sort();
      const key = sortedIds.join('|');

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          members: sortedNames,
          memberIds: sortedIds,
          chantierIds: new Set(),
          totalBudget: 0,
          totalCharges: 0
        });
      }
      const g = groupsMap.get(key);
      if (!g.chantierIds.has(chantierId)) {
        g.chantierIds.add(chantierId);
        g.totalBudget += Number(info.budget || 0);
        g.totalCharges += Number(chargesByChantier[chantierId] || 0);
      }
    }

    const groupsList = Array.from(groupsMap.values()).map(g => {
      const chiffreAffaire = g.totalBudget;
      const marge = g.totalBudget - g.totalCharges;
      const margePercent = chiffreAffaire > 0 ? (marge / chiffreAffaire) * 100 : 0;
      return {
        type: 'group',
        nom: g.members.join(', '),
        members: g.members,
        memberIds: g.memberIds,
        nombreChantiers: g.chantierIds.size,
        chiffreAffaire,
        marge,
        margePercent
      };
    });

    groupsList.sort((a, b) => b.chiffreAffaire - a.chiffreAffaire);
    res.json(groupsList);
  } catch (error) {
    console.error('Error getting prestation groups:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

module.exports = router;
