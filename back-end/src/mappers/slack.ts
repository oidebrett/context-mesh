import type { Mapper, NangoRecord, NormalizedData } from './types.js';

export const slackMapper: Mapper = {
    normalize(record: NangoRecord): NormalizedData {
        return {
            type: 'contact', // Slack users map to contacts
            title: record['profile']?.['display_name'] || record['name'] || 'Unnamed User',
            description: record['profile']?.['real_name'] || null,
            sourceUrl: null, // Slack doesn't provide direct user URLs
            mimeType: null,
            metadataNormalized: {
                email: record['profile']?.['email'] || null,
                avatar: record['profile']?.['image_original'] || null,
                isBot: record['is_bot'] || false,
                teamId: record['team_id'] || null
            }
        };
    }
};
