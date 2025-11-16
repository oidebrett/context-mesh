import type { RouteHandler } from 'fastify';
import { syncAllConnections } from '../services/syncService.js';

export const syncAll: RouteHandler = async (_, reply) => {
    try {
        console.log('Starting sync of all integrations...');
        const results = await syncAllConnections();
        
        await reply.status(200).send({
            success: true,
            results
        });
    } catch (error) {
        console.error('Sync failed:', error);
        await reply.status(500).send({
            success: false,
            error: String(error)
        });
    }
};

