const { v4: uuidv4 } = require("uuid");
const { getBloodRequestsCollection, getRequestMatchesCollection, getDonorsCollection, getHospitalInventoryCollection, getDonationHistoryCollection } = require("../model/dbmodel.js");
const { ObjectId } = require('mongodb');
const { computeLambdaScoreInternal } = require('./mlController');

// Constants for lambda score adjustment
const LAMBDA_SCORE_PENALTY = 20; // Penalty for failing to donate
const LAMBDA_SCORE_BONUS = 10;   // Bonus for successful donation

/**
 * Creates a new blood request from a hospital.
 */
async function createBloodRequest(req, res) {
    const { blood_group, units_required, urgency } = req.body;
    // Assuming hospitalId is attached to req.user by the auth middleware
    const hospitalId = req.body.hospital_id; 

    try {
        const requestsCollection = await getBloodRequestsCollection();

        const newRequest = {
            _id: uuidv4(),
            hospital_id: hospitalId,
            blood_group,
            units_required,
            urgency,
            tier_used: 'tier1', // Start with tier1
            status: 'pending', // pending | matched | completed | cancelled
            created_at: new Date(),
        };

        const result = await requestsCollection.insertOne(newRequest);
        
        // --- Mock Donor Matching/Alerting Logic (Placeholder for full AI/GPRS) ---
        // In a real system, this would trigger the MARS AI to find nearby donors and create request_matches
        // For demonstration, we'll just insert a match for a hypothetical donor
        
        const donorId = 'ea7bf5b3-6e0f-45c8-8cfa-fcc4343c3e80';                                                             //mock donor id
        const matchesCollection = await getRequestMatchesCollection();
        await matchesCollection.insertOne({
            _id: uuidv4(),
            request_id: newRequest._id,
            hospital_id: hospitalId,
            donor_id: donorId,
            distance_km: 5,
            lambda_score: 100,
            status: 'sent', // sent | accepted | declined
        });
        
        // --- End Mock Logic ---

        res.status(201).json({ 
            message: "Blood request created and matching initiated successfully.", 
            requestId: newRequest._id 
        });

    } catch (error) {
        console.error("Error creating blood request:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

/**
 * Hospital admin flags a donor who accepted a request but failed to donate (e.g., no-show).
 * This updates the donor's status to 'flagged' and reduces their lambda score.
 */
async function flagDonor(req, res) {
    const { donorId, requestId, reason, no_of_days } = req.body;
    const hospitalId = req.body.hospitalId;

    try {
        const donorsCollection = await getDonorsCollection();
        const requestMatchesCollection = await getRequestMatchesCollection();
        // 1. Find the match to confirm the request and donor relationship
        console.log(requestId, donorId);
        const match = await requestMatchesCollection.findOne({
            request_id: requestId,
            donor_id: donorId,
            status: 'accept'
        });
        console.log(match)

        if (!match) {
            return res.status(404).json({ message: "No accepted match found for this donor/request combination." });
        }

        // 2. Update donor status and lambda score (Flagging logic)
        const updateResult = await donorsCollection.findOneAndUpdate(
            { _id: donorId },
            { 
                $set: { status: 'flagged' },
                $inc: { lambda_score: -LAMBDA_SCORE_PENALTY }, // Decrease lambda score
                $push: { 
                    flag_history: { 
                        hospital_id: hospitalId, 
                        request_id: requestId, 
                        reason: reason, 
                        flagged_at: new Date() ,
                        suspend_until: new Date(Date.now() + no_of_days * 24 * 60 * 60 * 1000)
                    } 
                }
            },
            { returnDocument: 'after' } // Return the updated document
        );

        if (!updateResult) {
            return res.status(404).json({ message: "Donor not found." });
        }
        
        // 3. Log the action (Optional: could insert into sms_logs or a dedicated flag_logs collection)
        // For simplicity, we store it in the donor's flag_history for now.

        // Auto-recompute lambda score after flagging
        computeLambdaScoreInternal(donorId).catch(err => 
            console.error('[ML] Background recompute failed after flag:', err.message)
        );

        res.status(200).json({ 
            message: `Donor ${donorId} has been flagged for failure to donate. Lambda score updated.`,
            newLambdaScore: updateResult.value.lambda_score,
            newStatus: updateResult.value.status
        });

    } catch (error) {
        console.error("Error flagging donor:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

/**
 * Hospital admin views their current inventory and requests.
 */
async function getHospitalDashboard(req, res) {
    const hospitalId = req.query.hospital_id;

    try {
        const requestsCollection = await getBloodRequestsCollection();
        const inventoryCollection = await getHospitalInventoryCollection();
        
        // Get all pending/matched requests by the hospital
        const requests = await requestsCollection.find({ 
            hospital_id: hospitalId, 
            status: { $in: ['pending', 'matched'] } 
        }).toArray();
        
        // Get current inventory
        const inventory = await inventoryCollection.find({ hospital_id: hospitalId }).toArray();
        
        res.status(200).json({ 
            message: "Hospital dashboard data fetched.",
            hospitalId,
            inventory,
            activeRequests: requests
        });

    } catch (error) {
        console.error("Error fetching hospital dashboard:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

/**
 * Get all donors with their lambda scores and request match info.
 * Used by MARS Link Donor Management page.
 */
async function getAllDonors(req, res) {
    try {
        const donorsCollection = await getDonorsCollection();
        const matchesCollection = await getRequestMatchesCollection();
        const donationHistoryCollection = await getDonationHistoryCollection();

        const donors = await donorsCollection.find({}).toArray();

        const enriched = await Promise.all(donors.map(async (donor) => {
            // Get the latest request match for this donor
            const latestMatch = await matchesCollection.findOne(
                { donor_id: donor._id },
                { sort: { _id: -1 } }
            );

            // Count total donations
            const donationCount = await donationHistoryCollection.countDocuments({ donor_id: donor._id });

            return {
                id: donor._id,
                name: donor.name,
                bloodGroup: donor.blood_group,
                phone: donor.phone || "-",
                lambdaScore: Math.min(100, Math.max(0, donor.lambda_score ?? 50)),
                donationHistory: donationCount,
                lastDonation: donor.last_donation_date
                    ? new Date(donor.last_donation_date).toISOString().split('T')[0]
                    : "Never",
                status: latestMatch?.status === 'accept' ? 'available'
                    : latestMatch?.status === 'decline' ? 'substituted'
                    : donor.status === 'flagged' ? 'suspended'
                    : donor.status === 'suspended' ? 'suspended'
                    : 'available',
                requestId: latestMatch?.request_id ?? "-",
                clickedAt: latestMatch
                    ? new Date(latestMatch._id ? Date.now() : Date.now()).toLocaleString()
                    : "-",
            };
        }));

        res.status(200).json({ message: "Donors fetched.", count: enriched.length, donors: enriched });
    } catch (error) {
        console.error("Error fetching all donors:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

module.exports = {
    createBloodRequest,
    flagDonor,
    getHospitalDashboard,
    getAllDonors
};