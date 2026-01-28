import type { Mapper, NangoRecord, NormalizedData } from './types.js';

export const googleDriveMapper: Mapper = {
    normalize(record: NangoRecord): NormalizedData {
        const mimeType = record['mimeType'] || null;
        const isFolder = mimeType === 'application/vnd.google-apps.folder';

        return {
            type: isFolder ? 'folder' : 'file',
            title: record['title'] || record['name'] || 'Untitled',
            description: record['description'] || null,
            sourceUrl: record['url'] || record['webViewLink'] || null,
            mimeType,
            metadataNormalized: {
                fileName: record['title'] || record['name'] || 'Untitled',
                mimeType,
                size: record['size'] || null,
                modifiedTime: record['modifiedTime'] || record['updatedAt'] || null
            }
        };
    }
};
