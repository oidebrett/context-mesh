
# 🚀 **Developer Instruction Prompt — Unified Sync + RAG Metadata System**

You are modifying an existing application that integrates external data sources (Google Drive, Slack, Salesforce, Zoho CRM, Workday, etc.) using **Nango**. The goal is to turn synced data into a unified knowledge layer with internal canonical pages, schema.org JSON-LD metadata, and a public dynamic sitemap used for downstream AI/RAG indexing.

You must **reuse existing code where possible**. Only remove or rewrite what cannot be adapted cleanly.

---

## 🏗️ System Purpose

Users should be able to:

1. Connect one or more integrations (Google Drive, Slack, Salesforce, Workday, etc.).
2. Choose whether the sync is:

   * **Selective** (e.g., Google Drive files, Slack users)
   * **Full Dataset Sync** (e.g., CRM contacts/accounts, Workday employee directory)
3. Let synced data automatically create internal structured metadata pages and appear in a dynamic `sitemap.xml`.

This metadata will later be used by a RAG system (not part of this task), so only **metadata** is embedded — not full documents.

---

## 🧠 Architectural Rules

### DO NOT USE background cron jobs or queue processors.

Instead:

* All data changes come from **Nango sync webhooks**.
* The existing webhook endpoint **MUST remain unchanged**:

```
POST /webhooks-from-nango
```

* The webhook must respond immediately with:

```json
{ "received": true }
```

Processing continues in **fire-and-forget async mode (Option 1)** such as:

```ts
await db.upsert(record);
setImmediate(() => handlePostProcessing(recordId));
```

---

## 📦 Data Model Specification

Create or update a table named **UnifiedObject** with these fields:

| Field                 | Purpose                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| `id (uuid)`           | Internal ID (canonical reference)                                      |
| `external_id`         | Identifier from the source provider                                    |
| `provider`            | e.g., `google_drive`, `slack`, `salesforce`, `workday`, etc.           |
| `connection_id`       | Nango connection ID for multi-account separation                       |
| `type`                | A normalized category (`file`, `employee`, `account`, `contact`, etc.) |
| `title`               | Best human-readable label                                              |
| `metadata_raw`        | Full original synced object from Nango                                 |
| `metadata_normalized` | Minimal structured fields needed for UI + JSON-LD                      |
| `canonical_url`       | Path format: `/item/[uuid]`                                            |
| `source_url`          | Deep link to original system                                           |
| `content_hash`        | SHA-256 hash to detect revision changes                                |
| `state`               | `active`, `deleted`                                                    |

---

## 🔄 Webhook Behavior Rules

| Condition                                      | Expected Action                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| New record                                     | Insert → generate metadata page → add sitemap entry               |
| Changed record (hash mismatch)                 | Update → regenerate metadata page + sitemap                       |
| Identical (hash match)                         | Skip processing                                                   |
| Deleted (`_nango_metadata.deleted_at` present) | Mark as deleted → remove from sitemap (DO NOT delete permanently) |

---

## 🗂 Sitemap Requirements

* Auto-generated dynamically from active `UnifiedObject` records.
* File must live at:

```
/sitemap.xml
```

* Example entry:

```xml
<url>
  <loc>https://app.com/item/1234</loc>
  <lastmod>2025-01-12T00:00:00Z</lastmod>
</url>
```

* Deleted items must be removed.

---

## 🧾 Internal Metadata Pages

Every unified object must have a route:

```
/item/[uuid]
```

This page must include:

* Human-friendly display
* Link to original source
* Provider type
* (Optional) downloadable info if applicable
* JSON-LD Schema.org metadata injected via:

```html
<script type="application/ld+json">
{ ... }
</script>
```

### Mapping rules for JSON-LD:

| Type                       | Schema.org Class             |
| -------------------------- | ---------------------------- |
| File (Google Drive)        | `CreativeWork` or `Document` |
| Slack User                 | `Person`                     |
| Workday Employee           | `EmployeeRole` + `Person`    |
| Salesforce / Zoho Accounts | `Organization`               |
| CRM Contacts               | `Person`                     |

Required JSON-LD fields:

* `name`
* `description` *(LLM optional, see below)*
* `identifier`
* `url` = internal canonical URL
* `sameAs` = source system deep link

---

## 🤖 Optional LLM Integration

If enabled in settings, attempt to:

* Summarize the object using a **local LLM** (e.g., Mistral, Phi-3-mini, Llama-Edge variant).
* Store the summary in the DB.
* Embed summary metadata into the vector store for future semantic search.

This processing must not block webhook execution.

---

## 🎨 UI Requirements

Reuse existing front-end where possible.

Current capabilities:

* Google Drive file picker
* Slack user picker

Add:

### 🔧 Integration Permissions UI

After connecting an integration, user sees:

```
Salesforce
[✔] Sync Accounts
[✔] Sync Contacts
[ ] Sync Opportunities (coming soon)

Workday
[✔] Sync Employees
```

No per-record selection for CRM or HR systems.

### 📂 Unified Browser Improvements

Extend existing Unified File Manager UI so it displays:

* Files
* Contacts
* Accounts
* Employees
* Slack users
* Other object types

Use existing filtering/search patterns.

---

## ♻ Reuse Requirements

Before writing new code, check the repository for:

* Existing Nango integration wrappers
* Existing DB insert/upsert logic
* Existing listing views
* Existing file metadata components

and **extend or refactor instead of creating redundant code.**

---

## 📌 Deliverables

✔ Backend webhook handler rewrite
✔ UnifiedObject model + migrations
✔ Incremental update logic (no deletes)
✔ Sitemap generator
✔ `/item/[uuid]` metadata page template
✔ JSON-LD generator utilities
✔ Optional LLM summarization & embeddings
✔ Updated unified browser UI
✔ Integration configuration UI
✔ Developer documentation (`/docs/integrations.md`)

---

## 🧪 Acceptance Tests

* Connect Google Drive → select a file → verify file exists at `/item/...`
* Connect Salesforce → enable "Accounts sync" → records appear in UI
* Check `/sitemap.xml` and confirm internal URLs are present
* Validate JSON-LD using Google Rich Results Test
* Update a record → verify its sitemap timestamp updates
* Delete a record from the provider → mark as `deleted`, remove from sitemap, keep page accessible with `"This record has been removed"` banner.

