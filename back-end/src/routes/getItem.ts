import type { RouteHandler } from 'fastify';
import { db } from '../db.js';

export const getItem: RouteHandler<{
    Params: { idOrSlug: string };
}> = async (req, reply) => {
    const { idOrSlug } = req.params;

    try {
        const item = await db.unifiedObject.findFirst({
            where: {
                OR: [
                    { id: idOrSlug },
                    { slug: idOrSlug }
                ]
            }
        });

        if (!item) {
            await reply.status(404).send({ error: 'Item not found' });
            return;
        }

        const baseUrl = process.env['BASE_URL'] || 'http://localhost:3010';
        const canonicalUrl = `${baseUrl}${item.canonicalUrl}`;

        // Generate Schema.org JSON-LD with enhanced mappings
        const schemaOrg: any = {
            '@context': 'https://schema.org',
            '@type': getSchemaType(item.type),
            'name': item.title || 'Untitled',
            'description': item.description || item.summary || '',
            'identifier': item.externalId,
            'url': canonicalUrl,
            'dateCreated': item.createdAt.toISOString(),
            'dateModified': item.updatedAt.toISOString(),
            'provider': {
                '@type': 'Organization',
                'name': item.provider
            },
            // Add Nango connection metadata for MCP client usage
            'nangoConnection': {
                'connectionId': item.connectionId,
                'providerConfigKey': item.provider
            }
        };

        // Add sameAs field for source URL (deep link to original system)
        if (item.sourceUrl) {
            schemaOrg['sameAs'] = item.sourceUrl;
        }

        // Add additional fields based on object type
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
        .deleted-banner {
            background: #fff3cd;
            border: 2px solid #ffc107;
            color: #856404;
            padding: 1rem;
            border-radius: 4px;
            margin: 1rem 0;
            font-weight: bold;
        }
        pre { margin: 0; }
        a { color: #0066cc; }
    </style>
</head>
<body>
    ${item.state === 'deleted' ? `
    <div class="deleted-banner">
        ⚠️ This item has been deleted from the source system and may no longer be available.
    </div>
    ` : ''}

    <h1>${escapeHtml(item.title || 'Untitled')}</h1>

    <div class="metadata">
        <strong>Provider:</strong> ${escapeHtml(item.provider)}<br>
        <strong>Type:</strong> ${escapeHtml(item.type)}<br>
        <strong>State:</strong> ${escapeHtml(item.state)}<br>
        <strong>Created:</strong> ${item.createdAt.toISOString()}<br>
        <strong>Updated:</strong> ${item.updatedAt.toISOString()}<br>
        ${item.sourceUrl ? `<strong>Source:</strong> <a href="${escapeHtml(item.sourceUrl)}" target="_blank">View Original</a><br>` : ''}
    </div>

    <div class="metadata">
        <h3>MCP Connection Details</h3>
        <strong>Connection ID:</strong> ${escapeHtml(item.connectionId)}<br>
        <strong>Provider Config Key:</strong> ${escapeHtml(item.provider)}<br>
        <em>Note: Use these values with the Nango MCP client. The Authorization Bearer token should be configured in your environment.</em>
    </div>

    ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}

    ${item.summary ? `
    <div class="summary">
        <h2>Summary</h2>
        <p>${escapeHtml(item.summary)}</p>
    </div>
    ` : ''}

    <h2>Raw Metadata</h2>
    <div class="json">
        <pre>${escapeHtml(JSON.stringify(item.metadataRaw, null, 2))}</pre>
    </div>

    ${item.metadataNormalized ? `
    <h2>Normalized Metadata</h2>
    <div class="json">
        <pre>${escapeHtml(JSON.stringify(item.metadataNormalized, null, 2))}</pre>
    </div>
    ` : ''}
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
        'file': 'DigitalDocument',
        'document': 'DigitalDocument',
        'event': 'Event',
        'repository': 'SoftwareSourceCode',
        'issue': 'Question',
        'account': 'Organization',
        'contact': 'Person',
        'employee': 'Person'
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

