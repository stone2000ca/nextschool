import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Footer from '@/components/navigation/Footer';

export default function Layout({ children, currentPageName }) {
  const location = useLocation();

  useEffect(() => {
    // Set canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `https://nextschool.ca${location.pathname}${location.search}`;

    // Ensure favicon
    let favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      favicon.href = '/favicon.ico';
      document.head.appendChild(favicon);
    }

    // Add apple touch icon
    let appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (!appleTouchIcon) {
      appleTouchIcon = document.createElement('link');
      appleTouchIcon.rel = 'apple-touch-icon';
      appleTouchIcon.href = '/apple-touch-icon.png';
      document.head.appendChild(appleTouchIcon);
    }
  }, [location]);

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}