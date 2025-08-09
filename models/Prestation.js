const mongoose = require("mongoose");

const prestationSchema = new mongoose.Schema(
  {
    typePrestation: { type: String, required: true, trim: true },
    prixHeure: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Prestation", prestationSchema);
