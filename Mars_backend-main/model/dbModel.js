 const { connectToDatabase } = require('../utils/db');

// Helper function to get a specific collection
async function getCollection(collectionName) {
    try {
        const { db } = await connectToDatabase();
        return db.collection(collectionName);
    } catch (error) {
        console.error(`Error accessing collection ${collectionName}:`, error);
        throw new Error('Database connection failed.');
    }
}

// --- Public Collection Accessors ---

const getDonorsCollection = () => getCollection('donors');
const getHospitalsCollection = () => getCollection('hospitals');
const getHospitalInventoryCollection = () => getCollection('hospital_inventory');
const getBloodRequestsCollection = () => getCollection('blood_requests');
const getRequestMatchesCollection = () => getCollection('request_matches');
const getAppointmentsCollection = () => getCollection('appointments');
const getDonationHistoryCollection = () => getCollection('donation_history');
const getSMSLogsCollection = () => getCollection('sms_logs');

module.exports = {
    getDonorsCollection,
    getHospitalsCollection,
    getHospitalInventoryCollection,
    getBloodRequestsCollection,
    getRequestMatchesCollection,
    getAppointmentsCollection,
    getDonationHistoryCollection,
    getSMSLogsCollection
};