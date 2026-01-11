import { createSync } from 'nango';
import type { JiraIssueType } from '../types.js';
import { toIssueTypes } from '../mappers/toIssueTypes.js';
import { getCloudData } from '../helpers/get-cloud-data.js';

import type { ProxyConfiguration } from 'nango';
import { IssueType, JiraIssueMetadata } from '../models.js';

/**
 * Fetches and processes Jira issue types data for a specific project.
 *
 * @param {NangoSync} nango - The NangoSync instance for handling synchronization tasks.
 */
const sync = createSync({
    description: 'Fetches a list of issue types for a project',
    version: '2.0.0',
    frequency: 'every day',
    autoStart: false,
    syncType: 'full',

    endpoints: [
        {
            method: 'GET',
            path: '/issue-types'
        }
    ],

    scopes: ['read:jira-work'],

    models: {
        IssueType: IssueType
    },

    metadata: JiraIssueMetadata,

    exec: async (nango) => {
        const cloud = await getCloudData(nango);

        const metadata = await nango.getMetadata();

        let projectsToSync: { id: string }[] = [];

        if (metadata && metadata.projectIdsToSync && metadata.projectIdsToSync.length > 0) {
            projectsToSync = metadata.projectIdsToSync;
        } else {
            // Fetch all projects if no specific projects are configured
            const projectsConfig: ProxyConfiguration = {
                endpoint: `/ex/jira/${cloud.cloudId}/rest/api/3/project/search`,
                params: {
                    properties: 'id'
                },
                paginate: {
                    type: 'offset',
                    offset_name_in_request: 'startAt',
                    response_path: 'values',
                    limit_name_in_request: 'maxResults',
                    limit: 50
                },
                headers: {
                    'X-Atlassian-Token': 'no-check'
                },
                retries: 10
            };

            for await (const projectBatch of nango.paginate<{ id: string }>(projectsConfig)) {
                projectsToSync.push(...projectBatch);
            }
        }

        for (const project of projectsToSync) {
            const projectId = project.id;
            const config: ProxyConfiguration = {
                //https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-types/#api-rest-api-3-issuetype-project-get
                endpoint: `/ex/jira/${cloud.cloudId}/rest/api/3/issuetype/project`,
                params: {
                    projectId: Number(projectId)
                },
                headers: {
                    'X-Atlassian-Token': 'no-check'
                },
                retries: 10
            };

            const issueTypeResponse = await nango.get<JiraIssueType[]>(config);
            const issueTypes = toIssueTypes(issueTypeResponse.data, projectId);
            if (issueTypes.length > 0) {
                await nango.batchSave(issueTypes, 'IssueType');
            }
        }
        await nango.deleteRecordsFromPreviousExecutions('IssueType');
    }
});

export type NangoSyncLocal = Parameters<(typeof sync)['exec']>[0];
export default sync;
