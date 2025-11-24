declare module 'node-summarizer' {
    class SummarizerManager {
        constructor(text: string, numSentences: number);
        getSummaryByRank(): Promise<{ summary: string }>;
    }

    const nodeSummarizer: {
        SummarizerManager: typeof SummarizerManager;
    };

    export default nodeSummarizer;
}

