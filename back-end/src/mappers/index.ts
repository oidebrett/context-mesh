import { googleDriveMapper } from './google-drive.js';
import { salesforceMapper } from './salesforce.js';
import { githubMapper } from './github.js';
import { zohoMapper } from './zoho.js';
import { slackMapper } from './slack.js';
import { googleCalendarMapper } from './google-calendar.js';
import type { Mapper } from './types.js';

export const MAPPERS: Record<string, Mapper> = {
    'google-drive': googleDriveMapper,
    'salesforce': salesforceMapper,
    'github': githubMapper,
    'github-getting-started': githubMapper,
    'zoho-crm': zohoMapper,
    'slack': slackMapper,
    'google-calendar': googleCalendarMapper,
    'google-calendar-getting-started': googleCalendarMapper
};

export * from './types.js';
