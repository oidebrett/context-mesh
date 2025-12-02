import type { Mapper, NangoRecord, NormalizedData } from './types.js';

export const jiraMapper: Mapper = {
    normalize(record: NangoRecord): NormalizedData {
        const type = 'issue';
        const title = record['summary'] || 'Untitled';
        const description = record['description'] || null;
        const sourceUrl = record['webUrl'] || record['url'] || null;

        const metadataNormalized: any = {
            key: record['key'] || null,
            issueType: record['issueType'] || null,
            status: record['status'] || null,
            assignee: record['assignee'] || null,
            projectKey: record['projectKey'] || null,
            projectName: record['projectName'] || null,
            commentsCount: Array.isArray(record['comments']) ? record['comments'].length : 0
        };

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
