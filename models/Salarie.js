const mongoose = require("mongoose");

const salarieSchema = new mongoose.Schema({
  matricule: { type: String, required: true, unique: true },
  nom: { type: String, required: true },
  tauxHoraire: { type: Number, required: true, min: 0 }, // <-- add this
});

module.exports = mongoose.model("Salarie", salarieSchema);
