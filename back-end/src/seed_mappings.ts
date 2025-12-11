
import { db } from './db.js';

const defaultMappings = [
    {
        provider: 'google-drive',
        mapping: `{
  "title": name,
  "sourceUrl": webViewLink,
  "type": "document",
  "mimeType": mimeType,
  "description": null
}`
    },
    {
        provider: 'jira',
        model: 'Issue',
        mapping: `{
  "title": fields.summary,
  "sourceUrl": self,
  "type": "issue",
  "description": fields.description,
  "status": fields.status.name,
  "priority": fields.priority.name
}`
    },
    {
        provider: 'github',
        model: 'Issue',
        mapping: `{
  "title": title,
  "sourceUrl": html_url,
  "type": "issue",
  "description": body,
  "status": state
}`
    }
];

async function seedMappings() {
    console.log('Seeding default mappings...');

    // Let's create a system/admin user for these default mappings
    const systemUser = await db.users.upsert({
        where: { email: 'admin@contextmesh.com' },
        update: {},
        create: {
            email: 'admin@contextmesh.com',
            displayName: 'System Admin'
        }
    });

    for (const m of defaultMappings) {
        const existing = await db.schemaMapping.findFirst({
            where: {
                userId: systemUser.id,
                provider: m.provider,
                model: m.model || null
            }
        });

        if (existing) {
            await db.schemaMapping.update({
                where: { id: existing.id },
                data: { mapping: m.mapping }
            });
            console.log(`Updated mapping for ${m.provider} ${m.model || ''}`);
        } else {
            await db.schemaMapping.create({
                data: {
                    userId: systemUser.id,
                    provider: m.provider,
                    model: m.model || null,
                    mapping: m.mapping
                }
            });
            console.log(`Created mapping for ${m.provider} ${m.model || ''}`);
        }
    }

    console.log('Seeding complete.');
}

seedMappings()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
