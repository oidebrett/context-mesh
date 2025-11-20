
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        // Create a dummy UnifiedObject
        const obj = await prisma.unifiedObject.create({
            data: {
                externalId: 'mock-1',
                provider: 'google-drive',
                connectionId: 'mock-conn-1',
                type: 'document',
                title: 'Mock Document',
                metadataRaw: {},
                metadataNormalized: {
                    '@type': 'DigitalDocument',
                    name: 'Mock Document'
                },
                canonicalUrl: '/item/mock-1',
                sourceUrl: 'https://example.com',
                contentHash: 'hash123',
                state: 'active'
            }
        });
        console.log('Created object:', obj);

        // Create a dummy ConnectionSyncConfig
        await prisma.connectionSyncConfig.create({
            data: {
                connectionId: 'mock-conn-1',
                provider: 'google-drive',
                syncConfig: {
                    document: {
                        enabled: true,
                        includeInSitemap: true
                    }
                }
            }
        });
        console.log('Created sync config');

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
