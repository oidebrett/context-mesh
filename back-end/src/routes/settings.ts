import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/settings/:userId
 * Get tenant settings
 */
export async function getSettings(
    request: FastifyRequest<{
        Params: {
            userId: string;
        }
    }>,
    reply: FastifyReply
) {
    const { userId } = request.params;

    try {
        let settings = await prisma.tenantSettings.findUnique({
            where: { userId }
        });

        if (!settings) {
            // Create default settings
            settings = await prisma.tenantSettings.create({
                data: {
                    userId,
                    enableSummaries: false,
                    llmMode: 'local'
                }
            });
        }

        return reply.send(settings);
    } catch (error) {
        console.error('Failed to get settings:', error);
        return reply.status(500).send({
            error: 'Failed to get settings'
        });
    }
}

/**
 * PUT /api/settings/:userId
 * Update tenant settings
 */
export async function updateSettings(
    request: FastifyRequest<{
        Params: {
            userId: string;
        };
        Body: {
            enableSummaries?: boolean;
            llmMode?: 'local' | 'cloud';
        }
    }>,
    reply: FastifyReply
) {
    const { userId } = request.params;
    const { enableSummaries, llmMode } = request.body;

    try {
        const settings = await prisma.tenantSettings.upsert({
            where: { userId },
            update: {
                ...(enableSummaries !== undefined && { enableSummaries }),
                ...(llmMode && { llmMode })
            },
            create: {
                userId,
                enableSummaries: enableSummaries ?? false,
                llmMode: llmMode ?? 'local'
            }
        });

        return reply.send(settings);
    } catch (error) {
        console.error('Failed to update settings:', error);
        return reply.status(500).send({
            error: 'Failed to update settings'
        });
    }
}

