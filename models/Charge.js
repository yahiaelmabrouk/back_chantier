const mongoose = require("mongoose");

const chargeSchema = new mongoose.Schema(
  {
    chantierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chantier",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "Achat",
        "Services extérieurs",
        "Interim",
        "Charges de personnel",
        "Charges fixes",
        "Autre",
      ],
    },
    customType: {
      type: String,
      // Required only when type is "Autre"
    },
    name: {
      type: String,
      required: true,
    },
    budget: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
    },
    // New fields for details
    details: {
      type: Object, // For services extérieurs
    },
    ouvriers: [
      {
        nom: String,
        heures: Number,
        taux: Number,
        cout: Number,
      },
    ],
    pieces: [
      {
        fournisseur: String,
        piece: String,
        prix: Number,
        quantite: Number,
        total: Number,
      },
    ],
    personnel: [
      {
        salarieId: { type: mongoose.Schema.Types.ObjectId, ref: "Salarie" },
        nom: String,
        tauxHoraire: Number,
        heures: Number,
        total: Number,
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Charge", chargeSchema);
