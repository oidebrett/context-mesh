import { db } from '../db.js';
import { nango } from '../nango.js';

/**
 * Simulate the exact flow of getConnections.ts to identify the issue
 */
async function simulateGetConnections() {
    const userId = 'd9b7af2a-0af0-4755-a708-619e68029865'; // From logs

    console.log('=== Simulating getConnections flow ===');
    console.log(`1. User ID: ${userId}`);

    console.log('\n2. Querying UserConnections...');
    const userConnections = await db.userConnections.findMany({
        where: {
            userId: userId
        }
    });
    console.log(`Found ${userConnections.length} connections:`, userConnections);

    if (userConnections.length === 0) {
        console.log('Would return empty array');
        await db.$disconnect();
        return;
    }

    console.log('\n3. Fetching from Nango for each connection...');
    const connections = [];
    for (const userConnection of userConnections) {
        console.log(`\n  Processing: ${userConnection.providerConfigKey} (${userConnection.connectionId})`);
        try {
            const connection = await nango.getConnection(userConnection.providerConfigKey, userConnection.connectionId);
            if (connection) {
                console.log(`  ✓ Success - adding to results`);
                connections.push({
                    id: connection.id,
                    connection_id: userConnection.connectionId,
                    provider_config_key: userConnection.providerConfigKey,
                    provider: userConnection.providerConfigKey,
                    created: connection.created_at,
                    metadata: connection.metadata || {},
                    errors: connection.errors || [],
                    end_user: connection.end_user || null
                });
            } else {
                console.log(`  ✗ Nango returned null`);
            }
        } catch (error) {
            console.error(`  ✗ Error:`, error);
        }
    }

    console.log(`\n4. Final result: ${connections.length} connections`);
    console.log(JSON.stringify({ connections }, null, 2));

    await db.$disconnect();
}

simulateGetConnections();
