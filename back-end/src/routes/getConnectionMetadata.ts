import type { RouteHandler } from 'fastify';
import { nango } from '../nango.js';
import { getUserConnection } from '../db.js';

export const getConnectionMetadata: RouteHandler<{
    Querystring: { integrationId: string };
}> = async (req, reply) => {
    const { integrationId } = req.query;
    const user = req.session.get('user');

    if (!user) {
        await reply.status(401).send({ error: 'Unauthorized' });
        return;
    }

    if (!integrationId) {
        await reply.status(400).send({ error: 'integrationId is required' });
        return;
    }

    try {
        const userConnection = await getUserConnection(user.id, integrationId);

        if (!userConnection) {
            await reply.status(404).send({ error: 'connection_not_found' });
            return;
        }

        const connection = await nango.getConnection(integrationId, userConnection.connectionId);

        await reply.status(200).send({
            metadata: connection.metadata || {},
            connectionId: userConnection.connectionId
        });
    } catch (error) {
        console.error('Failed to get metadata:', error);
        await reply.status(500).send({ error: 'Failed to get metadata' });
    }
};

