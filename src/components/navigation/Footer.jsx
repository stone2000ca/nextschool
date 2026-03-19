import Link from 'next/link';
import { LOGO_WHITE_TEXT } from '@/lib/brand-assets';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center mb-12">
          <img src={LOGO_WHITE_TEXT} alt="NextSchool" className="h-8" />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-12">
          <div>
            <h3 className="text-white font-semibold text-sm mb-4">PRODUCT</h3>
            <Link href={'/consultant'} className="block text-sm hover:text-white transition-colors mb-3">Chat</Link>
            <Link href={'/schools'} className="block text-sm hover:text-white transition-colors mb-3">Browse Schools</Link>
            <Link href={'/pricing'} className="block text-sm hover:text-white transition-colors">Pricing</Link>
          </div>

          <div>
            <h3 className="text-white font-semibold text-sm mb-4">COMPANY</h3>
            <Link href={'/about'} className="block text-sm hover:text-white transition-colors mb-3">About</Link>
            <Link href={'/contact'} className="block text-sm hover:text-white transition-colors mb-3">Contact</Link>
            <Link href={'/blog'} className="block text-sm hover:text-white transition-colors">Blog</Link>
          </div>

          <div>
            <h3 className="text-white font-semibold text-sm mb-4">LEGAL</h3>
            <Link href={'/privacy'} className="block text-sm hover:text-white transition-colors mb-3">Privacy</Link>
            <Link href={'/terms'} className="block text-sm hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
        
        <div className="border-t border-slate-800 pt-8">
          <p className="text-center text-sm">© 2026 NextSchool. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}