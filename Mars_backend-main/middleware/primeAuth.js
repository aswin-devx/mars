const crypto = require('crypto');
const { connectToDatabase } = require('../utils/db');

const tokenDigest = (token) => crypto.createHash('sha256').update(token).digest('hex');

async function primeAuth(req, res, next) {
    try {
        const token = (req.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1];
        if (!token) return res.status(401).json({ message: 'Prime sign-in required.' });
        const { db } = await connectToDatabase();
        const session = await db.collection('prime_sessions').findOne({ tokenHash: tokenDigest(token), expiresAt: { $gt: new Date() } });
        if (!session) return res.status(401).json({ message: 'Prime session expired.' });
        const authority = await db.collection('prime_authorities').findOne({ _id: session.authorityId, status: 'active' });
        if (!authority) return res.status(401).json({ message: 'Prime authority is inactive.' });
        req.primeUser = { id: authority._id, name: authority.name, email: authority.email, role: authority.role, state: authority.state, district: authority.district };
        req.primeDb = db;
        return next();
    } catch (error) {
        console.error('Prime authentication failed:', error.message);
        return res.status(503).json({ message: 'Prime authentication is temporarily unavailable.' });
    }
}

function requirePrimeRoles(...roles) {
    return (req, res, next) => roles.includes(req.primeUser?.role)
        ? next()
        : res.status(403).json({ message: 'This Prime action is not allowed for your role.' });
}

function requestedScope(req) {
    const user = req.primeUser;
    const state = typeof req.query.state === 'string' ? req.query.state : undefined;
    const district = typeof req.query.district === 'string' ? req.query.district : undefined;
    if (user.role === 'district_authority') return { state: user.state, district: user.district };
    if (user.role === 'state_authority') {
        if (state && state !== user.state) throw Object.assign(new Error('Requested state is outside your authority.'), { status: 403 });
        return { state: user.state, ...(district ? { district } : {}) };
    }
    if (district && !state) throw Object.assign(new Error('Choose a state before selecting a district.'), { status: 400 });
    return { ...(state ? { state } : {}), ...(district ? { district } : {}) };
}

module.exports = { primeAuth, requirePrimeRoles, requestedScope, tokenDigest };
