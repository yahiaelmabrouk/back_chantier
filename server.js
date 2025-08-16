const express = require("express");
const cors = require("cors");
const connectDB = require("./config/database");
const chantierRoutes = require("./routes/chantiers");
const chargeRoutes = require("./routes/charges");
const salarieRoutes = require("./routes/salaries"); // add this
const fournisseurRoutes = require("./routes/fournisseurs");
const prixOuvrageRoutes = require("./routes/prixOuvrage");
const prestationRoutes = require("./routes/prestations"); // <-- add this
const cron = require("node-cron");
const Chantier = require("./models/Chantier");
const PrixOuvrage = require("./models/PrixOuvrage");
const Charge = require("./models/Charge");
const fs = require("fs");
const https = require("https");

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/chantiers", chantierRoutes);
app.use("/api/charges", chargeRoutes);
app.use("/api/salaries", salarieRoutes);
app.use("/api/fournisseurs", fournisseurRoutes);
app.use("/api/prix-ouvrage", prixOuvrageRoutes);
app.use("/api/prestations", prestationRoutes); // <-- add this
app.use("/", (req, res) => {
  res.send("Welcome to the API");
});
// SSL certificate paths
let credentials;
let useHttps = true;
try {
  const privateKey = fs.readFileSync("/etc/letsencrypt/renewal/api.gestioncash.com.conf/privkey.pem", "utf8");
  const certificate = fs.readFileSync("/etc/letsencrypt/renewal/api.gestioncash.com.conf/fullchain.pem", "utf8");
  credentials = { key: privateKey, cert: certificate };
} catch (err) {
  console.warn("[SSL] Certificate files not found. Starting server in HTTP mode.");
  useHttps = false;
}

const PORT = process.env.PORT || 3001;

function onError(err) {
  if (err.code === 'EADDRINUSE') {
    console.error(`[SERVER] Port ${PORT} is already in use. Please stop other processes using this port or change the PORT.`);
    process.exit(1);
  } else {
    throw err;
  }
}

if (useHttps) {
  const server = https.createServer(credentials, app);
  server.listen(PORT, () => {
    console.log(`HTTPS Server running on port ${PORT}`);
  });
  server.on('error', onError);
} else {
  const server = app.listen(PORT, () => {
    console.log(`HTTP Server running on port ${PORT}`);
  });
  server.on('error', onError);
}

// Daily job to add prix ouvrage charges fixes to each active chantier
cron.schedule("15 0 * * *", async () => {
  try {
    // Get prix ouvrage (assume only one)
    const prixOuvrage = await PrixOuvrage.findOne().sort({ createdAt: -1 });
    if (!prixOuvrage) return;

    // Calculate total monthly
    const totalMonth =
      Number(prixOuvrage.fraisFinanciers || 0) +
      Number(prixOuvrage.emprunt || 0) +
      Number(prixOuvrage.fraisComptable || 0) +
      Number(prixOuvrage.loyer || 0) +
      Number(prixOuvrage.fraisGeneraux || 0) +
      Number(prixOuvrage.chargeSociale || 0) +
      (prixOuvrage.customCharges || []).reduce((a, c) => a + Number(c.budget || 0), 0);

    // Calculate daily
    const dailyPrixOuvrage = totalMonth / 30;

    // Get active chantiers
    const actifs = await Chantier.find({ etat: { $ne: "fermé" } });
    const nbChantiers = actifs.length;
    if (nbChantiers === 0) return;

    const dailyPerChantier = dailyPrixOuvrage / nbChantiers;

    // Today's date
    const today = new Date().toISOString().split("T")[0];

    // For each chantier, add a charge fixe for today
    for (const chantier of actifs) {
      // Prevent duplicate for the same day
      const alreadyExists = await Charge.findOne({
        chantierId: chantier._id,
        type: "Charges fixes",
        name: "Prix Ouvrage journalier",
        createdAt: {
          $gte: new Date(today + "T00:00:00.000Z"),
          $lte: new Date(today + "T23:59:59.999Z"),
        },
      });
      if (alreadyExists) continue;

      await Charge.create({
        chantierId: chantier._id,
        type: "Charges fixes",
        name: "Prix Ouvrage journalier",
        budget: dailyPerChantier,
        description: `Ajout automatique du prix ouvrage journalier (${dailyPerChantier.toFixed(2)} €) pour le ${today}`,
      });
    }
    console.log(`[CRON] Prix ouvrage journalier ajouté à ${nbChantiers} chantiers actifs.`);
  } catch (err) {
    console.error("[CRON] Erreur ajout prix ouvrage journalier:", err);
  }
});
    