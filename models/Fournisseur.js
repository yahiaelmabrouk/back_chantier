const mongoose = require("mongoose");

const FournisseurSchema = new mongoose.Schema({
  nom: { type: String, required: true, trim: true, unique: true },
  budget: { type: Number, required: true, min: 0 },
});

module.exports = mongoose.model("Fournisseur", FournisseurSchema);
