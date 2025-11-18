import { FastifyRequest, FastifyReply, RouteGenericInterface } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { getDefaultSyncConfig, PROVIDER_DATA_TYPES } from '../services/dataTypeConfigService.js';

const prisma = new PrismaClient();

type RouteHandler<T extends RouteGenericInterface = RouteGenericInterface> = (req: FastifyRequest<T>, reply: FastifyReply) => Promise<void>;

/**
 * GET /api/connections/:connectionId/sync-config
 * Get sync configuration for a specific connection
 */
export const getSyncConfig: RouteHandler<{
    Params: { connectionId: string };
    Querystring: { provider: string };
}> = async (req, reply) => {
    const { connectionId } = req.params;
    const { provider } = req.query;

    if (!provider) {
        await reply.status(400).send({ error: 'Provider query parameter is required' });
        return;
    }

    try {
        // Get existing config from database
        const existingConfig = await prisma.connectionSyncConfig.findUnique({
            where: {
                connectionId_provider: {
                    connectionId,
                    provider
                }
            }
        });

        // Get default config for this provider
        const defaultConfig = getDefaultSyncConfig(provider);
        const providerInfo = PROVIDER_DATA_TYPES[provider];

        if (!providerInfo) {
            await reply.status(404).send({ error: 'Provider not found' });
            return;
        }

        // Merge existing config with defaults
        const syncConfig = existingConfig?.syncConfig 
            ? { ...defaultConfig, ...(existingConfig.syncConfig as object) }
            : defaultConfig;

        await reply.status(200).send({
            connectionId,
            provider,
            providerDisplayName: providerInfo.displayName,
            syncConfig,
            updatedAt: existingConfig?.updatedAt || null
        });
    } catch (error) {
        console.error('Error fetching sync config:', error);
        await reply.status(500).send({ error: 'Failed to fetch sync configuration' });
    }
};

/**
 * GET /api/providers/data-types
 * Get all available data types for all providers
 */
export const getProviderDataTypes: RouteHandler = async (_, reply) => {
    try {
        await reply.status(200).send({
            providers: Object.values(PROVIDER_DATA_TYPES)
        });
    } catch (error) {
        console.error('Error fetching provider data types:', error);
        await reply.status(500).send({ error: 'Failed to fetch provider data types' });
    }
};

