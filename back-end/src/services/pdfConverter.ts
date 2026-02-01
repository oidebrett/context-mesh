import { PDFExtract, type PDFExtractOptions } from 'pdf.js-extract';

// Use pdf.js-extract for better page-by-page extraction
const pdfExtract = new PDFExtract();

export interface BookInfo {
    id: string;
    title: string;
    author: string | undefined;
    totalPages: number;
    processedAt: string;
}

export interface PageInfo {
    pageNum: number;
    title: string;
    chapterTitle: string | undefined;
    chapterNum: number | undefined;
    url: string;
    prevUrl: string | null;
    nextUrl: string | null;
    content: string;
    description: string;
    breadcrumb: { name: string; url: string }[];
}

export interface ProcessedPage {
    pageNum: number;
    html: string;
    jsonLd: any;
    url: string;
    content: string;
    description: string;
}

export interface ConversionResult {
    bookId: string;
    bookInfo: BookInfo;
    pages: ProcessedPage[];
    sitemap: string;
    totalPages: number;
    chapterCount: number;
}

async function parsePdf(buffer: Buffer) {
    const options: PDFExtractOptions = { password: '' };
    const data = await pdfExtract.extractBuffer(buffer, options);

    return {
        numPages: data.pages.length,
        pages: data.pages,
        metadata: data.meta
    };
}

// Extract text from page content array (pdf.js-extract format)
function extractTextFromPage(page: any) {
    if (!page.content) return '';
    return page.content.map((item: any) => item.str).join(' ');
}

// Detect chapters from all page text
function detectChapters(allPages: any[]) {
    const fullText = allPages.map(p => extractTextFromPage(p)).join('\n');
    const chapterRegex = /(?:chapter|section|part)\s*(\d+|[ivxlcdm]+)[:.]?\s*(.*)/gi;
    const chapters: { title: string; index: number; content: string }[] = [];
    let match: RegExpExecArray | null;
    while ((match = chapterRegex.exec(fullText)) !== null) {
        const currentMatch = match;
        const chapterLabel = currentMatch[0]!.split('\n')[0]!.trim();
        const shortTitle = chapterLabel.length > 60 ? chapterLabel.substring(0, 57) + '...' : chapterLabel;
        chapters.push({
            title: shortTitle,
            index: chapters.length,
            content: currentMatch[2]?.split('\n')[0]?.trim() || ''
        });
    }

    return chapters;
}


// Generate a description (all content, up to 10000 chars for SEO/Metadata)
function generateDescription(content: string, pageNum: number) {
    if (!content) return `Page ${pageNum}`;

    // Just keep it simple: normalize whitespace and trim
    const final = content.replace(/\s+/g, ' ').trim();
    if (final.length > 50) return final.length > 10000 ? final.substring(0, 9997) + '...' : final;

    return final || `Page ${pageNum}`;
}

// Generate JSON-LD for a page
export function generateJsonLd(bookInfo: BookInfo, pageInfo: PageInfo) {
    const description = generateDescription(pageInfo.content, pageInfo.pageNum);
    const jsonLd: any = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${bookInfo.title} - Page ${pageInfo.pageNum}`,
        description: description
    };

    // Add book reference
    if (bookInfo.title) {
        jsonLd.isPartOf = {
            '@type': 'Book',
            '@id': `/book/${bookInfo.id}`,
            name: bookInfo.title
        };
        if (bookInfo.author) {
            jsonLd.isPartOf.author = {
                '@type': 'Person',
                name: bookInfo.author
            };
        }
    }

    // Add chapter info if available
    if (pageInfo.chapterTitle) {
        jsonLd.about = {
            '@type': 'Chapter',
            name: pageInfo.chapterTitle,
            position: pageInfo.chapterNum || pageInfo.pageNum
        };
    }

    // Add navigation
    jsonLd.url = pageInfo.url;

    // Breadcrumb for schema.org
    jsonLd.breadcrumb = {
        '@type': 'BreadcrumbList',
        itemListElement: pageInfo.breadcrumb.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: (index === pageInfo.breadcrumb.length - 1) ? `${bookInfo.title} - Page ${pageInfo.pageNum}` : item.name,
            item: item.url
        }))
    };

    return jsonLd;
}

// Generate HTML page
export function generateHtmlPage(bookInfo: BookInfo, pageInfo: PageInfo, jsonLd: any) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageInfo.title}</title>
  <meta name="description" content="${pageInfo.description || ''}">
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
  <style>
    body { font-family: Georgia, serif; max-width: 900px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    nav.breadcrumb { color: #666; margin-bottom: 20px; }
    nav.breadcrumb a { color: #0066cc; }
    main { min-height: 60vh; }
    h1 { border-bottom: 1px solid #eee; padding-bottom: 10px; }
    .content { font-size: 16px; white-space: pre-wrap; }
    nav.pagination { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; display: flex; justify-content: space-between; }
    nav.pagination a { color: #0066cc; text-decoration: none; }
    nav.pagination a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <nav class="breadcrumb">
    <a href="/">Home</a> &rsaquo; <a href="/book/${bookInfo.id}">${bookInfo.title}</a>
    ${pageInfo.chapterTitle ? ` &rsaquo; ${pageInfo.chapterTitle}` : ''}
  </nav>

  <main>
    <h1>${pageInfo.title}</h1>
    <div class="content">${pageInfo.content || ''}</div>
  </main>

  <nav class="pagination">
    ${pageInfo.prevUrl ? `<a href="${pageInfo.prevUrl}">&larr; Previous</a>` : '<span></span>'}
    <span class="page-info">Page ${pageInfo.pageNum} of ${bookInfo.totalPages}</span>
    ${pageInfo.nextUrl ? `<a href="${pageInfo.nextUrl}">Next &rarr;</a>` : '<span></span>'}
  </nav>

  <footer>
    <p><small>Generated from PDF | <a href="/book/${bookInfo.id}/sitemap.xml">Sitemap</a></small></p>
  </footer>
</body>
</html>`;
}

// Generate sitemap.xml
export function generateSitemap(bookInfo: BookInfo, pages: { url: string; pageNum: number }[]) {
    const baseUrl = process.env['BASE_URL'] || 'http://localhost:3010';

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/book/${bookInfo.id}</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
${pages.map(page => `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <changefreq>weekly</changefreq>
    <priority>${page.pageNum === 1 ? 0.9 : 0.7}</priority>
  </url>`).join('\n')}
</urlset>`;
}

// Main conversion function
export async function convertPdfToHtmlBook(buffer: Buffer, options: { id?: string; title?: string; author?: string } = {}): Promise<ConversionResult> {
    const pdfData = await parsePdf(buffer);
    const chapters = detectChapters(pdfData.pages);

    const bookId = options.id || Math.random().toString(36).substring(2, 11);
    const bookInfo: BookInfo = {
        id: bookId,
        title: options.title || 'Untitled Book',
        author: options.author || undefined,
        totalPages: pdfData.numPages,
        processedAt: new Date().toISOString()
    };

    const pages: ProcessedPage[] = [];
    const chapterSize = Math.ceil(pdfData.numPages / (chapters.length || 1));

    for (let i = 0; i < pdfData.numPages; i++) {
        const pageNum = i + 1;
        const chapterIndex = chapters.length > 0 ? Math.floor(i / chapterSize) : -1;
        const chapter = chapterIndex >= 0 ? chapters[chapterIndex] : null;

        const rawContent = extractTextFromPage(pdfData.pages[i]);
        // DO NOT strip for the body - use rawContent joined with spaces
        const pageContent = rawContent;
        const pageDescription = generateDescription(rawContent, pageNum);

        const pageInfo: PageInfo = {
            pageNum,
            title: `${bookInfo.title} - Page ${pageNum}`,
            chapterTitle: chapter?.title,
            chapterNum: chapterIndex + 1,
            url: `/book/${bookId}/page/${pageNum}`,
            prevUrl: pageNum > 1 ? `/book/${bookId}/page/${pageNum - 1}` : null,
            nextUrl: pageNum < pdfData.numPages ? `/book/${bookId}/page/${pageNum + 1}` : null,
            content: pageContent,
            description: pageDescription,
            breadcrumb: [
                { name: bookInfo.title, url: `/book/${bookId}` },
                { name: `Page ${pageNum}`, url: `/book/${bookId}/page/${pageNum}` }
            ]
        };

        const jsonLd = generateJsonLd(bookInfo, pageInfo);
        const html = generateHtmlPage(bookInfo, pageInfo, jsonLd);

        pages.push({
            pageNum,
            html,
            jsonLd,
            url: pageInfo.url,
            content: pageContent,
            description: pageDescription
        });
    }

    const sitemap = generateSitemap(bookInfo, pages);

    return {
        bookId,
        bookInfo,
        pages,
        sitemap,
        totalPages: pdfData.numPages,
        chapterCount: chapters.length
    };
}
