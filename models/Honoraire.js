const mongoose = require("mongoose");

const HonoraireSchema = new mongoose.Schema(
  {
    salarieId: { type: mongoose.Schema.Types.ObjectId, ref: "Salarie", required: true },
    date: { type: Date, default: Date.now },
    montant: { type: Number, required: true },
    chargeId: { type: mongoose.Schema.Types.ObjectId, ref: "Charge" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Honoraire", HonoraireSchema);
