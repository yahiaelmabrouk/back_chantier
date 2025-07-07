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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Chantier", chantierSchema);
