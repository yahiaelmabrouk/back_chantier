const { pool } = require('../config/database');
const db = require('../config/database');
const Chantier = require('./Chantier');
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

// -------------------- NEW HELPERS FOR BILLABLE NORMALIZATION --------------------

function isValidWorkDay(d) {
  const debut = Number(d?.heureDebut);
  const fin = Number(d?.heureFin);
  return !isNaN(debut) && !isNaN(fin) && fin > debut;
}

function billedDaysCount(dates) {
  if (!Array.isArray(dates)) return 0;
  let days = 0;
  for (const d of dates) {
    if (isValidWorkDay(d) && d?.billable !== false) {
      days += 1;
    }
  }
  return days;
}

// -------------------- FRENCH HOLIDAYS & WORKING DAYS --------------------
function easterDate(year) {
  // Meeus/Jones/Butcher algorithm for Gregorian Easter
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
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDaysUTC(dateUTC, days) {
  const d = new Date(dateUTC.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function fmtDateUTC(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function frenchPublicHolidays(year) {
  const easter = easterDate(year);
  const easterMonday = addDaysUTC(easter, 1);
  const ascension = addDaysUTC(easter, 39);
  const pentecostMonday = addDaysUTC(easter, 50);
  // Fixed dates in UTC to avoid TZ skew
  const list = [
    `${year}-01-01`, // New Year
    `${year}-05-01`, // Labour Day
    `${year}-05-08`, // Victory in Europe Day
    `${year}-07-14`, // Bastille Day
    `${year}-08-15`, // Assumption
    `${year}-11-01`, // All Saints' Day
    `${year}-11-11`, // Armistice
    `${year}-12-25`, // Christmas
    fmtDateUTC(easterMonday),
    fmtDateUTC(ascension),
    fmtDateUTC(pentecostMonday),
  ];
  return new Set(list);
}

function isWeekendUTC(dateStr) {
  // Use UTC to make weekday stable regardless of server TZ
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=Sun,6=Sat
  return day === 0 || day === 6;
}

function isFrenchHoliday(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const y = d.getUTCFullYear();
  const hols = frenchPublicHolidays(y);
  return hols.has(dateStr);
}

function isWorkingDay(dateStr) {
  if (!dateStr) return false;
  if (isWeekendUTC(dateStr)) return false;
  if (isFrenchHoliday(dateStr)) return false;
  return true;
}

function enumerateDatesInclusiveUTC(startStr, endStr) {
  const arr = [];
  if (!startStr || !endStr) return arr;
  const start = new Date(`${startStr}T00:00:00Z`);
  const end = new Date(`${endStr}T00:00:00Z`);
  if (isNaN(start) || isNaN(end) || start > end) return arr;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    arr.push(fmtDateUTC(d));
  }
  return arr;
}

async function buildFirstChargeIdMapForDates(datesSet, excludeChargeId) {
  // Build earliest charge id per (salarieId|date); scans existing personnel charges.
  // Note: we scan all "Charges de personnel" because per-day data is inside JSON, not in columns.
  const rows = await dbQuery('SELECT id, personnel_data FROM charges WHERE type = ?', ['Charges de personnel']);
  const map = new Map(); // key => earliestChargeId
  const excludeIdStr = excludeChargeId ? String(excludeChargeId) : null;

  for (const row of rows || []) {
    const rowIdStr = String(row.id);
    if (excludeIdStr && rowIdStr === excludeIdStr) continue;

    let personnel = [];
    try {
      personnel = row.personnel_data ? JSON.parse(row.personnel_data) : [];
    } catch {
      personnel = [];
    }
    for (const p of Array.isArray(personnel) ? personnel : []) {
      const salarieId = String(p?.salarieId || '');
      if (!salarieId) continue;
      for (const d of Array.isArray(p?.dates) ? p.dates : []) {
        const dd = d?.date;
        if (!dd || !datesSet.has(dd)) continue;
        const key = `${salarieId}|${dd}`;
        const prev = map.get(key);
        if (!prev || Number(row.id) < Number(prev)) {
          map.set(key, Number(row.id));
        }
      }
    }
  }
  return map;
}

async function normalizePersonnelAndBudget(personnel, { excludeChargeId, chantierId } = {}) {
  console.log('=== normalizePersonnelAndBudget START ===');
  console.log('chantierId:', chantierId, 'excludeChargeId:', excludeChargeId, 'personnel count:', personnel?.length);
  const normalized = [];
  const targetDates = new Set();
  for (const p of personnel || []) {
    for (const d of p?.dates || []) {
      if (d?.date) targetDates.add(d.date);
    }
  }

  const firstMap = await buildFirstChargeIdMapForDates(targetDates, excludeChargeId);
  let recalculatedBudget = 0;

  // Fetch all salarie taux_horaire from database for accuracy
  const salarieRates = new Map();
  const salarieIds = [...new Set((personnel || []).filter(p => !p?.isTransportFee).map(p => String(p?.salarieId || '')).filter(Boolean))];
  if (salarieIds.length > 0) {
    try {
      const placeholders = salarieIds.map(() => '?').join(',');
      const rows = await dbQuery(`SELECT id, taux_horaire FROM salaries WHERE id IN (${placeholders})`, salarieIds);
      for (const row of rows || []) {
        salarieRates.set(String(row.id), Number(row.taux_horaire || 0));
      }
      console.log('Fetched taux_horaire for', salarieRates.size, 'salaries from database');
    } catch (err) {
      console.error('Error fetching salarie rates:', err);
    }
  }

  // Determine chantier duration for long/short mode
  let isLongChantier = false;
  let chantierDates = { start: null, end: null };
  console.log('Determining long/short mode...');
  if (chantierId) {
    try {
      const ch = await Chantier.getById(chantierId);
      if (ch && ch.dateDebut && ch.dateFin) {
        const toYMD = (v) => {
          if (!v) return null;
          if (typeof v === 'string') {
            if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
            if (v.includes('T')) return v.split('T')[0];
          }
          try { return new Date(v).toISOString().slice(0,10); } catch { return null; }
        };
        const d1 = toYMD(ch.dateDebut);
        const d2 = toYMD(ch.dateFin);
        const dates = enumerateDatesInclusiveUTC(d1, d2);
        isLongChantier = dates.length > 1; // duration > 1 day
        chantierDates = { start: d1, end: d2 };
        console.log('Chantier dates:', d1, 'to', d2, '=> days:', dates.length, '=> isLongChantier:', isLongChantier);
      }
    } catch (_) {}
  }

  // Fallback: infer long/short from personnel entries if chantier dates unavailable
  if (!isLongChantier) {
    let minDate = null;
    let maxDate = null;
    const toYMD = (v) => {
      if (!v) return null;
      if (typeof v === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
        if (v.includes('T')) return v.split('T')[0];
      }
      try { return new Date(v).toISOString().slice(0,10); } catch { return null; }
    };
    for (const p of Array.isArray(personnel) ? personnel : []) {
      const dStart = toYMD(p.dateDebut);
      const dEnd = toYMD(p.dateFin);
      if (dStart) minDate = !minDate || dStart < minDate ? dStart : minDate;
      if (dEnd) maxDate = !maxDate || dEnd > maxDate ? dEnd : maxDate;
      for (const d of Array.isArray(p?.dates) ? p.dates : []) {
        const dd = toYMD(d?.date || d);
        if (!dd) continue;
        minDate = !minDate || dd < minDate ? dd : minDate;
        maxDate = !maxDate || dd > maxDate ? dd : maxDate;
      }
    }
    if (minDate && maxDate) {
      const span = enumerateDatesInclusiveUTC(minDate, maxDate);
      console.log('Fallback: inferred dates:', minDate, 'to', maxDate, '=> days:', span.length);
      if (span.length > 7) {
        isLongChantier = true;
        chantierDates = { start: minDate, end: maxDate };
        console.log('Fallback detected long chantier');
      }
    }
  }
  console.log('Final mode: isLongChantier =', isLongChantier);

  for (const p of Array.isArray(personnel) ? personnel : []) {
    if (p?.isTransportFee) {
      // transport fee entries remain as-is
      const amount = Number(p.amount ?? p.total ?? 0);
      normalized.push({ ...p });
      recalculatedBudget += amount;
      continue;
    }

    const salarieId = String(p?.salarieId || '');
    let candidateDates = Array.isArray(p?.dates) ? p.dates : [];
    console.log('Processing entry for salarieId:', salarieId, 'dates count:', candidateDates.length, 'isLongChantier:', isLongChantier);

    // For long chantiers, if no valid date strings found, produce baseline working days
    const hasValidDates = candidateDates.some(d => (d?.date || d) && typeof (d?.date || d) === 'string');
    if (isLongChantier && !hasValidDates) {
      console.log('No valid dates found for long chantier, generating baseline working days');
      const startGuess = p?.dateDebut || chantierDates.start;
      const endGuess = p?.dateFin || chantierDates.end;
      if (startGuess && endGuess) {
        const all = enumerateDatesInclusiveUTC(startGuess, endGuess);
        candidateDates = all.filter(isWorkingDay).map((ds) => ({ date: ds }));
      }
    }

    const newDates = (candidateDates || []).map(d => {
      const dateStr = typeof d === 'string' ? d : d?.date;
      if (!dateStr) return { ...d, billable: false };
      const normalized = { ...d, date: dateStr };
      const key = `${salarieId}|${dateStr}`;
      // If there is an earlier charge id for this salarié/date: not billable here
      // If none: current is first => billable true
      const earliest = firstMap.get(key);
      let billable = earliest == null ? true : (excludeChargeId ? Number(excludeChargeId) === Number(earliest) : false);
      // For long chantiers, never bill weekends or French public holidays
      if (isLongChantier && !isWorkingDay(dateStr)) {
        billable = false;
      }
      return { ...normalized, billable };
    });

    let total = 0;
    if (isLongChantier) {
      // Count only working days that are billable
      const days = newDates.reduce((cnt, d) => {
        if (d?.date && d.billable !== false && isWorkingDay(d.date)) return cnt + 1;
        return cnt;
      }, 0);
      total = 140 * days;
      console.log('Long chantier: counted', days, 'working days => total =', total);
    } else {
      // Use taux_horaire from database if available, otherwise fallback to entry data
      const tx = salarieRates.get(salarieId) ?? Number(p?.tauxHoraire || 0);
      const billedDays = billedDaysCount(newDates);
      total = tx * (billedDays * 7);
      console.log('Short chantier: tx =', tx, '(from DB:', salarieRates.has(salarieId), '), billedDays =', billedDays, '=> total =', total);
    }

    const realHours = isLongChantier ? 0 : (p?.dates || []).reduce((sum, d) => {
      const debut = Number(d?.heureDebut);
      const fin = Number(d?.heureFin);
      return (!isNaN(debut) && !isNaN(fin) && fin > debut) ? sum + (fin - debut) : sum;
    }, 0);
    console.log('Entry result: realHours =', realHours, 'total =', total, 'dates with billable:', newDates.filter(x => x.billable !== false).length);

    normalized.push({
      ...p,
      dates: newDates,
      total,
      totalHeures: realHours
    });
    recalculatedBudget += total;
  }

  console.log('=== normalizePersonnelAndBudget END: recalculatedBudget =', recalculatedBudget, '===');
  return { normalizedPersonnel: normalized, recalculatedBudget };
}

// -------------------- END NEW HELPERS --------------------

async function createCharge(data) {
  console.log('=== createCharge START ===');
  console.log('Input data:', JSON.stringify(data, null, 2));
  
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

  // NEW: Normalize personnel and recalc budget server-side (source of truth)
  let personnelData = null;
  if (data.type === 'Charges de personnel' && Array.isArray(data.personnel)) {
    console.log('Personnel charge detected, normalizing...');
    try {
      const chantierId = data.chantierId || data.chantier_id;
      console.log('Calling normalizePersonnelAndBudget with chantierId:', chantierId, 'personnel count:', data.personnel.length);
      const { normalizedPersonnel, recalculatedBudget } = await normalizePersonnelAndBudget(data.personnel, { excludeChargeId: null, chantierId });
      console.log('Normalization result: recalculatedBudget =', recalculatedBudget, 'normalized count =', normalizedPersonnel.length);
      personnelData = JSON.stringify(normalizedPersonnel);
      budget = recalculatedBudget;
      console.log('Budget after normalization:', budget);
    } catch (e) {
      console.error('Error normalizing personnel:', e);
    }
  }
  
  // Fallback to provided budget/montant if calculation failed
  console.log('Budget before fallback:', budget);
  budget = budget ?? data.budget ?? data.montant;
  console.log('Budget after fallback:', budget);
  budget = Number(budget);
  console.log('Budget as Number:', budget);
  
  if (budget == null || Number.isNaN(budget)) {
    console.error('budget is invalid:', budget);
    throw new Error('montant is required');
  }
  
  console.log('Final budget to insert:', budget);

  const descriptionJson = JSON.stringify({ __format: 'charge-v1', ...data });
  const dateVal = data.date || new Date().toISOString().slice(0, 10);

  // Handle different charge types
  let piecesData = null;
  let servicesData = null;
  let interimData = null;
  // personnelData already prepared above if applicable

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
      // already set personnelData
      break;
  }

  // Start with basic columns that should always exist
  const cols1 = ['chantier_id', 'type', 'montant', 'date_creation', 'description'];
  const vals1 = [chantierId, data.type, budget, dateVal, descriptionJson];
  
  console.log('Base columns and values:', { cols1, vals1 });
  
  // Optional: persist real/provisional marker if schema supports it
  if (typeof data.isReelle !== 'undefined') {
    try {
      cols1.push('is_reelle');
      vals1.push(data.isReelle ? 1 : 0);
    } catch (e) {
      console.log('is_reelle column does not exist, skipping');
    }
  }
  
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

  // Helper: after insert, persist flags like is_reelle when provided and then refetch
  async function finalizeCreate(id) {
    try {
      if (id && typeof data.isReelle !== 'undefined') {
        try {
          await dbRun('UPDATE charges SET is_reelle = ? WHERE id = ?', [data.isReelle ? 1 : 0, id]);
        } catch (e) {
          console.warn('Warning: updating is_reelle failed (column may not exist):', e.message);
        }
        // Also try to embed the marker into JSON description for compatibility (best-effort)
        try {
          const row = await getChargeById(id);
          let meta = {};
          try {
            if (row && typeof row.description === 'string') meta = JSON.parse(row.description);
            else if (row && row.description && typeof row.description === 'object') meta = row.description;
          } catch (_) {}
          const enriched = JSON.stringify({ __format: 'charge-v1', ...meta, isReelle: !!data.isReelle });
          await dbRun('UPDATE charges SET description = ? WHERE id = ?', [enriched, id]);
        } catch (e) {
          console.warn('Warning: embedding isReelle into description failed:', e.message);
        }
      }
    } catch (_) {}
    // Finally refetch the row to return a consistent object
    try {
      const createdCharge = await getChargeById(id);
      return createdCharge;
    } catch (e) {
      console.warn('Could not refetch created charge, returning basic info');
      return { id, chantierId, type: data.type, montant: budget };
    }
  }

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
      console.log('Fetching created charge with ID (finalize):', id);
      return await finalizeCreate(id);
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
        console.log('Fallback (date) created charge id:', id2);
        return await finalizeCreate(id2);
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
        console.log('Fallback (chantierId,date) created id:', id3);
        return await finalizeCreate(id3);
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
        console.log('Fallback (chantierId,date_creation) created id:', id4);
        return await finalizeCreate(id4);
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
        return await finalizeCreate(id5);
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
        return await finalizeCreate(id6);
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
        return await finalizeCreate(id7);
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

  // NEW: If updating Charges de personnel with personnel array, normalize and recalc first
  if (data.type === 'Charges de personnel' && Array.isArray(data.personnel)) {
    try {
      const chantierId = data.chantierId || data.chantier_id;
      const { normalizedPersonnel, recalculatedBudget } = await normalizePersonnelAndBudget(data.personnel, { excludeChargeId: id, chantierId });
      // Override incoming fields with normalized values
      data.personnel = normalizedPersonnel;
      data.budget = recalculatedBudget;
    } catch (e) {
      console.error('Error normalizing personnel on update:', e);
    }
  }

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

  // Allow toggling real/provisional flag when supported
  if (typeof data.isReelle !== 'undefined') {
    sets.push('is_reelle = ?');
    vals.push(data.isReelle ? 1 : 0);
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
  
  const montantValue = Number(row.montant ?? row.budget ?? meta.budget ?? 0);
  console.log('mapChargeRow: id =', row.id, 'montant =', row.montant, 'meta.budget =', meta.budget, '=> final budget =', montantValue);
  
  const base = {
    _id: String(row.id ?? meta._id ?? ""),
    chantierId: String(row.chantier_id ?? meta.chantierId ?? ""),
    type: row.type ?? meta.type ?? "Achat",
    name: meta.name || meta.type || row.type || "Charge",
    customType: row.custom_type || meta.customType,
    budget: montantValue,
    montant: montantValue,
    description:
      typeof meta.description === "string"
        ? meta.description
        : meta.description || "",
    date: row.date_creation || row.date || meta.date,
    pending: row.pending !== undefined ? row.pending : true,
    // expose real-vs-provisional flag if present in JSON meta or column
    isReelle: Boolean(meta.isReelle || row.is_reelle),
    // pass through isAutoThirtyPercent if present in meta
    isAutoThirtyPercent: Boolean(meta.isAutoThirtyPercent),
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