require('dotenv').config();
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const Message = require('./models/messageModel');
const connectDb = require('./config/db');
const verifyToken = require('./middleware/auth/verifyToken');

const app = express();
const PORT = process.env.PORT || 3600;
const onlineUsers = new Map();

// Database connection
connectDb().then(() => {
  // Create HTTP server
  const server = http.createServer(app);

  // Enhanced CORS configuration
  const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:3000', 'https://chat-app-hbyp.vercel.app','https://chat-app-backend-ngk6.onrender.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

  app.use(cors(corsOptions));

  // Socket.io with proper CORS and transport settings
  const io = socketio(server, {
    cors: {
      origin: 'http://localhost:5173',
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Socket.io authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error'));
    }
  });

  // Socket.io connection handler
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.user.id);
    
    // Add user to online users map
    onlineUsers.set(socket.user.id, true);
    io.emit('user-online-status', { userId: socket.user.id, isOnline: true });

    // Join user to their own room
    socket.join(socket.user.id);

    // Handle private messages
    socket.on('private-message', async ({ receiverId, content }) => {
      try {
        if (!content || !content.trim()) {
          throw new Error('Message content cannot be empty');
        }

        const message = new Message({
          sender: socket.user.id,
          receiver: receiverId,
          content: content.trim(),
          conversationId: [socket.user.id, receiverId].sort().join('_')
        });

        await message.save();
        const populatedMessage = await Message.populate(message, { path: 'sender', select: 'name email' });

        socket.to(receiverId).emit('private-message', populatedMessage);
        socket.emit('private-message-sent', populatedMessage);
      } catch (err) {
        console.error('Error sending message:', err);
        socket.emit('message-error', { error: err.message || 'Failed to send message' });
      }
    });

    // Handle message editing
    socket.on('edit-message', async ({ messageId, newContent, receiverId }) => {
      try {
        if (!newContent || !newContent.trim()) {
          throw new Error('Message content cannot be empty');
        }

        const message = await Message.findById(messageId);
        if (!message) {
          throw new Error('Message not found');
        }

        // Verify the user is the sender
        if (message.sender.toString() !== socket.user.id) {
          throw new Error('Not authorized to edit this message');
        }

        const updatedMessage = await Message.findByIdAndUpdate(
          messageId,
          { 
            content: newContent.trim(),
            edited: true,
            updatedAt: new Date()
          },
          { new: true }
        ).populate('sender', 'name email');

        console.log(`Message edited - ID: ${messageId}, User: ${socket.user.id}`);

        // Emit to both sender and receiver
        io.to(socket.user.id).to(receiverId).emit('message-updated', updatedMessage);
      } catch (err) {
        console.error('Error editing message:', err);
        socket.emit('edit-error', { 
          error: err.message || 'Failed to edit message',
          messageId 
        });
      }
    });

    // Handle message deletion
    socket.on('delete-message', async ({ messageId, receiverId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) {
          throw new Error('Message not found');
        }

        // Verify the user is the sender
        if (message.sender.toString() !== socket.user.id) {
          throw new Error('Not authorized to delete this message');
        }

        await Message.findByIdAndDelete(messageId);
        console.log(`Message deleted - ID: ${messageId}, User: ${socket.user.id}`);

        // Emit to both sender and receiver
        io.to(socket.user.id).to(receiverId).emit('message-deleted', { messageId });
      } catch (err) {
        console.error('Error deleting message:', err);
        socket.emit('delete-error', { 
          error: err.message || 'Failed to delete message',
          messageId 
        });
      }
    });

    // Handle typing indicators
    socket.on('typing', ({ receiverId }) => {
      socket.to(receiverId).emit('typing', {
        senderId: socket.user.id,
        isTyping: true
      });
    });

    // Handle stop typing
    socket.on('stop-typing', ({ receiverId }) => {
      socket.to(receiverId).emit('typing', {
        senderId: socket.user.id,
        isTyping: false
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.user.id);
      onlineUsers.delete(socket.user.id);
      io.emit('user-online-status', { userId: socket.user.id, isOnline: false });
    });
  });

  // Middleware
  app.use(express.json());

  // API Routes
  app.get('/api/online-status/:userId', (req, res) => {
    try {
      const isOnline = onlineUsers.has(req.params.userId);
      res.json({ isOnline });
    } catch (err) {
      console.error('Error checking online status:', err);
      res.status(500).json({ error: 'Error checking online status' });
    }
  });

  // Edit message route
  app.put('/api/messages/:messageId', verifyToken, async (req, res) => {
    try {
      const { messageId } = req.params;
      const { content } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ success: false, message: 'Message content is required' });
      }

      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({ success: false, message: 'Message not found' });
      }

      if (message.sender.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }

      const updatedMessage = await Message.findByIdAndUpdate(
        messageId,
        { 
          content: content.trim(),
          edited: true,
          updatedAt: new Date()
        },
        { new: true }
      ).populate('sender', 'name email');

      res.json({ 
        success: true, 
        message: updatedMessage 
      });
    } catch (err) {
      console.error('Error editing message:', err);
      res.status(500).json({ 
        success: false, 
        message: err.message || 'Server error' 
      });
    }
  });

  // Delete message route
  app.delete('/api/messages/:messageId', verifyToken, async (req, res) => {
    try {
      const { messageId } = req.params;

      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({ success: false, message: 'Message not found' });
      }

      if (message.sender.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }

      await Message.findByIdAndDelete(messageId);

      res.json({ 
        success: true, 
        message: 'Message deleted successfully' 
      });
    } catch (err) {
      console.error('Error deleting message:', err);
      res.status(500).json({ 
        success: false, 
        message: err.message || 'Server error' 
      });
    }
  });

  // Other routes
  app.use('/api', require('./routes/indexRoute'));

  // Basic route
  app.get('/', (req, res) => {
    res.send("Chat Server is running");
  });

  // Start server
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("Failed to connect to DB:", err);
});