import type { RouteHandler } from 'fastify';

interface Client {
    id: number;
    reply: any;
}

const clients: Client[] = [];

export const eventsHandler: RouteHandler = (req, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*'); // Adjust as needed for CORS
    reply.raw.flushHeaders();

    const clientId = Date.now();
    const newClient = {
        id: clientId,
        reply
    };
    clients.push(newClient);

    // Send initial ping
    reply.raw.write(`event: connected\ndata: "connected"\n\n`);

    req.raw.on('close', () => {
        const index = clients.findIndex(c => c.id === clientId);
        if (index !== -1) {
            clients.splice(index, 1);
        }
    });
};

export function emitEvent(type: string, data: any) {
    const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    clients.forEach(client => {
        try {
            client.reply.raw.write(message);
        } catch (error) {
            console.error('Error sending event to client:', error);
        }
    });
}
