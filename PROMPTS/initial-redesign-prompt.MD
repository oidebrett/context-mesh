## 🧠 **FULL IMPLEMENTATION PROMPT FOR THE AI CODING AGENT**

You are modifying an existing repository that already includes:

* A **frontend** running at: `http://localhost:3011`
* A **backend API** running at: `http://localhost:3010`
* Existing sample logic demonstrating file syncing (Google Drive via Nango)
* A working connection to **Nango Cloud**

You will enhance the existing system to support **multiple third-party integrations**, extract and standardize metadata, optionally summarize content using a local or cloud LLM, and expose the structured content via:

* Internal canonical URLs (one page per synced record)
* Schema.org JSON-LD metadata embedded in those pages
* A generated `sitemap.xml`
* An API endpoint suitable for RAG (vector similarity search)

---

### 🧩 **Current System State & Available Test Integrations**

Nango Cloud has already issued valid OAuth connections for the following providers:

| Customer                                            | Integration         | Connection ID                          | Status               |
| --------------------------------------------------- | ------------------- | -------------------------------------- | -------------------- |
| [ivo.brett@gmail.com](mailto:ivo.brett@gmail.com)   | **Zoho CRM**        | `89671e5f-4dcd-4177-ac69-0b594d87a1e6` | ✔️ Ready             |
| [ivo.brett@gmail.com](mailto:ivo.brett@gmail.com)   | **Google Calendar** | `98f03a1b-ec77-483c-8cb6-37eb2b0fc394` | ✔️ Ready             |
| [ivo.brett@gmail.com](mailto:ivo.brett@gmail.com)   | **Github**          | `d88889f1-8a3a-4e3b-a6e0-d9d86ed4108f` | ✔️ Ready             |
| [john.doe@example.com](mailto:john.doe@example.com) | **Google Drive**    | `d35b2a35-7096-4b3c-86fc-35d751a43949` | ✔️ Working & syncing |

Your first task is to **use these specific live integrations** to confirm:

* The system can fetch synced items via `nango.listRecords()`.
* The system can normalize them into a unified internal schema.
* The backend can register each synced item as an internal record.
* Each record generates an internal canonical URL like:

```
http://localhost:3010/item/:provider/:external_id
```

Example:

```
http://localhost:3010/item/google-drive/d35b2a35-7096-4b3c-86fc-35d751a43949/Quarterly_Plan.pdf
```

---

### 🏗 **Data Model Requirements**

Use the following Prisma schemas (generate migrations automatically if needed):

```prisma
model SyncedObject {
  id            String   @id @default(cuid())
  provider      String
  connectionId  String
  externalId    String
  objectType    String
  title         String?
  description   String?
  summary       String?      // generated (optional)
  url           String?
  mimeType      String?
  json          Json
  hash          String?      // used to detect unchanged objects
  embedding     Json?        // used for vector search
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([provider, externalId])
}

model TenantSettings {
  id              String   @id @default(cuid())
  userId          String
  enableSummaries Boolean  @default(false)
  llmMode         String   @default("local") // "local" | "cloud"
  updatedAt       DateTime @updatedAt
}
```

---

### 🧠 **Summarization Pipeline**

After syncing an item:

```
raw → normalize → upsert → (optional) summarize → (optional) embed → save
```

#### Summary Rules:

* Summaries are **120–200 words**
* Local LLM default: **MiniLM-L6-v2**, `mxbai-embed-large`, or similar small on-edge model
* Cloud fallback option: OpenAI or Anthropic
* If the record includes a downloadable document (PDF, DOCX, TXT), attempt text extraction (limit 50KB for safety)

#### Embedding:

Used for local RAG search.

Make it pluggable via:

```ts
interface Summarizer { summarize(text: string): Promise<string>; }
interface Embedder { embed(text: string): Promise<number[]>; }
```

---

### 📄 **Internal Canonical Page Rendering**

Each synced object must have:

* A Next.js rendered page (frontend)
* Schema.org JSON-LD embedded as `<script type="application/ld+json">`
* Summary displayed IF available
* Direct link back to original document source (Google Drive, GitHub, Zoho CRM, etc.)

---

### 🌍 **Generate `sitemap.xml`**

Expose this at:

```
GET http://localhost:3010/sitemap.xml
```

Rules:

* Every synced object must appear
* Use `<lastmod>` from synced metadata if available
* If summary exists and is meaningful, include a `<news:news>` block (optional future enrichment)

Example entry:

```xml
<url>
  <loc>http://localhost:3010/item/google-drive/d35b...</loc>
  <lastmod>2025-10-12T00:00:00Z</lastmod>
</url>
```

---

### 🔍 **Add Search API**

Add endpoint:

```
POST /api/search
{
  "query": "invoice onboarding Q4 plan"
}
```

Return top relevant results using vector similarity search.

---

### ✔️ Validation Check Using Live Data

Before completing the task, **verify the system works by pulling data from these integrations**:

* Google Drive → documents
* Zoho CRM → Accounts
* Github → Repos / Issues metadata
* Google Calendar → Events list

Ensure each provider successfully:

1. Syncs into DB
2. Appears in sitemap
3. Has a canonical metadata page
4. (If enabled) Generates a summary
5. Works in the search endpoint

---

### 📦 Deliverables

* Code implementing all features
* Database migrations
* Tests for sync, sitemap, summarization, and search endpoints
* README updates explaining setup and enabling summarization mode

---

---

