# Adding New Integrations to Context Mesh

This guide explains how to add support for a new cloud provider to Context Mesh.

## Overview

Adding a new integration involves:
1. Configuring the provider in Nango Cloud
2. Adding provider metadata to Context Mesh
3. Implementing normalization logic
4. (Optional) Configuring deep link construction
5. Testing the integration

## Prerequisites

- Access to Nango Cloud dashboard
- Understanding of the provider's API and data models
- Provider API credentials (OAuth app, API keys, etc.)

## Step 1: Configure Provider in Nango Cloud

### 1.1 Create Integration in Nango

1. Log in to [Nango Cloud](https://app.nango.dev)
2. Navigate to **Integrations** → **Create Integration**
3. Select your provider from the list (or create custom integration)
4. Configure OAuth settings:
   - Client ID
   - Client Secret
   - Scopes required
   - Redirect URL

### 1.2 Create Sync Configuration

1. In your integration, create a new **Sync**
2. Define the sync name (e.g., `documents`, `accounts`, `contacts`)
3. Specify the data model (e.g., `Document`, `Account`, `Contact`)
4. Write the sync script to fetch data from the provider's API
5. Test the sync with a sample connection

Example sync script structure:
```typescript
export async function fetchDocuments(nango: NangoSync) {
    const response = await nango.get({
        endpoint: '/api/v1/documents'
    });
    
    const documents = response.data.map(doc => ({
        id: doc.id,
        name: doc.name,
        description: doc.description,
        // ... other fields
    }));
    
    await nango.batchSave(documents, 'Document');
}
```

### 1.3 Deploy Integration

1. Deploy your integration in Nango Cloud
2. Note the **Provider Config Key** (e.g., `my-provider`)
3. Configure webhook URL to point to your Context Mesh backend: `https://your-domain.com/webhooks`

## Step 2: Add Provider Metadata to Context Mesh

Edit `front-end/src/utils.ts` and add your provider to `PROVIDER_METADATA`:

```typescript
export const PROVIDER_METADATA: Record<string, ProviderMetadata> = {
    // ... existing providers
    
    'my-provider': {
        name: 'My Provider',
        category: 'storage', // or 'crm', 'communication', 'project-management', 'calendar', 'hr'
        description: 'Connect to My Provider to sync your data',
        icon: '📦', // Choose an appropriate emoji or icon
        dataTypes: [
            { key: 'document', label: 'Documents', defaultEnabled: true, defaultInSitemap: true },
            { key: 'folder', label: 'Folders', defaultEnabled: false, defaultInSitemap: false }
        ]
    }
};
```

### Provider Metadata Fields

- **name**: Display name shown in UI
- **category**: One of: `storage`, `crm`, `communication`, `project-management`, `calendar`, `hr`
- **description**: Short description shown in integration card
- **icon**: Emoji or icon identifier
- **dataTypes**: Array of data types this provider can sync
  - **key**: Internal identifier (must match Nango model name in lowercase)
  - **label**: Display name in UI
  - **defaultEnabled**: Whether to enable sync by default
  - **defaultInSitemap**: Whether to include in sitemap by default

## Step 3: Implement Normalization Logic

Edit `back-end/src/services/syncService.ts` and add normalization logic in the `normalizeRecord` function:

```typescript
function normalizeRecord(
    provider: string,
    connectionId: string,
    record: any,
    model: string
): Omit<UnifiedObject, 'id' | 'createdAt' | 'updatedAt'> {
    // ... existing code
    
    // Add your provider
    if (provider === 'my-provider') {
        if (model === 'Document') {
            return {
                provider,
                connectionId,
                externalId: record.id,
                type: 'document',
                title: record.name || 'Untitled',
                description: record.description || null,
                metadataRaw: record,
                metadataNormalized: {
                    '@type': 'DigitalDocument',
                    name: record.name,
                    description: record.description,
                    dateCreated: record.created_at,
                    dateModified: record.updated_at,
                    encodingFormat: record.mime_type
                },
                canonicalUrl: `/item/${generateUUID()}`, // Will be set by upsert logic
                sourceUrl: record.web_url || null, // Deep link to original
                contentHash: '', // Will be calculated
                state: record._nango_metadata?.deleted_at ? 'deleted' : 'active'
            };
        }
    }
    
    // ... rest of code
}
```

### Normalization Guidelines

1. **Always extract these fields**:
   - `externalId`: Provider's unique ID for the object
   - `type`: Lowercase data type (e.g., 'document', 'account', 'contact')
   - `title`: Display name (fallback to 'Untitled' if missing)
   - `description`: Short description (can be null)

2. **metadataRaw**: Store the complete provider response for future reference

3. **metadataNormalized**: Map to Schema.org types:
   - Files → `DigitalDocument`
   - Accounts/Companies → `Organization`
   - Contacts/Users → `Person`
   - Repositories → `SoftwareSourceCode`
   - Events → `Event`
   - Issues/Tasks → `CreativeWork`

4. **sourceUrl**: Deep link back to the original platform (see Step 4)

5. **state**: Check for `record._nango_metadata?.deleted_at` to handle soft deletes

## Step 4: Configure Deep Link Construction (Optional)

If the provider's API doesn't return a direct web URL, you'll need to construct it.

### 4.1 Add Environment Variables

Add to `.env.example` and `.env`:
```bash
# My Provider Configuration
MY_PROVIDER_BASE_URL="https://app.myprovider.com"
MY_PROVIDER_ORG_ID="your-org-id"
```

### 4.2 Construct Deep Links

In `syncService.ts`, construct the URL:
```typescript
sourceUrl: `${process.env['MY_PROVIDER_BASE_URL']}/documents/${record.id}` || null
```

Example for complex URLs (like Zoho CRM):
```typescript
const domain = process.env['ZOHO_CRM_DOMAIN'] || 'com';
const orgId = process.env['ZOHO_CRM_ORG_ID'];
sourceUrl: orgId 
    ? `https://crm.zoho.${domain}/crm/${orgId}/tab/Accounts/${record.id}`
    : null
```

## Step 5: Test the Integration

### 5.1 Build and Restart

```bash
# Build backend
cd back-end && npm run build

# Build frontend
cd front-end && npm run build

# Restart servers
# Terminal 1
cd back-end && npm run dev

# Terminal 2
cd front-end && npm run dev
```

### 5.2 Connect Provider

1. Open http://localhost:3011
2. Navigate to **Integrations**
3. Find your provider and click **Connect**
4. Complete OAuth flow
5. Configure data types to sync

### 5.3 Verify Sync

1. Check backend logs for sync activity
2. Query the database:
```sql
SELECT * FROM "UnifiedObject" WHERE provider = 'my-provider';
```
3. Check sitemap.xml:
```bash
curl http://localhost:3010/sitemap.xml | grep my-provider
```
4. Access a canonical URL:
```bash
curl http://localhost:3010/item/{uuid}
```

### 5.4 Test Webhooks

1. Make a change in the provider (create/update/delete a record)
2. Wait for Nango to send webhook (or trigger manual sync)
3. Check backend logs for webhook processing
4. Verify changes reflected in database and sitemap

## Common Issues

### Issue: Provider not showing in UI

**Solution**: Check that you added the provider to `PROVIDER_METADATA` in `front-end/src/utils.ts` and rebuilt the frontend.

### Issue: Sync fails with "Unsupported model"

**Solution**: Add normalization logic for the model in `back-end/src/services/syncService.ts`.

### Issue: Deep links not working

**Solution**: Verify environment variables are set and backend was restarted after changes.

### Issue: Objects not appearing in sitemap

**Solution**: Check that `includeInSitemap` is true in the sync configuration for that data type.

## Example: Adding Dropbox

Here's a complete example of adding Dropbox support:

**1. Nango Configuration**:
- Provider: Dropbox
- Sync: `files`
- Model: `DropboxFile`

**2. Provider Metadata** (`front-end/src/utils.ts`):
```typescript
'dropbox': {
    name: 'Dropbox',
    category: 'storage',
    description: 'Sync files and folders from Dropbox',
    icon: '📦',
    dataTypes: [
        { key: 'file', label: 'Files', defaultEnabled: true, defaultInSitemap: true }
    ]
}
```

**3. Normalization** (`back-end/src/services/syncService.ts`):
```typescript
if (provider === 'dropbox' && model === 'DropboxFile') {
    return {
        provider,
        connectionId,
        externalId: record.id,
        type: 'document',
        title: record.name || 'Untitled',
        description: null,
        metadataRaw: record,
        metadataNormalized: {
            '@type': 'DigitalDocument',
            name: record.name,
            encodingFormat: record.mime_type,
            dateModified: record.server_modified
        },
        canonicalUrl: `/item/${generateUUID()}`,
        sourceUrl: record.sharing_info?.url || null,
        contentHash: '',
        state: record._nango_metadata?.deleted_at ? 'deleted' : 'active'
    };
}
```

**4. Test**: Connect Dropbox, sync files, verify in sitemap.

## Need Help?

- Check existing provider implementations in `syncService.ts` for reference
- Review Nango documentation: https://docs.nango.dev
- Check Context Mesh logs for detailed error messages

