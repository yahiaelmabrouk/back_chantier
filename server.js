const express = require("express");
const cors = require("cors");
const connectDB = require("./config/database");
const chantierRoutes = require("./routes/chantiers");
const chargeRoutes = require("./routes/charges");
const salarieRoutes = require("./routes/salaries"); // add this
const fournisseurRoutes = require("./routes/fournisseurs");
const { swaggerUi, specs } = require("./config/swagger");

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Swagger Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

// Routes
app.use("/api/chantiers", chantierRoutes);
app.use("/api/charges", chargeRoutes);
app.use("/api/salaries", salarieRoutes);
app.use("/api/fournisseurs", fournisseurRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(
    `Swagger documentation available at http://localhost:${PORT}/api-docs`
  );
});
