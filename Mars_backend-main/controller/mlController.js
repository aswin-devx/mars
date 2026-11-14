const { getDonorsCollection, getDonationHistoryCollection, getRequestMatchesCollection, getAppointmentsCollection } = require("../model/dbModel");

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:5001';

/**
 * Gathers the 13 behavioral features for a donor from the database,
 * calls the Python ML API to predict a lambda score, 
 * and stores the result back in the donors collection.
 * 
 * POST /ml/compute-lambda
 * Body: { userId: string }
 */
async function computeLambdaScore(req, res) {
    const donorId = req.body.userId || req.query.userId;

    if (!donorId) {
        return res.status(400).json({ error: "userId is required." });
    }

    try {
        const donorsCollection = await getDonorsCollection();
        const donationHistoryCollection = await getDonationHistoryCollection();
        const matchesCollection = await getRequestMatchesCollection();
        const appointmentsCollection = await getAppointmentsCollection();

        // 1. Get donor document
        const donor = await donorsCollection.findOne({ _id: donorId });
        if (!donor) {
            return res.status(404).json({ error: "Donor not found." });
        }

        // 2. Gather behavioral features from database
        const features = await gatherDonorFeatures(donor, donorId, donationHistoryCollection, matchesCollection, appointmentsCollection);

        // 3. Call the Python ML API
        const mlResponse = await fetch(`${ML_API_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(features),
        });

        if (!mlResponse.ok) {
            const errData = await mlResponse.json();
            return res.status(mlResponse.status).json({ error: "ML prediction failed", details: errData });
        }

        const prediction = await mlResponse.json();
        const lambdaScore = prediction.lambda_score;
        const grade = prediction.grade;

        // 4. Store the computed score back in the donor document
        await donorsCollection.updateOne(
            { _id: donorId },
            { 
                $set: { 
                    lambda_score: lambdaScore, 
                    lambda_grade: grade,
                    lambda_updated_at: new Date(),
                    lambda_features: features // Store features for transparency
                } 
            }
        );

        return res.status(200).json({
            message: "Lambda score computed and stored successfully.",
            donorId,
            lambda_score: lambdaScore,
            grade,
            features
        });

    } catch (error) {
        console.error("Error computing lambda score:", error);
        return res.status(503).json({ error: "Failed to compute lambda score.", details: error.message });
    }
}

/**
 * Internal helper: Compute lambda score without HTTP (for auto-recompute after events).
 * Returns { lambda_score, grade } or null on failure.
 */
async function computeLambdaScoreInternal(donorId) {
    try {
        const donorsCollection = await getDonorsCollection();
        const donationHistoryCollection = await getDonationHistoryCollection();
        const matchesCollection = await getRequestMatchesCollection();
        const appointmentsCollection = await getAppointmentsCollection();

        const donor = await donorsCollection.findOne({ _id: donorId });
        if (!donor) return null;

        const features = await gatherDonorFeatures(donor, donorId, donationHistoryCollection, matchesCollection, appointmentsCollection);

        const mlResponse = await fetch(`${ML_API_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(features),
        });

        if (!mlResponse.ok) return null;

        const prediction = await mlResponse.json();

        await donorsCollection.updateOne(
            { _id: donorId },
            { 
                $set: { 
                    lambda_score: prediction.lambda_score, 
                    lambda_grade: prediction.grade,
                    lambda_updated_at: new Date(),
                    lambda_features: features
                } 
            }
        );

        console.log(`[ML] Lambda score recomputed for ${donorId}: ${prediction.lambda_score} (${prediction.grade})`);
        return prediction;

    } catch (error) {
        console.error(`[ML] Failed to auto-recompute lambda for ${donorId}:`, error.message);
        return null;
    }
}

/**
 * Gathers the 13 behavioral features needed by the ML model from the database.
 */
async function gatherDonorFeatures(donor, donorId, donationHistoryCollection, matchesCollection, appointmentsCollection) {
    // Count donations in last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const donationsLast12 = await donationHistoryCollection.countDocuments({
        donor_id: donorId,
        donation_date: { $gte: twelveMonthsAgo }
    });

    // Count all matches sent to this donor and how many they responded to
    const totalMatches = await matchesCollection.countDocuments({ donor_id: donorId });
    const acceptedMatches = await matchesCollection.countDocuments({ donor_id: donorId, status: 'accept' });
    const declinedMatches = await matchesCollection.countDocuments({ donor_id: donorId, status: 'decline' });

    const responseRate = totalMatches > 0 
        ? ((acceptedMatches + declinedMatches) / totalMatches) * 100 
        : 100;

    // Count appointments and no-shows
    const totalAppointments = await appointmentsCollection.countDocuments({ donor_id: donorId });
    const noShows = await appointmentsCollection.countDocuments({ donor_id: donorId, status: 'no_show' });
    const donatedAppointments = await appointmentsCollection.countDocuments({ donor_id: donorId, status: 'donated' });

    // Days since last donation
    const lastDonation = donor.last_donation_date ? new Date(donor.last_donation_date) : null;
    const daysSinceLastDonation = lastDonation 
        ? Math.floor((Date.now() - lastDonation.getTime()) / (1000 * 60 * 60 * 24))
        : 365; // Default: assume long time if never donated

    // Compliance ratio (donated / total appointments)
    const intervalComplianceRatio = totalAppointments > 0 
        ? donatedAppointments / totalAppointments 
        : 1.0;

    // Streak days (from geo_verification_streak or default)
    const streakDays = donor.geo_verification_streak || 0;

    // Medical deferrals (from flag_history)
    const medicalDeferrals = donor.flag_history ? donor.flag_history.length : 0;

    // Postponements
    const postponementsUsed = donor.postponements_used || 0;
    const invalidPostponements = donor.invalid_postponements || 0;

    // Geo verification rate (from donor profile or compute)
    const geoVerificationRate = donor.geo_verification_rate || (streakDays > 0 ? 90 : 50);

    // PDRT score and health flags
    const pdrtScore = donor.pdrt_score || 85;
    const fatigueFlag = donor.fatigue_flag || 0;
    const dizzinessFlag = donor.dizziness_flag || 0;

    // Average response time (estimated from behavior)
    const avgResponseTimeMin = donor.avg_response_time_min || 15;

    return {
        response_rate: Math.min(100, Math.max(0, responseRate)),
        avg_response_time_min: avgResponseTimeMin,
        geo_verification_rate: geoVerificationRate,
        streak_days: streakDays,
        postponements_used: postponementsUsed,
        invalid_postponements: invalidPostponements,
        donations_last_12mo: donationsLast12,
        days_since_last_donation: daysSinceLastDonation,
        interval_compliance_ratio: Math.min(1.0, Math.max(0, intervalComplianceRatio)),
        pdrt_score: pdrtScore,
        medical_deferrals_12mo: medicalDeferrals,
        fatigue_flag: fatigueFlag,
        dizziness_flag: dizzinessFlag
    };
}

/**
 * GET /donor/lambda-score?userId=xxx
 * Fetches the stored lambda score for a donor.
 */
async function getLambdaScore(req, res) {
    const donorId = req.query.userId;

    if (!donorId) {
        return res.status(400).json({ error: "userId is required." });
    }

    try {
        const donorsCollection = await getDonorsCollection();
        const donor = await donorsCollection.findOne({ _id: donorId });

        if (!donor) {
            return res.status(404).json({ error: "Donor not found." });
        }

        // Compute reliability and safety sub-scores from stored features
        const features = donor.lambda_features || {};
        
        const reliabilityFactors = [
            { name: 'Response Rate', value: Math.round(features.response_rate || 0) },
            { name: 'Geo-Verification Streak', value: Math.min(100, (features.streak_days || 0) * 10) },
            { name: 'Postponement Rate', value: Math.max(0, 100 - (features.postponements_used || 0) * 20) },
        ];

        const safetyFactors = [
            { name: 'Interval Compliance', value: Math.round((features.interval_compliance_ratio || 0) * 100) },
            { name: 'PDRT Score', value: Math.round(features.pdrt_score || 0) },
        ];

        const reliabilityScore = reliabilityFactors.reduce((sum, f) => sum + f.value, 0) / reliabilityFactors.length;
        const safetyScore = safetyFactors.reduce((sum, f) => sum + f.value, 0) / safetyFactors.length;

        return res.status(200).json({
            donorId,
            lambda_score: donor.lambda_score ?? 50,
            lambda_grade: donor.lambda_grade ?? 'Fair',
            lambda_updated_at: donor.lambda_updated_at || null,
            reliabilityScore: Math.round(reliabilityScore * 10) / 10,
            safetyScore: Math.round(safetyScore * 10) / 10,
            reliabilityFactors,
            safetyFactors,
            features: donor.lambda_features || null
        });

    } catch (error) {
        console.error("Error fetching lambda score:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

/**
 * GET /prime/lambda-analytics
 * Returns aggregate λ-score analytics for MARS Prime dashboard.
 */
async function getLambdaAnalytics(req, res) {
    try {
        const donorsCollection = await getDonorsCollection();
        const user = req.primeUser;
        const scope = user.role === 'district_authority'
            ? { state: user.state, district: user.district }
            : user.role === 'state_authority'
                ? { state: user.state, ...(typeof req.query.district === 'string' ? { district: req.query.district } : {}) }
                : { ...(typeof req.query.state === 'string' ? { state: req.query.state } : {}), ...(typeof req.query.district === 'string' ? { district: req.query.district } : {}) };
        const allDonors = await donorsCollection.find(scope).project({ lambda_score: 1 }).toArray();

        // Score distribution buckets
        const distribution = {
            'Critical (0-30)': 0,
            'At Risk (30-50)': 0,
            'Fair (50-70)': 0,
            'Good (70-85)': 0,
            'Excellent (85-100)': 0
        };

        let totalScore = 0;
        let scoredCount = 0;

        allDonors.forEach(d => {
            if (typeof d.lambda_score !== 'number' || !Number.isFinite(d.lambda_score)) return;
            const score = d.lambda_score;
            totalScore += score;
            scoredCount++;

            if (score < 30) distribution['Critical (0-30)']++;
            else if (score < 50) distribution['At Risk (30-50)']++;
            else if (score < 70) distribution['Fair (50-70)']++;
            else if (score < 85) distribution['Good (70-85)']++;
            else distribution['Excellent (85-100)']++;
        });

        const avgScore = scoredCount > 0 ? Math.round((totalScore / scoredCount) * 10) / 10 : 0;

        // Grade distribution for charts
        const gradeDistribution = Object.entries(distribution).map(([range, count]) => ({
            range,
            count
        }));

        return res.status(200).json({
            message: "Lambda analytics fetched.",
            totalDonors: allDonors.length,
            scoredDonors: scoredCount,
            averageLambdaScore: scoredCount ? avgScore : null,
            excellentCount: distribution['Excellent (85-100)'],
            atRiskCount: distribution['Critical (0-30)'] + distribution['At Risk (30-50)'],
            distribution: gradeDistribution,
        });

    } catch (error) {
        console.error("Error fetching lambda analytics:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

module.exports = {
    computeLambdaScore,
    computeLambdaScoreInternal,
    getLambdaScore,
    getLambdaAnalytics
};
