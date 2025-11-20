import Fastify from 'fastify';
import cors from '@fastify/cors';

import { postWebhooks } from './routes/postWebhooks.js';
import { getContacts } from './routes/getContacts.js';
import { getIntegrations } from './routes/getIntegrations.js';
import { getConnections } from './routes/getConnections.js';
import { deleteConnection } from './routes/deleteConnection.js';
import { sendSlackMessage } from './routes/sendSlackMessage.js';
import { postConnectSession } from './routes/postConnectSession.js';
import { seedUser } from './db.js';
import { getFiles } from './routes/getFiles.js';
import { downloadFile } from './routes/downloadFile.js';
import { getNangoCredentials } from './routes/getNangoCredentials.js';
import { setConnectionMetadata } from './routes/setConnectionMetadata.js';
import { syncAll } from './routes/syncAll.js';
import { getSitemap } from './routes/getSitemap.js';
import { getItem } from './routes/getItem.js';
import { searchItems } from './routes/searchItems.js';
import { summarize } from './routes/summarize.js';
import { getSettings, updateSettings } from './routes/settings.js';
import { getSyncConfig, getProviderDataTypes } from './routes/getSyncConfig.js';
import { updateSyncConfig } from './routes/updateSyncConfig.js';
import { getUnifiedObjects } from './routes/getUnifiedObjects.js';

import { ipAllowlistMiddleware } from './middleware/ipAllowlist.js';

const fastify = Fastify({
    logger: false,
    trustProxy: true // Required for Cloudflare to see real IP
});
fastify.addHook('onRequest', (req, _res, done) => {
    console.log(`#${req.id} <- ${req.method} ${req.url}`);
    done();
});

await fastify.register(cors, {
    origin: [process.env['FRONTEND_URL'] || 'http://localhost:3011'],
    credentials: true
});

fastify.get('/', async function handler(_, reply) {
    await reply.status(200).send({ root: true });
});

/**
 * Create a connect session
 */
fastify.post('/connect-session', postConnectSession);

/**
 * List available integrations
 * The one you deployed in nango-integrations/
 */
fastify.get('/integrations', getIntegrations);

/**
 * List available connection for one user
 */
fastify.get('/connections', getConnections);

/**
 * Delete a connection for one user
 */
fastify.delete('/connections', deleteConnection);

/**
 * Receive webhooks from Nango every time a records has been added, updated or deleted
 */
fastify.post('/webhooks-from-nango', postWebhooks);

/**
 * List contacts to display in the UI
 * Contacts are the records Nango fetched from the different integrations
 */
fastify.get('/contacts', getContacts);

/**
 * Send a Slack message to a given Slack user.
 */
fastify.post('/send-slack-message', sendSlackMessage);

// Google Drive routes
fastify.get('/get-files', getFiles);
fastify.get('/download/:fileId', downloadFile);

/**
 * Get Nango credentials for a specific integration
 */
fastify.get('/nango-credentials', getNangoCredentials);

/**
 * Set metadata for a connection given its integration ID
 */
fastify.post('/set-connection-metadata', setConnectionMetadata);

/**
 * Sync all integrations
 */
fastify.post('/sync-all', syncAll);

/**
 * Get sitemap.xml
 */
fastify.get('/sitemap.xml', { preHandler: ipAllowlistMiddleware }, getSitemap);

/**
 * Get canonical item page (UUID-based)
 */
fastify.get('/item/:uuid', { preHandler: ipAllowlistMiddleware as any }, getItem);

/**
 * Search synced items
 */
fastify.post('/api/search', searchItems);

/**
 * Generate summaries for synced items
 */
fastify.post('/api/summarize', summarize);

/**
 * Get and update tenant settings
 */
fastify.get('/api/settings/:userId', getSettings);
fastify.put('/api/settings/:userId', updateSettings);

/**
 * Get sync configuration for a connection
 */
fastify.get('/api/connections/:connectionId/sync-config', getSyncConfig);

/**
 * Update sync configuration for a connection
 */
fastify.put('/api/connections/:connectionId/sync-config', updateSyncConfig);

/**
 * Get all provider data types
 */
fastify.get('/api/providers/data-types', getProviderDataTypes);

/**
 * Get unified objects (files, contacts, accounts, employees, etc.)
 */
fastify.get('/api/unified-objects', getUnifiedObjects);

try {
    await seedUser();

    const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3010;
    await fastify.listen({ host: '0.0.0.0', port });
    console.log(`Listening on http://0.0.0.0:${port}`);
} catch (err) {
    console.error(err);
    process.exit(1);
}
