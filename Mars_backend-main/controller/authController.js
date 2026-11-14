const { v4: uuidv4 } = require("uuid");
const { getDonorsCollection, getHospitalsCollection } = require("../model/dbModel");

// Initial Lambda Score for new donor
const DEFAULT_LAMBDA_SCORE = 50;

async function signUp(req,res) {
    const user = req.body;
    const { role, email } = user;

    try {
        const collection = role === 'donor' ? getDonorsCollection() : getHospitalsCollection();
        const usersCollection = await collection;

        const isUser = await usersCollection.findOne({ email });
        if(isUser) return res.status(400).json({ message: "User Already Exists!"});

        let userFormat = {
            _id: uuidv4(),
            ...user,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        if (role === 'donor') {
            userFormat.lambda_score = DEFAULT_LAMBDA_SCORE;
            userFormat.last_donation_date = null;
            userFormat.status = 'active'; // active | flagged | suspended
            // Ensure phone is stored in correct format
            delete userFormat.hospital_type;
            delete userFormat.hospital_name;
        } else if (role === 'hospital_admin') {
            userFormat.hospitalId = userFormat._id;
            delete userFormat.blood_group;
            delete userFormat.phone;
            delete userFormat.location;
        }

        await usersCollection.insertOne(userFormat);
        return res.status(201).json({
            message: `${role} registered successfully`,
            userId: userFormat._id
        });

    } catch (error) {
        console.error("Error Signup : ", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

async function login(req, res) {
    const { email, password } = req.query;
    try {
        // Try donor login
        let collection = await getDonorsCollection();
        let user = await collection.findOne({ email });
        let role = 'donor';

        // If not found, try hospital admin login
        if (!user) {
            collection = await getHospitalsCollection();
            user = await collection.findOne({ email });
            role = 'hospital_admin';
        }
        
        // If still not found, try authority login (simple mock for now)
        if (!user) {
            if (email === 'authority@mars.gov' && password === 'admin') {
                 user = { _id: 'authority-id', name: 'MARS Authority', email, role: 'authority' };
                 role = 'authority';
            } else {
                 return res.status(400).json({ message: "Invalid credentials" });
            }
        }
        
        // Verify password for DB users (not mock authority)
        if (user.password) {
            const isMatch = (password === user.password);
            if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });
        }

        res.status(200).json({ 
            message: "Login successful", 
            userId: user._id,
            name: user.name, 
            email: user.email,
            role: role,
        });
    } catch (error) {
        console.error("Error Login:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}


module.exports = {
    signUp,
    login
};