import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Spinner from '../components/Spinner';
import { listConnections, listIntegrations } from '../api';
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

    if (!integrations) {
        return (
            <main className="p-4 md:p-10 mx-auto max-w-7xl">
                <Spinner size={2} />
            </main>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="flex-1 px-6 py-12 overflow-auto">
                <div className="max-w-6xl mx-auto">
                    {/* Hero Section */}
                    <div className="text-center mb-16">
                        <h1 className="text-5xl font-bold text-gray-900 mb-4">
                            Context Mesh
                        </h1>
                        <p className="text-xl text-gray-600 mb-2">
                            Cloud Integration Hub for AI & RAG Systems
                        </p>
                        <p className="text-sm text-gray-500 max-w-3xl mx-auto">
                            Unified data synchronization platform that aggregates content from cloud services
                            (Google Drive, Salesforce, Zoho CRM, GitHub, Slack, etc.) and exposes it via Schema.org-compliant
                            metadata for downstream AI/RAG ingestion
                        </p>
                    </div>

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

                        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Sitemap Status</p>
                                    <p className="text-lg font-semibold text-green-600 mt-2">Active</p>
                                </div>
                                <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Sync Mode</p>
                                    <p className="text-lg font-semibold text-purple-600 mt-2">Real-time</p>
                                </div>
                                <svg className="w-12 h-12 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Key Features */}
                    <div className="bg-white rounded-lg shadow-md p-8 mb-12">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Key Features</h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="flex gap-4">
                                <div className="flex-shrink-0">
                                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-1">Multi-Provider Sync</h3>
                                    <p className="text-sm text-gray-600">Connects to Google Drive, Salesforce, Zoho CRM, GitHub, Slack, OneDrive, Google Calendar, and more via Nango OAuth</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-shrink-0">
                                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-1">Schema.org Metadata</h3>
                                    <p className="text-sm text-gray-600">Generates JSON-LD metadata for each synced object with normalized fields for AI consumption</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-shrink-0">
                                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-1">Sitemap Generation</h3>
                                    <p className="text-sm text-gray-600">Auto-generates sitemap.xml for RAG crawlers to discover and index synced content</p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-shrink-0">
                                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                                        <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-1">Soft Delete & Change Detection</h3>
                                    <p className="text-sm text-gray-600">SHA-256 content hashing for change detection, soft deletes preserve audit trail</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid md:grid-cols-2 gap-6">
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
                    </div>
                </div>
            </div>
        </div>
    );
}
