import { twMerge } from 'tailwind-merge';
import { clsx, type ClassValue } from 'clsx';
import { QueryClient } from '@tanstack/react-query';

export const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3010';
export const apiUrl = process.env.NEXT_PUBLIC_NANGO_HOST ?? 'https://api.nango.dev';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const queryClient = new QueryClient();

// Provider categories for organization
export type ProviderCategory = 'storage' | 'crm' | 'communication' | 'project-management' | 'calendar' | 'hr';

export interface ProviderMetadata {
    key: string;
    category: ProviderCategory;
    supportsFilePicker?: boolean; // For storage providers with file selection UI
    requiresNangoSetup?: boolean; // If provider needs to be configured in Nango Cloud first
}

// Comprehensive provider configuration
export const PROVIDER_METADATA: Record<string, ProviderMetadata> = {
    'google-drive': {
        key: 'google-drive',
        category: 'storage',
        supportsFilePicker: true,
        requiresNangoSetup: false
    },
    'one-drive': {
        key: 'one-drive',
        category: 'storage',
        supportsFilePicker: true,
        requiresNangoSetup: false
    },
    'one-drive-personal': {
        key: 'one-drive-personal',
        category: 'storage',
        supportsFilePicker: true,
        requiresNangoSetup: false
    },
    'salesforce': {
        key: 'salesforce',
        category: 'crm',
        requiresNangoSetup: true
    },
    'zoho-crm': {
        key: 'zoho-crm',
        category: 'crm',
        requiresNangoSetup: true
    },
    'slack': {
        key: 'slack',
        category: 'communication',
        requiresNangoSetup: false
    },
    'github': {
        key: 'github',
        category: 'project-management',
        requiresNangoSetup: false
    },
    'google-calendar': {
        key: 'google-calendar',
        category: 'calendar',
        requiresNangoSetup: false
    },
    'workday': {
        key: 'workday',
        category: 'hr',
        requiresNangoSetup: true
    }
};

// All supported providers (extracted from metadata)
export const SUPPORTED_PROVIDERS = Object.keys(PROVIDER_METADATA);

// Category labels for UI
export const CATEGORY_LABELS: Record<ProviderCategory, string> = {
    'storage': 'Cloud Storage',
    'crm': 'CRM & Sales',
    'communication': 'Communication',
    'project-management': 'Project Management',
    'calendar': 'Calendar & Scheduling',
    'hr': 'Human Resources'
};

// Helper to get providers by category
export function getProvidersByCategory(category: ProviderCategory): string[] {
    return Object.values(PROVIDER_METADATA)
        .filter(p => p.category === category)
        .map(p => p.key);
}

// Helper to get all categories
export function getAllCategories(): ProviderCategory[] {
    return Array.from(new Set(Object.values(PROVIDER_METADATA).map(p => p.category)));
}
