import { nango } from '../nango.js';
import { db } from '../db.js';
import crypto from 'crypto';

interface NangoRecord {
    id?: string;
    _nango_metadata: {
        first_seen_at: string;
        last_modified_at: string;
        deleted_at?: string;
    };
    [key: string]: any;
}

interface SyncResult {
    provider: string;
    connectionId: string;
    synced: number;
    errors: number;
}

/**
 * Normalize records from different providers into a unified schema
 */
function normalizeRecord(provider: string, connectionId: string, record: NangoRecord, model: string): any {
    const externalId = record.id || record['externalId'] || crypto.randomUUID();
    const rawJson = JSON.parse(JSON.stringify(record));
    const hash = crypto.createHash('md5').update(JSON.stringify(rawJson)).digest('hex');

    // Provider-specific normalization
    switch (provider) {
        case 'google-drive':
            return {
                provider,
                connectionId,
                externalId,
                objectType: 'document',
                title: record['title'] || record['name'] || 'Untitled',
                description: record['description'] || null,
                url: record['url'] || record['webViewLink'] || null,
                mimeType: record['mimeType'] || null,
                json: rawJson,
                hash
            };

        case 'zoho-crm':
            return {
                provider,
                connectionId,
                externalId,
                objectType: model.toLowerCase(),
                title: record['Account_Name'] || record['Full_Name'] || record['Subject'] || 'Untitled',
                description: record['Description'] || null,
                url: null,
                mimeType: null,
                json: rawJson,
                hash
            };

        case 'github':
            if (model === 'GithubRepo' || record['full_name']) {
                return {
                    provider,
                    connectionId,
                    externalId,
                    objectType: 'repository',
                    title: record['full_name'] || record['name'] || 'Untitled',
                    description: record['description'] || null,
                    url: record['html_url'] || null,
                    mimeType: null,
                    json: rawJson,
                    hash
                };
            } else if (model === 'GithubIssue' || record['title']) {
                return {
                    provider,
                    connectionId,
                    externalId,
                    objectType: 'issue',
                    title: record['title'] || 'Untitled',
                    description: record['body'] || null,
                    url: record['html_url'] || null,
                    mimeType: null,
                    json: rawJson,
                    hash
                };
            }
            break;

        case 'google-calendar':
            return {
                provider,
                connectionId,
                externalId,
                objectType: 'event',
                title: record['summary'] || 'Untitled Event',
                description: record['description'] || null,
                url: record['htmlLink'] || null,
                mimeType: null,
                json: rawJson,
                hash
            };

        default:
            return {
                provider,
                connectionId,
                externalId,
                objectType: model.toLowerCase(),
                title: record['name'] || record['title'] || record['subject'] || 'Untitled',
                description: record['description'] || record['body'] || null,
                url: record['url'] || record['link'] || null,
                mimeType: record['mimeType'] || record['mime_type'] || null,
                json: rawJson,
                hash
            };
    }
}

/**
 * Sync records from a specific integration
 */
export async function syncIntegration(
    provider: string,
    connectionId: string,
    model: string
): Promise<SyncResult> {
    const result: SyncResult = {
        provider,
        connectionId,
        synced: 0,
        errors: 0
    };

    try {
        console.log(`Syncing ${provider} (${connectionId}) - model: ${model}`);
        
        const records = await nango.listRecords<NangoRecord>({
            providerConfigKey: provider,
            connectionId,
            model,
            limit: 1000
        });

        console.log(`Found ${records.records.length} records for ${provider}`);

        for (const record of records.records) {
            try {
                if (record._nango_metadata.deleted_at) {
                    // Mark as deleted
                    await db.syncedObject.updateMany({
                        where: {
                            provider,
                            externalId: record.id || ''
                        },
                        data: {
                            updatedAt: new Date()
                        }
                    });
                    continue;
                }

                const normalized = normalizeRecord(provider, connectionId, record, model);

                // Upsert the record
                await db.syncedObject.upsert({
                    where: {
                        provider_externalId: {
                            provider,
                            externalId: normalized.externalId
                        }
                    },
                    create: normalized,
                    update: {
                        ...normalized,
                        updatedAt: new Date()
                    }
                });

                result.synced++;
            } catch (error) {
                console.error(`Error syncing record ${record.id}:`, error);
                result.errors++;
            }
        }

        console.log(`Sync complete for ${provider}: ${result.synced} synced, ${result.errors} errors`);
    } catch (error) {
        console.error(`Failed to sync ${provider}:`, error);
        result.errors++;
    }

    return result;
}

/**
 * Get the model name for a provider
 */
function getModelForProvider(provider: string): string | null {
    const modelMap: Record<string, string> = {
        'google-drive': 'Document',
        'zoho-crm': 'Account',
        'github': 'GithubRepo',
        'github-getting-started': 'GithubRepo',
        'google-calendar': 'Event',
        'google-calendar-getting-started': 'Event',
        'slack': 'SlackUser',
        'one-drive': 'OneDriveFileSelection',
        'one-drive-personal': 'OneDriveFileSelection'
    };
    return modelMap[provider] || null;
}

/**
 * Sync all available connections dynamically
 */
export async function syncAllConnections(): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    try {
        // Get all connections from Nango
        const allConnections = await nango.listConnections();

        console.log(`Found ${allConnections.connections.length} total connections`);

        for (const connection of allConnections.connections) {
            const provider = connection.provider_config_key;
            const connectionId = connection.connection_id;
            const model = getModelForProvider(provider);

            if (!model) {
                console.log(`Skipping ${provider} - no model mapping configured`);
                continue;
            }

            try {
                console.log(`Syncing ${provider} (${connectionId}) with model ${model}`);
                const result = await syncIntegration(provider, connectionId, model);
                results.push(result);
            } catch (error) {
                console.error(`Failed to sync ${provider}:`, error);
                results.push({
                    provider,
                    connectionId,
                    synced: 0,
                    errors: 1
                });
            }
        }
    } catch (error) {
        console.error('Failed to list connections:', error);
    }

    return results;
}


