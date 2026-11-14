const crypto = require('crypto');
const { connectToDatabase } = require('../utils/db');
const { tokenDigest } = require('../middleware/primeAuth');

const passwordHash = (password, salt = crypto.randomBytes(16).toString('hex')) => ({
    salt,
    hash: crypto.scryptSync(password, salt, 64).toString('hex'),
});
const passwordMatches = (password, account) => {
    if (!account.passwordSalt || !account.passwordHash) return false;
    const actual = crypto.scryptSync(password, account.passwordSalt, 64);
    const expected = Buffer.from(account.passwordHash, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};
const publicUser = ({ _id, name, email, role, state, district }) => ({ id: _id, name, email, role, state, district });

async function login(req, res) {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ message: 'Email and password are required.' });
    try {
        const { db } = await connectToDatabase();
        const accounts = db.collection('prime_authorities');
        const account = await accounts.findOne({ email: email.trim().toLowerCase(), status: 'active' });
        if (!account || !passwordMatches(password, account)) return res.status(401).json({ message: 'Invalid credentials.' });
        const token = crypto.randomBytes(32).toString('base64url');
        const now = new Date();
        await db.collection('prime_sessions').insertOne({ tokenHash: tokenDigest(token), authorityId: account._id, createdAt: now, expiresAt: new Date(now.getTime() + 8 * 60 * 60 * 1000) });
        return res.json({ token, user: publicUser(account) });
    } catch (error) { console.error('Prime login failed:', error.message); return res.status(503).json({ message: 'Prime sign-in is temporarily unavailable.' }); }
}

async function session(req, res) { return res.json({ user: req.primeUser }); }

async function logout(req, res) {
    const token = (req.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1];
    if (token) await req.primeDb.collection('prime_sessions').deleteOne({ tokenHash: tokenDigest(token) });
    return res.json({ success: true });
}

async function bootstrap(req, res) {
    const secret = process.env.MARS_PRIME_BOOTSTRAP_SECRET;
    const { name, email, password, bootstrapSecret } = req.body || {};
    if (!secret || !bootstrapSecret) return res.status(403).json({ message: 'Bootstrap is unavailable or unauthorized.' });
    const secretBytes = Buffer.from(String(secret)), suppliedBytes = Buffer.from(String(bootstrapSecret));
    if (secretBytes.length !== suppliedBytes.length || !crypto.timingSafeEqual(secretBytes, suppliedBytes)) return res.status(403).json({ message: 'Bootstrap is unavailable or unauthorized.' });
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || password.length < 12) return res.status(400).json({ message: 'Name, email, and a password of at least 12 characters are required.' });
    const { db } = await connectToDatabase();
    const accounts = db.collection('prime_authorities');
    await accounts.createIndex({ role: 1 }, { unique: true, partialFilterExpression: { role: 'super_admin' } });
    if (await accounts.countDocuments({ role: 'super_admin' })) return res.status(409).json({ message: 'A Super Admin is already configured.' });
    const credentials = passwordHash(password);
    await accounts.createIndex({ email: 1 }, { unique: true });
    await accounts.insertOne({ _id: crypto.randomUUID(), name: name.trim(), email: email.trim().toLowerCase(), role: 'super_admin', status: 'active', ...{ passwordSalt: credentials.salt, passwordHash: credentials.hash }, createdAt: new Date() });
    return res.status(201).json({ success: true });
}

module.exports = { login, session, logout, bootstrap, passwordHash, publicUser };
