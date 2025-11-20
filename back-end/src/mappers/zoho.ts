import type { Mapper, NangoRecord, NormalizedData } from './types.js';

export const zohoMapper: Mapper = {
    normalize(record: NangoRecord): NormalizedData {
        const extractZohoValue = (field: any): string | null => {
            if (!field) return null;
            if (typeof field === 'string') return field;
            if (typeof field === 'object' && field.name) return field.name;
            return null;
        };

        const zohoDomain = process.env['ZOHO_CRM_DOMAIN'] || 'com';
        const zohoOrgId = process.env['ZOHO_CRM_ORG_ID'] || '';

        let type = 'contact'; // Default
        let title = 'Untitled';
        let description = extractZohoValue(record['Description']) || null;
        let sourceUrl: string | null = null;
        let metadataNormalized: any = {
            zohoId: record.id,
            owner: record['Owner'] || null
        };

        // Infer type from fields or Nango model if available (we don't have model passed here, so infer)
        if (record['Account_Name'] !== undefined && record['Deal_Name'] === undefined) {
            // Likely Account or Contact. 
            // Accounts usually don't have 'Account_Name' field pointing to another account, but Contacts do.
            // However, Accounts have 'Account_Name' as their own name.
            // Let's look for specific fields.
            if (record['Industry'] !== undefined) {
                type = 'account';
                title = extractZohoValue(record['Account_Name']) || record['name'] || 'Untitled';
                sourceUrl = zohoOrgId ? `https://crm.zoho.${zohoDomain}/crm/${zohoOrgId}/tab/Accounts/${record.id}` : null;
                metadataNormalized.industry = extractZohoValue(record['Industry']) || null;
                metadataNormalized.phone = extractZohoValue(record['Phone']) || null;
                metadataNormalized.website = extractZohoValue(record['Website']) || null;
            } else {
                type = 'contact';
                title = extractZohoValue(record['Full_Name']) || record['name'] || 'Untitled';
                sourceUrl = zohoOrgId ? `https://crm.zoho.${zohoDomain}/crm/${zohoOrgId}/tab/Contacts/${record.id}` : null;
                metadataNormalized.email = extractZohoValue(record['Email']) || null;
                metadataNormalized.phone = extractZohoValue(record['Phone']) || null;
                metadataNormalized.account = extractZohoValue(record['Account_Name']) || null;
            }
        } else if (record['Deal_Name'] !== undefined) {
            type = 'deal';
            title = extractZohoValue(record['Deal_Name']) || record['name'] || 'Untitled';
            sourceUrl = zohoOrgId ? `https://crm.zoho.${zohoDomain}/crm/${zohoOrgId}/tab/Deals/${record.id}` : null;
            metadataNormalized.amount = record['Amount'] || null;
            metadataNormalized.stage = extractZohoValue(record['Stage']) || null;
            metadataNormalized.closingDate = record['Closing_Date'] || null;
            metadataNormalized.account = extractZohoValue(record['Account_Name']) || null;
        } else {
            // Fallback
            title = extractZohoValue(record['Full_Name']) || extractZohoValue(record['Account_Name']) || extractZohoValue(record['Subject']) || 'Untitled';
        }

        return {
            type,
            title,
            description,
            sourceUrl,
            mimeType: null,
            metadataNormalized
        };
    }
};
