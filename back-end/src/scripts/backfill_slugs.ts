import { db } from '../db.js';

function generateSlug(title: string, id: string): string {
    const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    // Append last 6 chars of ID to ensure uniqueness and stability
    const suffix = id.slice(-6);
    return `${slug}-${suffix}`;
}

async function main() {
    console.log('Backfilling slugs...');
    const objects = await db.unifiedObject.findMany({
        where: {
            slug: null
        }
    });

    console.log(`Found ${objects.length} objects without slug.`);

    for (const obj of objects) {
        const slug = generateSlug(obj.title || 'untitled', obj.id);
        await db.unifiedObject.update({
            where: { id: obj.id },
            data: {
                slug: slug,
                canonicalUrl: `/item/${slug}`
            }
        });
        console.log(`Updated ${obj.id} -> ${slug}`);
    }

    console.log('Done.');
}

main()
    .catch(console.error)
    .finally(() => db.$disconnect());
