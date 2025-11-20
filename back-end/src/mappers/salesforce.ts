import type { Mapper, NangoRecord, NormalizedData } from './types.js';

export const salesforceMapper: Mapper = {
    normalize(record: NangoRecord): NormalizedData {
        const salesforceInstance = process.env['SALESFORCE_INSTANCE_URL'] || '';
        const sourceUrl = salesforceInstance
            ? `${salesforceInstance}/${record['Id'] || record.id}`
            : null;

        // Determine type based on attributes or context (passed in record usually, but here we infer)
        // Note: In the original code, 'model' was passed. We might need to adjust the interface if we need 'model'
        // For now, we'll infer from fields or default to 'contact' if ambiguous, but better to check fields.

        let type = 'unknown';
        let title = 'Untitled';
        let description = record['Description'] || null;
        let metadataNormalized: any = {
            salesforceId: record['Id'] || record.id,
            owner: record['Owner'] || null
        };

        if (record['attributes'] && record['attributes']['type']) {
            const attrType = record['attributes']['type'].toLowerCase();
            if (attrType === 'account') {
                type = 'account';
                title = record['Name'] || 'Untitled';
                metadataNormalized.industry = record['Industry'] || null;
                metadataNormalized.phone = record['Phone'] || null;
                metadataNormalized.website = record['Website'] || null;
            } else if (attrType === 'contact') {
                type = 'contact';
                title = record['Name'] || `${record['FirstName'] || ''} ${record['LastName'] || ''}`.trim() || 'Untitled';
                metadataNormalized.email = record['Email'] || null;
                metadataNormalized.phone = record['Phone'] || null;
                metadataNormalized.account = record['Account']?.['Name'] || null;
            } else if (attrType === 'opportunity') {
                type = 'opportunity';
                title = record['Name'] || 'Untitled';
                metadataNormalized.amount = record['Amount'] || null;
                metadataNormalized.stage = record['StageName'] || null;
                metadataNormalized.closeDate = record['CloseDate'] || null;
                metadataNormalized.account = record['Account']?.['Name'] || null;
            } else {
                type = attrType;
                title = record['Name'] || record['Title'] || 'Untitled';
            }
        } else {
            // Fallback inference if attributes.type is missing (though Nango usually provides it)
            if (record['StageName']) {
                type = 'opportunity';
                title = record['Name'] || 'Untitled';
            } else if (record['Industry']) {
                type = 'account';
                title = record['Name'] || 'Untitled';
            } else {
                type = 'contact';
                title = record['Name'] || `${record['FirstName'] || ''} ${record['LastName'] || ''}`.trim() || 'Untitled';
            }
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
