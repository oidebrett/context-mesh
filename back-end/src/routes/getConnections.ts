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

    // Critical: Verify user exists in DB to prevent foreign key errors during sync (handles DB wipes)
    const dbUser = await db.users.findUnique({ where: { id: user.id } });
    if (!dbUser) {
        console.warn(`[getConnections] User ${user.id} in session NOT found in DB. Clearing session...`);
        req.session.delete();
        await reply.status(401).send({ error: 'Unauthorized: Session stale' });
        return;
    }

    // Proactively sync with Nango to ensure local DB matches "source of truth"
    // This handles cases where webhooks might have been missed (e.g. tunnel issues)
    try {
        console.log(`[getConnections] Syncing connections from Nango for user ${user.id}...`);
        const { syncUserConnectionsFromNango } = await import('../services/syncService.js');
        await syncUserConnectionsFromNango(user.id, user.id.includes('@') ? user.id : (user as any).email);
    } catch (error) {
        console.error('[getConnections] Failed to sync connections during recovery:', error);
    }

    let userConnections = await db.userConnections.findMany({
        where: {
            userId: user.id
        }
    });
    console.log(`Found ${userConnections.length} user connections in DB`);

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
        } catch (error: any) {
            if (error.response?.status === 404) {
                console.warn(`⚠️ Connection ${userConnection.connectionId} (${userConnection.providerConfigKey}) was NOT found in Nango (404). Deleting stale record from DB...`);
                await db.userConnections.delete({ where: { id: userConnection.id } });
            } else {
                console.error(`✗ Failed to get connection ${userConnection.providerConfigKey} (${userConnection.connectionId}):`, error.message || error);
            }
        }
    }

    await reply.status(200).send({ connections });
};
