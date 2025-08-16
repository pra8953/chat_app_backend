const userModel = require('./../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper function to generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      email: user.email,
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Helper function to sanitize user data
const sanitizeUser = (user) => {
  const userObject = user.toObject ? user.toObject() : user;
  const { password, __v, ...userData } = userObject;
  return userData;
};

// ================= Normal Signup =================
const signup = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Validate input
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // Check existing user
    const existingUser = await userModel.findOne({ 
      $or: [{ email }, { phone }] 
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email or phone"
      });
    }

    // Hash password
    const hashedPass = await bcrypt.hash(password, 12);

    // Create new user
    const newUser = await userModel.create({
      name,
      email,
      phone,
      password: hashedPass,
      role: 'user' // Default role
    });

    // Generate token
    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: sanitizeUser(newUser)
    });

  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ================= Normal Login =================
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // Find user with email
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Generate token
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: sanitizeUser(user)
    });

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ================= Google OAuth Login =================
const googleLogin = async (req, res) => {
  try {
    const { token: googleToken } = req.body;

    if (!googleToken) {
      return res.status(400).json({
        success: false,
        message: "Google token is required"
      });
    }

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: googleToken,
      audience: [
        process.env.GOOGLE_CLIENT_ID,
        process.env.VITE_GOOGLE_CLIENT_ID // For frontend verification
      ]
    });

    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email not found in Google payload"
      });
    }

    // Check if user exists
    let user = await userModel.findOne({ email });

    if (!user) {
      // Create new user with Google data
      user = await userModel.create({
        name,
        email,
        
        profilePic: picture,
        isGoogleAuth: true,
        password: await bcrypt.hash(Math.random().toString(36).slice(-8) + Date.now(), 12),
        phone: "not-provided",
        role: "user"
      });
    }

    // Generate our JWT token
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "Google login successful",
      token,
      user: sanitizeUser(user)
    });

  } catch (err) {
    console.error("Google login error:", err);
    
    // More specific error messages
    let errorMessage = "Google authentication failed";
    if (err.message.includes("Token used too late")) {
      errorMessage = "Google token expired";
    } else if (err.message.includes("Wrong number of segments")) {
      errorMessage = "Invalid Google token";
    }

    return res.status(400).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

module.exports = {
  signup,
  login,
  googleLogin
};