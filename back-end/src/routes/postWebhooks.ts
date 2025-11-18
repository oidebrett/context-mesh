import type { RouteHandler } from 'fastify';

import type { NangoAuthWebhookBody, NangoSyncWebhookBody, NangoWebhookBody } from '@nangohq/node';
import type { Files } from '@prisma/client';
import { nango } from '../nango.js';
import { db } from '../db.js';
import type { SlackUser } from '../schema.js';
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
            await db.files.deleteMany({
                where: {
                    connectionId: body.connectionId
                }
            });
            try {
                await nango.startSync('google-drive', ['documents'], body.connectionId);
                console.log('Triggered document sync for new Google Drive connection');
            } catch (error) {
                console.error('Failed to trigger document sync:', error);
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
    if (body.model === 'Document' || body.model === 'OneDriveFileSelection') {
        await handleFilesSync(body);
    } else if (body.model === 'SlackUser') {
        await handleSlackSync(body);
    }
}

/**
 * Handle webhook when Slack sync has finished
 */
async function handleSlackSync(body: NangoSyncWebhookBody) {
    // Fetch the actual records that were added/updated/deleted
    const records = await nango.listRecords<SlackUser>({
        connectionId: body.connectionId,
        model: body.model,
        providerConfigKey: body.providerConfigKey,
        // @ts-expect-error: modifiedAfter exists at runtime but is not typed correctly
        modifiedAfter: body.modifiedAfter,
        limit: 1000
    });

    console.log('Slack Records:', records.records.length);

    // Save the updates in our backend
    for (const record of records.records) {
        if (record._nango_metadata.deleted_at) {
            // When a record is deleted in the integration you can replicate this in your own system
            await db.contacts.update({
                where: { id: record.id },
                data: { deletedAt: new Date() }
            });
            continue;
        }

        const fullName = record.profile.display_name ?? record.name;
        const avatar = record.profile.image_original ?? 'https://placehold.co/32x32/lightgrey/white';

        // Create or Update the others records
        await db.contacts.upsert({
            where: { id: record.id },
            create: {
                id: record.id,
                fullName: fullName,
                avatar,
                integrationId: body.providerConfigKey,
                connectionId: body.connectionId,
                createdAt: new Date()
            },
            update: { fullName, avatar, updatedAt: new Date() }
        });
    }

    console.log('Slack results processed');
}

/**
 * Handle webhook when Google Drive sync has finished
 */
async function handleFilesSync(body: NangoSyncWebhookBody) {
    console.log('Sync:', body);
    try {
        const records = await nango.listRecords<Files>({
            connectionId: body.connectionId,
            model: body.model,
            providerConfigKey: body.providerConfigKey,
            // @ts-expect-error: modifiedAfter exists at runtime but is not typed correctly
            modifiedAfter: body.modifiedAfter,
            limit: 1000
        });
        console.log('Documents Records:', records.records);

        console.log('Documents Files:', records.records.length);

        // Save the updates in our backend
        for (const record of records.records) {
            try {
                if (record._nango_metadata.deleted_at) {
                    console.log('File Deleted:', record.id);
                    await db.files.update({
                        where: { id: record.id },
                        data: { deletedAt: new Date() }
                    });
                    continue;
                }

                // Validate and parse createdTime

                // Create or Update the file records
                console.log('File Created:', record.id);
                await db.files.upsert({
                    where: { id: record.id },
                    create: {
                        id: record.id,
                        title: record.title || record['name'],
                        mimeType: record.mimeType || record['mime_type'],
                        url: record.url ?? record['raw_source']?.webUrl ?? null,
                        size: record.size ?? record['raw_source']?.size ?? null,
                        driveId: record['drive_id'] ?? null,
                        createdTime: new Date(record._nango_metadata.first_seen_at),
                        integrationId: body.providerConfigKey,
                        connectionId: body.connectionId,
                        createdAt: new Date()
                    },
                    update: {
                        title: record.title || record['name'],
                        mimeType: record.mimeType || record['mime_type'],
                        url: record.url ?? record['raw_source']?.webUrl ?? null,
                        size: record.size ?? record['raw_source']?.size ?? null,
                        driveId: record['drive_id'] ?? null,
                        createdTime: new Date(record._nango_metadata.first_seen_at),
                        updatedAt: new Date(),
                        integrationId: body.providerConfigKey,
                        connectionId: body.connectionId
                    }
                });
            } catch (error) {
                console.error('Failed to process record:', error);
            }
        }
    } catch (error) {
        console.error('Failed to list records:', error);
    }
}
