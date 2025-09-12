const mongoose = require("mongoose");

const chantierSchema = new mongoose.Schema(
  {
    numAttachement: {
      type: String,
      required: true,
      unique: true,
    },
    client: {
      type: String,
      required: true,
    },
    natureTravail: {
      type: String,
      required: true,
    },
    nomChantier: {
      type: String,
      required: true,
    },
    etat: {
      type: String,
      enum: ["en cours", "fermé"],
      default: "en cours",
      required: true,
    },
    prixPrestation: {
      type: Number,
      default: 0,
    },
    numeroFacture: {
      type: String,
      default: "",
    },
    adresseExecution: {
      type: String,
      default: "",
    },
    lieu: {
      type: String,
      default: "",
    },
    dateDebut: {
      type: Date,
      required: true,
    },
    heureDebut: {
      type: String,
      required: true,
    },
    dateFin: {
      type: Date,
      required: true,
    },
    heureFin: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Chantier", chantierSchema);

