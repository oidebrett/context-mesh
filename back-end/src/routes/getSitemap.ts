import type { RouteHandler } from 'fastify';
import { db } from '../db.js';

export const getSitemap: RouteHandler = async (_, reply) => {
    try {
        // Only include active items (exclude deleted)
        const objects = await db.unifiedObject.findMany({
            where: {
                state: 'active'
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        // Get all sync configurations to check includeInSitemap
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

        // Generate sitemap XML using UUID-based canonical URLs
        const urls = filteredObjects.map(obj => {
            const loc = `${baseUrl}${obj.canonicalUrl}`;
            const lastmod = obj.updatedAt.toISOString();

            return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`;
        }).join('\n');

        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

        reply.header('Content-Type', 'application/xml');
        await reply.status(200).send(sitemap);
    } catch (error) {
        console.error('Failed to generate sitemap:', error);
        await reply.status(500).send({ error: 'Failed to generate sitemap' });
    }
};

