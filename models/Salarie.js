const mongoose = require("mongoose");

const salarieSchema = new mongoose.Schema({
  matricule: { type: String, required: true, unique: true },
  nom: { type: String, required: true },
});

module.exports = mongoose.model("Salarie", salarieSchema);
module.exports = mongoose.model("Salarie", salarieSchema);
