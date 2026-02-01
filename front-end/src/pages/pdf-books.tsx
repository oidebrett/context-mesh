import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { listBooks, uploadPdf, deleteBook } from '../api';
import Spinner from '../components/Spinner';
import { baseUrl } from '../utils';

export default function PdfBooksPage() {
    const queryClient = useQueryClient();
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['books'],
        queryFn: listBooks
    });

    const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setUploading(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        try {
            await uploadPdf(formData);
            queryClient.invalidateQueries({ queryKey: ['books'] });
            (e.target as HTMLFormElement).reset();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (bookId: string) => {
        if (!confirm('Are you sure you want to delete this book?')) return;
        try {
            await deleteBook(bookId);
            queryClient.invalidateQueries({ queryKey: ['books'] });
        } catch (err: any) {
            alert(err.message);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
    };

    return (
        <div className="min-h-screen bg-neutral-50 py-10">
            <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                    PDF to Webpage
                </h1>
                <p className="mt-2 text-sm text-gray-600">
                    Transform your PDF books into fast, SEO-optimized web pages with automatic sitemaps and RSS feeds.
                </p>
            </header>

            <main className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Upload Section */}
                    <div className="lg:col-span-1">
                        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6 sticky top-8">
                            <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                                Upload PDF
                            </h2>
                            <form onSubmit={handleUpload} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Book Title</label>
                                    <input
                                        type="text"
                                        name="title"
                                        placeholder="Auto-detected if empty"
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Author</label>
                                    <input
                                        type="text"
                                        name="author"
                                        placeholder="Auto-detected if empty"
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">PDF File</label>
                                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-indigo-400 transition-colors cursor-pointer relative">
                                        <div className="space-y-1 text-center">
                                            <svg className="mx-auto h-10 w-10 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                                                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                            <div className="flex text-sm text-gray-600">
                                                <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                                    <span>Upload a file</span>
                                                    <input id="file-upload" name="pdf" type="file" accept=".pdf" className="sr-only" required />
                                                </label>
                                                <p className="pl-1">or drag and drop</p>
                                            </div>
                                            <p className="text-xs text-gray-500">PDF up to 50MB</p>
                                        </div>
                                    </div>
                                </div>
                                {error && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                        <p className="text-red-600 text-xs">{error}</p>
                                    </div>
                                )}
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
                                >
                                    {uploading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                            Processing...
                                        </>
                                    ) : (
                                        'Generate Book'
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Books List Section */}
                    <div className="lg:col-span-2">
                        <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <h2 className="text-lg font-semibold text-gray-800">Your Books</h2>
                                <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs font-bold rounded-full">
                                    {data?.books?.length || 0} Total
                                </span>
                            </div>

                            {isLoading ? (
                                <div className="p-20 text-center">
                                    <Spinner size={2} />
                                    <p className="mt-4 text-gray-500 animate-pulse">Loading your library...</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {data?.books?.length === 0 ? (
                                        <div className="px-6 py-20 text-center">
                                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                                                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                                                </svg>
                                            </div>
                                            <p className="text-gray-500 font-medium">No books processed yet.</p>
                                            <p className="text-gray-400 text-sm mt-1">Upload your first PDF to get started.</p>
                                        </div>
                                    ) : (
                                        data?.books?.map((book: any) => (
                                            <div key={book.bookId} className="px-6 py-5 hover:bg-gray-50/80 transition-colors group">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-base font-bold text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
                                                            {book.bookInfo.title}
                                                        </h3>
                                                        <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                                                            <span className="flex items-center gap-1">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                                {book.bookInfo.author || 'Unknown Author'}
                                                            </span>
                                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                            <span className="flex items-center gap-1">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                                                {book.pageCount} Pages
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <a
                                                            href={`${baseUrl}/book/${book.bookId}/page/1`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                                                        >
                                                            <svg className="mr-1.5 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                            Open
                                                        </a>
                                                        <div className="h-6 w-px bg-gray-200 mx-1 hidden sm:block"></div>
                                                        <button
                                                            onClick={() => copyToClipboard(`${baseUrl}/book/${book.bookId}/sitemap.xml`)}
                                                            className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-all"
                                                            title="Copy Sitemap URL"
                                                        >
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                        </button>
                                                        <button
                                                            onClick={() => copyToClipboard(`${baseUrl}/book/${book.bookId}/rss.xml`)}
                                                            className="p-1.5 text-gray-400 hover:text-orange-600 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-all"
                                                            title="Copy RSS URL"
                                                        >
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(book.bookId)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 transition-all"
                                                            title="Delete Book"
                                                        >
                                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
