const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// Basic JWT functions
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 24 * 60 * 60; // 24 hours
  
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };
  
  const base64Header = base64UrlEncode(JSON.stringify(header));
  const base64Payload = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${base64Header}.${base64Payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return `${base64Header}.${base64Payload}.${signature}`;
}

// Login route
router.post('/', (req, res) => {
  try {
    // Get credentials from environment
    const { AUTH_USER, AUTH_PASS, AUTH_TOKEN_SECRET } = process.env;
    
    if (!AUTH_USER || !AUTH_PASS) {
      return res.status(500).json({ error: 'Auth not configured' });
    }
    
    // Get credentials from request
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Missing credentials' });
    }
    
    // Validate credentials
    if (username !== AUTH_USER || password !== AUTH_PASS) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate token
    const token = signJWT(
      { username, role: 'admin' }, 
      AUTH_TOKEN_SECRET || 'demo-token-123'
    );
    
    // Return success response
    return res.json({
      token,
      accessToken: token,
      user: { username, role: 'admin' },
      success: true
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
