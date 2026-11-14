const crypto = require('crypto');
const { connectToDatabase } = require('../utils/db');
const { requestedScope } = require('../middleware/primeAuth');
const { passwordHash, publicUser } = require('./primeAuthController');

const id = (doc) => String(doc._id ?? doc.id ?? '');
const inScope = (doc, scope) => (!scope.state || doc.state === scope.state) && (!scope.district || doc.district === scope.district);
const label = (value) => typeof value === 'string' ? value.replace(/(^|[-_ ])\w/g, (part) => part.toUpperCase()).replace(/Tier(\d)/i, 'Tier $1') : value;
const logAction = (db, actor, action, target, reason, scope = {}) => db.collection('prime_audit_logs').insertOne({ _id: crypto.randomUUID(), timestamp: new Date(), actor: actor.name, actorId: actor.id, actorRole: actor.role, actionType: action, target, notes: reason, ...scope });
const scopedContext = async (req) => {
    const scope = requestedScope(req);
    const hospitals = await req.primeDb.collection('hospitals').find({}).toArray();
    const visibleHospitals = hospitals.filter((hospital) => inScope(hospital, scope));
    const hospitalIds = new Set(visibleHospitals.flatMap((hospital) => [id(hospital), hospital.hospitalId].filter(Boolean)));
    return { scope, hospitals: visibleHospitals, hospitalIds };
};

async function scopes(req, res) {
    try {
        const { hospitals } = await scopedContext(req);
        const states = [...new Set(hospitals.map((h) => h.state).filter(Boolean))].sort();
        const state = req.primeUser.role === 'super_admin' ? req.query.state : req.primeUser.state;
        const districts = [...new Set(hospitals.filter((h) => !state || h.state === state).map((h) => h.district).filter(Boolean))].sort();
        return res.json({ states, districts });
    } catch (e) { return res.status(e.status || 500).json({ message: e.message }); }
}

async function hospitals(req, res) {
    try {
        const { hospitals } = await scopedContext(req);
        return res.json({ hospitals: hospitals.map((h) => ({ id: id(h), name: h.name, type: h.hospital_type || h.type || 'Unspecified', region: [h.district, h.state].filter(Boolean).join(', '), state: h.state, district: h.district, status: label(h.status) || 'Unknown', complianceRating: h.compliance_rating ?? null, lastInventoryUpdate: h.last_inventory_update ?? null, stats: { requestsLast30Days: null, alerts: null } })) });
    } catch (e) { return res.status(e.status || 500).json({ message: e.message }); }
}

async function requests(req, res) {
    try {
        const { hospitals: scopedHospitals, hospitalIds } = await scopedContext(req);
        const rows = await req.primeDb.collection('blood_requests').find({}).sort({ created_at: -1 }).limit(500).toArray();
        const byId = new Map(scopedHospitals.flatMap((h) => [[id(h), h], [h.hospitalId, h]]));
        const visible = rows.filter((r) => hospitalIds.has(r.hospital_id) && byId.has(r.hospital_id));
        return res.json({ requests: visible.map((r) => ({ id: id(r), hospitalName: byId.get(r.hospital_id)?.name || 'Unknown facility', region: [byId.get(r.hospital_id)?.district, byId.get(r.hospital_id)?.state].filter(Boolean).join(', '), state: byId.get(r.hospital_id)?.state, district: byId.get(r.hospital_id)?.district, bloodGroup: r.blood_group, priority: label(r.urgency), status: label(r.status), gprsTier: label(r.tier_used), requestTime: r.created_at, timeTaken: null })) });
    } catch (e) { return res.status(e.status || 500).json({ message: e.message }); }
}

async function donorAnalytics(req, res) {
    try {
        const { scope } = await scopedContext(req);
        const donors = await req.primeDb.collection('donors').find({}).project({ state: 1, district: 1, status: 1, last_donation_date: 1 }).toArray();
        const scoped = donors.filter((d) => inScope(d, scope));
        const since = new Date(Date.now() - 30 * 86400000);
        const active = scoped.filter((d) => d.last_donation_date && new Date(d.last_donation_date) >= since).length;
        return res.json({ totalRegistered: scoped.length, activeLast30Days: active, responseRate: null, avgResponseTime: null, geoVerificationCompliance: null, avgDonationsPerYear: null });
    } catch (e) { return res.status(e.status || 500).json({ message: e.message }); }
}

async function inventoryAnalytics(req, res) {
    try {
        const { hospitalIds } = await scopedContext(req);
        const inventory = await req.primeDb.collection('hospital_inventory').find({}).toArray();
        const rows = inventory.filter((item) => hospitalIds.has(item.hospital_id));
        if (!rows.length) return res.json({ totalAvailable: null, totalRequired: null, gap: null, expiringSoon: null, wastageRate: null, byBloodGroup: [] });
        const hasAvailable = rows.every((row) => row.units_available != null && Number.isFinite(Number(row.units_available)));
        const hasRequired = rows.every((row) => row.units_required != null && Number.isFinite(Number(row.units_required)));
        if (!hasAvailable || !hasRequired) return res.json({ totalAvailable: null, totalRequired: null, gap: null, expiringSoon: null, wastageRate: null, byBloodGroup: [] });
        const groups = new Map();
        for (const row of rows) {
            const group = row.blood_group;
            if (!group) continue;
            const current = groups.get(group) || { group, available: 0, required: 0 };
            current.available += Number(row.units_available);
            current.required += Number(row.units_required);
            groups.set(group, current);
        }
        const valid = [...groups.values()];
        if (!valid.length) return res.json({ totalAvailable: null, totalRequired: null, gap: null, expiringSoon: null, wastageRate: null, byBloodGroup: [] });
        const available = valid.reduce((s, x) => s + x.available, 0), required = valid.reduce((s, x) => s + x.required, 0);
        return res.json({ totalAvailable: available, totalRequired: required, gap: available - required, expiringSoon: null, wastageRate: null, byBloodGroup: valid });
    } catch (e) { return res.status(e.status || 500).json({ message: e.message }); }
}

async function dailyDonations(req, res) {
    try {
        const { scope } = await scopedContext(req);
        const donorIds = await req.primeDb.collection('donors').find({ ...(scope.state ? { state: scope.state } : {}), ...(scope.district ? { district: scope.district } : {}) }).project({ _id: 1 }).toArray();
        if (!donorIds.length && (scope.state || scope.district)) return res.json({ donations: [] });
        const rows = await req.primeDb.collection('donation_history').find(scope.state || scope.district ? { donor_id: { $in: donorIds.map((d) => d._id) } } : {}).toArray();
        const counts = new Map();
        for (const row of rows) { const date = row.donation_date && new Date(row.donation_date); if (date && !Number.isNaN(date.getTime())) { const key = date.toISOString().slice(0, 10); counts.set(key, (counts.get(key) || 0) + 1); } }
        return res.json({ donations: [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([date, donations]) => ({ date, donations })) });
    } catch (e) { return res.status(e.status || 500).json({ message: e.message }); }
}

async function geography(req, res) { return res.json({ regions: [] }); }
async function alerts(req, res) { return res.json({ alerts: [] }); }

async function auditLog(req, res) {
    try { const { scope } = await scopedContext(req); const rows = await req.primeDb.collection('prime_audit_logs').find({ ...(scope.state ? { state: scope.state } : {}), ...(scope.district ? { district: scope.district } : {}) }).sort({ timestamp: -1 }).limit(500).toArray(); return res.json({ auditLog: rows.map((r) => ({ id: id(r), timestamp: r.timestamp, actor: r.actor, actionType: r.actionType, target: r.target, notes: r.notes })) }); }
    catch (e) { return res.status(e.status || 500).json({ message: e.message }); }
}

async function updateHospitalStatus(req, res) {
    try {
        const action = String(req.body.action || '').toLowerCase();
        const reason = String(req.body.reason || '').trim();
        if (!['approved', 'suspended', 'active', 'revoked'].includes(action) || !reason) return res.status(400).json({ message: 'A valid status and reason are required.' });
        const { hospitals, scope } = await scopedContext(req);
        const hospital = hospitals.find((h) => id(h) === req.params.id || h.hospitalId === req.params.id);
        if (!hospital) return res.status(404).json({ message: 'Facility not found in your scope.' });
        const nextStatus = action === 'approved' ? 'active' : action;
        await req.primeDb.collection('hospitals').updateOne({ _id: hospital._id }, { $set: { status: nextStatus, updatedAt: new Date() }, $push: { statusHistory: { status: nextStatus, reason, actorId: req.primeUser.id, timestamp: new Date() } } });
        await logAction(req.primeDb, req.primeUser, `Hospital ${action}`, hospital.name || req.params.id, reason, { state: hospital.state, district: hospital.district });
        return res.json({ success: true });
    } catch (e) { return res.status(e.status || 500).json({ message: e.message }); }
}

async function gdraStatus(req, res) {
    try { const { scope } = await scopedContext(req); const query = { active: true, ...(scope.state ? { state: scope.state } : {}), ...(scope.district ? { district: scope.district } : {}) }; const active = await req.primeDb.collection('prime_gdra_events').findOne(query, { sort: { createdAt: -1 } }); return res.json({ active: Boolean(active), scope: active ? { level: active.level, state: active.state, district: active.district } : null }); }
    catch (e) { return res.status(e.status || 500).json({ message: e.message }); }
}

async function changeGdra(req, res) {
    const { level, state, district } = req.body || {};
    const user = req.primeUser;
    const permitted = (user.role === 'super_admin' && ['platform', 'state', 'district'].includes(level)) || (user.role === 'state_authority' && level === 'state' && state === user.state) || (user.role === 'district_authority' && level === 'district' && state === user.state && district === user.district);
    if (!permitted || (level === 'state' && !state) || (level === 'district' && (!state || !district))) return res.status(403).json({ message: 'Invalid GDRA scope for this authority.' });
    const key = { level, ...(state ? { state } : {}), ...(district ? { district } : {}) };
    if (req.path.endsWith('activate')) {
        await req.primeDb.collection('prime_gdra_events').updateOne({ ...key, active: true }, { $setOnInsert: { _id: crypto.randomUUID(), ...key, active: true, createdAt: new Date(), activatedBy: user.id } }, { upsert: true });
    } else {
        await req.primeDb.collection('prime_gdra_events').updateOne({ ...key, active: true }, { $set: { active: false, closedAt: new Date(), closedBy: user.id } });
    }
    await logAction(req.primeDb, user, req.path.endsWith('activate') ? 'GDRA activated' : 'GDRA deactivated', JSON.stringify(key), 'Authority disaster response state change', key);
    return res.json({ success: true });
}

async function authorities(req, res) {
    const rows = await req.primeDb.collection('prime_authorities').find({}).project({ passwordHash: 0, passwordSalt: 0 }).sort({ createdAt: -1 }).toArray();
    return res.json({ authorities: rows.map((row) => ({ ...publicUser(row), status: row.status })) });
}
async function createAuthority(req, res) {
    const { name, email, password, role, state, district } = req.body || {};
    if (!['state_authority', 'district_authority'].includes(role) || !name || !email || typeof password !== 'string' || password.length < 12 || !state || (role === 'district_authority' && !district)) return res.status(400).json({ message: 'Provide a valid role, scope, name, email, and password of at least 12 characters.' });
    const scopeRows = await req.primeDb.collection('hospitals').find({ state, ...(role === 'district_authority' ? { district } : {}) }).limit(1).toArray();
    if (!scopeRows.length) return res.status(400).json({ message: 'That state or district is not present in the facility records.' });
    const credentials = passwordHash(password);
    try { await req.primeDb.collection('prime_authorities').insertOne({ _id: crypto.randomUUID(), name: name.trim(), email: email.trim().toLowerCase(), role, state, ...(role === 'district_authority' ? { district } : {}), status: 'active', passwordSalt: credentials.salt, passwordHash: credentials.hash, createdAt: new Date() }); }
    catch (error) { if (error.code === 11000) return res.status(409).json({ message: 'An authority with that email already exists.' }); throw error; }
    await logAction(req.primeDb, req.primeUser, 'Authority created', email, `Created ${role}`, { state, district });
    return res.status(201).json({ success: true });
}
async function updateAuthorityStatus(req, res) {
    const status = req.body.status;
    if (!['active', 'suspended'].includes(status)) return res.status(400).json({ message: 'Status must be active or suspended.' });
    const result = await req.primeDb.collection('prime_authorities').updateOne({ _id: req.params.id, role: { $in: ['state_authority', 'district_authority'] } }, { $set: { status, updatedAt: new Date() } });
    if (!result.matchedCount) return res.status(404).json({ message: 'Authority not found.' });
    await req.primeDb.collection('prime_sessions').deleteMany({ authorityId: req.params.id });
    await logAction(req.primeDb, req.primeUser, `Authority ${status}`, req.params.id, `Account ${status}`);
    return res.json({ success: true });
}

module.exports = { scopes, scopedContext, hospitals, requests, donorAnalytics, inventoryAnalytics, dailyDonations, geography, alerts, auditLog, updateHospitalStatus, gdraStatus, changeGdra, authorities, createAuthority, updateAuthorityStatus };
