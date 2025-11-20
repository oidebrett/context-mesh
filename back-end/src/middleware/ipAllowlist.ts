import type { FastifyReply, FastifyRequest } from 'fastify';
import ipRangeCheck from 'ip-range-check';

// Cloudflare IP ranges (IPv4 and IPv6)
// Source: https://www.cloudflare.com/ips/
const CLOUDFLARE_IPS = [
    // IPv4
    '173.245.48.0/20',
    '103.21.244.0/22',
    '103.22.200.0/22',
    '103.31.4.0/22',
    '141.101.64.0/18',
    '108.162.192.0/18',
    '190.93.240.0/20',
    '188.114.96.0/20',
    '197.234.240.0/22',
    '198.41.128.0/17',
    '162.158.0.0/15',
    '104.16.0.0/13',
    '104.24.0.0/14',
    '172.64.0.0/13',
    '131.0.72.0/22',
    // IPv6
    '2400:cb00::/32',
    '2606:4700::/32',
    '2803:f800::/32',
    '2405:b500::/32',
    '2405:8100::/32',
    '2a06:98c0::/29',
    '2c0f:f248::/32'
];

// Add local IPs for development/debugging
const LOCAL_IPS = ['127.0.0.1', '::1'];

export async function ipAllowlistMiddleware(req: FastifyRequest<any>, reply: FastifyReply) {
    const clientIp = req.ip;

    // Check if IP is in allowlist
    const isAllowed = ipRangeCheck(clientIp, [...CLOUDFLARE_IPS, ...LOCAL_IPS]);

    if (!isAllowed) {
        console.warn(`Blocked access to ${req.url} from unauthorized IP: ${clientIp}`);
        await reply.status(403).send({ error: 'Forbidden: Access restricted to authorized crawlers.' });
    }
}
