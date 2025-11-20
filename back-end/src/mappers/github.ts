import type { Mapper, NangoRecord, NormalizedData } from './types.js';

export const githubMapper: Mapper = {
    normalize(record: NangoRecord): NormalizedData {
        let type = 'repository';
        let title = record['name'] || 'Untitled';
        let description = record['description'] || null;
        let sourceUrl = record['html_url'] || null;
        let metadataNormalized: any = {};

        // Check if it's an issue or repo based on fields
        if (record['number'] && record['state']) {
            type = 'issue';
            title = record['title'] || 'Untitled';
            description = record['body'] || null;
            metadataNormalized = {
                state: record['state'] || 'open',
                number: record['number'] || null,
                author: record['user']?.['login'] || null,
                repository: record['repository']?.['full_name'] || null
            };
        } else {
            // Repository
            type = 'repository';
            title = record['full_name'] || record['name'] || 'Untitled';
            metadataNormalized = {
                stars: record['stargazers_count'] || 0,
                language: record['language'] || null,
                isPrivate: record['private'] || false
            };
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
