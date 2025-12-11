import type { RouteHandler } from 'fastify';
import { db } from '../db.js';

import jsonata from 'jsonata';

export const getItem: RouteHandler<{
    Params: { idOrSlug: string };
}> = async (req, reply) => {
    const { idOrSlug } = req.params;
    const user = req.session.get('user');

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

        // Fetch applicable mapping
        // Priority:
        // 1. User-specific mapping for this provider/model
        // 2. System default mapping for this provider/model (userId of system admin)
        // For now, we'll just look for ANY mapping for this provider/model, preferring the current user's if logged in.

        let mappingRecord = null;
        if (user) {
            mappingRecord = await db.schemaMapping.findFirst({
                where: {
                    userId: user.id,
                    provider: item.provider,
                    model: {
                        contains: item.type, // Approximate model match or use exact if available in item
                        mode: 'insensitive'
                    }
                }
            });

            // Fallback to provider-only mapping if model-specific not found
            if (!mappingRecord) {
                mappingRecord = await db.schemaMapping.findFirst({
                    where: {
                        userId: user.id,
                        provider: item.provider,
                        model: null
                    }
                });
            }
        }

        // If no user mapping, try system mapping (or any mapping for this provider as a fallback for now)
        if (!mappingRecord) {
            mappingRecord = await db.schemaMapping.findFirst({
                where: {
                    provider: item.provider,
                    model: {
                        contains: item.type,
                        mode: 'insensitive'
                    }
                }
            });
            if (!mappingRecord) {
                mappingRecord = await db.schemaMapping.findFirst({
                    where: {
                        provider: item.provider,
                        model: null
                    }
                });
            }
        }

        let mappedData: any = {};
        if (mappingRecord) {
            try {
                const expression = jsonata(mappingRecord.mapping);
                mappedData = await expression.evaluate(item.metadataRaw);
            } catch (e) {
                console.error('Error applying mapping:', e);
                // Fallback to raw data or existing normalized data
                mappedData = item.metadataNormalized || {};
            }
        } else {
            mappedData = item.metadataNormalized || {};
        }

        const baseUrl = process.env['BASE_URL'] || 'http://localhost:3010';
        const canonicalUrl = `${baseUrl}${item.canonicalUrl}`;

        // Use mapped data for display
        const title = mappedData.title || item.title || 'Untitled';
        const description = mappedData.description || item.description || item.summary || '';
        const type = mappedData.type || item.type;
        const sourceUrl = mappedData.sourceUrl || item.sourceUrl;
        const mimeType = mappedData.mimeType || item.mimeType;


        // Generate Schema.org JSON-LD with enhanced mappings
        const schemaOrg: any = {
            '@context': 'https://schema.org',
            '@type': getSchemaType(type),
            'name': title,
            'description': description,
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
        if (sourceUrl) {
            schemaOrg['sameAs'] = sourceUrl;
        }

        // Add additional fields based on object type
        if (mimeType) {
            schemaOrg['encodingFormat'] = mimeType;
        }

        // Generate HTML page with embedded JSON-LD
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
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

    <h1>${escapeHtml(title)}</h1>

    <div class="metadata">
        <strong>Provider:</strong> ${escapeHtml(item.provider)}<br>
        <strong>Type:</strong> ${escapeHtml(type)}<br>
        <strong>State:</strong> ${escapeHtml(item.state)}<br>
        <strong>Created:</strong> ${item.createdAt.toISOString()}<br>
        <strong>Updated:</strong> ${item.updatedAt.toISOString()}<br>
        ${sourceUrl ? `<strong>Source:</strong> <a href="${escapeHtml(sourceUrl)}" target="_blank">View Original</a><br>` : ''}
    </div>

    <div class="metadata">
        <h3>MCP Connection Details</h3>
        <strong>Connection ID:</strong> ${escapeHtml(item.connectionId)}<br>
        <strong>Provider Config Key:</strong> ${escapeHtml(item.provider)}<br>
        <em>Note: Use these values with the Nango MCP client. The Authorization Bearer token should be configured in your environment.</em>
    </div>

    ${description ? `<p>${escapeHtml(description)}</p>` : ''}

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

    <h2>Mapped Metadata (Dynamic)</h2>
    <div class="json">
        <pre>${escapeHtml(JSON.stringify(mappedData, null, 2))}</pre>
    </div>
    
    ${mappingRecord ? `<p class="metadata">Applied Mapping ID: ${mappingRecord.id}</p>` : '<p class="metadata">No custom mapping applied (using defaults/raw)</p>'}
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

