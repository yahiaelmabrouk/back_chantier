const mongoose = require("mongoose");

const chantierSchema = new mongoose.Schema(
  {
    numAttachement: {
      type: String,
      required: true,
      unique: true,
    },
    dateCreation: {
      type: Date,
      required: true,
      default: Date.now,
    },
    client: {
      type: String,
      required: true,
    },
    lieuExecution: {
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
    bailleur: {
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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Chantier", chantierSchema);
