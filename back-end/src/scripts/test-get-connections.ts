import { db } from '../db.js';

async function testGetConnections() {
    const userId = 'd9b7af2a-0af0-4755-a708-619e68029865'; // From the logs

    console.log('=== Testing getConnections logic ===');

    const userConnections = await db.userConnections.findMany({
        where: {
            userId: userId
        }
    });

    console.log(`Found ${userConnections.length} user connections in DB:`);
    console.log(JSON.stringify(userConnections, null, 2));

    await db.$disconnect();
}

testGetConnections();
