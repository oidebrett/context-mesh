import '@fastify/oauth2';
import '@fastify/secure-session';

declare module '@fastify/secure-session' {
    interface SessionData {
        user: {
            id: string;
            email: string;
            displayName: string;
            avatarUrl: string | null;
        };
    }
}

declare module 'fastify' {
    interface FastifyInstance {
        googleOAuth2: any;
    }
}
