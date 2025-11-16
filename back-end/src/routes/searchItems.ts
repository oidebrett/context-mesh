import type { RouteHandler } from 'fastify';
import { db } from '../db.js';

export const searchItems: RouteHandler<{
    Body: { query: string };
}> = async (req, reply) => {
    const { query } = req.body;

    if (!query) {
        await reply.status(400).send({ error: 'Query is required' });
        return;
    }

    try {
        // Simple text search across title and description
        // In production, this would use vector similarity search with embeddings
        const items = await db.syncedObject.findMany({
            where: {
                OR: [
                    {
                        title: {
                            contains: query,
                            mode: 'insensitive'
                        }
                    },
                    {
                        description: {
                            contains: query,
                            mode: 'insensitive'
                        }
                    },
                    {
                        summary: {
                            contains: query,
                            mode: 'insensitive'
                        }
                    }
                ]
            },
            take: 20,
            orderBy: {
                updatedAt: 'desc'
            }
        });

        const baseUrl = process.env['BASE_URL'] || 'http://localhost:3010';

        const results = items.map(item => ({
            id: item.id,
            provider: item.provider,
            objectType: item.objectType,
            title: item.title,
            description: item.description,
            summary: item.summary,
            url: item.url,
            canonicalUrl: `${baseUrl}/item/${encodeURIComponent(item.provider)}/${encodeURIComponent(item.connectionId)}/${encodeURIComponent(item.externalId)}`,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
        }));

        await reply.status(200).send({
            query,
            count: results.length,
            results
        });
    } catch (error) {
        console.error('Search failed:', error);
        await reply.status(500).send({ error: 'Search failed' });
    }
};

