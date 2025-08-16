const mongoose = require('mongoose');
const userSchema = mongoose.Schema({
      name: {
    type: String,
    required: true,
    trim: true 
  },
  email: { 
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true 
  },
  phone: { 
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String, 
    required: true,
  },
  avatar: { 
    type: String,
    default: '/images/default-avatar.png'
  },
  role: { 
    type: String,
    enum: ['user', 'admin'],
    default: 'user' 
  }
}, { timestamps: true });

const userModel = mongoose.model("User",userSchema);
module.exports = userModel;