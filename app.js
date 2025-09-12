// Load environment variables early
require("dotenv").config();

const express = require("express");
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Simple request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth routes
const loginRouter = require("./routes/login");
app.use("/login", loginRouter);
app.use("/api/login", loginRouter);

// API routes
app.use("/api/chantiers", require("./routes/chantiers"));
app.use("/api/charges", require("./routes/charges"));
app.use("/api/fournisseurs", require("./routes/fournisseurs"));
app.use("/api/frais-transport-config", require("./routes/fraisTransportConfig"));
app.use("/api/honoraires", require("./routes/honoraires"));
app.use("/api/prestations", require("./routes/prestations"));
app.use("/api/prix-ouvrage", require("./routes/prixOuvrage"));
app.use("/api/salaries", require("./routes/salaries"));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not Found", path: req.originalUrl });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    error: "Server Error",
    message: err.message,
  });
});

module.exports = app;