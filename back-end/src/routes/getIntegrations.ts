import type { RouteHandler } from 'fastify';
import { nango } from '../nango.js';

type ListIntegrationsResponse = Awaited<ReturnType<typeof nango.listIntegrations>>;

export type GetIntegrations = {
    integrations: ListIntegrationsResponse['configs'];
};



/**
 * List activated integrations
 */
export const getIntegrations: RouteHandler<{ Reply: GetIntegrations }> = async (_, reply) => {
    const list = await nango.listIntegrations();

    await reply.status(200).send({ integrations: list.configs });
};
