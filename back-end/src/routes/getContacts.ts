import type { RouteHandler } from 'fastify';

import { db, getUserFromDatabase } from '../db.js';

export type GetContactsSuccess = {
    contacts: Array<any>;
};
export type GetContacts = GetContactsSuccess | { error: string };

/**
 * Get contacts that were replicated from the integrations to your database
 */
export const getContacts: RouteHandler<{
    Querystring: { integration: 'slack' };
    Reply: GetContacts;
}> = async (req, reply) => {
    const user = await getUserFromDatabase();
    if (!user) {
        await reply.status(400).send({ error: 'invalid_user' });
        return;
    }

    const userConnection = await db.userConnections.findFirst({
        where: {
            userId: user.id,
            providerConfigKey: req.query.integration
        }
    });

    if (!userConnection) {
        await reply.status(200).send({ contacts: [] });
        return;
    }

    // Get the contacts we saved in our own database
    const unifiedContacts = await db.unifiedObject.findMany({
        where: {
            provider: req.query.integration,
            connectionId: userConnection.connectionId,
            type: 'contact'
        },
        orderBy: { title: 'asc' },
        take: 100
    });

    const contacts = unifiedContacts.map(c => ({
        id: c.id,
        fullName: c.title || 'Unknown',
        avatar: (c.metadataNormalized as any)?.avatar || null,
        integrationId: c.provider,
        connectionId: c.connectionId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        deletedAt: null
    }));

    await reply.status(200).send({ contacts });
};
