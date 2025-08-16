// controllers/authController.js
const userModel = require('./../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ================= Normal Signup =================
const signup = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        // check existing user
        const userExitsEmail = await userModel.findOne({ email });
        const userExitsPhone = await userModel.findOne({ phone });

        if (userExitsEmail || userExitsPhone) {
            return res.status(409).json({
                success: false,
                message: "User already exists! Please login"
            });
        }

        // hash password
        const hashedPass = await bcrypt.hash(password, 10);

        // create new user
        const newUser = new userModel({
            name,
            email,
            phone,
            password: hashedPass
        });
        await newUser.save();

        // generate JWT token
        const token = jwt.sign(
            { id: newUser._id, email: newUser.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.status(201).json({
            success: true,
            message: "User signup successfully",
            token,
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                phone: newUser.phone,
                role: newUser.role
            }
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

// ================= Normal Login =================
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // find user
        const user = await userModel.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found, please signup first"
            });
        }

        // compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        // generate token
        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

// ================= Google OAuth Login =================
const googleLogin = async (req, res) => {
    try {
        const { tokenId } = req.body;

        // verify token with Google
        const ticket = await client.verifyIdToken({
            idToken: tokenId,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { email, name } = payload;

        // check if user already exists
        let user = await userModel.findOne({ email });

        if (!user) {
            // create new user (password random assign since google login doesn’t need it)
            user = new userModel({
                name,
                email,
                password: await bcrypt.hash(Math.random().toString(36).slice(-8), 10),
                phone: "", // optional
                role: "user"
            });
            await user.save();
        }

        // generate our own JWT
        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.status(200).json({
            success: true,
            message: "Google login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role
            }
        });

    } catch (err) {
        console.error("Google login error:", err);
        return res.status(500).json({
            success: false,
            message: "Google login failed",
            error: err.message
        });
    }
};

module.exports = {
    signup,
    login,
    googleLogin
};
