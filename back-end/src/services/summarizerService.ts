import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Interface for summarizer implementations
 */
export interface Summarizer {
    summarize(text: string, maxWords?: number): Promise<string>;
}

/**
 * Simple extractive summarizer (takes first N sentences)
 */
export class SimpleSummarizer implements Summarizer {
    async summarize(text: string, maxWords: number = 150): Promise<string> {
        if (!text || text.trim().length === 0) {
            return '';
        }

        // Split into sentences
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        
        let summary = '';
        let wordCount = 0;

        for (const sentence of sentences) {
            const words = sentence.trim().split(/\s+/);
            if (wordCount + words.length <= maxWords) {
                summary += sentence;
                wordCount += words.length;
            } else {
                break;
            }
        }

        return summary.trim() || text.substring(0, maxWords * 6); // Fallback: ~6 chars per word
    }
}

/**
 * LLM-based summarizer (placeholder for future implementation)
 */
export class LLMSummarizer implements Summarizer {
    private mode: 'local' | 'cloud';

    constructor(mode: 'local' | 'cloud' = 'local') {
        this.mode = mode;
    }

    async summarize(text: string, maxWords: number = 150): Promise<string> {
        // TODO: Implement LLM-based summarization
        // For now, fall back to simple summarizer
        console.log(`LLM summarization (${this.mode} mode) not yet implemented, using simple summarizer`);
        const simpleSummarizer = new SimpleSummarizer();
        return simpleSummarizer.summarize(text, maxWords);
    }
}

/**
 * Get the appropriate summarizer based on tenant settings
 */
export async function getSummarizer(userId: string): Promise<Summarizer | null> {
    const settings = await prisma.tenantSettings.findUnique({
        where: { userId }
    });

    if (!settings || !settings.enableSummaries) {
        return null;
    }

    if (settings.llmMode === 'local' || settings.llmMode === 'cloud') {
        return new LLMSummarizer(settings.llmMode);
    }

    return new SimpleSummarizer();
}

/**
 * Generate summary for a synced object
 */
export async function generateSummary(
    objectId: string,
    userId: string
): Promise<string | null> {
    const summarizer = await getSummarizer(userId);
    if (!summarizer) {
        return null;
    }

    const object = await prisma.syncedObject.findUnique({
        where: { id: objectId }
    });

    if (!object) {
        return null;
    }

    // Extract text from the object
    const text = extractTextFromObject(object);
    if (!text) {
        return null;
    }

    // Generate summary (120-200 words as per requirements)
    const summary = await summarizer.summarize(text, 200);
    
    // Update the object with the summary
    await prisma.syncedObject.update({
        where: { id: objectId },
        data: { summary }
    });

    return summary;
}

/**
 * Extract text content from a synced object
 */
function extractTextFromObject(object: any): string {
    const parts: string[] = [];

    if (object.title) {
        parts.push(object.title);
    }

    if (object.description) {
        parts.push(object.description);
    }

    // Try to extract text from JSON data
    if (object.json && typeof object.json === 'object') {
        const json = object.json as Record<string, any>;
        
        // Common text fields
        const textFields = ['content', 'body', 'text', 'description', 'summary', 'notes'];
        for (const field of textFields) {
            if (json[field] && typeof json[field] === 'string') {
                parts.push(json[field]);
            }
        }
    }

    return parts.join('\n\n');
}

