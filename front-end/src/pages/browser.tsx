import { useQuery } from '@tanstack/react-query';
import Head from 'next/head';
import Link from 'next/link';
import { listConnections } from '../api';
import { UnifiedBrowser } from '../components/UnifiedBrowser';
import Spinner from '../components/Spinner';

export default function BrowserPage() {
    const { data: resConnections, error, isLoading } = useQuery({
        queryKey: ['connections'],
        queryFn: listConnections
    });

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <Spinner size={2} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="text-red-600">Error loading connections</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Head>
                <title>Data Browser - Context Mesh</title>
            </Head>



            <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Browser</h1>
                        <p className="text-gray-600">
                            Browse and search all synced items across your connected integrations.
                        </p>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        title="Refresh data"
                    >
                        <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                </div>

                {resConnections?.connections && resConnections.connections.length > 0 ? (
                    <div className="bg-white shadow rounded-lg p-6">
                        <UnifiedBrowser connections={resConnections.connections} />
                    </div>
                ) : (
                    <div className="text-center py-12 bg-white shadow rounded-lg">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No connections found</h3>
                        <p className="mt-1 text-sm text-gray-500">Get started by connecting a new integration.</p>
                        <div className="mt-6">
                            <Link href="/integrations" className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                                Go to Integrations
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
