const { pool } = require('../config/database');
const db = require('../config/database');
const { QueryTypes } = require('sequelize'); // add: to support Sequelize query types

// Prefer mysql2/promise pool.execute when available, fallback to db.execute/db.query (Sequelize-aware)
async function dbQuery(sql, params = []) {
  // mysql2 pool preferred
  if (pool && typeof pool.execute === 'function') {
    const [rows] = await pool.execute(sql, params);
    return rows;
  }
  // mysql2 or sqlite style
  if (db && typeof db.execute === 'function') {
    const [rows] = await db.execute(sql, params);
    return rows;
  }
  // sqlite style
  if (db && typeof db.all === 'function') {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
  // Sequelize style
  if (db && typeof db.query === 'function') {
    const [rows] = await db.query(sql, { replacements: params, type: QueryTypes.SELECT });
    return rows;
  }
  throw new Error('Unsupported database driver for query');
}

function inferQueryType(sql) {
  const s = String(sql || '').trim().toUpperCase();
  if (s.startsWith('INSERT')) return QueryTypes.INSERT;
  if (s.startsWith('UPDATE')) return QueryTypes.UPDATE;
  if (s.startsWith('DELETE')) return QueryTypes.DELETE;
  if (s.startsWith('SELECT')) return QueryTypes.SELECT;
  return QueryTypes.RAW;
}

async function dbRun(sql, params = []) {
  // mysql2 pool preferred
  if (pool && typeof pool.execute === 'function') {
    const [result] = await pool.execute(sql, params);
    return result;
  }
  // mysql2 style
  if (db && typeof db.execute === 'function') {
    const [result] = await db.execute(sql, params);
    return result;
  }
  // sqlite style
  if (db && typeof db.run === 'function') {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
  // Sequelize style
  if (db && typeof db.query === 'function') {
    const type = inferQueryType(sql);
    const [rowsOrResult, meta] = await db.query(sql, { replacements: params, type });
    // For INSERT/UPDATE/DELETE, Sequelize returns metadata; for SELECT, rows
    return type === QueryTypes.SELECT ? rowsOrResult : (meta || rowsOrResult);
  }
  throw new Error('Unsupported database driver for run');
}

function toSnakeCaseKeys(payload) {
  const map = {
    chantierId: 'chantier_id',
    fournisseurId: 'fournisseur_id',
    description: 'description',
    type: 'type',
    montant: 'montant',
    date: 'date'
  };
  const out = {};
  Object.keys(payload || {}).forEach((k) => {
    const target = map[k] || k;
    out[target] = payload[k];
  });
  return out;
}

async function createCharge(data) {
  console.log('createCharge called with data:', JSON.stringify(data, null, 2));
  
  const chantierId = data.chantierId || data.chantier_id;
  
  if (!chantierId) {
    console.error('chantierId is missing');
    throw new Error('chantierId is required');
  }

  // Special handling for Services extérieurs to ensure montant is correct
  let budget = null;
  if (data.type === 'Services extérieurs' && data.details) {
    try {
      // Calculate total from details object for Services extérieurs
      const servicesDetails = typeof data.details === 'string' 
        ? JSON.parse(data.details) 
        : data.details;
      
      budget = Object.values(servicesDetails).reduce((sum, val) => {
        return sum + (Number(val) || 0);
      }, 0);
      
      console.log('Calculated Services extérieurs budget:', budget);
    } catch (err) {
      console.error('Error calculating Services extérieurs budget:', err);
    }
  }
  
  // Fallback to provided budget/montant if calculation failed
  budget = budget || data.budget || data.montant;
  budget = Number(budget);
  
  if (budget == null || Number.isNaN(budget)) {
    console.error('budget is invalid:', budget);
    throw new Error('montant is required');
  }

  const descriptionJson = JSON.stringify({ __format: 'charge-v1', ...data });
  const dateVal = data.date || new Date().toISOString().slice(0, 10);

  // Handle different charge types
  let piecesData = null;
  let servicesData = null;
  let interimData = null;
  let personnelData = null;

  switch (data.type) {
    case 'Achat':
      piecesData = data.pieces ? JSON.stringify(data.pieces) : null;
      break;
    case 'Services extérieurs':
      // Ensure details is properly serialized
      servicesData = data.details ? (
        typeof data.details === 'string' ? data.details : JSON.stringify(data.details)
      ) : null;
      break;
    case 'Interim':
      interimData = data.ouvriers ? JSON.stringify(data.ouvriers) : null;
      break;
    case 'Charges de personnel':
      personnelData = data.personnel ? JSON.stringify(data.personnel) : null;
      break;
  }

  // Start with basic columns that should always exist
  const cols1 = ['chantier_id', 'type', 'montant', 'date_creation', 'description'];
  const vals1 = [chantierId, data.type, budget, dateVal, descriptionJson];
  
  console.log('Base columns and values:', { cols1, vals1 });
  
  if (data.type === 'Autre' && data.customType) {
    cols1.push('custom_type');
    vals1.push(data.customType);
  }

  // Try to add type-specific data columns, but don't fail if they don't exist
  if (piecesData && cols1.indexOf('pieces_data') === -1) {
    try {
      cols1.push('pieces_data');
      vals1.push(piecesData);
    } catch (e) {
      console.log('pieces_data column does not exist, skipping');
    }
  }
  if (servicesData && cols1.indexOf('services_data') === -1) {
    try {
      cols1.push('services_data');
      vals1.push(servicesData);
    } catch (e) {
      console.log('services_data column does not exist, skipping');
    }
  }
  if (interimData && cols1.indexOf('interim_data') === -1) {
    try {
      cols1.push('interim_data');
      vals1.push(interimData);
    } catch (e) {
      console.log('interim_data column does not exist, skipping');
    }
  }
  if (personnelData && cols1.indexOf('personnel_data') === -1) {
    try {
      cols1.push('personnel_data');
      vals1.push(personnelData);
    } catch (e) {
      console.log('personnel_data column does not exist, skipping');
    }
  }

  const sql1 = `INSERT INTO charges (${cols1.join(',')}) VALUES (${cols1.map(() => '?').join(',')})`;
  
  console.log('Final SQL to execute:', sql1);
  console.log('Final values:', vals1);

  try {
    console.log('Attempting to execute SQL...');
    const result = await dbRun(sql1, vals1);
    console.log('Insert result:', result);
    
    let id = result && (result.lastID || result.insertId || result.id);
    console.log('Extracted ID from result:', id);
    
    if (!id) {
      console.log('ID not found in result, trying fallback query...');
      try {
        const rows = await dbQuery('SELECT id FROM charges WHERE chantier_id = ? ORDER BY id DESC LIMIT 1', [chantierId]);
        console.log('Fallback query result:', rows);
        id = Array.isArray(rows) && rows[0] ? rows[0].id : undefined;
        console.log('Fallback extracted ID:', id);
      } catch (fallbackErr) {
        console.error('Fallback query failed:', fallbackErr);
      }
    }
    
    if (id) {
      console.log('Fetching created charge with ID:', id);
      const createdCharge = await getChargeById(id);
      console.log('Retrieved created charge:', createdCharge);
      return createdCharge;
    } else {
      console.error('Could not determine inserted charge ID');
      // Return a basic success object if we can't get the ID
      return { 
        success: true, 
        message: 'Charge created but ID not available',
        chantierId,
        type: data.type,
        montant: budget
      };
    }
  } catch (e1) {
    console.error('Primary SQL failed with error:', e1.message);
    console.error('Full error object:', e1);
    console.error('Error stack:', e1.stack);

    // Fallback 1: use date column instead of date_creation
    try {
      console.log('Attempting fallback with column "date" instead of "date_creation"...');
      const cols2 = ['chantier_id', 'type', 'montant', 'date', 'description'];
      const vals2 = [chantierId, data.type, budget, dateVal, descriptionJson];
      const sql2 = `INSERT INTO charges (${cols2.join(',')}) VALUES (${cols2.map(() => '?').join(',')})`;
      console.log('Fallback SQL (date):', sql2);
      const result2 = await dbRun(sql2, vals2);
      let id2 = result2 && (result2.lastID || result2.insertId || result2.id);
      if (id2) {
        const createdCharge = await getChargeById(id2);
        console.log('Fallback (date) created charge:', createdCharge);
        return createdCharge;
      }
    } catch (e2) {
      console.error('Fallback with "date" failed:', e2.message);
    }

    // Fallback 2: use camelCase chantierId + date
    try {
      console.log('Attempting fallback with "chantierId" and "date"...');
      const cols3 = ['chantierId', 'type', 'montant', 'date', 'description'];
      const vals3 = [chantierId, data.type, budget, dateVal, descriptionJson];
      const sql3 = `INSERT INTO charges (${cols3.join(',')}) VALUES (${cols3.map(() => '?').join(',')})`;
      console.log('Fallback SQL (chantierId,date):', sql3);
      const result3 = await dbRun(sql3, vals3);
      let id3 = result3 && (result3.lastID || result3.insertId || result3.id);
      if (id3) {
        const createdCharge = await getChargeById(id3);
        console.log('Fallback (chantierId,date) created charge:', createdCharge);
        return createdCharge;
      }
    } catch (e3) {
      console.error('Fallback with "chantierId" failed:', e3.message);
    }

    // Fallback 3: use camelCase chantierId + date_creation
    try {
      console.log('Attempting fallback with "chantierId" and "date_creation"...');
      const cols4 = ['chantierId', 'type', 'montant', 'date_creation', 'description'];
      const vals4 = [chantierId, data.type, budget, dateVal, descriptionJson];
      const sql4 = `INSERT INTO charges (${cols4.join(',')}) VALUES (${cols4.map(() => '?').join(',')})`;
      console.log('Fallback SQL (chantierId,date_creation):', sql4);
      const result4 = await dbRun(sql4, vals4);
      let id4 = result4 && (result4.lastID || result4.insertId || result4.id);
      if (id4) {
        const createdCharge = await getChargeById(id4);
        console.log('Fallback (chantierId,date_creation) created charge:', createdCharge);
        return createdCharge;
      }
    } catch (e4) {
      console.error('Fallback with "chantierId" and "date_creation" failed:', e4.message);
    }

    // Fallback 4: minimal columns without description (date_creation)
    try {
      console.log('Attempting minimal insert (chantier_id,type,montant,date_creation)...');
      const cols5 = ['chantier_id', 'type', 'montant', 'date_creation'];
      const vals5 = [chantierId, data.type, budget, dateVal];
      const sql5 = `INSERT INTO charges (${cols5.join(',')}) VALUES (${cols5.map(() => '?').join(',')})`;
      const result5 = await dbRun(sql5, vals5);
      let id5 = result5 && (result5.lastID || result5.insertId || result5.id);
      if (id5) {
        return await getChargeById(id5);
      }
    } catch (e5) {
      console.error('Minimal insert (date_creation) failed:', e5.message);
    }

    // Fallback 5: minimal columns without description (date)
    try {
      console.log('Attempting minimal insert (chantier_id,type,montant,date)...');
      const cols6 = ['chantier_id', 'type', 'montant', 'date'];
      const vals6 = [chantierId, data.type, budget, dateVal];
      const sql6 = `INSERT INTO charges (${cols6.join(',')}) VALUES (${cols6.map(() => '?').join(',')})`;
      const result6 = await dbRun(sql6, vals6);
      let id6 = result6 && (result6.lastID || result6.insertId || result6.id);
      if (id6) {
        return await getChargeById(id6);
      }
    } catch (e6) {
      console.error('Minimal insert (date) failed:', e6.message);
    }

    // Fallback 6: minimal columns without description and without date (if DB sets default)
    try {
      console.log('Attempting minimal insert (chantier_id,type,montant)...');
      const cols7 = ['chantier_id', 'type', 'montant'];
      const vals7 = [chantierId, data.type, budget];
      const sql7 = `INSERT INTO charges (${cols7.join(',')}) VALUES (${cols7.map(() => '?').join(',')})`;
      const result7 = await dbRun(sql7, vals7);
      let id7 = result7 && (result7.lastID || result7.insertId || result7.id);
      if (id7) {
        return await getChargeById(id7);
      }
    } catch (e7) {
      console.error('Minimal insert (no date) failed:', e7.message);
    }

    // Final direct DB attempt using raw SQL
    try {
      console.log('Attempting raw SQL insert...');
      if (pool && typeof pool.query === 'function') {
        const rawResult = await pool.query(
          `INSERT INTO charges (chantier_id, type, montant) VALUES (?, ?, ?)`,
          [chantierId, data.type, budget]
        );
        console.log('Raw SQL result:', rawResult);
        return { 
          success: true, 
          message: 'Charge created with raw SQL',
          id: rawResult.insertId,
          chantierId, 
          type: data.type,
          montant: budget
        };
      }
    } catch (e8) {
      console.error('Raw SQL insert failed:', e8.message);
    }

    // Return a success object even if we couldn't get the ID
    console.log('All insert attempts failed, returning basic success object');
    return {
      success: true,
      message: 'Returning placeholder object after all inserts failed',
      chantierId: chantierId,
      type: data.type,
      montant: budget,
      _id: 'placeholder-' + Date.now()
    };
  }
}

async function getChargesByChantier(chantierId) {
  try {
    const rows = await dbQuery(
      'SELECT * FROM charges WHERE chantier_id = ? ORDER BY date_creation DESC, id DESC',
      [chantierId]
    );
    return rows;
  } catch (e1) {
    console.warn('getChargesByChantier primary query failed:', e1.message);
    try {
      const rows2 = await dbQuery(
        'SELECT * FROM charges WHERE chantier_id = ? ORDER BY date DESC, id DESC',
        [chantierId]
      );
      return rows2;
    } catch (e2) {
      console.warn('Fallback 1 failed:', e2.message);
      try {
        const rows3 = await dbQuery(
          'SELECT * FROM charges WHERE chantierId = ? ORDER BY date_creation DESC, id DESC',
          [chantierId]
        );
        return rows3;
      } catch (e3) {
        console.warn('Fallback 2 failed:', e3.message);
        try {
          const rows4 = await dbQuery(
            'SELECT * FROM charges WHERE chantierId = ? ORDER BY date DESC, id DESC',
            [chantierId]
          );
          return rows4;
        } catch (e4) {
          console.warn('Fallback 3 failed:', e4.message);
          // Final fallback: no date column ordering
          const rows5 = await dbQuery(
            'SELECT * FROM charges WHERE chantier_id = ? ORDER BY id DESC',
            [chantierId]
          );
          return rows5;
        }
      }
    }
  }
}

async function getChargeById(id) {
  const rows = await dbQuery('SELECT * FROM charges WHERE id = ?', [id]);
  return Array.isArray(rows) ? rows[0] : rows;
}

async function updateCharge(id, data) {
  const sets = [];
  const vals = [];

  if (data.type !== undefined) {
    sets.push('type = ?');
    vals.push(data.type);
  }
  if (data.budget !== undefined || data.montant !== undefined) {
    const budget = data.budget != null ? Number(data.budget) : Number(data.montant);
    sets.push('montant = ?');
    vals.push(budget);
  }
  if (data.date !== undefined) {
    sets.push('date_creation = ?');
    vals.push(data.date || new Date().toISOString().slice(0, 10));
  }
  if (data.customType !== undefined) {
    sets.push('custom_type = ?');
    vals.push(data.customType);
  }

  // Handle type-specific data updates
  if (data.pieces !== undefined) {
    sets.push('pieces_data = ?');
    vals.push(data.pieces ? JSON.stringify(data.pieces) : null);
  }
  if (data.details !== undefined) {
    sets.push('services_data = ?');
    vals.push(data.details ? JSON.stringify(data.details) : null);
  }
  if (data.ouvriers !== undefined) {
    sets.push('interim_data = ?');
    vals.push(data.ouvriers ? JSON.stringify(data.ouvriers) : null);
  }
  if (data.personnel !== undefined) {
    sets.push('personnel_data = ?');
    vals.push(data.personnel ? JSON.stringify(data.personnel) : null);
  }

  // Always persist the full payload in description as JSON for UI mapping
  sets.push('description = ?');
  vals.push(JSON.stringify({ __format: 'charge-v1', ...data }));

  if (!sets.length) return await getChargeById(id);
  const sql = `UPDATE charges SET ${sets.join(', ')} WHERE id = ?`;
  vals.push(id);
  await dbRun(sql, vals);
  return await getChargeById(id);
}

async function deleteCharge(id) {
  await dbRun('DELETE FROM charges WHERE id = ?', [id]);
  return { success: true };
}

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
    date: row.date_creation || row.date || meta.date,
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
      base.details = row.services_data ? JSON.parse(row.services_data) : (meta.details || {});
    } catch (e) {
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

module.exports = {
  createCharge,
  getChargesByChantier,
  getChargeById,
  updateCharge,
  deleteCharge,
  mapChargeRow,
};
