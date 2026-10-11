import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { ThemeProvider } from '@mui/material/styles';
import localFont from 'next/font/local';

import { theme } from '../theme/theme';
import { tokenCssVariables } from '../theme/token-css-variables';
import './global.css';

export const metadata = {
  title: 'Instagram Clone',
  description: 'An Instagram-style social media application.',
};

// Self-hosted (Fontsource's Inter variable file) rather than next/font/google:
// Google's font CDN is then never on the build or dev-server path, so an
// offline machine or a slow network can't break `next dev`/`next build`.
const inter = localFont({
  src: '../../../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  weight: '100 900',
  style: 'normal',
  variable: '--font-inter',
  display: 'swap',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <style id="design-tokens">{tokenCssVariables()}</style>
      </head>
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <ThemeProvider theme={theme}>{children}</ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
