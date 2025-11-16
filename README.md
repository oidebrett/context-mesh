# Nango Integration Server

A unified integration server that syncs documents and metadata from multiple cloud providers (Google Drive, Zoho CRM, Github, Google Calendar) and exposes them via a sitemap.xml for discovery by upstream systems.

## Features

- **Multi-Provider Sync**: Automatically syncs data from Google Drive, Zoho CRM, Github, and Google Calendar
- **Unified Data Model**: Normalizes provider-specific data into a consistent schema
- **Sitemap Generation**: Exposes all synced objects via standard sitemap.xml format
- **Canonical URLs**: Each synced object gets a unique URL with Schema.org JSON-LD metadata
- **Full-Text Search**: Search across all synced documents by title, description, and summary
- **Optional Summarization**: Pluggable summarization system (simple extractive or LLM-based)
- **Webhook Support**: Real-time updates when data changes in connected providers
- **Change Detection**: MD5 hashing to avoid re-syncing unchanged objects

## Architecture

```
┌─────────────────┐
│  Nango Cloud   │  OAuth + Data Syncing
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Integration    │  Fastify API Server
│     Server      │  - Sync Service
│                 │  - Normalization
│                 │  - Summarization
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │  Unified Data Storage
│   + Prisma ORM  │  - SyncedObject
│                 │  - TenantSettings
└─────────────────┘
```

## API Endpoints

### Core Endpoints

- `POST /sync-all` - Trigger sync of all configured integrations
- `GET /sitemap.xml` - Generate sitemap of all synced objects
- `GET /item/:provider/:connectionId/:externalId` - Canonical page for a synced object
- `POST /api/search` - Full-text search across synced objects

### Summarization Endpoints

- `POST /api/summarize` - Generate summary for a specific object or all objects
- `GET /api/settings/:userId` - Get tenant settings
- `PUT /api/settings/:userId` - Update tenant settings (enable/disable summaries)

### Legacy Endpoints

- `GET /integrations` - List available integrations
- `GET /connections` - List user connections
- `POST /connect-session` - Create OAuth connection session
- `DELETE /connection/:connectionId` - Delete a connection
- `POST /webhooks` - Receive webhooks from Nango

## Data Model

### SyncedObject

Unified storage for all synced items:

```typescript
{
  id: string              // Internal ID
  provider: string        // e.g., "google-drive", "github"
  connectionId: string    // Nango connection ID
  externalId: string      // Provider's ID for the object
  objectType: string      // e.g., "document", "repo", "event"
  title: string           // Display title
  description: string     // Short description
  summary: string         // Generated summary (optional)
  url: string             // Link to original source
  mimeType: string        // MIME type (for files)
  json: JSON              // Full provider-specific data
  hash: string            // MD5 hash for change detection
  embedding: JSON         // Vector embedding (for future use)
  createdAt: DateTime
  updatedAt: DateTime
}
```

### TenantSettings

Per-user configuration:

```typescript
{
  id: string
  userId: string
  enableSummaries: boolean  // Enable/disable summarization
  llmMode: string          // "local" or "cloud"
  updatedAt: DateTime
}
```

## Provider Normalization

The system normalizes data from different providers:

### Google Drive
- **Model**: `Document`
- **Maps to**: `objectType: "document"`
- **Extracts**: title (name), description, url (webViewLink), mimeType

### Zoho CRM
- **Model**: `Account`
- **Maps to**: `objectType: "account"`
- **Extracts**: title (Account_Name), description (Description)

### Github
- **Model**: `GithubRepo`
- **Maps to**: `objectType: "repository"`
- **Extracts**: title (name), description, url (html_url)

### Google Calendar
- **Model**: `Event`
- **Maps to**: `objectType: "event"`
- **Extracts**: title (summary), description, url (htmlLink)

## Summarization System

Pluggable interface with multiple implementations:

### SimpleSummarizer
- Extractive summarization (first N sentences)
- No external dependencies
- Fast and lightweight

### LLMSummarizer (Placeholder)
- Local or cloud-based LLM
- Generates 120-200 word summaries
- Requires implementation

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL
- Nango Cloud account

### Installation

```bash
# Install dependencies
cd back-end && npm install
cd ../front-end && npm install

# Set up database
cd back-end
npx prisma migrate dev

# Configure environment
cp ../.env.example ../.env
# Edit .env with your Nango credentials
```

### Running

```bash
# Start backend (port 3010)
cd back-end && npm run dev

# Start frontend (port 3011)
cd front-end && npm run dev
```

## Usage

### 1. Sync Data

```bash
curl -X POST http://localhost:3010/sync-all
```

### 2. View Sitemap

```bash
curl http://localhost:3010/sitemap.xml
```

### 3. Search Documents

```bash
curl -X POST http://localhost:3010/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"gateway"}'
```

### 4. Enable Summarization

```bash
curl -X PUT http://localhost:3010/api/settings/USER_ID \
  -H "Content-Type: application/json" \
  -d '{"enableSummaries":true,"llmMode":"local"}'
```

### 5. Generate Summaries

```bash
curl -X POST http://localhost:3010/api/summarize \
  -H "Content-Type: application/json" \
  -d '{"all":true,"userId":"USER_ID"}'
```

## Schema.org Integration

Each canonical page includes JSON-LD metadata:

```json
{
  "@context": "https://schema.org",
  "@type": "DigitalDocument",
  "name": "Document Title",
  "description": "Document description",
  "url": "http://localhost:3010/item/...",
  "dateCreated": "2025-11-16T10:00:00Z",
  "dateModified": "2025-11-16T10:00:00Z",
  "provider": {
    "@type": "Organization",
    "name": "google-drive"
  },
  "contentUrl": "https://docs.google.com/...",
  "encodingFormat": "application/pdf"
}
```

## Future Enhancements

- [ ] Vector similarity search with embeddings
- [ ] LLM-based summarization implementation
- [ ] Incremental sync (only changed objects)
- [ ] Rate limiting and caching
- [ ] Multi-tenant support
- [ ] Frontend UI for browsing synced objects
- [ ] Export to other formats (JSON, CSV)
- [ ] Advanced filtering and faceted search

## License

MIT

