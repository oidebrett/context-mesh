import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Head from 'next/head';
import Link from 'next/link';
import { scanMCPServers, quickScanMCPServers, type MCPScanResult, type DiscoveredMCPServer } from '../api';
import Spinner from '../components/Spinner';

type ScanMode = 'quick' | 'local' | 'custom';

export default function MCPScannerPage() {
    const [scanMode, setScanMode] = useState<ScanMode>('quick');
    const [customTarget, setCustomTarget] = useState('');
    const [scanResult, setScanResult] = useState<MCPScanResult | null>(null);

    const scanMutation = useMutation({
        mutationFn: async () => {
            if (scanMode === 'quick') {
                return quickScanMCPServers();
            } else if (scanMode === 'local') {
                return scanMCPServers('local');
            } else {
                return scanMCPServers(customTarget);
            }
        },
        onSuccess: (result) => {
            setScanResult(result);
        }
    });

    const getTypeLabel = (type: DiscoveredMCPServer['type']) => {
        switch (type) {
            case 'sse': return 'SSE';
            case 'streamable-http': return 'Streamable HTTP';
            default: return 'Unknown';
        }
    };

    const getTypeBadgeColor = (type: DiscoveredMCPServer['type']) => {
        switch (type) {
            case 'sse': return 'bg-purple-100 text-purple-800';
            case 'streamable-http': return 'bg-blue-100 text-blue-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const unprotectedServers = scanResult?.discoveredServers.filter(s => !s.requiresAuth) || [];
    const protectedServers = scanResult?.discoveredServers.filter(s => s.requiresAuth) || [];

    return (
        <div className="min-h-screen bg-gray-50">
            <Head>
                <title>MCP Scanner - Context Mesh</title>
            </Head>

            <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">MCP Server Scanner</h1>
                    <p className="text-gray-600">
                        Discover unprotected MCP servers on your network. Find SSE and Streamable HTTP endpoints that may need authentication.
                    </p>
                </div>

                {/* Scan Configuration */}
                <div className="bg-white shadow rounded-lg p-6 mb-8">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Scan Configuration</h2>

                    {/* Scan Mode Selection */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3">Scan Mode</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <button
                                onClick={() => setScanMode('quick')}
                                className={`p-4 border-2 rounded-lg text-left transition-colors ${scanMode === 'quick'
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className="flex items-center mb-2">
                                    <svg className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <span className="font-medium">Quick Scan</span>
                                </div>
                                <p className="text-sm text-gray-500">
                                    Scan localhost only. Fast check for local MCP servers.
                                </p>
                            </button>

                            <button
                                onClick={() => setScanMode('local')}
                                className={`p-4 border-2 rounded-lg text-left transition-colors ${scanMode === 'local'
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className="flex items-center mb-2">
                                    <svg className="h-5 w-5 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                    </svg>
                                    <span className="font-medium">Local Network</span>
                                </div>
                                <p className="text-sm text-gray-500">
                                    Scan your local /24 network range for MCP servers.
                                </p>
                            </button>

                            <button
                                onClick={() => setScanMode('custom')}
                                className={`p-4 border-2 rounded-lg text-left transition-colors ${scanMode === 'custom'
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <div className="flex items-center mb-2">
                                    <svg className="h-5 w-5 mr-2 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span className="font-medium">Custom Target</span>
                                </div>
                                <p className="text-sm text-gray-500">
                                    Scan specific IP, domain, or CIDR range.
                                </p>
                            </button>
                        </div>
                    </div>

                    {/* Custom Target Input */}
                    {scanMode === 'custom' && (
                        <div className="mb-6">
                            <label htmlFor="target" className="block text-sm font-medium text-gray-700 mb-2">
                                Target
                            </label>
                            <input
                                type="text"
                                id="target"
                                value={customTarget}
                                onChange={(e) => setCustomTarget(e.target.value)}
                                placeholder="e.g., 192.168.1.0/24, example.com, or *.example.com"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="mt-2 text-sm text-gray-500">
                                Enter an IP address, CIDR range (/24 or larger), domain name, or subdomain pattern (*.example.com)
                            </p>
                        </div>
                    )}

                    {/* Scan Button */}
                    <button
                        onClick={() => scanMutation.mutate()}
                        disabled={scanMutation.isPending || (scanMode === 'custom' && !customTarget)}
                        className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {scanMutation.isPending ? (
                            <>
                                <Spinner size={1} />
                                <span className="ml-2">Scanning...</span>
                            </>
                        ) : (
                            <>
                                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                Start Scan
                            </>
                        )}
                    </button>
                </div>

                {/* Scan Results */}
                {scanResult && (
                    <div className="space-y-6">
                        {/* Summary */}
                        <div className="bg-white shadow rounded-lg p-6">
                            <h2 className="text-lg font-medium text-gray-900 mb-4">Scan Results</h2>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="text-2xl font-bold text-gray-900">{scanResult.scannedHosts}</div>
                                    <div className="text-sm text-gray-500">Hosts Scanned</div>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="text-2xl font-bold text-gray-900">{scanResult.discoveredServers.length}</div>
                                    <div className="text-sm text-gray-500">MCP Servers Found</div>
                                </div>
                                <div className="bg-red-50 rounded-lg p-4">
                                    <div className="text-2xl font-bold text-red-600">{unprotectedServers.length}</div>
                                    <div className="text-sm text-red-500">Unprotected</div>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="text-2xl font-bold text-gray-900">{(scanResult.scanDuration / 1000).toFixed(1)}s</div>
                                    <div className="text-sm text-gray-500">Scan Duration</div>
                                </div>
                            </div>
                        </div>

                        {/* Unprotected Servers */}
                        {unprotectedServers.length > 0 && (
                            <div className="bg-white shadow rounded-lg overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
                                    <div className="flex items-center">
                                        <svg className="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <h3 className="text-lg font-medium text-red-800">Unprotected MCP Servers</h3>
                                    </div>
                                    <p className="mt-1 text-sm text-red-600">
                                        These servers are accessible without authentication and should be protected.
                                    </p>
                                </div>
                                <ul className="divide-y divide-gray-200">
                                    {unprotectedServers.map((server, index) => (
                                        <li key={index} className="p-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-mono text-lg font-medium text-gray-900">
                                                            {server.url}
                                                        </span>
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeColor(server.type)}`}>
                                                            {getTypeLabel(server.type)}
                                                        </span>
                                                    </div>
                                                    {server.serverInfo && (
                                                        <div className="mt-2 text-sm text-gray-500">
                                                            {server.serverInfo.name && <span className="mr-4">Name: {server.serverInfo.name}</span>}
                                                            {server.serverInfo.version && <span className="mr-4">Version: {server.serverInfo.version}</span>}
                                                            {server.serverInfo.capabilities && (
                                                                <span>Capabilities: {server.serverInfo.capabilities.join(', ')}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="mt-1 text-xs text-gray-400">
                                                        Discovered: {new Date(server.discoveredAt).toLocaleString()}
                                                    </div>
                                                </div>
                                                <div className="ml-4">
                                                    <Link
                                                        href="/integrations"
                                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                                    >
                                                        <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                        </svg>
                                                        Protect Now
                                                    </Link>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Protected Servers */}
                        {protectedServers.length > 0 && (
                            <div className="bg-white shadow rounded-lg overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
                                    <div className="flex items-center">
                                        <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                        <h3 className="text-lg font-medium text-green-800">Protected MCP Servers</h3>
                                    </div>
                                    <p className="mt-1 text-sm text-green-600">
                                        These servers require authentication to access.
                                    </p>
                                </div>
                                <ul className="divide-y divide-gray-200">
                                    {protectedServers.map((server, index) => (
                                        <li key={index} className="p-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-mono text-lg font-medium text-gray-900">
                                                            {server.url}
                                                        </span>
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeColor(server.type)}`}>
                                                            {getTypeLabel(server.type)}
                                                        </span>
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                            </svg>
                                                            Protected
                                                        </span>
                                                    </div>
                                                    {server.serverInfo && (
                                                        <div className="mt-2 text-sm text-gray-500">
                                                            {server.serverInfo.name && <span className="mr-4">Name: {server.serverInfo.name}</span>}
                                                            {server.serverInfo.version && <span className="mr-4">Version: {server.serverInfo.version}</span>}
                                                        </div>
                                                    )}
                                                    <div className="mt-1 text-xs text-gray-400">
                                                        Discovered: {new Date(server.discoveredAt).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* No Servers Found */}
                        {scanResult.discoveredServers.length === 0 && (
                            <div className="bg-white shadow rounded-lg p-12 text-center">
                                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <h3 className="mt-4 text-lg font-medium text-gray-900">No MCP Servers Found</h3>
                                <p className="mt-2 text-gray-500">
                                    No MCP servers were detected in the scanned range. Try scanning a different target or check if MCP servers are running.
                                </p>
                            </div>
                        )}

                        {/* Errors */}
                        {scanResult.errors.length > 0 && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <div className="flex items-center mb-2">
                                    <svg className="h-5 w-5 text-yellow-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <span className="font-medium text-yellow-800">Scan Warnings</span>
                                </div>
                                <ul className="text-sm text-yellow-700 list-disc list-inside">
                                    {scanResult.errors.map((error, index) => (
                                        <li key={index}>{error}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Error State */}
                {scanMutation.isError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                        <div className="flex items-center">
                            <svg className="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-red-800 font-medium">Scan failed</span>
                        </div>
                        <p className="mt-2 text-sm text-red-600">
                            {scanMutation.error instanceof Error ? scanMutation.error.message : 'An error occurred during the scan.'}
                        </p>
                    </div>
                )}

                {/* Help Section */}
                {!scanResult && !scanMutation.isPending && (
                    <div className="bg-white shadow rounded-lg p-6">
                        <h2 className="text-lg font-medium text-gray-900 mb-4">How It Works</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="flex items-start">
                                <div className="flex-shrink-0">
                                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                        <span className="text-blue-600 font-medium">1</span>
                                    </div>
                                </div>
                                <div className="ml-4">
                                    <h3 className="text-sm font-medium text-gray-900">Scan Network</h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        The scanner checks common ports for MCP server endpoints (SSE and Streamable HTTP).
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start">
                                <div className="flex-shrink-0">
                                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                        <span className="text-blue-600 font-medium">2</span>
                                    </div>
                                </div>
                                <div className="ml-4">
                                    <h3 className="text-sm font-medium text-gray-900">Identify Unprotected</h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Servers that don't require authentication are flagged as potentially vulnerable.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start">
                                <div className="flex-shrink-0">
                                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                        <span className="text-blue-600 font-medium">3</span>
                                    </div>
                                </div>
                                <div className="ml-4">
                                    <h3 className="text-sm font-medium text-gray-900">Protect Servers</h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Deploy protected MCP endpoints via our integrations to secure your servers.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Scanned Ports</h4>
                            <p className="text-sm text-gray-500">
                                3000, 3001, 3010, 3011, 8000, 8080, 8888, 9000, 9090
                            </p>
                            <h4 className="text-sm font-medium text-gray-900 mt-3 mb-2">Checked Endpoints</h4>
                            <p className="text-sm text-gray-500">
                                /sse, /mcp/sse, /events, /stream, /mcp, /
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
