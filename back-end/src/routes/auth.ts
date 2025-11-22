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
            const userInfo = await strategy.validateCallback(req);

            // 1. Check if identity exists
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
                user = identity.user;
            } else {
                // 2. Check if user exists by email
                user = await db.users.findUnique({
                    where: { email: userInfo.email }
                });

                if (!user) {
                    // 3. Create new user
                    user = await db.users.create({
                        data: {
                            email: userInfo.email,
                            displayName: userInfo.name,
                            avatarUrl: userInfo.picture || null
                        }
                    });
                }

                // 4. Create identity link
                await db.userIdentity.create({
                    data: {
                        userId: user.id,
                        provider,
                        providerId: userInfo.id
                    }
                });
            }

            // Set session
            (req.session as any).set('user', {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl
            });

            return reply.redirect(process.env['FRONTEND_URL'] || 'http://localhost:3011');
        } catch (error) {
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
        return { authenticated: true, user };
    });
}
