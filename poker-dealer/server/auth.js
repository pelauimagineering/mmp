const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const SESSION_DURATION_HOURS = 24;

function createSession(userId, callback) {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + SESSION_DURATION_HOURS);

    db.sessions.create(userId, token, expiresAt.toISOString(), (err) => {
        if (callback) callback(err);
    });

    return {
        token,
        expiresAt
    };
}

function validateSession(token, callback) {
    if (!token) {
        if (callback) callback(null, null);
        return;
    }

    db.sessions.findByToken(token, (err, session) => {
        if (callback) {
            callback(err, session || null);
        }
    });
}

function logout(token, callback) {
    if (token) {
        db.sessions.delete(token, callback);
    } else if (callback) {
        callback();
    }
}

function cleanupExpiredSessions() {
    db.sessions.deleteExpired(() => {
        console.log('Expired sessions cleaned up');
    });
}

// Middleware to check authentication
function requireAuth(req, res, next) {
    const token = req.cookies.sessionToken;

    if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    validateSession(token, (err, session) => {
        if (err || !session) {
            // Safari requires clearCookie to use the same options as the cookie was set with
            res.clearCookie('sessionToken', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                path: '/'
            });
            return res.status(401).json({ error: 'Invalid or expired session' });
        }

        req.user = {
            id: session.user_id,
            display_name: session.display_name,
            user_name: session.user_name
        };

        next();
    });
}

module.exports = {
    createSession,
    validateSession,
    logout,
    cleanupExpiredSessions,
    requireAuth
};
