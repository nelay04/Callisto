import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Callisto — Voice AI',
  description: 'Callisto is a real-time voice AI assistant powered by Gemini Live.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
