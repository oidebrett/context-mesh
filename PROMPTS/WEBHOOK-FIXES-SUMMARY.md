# Webhook Handler Fixes & Deep Link Implementation

## Summary

Fixed three critical issues with the webhook handler and data synchronization:

1. **Webhook handler not supporting new provider types** (Zoho CRM, GitHub Issues, etc.)
2. **Missing deep links (sourceUrl) for CRM records** (Zoho CRM, Salesforce)
3. **Wrong port in UnifiedBrowser Actions link** (pointing to 3011 instead of 3010)

## Issues Fixed

### Issue 1: Unsupported Sync Models

**Problem:**
```
[back] [api] Webhook: received { model: 'ZohoCRMAccount', ... }
[back] [api] Unsupported sync model: ZohoCRMAccount ❌

[back] [api] Webhook: received { model: 'GithubIssue', ... }
[back] [api] Unsupported sync model: GithubIssue ❌
```

The webhook handler had hardcoded model types and only supported `Document`, `OneDriveFileSelection`, and `SlackUser`.

**Solution:**
- Updated `handleSyncWebhook()` to use the unified `syncIntegration()` function from `syncService.ts`
- This function already has logic to handle ALL provider types generically
- Now automatically processes any model type that Nango sends

**Files Changed:**
- `back-end/src/routes/postWebhooks.ts`

### Issue 2: Title Field Receiving Objects Instead of Strings

**Problem:**
```
Argument `title`: Invalid value provided. Expected String or Null, provided Object.
title: {
  name: "Chanay (Sample)",
  id: "912177000000528088"
}
```

Zoho CRM returns objects for many fields (e.g., `Account_Name: {name: "...", id: "..."}`), but we were trying to store them directly as strings.

**Solution:**
- Created `extractZohoValue()` helper function that extracts string values from Zoho's object fields
- Updated all Zoho CRM field extractions to use this helper
- Now properly handles both string and object field values

**Files Changed:**
- `back-end/src/services/syncService.ts`

### Issue 3: Missing Deep Links for CRM Records

**Problem:**
Records synced from Zoho CRM and Salesforce had `sourceUrl: null`, so users couldn't click through to view the original record in the CRM platform.

**Solution:**
- Added deep link URL construction for Zoho CRM records
  - Format: `https://crm.zoho.{domain}/crm/{orgId}/tab/{Module}/{recordId}`
  - Configurable via `ZOHO_CRM_DOMAIN` and `ZOHO_CRM_ORG_ID` environment variables
  - Supports Accounts, Contacts, and Deals

- Added deep link URL construction for Salesforce records
  - Format: `https://{instance}.salesforce.com/{recordId}`
  - Configurable via `SALESFORCE_INSTANCE_URL` environment variable
  - Supports Accounts, Contacts, and Opportunities

- Added support for `google-calendar-getting-started` provider variant

**Files Changed:**
- `back-end/src/services/syncService.ts`
- `.env.example` (created with documentation)

### Issue 4: Wrong Port in UnifiedBrowser Actions Link

**Problem:**
The "View" link in the UnifiedBrowser table was using relative URLs like `/item/{uuid}`, which resolved to `localhost:3011` (frontend) instead of `localhost:3010` (backend).

**Solution:**
- Imported `baseUrl` from `utils.ts` into `UnifiedBrowser.tsx`
- Changed `href={obj.canonicalUrl}` to `href={`${baseUrl}${obj.canonicalUrl}`}`
- Now correctly points to `http://localhost:3010/item/{uuid}`

**Files Changed:**
- `front-end/src/components/UnifiedBrowser.tsx`

## Configuration Required

To enable deep links for CRM systems, add these environment variables to your `.env` file:

### Zoho CRM
```bash
ZOHO_CRM_DOMAIN="eu"  # or "com", "in", "com.au", "jp", etc.
ZOHO_CRM_ORG_ID="org20110177769"  # Find this in your Zoho CRM URL
```

### Salesforce
```bash
SALESFORCE_INSTANCE_URL="https://yourcompany.my.salesforce.com"
```

See `.env.example` for complete documentation.

## What Now Works

✅ **All Provider Types Supported**
- Google Drive → `Document` model → files
- OneDrive → `OneDriveFileSelection` model → files
- Slack → `SlackUser` model → users/contacts
- **Zoho CRM → `ZohoCRMAccount` model → accounts** ✨
- **Zoho CRM → `ZohoCRMContact` model → contacts** ✨
- **Zoho CRM → `ZohoCRMDeal` model → deals** ✨
- **GitHub → `GithubIssue` model → issues** ✨
- GitHub → `GithubRepo` model → repositories
- Google Calendar → `Event` model → events
- **Salesforce → All models → appropriate types** ✨

✅ **Deep Links Working**
- Google Drive: ✅ (from API)
- OneDrive: ✅ (from API)
- GitHub: ✅ (from API)
- Google Calendar: ✅ (from API)
- **Zoho CRM: ✅ (constructed with env vars)** ✨
- **Salesforce: ✅ (constructed with env vars)** ✨
- Slack: ⚠️ (not available - Slack doesn't provide user URLs)

✅ **UnifiedBrowser Links**
- "View" link now correctly points to backend (localhost:3010)
- "Source" link opens original record in provider platform

## Testing

When you receive webhooks now, you should see:

```
[back] [api] Webhook: received { model: 'ZohoCRMAccount', ... }
[back] [api] Webhook: Sync results - processing via unified sync service
[back] [api] Syncing zoho-crm (...) - model: ZohoCRMAccount
[back] [api] Found 11 records for zoho-crm
[back] [api] Created new record: zoho-crm/912177000000528361 -> cmi3ed2i0000ka25tp4macc4u
[back] [api] Webhook sync complete: 11 synced, 0 errors ✅
```

And in the UnifiedBrowser, clicking "Source" will open:
```
https://crm.zoho.eu/crm/org20110177769/tab/Accounts/912177000000528361
```

## Files Modified

### Backend
- `back-end/src/routes/postWebhooks.ts` - Use unified sync service
- `back-end/src/services/syncService.ts` - Add Zoho/Salesforce deep links, fix object field extraction

### Frontend
- `front-end/src/components/UnifiedBrowser.tsx` - Fix Actions link port

### Configuration
- `.env.example` - Document new environment variables

## Build Status

✅ Backend: Compiled successfully (0 errors)
✅ Frontend: Compiled successfully (0 errors)

