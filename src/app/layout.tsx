import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import '../index.css';

export const metadata: Metadata = {
  title: 'TutorDirect - Private Tutor Finder',
  description: 'An interactive platform for finding, sorting, and booking verified private tutors.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#4f46e5',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-slate-50 antialiased overflow-x-hidden">{children}</body>
    </html>
  );
}
