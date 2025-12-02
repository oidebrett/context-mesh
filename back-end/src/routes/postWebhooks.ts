import type { RouteHandler } from 'fastify';

import type { NangoAuthWebhookBody, NangoSyncWebhookBody, NangoWebhookBody } from '@nangohq/node';
import { nango } from '../nango.js';
import { db } from '../db.js';
import { syncIntegration } from '../services/syncService.js';

/**
 * Receive webhooks from Nango every time a records has been added, updated or deleted
 */
export const postWebhooks: RouteHandler = async (req, reply) => {
    const body = req.body as NangoWebhookBody;
    const sig = req.headers['x-nango-signature'] as string;

    console.log('Webhook: received', body);

    // Verify the signature to be sure it's Nango that sent us this payload
    if (!nango.verifyWebhookSignature(sig, req.body)) {
        console.error('Failed to validate Webhook signature');
        await reply.status(400).send({ error: 'invalid_signature' });
        return;
    }

    // Respond immediately as per spec
    await reply.status(200).send({ received: true });

    // Process webhook asynchronously using fire-and-forget pattern
    setImmediate(async () => {
        try {
            switch (body.type) {
                case 'auth':
                    // New connection
                    await handleNewConnectionWebhook(body);
                    break;

                case 'sync':
                    // After a sync is finished
                    await handleSyncWebhook(body);
                    break;

                default:
                    console.warn('unsupported webhook', body);
                    break;
            }
        } catch (error) {
            console.error('Error processing webhook:', error);
        }
    });
};

/**
 * Handle webhook when a new connection is created
 */
async function handleNewConnectionWebhook(body: NangoAuthWebhookBody) {
    if (!body.success) {
        console.error('Failed to auth', body);
        return;
    }

    if (body.operation === 'creation') {
        console.log('Webhook: New connection');
        // Create or update the user connection in the UserConnections table
        await db.userConnections.upsert({
            where: {
                userId_providerConfigKey: {
                    userId: body.endUser!.endUserId,
                    providerConfigKey: body.providerConfigKey
                }
            },
            create: {
                userId: body.endUser!.endUserId,
                connectionId: body.connectionId,
                providerConfigKey: body.providerConfigKey
            },
            update: {
                connectionId: body.connectionId,
                updatedAt: new Date()
            }
        });

        // Trigger document sync for google-drive connections
        if (body.providerConfigKey === 'google-drive') {
            // delete all files from the database
            await db.unifiedObject.deleteMany({
                where: {
                    connectionId: body.connectionId,
                    provider: 'google-drive',
                    type: 'file'
                }
            });
            try {
                await nango.triggerSync('google-drive', ['documents'], body.connectionId, 'full_refresh_and_clear_cache');
                console.log('Triggered document sync for new Google Drive connection');
            } catch (error: any) {
                console.error('Failed to trigger document sync:', error);
                if (error.response?.data) {
                    console.error('Nango API error details:', JSON.stringify(error.response.data, null, 2));
                }
            }
        }
    } else {
        console.log('Webhook: connection', body.operation);
    }
}

/**
 * Handle webhook when a sync has finished fetching data
 * Uses the unified syncIntegration function to handle all provider types
 */
async function handleSyncWebhook(body: NangoSyncWebhookBody) {
    if (!body.success) {
        console.error('Sync failed', body);
        return;
    }

    console.log('Webhook: Sync results - processing via unified sync service');

    try {
        // Use the unified sync service to handle all provider types
        const result = await syncIntegration(
            body.providerConfigKey,
            body.connectionId,
            body.model
        );

        console.log(`Webhook sync complete: ${result.synced} synced, ${result.errors} errors`);
    } catch (error) {
        console.error('Error processing sync webhook:', error);
    }

    // Keep legacy handlers for backward compatibility with Files table
    // These will be deprecated once fully migrated to UnifiedObject
    /*
    if (body.model === 'Document' || body.model === 'OneDriveFileSelection') {
        await handleFilesSync(body);
    } else if (body.model === 'SlackUser') {
        await handleSlackSync(body);
    }
    */
}
