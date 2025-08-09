const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
const chantierRouter = require("./routes/chantiers");
const chargeRouter = require("./routes/charges");
const salarieRouter = require("./routes/salaries");
const fournisseurRouter = require("./routes/fournisseurs");
const prixOuvrageRouter = require("./routes/prixOuvrage");

app.use("/api/chantiers", chantierRouter);
app.use("/api/charges", chargeRouter);
app.use("/api/salaries", salarieRouter);
app.use("/api/fournisseurs", fournisseurRouter);
app.use("/api/prix-ouvrage", prixOuvrageRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});