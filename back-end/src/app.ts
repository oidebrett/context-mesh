import Fastify from 'fastify';
import cors from '@fastify/cors';

declare module '@fastify/secure-session' {
    interface SessionData {
        user: {
            id: string;
            email: string;
            displayName: string;
            avatarUrl: string | null;
        };
    }
}

declare module 'fastify' {
    interface FastifyInstance {
        googleOAuth2: any;
    }
}
import oauthPlugin from '@fastify/oauth2';
import secureSession from '@fastify/secure-session';
import { authRoutes } from './routes/auth.js';

import { postWebhooks } from './routes/postWebhooks.js';
import { getContacts } from './routes/getContacts.js';
import { getIntegrations } from './routes/getIntegrations.js';
import { getConnections } from './routes/getConnections.js';
import { deleteConnection } from './routes/deleteConnection.js';
import { sendSlackMessage } from './routes/sendSlackMessage.js';
import { postConnectSession } from './routes/postConnectSession.js';
// import { seedUser } from './db.js';
import { getFiles } from './routes/getFiles.js';
import { downloadFile } from './routes/downloadFile.js';
import { getNangoCredentials } from './routes/getNangoCredentials.js';
import { setConnectionMetadata } from './routes/setConnectionMetadata.js';
import { getConnectionMetadata } from './routes/getConnectionMetadata.js';
import { syncAll } from './routes/syncAll.js';
import { getSitemap } from './routes/getSitemap.js';
import { getRss } from './routes/getRss.js';
import { getItem } from './routes/getItem.js';
import { searchItems } from './routes/searchItems.js';
import { summarize } from './routes/summarize.js';
import { getSettings, updateSettings } from './routes/settings.js';
import { getSyncConfig, getProviderDataTypes } from './routes/getSyncConfig.js';
import { updateSyncConfig } from './routes/updateSyncConfig.js';
import { getUnifiedObjects } from './routes/getUnifiedObjects.js';
import { getMappings, createMapping, deleteMapping, testMapping } from './routes/schemaMappings.js';

import { ipAllowlistMiddleware } from './middleware/ipAllowlist.js';
import { eventsHandler } from './services/eventService.js';

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

// Register Secure Session
await fastify.register(secureSession, {
    secret: process.env['SESSION_SECRET'] || 'a-secret-that-should-be-at-least-32-characters-long',
    salt: 'mq9hDxBVDbspDR6n',
    cookie: {
        path: '/',
        httpOnly: true,
        secure: process.env['NODE_ENV'] === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 // 30 days
    }
});

// Register OAuth2
await fastify.register(oauthPlugin, {
    name: 'googleOAuth2',
    scope: ['profile', 'email'],
    credentials: {
        client: {
            id: process.env['GOOGLE_CLIENT_ID'] || '',
            secret: process.env['GOOGLE_CLIENT_SECRET'] || ''
        },
        auth: (oauthPlugin as any).GOOGLE_CONFIGURATION
    },
    startRedirectPath: '/auth/google',
    callbackUri: `${process.env['BASE_URL'] || process.env['NEXT_PUBLIC_BACKEND_URL'] || 'http://localhost:3010'}/auth/google/callback`
});

// Register Auth Routes
await fastify.register(authRoutes);

// Auth Hook
fastify.addHook('onRequest', async (req, reply) => {
    const publicRoutes = ['/', '/auth/google', '/auth/google/callback', '/auth/logout', '/auth/me', '/webhooks-from-nango', '/sitemap.xml', '/rss.xml', '/item/:idOrSlug'];
    if (publicRoutes.includes(req.routerPath) || req.routerPath.startsWith('/auth/')) {
        return;
    }

    // Allow OPTIONS requests (CORS preflight)
    if (req.method === 'OPTIONS') {
        return;
    }

    const user = req.session.get('user');
    if (!user) {
        reply.code(401).send({ error: 'Unauthorized' });
    }
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
 * Get metadata for a connection given its integration ID
 */
fastify.get('/get-connection-metadata', getConnectionMetadata);

/**
 * Sync all integrations
 */
fastify.post('/sync-all', syncAll);

/**
 * Get sitemap.xml
 */
fastify.get('/sitemap.xml', { preHandler: ipAllowlistMiddleware }, getSitemap);

/**
 * Get rss.xml
 */
fastify.get('/rss.xml', { preHandler: ipAllowlistMiddleware }, getRss);

/**
 * Get canonical item page (UUID-based)
 */
fastify.get('/item/:idOrSlug', { preHandler: ipAllowlistMiddleware as any }, getItem);

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
/**
 * Get unified objects (files, contacts, accounts, employees, etc.)
 */
fastify.get('/api/unified-objects', getUnifiedObjects);

/**
 * Server-Sent Events for real-time updates
 */
fastify.get('/events', eventsHandler);

/**
 * Schema Mappings
 */
fastify.get('/api/mappings', getMappings);
fastify.post('/api/mappings', createMapping);
fastify.post('/api/mappings/test', testMapping);
fastify.delete('/api/mappings/:id', deleteMapping);

try {
    // await seedUser();

    const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 3010;
    await fastify.listen({ host: '0.0.0.0', port });
    console.log(`Listening on http://0.0.0.0:${port}`);
} catch (err) {
    console.error(err);
    process.exit(1);
}
