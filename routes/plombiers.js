const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// Get available years for filtering
router.get('/years', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT DISTINCT YEAR(ch.dateDebut) as year
      FROM chantiers ch
      WHERE ch.dateDebut IS NOT NULL
      UNION
      SELECT DISTINCT YEAR(ch.dateFin) as year
      FROM chantiers ch
      WHERE ch.dateFin IS NOT NULL
      UNION
      SELECT DISTINCT YEAR(ch.dateSaisie) as year
      FROM chantiers ch
      WHERE ch.dateSaisie IS NOT NULL
      ORDER BY year DESC
    `);
    
    const currentYear = new Date().getFullYear();
    const years = rows.map(row => row.year).filter(year => year);
    
    // Add current year if not present
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

// Get all plombiers with statistics
router.get('/', async (req, res) => {
  try {
    const { filterType, date, month, year, weekStart, weekEnd } = req.query;
    
    // Build date filtering conditions
    let dateCondition = '';
    const params = [];
    
    if (filterType === 'day' && date) {
      dateCondition = ` AND (DATE(ch.dateDebut) = ? OR DATE(ch.dateFin) = ? OR DATE(ch.dateSaisie) = ?)`;
      params.push(date, date, date);
    } else if (filterType === 'week' && weekStart && weekEnd) {
      dateCondition = ` AND (
        (ch.dateDebut BETWEEN ? AND ?) OR
        (ch.dateFin BETWEEN ? AND ?) OR
        (ch.dateSaisie BETWEEN ? AND ?)
      )`;
      params.push(weekStart, weekEnd, weekStart, weekEnd, weekStart, weekEnd);
    } else if (filterType === 'month' && month && year) {
      dateCondition = ` AND (
        (YEAR(ch.dateDebut) = ? AND MONTH(ch.dateDebut) = ?) OR
        (YEAR(ch.dateFin) = ? AND MONTH(ch.dateFin) = ?) OR
        (YEAR(ch.dateSaisie) = ? AND MONTH(ch.dateSaisie) = ?)
      )`;
      params.push(year, month, year, month, year, month);
    } else if (filterType === 'year' && year) {
      dateCondition = ` AND (
        YEAR(ch.dateDebut) = ? OR
        YEAR(ch.dateFin) = ? OR
        YEAR(ch.dateSaisie) = ?
      )`;
      params.push(year, year, year);
    }

    // First get all charges with personnel data
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

    // Get prestations to identify plombiers
    const [prestations] = await pool.execute('SELECT id, name FROM prestations');
    const prestationsMap = {};
    prestations.forEach(p => {
      prestationsMap[p.id] = (p.name || '').toLowerCase().trim();
    });

    // Get salaries names
    const [salaries] = await pool.execute('SELECT id, nom FROM salaries');
    const salariesMap = {};
    salaries.forEach(s => {
      salariesMap[s.id] = s.nom;
    });

    // Get all charges for each chantier for marge calculation
    const [allCharges] = await pool.execute(`
      SELECT ch.id as chantier_id, SUM(c.montant) as total_charges
      FROM chantiers ch
      LEFT JOIN charges c ON c.chantier_id = ch.id
      WHERE ch.etat != 'annulé' ${dateCondition}
      GROUP BY ch.id
    `, params);
    const chargesByChantier = {};
    allCharges.forEach(c => {
      chargesByChantier[c.chantier_id] = Number(c.total_charges || 0);
    });

    // Process plombiers data
    const plombiersMap = new Map();

    chargesRows.forEach(row => {
      try {
        const personnel = JSON.parse(row.personnel_data || '[]');
        if (!Array.isArray(personnel)) return;

        personnel.forEach(p => {
          // Check if this is a plombier
          const prestationType = (p.prestationType || '').toLowerCase().trim();
          const prestationId = p.prestationId;
          
          let isPlombier = prestationType === 'plombier';
          if (!isPlombier && prestationId && prestationsMap[prestationId] === 'plombier') {
            isPlombier = true;
          }

          if (isPlombier) {
            // Get plombier name
            const plombierName = p.nom || 
                                 (p.salarieId && salariesMap[p.salarieId]) || 
                                 'Plombier Inconnu';

            if (!plombiersMap.has(plombierName)) {
              plombiersMap.set(plombierName, {
                nom: plombierName,
                chantiers: new Set(),
                totalBudget: 0,
                totalCharges: 0
              });
            }

            const plombierData = plombiersMap.get(plombierName);
            
            // Add chantier if not already counted
            if (!plombierData.chantiers.has(row.chantier_id)) {
              plombierData.chantiers.add(row.chantier_id);
              plombierData.totalBudget += Number(row.budget || 0);
              plombierData.totalCharges += Number(chargesByChantier[row.chantier_id] || 0);
            }
          }
        });
      } catch (e) {
        console.error('Error parsing personnel data:', e);
      }
    });

    // Convert to array and calculate final stats
    const plombiersList = Array.from(plombiersMap.values()).map(p => ({
      nom: p.nom,
      nombreChantiers: p.chantiers.size,
      chiffreAffaire: p.totalBudget,
      marge: p.totalBudget - p.totalCharges,
      margePercent: p.totalBudget > 0 ? ((p.totalBudget - p.totalCharges) / p.totalBudget) * 100 : 0
    }));

    // Sort by chiffre d'affaire descending
    plombiersList.sort((a, b) => b.chiffreAffaire - a.chiffreAffaire);

    res.json(plombiersList);
  } catch (error) {
    console.error('Error getting plombiers:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// NEW: Get grouped plumber teams (two or more plumbers working together on the same chantier)
router.get('/groups', async (req, res) => {
  try {
    const { filterType, date, month, year, weekStart, weekEnd } = req.query;

    // Build date filtering conditions (reuse logic from singles endpoint)
    let dateCondition = '';
    const params = [];

    if (filterType === 'day' && date) {
      dateCondition = ` AND (DATE(ch.dateDebut) = ? OR DATE(ch.dateFin) = ? OR DATE(ch.dateSaisie) = ?)`;
      params.push(date, date, date);
    } else if (filterType === 'week' && weekStart && weekEnd) {
      dateCondition = ` AND (
        (ch.dateDebut BETWEEN ? AND ?) OR
        (ch.dateFin BETWEEN ? AND ?) OR
        (ch.dateSaisie BETWEEN ? AND ?)
      )`;
      params.push(weekStart, weekEnd, weekStart, weekEnd, weekStart, weekEnd);
    } else if (filterType === 'month' && month && year) {
      dateCondition = ` AND (
        (YEAR(ch.dateDebut) = ? AND MONTH(ch.dateDebut) = ?) OR
        (YEAR(ch.dateFin) = ? AND MONTH(ch.dateFin) = ?) OR
        (YEAR(ch.dateSaisie) = ? AND MONTH(ch.dateSaisie) = ?)
      )`;
      params.push(year, month, year, month, year, month);
    } else if (filterType === 'year' && year) {
      dateCondition = ` AND (
        YEAR(ch.dateDebut) = ? OR
        YEAR(ch.dateFin) = ? OR
        YEAR(ch.dateSaisie) = ?
      )`;
      params.push(year, year, year);
    }

    // Pull personnel charges joined to chantier info (budget)
    const [chargesRows] = await pool.execute(`
      SELECT 
        c.id as charge_id,
        c.chantier_id,
        c.personnel_data,
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

    // Preload prestations and salaries lookup
    const [prestations] = await pool.execute('SELECT id, name FROM prestations');
    const prestationsMap = {};
    prestations.forEach(p => {
      prestationsMap[p.id] = (p.name || '').toLowerCase().trim();
    });

    const [salaries] = await pool.execute('SELECT id, nom FROM salaries');
    const salariesMap = {};
    salaries.forEach(s => {
      salariesMap[s.id] = s.nom;
    });

    // All charges per chantier to compute margin
    const [allCharges] = await pool.execute(`
      SELECT ch.id as chantier_id, SUM(c.montant) as total_charges
      FROM chantiers ch
      LEFT JOIN charges c ON c.chantier_id = ch.id
      WHERE ch.etat != 'annulé' ${dateCondition}
      GROUP BY ch.id
    `, params);
    const chargesByChantier = {};
    allCharges.forEach(c => {
      chargesByChantier[c.chantier_id] = Number(c.total_charges || 0);
    });

    // Step 1: Build unique plumber sets per chantier (merge across multiple charges rows for the same chantier)
    const plumbersByChantier = new Map(); // chantier_id => { memberIds:Set, memberNames:Set, budget }

    for (const row of chargesRows) {
      let personnel;
      try {
        personnel = JSON.parse(row.personnel_data || '[]');
      } catch {
        personnel = [];
      }
      if (!Array.isArray(personnel)) continue;

      const entry = plumbersByChantier.get(row.chantier_id) || {
        memberIds: new Set(),
        memberNames: new Set(),
        budget: Number(row.budget || 0)
      };

      for (const p of personnel) {
        const prestationType = (p.prestationType || '').toLowerCase().trim();
        const prestationId = p.prestationId;
        let isPlombier = prestationType === 'plombier';
        if (!isPlombier && prestationId && prestationsMap[prestationId] === 'plombier') {
          isPlombier = true;
        }
        if (!isPlombier) continue;

        const name = p.nom || (p.salarieId && salariesMap[p.salarieId]) || 'Plombier Inconnu';
        const idToken = (p.salarieId != null) ? `id:${p.salarieId}` : `name:${name}`; // prefer stable id
        entry.memberIds.add(idToken);
        entry.memberNames.add(name);
      }
      // Keep latest known budget (they should be equal per chantier)
      entry.budget = Number(row.budget || entry.budget || 0);
      plumbersByChantier.set(row.chantier_id, entry);
    }

    // Step 2: For chantiers with >= 2 plumbers, group by exact set of plumbers
    const groupsMap = new Map(); // key => { members[], memberIds[], chantierIds:Set, totalBudget, totalCharges }

    for (const [chantierId, info] of plumbersByChantier.entries()) {
      const names = Array.from(info.memberNames);
      const ids = Array.from(info.memberIds);
      if (names.length < 2) continue; // only groups (leave singles unchanged)

      // Sort for stable grouping
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
        g.totalBudget += Number(info.budget || 0); // CA is the chantier budget counted once
        g.totalCharges += Number(chargesByChantier[chantierId] || 0);
      }
    }

    // Step 3: Build response list
    const groupsList = Array.from(groupsMap.values()).map(g => {
      const chiffreAffaire = g.totalBudget;
      const marge = g.totalBudget - g.totalCharges;
      const margePercent = chiffreAffaire > 0 ? (marge / chiffreAffaire) * 100 : 0;
      return {
        type: 'group',
        nom: g.members.join(', '), // display name like "aziz, mohamed"
        members: g.members,
        memberIds: g.memberIds,
        nombreChantiers: g.chantierIds.size,
        chiffreAffaire,
        marge,
        margePercent
      };
    });

    // Order by chiffre d'affaire desc
    groupsList.sort((a, b) => b.chiffreAffaire - a.chiffreAffaire);

    res.json(groupsList);
  } catch (error) {
    console.error('Error getting plumber groups:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

module.exports = router;
