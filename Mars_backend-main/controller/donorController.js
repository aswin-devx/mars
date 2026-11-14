const { v4: uuidv4 } = require("uuid");
const { getRequestMatchesCollection, getAppointmentsCollection, getDonorsCollection, getDonationHistoryCollection, getBloodRequestsCollection } = require("../model/dbmodel");
const { ObjectId } = require('mongodb');
const { computeLambdaScoreInternal } = require('./mlController');

const LAMBDA_SCORE_SUCCESS_BONUS = 5;

/**
 * Donor views pending blood request alerts (MARS Pulse).
 */
async function getPendingAlerts(req, res) {
    const donorId = req.query.userId;

    try {
        const matchesCollection = await getRequestMatchesCollection();
        const requestsCollection = await getBloodRequestsCollection(); // You need to import/define this function

        // 1. Get the basic alerts
        const alerts = await matchesCollection.find({
            donor_id: donorId,
            status: 'sent'
        }).toArray();

        // 2. Extract all request IDs from the alerts
        const requestIds = alerts.map(alert => alert.request_id);

        // 3. Fetch all associated requests in one go using $in
        const requests = await requestsCollection.find({
            _id: { $in: requestIds }
        }).toArray();

        // 4. Merge the data manually
        const enrichedAlerts = alerts.map(alert => {
            // Find the matching request object
            // Note: toString() is often needed when comparing Mongo IDs
            const requestInfo = requests.find(r => r._id.toString() === alert.request_id.toString());
            return {
                ...alert, // Spread existing alert data
                bloodTypeRequired: requestInfo.blood_group || null ,
                urgencyLevel: requestInfo.urgency || null ,
            };
        });

        res.status(200).json({
            message: "Pending blood request alerts fetched successfully.",
            alerts: enrichedAlerts
        });

    } catch (error) {
        console.error("Error fetching donor alerts:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

/**
 * Donor accepts or declines a blood request match.
 */
async function respondToRequest(req, res) {
    const { requestMatchId, action } = req.body;
    const donorId = req.body.userId;

    try {
        const matchesCollection = await getRequestMatchesCollection();
        const appointmentsCollection = await getAppointmentsCollection();
        
        const matchUpdate = await matchesCollection.findOneAndUpdate(
            { _id: requestMatchId, donor_id: donorId, status: 'sent' },
            { $set: { status: action } },
            { returnDocument: 'after' }
        );

        if (!matchUpdate) {
            return res.status(404).json({ message: "Match not found or already processed." });
        }

        if (action === 'accept') {
            // If accepted, create an appointment
            const appointmentTime = new Date(Date.now() + 60 * 60 * 1000); // Mock appointment time: 1 hour from now

            const newAppointment = {
                _id: uuidv4(),
                donor_id: donorId,
                hospital_id: matchUpdate.hospital_id, // Assuming hospital_id is on the match object
                request_id: matchUpdate.request_id,
                appointment_time: appointmentTime,
                status: 'booked' // booked | arrived | donated | no_show
            };
            await appointmentsCollection.insertOne(newAppointment);

            return res.status(200).json({ 
                message: "Request accepted! Appointment booked.", 
                appointmentId: newAppointment._id,
                appointmentTime: appointmentTime.toISOString()
            });

        } else if (action === 'decline') {
            return res.status(200).json({ 
                message: "Request declined. Thank you for your response." 
            });
        }
    } catch (error) {
        console.error("Error responding to request:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

async function getBookedAppointments(req, res) {
    const donorId = req.query.userId; 

    try {
        // 1. Get the collection where these matches/appointments are stored
        const matchesCollection = await getAppointmentsCollection();
        
        const appointments = await matchesCollection.aggregate([
            // --- STAGE 1: Filter ---
            // Find documents where donor matches and status is specifically 'booked'
            {
                $match: {
                    donor_id: donorId,
                    status: 'booked'
                }
            },

            // --- STAGE 2: Join Request Details ---
            // Matches 'request_id' from your data to '_id' in the 'requests' collection
            {
                $lookup: {
                    from: 'request_matches',        // Ensure this matches your actual collection name
                    localField: 'request_id',
                    foreignField: '_id',     
                    as: 'requestDetails'
                }
            },
            {
                $unwind: {
                    path: '$requestDetails',
                    preserveNullAndEmptyArrays: true 
                }
            },

            // --- STAGE 3: Join Hospital Details ---
            // Matches 'hospital_id' from your data to '_id' in the 'hospitals' collection
            {
                $lookup: {
                    from: 'hospitals',       // Ensure this matches your actual collection name
                    localField: 'hospital_id',
                    foreignField: '_id',
                    as: 'hospitalDetails'
                }
            },
            {
                $unwind: {
                    path: '$hospitalDetails',
                    preserveNullAndEmptyArrays: true
                }
            },

            // --- STAGE 4: Sort (Optional) ---
            // Sort by appointment_time (descending: -1 for newest first, or 1 for oldest first)
            {
                $sort: { appointment_time: -1 }
            }

        ]).toArray();

        res.status(200).json({ 
            message: "Booked appointments fetched successfully.",
            appointments
        });

    } catch (error) {
        console.error("Error fetching booked appointments:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}

/**
 * Donor logs the failure reason after a no_show or being flagged (project requirement).
 * In a real flow, the hospital flags first, and the donor might log a reason later to mitigate the flag.
 */
async function submitFailureReason(req, res) {
    const { requestMatchId, reason } = req.body;
    const donorId = req.body.userId;

    try {
        const appointmentsCollection = await getAppointmentsCollection();
        const requestMatchesCollection = await getRequestMatchesCollection();
        const donorsCollection = await getDonorsCollection();
        
        // 1. Find the appointment linked to the match/request
        // const appointment = await appointmentsCollection.findOne({
        //     donor_id: donorId,
        // })
            // Assuming we can derive request_id from requestMatchId or use a direct request ID
            // For simplicity, let's assume requestMatchId is a proxy for the request/match. 
            // In the real system, you'd link this more accurately.
            // For now, let's update the appointment to include the reason.
            // A safer approach: find the match, then the appointment.

            // Find the request ID
            // const match = await requestMatchesCollection.findOne({_id: requestMatchId});
            // if (!match) return res.status(404).json({ message: "Request match not found." });

            const appointmentUpdate = await appointmentsCollection.findOneAndUpdate(
                { donor_id: donorId, _id: requestMatchId, status: 'booked' }, // Must be booked/arrived
                { $set: { status: 'no_show', failure_reason: reason } },
                { returnDocument: 'after' }
            );

            if (!appointmentUpdate) {
                return res.status(404).json({ message: "Active appointment not found." });
            }
        
            // 2. (Optional mitigation logic) Reduce flag status or restore some lambda score 
            // if the reason is deemed valid by an authority/algorithm (future scope).
            // For now, we'll just record the reason.

            // Auto-recompute lambda score after failure event
            computeLambdaScoreInternal(donorId).catch(err => 
                console.error('[ML] Background recompute failed after failure:', err.message)
            );

            res.status(200).json({ 
                message: "Failure reason submitted successfully. This will be reviewed."
            });

        } catch (error) {
            console.error("Error submitting failure reason:", error);
            res.status(500).json({ message: "Internal Server Error" });
        }
}

/**
 * Donor performs a mock successful donation (This would be triggered by hospital on completion).
 * For simulation, let's allow the donor to *confirm* a successful donation and update their score/history.
 */
async function confirmDonation(req, res) {
    const { requestMatchId } = req.body;
    const donorId = req.body.userId;

    try {
        const donorsCollection = await getDonorsCollection();
        const appointmentsCollection = await getAppointmentsCollection();
        const donationHistoryCollection = await getDonationHistoryCollection();
        
        // 1. Find the match/appointment data
        // const match = await matchesCollection.findOne({ _id: requestMatchId });
        // if (!match) return res.status(404).json({ message: "Request match not found." });
        
        // 2. Update donor's lambda score and last donation date
        const updateResult = await donorsCollection.findOneAndUpdate(
            { _id: donorId },
            { 
                $set: { last_donation_date: new Date(), status: 'active' },
                $inc: { lambda_score: LAMBDA_SCORE_SUCCESS_BONUS } // Give bonus for successful donation
            },
            { returnDocument: 'after' }
        );

        const app_new = await appointmentsCollection.findOneAndUpdate(
            { donor_id: donorId, _id: requestMatchId },
            { $set: { status: 'donated' } },
            { returnDocument: 'after' }
        );
        // 3. Insert into Donation History
        await donationHistoryCollection.insertOne({
            _id: uuidv4(),
            donor_id: donorId,
            hospital_id: app_new.hospital_id,
            request_id: app_new.request_id,
            donation_date: new Date()
        });
        
        // 4. Update the appointment status to 'donated'


        // Auto-recompute lambda score after successful donation
        const mlResult = await computeLambdaScoreInternal(donorId);

        res.status(200).json({ 
            message: "Donation confirmed! Thank you for saving a life.",
            newLambdaScore: mlResult ? mlResult.lambda_score : updateResult?.lambda_score,
            newGrade: mlResult ? mlResult.grade : null
        });

    } catch (error) {
        console.error("Error confirming donation:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
}


module.exports = {
    getPendingAlerts,
    respondToRequest,
    submitFailureReason,
    confirmDonation,
    getBookedAppointments
};