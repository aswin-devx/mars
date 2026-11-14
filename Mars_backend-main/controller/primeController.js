const { getBloodRequestsCollection, getDonorsCollection } = require("../model/dbModel");

/**
 * Authority views all blood requests (Surveillance).
 */
async function viewAllRequests(req, res) {
    try {
        const requestsCollection = await getBloodRequestsCollection();
        
        // Fetch all requests, ordered by creation date descending
        const allRequests = await requestsCollection
            .find({})
            .sort({ created_at: -1 })
            .limit(100) // Limit for performance
            .toArray();

        res.status(200).json({
            message: "All blood requests (MARS Prime Surveillance) fetched.",
            count: allRequests.length,
            requests: allRequests
        });
    } catch (error) {
        console.error("Error fetching all requests:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

/**
 * Authority views all flagged or suspended donors.
 */
async function viewFlaggedDonors(req, res) {
    try {
        const donorsCollection = await getDonorsCollection();
        
        // Find donors who are flagged or suspended
        const flaggedDonors = await donorsCollection.find({
            status: { $in: ['flagged', 'suspended'] }
        }).toArray();

        res.status(200).json({
            message: "Flagged and suspended donors (MARS Prime Surveillance) fetched.",
            count: flaggedDonors.length,
            donors: flaggedDonors.map(d => ({
                _id: d._id,
                name: d.name,
                email: d.email,
                blood_group: d.blood_group,
                lambda_score: d.lambda_score,
                status: d.status,
                flag_history_count: d.flag_history ? d.flag_history.length : 0 // Show count of flags
            }))
        });
    } catch (error) {
        console.error("Error fetching flagged donors:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

module.exports = {
    viewAllRequests,
    viewFlaggedDonors
};