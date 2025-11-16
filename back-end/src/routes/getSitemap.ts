import type { RouteHandler } from 'fastify';
import { db } from '../db.js';

export const getSitemap: RouteHandler = async (_, reply) => {
    try {
        const objects = await db.syncedObject.findMany({
            orderBy: {
                updatedAt: 'desc'
            }
        });

        const baseUrl = process.env['BASE_URL'] || 'http://localhost:3010';

        // Generate sitemap XML
        const urls = objects.map(obj => {
            const loc = `${baseUrl}/item/${encodeURIComponent(obj.provider)}/${encodeURIComponent(obj.connectionId)}/${encodeURIComponent(obj.externalId)}`;
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

