import fs from 'fs/promises';
import path from 'path';
import type { ConversionResult } from './pdfConverter.js';

/**
 * File-based storage service for PDF books.
 * Stores each book as a JSON file in a data directory.
 * This allows persistence across container restarts when using a volume mount.
 */
class BookStorageService {
    private dataDir: string;
    private books: Map<string, ConversionResult>;
    private initialized: boolean = false;

    constructor() {
        // Use DATA_DIR env var or default to ./data/books
        this.dataDir = process.env['DATA_DIR'] || path.join(process.cwd(), 'data', 'books');
        this.books = new Map();
    }

    /**
     * Initialize the storage service by loading all existing books from disk.
     * This should be called once at application startup.
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // Ensure data directory exists
            await fs.mkdir(this.dataDir, { recursive: true });
            
            // Load all existing book files
            const files = await fs.readdir(this.dataDir);
            const jsonFiles = files.filter(f => f.endsWith('.json'));
            
            console.log(`[BookStorage] Loading ${jsonFiles.length} books from ${this.dataDir}`);
            
            for (const file of jsonFiles) {
                try {
                    const filePath = path.join(this.dataDir, file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    const book: ConversionResult = JSON.parse(content);
                    this.books.set(book.bookId, book);
                    console.log(`[BookStorage] Loaded book: ${book.bookId} (${book.bookInfo.title})`);
                } catch (err) {
                    console.error(`[BookStorage] Failed to load ${file}:`, err);
                }
            }
            
            this.initialized = true;
            console.log(`[BookStorage] Initialized with ${this.books.size} books`);
        } catch (err) {
            console.error('[BookStorage] Initialization failed:', err);
            // Still mark as initialized to prevent infinite retries
            this.initialized = true;
        }
    }

    /**
     * Get a book by ID
     */
    get(bookId: string): ConversionResult | undefined {
        return this.books.get(bookId);
    }

    /**
     * Store a book (in memory and persist to disk)
     */
    async set(bookId: string, book: ConversionResult): Promise<void> {
        this.books.set(bookId, book);
        
        try {
            const filePath = path.join(this.dataDir, `${bookId}.json`);
            await fs.writeFile(filePath, JSON.stringify(book, null, 2), 'utf-8');
            console.log(`[BookStorage] Saved book: ${bookId} to ${filePath}`);
        } catch (err) {
            console.error(`[BookStorage] Failed to save book ${bookId}:`, err);
            throw err;
        }
    }

    /**
     * Delete a book (from memory and disk)
     */
    async delete(bookId: string): Promise<boolean> {
        if (!this.books.has(bookId)) {
            return false;
        }
        
        this.books.delete(bookId);
        
        try {
            const filePath = path.join(this.dataDir, `${bookId}.json`);
            await fs.unlink(filePath);
            console.log(`[BookStorage] Deleted book: ${bookId}`);
            return true;
        } catch (err) {
            console.error(`[BookStorage] Failed to delete book file ${bookId}:`, err);
            // Book was removed from memory, so still return true
            return true;
        }
    }

    /**
     * Get all books as an array
     */
    getAll(): ConversionResult[] {
        return Array.from(this.books.values());
    }

    /**
     * Get all books as entries (for compatibility with Map interface)
     */
    entries(): IterableIterator<[string, ConversionResult]> {
        return this.books.entries();
    }

    /**
     * Check if a book exists
     */
    has(bookId: string): boolean {
        return this.books.has(bookId);
    }

    /**
     * Get the number of stored books
     */
    get size(): number {
        return this.books.size;
    }
}

// Export a singleton instance
export const bookStorage = new BookStorageService();
