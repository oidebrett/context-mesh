import type { Mapper, NangoRecord, NormalizedData } from './types.js';

export const googleDriveMapper: Mapper = {
    normalize(record: NangoRecord): NormalizedData {
        return {
            type: 'file',
            title: record['title'] || record['name'] || 'Untitled',
            description: record['description'] || null,
            sourceUrl: record['url'] || record['webViewLink'] || null,
            mimeType: record['mimeType'] || null,
            metadataNormalized: {
                fileName: record['title'] || record['name'] || 'Untitled',
                mimeType: record['mimeType'] || null,
                size: record['size'] || null,
                modifiedTime: record['modifiedTime'] || record['updatedAt'] || null
            }
        };
    }
};
