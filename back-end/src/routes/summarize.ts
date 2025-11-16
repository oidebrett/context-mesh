import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { generateSummary } from '../services/summarizerService.js';

const prisma = new PrismaClient();

/**
 * POST /api/summarize
 * Generate summaries for synced objects
 */
export async function summarize(
    request: FastifyRequest<{
        Body: {
            objectId?: string;
            userId: string;
            all?: boolean;
        }
    }>,
    reply: FastifyReply
) {
    const { objectId, userId, all } = request.body;

    try {
        if (all) {
            // Generate summaries for all objects without summaries
            const objects = await prisma.syncedObject.findMany({
                where: {
                    summary: null
                },
                take: 100 // Limit to avoid timeout
            });

            const results = [];
            for (const object of objects) {
                try {
                    const summary = await generateSummary(object.id, userId);
                    results.push({
                        id: object.id,
                        success: true,
                        summary
                    });
                } catch (error) {
                    console.error(`Failed to summarize ${object.id}:`, error);
                    results.push({
                        id: object.id,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }

            return reply.send({
                success: true,
                processed: results.length,
                results
            });
        } else if (objectId) {
            // Generate summary for a specific object
            const summary = await generateSummary(objectId, userId);
            
            return reply.send({
                success: true,
                objectId,
                summary
            });
        } else {
            return reply.status(400).send({
                error: 'Either objectId or all=true must be provided'
            });
        }
    } catch (error) {
        console.error('Summarization error:', error);
        return reply.status(500).send({
            error: 'Failed to generate summaries',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

