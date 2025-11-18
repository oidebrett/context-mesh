import { FastifyRequest, FastifyReply, RouteGenericInterface } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { DataTypeConfig } from '../services/dataTypeConfigService.js';

const prisma = new PrismaClient();

type RouteHandler<T extends RouteGenericInterface = RouteGenericInterface> = (req: FastifyRequest<T>, reply: FastifyReply) => Promise<void>;

/**
 * PUT /api/connections/:connectionId/sync-config
 * Update sync configuration for a specific connection
 */
export const updateSyncConfig: RouteHandler<{
    Params: { connectionId: string };
    Body: {
        provider: string;
        syncConfig: Record<string, DataTypeConfig>;
    };
}> = async (req, reply) => {
    const { connectionId } = req.params;
    const { provider, syncConfig } = req.body;

    if (!provider || !syncConfig) {
        await reply.status(400).send({ 
            error: 'Provider and syncConfig are required' 
        });
        return;
    }

    try {
        // Upsert the configuration
        const updated = await prisma.connectionSyncConfig.upsert({
            where: {
                connectionId_provider: {
                    connectionId,
                    provider
                }
            },
            update: {
                syncConfig: syncConfig as any,
                updatedAt: new Date()
            },
            create: {
                connectionId,
                provider,
                syncConfig: syncConfig as any
            }
        });

        await reply.status(200).send({
            success: true,
            connectionId: updated.connectionId,
            provider: updated.provider,
            syncConfig: updated.syncConfig,
            updatedAt: updated.updatedAt
        });
    } catch (error) {
        console.error('Error updating sync config:', error);
        await reply.status(500).send({ 
            error: 'Failed to update sync configuration' 
        });
    }
};

