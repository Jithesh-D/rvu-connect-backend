// Simple session test endpoint
const express = require('express');
const router = express.Router();

// Test session creation
router.post('/create-test-session', (req, res) => {
  req.session.testUser = {
    id: 'test123',
    email: 'test@rvu.edu.in',
    username: 'TestUser'
  };
  
  req.session.save((err) => {
    if (err) {
      return res.status(500).json({ error: 'Session save failed', details: err.message });
    }
    
    res.json({
      message: 'Test session created',
      sessionId: req.sessionID,
      user: req.session.testUser
    });
  });
});

// Test session read
router.get('/check-test-session', (req, res) => {
  res.json({
    sessionId: req.sessionID,
    hasSession: !!req.session,
    testUser: req.session.testUser || null,
    cookies: req.headers.cookie
  });
});

module.exports = router;