import { db } from '../db.js';
import { nango } from '../nango.js';

async function testNangoGetConnection() {
    console.log('=== Testing Nango getConnection for Jira ===');

    const jiraConnection = await db.userConnections.findFirst({
        where: {
            providerConfigKey: 'jira'
        }
    });

    if (!jiraConnection) {
        console.log('No Jira connection found in DB');
        await db.$disconnect();
        return;
    }

    console.log('Found Jira connection in DB:', jiraConnection);
    console.log('\nAttempting to fetch from Nango...');

    try {
        const nangoConn = await nango.getConnection(
            jiraConnection.providerConfigKey,
            jiraConnection.connectionId
        );
        console.log('✓ Successfully fetched from Nango:');
        console.log(JSON.stringify(nangoConn, null, 2));
    } catch (error) {
        console.error('✗ Failed to fetch from Nango:');
        console.error('Error type:', (error as any).constructor.name);
        console.error('Error message:', (error as any).message);
        console.error('Full error:', error);
    }

    await db.$disconnect();
}

testNangoGetConnection();
