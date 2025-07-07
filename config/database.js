require("dotenv").config();

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Replace with your MongoDB connection string
    // const connectionString = "mongodb://localhost:27017/chantier_db";
    const connectionString = process.env.connectionString;
    await mongoose.connect(connectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.error("Database connection error:", error);
    process.exit(1);
  }
};

module.exports = connectDB;
