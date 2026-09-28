import './global.css';

export const metadata = {
  title: 'Instagram Clone',
  description: 'An Instagram-style social media application.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
