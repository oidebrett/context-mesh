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
        const items = await db.unifiedObject.findMany({
            where: {
                AND: [
                    {
                        state: 'active' // Only search active items
                    },
                    {
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
            type: item.type,
            title: item.title,
            description: item.description,
            summary: item.summary,
            sourceUrl: item.sourceUrl,
            canonicalUrl: `${baseUrl}${item.canonicalUrl}`,
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

