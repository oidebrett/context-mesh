
import { db } from './db.js';

const defaultMappings = [
  {
    provider: 'google-drive',
    mapping: `{
  "@context": "https://schema.org",
  "@type": "DigitalDocument",
  "name": title,
  "headline": title,
  "description": title,
  "url": url,
  "sameAs": url,
  "identifier": id,
  "dateCreated": updatedAt,
  "dateModified": updatedAt,
  "datePublished": updatedAt,
  "encodingFormat": mimeType,
  "fileFormat": mimeType,
  "inLanguage": "en",
  "provider": {"@type": "Organization", "name": "Google Drive"}
}`
  },
  {
    provider: 'one-drive',
    mapping: `{
  "@context": "https://schema.org",
  "@type": "DigitalDocument",
  "name": name,
  "url": path, 
  "identifier": id,
  "dateCreated": created_at,
  "dateModified": updated_at,
  "encodingFormat": mime_type,
  "fileFormat": mime_type,
  "inLanguage": "en",
  "provider": {"@type": "Organization", "name": "OneDrive"}
}    
`
  },
  {
    provider: 'one-drive-personal',
    mapping: `{
  "@context": "https://schema.org",
  "@type": "DigitalDocument",
  "name": name,
  "url": path, 
  "identifier": id,
  "dateCreated": created_at,
  "dateModified": updated_at,
  "encodingFormat": mime_type,
  "fileFormat": mime_type,
  "inLanguage": "en",
  "provider": {"@type": "Organization", "name": "OneDrive Personal"},
  "additionalProperty": {
    "@type": "PropertyValue",
    "name": "raw_source",
    "value": raw_source
  }
}`
  },
  {
    provider: 'jira',
    model: 'Project',
    mapping: `{
  "@context": "https://schema.org",
  "@type": "Project",
  "name": name,
  "identifier": id,
  "url": webUrl,
  "sameAs": webUrl,
  "description": description,
  "additionalProperty": [
    {"@type": "PropertyValue", "name": "projectType", "value": projectTypeKey},
    {"@type": "PropertyValue", "name": "key", "value": key}
  ],
  "provider": {"@type": "Organization", "name": "Jira"}
}`
  },
  {
    provider: 'jira',
    model: 'Issue',
    mapping: `{
  "@context": "https://schema.org",
  "@type": "DiscussionForumPosting",
  "headline": summary,
  "articleBody": description,
  "url": webUrl,
  "identifier": key,
  "dateCreated": createdAt,
  "dateModified": updatedAt,
  "author": {"@type": "Person", "name": creator.displayName},
  "provider": {"@type": "Organization", "name": "Jira"},
  "additionalProperty": [
    {"@type":"PropertyValue","name":"Status","value":status},
    {"@type":"PropertyValue","name":"Priority","value":priority},
    {"@type":"PropertyValue","name":"IssueType","value":issueType},
    {"@type":"PropertyValue","name":"ProjectKey","value":projectKey},
    {"@type":"PropertyValue","name":"ProjectName","value":projectName}
  ],
  "comment": comments.{
    "@type": "Comment",
    "author": {"@type": "Person", "name": author.displayName},
    "dateCreated": createdAt,
    "dateModified": updatedAt,
    "identifier": id,
    "text": $join(body.content[type="paragraph"].content[type="text"].text, " ")
  }
}`
  },
  {
    provider: 'github',
    model: 'Issue',
    mapping: `{
  "@context": "https://schema.org",
  "@type": "DiscussionForumPosting",
  "headline": title,
  "articleBody": body,
  "url": "https://github.com/" & owner & "/" & repo & "/issues/" & $string(issue_number),
  "identifier": $string(id),
  "dateCreated": date_created,
  "dateModified": date_last_modified,
  "author": {"@type": "Person", "name": author},
  "provider": {"@type": "Organization", "name": "GitHub"},
  "additionalProperty": [
    {"@type":"PropertyValue","name":"State","value":state},
    {"@type":"PropertyValue","name":"Repository","value":owner & "/" & repo},
    {"@type":"PropertyValue","name":"IssueNumber","value":$string(issue_number)}
  ]
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
