import type { Metadata } from 'next';
import { IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/theme-provider';
import { FocusModality } from '@/components/focus-modality';
import NextTopLoader from 'nextjs-toploader';
import { Toaster } from 'sonner';

const ibmPlexMono = IBM_Plex_Mono({
  weight: ['400', '600'],
  subsets: ['latin'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RapidAuth',
  description: 'Authentication Boilerplate',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      suppressHydrationWarning
      lang='en'
      className={cn('font-sans', ibmPlexMono.variable)}
    >
      <body className='antialiased'>
        <FocusModality />
        <NextTopLoader color='var(--link)' height={2} showSpinner={false} shadow={false} />
        <ThemeProvider
          attribute='class'
          defaultTheme='dark'
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              className: 'rounded-none',
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
