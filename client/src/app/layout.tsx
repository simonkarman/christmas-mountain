import './globals.css';

export const metadata = {
  title: 'Krmx - Best Practices',
  description: 'Showcase of best practices when using Krmx with React',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body
        className="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50 flex flex-col items-center justify-between mx-auto h-screen h-[100svh]"
      >
        <div className='flex-grow flex flex-col justify-center gap-4 items-center w-full p-2'>
          {children}
        </div>
        <footer className='py-1 px-3 text-center md:mb-2 md:left-2 text-gray-500 dark:text-gray-400 text-xs md:text-sm'>
          <span className=''>Build with</span>{' '}
          <a href='https://github.com/simonkarman/krmx-best-practices' className='font-semibold text-gray-900 dark:text-gray-50'>Krmx</a>
          {' '}by{' '}
          <a href='https://www.simonkarman.nl' className='text-blue-800 dark:text-blue-200'>simonkarman</a>
        </footer>
      </body>
    </html>
  );
}
