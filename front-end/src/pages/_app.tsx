import type { AppProps } from 'next/app';
import Head from 'next/head';
import { QueryClientProvider } from '@tanstack/react-query';
import { Inter } from 'next/font/google';
import { useState } from 'react';
import { Dialog } from '@headlessui/react';

import '../globals.css';
import { queryClient } from '../utils';
import { Menu } from '../components/Menu';
import { AuthProvider, useAuth } from '../components/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

function AppContent({ Component, pageProps }: any) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        if (!loading && !user && router.pathname !== '/login') {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user && router.pathname === '/login') {
        return <Component {...pageProps} />;
    }

    if (!user) {
        return null; // Will redirect
    }

    return (
        <div className={`${inter.variable} font-sans h-screen w-screen flex flex-col md:flex-row`}>
            <Head>
                <title key="title">Context Mesh</title>
            </Head>
            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200">
                <div className="text-xl font-bold">Context Mesh</div>
                <button
                    type="button"
                    className="-m-2.5 p-2.5 text-gray-700"
                    onClick={() => setMobileMenuOpen(true)}
                >
                    <span className="sr-only">Open main menu</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                </button>
            </div>

            {/* Mobile Menu Drawer */}
            <Dialog as="div" className="relative z-50 md:hidden" open={mobileMenuOpen} onClose={setMobileMenuOpen}>
                <div className="fixed inset-0 bg-gray-900/80" />
                <div className="fixed inset-0 flex">
                    <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                        <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                            <button type="button" className="-m-2.5 p-2.5" onClick={() => setMobileMenuOpen(false)}>
                                <span className="sr-only">Close menu</span>
                                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white pb-4">
                            <Menu onItemClick={() => setMobileMenuOpen(false)} />
                        </div>
                    </Dialog.Panel>
                </div>
            </Dialog>

            {/* Desktop Sidebar */}
            <div className="hidden md:block min-w-[230px] h-full">
                <Menu />
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <Component {...pageProps} />
            </div>
        </div>
    );
}

export default function MyApp({ Component, pageProps }: AppProps) {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <AppContent Component={Component} pageProps={pageProps} />
            </AuthProvider>
        </QueryClientProvider>
    );
}
