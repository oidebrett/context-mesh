import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { convertPdfToHtmlBook, type ConversionResult } from '../services/pdfConverter.js';
import { ipAllowlistMiddleware } from '../middleware/ipAllowlist.js';

// In-memory storage for processed PDFs
// Note: In a production environment, this should be persisted in a database
const processedBooks = new Map<string, ConversionResult>();

export async function pdfBookRoutes(fastify: FastifyInstance) {
    // API Routes

    // Get book info
    fastify.get<{ Params: { bookId: string } }>('/api/book/:bookId', async (req, reply) => {
        const book = processedBooks.get(req.params.bookId);
        if (!book) {
            return reply.status(404).send({ error: 'Book not found' });
        }
        return {
            bookInfo: book.bookInfo,
            pageCount: book.pages.length,
            sitemapUrl: `/book/${req.params.bookId}/sitemap.xml`
        };
    });

    // Get a specific page HTML
    // Restricted to allowed IP addresses as requested
    fastify.get<{ Params: { bookId: string, pageNum: string } }>('/book/:bookId/page/:pageNum', { preHandler: ipAllowlistMiddleware }, async (req, reply) => {
        const book = processedBooks.get(req.params.bookId);
        if (!book) {
            return reply.status(404).send('Book not found');
        }

        const pageNum = parseInt(req.params.pageNum);
        const page = book.pages.find(p => p.pageNum === pageNum);

        if (!page) {
            return reply.status(404).send('Page not found');
        }

        return reply.type('text/html').send(page.html);
    });

    // Get sitemap
    // Restricted to allowed IP addresses as requested
    fastify.get<{ Params: { bookId: string } }>('/book/:bookId/sitemap.xml', { preHandler: ipAllowlistMiddleware }, async (req, reply) => {
        const book = processedBooks.get(req.params.bookId);
        if (!book) {
            return reply.status(404).send('Book not found');
        }
        return reply.type('application/xml').send(book.sitemap);
    });

    // Get RSS feed
    // Restricted to allowed IP addresses as requested
    fastify.get<{ Params: { bookId: string } }>('/book/:bookId/rss.xml', { preHandler: ipAllowlistMiddleware }, async (req, reply) => {
        const book = processedBooks.get(req.params.bookId);
        if (!book) {
            return reply.status(404).send('Book not found');
        }

        const baseUrl = process.env['BASE_URL'] || 'http://localhost:3010';
        const pubDate = new Date().toISOString();

        const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${book.bookInfo.title}</title>
    <link>${baseUrl}/book/${book.bookId}</link>
    <description>Pages from ${book.bookInfo.title}</description>
    <language>en-us</language>
    <lastBuildDate>${pubDate}</lastBuildDate>
    <atom:link href="${baseUrl}/book/${book.bookId}/rss.xml" rel="self" type="application/rss+xml"/>
${book.pages.map(page => `    <item>
      <title>${page.jsonLd.name}</title>
      <link>${baseUrl}${page.url}</link>
      <description><![CDATA[${page.jsonLd.description || ''}]]></description>
      <guid isPermaLink="false">${baseUrl}${page.url}</guid>
      <pubDate>${new Date(book.bookInfo.processedAt).toUTCString()}</pubDate>
    </item>`).join('\n')}
  </channel>
</rss>`;

        return reply.type('application/xml').send(rss);
    });

    // Get all books
    fastify.get('/api/books', async (_req, _reply) => {
        const books = Array.from(processedBooks.entries()).map(([id, book]) => ({
            bookId: id,
            bookInfo: book.bookInfo,
            pageCount: book.pages.length
        }));
        return { books };
    });

    // Delete a book
    fastify.delete<{ Params: { bookId: string } }>('/api/book/:bookId', async (req, reply) => {
        if (processedBooks.delete(req.params.bookId)) {
            return { success: true };
        } else {
            return reply.status(404).send({ error: 'Book not found' });
        }
    });

    // Handle PDF upload
    fastify.post('/api/upload-pdf', async (req: FastifyRequest, reply: FastifyReply) => {
        const data = await req.file();
        if (!data) {
            return reply.status(400).send({ error: 'No PDF file uploaded' });
        }

        const buffer = await data.toBuffer();
        const fields = (data as any).fields;

        const options = {
            title: fields?.title?.value,
            author: fields?.author?.value,
            id: fields?.bookId?.value
        };

        try {
            const result = await convertPdfToHtmlBook(buffer, options);
            processedBooks.set(result.bookId, result);

            return {
                success: true,
                bookId: result.bookId,
                bookInfo: result.bookInfo,
                totalPages: result.totalPages,
                chapterCount: result.chapterCount,
                sitemapUrl: `/book/${result.bookId}/sitemap.xml`
            };
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ error: error.message });
        }
    });
}
