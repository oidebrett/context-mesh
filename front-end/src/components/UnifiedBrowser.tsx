import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUnifiedObjects } from '../api';
import { baseUrl } from '../utils';
import Spinner from './Spinner';

interface UnifiedObject {
    id: string;
    externalId: string;
    provider: string;
    connectionId: string;
    type: string;
    title: string;
    description?: string;
    canonicalUrl: string;
    sourceUrl?: string;
    state: string;
    mimeType?: string;
    metadataNormalized?: any;
    createdAt: string;
    updatedAt: string;
}

interface UnifiedBrowserProps {
    connections: any[];
}

export function UnifiedBrowser({ connections }: UnifiedBrowserProps) {
    const [selectedType, setSelectedType] = useState<string>('all');
    const [selectedProvider, setSelectedProvider] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const { data: resObjects, isLoading, error } = useQuery({
        queryKey: ['unified-objects'],
        queryFn: () => getUnifiedObjects()
    });

    const filteredObjects = useMemo(() => {
        if (!resObjects?.objects) return [];

        let filtered = resObjects.objects;

        if (selectedType !== 'all') {
            filtered = filtered.filter((obj: UnifiedObject) => obj.type === selectedType);
        }

        if (selectedProvider !== 'all') {
            filtered = filtered.filter((obj: UnifiedObject) => obj.provider === selectedProvider);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter((obj: UnifiedObject) =>
                obj.title?.toLowerCase().includes(query) ||
                obj.description?.toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [resObjects, selectedType, selectedProvider, searchQuery]);

    const typeLabels: Record<string, string> = {
        'file': 'Files',
        'folder': 'Folders',
        'document': 'Documents',
        'contact': 'Contacts',
        'account': 'Accounts',
        'employee': 'Employees',
        'user': 'Users',
        'event': 'Events',
        'repository': 'Repositories',
        'issue': 'Issues'
    };

    const getTypeLabel = (type: string) => typeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1);

    const getProviderLabel = (provider: string) => {
        const labels: Record<string, string> = {
            'google-drive': 'Google Drive',
            'slack': 'Slack',
            'salesforce': 'Salesforce',
            'zoho-crm': 'Zoho CRM',
            'workday': 'Workday',
            'github': 'GitHub',
            'google-calendar': 'Google Calendar'
        };
        return labels[provider] || provider;
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Spinner size={2} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <p className="text-red-600">Error loading objects</p>
            </div>
        );
    }

    const availableTypes = resObjects?.filters?.availableTypes || [];
    const availableProviders = resObjects?.filters?.availableProviders || [];

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Type Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Type
                        </label>
                        <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Types</option>
                            {availableTypes.map((type: string) => (
                                <option key={type} value={type}>
                                    {getTypeLabel(type)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Provider Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Provider
                        </label>
                        <select
                            value={selectedProvider}
                            onChange={(e) => setSelectedProvider(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Providers</option>
                            {availableProviders.map((provider: string) => (
                                <option key={provider} value={provider}>
                                    {getProviderLabel(provider)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Search */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Search
                        </label>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by title or description..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Results Count */}
            <div className="text-sm text-gray-600">
                Showing {filteredObjects.length} {filteredObjects.length === 1 ? 'item' : 'items'}
            </div>

            {/* Objects Table */}
            {filteredObjects.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <p className="text-gray-500">No items found</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Title
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Type
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Provider
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Updated
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredObjects.map((obj: UnifiedObject) => (
                                    <tr key={obj.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                                                {obj.title || 'Untitled'}
                                            </div>
                                            {obj.description && (
                                                <div className="text-xs text-gray-500 truncate max-w-xs">
                                                    {obj.description}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                {getTypeLabel(obj.type)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-900">
                                                {getProviderLabel(obj.provider)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(obj.updatedAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="flex gap-2">
                                                <a
                                                    href={`${baseUrl}${obj.canonicalUrl}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:text-blue-800"
                                                >
                                                    View
                                                </a>
                                                {obj.sourceUrl && (
                                                    <a
                                                        href={obj.sourceUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-gray-600 hover:text-gray-800"
                                                    >
                                                        Source
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

