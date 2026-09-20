const { pool } = require("../config/database");

function fournisseurName(row) {
  return String(row?.name ?? row?.nom ?? "").trim();
}

function toYmd(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function ligneMatchesFournisseur(ligne, fournisseur) {
  const ligneId = ligne.fournisseurId ?? ligne.fournisseur_id;
  if (ligneId != null && String(ligneId) !== "" && String(ligneId) === String(fournisseur.id)) {
    return true;
  }
  const ligneName = String(ligne.fournisseur || ligne.fournisseurName || "").trim().toLowerCase();
  const name = fournisseurName(fournisseur).toLowerCase();
  return Boolean(ligneName && name && ligneName === name);
}

function achatDateMatches(dateStr, filters = {}) {
  const d = toYmd(dateStr);
  if (!d) return false;

  const { filterType, date, month, year, dateFrom, dateTo } = filters;
  if (filterType === "day" && date) return d === toYmd(date);
  if (filterType === "month" && month && year) {
    const mm = String(month).padStart(2, "0");
    return d.startsWith(`${year}-${mm}`);
  }
  if (filterType === "year" && year) return d.startsWith(String(year));
  if (dateFrom || dateTo) {
    if (dateFrom && d < toYmd(dateFrom)) return false;
    if (dateTo && d > toYmd(dateTo)) return false;
    return true;
  }
  return true;
}

function hasActiveAchatFilter(filters = {}) {
  const name = String(filters.name || "").trim();
  const chantier = String(filters.chantier || filters.chantierName || "").trim();
  const bon = String(filters.numBonEnlevement || "").trim();
  const dateActive =
    (filters.filterType && filters.filterType !== "all") ||
    filters.dateFrom ||
    filters.dateTo;
  return Boolean(name || chantier || bon || dateActive);
}

async function loadAchatRecords() {
  const [charges] = await pool.execute("SELECT * FROM charges WHERE type = ?", ["Achat"]);
  let chantiers = [];
  try {
    const [rows] = await pool.execute("SELECT * FROM chantiers");
    chantiers = rows || [];
  } catch (err) {
    console.warn("Could not load chantiers for fournisseur achats:", err.message);
  }

  const chantierMap = new Map();
  chantiers.forEach((ch) => chantierMap.set(String(ch.id), ch));

  const records = [];
  for (const charge of charges || []) {
    const meta = parseJson(charge.description, {});
    if (meta && meta.isAutoThirtyPercent) continue;
    const name = String(meta.name || charge.name || "").toLowerCase();
    const desc = String(meta.description || "").toLowerCase();
    if (
      name.includes("30%") ||
      name.includes("acompte budget") ||
      desc.includes("ajout automatique")
    ) {
      continue;
    }

    let lignes = parseJson(charge.achat_data, null);
    if (!Array.isArray(lignes)) {
      lignes = Array.isArray(meta.achatLignes) ? meta.achatLignes : [];
    }
    if (!Array.isArray(lignes) || lignes.length === 0) continue;

    const chantier = chantierMap.get(String(charge.chantier_id ?? charge.chantierId)) || {};
    const chantierName = chantier.nomChantier || chantier.nom_chantier || "";
    const chargeDate = toYmd(charge.date || charge.date_creation || meta.date);

    lignes.forEach((ligne, idx) => {
      if (!ligne || typeof ligne !== "object") return;
      const montantHT = Number(ligne.montantHT ?? ligne.montant ?? 0) || 0;
      records.push({
        id: `${charge.id}-${idx}`,
        chargeId: charge.id,
        chantierId: charge.chantier_id ?? charge.chantierId ?? null,
        chantierName,
        client: chantier.client || "",
        date: toYmd(ligne.date) || chargeDate,
        fournisseurId: ligne.fournisseurId ?? ligne.fournisseur_id ?? null,
        fournisseur: String(ligne.fournisseur || ligne.fournisseurName || "").trim(),
        numBonEnlevement: String(ligne.numBonEnlevement || ligne.num_bon_enlevement || "").trim(),
        numeroNexxio: String(ligne.numeroNexxio || ligne.numero_nexxio || "").trim(),
        montantHT,
        description:
          typeof meta.description === "string"
            ? meta.description
            : String(ligne.description || charge.description || ""),
        chargeName: meta.name || "Achat",
        isReelle: Boolean(meta.isReelle || charge.is_reelle || charge.isReelle),
      });
    });
  }
  return records;
}

function enrichFournisseurs(fournisseurs, achats) {
  return (fournisseurs || []).map((f) => {
    const linked = achats.filter((a) => ligneMatchesFournisseur(a, f));
    const budget = Number(
      linked.reduce((sum, a) => sum + Number(a.montantHT || 0), 0).toFixed(2)
    );
    return {
      ...f,
      name: fournisseurName(f),
      budget,
      achatsCount: linked.length,
      achats: linked.sort((a, b) => String(b.date).localeCompare(String(a.date))),
    };
  });
}

async function persistBudgets(enriched) {
  for (const f of enriched) {
    try {
      await pool.execute("UPDATE fournisseurs SET budget = ? WHERE id = ?", [
        f.budget,
        f.id,
      ]);
    } catch (err) {
      console.warn(`Could not persist budget for fournisseur ${f.id}:`, err.message);
    }
  }
}

async function buildCatalog() {
  const [fournisseurs] = await pool.execute("SELECT * FROM fournisseurs");
  const achats = await loadAchatRecords();
  const enriched = enrichFournisseurs(fournisseurs || [], achats);
  persistBudgets(enriched).catch((err) => {
    console.warn("Budget persist skipped:", err.message);
  });
  return enriched.sort((a, b) =>
    fournisseurName(a).localeCompare(fournisseurName(b), "fr", { sensitivity: "base" })
  );
}

function achatMatchesFilters(achat, filters = {}) {
  const chantierQ = String(filters.chantier || filters.chantierName || "").trim().toLowerCase();
  const bonQ = String(filters.numBonEnlevement || "").trim().toLowerCase();
  const dateActive =
    (filters.filterType && filters.filterType !== "all") ||
    filters.dateFrom ||
    filters.dateTo;

  if (chantierQ) {
    const hay = `${achat.chantierName || ""} ${achat.client || ""}`.toLowerCase();
    if (!hay.includes(chantierQ)) return false;
  }
  if (bonQ && !String(achat.numBonEnlevement || "").toLowerCase().includes(bonQ)) {
    return false;
  }
  if (dateActive && !achatDateMatches(achat.date, filters)) return false;
  return true;
}

function applyFilters(catalog, filters = {}) {
  const nameQ = String(filters.name || "").trim().toLowerCase();
  const achatFilterOn = Boolean(
    String(filters.chantier || filters.chantierName || "").trim() ||
      String(filters.numBonEnlevement || "").trim() ||
      (filters.filterType && filters.filterType !== "all") ||
      filters.dateFrom ||
      filters.dateTo
  );

  return catalog
    .filter((f) => {
      if (nameQ && !fournisseurName(f).toLowerCase().includes(nameQ)) return false;
      if (!achatFilterOn) return true;
      return (f.achats || []).some((a) => achatMatchesFilters(a, filters));
    })
    .map((f) => {
      const matchingAchats = achatFilterOn
        ? (f.achats || []).filter((a) => achatMatchesFilters(a, filters))
        : f.achats || [];
      const montantFiltre = Number(
        matchingAchats.reduce((sum, a) => sum + Number(a.montantHT || 0), 0).toFixed(2)
      );
      return {
        ...f,
        matchingAchatsCount: matchingAchats.length,
        montantFiltre,
      };
    });
}

const fournisseurService = {
  getAll: async (filters = {}) => {
    const catalog = await buildCatalog();
    const filtered = applyFilters(catalog, filters);
    return filtered.map(({ achats, ...rest }) => rest);
  },

  getById: async (id) => {
    const catalog = await buildCatalog();
    return catalog.find((f) => String(f.id) === String(id)) || null;
  },

  getYears: async () => {
    const achats = await loadAchatRecords();
    const years = new Set();
    const current = new Date().getFullYear();
    years.add(current);
    achats.forEach((a) => {
      const y = Number(String(a.date || "").slice(0, 4));
      if (y) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  },

  create: async (fournisseurData) => {
    const name = String(fournisseurData.name || fournisseurData.nom || "").trim();
    try {
      const [result] = await pool.execute(
        "INSERT INTO fournisseurs (name, budget) VALUES (?, ?)",
        [name, 0]
      );
      return { id: result.insertId, name, budget: 0, achats: [] };
    } catch (err) {
      const [result] = await pool.execute(
        "INSERT INTO fournisseurs (nom, budget) VALUES (?, ?)",
        [name, 0]
      );
      return { id: result.insertId, name, budget: 0, achats: [] };
    }
  },

  update: async (id, fournisseurData) => {
    const existing = await fournisseurService.getById(id);
    if (!existing) return null;
    const name = String(fournisseurData.name || fournisseurData.nom || "").trim();
    try {
      await pool.execute("UPDATE fournisseurs SET name = ? WHERE id = ?", [name, id]);
    } catch (err) {
      await pool.execute("UPDATE fournisseurs SET nom = ? WHERE id = ?", [name, id]);
    }
    return await fournisseurService.getById(id);
  },

  delete: async (id) => {
    await pool.execute("DELETE FROM fournisseurs WHERE id = ?", [id]);
    return { success: true };
  },

  syncBudgets: async () => {
    await buildCatalog();
    return { success: true };
  },

  enrichAchatLignes: async (lignes) => {
    if (!Array.isArray(lignes)) return lignes;
    const [fournisseurs] = await pool.execute("SELECT * FROM fournisseurs");
    return lignes.map((ligne) => {
      if (!ligne || typeof ligne !== "object") return ligne;
      const byId = (fournisseurs || []).find(
        (f) =>
          ligne.fournisseurId != null &&
          String(f.id) === String(ligne.fournisseurId)
      );
      if (byId) {
        return {
          ...ligne,
          fournisseurId: byId.id,
          fournisseur: fournisseurName(byId),
        };
      }
      const wanted = String(ligne.fournisseur || "").trim().toLowerCase();
      const byName = (fournisseurs || []).find(
        (f) => fournisseurName(f).toLowerCase() === wanted
      );
      if (byName) {
        return {
          ...ligne,
          fournisseurId: byName.id,
          fournisseur: fournisseurName(byName),
        };
      }
      return ligne;
    });
  },
};

module.exports = fournisseurService;
module.exports.hasActiveAchatFilter = hasActiveAchatFilter;
