import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { baseUrl } from '../utils';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Spinner from '../components/Spinner';
import { listConnections, listIntegrations, getFiles, getBackendStatus, getUnifiedObjects } from '../api';
import type { Integration } from '../types';

export default function IndexPage() {
    const router = useRouter();
    const { data: resIntegrations } = useQuery({
        queryKey: ['integrations'],
        queryFn: listIntegrations
    });
    const { data: resConnections } = useQuery({
        queryKey: ['connections'],
        queryFn: listConnections
    });
    const { data: unifiedObjects } = useQuery({
        queryKey: ['unifiedObjects'],
        queryFn: () => getUnifiedObjects()
    });
    const { data: backendStatus } = useQuery({
        queryKey: ['backendStatus'],
        queryFn: getBackendStatus
    });

    const queryClient = useQueryClient();



    const integrations = useMemo<Integration[] | undefined>(() => {
        if (!resIntegrations || !resConnections) {
            return;
        }

        return resIntegrations.integrations.map((integration) => {
            return {
                ...integration,
                connected:
                    resConnections.connections.find((connection) => {
                        return connection.provider_config_key === integration.unique_key;
                    }) !== undefined
            };
        });
    }, [resIntegrations, resConnections]);

    const connectedCount = integrations?.filter(i => i.connected).length || 0;
    const totalCount = integrations?.length || 0;
    const syncedItemsCount = unifiedObjects?.objects?.length || 0;
    const isBackendHealthy = backendStatus?.root === true;

    const stats = useMemo(() => {
        return {
            totalItems: syncedItemsCount,
        };
    }, [syncedItemsCount]);

    const health = useMemo(() => {
        if (!backendStatus) {
            return { status: 'unknown', version: 'Unknown' };
        }
        return {
            status: backendStatus.root ? 'ok' : 'error',
            version: 'Unknown', // backendStatus doesn't have version field
        };
    }, [backendStatus]);

    if (!integrations) {
        return (
            <main className="p-4 md:p-10 mx-auto max-w-7xl">
                <Spinner size={2} />
            </main>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <div className="flex-shrink-0 flex items-center">
                                <span className="text-xl font-bold text-gray-800">Context Mesh</span>
                            </div>
                            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                                <span className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                    Dashboard
                                </span>
                                <Link href="/integrations" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                    Integrations
                                </Link>
                                <Link href="/browser" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                    Data Browser
                                </Link>
                                <Link href="/mappings" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                    Mappings
                                </Link>
                            </div>
                        </div>
                        <div className="flex items-center">
                            <span className="text-sm text-gray-500 mr-4">
                                {backendStatus?.root ? 'Backend Connected' : 'Backend Disconnected'}
                            </span>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="py-10">
                <header>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <h1 className="text-3xl font-bold leading-tight text-gray-900">
                            Dashboard
                        </h1>
                    </div>
                </header>
                <main>
                    <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                        {/* Stats Grid */}
                        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {/* Connections Card */}
                            <div className="bg-white overflow-hidden shadow rounded-lg">
                                <div className="p-5">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0">
                                            <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                        </div>
                                        <div className="ml-5 w-0 flex-1">
                                            <dl>
                                                <dt className="text-sm font-medium text-gray-500 truncate">
                                                    Active Connections
                                                </dt>
                                                <dd>
                                                    <div className="text-lg font-medium text-gray-900">
                                                        {resConnections?.connections?.length || 0}
                                                    </div>
                                                </dd>
                                            </dl>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-5 py-3">
                                    <div className="text-sm">
                                        <Link href="/integrations" className="font-medium text-indigo-600 hover:text-indigo-500">
                                            Manage integrations
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Synced Items Card */}
                            <div className="bg-white overflow-hidden shadow rounded-lg">
                                <div className="p-5">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0">
                                            <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                            </svg>
                                        </div>
                                        <div className="ml-5 w-0 flex-1">
                                            <dl>
                                                <dt className="text-sm font-medium text-gray-500 truncate">
                                                    Synced Items
                                                </dt>
                                                <dd>
                                                    <div className="text-lg font-medium text-gray-900">
                                                        {stats?.totalItems || 0}
                                                    </div>
                                                </dd>
                                            </dl>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-5 py-3">
                                    <div className="text-sm">
                                        <Link href="/browser" className="font-medium text-indigo-600 hover:text-indigo-500">
                                            View data browser
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Backend Status Card */}
                            <div className="bg-white overflow-hidden shadow rounded-lg">
                                <div className="p-5">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0">
                                            <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                                            </svg>
                                        </div>
                                        <div className="ml-5 w-0 flex-1">
                                            <dl>
                                                <dt className="text-sm font-medium text-gray-500 truncate">
                                                    Backend Status
                                                </dt>
                                                <dd>
                                                    <div className="flex items-center">
                                                        <div className={`h-2.5 w-2.5 rounded-full mr-2 ${health?.status === 'ok' ? 'bg-green-400' : 'bg-red-400'}`}></div>
                                                        <span className="text-lg font-medium text-gray-900">
                                                            {health?.status === 'ok' ? 'Online' : 'Offline'}
                                                        </span>
                                                    </div>
                                                </dd>
                                            </dl>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-5 py-3">
                                    <div className="text-sm">
                                        <span className="text-gray-500">
                                            Version {health?.version || 'Unknown'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="mt-8">
                            <h2 className="text-lg leading-6 font-medium text-gray-900 mb-4">Quick Actions</h2>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <Link href="/integrations" className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                    <div className="flex-shrink-0">
                                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                                            <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="absolute inset-0" aria-hidden="true" />
                                        <p className="text-sm font-medium text-gray-900">Connect New Service</p>
                                        <p className="text-sm text-gray-500 truncate">Add a new integration source</p>
                                    </div>
                                </Link>

                                <Link href="/browser" className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                    <div className="flex-shrink-0">
                                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                                            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="absolute inset-0" aria-hidden="true" />
                                        <p className="text-sm font-medium text-gray-900">Browse Data</p>
                                        <p className="text-sm text-gray-500 truncate">Search and view synced items</p>
                                    </div>
                                </Link>

                                <div className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center space-x-3">
                                            <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                                                <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">Sitemap</p>
                                                <p className="text-xs text-gray-500">For RAG crawlers</p>
                                            </div>
                                        </div>
                                        <div className="flex space-x-1">
                                            <button
                                                onClick={() => {
                                                    const url = `${baseUrl}/sitemap.xml`;
                                                    navigator.clipboard.writeText(url);
                                                    alert('Sitemap URL copied to clipboard!');
                                                }}
                                                className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                                                title="Copy URL"
                                            >
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                            <a
                                                href={`${baseUrl}/sitemap.xml`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                                                title="Open in new tab"
                                            >
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center space-x-3">
                                            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                                                <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">RSS Feed</p>
                                                <p className="text-xs text-gray-500">Subscribe to updates</p>
                                            </div>
                                        </div>
                                        <div className="flex space-x-1">
                                            <button
                                                onClick={() => {
                                                    const url = `${baseUrl}/rss.xml`;
                                                    navigator.clipboard.writeText(url);
                                                    alert('RSS Feed URL copied to clipboard!');
                                                }}
                                                className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                                                title="Copy URL"
                                            >
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                            <a
                                                href={`${baseUrl}/rss.xml`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                                                title="Open in new tab"
                                            >
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
