const Joi = require("joi");

// Helper function for validation middleware
function validateSchema(schema, property) {
    return (req, res, next) => {
        const { error } = schema.validate(req[property], { abortEarly: false });
        if (error) {
            const errors = error.details.map(detail => detail.message);
            return res.status(400).json({ message: "Validation Failed", errors });
        }
        next();
    };
}

// --- Auth Schemas ---
const registerSchema = Joi.object({
    name: Joi.string().min(3).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('donor', 'hospital_admin').required(), // Donor or Hospital Admin
    // Donor specific fields
    blood_group: Joi.string().valid('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-').when('role', { is: 'donor', then: Joi.required() }),
    phone: Joi.string().min(10).max(15).when('role', { is: 'donor', then: Joi.required() }),
    location: Joi.object({
        type: Joi.string().valid('Point').required(),
        coordinates: Joi.array().items(Joi.number()).length(2).required() // [longitude, latitude]
    }).when('role', { is: 'donor', then: Joi.required() }),
    // Hospital specific fields (minimal for now)
    hospital_type: Joi.string().valid('govt', 'private').when('role', { is: 'hospital_admin', then: Joi.required() }),
    hospital_name: Joi.string().when('role', { is: 'hospital_admin', then: Joi.required() }),
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
});

// --- Hospital Schemas ---
const bloodRequestSchema = Joi.object({
    hospital_id: Joi.string().required(),
    blood_group: Joi.string().valid('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-').required(),
    units_required: Joi.number().integer().min(1).required(),
    urgency: Joi.string().valid('normal', 'urgent', 'critical').required(),
});

const flagDonorSchema = Joi.object({
    hospital_id: Joi.string().required(),
    donorId: Joi.string().required(),
    requestId: Joi.string().required(),
    no_of_days: Joi.number().integer().min(1).required(),
    reason: Joi.string().min(10).required(),
});

// --- Donor Schemas ---
const donorResponseSchema = Joi.object({
    userId: Joi.string().required(),
    requestMatchId: Joi.string().required(),
    action: Joi.string().valid('accept', 'decline').required(),
});

const updateDonationStatusSchema = Joi.object({
    userId: Joi.string().required(),
    requestMatchId: Joi.string().required(),
    status: Joi.string().valid('arrived', 'donated', 'no_show').required(),
    reason: Joi.string().when('status', { is: 'no_show', then: Joi.required() }).optional(), // Required only for no_show
});


module.exports = {
    validateBody: (schema) => validateSchema(schema, 'body'),
    validateQuery: (schema) => validateSchema(schema, 'query'),
    // Schemas
    registerSchema,
    loginSchema,
    bloodRequestSchema,
    flagDonorSchema,
    donorResponseSchema,
    updateDonationStatusSchema
};