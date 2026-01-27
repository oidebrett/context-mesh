import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMappings, createMapping, deleteMapping, testMapping } from '../api';
import Link from 'next/link';

export default function Mappings() {
    const queryClient = useQueryClient();
    const editorRef = useRef<HTMLDivElement>(null);
    const [provider, setProvider] = useState('jira');
    const [model, setModel] = useState('');
    const [mapping, setMapping] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{ original: any, mapped: any } | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const [activeTab, setActiveTab] = useState<'user' | 'system'>('user');

    const { data: mappingsData, isLoading } = useQuery({
        queryKey: ['mappings'],
        queryFn: getMappings
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            await createMapping(provider, model || undefined, mapping);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mappings'] });
            resetForm();
            setActiveTab('user'); // Switch to user tab to see the new mapping
        },
        onError: () => {
            setError('Failed to save mapping');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteMapping,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mappings'] });
        }
    });

    const resetForm = () => {
        setMapping('');
        setModel('');
        setProvider('jira');
        setError(null);
        setTestResult(null);
        setIsEditing(false);
    };

    const handleEdit = (m: any) => {
        setProvider(m.provider);
        setModel(m.model || '');
        setMapping(m.mapping);
        setIsEditing(true);
        setError(null);
        setTestResult(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCustomize = (m: any) => {
        setProvider(m.provider);
        setModel(m.model || '');
        setMapping(m.mapping);
        setIsEditing(false); // Treat as new creation based on system default
        setError(null);
        setTestResult(null);

        // Scroll to editor section
        setTimeout(() => {
            editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    const handleTest = async () => {
        if (!mapping) {
            setError('Mapping expression is required');
            return;
        }
        setIsTesting(true);
        setError(null);
        setTestResult(null);
        try {
            const result = await testMapping(provider, mapping, model || undefined);
            setTestResult(result);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsTesting(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!mapping) {
            setError('Mapping expression is required');
            return;
        }
        createMutation.mutate();
    };

    // Filter mappings based on active tab
    // Assuming system mappings have a specific userId or we can identify them.
    // Based on getMappings in backend, it returns all. We need a way to distinguish.
    // The backend returns all mappings. We can infer system mappings if we had the system admin ID,
    // but the frontend doesn't know it.
    // However, the backend `getMappings` returns mappings for the current user AND system admin.
    // If we look at the backend code, it doesn't explicitly flag them.
    // A simple heuristic for now: If the mapping is editable/deletable, it's likely the user's.
    // But `deleteMapping` checks `userId: user.id`.
    // So if we try to delete a system mapping, it will fail or not find it.
    // Ideally, the backend should return `isSystem` flag.
    // Since I cannot easily change the backend response structure without breaking types potentially,
    // I will assume for this task that I should have updated the backend to return `isSystem`.
    // Let's check `schemaMappings.ts` again. It returns `mappings`.
    // I will update `schemaMappings.ts` to include `isSystem` flag in the next step if needed,
    // but for now let's assume I can filter by checking if I can edit it? No.
    // Actually, I should update the backend to return `isSystem`.
    // But I am in `mappings.tsx` now.
    // Let's pause `mappings.tsx` edit and update backend first?
    // No, I can do it here if I check the user ID. But I don't have the current user ID easily available here without another call.
    // Wait, the requirement is: "Maybe we need a tab on mapping so the user can toggle between the system and the user-defined one".
    // I will implement the UI assuming the data has a way to distinguish.
    // Actually, I'll update `schemaMappings.ts` to return `isSystem` boolean.

    // RE-PLAN: I will cancel this edit, update backend first, then come back.
    // But I cannot cancel easily. I will proceed with the edit assuming `m.isSystem` exists,
    // and then I will update the backend to provide it.

    const filteredMappings = mappingsData?.mappings.filter((m: any) => {
        if (activeTab === 'user') return !m.isSystem;
        return m.isSystem;
    });

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <div className="flex-shrink-0 flex items-center">
                                <Link href="/" className="text-xl font-bold text-gray-800">
                                    Context Mesh
                                </Link>
                            </div>
                            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                                <Link href="/" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                    Dashboard
                                </Link>
                                <Link href="/integrations" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                    Integrations
                                </Link>
                                <Link href="/browser" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                    Data Browser
                                </Link>
                                <Link href="/mappings" className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                    Mappings
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold leading-tight text-gray-900">Schema Mappings</h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Configure how data from different providers is mapped to the unified schema using JSONata expressions.
                    </p>
                </header>

                <main>
                    <div ref={editorRef} className="bg-white shadow sm:rounded-lg mb-8 border border-gray-200">
                        <div className="px-4 py-5 sm:p-6">
                            <div className="flex justify-between items-center mb-5">
                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                    {isEditing ? 'Edit Mapping' : 'Create New Mapping'}
                                </h3>
                                {isEditing && (
                                    <button
                                        onClick={resetForm}
                                        className="text-sm text-gray-500 hover:text-gray-700"
                                    >
                                        Cancel Edit
                                    </button>
                                )}
                            </div>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                                    <div className="sm:col-span-3">
                                        <label htmlFor="provider" className="block text-sm font-medium text-gray-700">
                                            Provider
                                        </label>
                                        <div className="mt-1">
                                            <select
                                                id="provider"
                                                name="provider"
                                                value={provider}
                                                onChange={(e) => setProvider(e.target.value)}
                                                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                                disabled={isEditing}
                                            >
                                                <option value="jira">Jira</option>
                                                <option value="google-drive">Google Drive</option>
                                                <option value="slack">Slack</option>
                                                <option value="github">GitHub</option>
                                                <option value="zoho-crm">Zoho CRM</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="sm:col-span-3">
                                        <label htmlFor="model" className="block text-sm font-medium text-gray-700">
                                            Model (Optional)
                                        </label>
                                        <div className="mt-1">
                                            <input
                                                type="text"
                                                name="model"
                                                id="model"
                                                value={model}
                                                onChange={(e) => setModel(e.target.value)}
                                                placeholder="e.g. Project, Issue"
                                                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                                disabled={isEditing}
                                            />
                                        </div>
                                    </div>

                                    <div className="sm:col-span-6">
                                        <label htmlFor="mapping" className="block text-sm font-medium text-gray-700">
                                            JSONata Mapping
                                        </label>
                                        <div className="mt-1">
                                            <textarea
                                                id="mapping"
                                                name="mapping"
                                                rows={8}
                                                value={mapping}
                                                onChange={(e) => setMapping(e.target.value)}
                                                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md font-mono"
                                                placeholder='{"title": name, "type": "custom-type"}'
                                            />
                                        </div>
                                        <p className="mt-2 text-xs text-gray-500">
                                            Define the transformation using <a href="https://jsonata.org/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-500">JSONata</a>.
                                        </p>
                                    </div>
                                </div>

                                {error && (
                                    <div className="rounded-md bg-red-50 p-4 border border-red-200">
                                        <div className="flex">
                                            <div className="ml-3">
                                                <h3 className="text-sm font-medium text-red-800">{error}</h3>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={handleTest}
                                        disabled={isTesting}
                                        className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                                    >
                                        {isTesting ? 'Testing...' : 'Test Mapping'}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={createMutation.isPending}
                                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                                    >
                                        {createMutation.isPending ? 'Saving...' : (isEditing ? 'Update Mapping' : 'Save Mapping')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {testResult && (
                        <div className="bg-white shadow sm:rounded-lg mb-8 overflow-hidden border border-gray-200">
                            <div className="px-4 py-5 sm:p-6">
                                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Test Result</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Original Object (Sample)</h4>
                                        <pre className="bg-gray-50 p-4 rounded-md text-xs overflow-auto h-96 border border-gray-200">
                                            {JSON.stringify(testResult.original, null, 2)}
                                        </pre>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Mapped Result</h4>
                                        <pre className="bg-gray-50 p-4 rounded-md text-xs overflow-auto h-96 border border-gray-200">
                                            {JSON.stringify(testResult.mapped, null, 2)}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
                        <div className="border-b border-gray-200">
                            <nav className="-mb-px flex" aria-label="Tabs">
                                <button
                                    onClick={() => setActiveTab('user')}
                                    className={`${activeTab === 'user'
                                        ? 'border-indigo-500 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        } w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm`}
                                >
                                    User Mappings
                                </button>
                                <button
                                    onClick={() => setActiveTab('system')}
                                    className={`${activeTab === 'system'
                                        ? 'border-indigo-500 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        } w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm`}
                                >
                                    System Defaults
                                </button>
                            </nav>
                        </div>
                        <ul className="divide-y divide-gray-200">
                            {isLoading ? (
                                <li className="px-4 py-8 text-center text-gray-500">Loading mappings...</li>
                            ) : filteredMappings?.length === 0 ? (
                                <li className="px-4 py-8 text-center text-gray-500">
                                    {activeTab === 'user' ? 'No user mappings found. Customize a system default to get started.' : 'No system defaults available.'}
                                </li>
                            ) : (
                                filteredMappings?.map((m: any) => (
                                    <li key={m.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 transition-colors duration-150">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col flex-1 min-w-0 mr-4">
                                                <div className="flex items-center mb-2">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                                        {m.provider}
                                                    </span>
                                                    {m.model && (
                                                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            {m.model}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="bg-gray-900 rounded-md p-3 overflow-x-auto max-h-40 overflow-y-auto">
                                                    <pre className="text-xs text-gray-300 font-mono">
                                                        {m.mapping}
                                                    </pre>
                                                </div>
                                            </div>
                                            <div className="flex-shrink-0 flex space-x-2">
                                                {activeTab === 'user' ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleEdit(m)}
                                                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => deleteMutation.mutate(m.id)}
                                                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                                        >
                                                            Delete
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => handleCustomize(m)}
                                                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                                    >
                                                        Customize
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                </main>
            </div>
        </div>
    );
}
