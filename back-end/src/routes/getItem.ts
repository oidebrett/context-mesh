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
        // 1. Owner of the connection (even if viewed anonymously)
        // 2. Currently logged in user (e.g. for previewing)
        // 3. System default mapping for this provider/model (userId of system admin)

        let ownerUserId: string | null = null;
        if (item.connectionId) {
            const connection = await db.userConnections.findFirst({
                where: { connectionId: item.connectionId }
            });
            if (connection) {
                ownerUserId = connection.userId;
            }
        }

        const systemAdmin = await db.users.findUnique({
            where: { email: 'admin@contextmesh.com' }
        });

        const targetUserIds = [];
        if (ownerUserId) targetUserIds.push(ownerUserId);
        if (user && user.id !== ownerUserId) targetUserIds.push(user.id);
        if (systemAdmin && !targetUserIds.includes(systemAdmin.id)) targetUserIds.push(systemAdmin.id);

        let mappingRecord = null;

        // Try to find the best mapping by iterating through prioritized users
        for (const uid of targetUserIds) {
            // 1. Try exact model match
            mappingRecord = await db.schemaMapping.findFirst({
                where: {
                    userId: uid,
                    provider: item.provider,
                    model: {
                        equals: item.type,
                        mode: 'insensitive'
                    }
                }
            });

            // 2. Try provider-level match
            if (!mappingRecord) {
                mappingRecord = await db.schemaMapping.findFirst({
                    where: {
                        userId: uid,
                        provider: item.provider,
                        model: null
                    }
                });
            }

            if (mappingRecord) break;
        }

        let mappedData: any = {};
        if (mappingRecord) {
            console.log(`Applying mapping ${mappingRecord.id} for item ${item.id} (user: ${mappingRecord.userId})`);
            try {
                const expression = jsonata(mappingRecord.mapping);
                mappedData = await expression.evaluate(item.metadataRaw);
            } catch (e) {
                console.error(`Error applying mapping ${mappingRecord.id}:`, e);
                mappedData = item.metadataNormalized || {};
            }
        } else {
            console.log(`No mapping found for provider ${item.provider} type ${item.type}, using normalized metadata`);
            mappedData = item.metadataNormalized || {};
        }






        // Use mapped data as the source of truth for Schema.org JSON-LD
        // If mapping failed or returned empty, we might want to fallback to a basic structure,
        // but ideally the default system mapping covers this.
        const schemaOrg = mappedData;

        // Ensure essential fields are present for the HTML view if they weren't mapped
        const title = schemaOrg.name || item.title || 'Untitled';
        const description = schemaOrg.description || item.description || item.summary || '';


        // Generate HTML page with embedded JSON-LD
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(schemaOrg.url || schemaOrg.sameAs || '')}">
    <meta property="og:type" content="article">
    <script type="application/ld+json">
${JSON.stringify(schemaOrg, null, 2)}
    </script>
    <style>
        :root {
            --primary-color: #2563eb;
            --text-color: #1f2937;
            --bg-color: #f3f4f6;
            --card-bg: #ffffff;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            line-height: 1.6;
            margin: 0;
            padding: 2rem;
            display: flex;
            justify-content: center;
            min-height: 100vh;
        }
        .container {
            background: var(--card-bg);
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            padding: 2.5rem;
            max-width: 800px;
            width: 100%;
            height: fit-content;
        }
        h1 {
            margin-top: 0;
            color: #111827;
            font-size: 1.875rem;
            line-height: 2.25rem;
        }
        .meta-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin: 2rem 0;
            padding: 1.5rem;
            background: #f9fafb;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
        }
        .meta-item strong {
            display: block;
            font-size: 0.875rem;
            color: #6b7280;
            margin-bottom: 0.25rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        .meta-item span {
            font-size: 1rem;
            color: #374151;
            font-weight: 500;
        }
        .description {
            margin: 2rem 0;
            font-size: 1.125rem;
            color: #4b5563;
        }
        .actions {
            margin-top: 2rem;
            display: flex;
            gap: 1rem;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            font-weight: 500;
            text-decoration: none;
            transition: all 0.2s;
        }
        .btn-primary {
            background-color: var(--primary-color);
            color: white;
        }
        .btn-primary:hover {
            background-color: #1d4ed8;
        }
        .debug-section {
            margin-top: 3rem;
            border-top: 1px solid #e5e7eb;
            padding-top: 2rem;
        }
        .debug-title {
            font-size: 0.875rem;
            color: #9ca3af;
            margin-bottom: 1rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .json-block {
            background: #1f2937;
            color: #e5e7eb;
            padding: 1rem;
            border-radius: 8px;
            overflow-x: auto;
            font-size: 0.875rem;
            display: none;
        }
        .json-block.visible {
            display: block;
        }
        .deleted-banner {
            background: #fef2f2;
            border: 1px solid #fee2e2;
            color: #991b1b;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1.5rem;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
    </style>
    <script>
        function toggleDebug() {
            const el = document.getElementById('debug-content');
            el.classList.toggle('visible');
        }
    </script>
</head>
<body>
    <div class="container">
        ${item.state === 'deleted' ? `
        <div class="deleted-banner">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            This item has been deleted from the source system.
        </div>
        ` : ''}

        <h1>${escapeHtml(title)}</h1>

        <div class="meta-grid">
            <div class="meta-item">
                <strong>Provider</strong>
                <span>${escapeHtml(item.provider)}</span>
            </div>
            <div class="meta-item">
                <strong>Type</strong>
                <span>${escapeHtml(schemaOrg['@type'] || item.type)}</span>
            </div>
            <div class="meta-item">
                <strong>Updated</strong>
                <span>${new Date(item.updatedAt).toLocaleDateString()}</span>
            </div>
            ${item.connectionId ? `
            <div class="meta-item">
                <strong>Connection ID</strong>
                <span>${escapeHtml(item.connectionId)}</span>
            </div>
            ` : ''}
        </div>

        ${description ? `<div class="description">${escapeHtml(description)}</div>` : ''}

        <div class="actions">
            ${schemaOrg.url || schemaOrg.sameAs ? `
            <a href="${escapeHtml(schemaOrg.url || schemaOrg.sameAs)}" target="_blank" class="btn btn-primary">
                View Original Resource
                <svg style="margin-left: 0.5rem" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            </a>
            ` : ''}
        </div>

        <div class="debug-section">
            <div class="debug-title" onclick="toggleDebug()">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                Show Developer Metadata
            </div>
            <div id="debug-content" class="json-block">
                <h3>Applied Mapping</h3>
                <pre>${mappingRecord ? `ID: ${mappingRecord.id}` : 'Using default/raw'}</pre>
                
                <h3>Generated Schema.org JSON-LD</h3>
                <pre>${escapeHtml(JSON.stringify(schemaOrg, null, 2))}</pre>

                <h3>Raw Metadata</h3>
                <pre>${escapeHtml(JSON.stringify(item.metadataRaw, null, 2))}</pre>
            </div>
        </div>
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

function escapeHtml(text: string): string {
    if (!text) return '';
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m] || m);
}

