import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Footer from '@/components/navigation/Footer';

export default function Layout({ children, currentPageName }) {
  const location = useLocation();

  // Initialize GTM on mount
  useEffect(() => {
    // Initialize dataLayer
    window.dataLayer = window.dataLayer || [];

    // Inject GTM script
    const gtmScript = document.createElement('script');
    gtmScript.async = true;
    gtmScript.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-NVZZNTX3');`;
    document.head.appendChild(gtmScript);

    // Inject noscript iframe
    const noscriptIframe = document.createElement('noscript');
    const iframeElement = document.createElement('iframe');
    iframeElement.src = 'https://www.googletagmanager.com/ns.html?id=GTM-NVZZNTX3';
    iframeElement.height = '0';
    iframeElement.width = '0';
    iframeElement.style.display = 'none';
    iframeElement.style.visibility = 'hidden';
    noscriptIframe.appendChild(iframeElement);
    document.body.insertBefore(noscriptIframe, document.body.firstChild);
  }, []);

  // Track page views
  useEffect(() => {
    if (window.dataLayer) {
      window.dataLayer.push({
        event: 'page_view',
        page_path: location.pathname
      });
    }
  }, [location]);

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