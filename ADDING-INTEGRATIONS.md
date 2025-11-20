# Adding New Integrations

This guide explains how to add support for a new Nango integration to Context Mesh.

## Overview

Context Mesh uses a "Mapper" pattern to normalize data from different Nango integrations into a unified schema (`UnifiedObject`). To add a new integration, you simply need to create a new mapper and register it.

## Steps

### 1. Create a Mapper

Create a new file in `back-end/src/mappers/` (e.g., `my-integration.ts`).
Implement the `Mapper` interface:

```typescript
import type { Mapper, NangoRecord, NormalizedData } from './types.js';

export const myIntegrationMapper: Mapper = {
    normalize(record: NangoRecord): NormalizedData {
        return {
            type: 'contact', // or 'file', 'account', etc.
            title: record['name'] || 'Untitled',
            description: record['description'] || null,
            sourceUrl: record['url'] || null,
            mimeType: null,
            metadataNormalized: {
                // Add any specific fields you want to expose in the JSON-LD
                customField: record['custom_field']
            }
        };
    }
};
```

### 2. Register the Mapper

Open `back-end/src/mappers/index.ts` and add your new mapper to the `MAPPERS` object:

```typescript
import { myIntegrationMapper } from './my-integration.js';

export const MAPPERS: Record<string, Mapper> = {
    // ... existing mappers
    'my-integration-provider-key': myIntegrationMapper
};
```

The key in the `MAPPERS` object must match the **Provider Config Key** in Nango.

### 3. (Optional) Update `syncService.ts` Model Mapping

If your integration uses a model name that isn't automatically handled or needs specific logic in `getModelForProvider`, update `back-end/src/services/syncService.ts`:

```typescript
function getModelForProvider(provider: string): string | null {
    const modelMap: Record<string, string> = {
        // ... existing mappings
        'my-integration-provider-key': 'MyModelName'
    };
    return modelMap[provider] || null;
}
```

## Verification

1.  Configure the integration in Nango.
2.  Trigger a sync.
3.  Check the logs to ensure the mapper is being used and data is normalized correctly.
4.  Verify the item appears in `sitemap.xml` and has a valid `/item/:uuid` page.
