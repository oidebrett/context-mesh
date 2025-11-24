import { nango } from '../nango.js';
import { db } from '../db.js';
import crypto from 'crypto';
import { getDefaultSyncConfig } from './dataTypeConfigService.js';
import { fetchAndSummarizeDocument, isGoogleDocument, isOneDriveDocument } from './documentFetcherService.js';



interface SyncResult {
    provider: string;
    connectionId: string;
    synced: number;
    errors: number;
}

/**
 * Normalize records from different providers into a unified schema
 */
import { MAPPERS } from '../mappers/index.js';
import type { NangoRecord } from '../mappers/types.js';

/**
 * Normalize records from different providers into a unified schema
 */
function normalizeRecord(provider: string, connectionId: string, record: NangoRecord, model: string, recordId?: string): any {
    const externalId = record.id || record['externalId'] || crypto.randomUUID();
    const rawJson = JSON.parse(JSON.stringify(record));

    // Use SHA-256 for content hash as per spec
    const contentHash = crypto.createHash('sha256').update(JSON.stringify(rawJson)).digest('hex');

    // Generate canonical URL using UUID (will be set after record creation if new)
    const canonicalUrl = recordId ? `/item/${recordId}` : '';

    // Get mapper for provider
    const mapper = MAPPERS[provider];

    if (!mapper) {
        console.warn(`No mapper found for provider: ${provider}, using fallback`);
        // Fallback for unknown providers
        return {
            provider,
            connectionId,
            externalId,
            type: model.toLowerCase(),
            title: record['name'] || record['title'] || 'Untitled',
            description: record['description'] || null,
            metadataRaw: rawJson,
            metadataNormalized: {},
            canonicalUrl: canonicalUrl || `/item/temp-${externalId}`,
            sourceUrl: record['url'] || null,
            contentHash,
            mimeType: null,
            state: 'active'
        };
    }

    const normalized = mapper.normalize(record);

    return {
        provider,
        connectionId,
        externalId,
        type: normalized.type,
        title: normalized.title,
        description: normalized.description,
        metadataRaw: rawJson,
        metadataNormalized: normalized.metadataNormalized,
        canonicalUrl: canonicalUrl || `/item/temp-${externalId}`,
        sourceUrl: normalized.sourceUrl,
        contentHash,
        mimeType: normalized.mimeType,
        state: 'active'
    };
}

/**
 * Check if a data type should be synced based on configuration
 */
async function shouldSyncDataType(provider: string, connectionId: string, dataType: string): Promise<boolean> {
    try {
        // Get sync configuration from database
        const config = await db.connectionSyncConfig.findUnique({
            where: {
                connectionId_provider: {
                    connectionId,
                    provider
                }
            }
        });

        if (!config || !config.syncConfig) {
            // No config found, use defaults
            const defaultConfig = getDefaultSyncConfig(provider);
            return defaultConfig[dataType]?.enabled ?? true;
        }

        const syncConfig = config.syncConfig as any;
        return syncConfig[dataType]?.enabled ?? true;
    } catch (error) {
        console.error(`Error checking sync config for ${provider}/${dataType}:`, error);
        // Default to enabled on error
        return true;
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
                const externalId = record.id || record['externalId'] || crypto.randomUUID();

                // Check if record is deleted
                // TODO: Deletion testing needs verification - see TODO.md for details
                // User reported deletions may not be detected reliably. Possible causes:
                // 1. Nango sync may not have track_deletes: true
                // 2. Webhook payload may not include deleted_at field
                // 3. Incremental sync timing issues
                if (record._nango_metadata.deleted_at) {
                    // Mark as deleted (don't delete permanently)
                    await db.unifiedObject.updateMany({
                        where: {
                            provider,
                            externalId
                        },
                        data: {
                            state: 'deleted',
                            updatedAt: new Date()
                        }
                    });
                    console.log(`Marked as deleted: ${provider}/${externalId}`);
                    continue;
                }

                // Check if record already exists
                const existing = await db.unifiedObject.findUnique({
                    where: {
                        provider_externalId: {
                            provider,
                            externalId
                        }
                    }
                });

                // Generate normalized record
                const normalized = normalizeRecord(provider, connectionId, record, model, existing?.id);

                // Check if this data type should be synced
                const shouldSync = await shouldSyncDataType(provider, connectionId, normalized.type);
                if (!shouldSync) {
                    console.log(`Skipping ${normalized.type} - sync disabled for ${provider}`);
                    continue;
                }

                // Hash-based change detection
                if (existing) {
                    if (existing.contentHash === normalized.contentHash) {
                        // No changes, skip processing
                        console.log(`Skipping unchanged record: ${provider}/${externalId}`);
                        continue;
                    }

                    // Update existing record with new canonical URL preserved
                    await db.unifiedObject.update({
                        where: {
                            provider_externalId: {
                                provider,
                                externalId
                            }
                        },
                        data: {
                            ...normalized,
                            canonicalUrl: existing.canonicalUrl, // Preserve existing canonical URL
                            updatedAt: new Date()
                        }
                    });
                    console.log(`Updated record: ${provider}/${externalId}`);
                } else {
                    // Create new record
                    const created = await db.unifiedObject.create({
                        data: normalized
                    });

                    // Check if this is a Google Doc or OneDrive document that should be fetched and summarized
                    const shouldFetchDocument =
                        (provider === 'google-drive' && isGoogleDocument(normalized.mimeType)) ||
                        (provider === 'one-drive' && isOneDriveDocument(provider, normalized.mimeType));

                    let documentSummary: { description: string | null; summary: string | null } | null = null;

                    if (shouldFetchDocument) {
                        try {
                            console.log(`Fetching and summarizing document: ${provider}/${externalId}`);
                            documentSummary = await fetchAndSummarizeDocument(
                                provider,
                                connectionId,
                                externalId,
                                normalized.mimeType,
                                normalized.metadataRaw
                            );
                        } catch (error) {
                            console.error(`Failed to fetch/summarize document ${provider}/${externalId}:`, error);
                        }
                    }

                    // Update canonical URL and optionally add document summary
                    const updateData: any = {
                        canonicalUrl: `/item/${created.id}`
                    };

                    if (documentSummary && documentSummary.summary) {
                        updateData.description = documentSummary.description;
                        updateData.summary = documentSummary.summary;
                        console.log(`Added summary to document: ${provider}/${externalId}`);
                    }

                    await db.unifiedObject.update({
                        where: { id: created.id },
                        data: updateData
                    });
                    console.log(`Created new record: ${provider}/${externalId} -> ${created.id}`);
                }

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


