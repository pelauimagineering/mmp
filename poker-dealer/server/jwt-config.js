/**
 * JWT Configuration Module
 *
 * Maps user names to their corresponding JWT tokens from environment variables.
 * Provides functions to retrieve and validate JWT tokens for users and the community display.
 */

const JWT_MAPPING = {
    'gary': process.env.JWT_GARY,
    'neave': process.env.JWT_NEAVE,
    'harish': process.env.JWT_HARISH,
    'chris': process.env.JWT_CHRIS,
    'tony': process.env.JWT_TONY,
    'seymour': process.env.JWT_SEYMOUR,
    'kerwin': process.env.JWT_KERWIN,
    'wayne': process.env.JWT_WAYNE,
    'dee': process.env.JWT_DEE,
    'lorenzo': process.env.JWT_LORENZO,
    'jb': process.env.JWT_JB
};

const COMMUNITY_JWT = process.env.JWT_COMMUNITY;

/**
 * Get JWT token for a specific user
 * @param {string} userName - The user's username (case-insensitive)
 * @returns {string|null} The JWT token or null if not found
 */
function getJwtForUser(userName) {
    const normalizedUserName = userName.toLowerCase();
    const jwt = JWT_MAPPING[normalizedUserName];

    if (!jwt) {
        console.error(`No JWT found for user: ${userName}`);
        return null;
    }

    return jwt;
}

/**
 * Get JWT token for the community display
 * @returns {string|null} The JWT token or null if not configured
 */
function getCommunityJwt() {
    if (!COMMUNITY_JWT) {
        console.error('No JWT_COMMUNITY environment variable configured');
        return null;
    }
    return COMMUNITY_JWT;
}

/**
 * Validate that all required JWT environment variables are configured
 * @returns {object} Validation result with 'valid' boolean and 'missing' array
 */
function validateJwtConfig() {
    const missing = [];

    // Check user JWTs
    Object.keys(JWT_MAPPING).forEach(userName => {
        if (!JWT_MAPPING[userName]) {
            missing.push(`JWT_${userName.toUpperCase()}`);
        }
    });

    // Check community JWT
    if (!COMMUNITY_JWT) {
        missing.push('JWT_COMMUNITY');
    }

    return {
        valid: missing.length === 0,
        missing: missing
    };
}

module.exports = {
    getJwtForUser,
    getCommunityJwt,
    validateJwtConfig
};
