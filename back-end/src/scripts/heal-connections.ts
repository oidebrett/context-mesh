import { db } from '../db.js';
import { nango } from '../nango.js';

/**
 * Script to manually heal missing connections by fetching from Nango
 * This simulates what the webhook handler does when it receives a sync webhook
 */
async function healConnections() {
    console.log('Starting connection healing process...');

    try {
        // Get all connections from Nango
        const nangoConnections = await nango.listConnections();
        console.log(`Found ${nangoConnections.connections.length} connections in Nango`);

        let healed = 0;
        let skipped = 0;

        for (const connection of nangoConnections.connections) {
            // Check if this connection exists in our local DB
            const existingConnection = await db.userConnections.findFirst({
                where: {
                    connectionId: connection.connection_id,
                    providerConfigKey: connection.provider_config_key
                }
            });

            if (!existingConnection) {
                console.log(`\nMissing connection found: ${connection.provider_config_key} (${connection.connection_id})`);

                // Get full connection details to access end_user
                const fullConnection = await nango.getConnection(
                    connection.provider_config_key,
                    connection.connection_id
                );

                if (fullConnection && fullConnection.end_user?.id) {
                    console.log(`  User ID: ${fullConnection.end_user.id}`);
                    console.log(`  User Email: ${fullConnection.end_user.email}`);

                    await db.userConnections.upsert({
                        where: {
                            userId_providerConfigKey: {
                                userId: fullConnection.end_user.id,
                                providerConfigKey: connection.provider_config_key
                            }
                        },
                        create: {
                            userId: fullConnection.end_user.id,
                            connectionId: connection.connection_id,
                            providerConfigKey: connection.provider_config_key
                        },
                        update: {
                            connectionId: connection.connection_id,
                            updatedAt: new Date()
                        }
                    });

                    console.log(`  ✓ Healed connection for ${connection.provider_config_key}`);
                    healed++;
                } else {
                    console.log(`  ✗ Could not heal: missing end_user data`);
                    skipped++;
                }
            } else {
                skipped++;
            }
        }

        console.log(`\n✓ Healing complete: ${healed} connections healed, ${skipped} skipped`);
    } catch (error) {
        console.error('Error during healing:', error);
        throw error;
    } finally {
        await db.$disconnect();
    }
}

healConnections();
