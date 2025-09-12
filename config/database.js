require("dotenv").config();

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Get connection string from environment variables
    const connectionString = process.env.connectionString;
    
    if (!connectionString) {
      console.error("Connection string is missing in .env file");
      throw new Error("MongoDB connection string not found");
    }
    
    console.log("Connecting to MongoDB...");
    
    // Connect to the database
    await mongoose.connect(connectionString);
    
    console.log("MongoDB connected successfully");
    return mongoose.connection;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
};

module.exports = connectDB;
