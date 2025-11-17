/**
 * Service for managing data type sync configurations
 * Defines which data types are available per provider and manages sync preferences
 */

export interface DataTypeConfig {
    key: string;
    label: string;
    description: string;
    enabled: boolean;
    includeInSitemap: boolean;
    comingSoon?: boolean;
}

export interface ProviderDataTypes {
    provider: string;
    displayName: string;
    dataTypes: DataTypeConfig[];
}

/**
 * Define available data types per provider
 * This is the source of truth for what can be synced
 */
export const PROVIDER_DATA_TYPES: Record<string, ProviderDataTypes> = {
    'google-drive': {
        provider: 'google-drive',
        displayName: 'Google Drive',
        dataTypes: [
            {
                key: 'files',
                label: 'Files & Documents',
                description: 'Sync Google Drive files and folders',
                enabled: true,
                includeInSitemap: true
            }
        ]
    },
    'slack': {
        provider: 'slack',
        displayName: 'Slack',
        dataTypes: [
            {
                key: 'users',
                label: 'Users',
                description: 'Sync Slack workspace users',
                enabled: true,
                includeInSitemap: true
            },
            {
                key: 'channels',
                label: 'Channels',
                description: 'Sync public channels',
                enabled: false,
                includeInSitemap: false,
                comingSoon: true
            }
        ]
    },
    'salesforce': {
        provider: 'salesforce',
        displayName: 'Salesforce',
        dataTypes: [
            {
                key: 'accounts',
                label: 'Accounts',
                description: 'Sync Salesforce accounts',
                enabled: true,
                includeInSitemap: true
            },
            {
                key: 'contacts',
                label: 'Contacts',
                description: 'Sync Salesforce contacts',
                enabled: true,
                includeInSitemap: true
            },
            {
                key: 'opportunities',
                label: 'Opportunities',
                description: 'Sync sales opportunities',
                enabled: false,
                includeInSitemap: false,
                comingSoon: true
            }
        ]
    },
    'zoho-crm': {
        provider: 'zoho-crm',
        displayName: 'Zoho CRM',
        dataTypes: [
            {
                key: 'accounts',
                label: 'Accounts',
                description: 'Sync Zoho CRM accounts',
                enabled: true,
                includeInSitemap: true
            },
            {
                key: 'contacts',
                label: 'Contacts',
                description: 'Sync Zoho CRM contacts',
                enabled: true,
                includeInSitemap: true
            }
        ]
    },
    'workday': {
        provider: 'workday',
        displayName: 'Workday',
        dataTypes: [
            {
                key: 'employees',
                label: 'Employees',
                description: 'Sync employee directory',
                enabled: true,
                includeInSitemap: true
            }
        ]
    },
    'github': {
        provider: 'github',
        displayName: 'GitHub',
        dataTypes: [
            {
                key: 'repositories',
                label: 'Repositories',
                description: 'Sync GitHub repositories',
                enabled: true,
                includeInSitemap: true
            },
            {
                key: 'issues',
                label: 'Issues',
                description: 'Sync repository issues',
                enabled: false,
                includeInSitemap: false,
                comingSoon: true
            }
        ]
    },
    'google-calendar': {
        provider: 'google-calendar',
        displayName: 'Google Calendar',
        dataTypes: [
            {
                key: 'events',
                label: 'Events',
                description: 'Sync calendar events',
                enabled: true,
                includeInSitemap: false // Events typically shouldn't be in sitemap
            }
        ]
    }
};

/**
 * Get default sync configuration for a provider
 */
export function getDefaultSyncConfig(provider: string): Record<string, DataTypeConfig> {
    const providerConfig = PROVIDER_DATA_TYPES[provider];
    if (!providerConfig) {
        return {};
    }

    const config: Record<string, DataTypeConfig> = {};
    for (const dataType of providerConfig.dataTypes) {
        config[dataType.key] = { ...dataType };
    }
    return config;
}

