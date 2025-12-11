import type { GetIntegrations, PostConnectSessionSuccess, GetContactsSuccess, GetConnectionsSuccess } from 'back-end';
import { baseUrl } from './utils';
import type { File } from './types';

export async function postConnectSession(integration: string): Promise<PostConnectSessionSuccess> {
    const res = await fetch(`${baseUrl}/connect-session`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ integration }),
        credentials: 'include'
    });
    if (res.status !== 200) {
        throw new Error();
    }

    const json = (await res.json()) as PostConnectSessionSuccess;
    return json;
}

export async function listIntegrations(): Promise<GetIntegrations> {
    const res = await fetch(`${baseUrl}/integrations`, { credentials: 'include' });
    if (res.status !== 200) {
        throw new Error();
    }

    const json = (await res.json()) as GetIntegrations;
    return json;
}

export async function listConnections(): Promise<GetConnectionsSuccess> {
    const res = await fetch(`${baseUrl}/connections`, { credentials: 'include' });
    if (res.status !== 200) {
        throw new Error();
    }

    const json = (await res.json()) as GetConnectionsSuccess;
    return json;
}

export async function listContacts(): Promise<GetContactsSuccess> {
    const res = await fetch(`${baseUrl}/contacts?integration=slack`, { credentials: 'include' });
    if (res.status !== 200) {
        throw new Error();
    }

    const json = (await res.json()) as GetContactsSuccess;
    return json;
}

export async function getNangoCredentials(integrationId: string): Promise<any> {
    const res = await fetch(`${baseUrl}/nango-credentials?integrationId=${integrationId}`, { credentials: 'include' });
    if (res.status !== 200) {
        throw new Error('Failed to get Nango credentials');
    }
    return res.json();
}

export async function getSharepointBaseUrl(): Promise<any> {
    const res = await fetch(`${baseUrl}/sharepoint-baseurl`, { credentials: 'include' });
    if (res.status !== 200) {
        throw new Error('Failed to get Nango credentials');
    }
    return res.json();
}

export async function setConnectionMetadata(integrationId: string, metadata: Record<string, any>): Promise<void> {
    const res = await fetch(`${baseUrl}/set-connection-metadata`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ integrationId, metadata }),
        credentials: 'include'
    });
    if (res.status !== 200) {
        throw new Error('Failed to set connection metadata');
    }
}

export async function getConnectionMetadata(integrationId: string): Promise<{ metadata: any; connectionId: string }> {
    const res = await fetch(`${baseUrl}/get-connection-metadata?integrationId=${integrationId}`, {
        credentials: 'include'
    });
    if (res.status !== 200) {
        throw new Error('Failed to get connection metadata');
    }
    return res.json();
}

export async function getFiles(): Promise<File[]> {
    const res = await fetch(`${baseUrl}/get-files`, { credentials: 'include' });
    if (res.status !== 200) {
        throw new Error('Failed to get files');
    }
    const json: { files: File[] } = await res.json();
    return json.files;
}

export async function downloadFile(fileId: string): Promise<Blob> {
    const res = await fetch(`${baseUrl}/download/${fileId}`, {
        method: 'GET',
        credentials: 'include'
    });

    if (!res.ok) {
        throw new Error('Failed to download file');
    }

    return res.blob();
}

export async function deleteConnection(integration: string): Promise<void> {
    const res = await fetch(`${baseUrl}/connections?integration=${integration}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    if (res.status !== 200) {
        throw new Error('Failed to delete connection');
    }
}

export async function getSyncConfig(connectionId: string, provider: string): Promise<any> {
    const res = await fetch(`${baseUrl}/api/connections/${connectionId}/sync-config?provider=${provider}`, { credentials: 'include' });
    if (res.status !== 200) {
        throw new Error('Failed to get sync config');
    }
    return res.json();
}

export async function updateSyncConfig(connectionId: string, provider: string, syncConfig: any): Promise<any> {
    const res = await fetch(`${baseUrl}/api/connections/${connectionId}/sync-config`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ provider, syncConfig }),
        credentials: 'include'
    });
    if (res.status !== 200) {
        throw new Error('Failed to update sync config');
    }
    return res.json();
}

export async function getProviderDataTypes(): Promise<any> {
    const res = await fetch(`${baseUrl}/api/providers/data-types`, { credentials: 'include' });
    if (res.status !== 200) {
        throw new Error('Failed to get provider data types');
    }
    return res.json();
}

export async function getUnifiedObjects(params?: {
    type?: string;
    provider?: string;
    connectionId?: string;
    search?: string;
}): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.append('type', params.type);
    if (params?.provider) queryParams.append('provider', params.provider);
    if (params?.connectionId) queryParams.append('connectionId', params.connectionId);
    if (params?.search) queryParams.append('search', params.search);

    const res = await fetch(`${baseUrl}/api/unified-objects?${queryParams.toString()}`, { credentials: 'include' });
    if (res.status !== 200) {
        throw new Error('Failed to get unified objects');
    }
    return res.json();
}

export async function getBackendStatus(): Promise<{ root: boolean }> {
    try {
        const res = await fetch(`${baseUrl}/`, { credentials: 'include' });
        if (res.status !== 200) {
            throw new Error('Failed to get backend status');
        }
        return res.json();
    } catch (e) {
        return { root: false };
    }
}
export interface SchemaMapping {
    id: string;
    userId: string;
    provider: string;
    model: string | null;
    mapping: string;
    createdAt: string;
    updatedAt: string;
}

export async function getMappings(): Promise<{ mappings: SchemaMapping[] }> {
    const res = await fetch(`${baseUrl}/api/mappings`, { credentials: 'include' });
    if (res.status !== 200) {
        throw new Error('Failed to get mappings');
    }
    return res.json();
}

export async function createMapping(provider: string, model: string | undefined, mapping: string): Promise<SchemaMapping> {
    const res = await fetch(`${baseUrl}/api/mappings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ provider, model, mapping }),
        credentials: 'include'
    });
    if (res.status !== 200) {
        throw new Error('Failed to create mapping');
    }
    return res.json();
}

export const deleteMapping = async (id: string): Promise<void> => {
    const response = await fetch(`${baseUrl}/api/mappings/${id}`, { // Changed fetchWithAuth to fetch and added credentials
        method: 'DELETE',
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error('Failed to delete mapping');
    }
};

export const testMapping = async (provider: string, mapping: string, model?: string): Promise<{ original: any, mapped: any }> => {
    const response = await fetch(`${baseUrl}/api/mappings/test`, { // Changed fetchWithAuth to fetch and added credentials
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ provider, mapping, model }),
        credentials: 'include'
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to test mapping');
    }

    return response.json();
};

