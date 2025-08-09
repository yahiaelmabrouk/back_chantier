const mongoose = require("mongoose");

const customChargeSchema = new mongoose.Schema({
  label: { type: String, required: true },
  budget: { type: Number, required: true, min: 0 },
});

const prixOuvrageSchema = new mongoose.Schema(
  {
    fraisFinanciers: { type: Number, required: true, min: 0 },
    emprunt: { type: Number, required: true, min: 0 },
    fraisComptable: { type: Number, required: true, min: 0 },
    loyer: { type: Number, required: true, min: 0 },
    fraisGeneraux: { type: Number, required: true, min: 0 },
    chargeSociale: { type: Number, required: true, min: 0 },
    customCharges: [customChargeSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("PrixOuvrage", prixOuvrageSchema);
