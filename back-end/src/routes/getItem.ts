import type { RouteHandler } from 'fastify';
import { db } from '../db.js';

export const getItem: RouteHandler<{
    Params: { provider: string; connectionId: string; externalId: string };
}> = async (req, reply) => {
    const { provider, connectionId, externalId } = req.params;

    try {
        const item = await db.syncedObject.findUnique({
            where: {
                provider_externalId: {
                    provider,
                    externalId
                }
            }
        });

        if (!item) {
            await reply.status(404).send({ error: 'Item not found' });
            return;
        }

        const baseUrl = process.env['BASE_URL'] || 'http://localhost:3010';
        const canonicalUrl = `${baseUrl}/item/${encodeURIComponent(provider)}/${encodeURIComponent(connectionId)}/${encodeURIComponent(externalId)}`;

        // Generate Schema.org JSON-LD
        const schemaOrg: any = {
            '@context': 'https://schema.org',
            '@type': getSchemaType(item.objectType),
            'name': item.title || 'Untitled',
            'description': item.description || item.summary || '',
            'url': canonicalUrl,
            'dateCreated': item.createdAt.toISOString(),
            'dateModified': item.updatedAt.toISOString(),
            'provider': {
                '@type': 'Organization',
                'name': provider
            }
        };

        // Add additional fields based on object type
        if (item.url) {
            schemaOrg['contentUrl'] = item.url;
        }
        if (item.mimeType) {
            schemaOrg['encodingFormat'] = item.mimeType;
        }

        // Generate HTML page with embedded JSON-LD
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(item.title || 'Untitled')}</title>
    <meta name="description" content="${escapeHtml(item.description || item.summary || '')}">
    <script type="application/ld+json">
${JSON.stringify(schemaOrg, null, 2)}
    </script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            line-height: 1.6;
        }
        h1 { color: #333; }
        .metadata { color: #666; font-size: 0.9rem; margin: 1rem 0; }
        .summary { background: #f5f5f5; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
        .json { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; }
        pre { margin: 0; }
        a { color: #0066cc; }
    </style>
</head>
<body>
    <h1>${escapeHtml(item.title || 'Untitled')}</h1>
    
    <div class="metadata">
        <strong>Provider:</strong> ${escapeHtml(provider)}<br>
        <strong>Type:</strong> ${escapeHtml(item.objectType)}<br>
        <strong>Created:</strong> ${item.createdAt.toISOString()}<br>
        <strong>Updated:</strong> ${item.updatedAt.toISOString()}<br>
        ${item.url ? `<strong>Source:</strong> <a href="${escapeHtml(item.url)}" target="_blank">View Original</a><br>` : ''}
    </div>

    ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
    
    ${item.summary ? `
    <div class="summary">
        <h2>Summary</h2>
        <p>${escapeHtml(item.summary)}</p>
    </div>
    ` : ''}

    <h2>Raw Data</h2>
    <div class="json">
        <pre>${escapeHtml(JSON.stringify(item.json, null, 2))}</pre>
    </div>
</body>
</html>`;

        reply.header('Content-Type', 'text/html');
        await reply.status(200).send(html);
    } catch (error) {
        console.error('Failed to get item:', error);
        await reply.status(500).send({ error: 'Failed to get item' });
    }
};

function getSchemaType(objectType: string): string {
    const typeMap: Record<string, string> = {
        'document': 'DigitalDocument',
        'event': 'Event',
        'repository': 'SoftwareSourceCode',
        'issue': 'Question',
        'account': 'Organization',
        'contact': 'Person'
    };
    return typeMap[objectType] || 'Thing';
}

function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m] || m);
}

