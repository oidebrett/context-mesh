import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Spinner from '../Spinner';
import { getNangoCredentials, setConnectionMetadata, getConnectionMetadata } from '../../api';

interface JiraProject {
    id: string;
    key: string;
    name: string;
    projectTypeKey: string;
}

interface Props {
    connectionId: string;
    onProjectsSelected?: () => void;
}

export function JiraProjectPicker({ connectionId, onProjectsSelected }: Props) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
    const [projects, setProjects] = useState<JiraProject[]>([]);

    const queryClient = useQueryClient();

    const { data: resConnection } = useQuery({
        queryKey: ['connection', connectionId],
        queryFn: async () => {
            const credentials = await getNangoCredentials('jira');
            return credentials.credentials;
        }
    });

    const accessToken = resConnection?.access_token;

    const fetchProjects = async () => {
        if (!accessToken) {
            setError('No access token available');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // First, get the cloud ID
            const cloudResponse = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            });

            if (!cloudResponse.ok) {
                throw new Error('Failed to fetch Jira cloud resources');
            }

            const cloudResources = await cloudResponse.json();
            if (!cloudResources || cloudResources.length === 0) {
                throw new Error('No Jira sites found');
            }

            const cloudId = cloudResources[0].id;

            // Fetch projects
            const projectsResponse = await fetch(
                `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project/search?maxResults=100`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    }
                }
            );

            if (!projectsResponse.ok) {
                throw new Error('Failed to fetch Jira projects');
            }

            const projectsData = await projectsResponse.json();
            setProjects(projectsData.values || []);

            // Load existing metadata to pre-select projects
            try {
                const { metadata } = await getConnectionMetadata('jira');
                if (metadata?.projectIdsToSync) {
                    const existingProjectIds = metadata.projectIdsToSync.map((p: { id: string }) => p.id);
                    setSelectedProjects(new Set(existingProjectIds));
                }
            } catch (err) {
                console.log('No existing metadata found, starting fresh');
            }

            setShowModal(true);
        } catch (err) {
            console.error('Error fetching projects:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch projects');
        } finally {
            setLoading(false);
        }
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            const projectIdsToSync = Array.from(selectedProjects).map(id => ({ id }));
            await setConnectionMetadata('jira', { projectIdsToSync });
        },
        onSuccess: () => {
            setShowModal(false);
            setSelectedProjects(new Set());
            onProjectsSelected?.();
            queryClient.invalidateQueries({ queryKey: ['connections'] });
        },
        onError: (err) => {
            setError(err instanceof Error ? err.message : 'Failed to save project selection');
        }
    });

    const handleToggleProject = (projectId: string) => {
        const newSelected = new Set(selectedProjects);
        if (newSelected.has(projectId)) {
            newSelected.delete(projectId);
        } else {
            newSelected.add(projectId);
        }
        setSelectedProjects(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedProjects.size === projects.length) {
            setSelectedProjects(new Set());
        } else {
            setSelectedProjects(new Set(projects.map(p => p.id)));
        }
    };

    const handleSave = () => {
        if (selectedProjects.size === 0) {
            setError('Please select at least one project');
            return;
        }
        saveMutation.mutate();
    };

    return (
        <div className="space-y-4">
            <button
                onClick={fetchProjects}
                disabled={loading || !accessToken}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? (
                    <>
                        <Spinner size={1} className="mr-2" />
                        Loading Projects...
                    </>
                ) : (
                    <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Select Jira Projects
                    </>
                )}
            </button>

            {error && (
                <div className="rounded-md bg-red-50 p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">Error</h3>
                            <div className="mt-2 text-sm text-red-700">{error}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        {/* Background overlay */}
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowModal(false)}></div>

                        {/* Modal panel */}
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="sm:flex sm:items-start">
                                    <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4" id="modal-title">
                                            Select Jira Projects to Sync
                                        </h3>

                                        <div className="mb-4">
                                            <button
                                                onClick={handleSelectAll}
                                                className="text-sm text-blue-600 hover:text-blue-800"
                                            >
                                                {selectedProjects.size === projects.length ? 'Deselect All' : 'Select All'}
                                            </button>
                                            <span className="ml-2 text-sm text-gray-500">
                                                ({selectedProjects.size} of {projects.length} selected)
                                            </span>
                                        </div>

                                        <div className="mt-2 max-h-96 overflow-y-auto border border-gray-200 rounded-md">
                                            {projects.length === 0 ? (
                                                <div className="p-4 text-center text-gray-500">
                                                    No projects found
                                                </div>
                                            ) : (
                                                <ul className="divide-y divide-gray-200">
                                                    {projects.map((project) => (
                                                        <li key={project.id} className="p-3 hover:bg-gray-50">
                                                            <label className="flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedProjects.has(project.id)}
                                                                    onChange={() => handleToggleProject(project.id)}
                                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                                />
                                                                <div className="ml-3 flex-1">
                                                                    <p className="text-sm font-medium text-gray-900">{project.name}</p>
                                                                    <p className="text-xs text-gray-500">
                                                                        {project.key} • {project.projectTypeKey}
                                                                    </p>
                                                                </div>
                                                            </label>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saveMutation.isPending || selectedProjects.size === 0}
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saveMutation.isPending ? 'Saving...' : 'Save Selection'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
