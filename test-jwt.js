const jwt = require('jsonwebtoken');
require('dotenv').config();

const KLING_API_KEY = process.env.KlingAI_Access_Key;
const KLING_SECRET_KEY = process.env.KlingAI_Secret_Key;

function generateKlingToken(accessKey, secretKey) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: accessKey,
    exp: now + 1800, // Token expires in 30 minutes
    nbf: now - 5      // Token is valid from 5 seconds ago
  };
  
  const token = jwt.sign(payload, secretKey, { 
    algorithm: 'HS256',
    header: { alg: 'HS256' }
  });
  
  return token;
}

console.log("\n=== Kling AI JWT Token Generator ===\n");
console.log("Access Key:", KLING_API_KEY);
console.log("Secret Key:", KLING_SECRET_KEY ? "****" + KLING_SECRET_KEY.slice(-4) : "NOT FOUND");
console.log("\nGenerated JWT Token:\n");

const token = generateKlingToken(KLING_API_KEY, KLING_SECRET_KEY);
console.log(token);

console.log("\n\nFull Authorization Header:\n");
console.log(`Bearer ${token}`);
console.log("\n");

// Decode to show payload
const decoded = jwt.decode(token, { complete: true });
console.log("Decoded Token (for verification):");
console.log(JSON.stringify(decoded, null, 2));
