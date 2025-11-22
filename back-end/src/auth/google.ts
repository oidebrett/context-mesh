import { FastifyRequest } from 'fastify';
import { AuthStrategy, UserInfo } from './types.js';

interface GoogleUserInfo {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    locale: string;
}

export class GoogleAuthStrategy implements AuthStrategy {
    async validateCallback(req: FastifyRequest): Promise<UserInfo> {
        // @ts-ignore - fastify-oauth2 adds this to the instance, accessible via req.server
        const token = await req.server.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);

        // Get user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${token.token.access_token}`
            }
        });

        if (!userInfoResponse.ok) {
            throw new Error('Failed to fetch user info from Google');
        }

        const userInfo = await userInfoResponse.json() as GoogleUserInfo;

        return {
            id: userInfo.id,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture
        };
    }
}
