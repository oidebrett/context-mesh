# Context Mesh

**Cloud Integration Hub for AI & RAG Systems**

Context Mesh is a unified data synchronization platform that aggregates content from cloud services (Google Drive, Salesforce, Zoho CRM, GitHub, Slack, OneDrive, Google Calendar, Workday) and exposes it via Schema.org-compliant metadata for downstream AI/RAG ingestion.

## Overview

Context Mesh acts as a **data collection layer** for AI systems that need to ingest and index content from multiple cloud platforms. It handles OAuth authentication, real-time synchronization, metadata normalization, and generates a sitemap-mesh.xml that RAG crawlers can use to discover and index content.

### Key Use Case

Your AI/RAG system needs to:
1. Access data from multiple cloud services (Google Drive, Salesforce, GitHub, etc.)
2. Get notified when data changes in real-time
3. Crawl and index content with structured metadata
4. Handle authentication and API complexity

**Context Mesh solves this** by providing a single integration point with:
- OAuth connections to 10+ cloud providers via Nango
- Real-time webhook-based synchronization
- Normalized Schema.org JSON-LD metadata on every page
- Standard sitemap-mesh.xml for crawler discovery
- Soft deletes and change detection (SHA-256 hashing)

## Features

### Core Capabilities

- **Multi-Provider OAuth**: Connect to Google Drive, OneDrive, Salesforce, Zoho CRM, GitHub, Slack, Google Calendar, Workday, and more via Nango
- **Real-Time Sync**: Webhook-based synchronization with fire-and-forget pattern for high throughput
- **Unified Data Model**: Normalizes provider-specific data into consistent `UnifiedObject` schema
- **Schema.org Metadata**: Every synced object gets a canonical URL serving JSON-LD metadata
- **Sitemap Generation**: Auto-generates sitemap-mesh.xml filtered by sync configuration
- **Change Detection**: SHA-256 content hashing to avoid unnecessary updates
- **Soft Deletes**: Preserves audit trail while removing deleted items from sitemap
- **Deep Links**: Constructs links back to original platform (Google Drive, Salesforce, Zoho CRM, etc.)
- **Configurable Sync**: Per-connection configuration of which data types to sync and include in sitemap
- **Dynamic Schema Mappings**: Flexible JSONata-based mappings to transform provider data into Schema.org JSON-LD
- **Web UI**: React-based interface for managing integrations, configuring mappings, and browsing synced data

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Cloud Providers                          │
│  Google Drive │ Salesforce │ Zoho CRM │ GitHub │ Slack │... │
└────────────────────────┬─────────────────────────────────────┘
                         │ OAuth + API Calls
                         ▼
                  ┌──────────────┐
                  │ Nango Cloud  │  Handles OAuth & Webhooks
                  └──────┬───────┘
                         │ Webhooks (sync events)
                         ▼
┌────────────────────────────────────────────────────────────┐
│              Context Mesh (Integration Hub)                │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │   Fastify    │  │    Sync      │  │  Normalization  │ │
│  │  API Server  │──│   Service    │──│     Engine      │ │
│  │  (Port 3010) │  │              │  │                 │ │
│  └──────────────┘  └──────────────┘  └─────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │           PostgreSQL + Prisma ORM                    │ │
│  │  - UnifiedObject (synced data)                       │ │
│  │  - ConnectionSyncConfig (sync preferences)           │ │
│  │  - TenantSettings (user settings)                    │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Exposes:                                                  │
│  • GET /sitemap-mesh.xml                                        │
│  • GET /item/{uuid} (Schema.org JSON-LD)                  │
│  • GET /api/unified-objects (browse API)                  │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │  RAG System  │  Crawls sitemap, extracts
                  │   Crawler    │  Schema.org metadata
                  └──────────────┘
```

## Supported Integrations

Context Mesh supports the following cloud providers organized by category:

### 📁 Storage
- **Google Drive** - Documents, spreadsheets, presentations
- **OneDrive** (Personal & Business) - Files and folders
- **Dropbox** - Files and folders

### 💼 CRM
- **Salesforce** - Accounts, Contacts, Opportunities
- **Zoho CRM** - Accounts, Contacts, Deals
- **HubSpot** - Companies, Contacts, Deals

### 💬 Communication
- **Slack** - Users, channels, messages
- **Microsoft Teams** - Teams, channels, messages

### 🔧 Project Management
- **GitHub** - Repositories, issues, pull requests
- **Jira** - Projects, issues, epics
- **Asana** - Projects, tasks

### 📅 Calendar
- **Google Calendar** - Events, calendars

### 👥 HR
- **Workday** - Employees, departments

## API Endpoints

### Public Endpoints (for RAG Crawlers)

- `GET /sitemap-mesh.xml` - Sitemap of all active synced objects (filtered by sync config)
- `GET /item/{uuid}` - Canonical page with Schema.org JSON-LD metadata
- `GET /api/search` - Search across synced objects (title, description)

### Integration Management

- `GET /integrations` - List available Nango integrations
- `GET /connections` - List user's OAuth connections
- `POST /connect-session` - Create OAuth connection session
- `DELETE /connection/{connectionId}` - Delete a connection
- `GET /api/connections/{connectionId}/sync-config` - Get sync configuration
- `PUT /api/connections/{connectionId}/sync-config` - Update sync configuration
- `GET /api/provider-data-types/{providerConfigKey}` - Get available data types for provider

### Data Access

- `GET /api/unified-objects` - Browse all synced objects with filtering
  - Query params: `type`, `provider`, `connectionId`, `state`, `search`
- `POST /sync-all` - Manually trigger sync for all connections

### Webhooks

- `POST /webhooks` - Receive sync webhooks from Nango (fire-and-forget pattern)

## Data Model

### UnifiedObject

Unified storage for all synced items across all providers:

```typescript
{
  id: string                    // UUID - used in canonical URLs
  provider: string              // e.g., "google-drive", "salesforce", "github"
  connectionId: string          // Nango connection ID
  externalId: string            // Provider's ID for the object
  type: string                  // e.g., "document", "account", "repository"
  title: string                 // Display title
  description: string | null    // Short description
  metadataRaw: JSON             // Full provider-specific data
  metadataNormalized: JSON      // Normalized metadata for Schema.org
  canonicalUrl: string          // /item/{uuid}
  sourceUrl: string | null      // Deep link to original platform
  contentHash: string           // SHA-256 hash for change detection
  state: string                 // "active" or "deleted"
  createdAt: DateTime
  updatedAt: DateTime
}
```

### ConnectionSyncConfig

Per-connection sync configuration:

```typescript
{
  id: string
  connectionId: string          // Nango connection ID
  dataType: string              // e.g., "document", "account", "contact"
  enabled: boolean              // Whether to sync this data type
  includeInSitemap: boolean     // Whether to include in sitemap-mesh.xml
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
  enableSummaries: boolean      // Enable/disable summarization (legacy)
  llmMode: string               // "local" or "cloud" (legacy)
  updatedAt: DateTime
}
```

## Provider Normalization

The system normalizes data from different providers into a unified schema:

### Google Drive
- **Nango Model**: `Document`
- **Maps to**: `type: "document"`
- **Extracts**: title (name), description, sourceUrl (webViewLink), mimeType
- **Deep Link**: Automatic from API response

### OneDrive
- **Nango Model**: `OneDriveFileSelection`
- **Maps to**: `type: "document"`
- **Extracts**: title (name), description, sourceUrl (webUrl), mimeType
- **Deep Link**: Automatic from API response

### Salesforce
- **Nango Models**: `Account`, `Contact`, `Opportunity`
- **Maps to**: `type: "account"`, `"contact"`, `"opportunity"`
- **Extracts**: title (Name), description (Description)
- **Deep Link**: Constructed from `SALESFORCE_INSTANCE_URL` env var

### Zoho CRM
- **Nango Models**: `ZohoCRMAccount`, `ZohoCRMContact`, `ZohoCRMDeal`
- **Maps to**: `type: "account"`, `"contact"`, `"deal"`
- **Extracts**: title (Account_Name/Full_Name/Deal_Name), description
- **Deep Link**: Constructed from `ZOHO_CRM_DOMAIN` and `ZOHO_CRM_ORG_ID` env vars
- **Special Handling**: Zoho returns object fields like `{name: "...", id: "..."}` - automatically extracts string value

### GitHub
- **Nango Models**: `GithubRepo`, `GithubIssue`
- **Maps to**: `type: "repository"`, `"issue"`
- **Extracts**: title (name/title), description, sourceUrl (html_url)
- **Deep Link**: Automatic from API response

### Slack
- **Nango Model**: `SlackUser`
- **Maps to**: `type: "user"`
- **Extracts**: title (real_name), description (profile.title)
- **Deep Link**: Not available (Slack doesn't provide user URLs)

### Google Calendar
- **Nango Model**: `Event`
- **Maps to**: `type: "event"`
- **Extracts**: title (summary), description, sourceUrl (htmlLink)
- **Deep Link**: Automatic from API response

## Setup

### Prerequisites

- **Node.js 20+**
- **PostgreSQL** (running on port 5632 by default, or configure in .env)
- **Nango Cloud Account** - Sign up at [nango.dev](https://nango.dev)
  - Create integrations for the providers you want to use
  - Get your `NANGO_SECRET_KEY` from environment settings

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd context-mesh
```

2. **Install dependencies**
```bash
# Install backend dependencies
cd back-end && npm install

# Install frontend dependencies
cd ../front-end && npm install
```

3. **Configure environment variables**
```bash
# Copy example files
cp .env.example .env
cp front-end/.env.example front-end/.env

# Edit .env with your configuration
nano .env
```

Required environment variables in `.env`:
```bash
DATABASE_URL="postgres://postgres:postgres@localhost:5632/postgres"
NANGO_SECRET_KEY="your-nango-secret-key-here"
BASE_URL="http://localhost:3010"
FRONTEND_URL="http://localhost:3011"
PORT="3010"

# Optional: For CRM deep links
ZOHO_CRM_DOMAIN="eu"  # or "com", "in", etc.
ZOHO_CRM_ORG_ID="org20110177769"
SALESFORCE_INSTANCE_URL="https://yourcompany.my.salesforce.com"
```

4. **Set up database**
```bash
cd back-end
cp .env.example .env
# Edit .env with your configuration
nano .env
```

Required environment variables in `.env`:
```bash
DATABASE_URL="postgres://postgres:postgres@localhost:5632/postgres"
```


4.1 **Initialize the database**

```bash
cd ..
docker compose up -d
``` 

Then
```bash
cd back-end
npm run db:migrate:dev
npx prisma db seed
```

5. **Build the projects**
```bash
# Build backend
cd ../back-end && npm run build

# Build frontend
cd ../front-end && npm run build
```

### Running

**Development mode:**
```bash
# Terminal 1: Start backend (port 3010)
cd back-end && npm run dev

# Terminal 2: Start frontend (port 3011)
cd front-end && npm run dev
```

**Production mode:**
```bash
# Terminal 1: Start backend
cd back-end && npm start

# Terminal 2: Start frontend
cd front-end && npm start
```

6. **External Access**
from the root directory run:
```bash
npm run webhooks-proxy
```

Copy the URL the command gave you and go to Environment Settings in nango. Set Webhook URL to ${URL}/webhooks-from-nango, e.g: https://tame-socks-warn.loca.lt/webhooks-from-nango.

Access the web UI at: http://localhost:3011

## Docker Deployment

Context Mesh is fully Dockerized and supports multi-platform builds (`amd64` and `arm64`).

### 1. Running with Docker Compose

The easiest way to run the entire stack (Database + App) is using Docker Compose.

1. **Configure Environment**: Ensure `.env` and `back-end/.env` files are present in the root and `back-end` directories respectively.
2. **Start the Stack**:
   ```bash
   docker compose up -d
   ```
3. **Automatic Migrations**: The container automatically runs `prisma migrate deploy` at startup, so your database schema will always be up to date.

Access the web UI at `http://localhost:3011`.

### 2. Building a New Image

After making changes to the codebase, you can build and push a new multi-platform image to Docker Hub:

1. **Ensure Docker Buildx is set up**:
   ```bash
   docker buildx create --use
   ```
2. **Build and Push**:
   ```bash
   docker buildx build --platform linux/amd64,linux/arm64 -t oideibrett/context-mesh:latest --push .
   ```

> [!NOTE]
> Replace `oideibrett/context-mesh:latest` with your own tag if necessary.

### 3. Development Mode with Docker Database

If you want to develop locally but use a Dockerized database:
```bash
npm run dev
```
This script will automatically run `docker compose up -d db` before starting the local development servers for the frontend and backend.

## Usage

### 1. Connect Integrations

1. Open the web UI at http://localhost:3011
2. Navigate to the **Integrations** page
3. Click **Connect** on any provider (e.g., Google Drive, Salesforce)
4. Complete the OAuth flow
5. Configure which data types to sync using the checkboxes

### 2. Automatic Synchronization

Once connected, Nango will automatically:
- Perform an initial sync of all configured data types
- Send webhooks to Context Mesh when data changes
- Context Mesh processes webhooks in real-time (fire-and-forget pattern)

### 3. Manual Sync (Optional)

Trigger a manual sync of all connections:
```bash
curl -X POST http://localhost:3010/sync-all
```

### 4. View Sitemap

The sitemap is automatically generated and updated:
```bash
curl http://localhost:3010/sitemap-mesh.xml
```

Example output:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>http://localhost:3010/item/cmi3icq70000wio76ut8anrif</loc>
    <lastmod>2025-11-17T16:59:01.103Z</lastmod>
  </url>
  ...
</urlset>
```

### 5. Access Canonical Pages

Each synced object has a canonical URL with Schema.org metadata:
```bash
curl http://localhost:3010/item/cmi3icq70000wio76ut8anrif
```

Returns HTML page with embedded JSON-LD:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "DigitalDocument",
  "name": "My Document",
  "description": "Document description",
  "url": "http://localhost:3010/item/cmi3icq70000wio76ut8anrif",
  "sameAs": "https://drive.google.com/file/d/...",
  ...
}
</script>
```

### 6. Browse Synced Data

Use the web UI or API to browse all synced objects:
```bash
# Get all documents
curl "http://localhost:3010/api/unified-objects?type=document"

# Search by title
curl "http://localhost:3010/api/unified-objects?search=report"

# Filter by provider
curl "http://localhost:3010/api/unified-objects?provider=google-drive"
```

## RAG System Integration

Context Mesh is designed to work seamlessly with RAG (Retrieval-Augmented Generation) systems:

### Integration Flow

1. **RAG Crawler** reads `http://localhost:3010/sitemap-mesh.xml`
2. **Crawler** visits each `<loc>` URL (e.g., `/item/{uuid}`)
3. **Crawler** extracts Schema.org JSON-LD from `<script type="application/ld+json">` tags
4. **RAG System** stores metadata and generates embeddings for semantic search
5. **RAG System** periodically re-crawls sitemap to detect changes/deletions

### Schema.org Metadata

Each canonical page includes comprehensive JSON-LD metadata:

```json
{
  "@context": "https://schema.org",
  "@type": "DigitalDocument",
  "name": "Q4 Sales Report",
  "description": "Quarterly sales analysis and projections",
  "identifier": "cmi3icq70000wio76ut8anrif",
  "url": "http://localhost:3010/item/cmi3icq70000wio76ut8anrif",
  "sameAs": "https://drive.google.com/file/d/1ABC.../view",
  "dateCreated": "2025-11-16T10:00:00.000Z",
  "dateModified": "2025-11-17T14:30:00.000Z",
  "provider": {
    "@type": "Organization",
    "name": "google-drive"
  },
  "encodingFormat": "application/pdf"
}
```

### Supported Schema.org Types

- **DigitalDocument** - Files from Google Drive, OneDrive
- **Organization** - Accounts from Salesforce, Zoho CRM
- **Person** - Contacts from Salesforce, Zoho CRM, Slack users
- **SoftwareSourceCode** - GitHub repositories
- **Event** - Google Calendar events
- **CreativeWork** - GitHub issues, deals, opportunities

### Change Detection

- **SHA-256 Content Hashing**: Only updates when content actually changes
- **Soft Deletes**: Deleted items removed from sitemap but preserved in database
- **lastmod in Sitemap**: RAG crawlers can use this to prioritize recent changes

## Configuration

### Sync Configuration

Control which data types are synced and included in sitemap per connection:

```bash
# Get current configuration
curl http://localhost:3010/api/connections/{connectionId}/sync-config

# Update configuration
curl -X PUT http://localhost:3010/api/connections/{connectionId}/sync-config \
  -H "Content-Type: application/json" \
  -d '{
    "document": {"enabled": true, "includeInSitemap": true},
    "account": {"enabled": true, "includeInSitemap": false}
  }'
```

### Environment Variables

See `.env.example` for full documentation. Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `NANGO_SECRET_KEY` - Your Nango API key
- `BASE_URL` - Backend URL for canonical URLs
- `FRONTEND_URL` - Frontend URL for CORS
- `ZOHO_CRM_DOMAIN` - Zoho CRM domain (eu, com, in, etc.)
- `ZOHO_CRM_ORG_ID` - Your Zoho CRM organization ID
- `SALESFORCE_INSTANCE_URL` - Your Salesforce instance URL

## Troubleshooting

### Webhooks Not Working

1. Check Nango webhook configuration points to your backend `/webhooks` endpoint
2. Verify `NANGO_SECRET_KEY` is correct
3. Check backend logs for webhook processing errors
4. Ensure firewall allows incoming webhooks from Nango

### Deep Links Not Working

1. For Zoho CRM: Set `ZOHO_CRM_DOMAIN` and `ZOHO_CRM_ORG_ID` in `.env`
2. For Salesforce: Set `SALESFORCE_INSTANCE_URL` in `.env`
3. Restart backend after changing environment variables

### Deletion Testing

**Known Issue**: Deletion testing may not work reliably. To test:
1. Delete a file/record from the source platform
2. Wait for Nango's incremental sync (or trigger manually)
3. Check if `state` changed to `'deleted'` in database
4. Verify item removed from sitemap-mesh.xml

If deletions aren't detected, check:
- Nango sync configuration has `track_deletes: true`
- Webhook payload includes `_nango_metadata.deleted_at` field
- Backend logs show "Marked as deleted" message

## Adding New Integrations

See [ADDING-INTEGRATIONS.md](./ADDING-INTEGRATIONS.md) for step-by-step guide.

## License

MIT

