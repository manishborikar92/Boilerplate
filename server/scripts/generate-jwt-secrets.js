const crypto = require('crypto');

const secret1 = crypto.randomBytes(64).toString('hex');
const secret2 = crypto.randomBytes(64).toString('hex');

console.log('Generated JWT Secrets:');
console.log('----------------------');
console.log(`JWT_SECRET=${secret1}`);
console.log(`JWT_REFRESH_SECRET=${secret2}`);
console.log('----------------------');
console.log('Copy these values to your .env file.');
