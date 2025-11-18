import React, { useState, useEffect } from 'react';
import { getSyncConfig, updateSyncConfig } from '../api';
import Spinner from './Spinner';

interface DataTypeConfig {
    key: string;
    label: string;
    description: string;
    enabled: boolean;
    includeInSitemap: boolean;
    comingSoon?: boolean;
}

interface IntegrationSyncConfigProps {
    connectionId: string;
    provider: string;
    providerDisplayName: string;
}

export function IntegrationSyncConfig({ 
    connectionId, 
    provider, 
    providerDisplayName 
}: IntegrationSyncConfigProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [syncConfig, setSyncConfig] = useState<Record<string, DataTypeConfig>>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadConfig();
    }, [connectionId, provider]);

    const loadConfig = async () => {
        try {
            setLoading(true);
            const response = await getSyncConfig(connectionId, provider);
            setSyncConfig(response.syncConfig || {});
            setError(null);
        } catch (err) {
            console.error('Error loading sync config:', err);
            setError('Failed to load configuration');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (dataTypeKey: string, field: 'enabled' | 'includeInSitemap') => {
        const updated = {
            ...syncConfig,
            [dataTypeKey]: {
                ...syncConfig[dataTypeKey],
                [field]: !syncConfig[dataTypeKey][field]
            }
        };

        // If disabling sync, also disable sitemap inclusion
        if (field === 'enabled' && syncConfig[dataTypeKey].enabled) {
            updated[dataTypeKey].includeInSitemap = false;
        }

        setSyncConfig(updated);

        try {
            setSaving(true);
            await updateSyncConfig(connectionId, provider, updated);
            setError(null);
        } catch (err) {
            console.error('Error updating sync config:', err);
            setError('Failed to save configuration');
            // Revert on error
            setSyncConfig(syncConfig);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-4 flex justify-center">
                <Spinner size={1} />
            </div>
        );
    }

    const dataTypes = Object.values(syncConfig);

    if (dataTypes.length === 0) {
        return null;
    }

    return (
        <div className="mt-4 border-t border-gray-200 pt-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">
                Sync Configuration - {providerDisplayName}
            </h4>

            {error && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="space-y-3">
                {dataTypes.map((dataType) => (
                    <div 
                        key={dataType.key} 
                        className={`p-3 rounded-lg border ${
                            dataType.comingSoon 
                                ? 'bg-gray-50 border-gray-200' 
                                : 'bg-white border-gray-200'
                        }`}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-gray-900">
                                        {dataType.label}
                                    </label>
                                    {dataType.comingSoon && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                            Coming Soon
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {dataType.description}
                                </p>
                            </div>

                            {!dataType.comingSoon && (
                                <div className="flex flex-col gap-2 ml-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={dataType.enabled}
                                            onChange={() => handleToggle(dataType.key, 'enabled')}
                                            disabled={saving}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-xs text-gray-700">Sync</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={dataType.includeInSitemap}
                                            onChange={() => handleToggle(dataType.key, 'includeInSitemap')}
                                            disabled={saving || !dataType.enabled}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-xs text-gray-700">Sitemap</span>
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

