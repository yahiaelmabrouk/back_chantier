const express = require("express");
const cors = require("cors");
const connectDB = require("./config/database");
const chantierRoutes = require("./routes/chantiers");
const chargeRoutes = require("./routes/charges");
const salarieRoutes = require("./routes/salaries"); // add this
const fournisseurRoutes = require("./routes/fournisseurs");
const { swaggerUi, specs } = require("./config/swagger");
const prixOuvrageRoutes = require("./routes/prixOuvrage");
const prestationRoutes = require("./routes/prestations"); // <-- add this
const cron = require("node-cron");
const Chantier = require("./models/Chantier");
const PrixOuvrage = require("./models/PrixOuvrage");
const Charge = require("./models/Charge");

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Swagger Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

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
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(
    `Swagger documentation available at http://localhost:${PORT}/api-docs`
  );
});

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
