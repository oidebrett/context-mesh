import type { Mapper, NangoRecord, NormalizedData } from './types.js';

export const googleCalendarMapper: Mapper = {
    normalize(record: NangoRecord): NormalizedData {
        return {
            type: 'event',
            title: record['summary'] || 'Untitled Event',
            description: record['description'] || null,
            sourceUrl: record['htmlLink'] || null,
            mimeType: null,
            metadataNormalized: {
                start: record['start'] || null,
                end: record['end'] || null,
                location: record['location'] || null,
                attendees: record['attendees'] || []
            }
        };
    }
};
