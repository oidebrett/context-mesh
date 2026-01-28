import type { RouteHandler } from 'fastify';
import { nango } from '../nango.js';
import { getUserConnection } from '../db.js';

export const setConnectionMetadata: RouteHandler<{
    Body: { integrationId: string; metadata: Record<string, any> };
}> = async (req, reply) => {
    const { integrationId, metadata } = req.body;
    const user = req.session.get('user');
    if (!user) {
        await reply.status(401).send({ error: 'Unauthorized' });
        return;
    }

    try {
        const userConnection = await getUserConnection(user.id, integrationId);

        if (!userConnection) {
            await reply.status(404).send({ error: 'connection_not_found' });
            return;
        }

        console.log(`[setConnectionMetadata] Attempting to set metadata for ${integrationId}...`);
        console.log(`[setConnectionMetadata] Metadata payload:`, JSON.stringify(metadata, null, 2));

        // Use the upgraded Nango SDK method which now uses the correct POST /connections/metadata endpoint
        await nango.setMetadata(integrationId, userConnection.connectionId, metadata);
        console.log(`[setConnectionMetadata] Success: nango.setMetadata completed for ${integrationId}`);

        if (integrationId === 'google-drive') {
            console.log(`[setConnectionMetadata] Triggering sync for google-drive 'documents'...`);
            await nango.triggerSync(integrationId, ['documents'], userConnection.connectionId);
            console.log(`[setConnectionMetadata] Sync triggered for google-drive`);
        } else if (integrationId === 'one-drive' || integrationId === 'one-drive-personal') {
            const syncName = integrationId === 'one-drive' ? 'user-files-selection' : 'user-files-personals-selection';
            console.log(`[setConnectionMetadata] Triggering sync for ${integrationId} '${syncName}'...`);
            await nango.triggerSync(integrationId, [syncName], userConnection.connectionId);
            console.log(`[setConnectionMetadata] Sync triggered for ${integrationId}`);
        } else if (integrationId === 'jira') {
            console.log(`[setConnectionMetadata] Triggering sync for jira 'issues' (Full Refresh)...`);
            // We use full_refresh_and_clear_cache specifically for Jira to ensure issues
            // are re-fetched if they were previously marked as deleted in Nango's cache.
            await nango.triggerSync(integrationId, ['issues'], userConnection.connectionId, 'full_refresh_and_clear_cache');
            console.log(`[setConnectionMetadata] Full sync triggered for jira`);
        }

        await reply.status(200).send({ success: true });
    } catch (error) {
        console.error('Failed to set metadata:', error);
        await reply.status(500).send({ error: 'Failed to set metadata' });
    }
};

