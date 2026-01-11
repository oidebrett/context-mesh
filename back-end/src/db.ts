import { PrismaClient } from '@prisma/client';

import { emitEvent } from './services/eventService.js';

const prisma = new PrismaClient();

export const db = prisma.$extends({
    query: {
        unifiedObject: {
            async $allOperations({ model, operation, args, query }) {
                const result = await query(args);
                if (['create', 'update', 'upsert', 'delete', 'createMany', 'updateMany', 'deleteMany'].includes(operation)) {
                    emitEvent('unified_object_updated', {
                        model,
                        action: operation,
                        data: result
                    });
                }
                return result;
            }
        }
    }
});



export async function getUserById(userId: string) {
    return await db.users.findUnique({ where: { id: userId } });
}

export async function getUserConnection(userId: string, providerConfigKey: string) {
    return await db.userConnections.findFirst({
        where: {
            userId: userId,
            providerConfigKey: providerConfigKey
        }
    });
}
