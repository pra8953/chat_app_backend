// routes/authRoute.js
const express = require('express');
const router = express.Router();
const { signup, login } = require('../controllers/authController');
const { signupValidation, loginValidation } = require('./../middleware/validators/authValidaton');
const verifyToken = require('./../middleware/auth/verifyToken');
const User = require('../models/userModel');
const Message = require('../models/messageModel');

// Existing auth routes
router.post('/auth/signup', signupValidation, signup);
router.post('/auth/login', loginValidation, login);

// Get all users except current
router.get('/users', verifyToken, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } }).select('-password');
    return res.json({ success: true, users });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get messages with a specific user
router.get('/messages/:userId', verifyToken, async (req, res) => {
  try {
    const conversationId = getConversationId(req.user.id, req.params.userId);
    const messages = await Message.find({ conversationId })
      .sort('createdAt')
      .populate('sender', 'name email');

    return res.json({ success: true, messages: messages || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

function getConversationId(user1, user2) {
  return [user1, user2].sort().join('_');
}

module.exports = router;
