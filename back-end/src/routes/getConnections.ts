import type { RouteHandler } from 'fastify';
import type { GetPublicConnections } from '@nangohq/types';
import { nango } from '../nango.js';
import { db } from '../db.js';

export type GetConnectionsSuccess = {
    connections: GetPublicConnections['Success']['connections'];
};
export type GetConnections = GetConnectionsSuccess | { error: string };

/**
 * List available connection for one user.
 * A connection is a link between an integration and a user (e.g: oauth token)
 */
export const getConnections: RouteHandler<{
    Reply: GetConnections;
}> = async (req, reply) => {
    console.log('=== getConnections called ===');
    const user = req.session.get('user');
    console.log('User from session:', user);
    if (!user) {
        console.log('✗ No user in session, returning 401');
        await reply.status(401).send({ error: 'Unauthorized' });
        return;
    }

    console.log(`Querying UserConnections for userId: ${user.id}`);
    const userConnections = await db.userConnections.findMany({
        where: {
            userId: user.id
        }
    });
    console.log(`Found ${userConnections.length} user connections in DB:`, userConnections);

    if (userConnections.length === 0) {
        console.log('No connections found, returning empty array');
        await reply.status(200).send({ connections: [] });
        return;
    }

    const connections = [];
    for (const userConnection of userConnections) {
        console.log(`Fetching Nango connection for ${userConnection.providerConfigKey} (${userConnection.connectionId})...`);
        try {
            const connection = await nango.getConnection(userConnection.providerConfigKey, userConnection.connectionId);
            if (connection) {
                console.log(`✓ Successfully fetched ${userConnection.providerConfigKey} connection`);
                connections.push({
                    id: connection.id,
                    connection_id: userConnection.connectionId,
                    provider_config_key: userConnection.providerConfigKey,
                    provider: userConnection.providerConfigKey,
                    created: connection.created_at,
                    metadata: connection.metadata || {},
                    errors: connection.errors || [],
                    end_user: connection.end_user || null
                });
            } else {
                console.warn(`✗ Nango returned null for ${userConnection.providerConfigKey} connection`);
            }
        } catch (error) {
            console.error(`✗ Failed to get connection ${userConnection.providerConfigKey} (${userConnection.connectionId}):`, error);
        }
    }

    await reply.status(200).send({ connections });
};
