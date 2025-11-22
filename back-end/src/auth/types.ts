import { FastifyRequest } from 'fastify';

export interface UserInfo {
    id: string;
    email: string;
    name: string;
    picture?: string;
}

export interface AuthStrategy {
    /**
     * Validates the callback request and returns user info.
     * This abstracts the provider-specific token exchange and user profile fetching.
     */
    validateCallback(req: FastifyRequest): Promise<UserInfo>;
}
