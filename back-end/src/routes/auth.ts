import { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { GoogleAuthStrategy } from '../auth/google.js';
import { AuthStrategy } from '../auth/types.js';

export async function authRoutes(fastify: FastifyInstance) {
    // Initialize strategies
    const strategies: Record<string, AuthStrategy> = {
        google: new GoogleAuthStrategy()
    };

    fastify.get('/auth/:provider/callback', async function (req, reply) {
        const { provider } = req.params as { provider: string };
        const strategy = strategies[provider];

        if (!strategy) {
            return reply.code(404).send({ error: 'Provider not found' });
        }

        try {
            console.log(`Processing ${provider} OAuth callback...`);
            const userInfo = await strategy.validateCallback(req);
            console.log('User info validated:', { email: userInfo.email, id: userInfo.id });

            // 1. Check if identity exists
            console.log('Checking if identity exists...');
            let identity = await db.userIdentity.findUnique({
                where: {
                    provider_providerId: {
                        provider,
                        providerId: userInfo.id
                    }
                },
                include: { user: true }
            });

            let user;

            if (identity) {
                // Login existing user
                console.log('Found existing identity, logging in user:', identity.user.email);
                user = identity.user;
            } else {
                console.log('No existing identity found, checking for user by email...');
                // 2. Check if user exists by email
                user = await db.users.findUnique({
                    where: { email: userInfo.email }
                });

                if (!user) {
                    // 3. Create new user
                    console.log('Creating new user:', userInfo.email);
                    user = await db.users.create({
                        data: {
                            email: userInfo.email,
                            displayName: userInfo.name,
                            avatarUrl: userInfo.picture || null
                        }
                    });
                    console.log('User created:', user.id);
                }

                // 4. Create identity link
                console.log('Creating identity link...');
                await db.userIdentity.create({
                    data: {
                        userId: user.id,
                        provider,
                        providerId: userInfo.id
                    }
                });
                console.log('Identity link created');

            }

            // 5. Auto-sync existing connections from Nango for this email/ID
            // This is critical after database wipes to recover active connections
            try {
                console.log(`[Auth] Auto-syncing Nango connections for Email: ${userInfo.email}, ID: ${userInfo.id}...`);
                const { syncUserConnectionsFromNango } = await import('../services/syncService.js');
                await syncUserConnectionsFromNango(user.id, userInfo.email);
                console.log(`[Auth] Auto-sync completed for ${userInfo.email}`);
            } catch (error) {
                console.error('[Auth] Failed to auto-sync Nango connections during login:', error);
            }

            // Set session
            console.log('Setting session for user:', user.id);
            (req.session as any).set('user', {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl
            });

            console.log('Redirecting to frontend...');
            return reply.redirect(process.env['FRONTEND_URL'] || 'http://localhost:3011');
        } catch (error) {
            console.error('Authentication error:', error);
            req.log.error(error);
            return reply.code(500).send({ error: 'Authentication failed' });
        }
    });

    fastify.get('/auth/logout', async function (req, reply) {
        req.session.delete();
        return reply.redirect(process.env['FRONTEND_URL'] || 'http://localhost:3011');
    });

    fastify.get('/auth/me', async function (req, reply) {
        const user = req.session.get('user');
        if (!user) {
            return reply.code(401).send({ authenticated: false });
        }

        // Verify user exists in DB (handles DB wipes with surviving session cookies)
        const dbUser = await db.users.findUnique({ where: { id: user.id } });
        if (!dbUser) {
            console.warn(`[Auth] User ${user.id} from session not found in DB. Clearing session.`);
            req.session.delete();
            return reply.code(401).send({ authenticated: false, error: 'session_stale' });
        }

        return { authenticated: true, user };
    });
}
