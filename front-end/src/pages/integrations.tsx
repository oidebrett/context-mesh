import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Head from 'next/head';
import Link from 'next/link';
import { listConnections } from '../api';
import { GoogleDrivePicker } from '../components/pickers/GoogleDrivePicker';
import { OneDrivePicker } from '../components/pickers/OneDrivePicker';
import { UnifiedBrowser } from '../components/UnifiedBrowser';
import { ProviderCard } from '../components/ProviderCard';
import { IntegrationSyncConfig } from '../components/IntegrationSyncConfig';
import { useGenericProviderConnection } from '../hooks/useGenericProviderConnection';
import { useSupportedProviders } from '../hooks/useSupportedProviders';
import { PROVIDER_METADATA, CATEGORY_LABELS, getAllCategories, getProvidersByCategory } from '../utils';
import Spinner from '../components/Spinner';

export default function IntegrationsPage() {
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    const { data: resConnections, error: connectionsError } = useQuery({
        queryKey: ['connections'],
        queryFn: listConnections
    });

    // Debug logging
    console.log('Connections from API:', resConnections);

    const { supportedProviders, isLoading: providersLoading, error: providersError } = useSupportedProviders();
    const { connectProvider, disconnectProvider, getConnection, isConnected } = useGenericProviderConnection();

    const categories = getAllCategories();

    if (providersLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <Spinner size={2} />
            </div>
        );
    }

    if (connectionsError || providersError) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="text-red-600">Error loading integrations</div>
            </div>
        );
    }

    // Filter providers by selected category
    const filteredProviders = selectedCategory === 'all'
        ? supportedProviders
        : supportedProviders.filter(p => {
            const metadata = PROVIDER_METADATA[p.unique_key];
            return metadata?.category === selectedCategory;
        });

    return (
        <div className="min-h-screen bg-gray-50">
            <Head>
                <title>Integrations - Context Mesh</title>
            </Head>

            <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Integrations</h1>
                    <p className="text-gray-600">
                        Connect your tools and services to sync data into your unified knowledge base
                    </p>
                </div>

                {/* Category Filter */}
                <div className="mb-8 flex flex-wrap gap-2">
                    <button
                        onClick={() => setSelectedCategory('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === 'all'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                            }`}
                    >
                        All Integrations
                    </button>
                    {categories.map((category) => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedCategory === category
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                        >
                            {CATEGORY_LABELS[category]}
                        </button>
                    ))}
                </div>

                {/* Provider Cards Grid */}
                <div className="mb-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredProviders.map((provider) => {
                            const connection = getConnection(provider.unique_key, resConnections?.connections);
                            const connected = isConnected(provider.unique_key, resConnections?.connections);
                            const metadata = PROVIDER_METADATA[provider.unique_key];

                            return (
                                <ProviderCard
                                    key={provider.unique_key}
                                    provider={provider}
                                    connected={connected}
                                    onConnect={() => connectProvider(provider.unique_key)}
                                    onDisconnect={() => disconnectProvider(provider.unique_key, connection?.connection_id)}
                                >
                                    {/* File Picker for storage providers */}
                                    {metadata?.supportsFilePicker && connected && connection && (
                                        <>
                                            {provider.unique_key === 'google-drive' && (
                                                <GoogleDrivePicker
                                                    connectionId={String(connection.connection_id)}
                                                    onFilesSelected={() => window.location.reload()}
                                                />
                                            )}
                                            {(provider.unique_key === 'one-drive' || provider.unique_key === 'one-drive-personal') && (
                                                <OneDrivePicker
                                                    provider={provider.unique_key as any}
                                                    onFilesSelected={() => window.location.reload()}
                                                />
                                            )}
                                        </>
                                    )}

                                    {/* Nango Setup Warning */}
                                    {metadata?.requiresNangoSetup && !connected && (
                                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                                            <Link
                                                href="https://app.nango.dev/dev/integrations"
                                                target="_blank"
                                                className="underline hover:text-yellow-900"
                                            >
                                                Configure in Nango Cloud first
                                            </Link>
                                        </div>
                                    )}

                                    {/* Sync Configuration */}
                                    {connected && connection && (
                                        <IntegrationSyncConfig
                                            connectionId={String(connection.connection_id)}
                                            provider={provider.unique_key}
                                            providerDisplayName={provider.display_name}
                                        />
                                    )}
                                </ProviderCard>
                            );
                        })}
                    </div>
                </div>

                {/* Unified Browser - shows all synced data */}
                {resConnections?.connections && resConnections.connections.length > 0 && (
                    <div className="mt-12">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Synced Data</h2>
                        <p className="text-gray-600 mb-6">
                            Browse all synced items across all connected integrations
                        </p>
                        <UnifiedBrowser connections={resConnections.connections} />
                    </div>
                )}
            </div>
        </div>
    );
}

