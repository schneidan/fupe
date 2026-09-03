import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteAccountLink } from '@/components/SiteAccountLink';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'FUPE — Is it owned by Private Equity?',
    template: '%s | FUPE',
  },
  description:
    'Find out if a brand, product, or company is backed by Private Equity. Trace ownership chains with citations.',
  openGraph: {
    siteName: 'FUPE',
    type: 'website',
    title: 'FUPE — Is it owned by Private Equity?',
    description:
      'Find out if a brand, product, or company is backed by Private Equity. Trace ownership chains with citations.',
  },
  twitter: {
    card: 'summary',
    title: 'FUPE — Is it owned by Private Equity?',
    description:
      'Find out if a brand, product, or company is backed by Private Equity. Trace ownership chains with citations.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.className} ${inter.variable} flex min-h-screen flex-col antialiased`}
      >
        <div className="flex-1">
          <SiteAccountLink />
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
