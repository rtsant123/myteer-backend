const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const { protect, adminOnly } = require('../middleware/auth');

// Get or create user's chat
router.get('/my-chat', protect, async (req, res) => {
  try {
    let chat = await Chat.findOne({ userId: req.user._id, status: 'active' });

    if (!chat) {
      // Create new chat for user
      chat = new Chat({
        userId: req.user._id,
        userName: req.user.name,
        userEmail: req.user.email,
        messages: [],
        status: 'active'
      });
      await chat.save();
    }

    res.json({ success: true, chat });
  } catch (error) {
    console.error('Error getting chat:', error);
    res.status(500).json({ success: false, message: 'Failed to get chat', error: error.message });
  }
});

// Send message (User)
router.post('/send-message', protect, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    let chat = await Chat.findOne({ userId: req.user._id, status: 'active' });

    if (!chat) {
      // Create new chat
      chat = new Chat({
        userId: req.user._id,
        userName: req.user.name,
        userEmail: req.user.email,
        messages: [],
        status: 'active'
      });
    }

    // Add message
    chat.messages.push({
      sender: 'user',
      message: message.trim(),
      timestamp: new Date(),
      isRead: false
    });

    chat.lastMessageAt = new Date();
    chat.unreadCount += 1; // Increment unread count for admin

    await chat.save();

    res.json({ success: true, chat });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Failed to send message', error: error.message });
  }
});

// Mark messages as read (User)
router.post('/mark-read', protect, async (req, res) => {
  try {
    const chat = await Chat.findOne({ userId: req.user._id, status: 'active' });

    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }

    // Mark all admin messages as read
    let updated = false;
    chat.messages.forEach(msg => {
      if (msg.sender === 'admin' && !msg.isRead) {
        msg.isRead = true;
        updated = true;
      }
    });

    if (updated) {
      await chat.save();
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ success: false, message: 'Failed to mark messages as read', error: error.message });
  }
});

// ===== ADMIN ENDPOINTS =====

// Get all chats (Admin)
router.get('/admin/all-chats', protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }

    const chats = await Chat.find(query)
      .sort({ lastMessageAt: -1 })
      .limit(100); // Limit to last 100 chats

    res.json({ success: true, chats });
  } catch (error) {
    console.error('Error getting chats:', error);
    res.status(500).json({ success: false, message: 'Failed to get chats', error: error.message });
  }
});

// Get specific chat (Admin)
router.get('/admin/chat/:chatId', protect, adminOnly, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }

    res.json({ success: true, chat });
  } catch (error) {
    console.error('Error getting chat:', error);
    res.status(500).json({ success: false, message: 'Failed to get chat', error: error.message });
  }
});

// Send admin reply
router.post('/admin/reply/:chatId', protect, adminOnly, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }

    // Add admin message
    chat.messages.push({
      sender: 'admin',
      message: message.trim(),
      timestamp: new Date(),
      isRead: false
    });

    chat.lastMessageAt = new Date();
    chat.unreadCount = 0; // Reset unread count when admin replies

    await chat.save();

    res.json({ success: true, chat });
  } catch (error) {
    console.error('Error sending admin reply:', error);
    res.status(500).json({ success: false, message: 'Failed to send reply', error: error.message });
  }
});

// Mark user messages as read (Admin)
router.post('/admin/mark-read/:chatId', protect, adminOnly, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }

    // Mark all user messages as read
    let updated = false;
    chat.messages.forEach(msg => {
      if (msg.sender === 'user' && !msg.isRead) {
        msg.isRead = true;
        updated = true;
      }
    });

    chat.unreadCount = 0; // Reset unread count

    if (updated || chat.unreadCount > 0) {
      await chat.save();
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ success: false, message: 'Failed to mark messages as read', error: error.message });
  }
});

// Close chat (Admin)
router.post('/admin/close/:chatId', protect, adminOnly, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }

    chat.status = 'closed';
    await chat.save();

    res.json({ success: true, chat });
  } catch (error) {
    console.error('Error closing chat:', error);
    res.status(500).json({ success: false, message: 'Failed to close chat', error: error.message });
  }
});

// Reopen chat (Admin)
router.post('/admin/reopen/:chatId', protect, adminOnly, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }

    chat.status = 'active';
    await chat.save();

    res.json({ success: true, chat });
  } catch (error) {
    console.error('Error reopening chat:', error);
    res.status(500).json({ success: false, message: 'Failed to reopen chat', error: error.message });
  }
});

// Get unread chat count (Admin)
router.get('/admin/unread-count', protect, adminOnly, async (req, res) => {
  try {
    const count = await Chat.countDocuments({ unreadCount: { $gt: 0 }, status: 'active' });

    res.json({ success: true, count });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ success: false, message: 'Failed to get unread count', error: error.message });
  }
});

module.exports = router;
