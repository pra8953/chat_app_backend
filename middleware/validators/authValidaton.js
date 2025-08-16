const Joi = require('joi');

// Signup validation
const signupValidation = async (req, res, next) => {
    try {
        const userSchema = Joi.object({
            name: Joi.string()
                .min(3)
                .max(50)
                .required()
                .messages({
                    "string.empty": "Name is required",
                    "string.min": "Name must be at least 3 characters",
                    "string.max": "Name must be less than 50 characters"
                }),
            email: Joi.string()
                .email()
                .required()
                .messages({
                    "string.empty": "Email is required",
                    "string.email": "Email must be valid"
                }),
            phone: Joi.string()
                .pattern(/^[0-9]{10}$/)
                .required()
                .messages({
                    "string.empty": "Phone is required",
                    "string.pattern.base": "Phone must be 10 digits"
                }),
            password: Joi.string()
                .min(6)
                .required()
                .messages({
                    "string.empty": "Password is required",
                    "string.min": "Password must be at least 6 characters"
                }),
            avatar: Joi.string().optional(),
            role: Joi.string().valid('user', 'admin').optional()
        });

        const { error } = userSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        next();
    } catch (err) {
        console.error(err);
        next(err);
    }
};

// Login validation
const loginValidation = async (req, res, next) => {
    try {
        const loginSchema = Joi.object({
            email: Joi.string()
                .email()
                .required()
                .messages({
                    "string.empty": "Email is required",
                    "string.email": "Email must be valid"
                }),
            password: Joi.string()
                .min(6)
                .required()
                .messages({
                    "string.empty": "Password is required",
                    "string.min": "Password must be at least 6 characters"
                })
        });

        const { error } = loginSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            });
        }

        next();
    } catch (err) {
        console.error(err);
        next(err);
    }
};

module.exports = {
    signupValidation,
    loginValidation
};
