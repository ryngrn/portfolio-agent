import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body className={inter.className} style={{ margin: 0, backgroundColor: '#111318' }}>
        {children}
      </body>
    </html>
  );
}
