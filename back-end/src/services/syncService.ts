import { nango } from '../nango.js';
import { db } from '../db.js';
import crypto from 'crypto';
import { getDefaultSyncConfig } from './dataTypeConfigService.js';

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
function normalizeRecord(provider: string, connectionId: string, record: NangoRecord, model: string, recordId?: string): any {
    const externalId = record.id || record['externalId'] || crypto.randomUUID();
    const rawJson = JSON.parse(JSON.stringify(record));

    // Use SHA-256 for content hash as per spec
    const contentHash = crypto.createHash('sha256').update(JSON.stringify(rawJson)).digest('hex');

    // Generate canonical URL using UUID (will be set after record creation if new)
    const canonicalUrl = recordId ? `/item/${recordId}` : '';

    let type: string;
    let title: string;
    let description: string | null = null;
    let sourceUrl: string | null = null;
    let mimeType: string | null = null;
    let metadataNormalized: any = {};

    // Provider-specific normalization
    switch (provider) {
        case 'google-drive':
            type = 'file';
            title = record['title'] || record['name'] || 'Untitled';
            description = record['description'] || null;
            sourceUrl = record['url'] || record['webViewLink'] || null;
            mimeType = record['mimeType'] || null;
            metadataNormalized = {
                fileName: title,
                mimeType,
                size: record['size'] || null,
                modifiedTime: record['modifiedTime'] || record['updatedAt'] || null
            };
            break;

        case 'slack':
            type = 'contact';
            title = record['profile']?.['display_name'] || record['name'] || 'Unnamed User';
            description = record['profile']?.['real_name'] || null;
            sourceUrl = null; // Slack doesn't provide direct user URLs
            metadataNormalized = {
                email: record['profile']?.['email'] || null,
                avatar: record['profile']?.['image_original'] || null,
                isBot: record['is_bot'] || false,
                teamId: record['team_id'] || null
            };
            break;

        case 'zoho-crm':
            // Handle both 'ZohoCRMAccount' and 'Account' model names
            // Zoho CRM often returns objects for fields like {name: "...", id: "..."}
            // We need to extract the string value
            const extractZohoValue = (field: any): string | null => {
                if (!field) return null;
                if (typeof field === 'string') return field;
                if (typeof field === 'object' && field.name) return field.name;
                return null;
            };

            if (model.toLowerCase().includes('account')) {
                type = 'account';
                title = extractZohoValue(record['Account_Name']) || record['name'] || 'Untitled';
                description = extractZohoValue(record['Description']) || null;

                // Construct deep link URL to Zoho CRM
                // Format: https://crm.zoho.{domain}/crm/{orgId}/tab/Accounts/{recordId}
                const zohoDomain = process.env['ZOHO_CRM_DOMAIN'] || 'com'; // Default to .com
                const zohoOrgId = process.env['ZOHO_CRM_ORG_ID'] || '';
                sourceUrl = zohoOrgId
                    ? `https://crm.zoho.${zohoDomain}/crm/${zohoOrgId}/tab/Accounts/${record.id}`
                    : null;

                metadataNormalized = {
                    industry: extractZohoValue(record['Industry']) || null,
                    phone: extractZohoValue(record['Phone']) || null,
                    website: extractZohoValue(record['Website']) || null,
                    owner: record['Owner'] || null,
                    zohoId: record.id
                };
            } else if (model.toLowerCase().includes('contact')) {
                type = 'contact';
                title = extractZohoValue(record['Full_Name']) || record['name'] || 'Untitled';
                description = extractZohoValue(record['Description']) || null;

                // Construct deep link URL to Zoho CRM
                const zohoDomain = process.env['ZOHO_CRM_DOMAIN'] || 'com';
                const zohoOrgId = process.env['ZOHO_CRM_ORG_ID'] || '';
                sourceUrl = zohoOrgId
                    ? `https://crm.zoho.${zohoDomain}/crm/${zohoOrgId}/tab/Contacts/${record.id}`
                    : null;

                metadataNormalized = {
                    email: extractZohoValue(record['Email']) || null,
                    phone: extractZohoValue(record['Phone']) || null,
                    account: extractZohoValue(record['Account_Name']) || null,
                    owner: record['Owner'] || null,
                    zohoId: record.id
                };
            } else if (model.toLowerCase().includes('deal')) {
                // Handle Deals/Opportunities
                type = 'deal';
                title = extractZohoValue(record['Deal_Name']) || record['name'] || 'Untitled';
                description = extractZohoValue(record['Description']) || null;

                const zohoDomain = process.env['ZOHO_CRM_DOMAIN'] || 'com';
                const zohoOrgId = process.env['ZOHO_CRM_ORG_ID'] || '';
                sourceUrl = zohoOrgId
                    ? `https://crm.zoho.${zohoDomain}/crm/${zohoOrgId}/tab/Deals/${record.id}`
                    : null;

                metadataNormalized = {
                    amount: record['Amount'] || null,
                    stage: extractZohoValue(record['Stage']) || null,
                    closingDate: record['Closing_Date'] || null,
                    account: extractZohoValue(record['Account_Name']) || null,
                    owner: record['Owner'] || null,
                    zohoId: record.id
                };
            } else {
                type = 'contact';
                title = extractZohoValue(record['Full_Name']) || extractZohoValue(record['Account_Name']) || extractZohoValue(record['Subject']) || 'Untitled';
                description = extractZohoValue(record['Description']) || null;
                sourceUrl = null;
                metadataNormalized = {
                    email: extractZohoValue(record['Email']) || null,
                    phone: extractZohoValue(record['Phone']) || null,
                    owner: record['Owner'] || null,
                    zohoId: record.id
                };
            }
            break;

        case 'github':
        case 'github-getting-started':
            // Handle both 'GithubRepo' and 'GithubIssue' model names
            if (model.toLowerCase().includes('issue')) {
                type = 'issue';
                title = record['title'] || 'Untitled';
                description = record['body'] || null;
                sourceUrl = record['html_url'] || null;
                metadataNormalized = {
                    state: record['state'] || 'open',
                    number: record['number'] || null,
                    author: record['user']?.['login'] || null,
                    repository: record['repository']?.['full_name'] || null
                };
            } else if (model.toLowerCase().includes('repo') || record['full_name']) {
                type = 'repository';
                title = record['full_name'] || record['name'] || 'Untitled';
                description = record['description'] || null;
                sourceUrl = record['html_url'] || null;
                metadataNormalized = {
                    stars: record['stargazers_count'] || 0,
                    language: record['language'] || null,
                    isPrivate: record['private'] || false
                };
            } else {
                type = 'repository';
                title = record['name'] || 'Untitled';
                description = record['description'] || null;
                sourceUrl = record['html_url'] || null;
                metadataNormalized = {};
            }
            break;

        case 'google-calendar':
        case 'google-calendar-getting-started':
            type = 'event';
            title = record['summary'] || 'Untitled Event';
            description = record['description'] || null;
            sourceUrl = record['htmlLink'] || null;
            metadataNormalized = {
                start: record['start'] || null,
                end: record['end'] || null,
                location: record['location'] || null,
                attendees: record['attendees'] || []
            };
            break;

        case 'salesforce':
            // Salesforce uses standard object names like Account, Contact, Opportunity
            if (model.toLowerCase().includes('account')) {
                type = 'account';
                title = record['Name'] || 'Untitled';
                description = record['Description'] || null;

                // Construct deep link URL to Salesforce
                // Format: https://{instance}.salesforce.com/{recordId}
                const salesforceInstance = process.env['SALESFORCE_INSTANCE_URL'] || '';
                sourceUrl = salesforceInstance
                    ? `${salesforceInstance}/${record['Id'] || record.id}`
                    : null;

                metadataNormalized = {
                    industry: record['Industry'] || null,
                    phone: record['Phone'] || null,
                    website: record['Website'] || null,
                    owner: record['Owner'] || null,
                    salesforceId: record['Id'] || record.id
                };
            } else if (model.toLowerCase().includes('contact')) {
                type = 'contact';
                title = record['Name'] || `${record['FirstName'] || ''} ${record['LastName'] || ''}`.trim() || 'Untitled';
                description = record['Description'] || null;

                const salesforceInstance = process.env['SALESFORCE_INSTANCE_URL'] || '';
                sourceUrl = salesforceInstance
                    ? `${salesforceInstance}/${record['Id'] || record.id}`
                    : null;

                metadataNormalized = {
                    email: record['Email'] || null,
                    phone: record['Phone'] || null,
                    account: record['Account']?.['Name'] || null,
                    owner: record['Owner'] || null,
                    salesforceId: record['Id'] || record.id
                };
            } else if (model.toLowerCase().includes('opportunity')) {
                type = 'opportunity';
                title = record['Name'] || 'Untitled';
                description = record['Description'] || null;

                const salesforceInstance = process.env['SALESFORCE_INSTANCE_URL'] || '';
                sourceUrl = salesforceInstance
                    ? `${salesforceInstance}/${record['Id'] || record.id}`
                    : null;

                metadataNormalized = {
                    amount: record['Amount'] || null,
                    stage: record['StageName'] || null,
                    closeDate: record['CloseDate'] || null,
                    account: record['Account']?.['Name'] || null,
                    owner: record['Owner'] || null,
                    salesforceId: record['Id'] || record.id
                };
            } else {
                type = model.toLowerCase();
                title = record['Name'] || record['Title'] || 'Untitled';
                description = record['Description'] || null;

                const salesforceInstance = process.env['SALESFORCE_INSTANCE_URL'] || '';
                sourceUrl = salesforceInstance
                    ? `${salesforceInstance}/${record['Id'] || record.id}`
                    : null;

                metadataNormalized = {
                    salesforceId: record['Id'] || record.id
                };
            }
            break;

        default:
            type = model.toLowerCase();
            title = record['name'] || record['title'] || record['subject'] || 'Untitled';
            description = record['description'] || record['body'] || null;
            sourceUrl = record['url'] || record['link'] || null;
            mimeType = record['mimeType'] || record['mime_type'] || null;
            metadataNormalized = {};
            break;
    }

    return {
        provider,
        connectionId,
        externalId,
        type,
        title,
        description,
        metadataRaw: rawJson,
        metadataNormalized,
        canonicalUrl: canonicalUrl || `/item/temp-${externalId}`, // Temporary, will be updated
        sourceUrl,
        contentHash,
        mimeType,
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

                    // Update canonical URL with the actual UUID
                    await db.unifiedObject.update({
                        where: { id: created.id },
                        data: {
                            canonicalUrl: `/item/${created.id}`
                        }
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


