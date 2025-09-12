// Load environment variables first
require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/database');

// Get port from environment or use default
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB()
  .then(() => {
    console.log('Database connected successfully');
    
    // Start the server after successful DB connection
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to connect to database:', error.message);
    process.exit(1);
  });
