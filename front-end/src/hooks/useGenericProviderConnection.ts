import { useCallback } from 'react';
import Nango from '@nangohq/frontend';
import { deleteConnection, postConnectSession } from '../api';
import { queryClient } from '../utils';

const nango = new Nango({
    host: process.env.NEXT_PUBLIC_NANGO_HOST ?? 'https://api.nango.dev',
    publicKey: 'empty'
});

/**
 * Generic hook for connecting/disconnecting any provider via Nango OAuth
 * This replaces the hardcoded useProviderConnections hook
 */
export function useGenericProviderConnection() {
    /**
     * Connect to any provider using Nango's OAuth flow
     */
    const connectProvider = useCallback(async (providerKey: string) => {
        try {
            console.log(`Starting ${providerKey} connection...`);

            const connectUI = nango.openConnectUI({
                apiURL: process.env.NEXT_PUBLIC_NANGO_HOST ?? 'https://api.nango.dev',
                baseURL: process.env.NEXT_PUBLIC_NANGO_CONNECT_URL ?? 'https://connect.nango.dev',
                onEvent: (event: any) => {
                    console.log(`${providerKey} connection event:`, event);
                    if (event.type === 'close') {
                        console.log(`${providerKey} connection closed, refreshing queries...`);
                        void queryClient.refetchQueries({ queryKey: ['connections'] });
                    } else if (event.type === 'connect') {
                        console.log(`${providerKey} connection successful, refreshing queries...`);
                        void queryClient.refetchQueries({ queryKey: ['connections'] });

                        // Trigger initial sync after connection
                        setTimeout(() => {
                            fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3010'}/sync-all`, {
                                method: 'POST'
                            }).catch(err => console.error('Failed to trigger sync:', err));
                        }, 1000);
                    }
                }
            });

            // Create session and set token (must be done in setTimeout per Nango SDK requirements)
            setTimeout(async () => {
                try {
                    const res = await postConnectSession(providerKey);
                    connectUI.setSessionToken(res.connectSession);
                } catch (error) {
                    console.error(`Error creating ${providerKey} session token:`, error);
                }
            }, 10);

            console.log(`${providerKey} connection flow initiated`);
        } catch (error) {
            console.error(`Error connecting ${providerKey}:`, error);
            throw error;
        }
    }, []);

    /**
     * Disconnect from any provider
     */
    const disconnectProvider = useCallback(async (providerKey: string, connectionId?: string) => {
        try {
            console.log(`Disconnecting ${providerKey}...`);
            
            if (connectionId) {
                await deleteConnection(connectionId);
            } else {
                // If no connectionId provided, we need to find it
                console.warn(`No connectionId provided for ${providerKey}, skipping deletion`);
            }
            
            await queryClient.refetchQueries({ queryKey: ['connections'] });
            console.log(`${providerKey} disconnected successfully`);
        } catch (error) {
            console.error(`Error disconnecting ${providerKey}:`, error);
            throw error;
        }
    }, []);

    /**
     * Get connection info for a specific provider
     */
    const getConnection = useCallback((providerKey: string, connections?: any[]) => {
        if (!connections) return undefined;
        return connections.find((conn) => conn.provider_config_key === providerKey);
    }, []);

    /**
     * Check if a provider is connected
     */
    const isConnected = useCallback((providerKey: string, connections?: any[]) => {
        return !!getConnection(providerKey, connections);
    }, [getConnection]);

    return {
        connectProvider,
        disconnectProvider,
        getConnection,
        isConnected
    };
}

