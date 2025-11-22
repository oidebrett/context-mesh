import { PrismaClient } from '@prisma/client';

export const db = new PrismaClient();



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
