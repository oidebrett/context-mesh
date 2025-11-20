
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

// Load env from root
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const secretKey = process.env.NANGO_SECRET_KEY;

if (!secretKey) {
    console.error('NANGO_SECRET_KEY not found in environment');
    process.exit(1);
}

const payload = {
    type: 'sync',
    providerConfigKey: 'google-drive',
    connectionId: 'mock-conn-id',
    model: 'Document',
    success: true,
    added: 1,
    updated: 0,
    deleted: 0,
    start: new Date().toISOString(),
    end: new Date().toISOString()
};

const bodyString = JSON.stringify(payload);

const signature = crypto
    .createHmac('sha256', secretKey)
    .update(bodyString)
    .digest('hex');

console.log('Sending webhook with signature:', signature);

fetch('http://localhost:3010/webhooks-from-nango', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-nango-signature': signature
    },
    body: bodyString
})
    .then(async res => {
        console.log('Status:', res.status);
        const data = await res.json();
        console.log('Response:', data);
    })
    .catch(err => {
        console.error('Error:', err);
    });
