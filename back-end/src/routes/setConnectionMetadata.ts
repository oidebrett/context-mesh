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

        console.log(`Setting metadata for ${integrationId} (${userConnection.connectionId}):`, JSON.stringify(metadata, null, 2));

        // Use the upgraded Nango SDK method which now uses the correct POST /connections/metadata endpoint
        await nango.setMetadata(integrationId, userConnection.connectionId, metadata);

        if (integrationId === 'google-drive') {
            await nango.triggerSync(integrationId, ['documents'], userConnection.connectionId);
        } else if (integrationId === 'one-drive') {
            await nango.triggerSync(integrationId, ['user-files-selection'], userConnection.connectionId);
        }

        await reply.status(200).send({ success: true });
    } catch (error) {
        console.error('Failed to set metadata:', error);
        await reply.status(500).send({ error: 'Failed to set metadata' });
    }
};

