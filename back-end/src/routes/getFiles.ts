import type { RouteHandler } from 'fastify';
import { db, getUserFromDatabase } from '../db.js';

export const getFiles: RouteHandler = async (_, reply) => {
    const user = await getUserFromDatabase();
    if (!user) {
        await reply.status(400).send({ error: 'invalid_user' });
        return;
    }

    try {
        const userConnections = await db.userConnections.findMany({
            where: {
                userId: user.id
            }
        });

        if (userConnections.length === 0) {
            await reply.status(200).send({ files: [] });
            return;
        }

        const connectionIds = userConnections.map((conn) => conn.connectionId);

        const unifiedFiles = await db.unifiedObject.findMany({
            where: {
                connectionId: {
                    in: connectionIds
                },
                type: 'file',
                state: 'active'
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        const files = unifiedFiles.map(f => ({
            id: f.id,
            title: f.title || 'Untitled',
            mimeType: f.mimeType || 'application/octet-stream',
            url: f.sourceUrl || '',
            size: (f.metadataNormalized as any)?.size || 0,
            driveId: (f.metadataNormalized as any)?.driveId || null,
            createdTime: f.createdAt,
            integrationId: f.provider,
            connectionId: f.connectionId,
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
            deletedAt: null
        }));

        await reply.status(200).send({ files });
    } catch (error) {
        console.error('Failed to get files:', error);
        await reply.status(500).send({ error: 'Failed to get files' });
    }
};
