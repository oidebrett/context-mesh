import { db } from '../db.js';
import { nango } from '../nango.js';

async function checkConnections() {
    console.log('=== Checking UserConnections table ===');
    const userConnections = await db.userConnections.findMany({
        where: {
            providerConfigKey: 'jira'
        }
    });
    console.log('Jira connections in DB:', JSON.stringify(userConnections, null, 2));

    console.log('\n=== Checking Nango connections ===');
    for (const uc of userConnections) {
        try {
            const nangoConn = await nango.getConnection(uc.providerConfigKey, uc.connectionId);
            console.log(`Nango connection for ${uc.connectionId}:`, JSON.stringify({
                id: nangoConn.id,
                connection_id: nangoConn.connection_id,
                provider_config_key: nangoConn.provider_config_key,
                end_user: nangoConn.end_user
            }, null, 2));
        } catch (error) {
            console.error(`Failed to get Nango connection for ${uc.connectionId}:`, error);
        }
    }

    await db.$disconnect();
}

checkConnections();
