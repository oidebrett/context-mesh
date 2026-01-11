import type { Mapper, NangoRecord, NormalizedData } from './types.js';

export const jiraMapper: Mapper = {
    normalize(record: NangoRecord, model?: string): NormalizedData {
        if (model === 'Project') {
            return {
                type: 'project',
                title: record['name'] || 'Untitled Project',
                description: null,
                sourceUrl: null, // Projects might not have a direct webUrl in the record, or we need to construct it
                mimeType: null,
                metadataNormalized: {
                    key: record['key'],
                    projectTypeKey: record['projectTypeKey'],
                    id: record['id']
                }
            };
        }

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
