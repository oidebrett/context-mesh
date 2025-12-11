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
    const { data: files } = useQuery({
        queryKey: ['files'],
        queryFn: getFiles
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
    const filesCount = files?.length || 0;
    const isBackendHealthy = backendStatus?.root === true;

    if (!integrations) {
        return (
            <main className="p-4 md:p-10 mx-auto max-w-7xl">
                <Spinner size={2} />
            </main>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="flex-1 px-4 sm:px-6 py-8 overflow-auto w-full">
                <div className="max-w-5xl mx-auto">

                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                        <p className="text-gray-600 mt-2 max-w-3xl">
                            Context Mesh aggregates content from your connected cloud services (Google Drive, Slack, etc.) and exposes it for AI/RAG systems.
                        </p>
                    </div>

                    <nav className="bg-white shadow-sm mb-8">
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

                    {/* Status Cards */}
                    <div className="grid md:grid-cols-3 gap-6 mb-12">
                        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Connected Integrations</p>
                                    <p className="text-3xl font-bold text-gray-900 mt-2">{connectedCount}/{totalCount}</p>
                                </div>
                                <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Synced Resources</p>
                                    <p className="text-3xl font-bold text-gray-900 mt-2">{filesCount}</p>
                                </div>
                                <svg className="w-12 h-12 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                        </div>

                        <div className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${isBackendHealthy ? 'border-green-500' : 'border-red-500'}`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Backend Status</p>
                                    <p className={`text-xl font-bold mt-2 ${isBackendHealthy ? 'text-green-600' : 'text-red-600'}`}>
                                        {isBackendHealthy ? 'Healthy' : 'Unhealthy'}
                                    </p>
                                </div>
                                <svg className={`w-12 h-12 ${isBackendHealthy ? 'text-green-500' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid md:grid-cols-3 gap-6">
                        <button
                            onClick={() => router.push('/integrations')}
                            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow text-left group"
                        >
                            <div className="flex items-center gap-4 mb-3">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                    <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900">Manage Integrations</h3>
                            </div>
                            <p className="text-gray-600">Connect new cloud services, configure sync settings, and manage OAuth connections</p>
                        </button>

                        <a
                            href="http://localhost:3010/sitemap.xml"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow text-left group"
                        >
                            <div className="flex items-center gap-4 mb-3">
                                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                                    <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900">View Sitemap</h3>
                            </div>
                            <p className="text-gray-600">Access the generated sitemap.xml for RAG crawler integration</p>
                        </a>

                        <a
                            href="http://localhost:3010/rss.xml"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow text-left group"
                        >
                            <div className="flex items-center gap-4 mb-3">
                                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                                    <svg className="w-7 h-7 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900">RSS Feed</h3>
                            </div>
                            <p className="text-gray-600">Subscribe to updates via RSS feed</p>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
