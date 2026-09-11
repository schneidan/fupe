import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteAccountLink } from '@/components/SiteAccountLink';
import { SiteNavMenu } from '@/components/SiteNavMenu';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { isSearchIndexable } from '@/lib/fupe-env';
import { defaultOgImages, resolveSiteUrl } from '@/lib/site-url';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const indexable = isSearchIndexable();

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title: {
    default: 'FUPE — Is it owned by Private Equity?',
    template: '%s | FUPE',
  },
  description:
    'Find out if a brand, product, or company is backed by Private Equity. Trace ownership chains with citations.',
  robots: indexable
    ? { index: true, follow: true }
    : { index: false, follow: false },
  openGraph: {
    siteName: 'FUPE',
    type: 'website',
    title: 'FUPE — Is it owned by Private Equity?',
    description:
      'Find out if a brand, product, or company is backed by Private Equity. Trace ownership chains with citations.',
    images: [...defaultOgImages],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FUPE — Is it owned by Private Equity?',
    description:
      'Find out if a brand, product, or company is backed by Private Equity. Trace ownership chains with citations.',
    images: [defaultOgImages[0].url],
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
          <SiteNavMenu />
          <SiteAccountLink />
          {children}
        </div>
        <SiteFooter />
        <CookieConsentBanner />
      </body>
    </html>
  );
}
