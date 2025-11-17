import { FastifyRequest, FastifyReply, RouteGenericInterface } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type RouteHandler<T extends RouteGenericInterface = RouteGenericInterface> = (req: FastifyRequest<T>, reply: FastifyReply) => Promise<void>;

/**
 * GET /api/unified-objects
 * Get all unified objects with optional filtering
 */
export const getUnifiedObjects: RouteHandler<{
    Querystring: {
        type?: string;
        provider?: string;
        connectionId?: string;
        state?: string;
        search?: string;
        limit?: string;
    };
}> = async (req, reply) => {
    const { 
        type, 
        provider, 
        connectionId, 
        state = 'active',
        search,
        limit = '100'
    } = req.query;

    try {
        const where: any = {
            state: state || 'active'
        };

        if (type) {
            where.type = type;
        }

        if (provider) {
            where.provider = provider;
        }

        if (connectionId) {
            where.connectionId = connectionId;
        }

        if (search) {
            where.OR = [
                {
                    title: {
                        contains: search,
                        mode: 'insensitive'
                    }
                },
                {
                    description: {
                        contains: search,
                        mode: 'insensitive'
                    }
                }
            ];
        }

        const objects = await prisma.unifiedObject.findMany({
            where,
            take: parseInt(limit, 10),
            orderBy: {
                updatedAt: 'desc'
            }
        });

        // Get unique types and providers for filtering UI
        const types = await prisma.unifiedObject.findMany({
            where: { state: 'active' },
            select: { type: true },
            distinct: ['type']
        });

        const providers = await prisma.unifiedObject.findMany({
            where: { state: 'active' },
            select: { provider: true },
            distinct: ['provider']
        });

        await reply.status(200).send({
            objects: objects.map(obj => ({
                id: obj.id,
                externalId: obj.externalId,
                provider: obj.provider,
                connectionId: obj.connectionId,
                type: obj.type,
                title: obj.title,
                description: obj.description,
                canonicalUrl: obj.canonicalUrl,
                sourceUrl: obj.sourceUrl,
                state: obj.state,
                mimeType: obj.mimeType,
                metadataNormalized: obj.metadataNormalized,
                createdAt: obj.createdAt,
                updatedAt: obj.updatedAt
            })),
            filters: {
                availableTypes: types.map(t => t.type),
                availableProviders: providers.map(p => p.provider)
            },
            count: objects.length
        });
    } catch (error) {
        console.error('Error fetching unified objects:', error);
        await reply.status(500).send({ error: 'Failed to fetch unified objects' });
    }
};

