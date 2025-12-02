import type { RouteHandler } from 'fastify';
import { db } from '../db.js';

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export const getRss: RouteHandler = async (_, reply) => {
    try {
        // Only include active items (exclude deleted)
        // Limit to recent items for RSS
        const objects = await db.unifiedObject.findMany({
            where: {
                state: 'active'
            },
            orderBy: {
                updatedAt: 'desc'
            },
            take: 100
        });

        // Get all sync configurations to check includeInSitemap (reuse this flag for RSS for now)
        const syncConfigs = await db.connectionSyncConfig.findMany();
        const configMap = new Map<string, any>();
        for (const config of syncConfigs) {
            const key = `${config.provider}:${config.connectionId}`;
            configMap.set(key, config.syncConfig);
        }

        // Filter objects based on includeInSitemap configuration
        const filteredObjects = objects.filter(obj => {
            const key = `${obj.provider}:${obj.connectionId}`;
            const syncConfig = configMap.get(key);

            if (!syncConfig) {
                // No config found, include by default
                return true;
            }

            const typeConfig = (syncConfig as any)[obj.type];
            if (!typeConfig) {
                // No config for this type, include by default
                return true;
            }

            // Check includeInSitemap flag
            return typeConfig.includeInSitemap !== false;
        });

        const baseUrl = process.env['BASE_URL'] || 'http://localhost:3010';

        const items = filteredObjects.map(obj => {
            const link = `${baseUrl}${obj.canonicalUrl}`;
            const pubDate = obj.createdAt.toUTCString();
            const title = escapeXml(obj.title || 'Untitled');
            const description = escapeXml(obj.description || obj.summary || '');

            return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
    </item>`;
        }).join('\n');

        const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Context Mesh Updates</title>
    <link>${baseUrl}</link>
    <description>Recent updates from your connected services</description>
${items}
  </channel>
</rss>`;

        reply.header('Content-Type', 'application/xml');
        await reply.status(200).send(rss);
    } catch (error) {
        console.error('Failed to generate RSS:', error);
        await reply.status(500).send({ error: 'Failed to generate RSS' });
    }
};
