import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const mappings = await prisma.schemaMapping.findMany();
    console.log('All Mappings:', JSON.stringify(mappings, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
