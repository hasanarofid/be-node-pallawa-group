const { OAuth2Client } = require('google-auth-library');
const config = require('../config/env');
const client = new OAuth2Client(config.GOOGLE_CLIENT_ID);

// Verifikasi Google ID token
const verifyGoogleToken = async (token) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: config.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    return {
      googleId: payload['sub'],
      email: payload['email'],
      name: payload['name'],
      picture: payload['picture']
    };
  } catch (error) {
    throw new Error('Token Google tidak valid');
  }
};

module.exports = {
  verifyGoogleToken
};
