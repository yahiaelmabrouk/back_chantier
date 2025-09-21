const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class User {
  static async findByUsername(username) {
    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
      return rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async authenticate(username, password) {
    try {
      // Find user by username
      const user = await this.findByUsername(username);
      if (!user) {
        return null;
      }

      // Compare password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return null;
      }

      // Generate token
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      };
    } catch (error) {
      throw error;
    }
  }

  static async create(userData) {
    try {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      // Insert new user
      const query = `
        INSERT INTO users 
        (username, password, role) 
        VALUES (?, ?, ?)
      `;
      
      const [result] = await pool.query(query, [
        userData.username,
        hashedPassword,
        userData.role || 'user'
      ]);
      
      return { 
        id: result.insertId, 
        username: userData.username,
        role: userData.role || 'user'
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = User;