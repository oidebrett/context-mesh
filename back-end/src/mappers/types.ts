

export interface NangoRecord {
    id?: string;
    _nango_metadata: {
        first_seen_at: string;
        last_modified_at: string;
        deleted_at?: string;
    };
    [key: string]: any;
}

export interface NormalizedData {
    type: string;
    title: string;
    description: string | null;
    sourceUrl: string | null;
    mimeType: string | null;
    metadataNormalized: Record<string, any>;
}

export interface Mapper {
    normalize(record: NangoRecord): NormalizedData;
}
