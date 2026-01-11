import type { RouteHandler } from 'fastify';
import { db } from '../db.js';
import { z } from 'zod';
import jsonata from 'jsonata';

const CreateMappingSchema = z.object({
    provider: z.string(),
    model: z.string().optional(),
    mapping: z.string()
});

export const getMappings: RouteHandler = async (req, reply) => {
    const user = req.session.get('user');
    if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Find system admin user to get default mappings
    const systemAdmin = await db.users.findUnique({
        where: { email: 'admin@contextmesh.com' }
    });

    if (systemAdmin) {
        // Fetch both user mappings and system mappings
        const mappings = await db.schemaMapping.findMany({
            where: {
                OR: [
                    { userId: user.id },
                    { userId: systemAdmin.id }
                ]
            },
            orderBy: [
                { provider: 'asc' },
                { model: 'asc' } // Sort by provider then model
            ]
        });

        const enhancedMappings = mappings.map(m => ({
            ...m,
            isSystem: m.userId === systemAdmin.id
        }));

        return { mappings: enhancedMappings };
    }

    const mappings = await db.schemaMapping.findMany({
        where: {
            userId: user.id
        }
    });

    const enhancedMappings = mappings.map(m => ({
        ...m,
        isSystem: false
    }));

    return { mappings: enhancedMappings };
};

export const createMapping: RouteHandler = async (req, reply) => {
    const user = req.session.get('user');
    if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
    }

    const body = CreateMappingSchema.parse(req.body);
    const modelValue = body.model || null;

    const existing = await db.schemaMapping.findFirst({
        where: {
            userId: user.id,
            provider: body.provider,
            model: modelValue
        }
    });

    if (existing) {
        return await db.schemaMapping.update({
            where: { id: existing.id },
            data: {
                mapping: body.mapping
            }
        });
    } else {
        return await db.schemaMapping.create({
            data: {
                userId: user.id,
                provider: body.provider,
                model: modelValue,
                mapping: body.mapping
            }
        });
    }
};

export const deleteMapping: RouteHandler = async (req, reply) => {
    const user = req.session.get('user');
    if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = req.params as { id: string };

    await db.schemaMapping.delete({
        where: {
            id,
            userId: user.id
        }
    });

    return { success: true };
};

export const testMapping: RouteHandler = async (req, reply) => {
    const user = req.session.get('user');
    if (!user) {
        return reply.status(401).send({ error: 'Unauthorized' });
    }

    const body = CreateMappingSchema.parse(req.body);
    const modelValue = body.model || null;

    // Find a sample object
    const whereClause: any = {
        provider: body.provider
    };

    // If model is provided, try to filter by type (assuming type maps to model)
    // This is a heuristic since type might not be exactly model
    if (modelValue) {
        whereClause.type = {
            contains: modelValue,
            mode: 'insensitive'
        };
    }

    const sampleObject = await db.unifiedObject.findFirst({
        where: whereClause,
        orderBy: { updatedAt: 'desc' }
    });

    if (!sampleObject) {
        return reply.status(404).send({
            error: 'No sample data found for this provider/model. Please connect the provider and wait for data to sync, or try a different model.'
        });
    }

    try {
        const expression = jsonata(body.mapping);
        const result = await expression.evaluate(sampleObject.metadataRaw);

        return {
            original: sampleObject.metadataRaw,
            mapped: result
        };
    } catch (error: any) {
        return reply.status(400).send({ error: `JSONata Error: ${error.message}` });
    }
};

