const mongoose = require("mongoose");

const fraisTransportConfigSchema = new mongoose.Schema({
  camion: { type: Number, default: 0 },
  assurance: { type: Number, default: 0 },
  carburant: { type: Number, default: 0 },
  custom: [
    {
      label: String,
      montant: { type: Number, default: 0 }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model("FraisTransportConfig", fraisTransportConfigSchema);
