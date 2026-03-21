import { Button } from "@/components/ui/button";
import { User, LogOut, Building2 } from "lucide-react";
import Link from 'next/link';
import { useState, useEffect } from "react";
import { useAuth } from '@/lib/AuthContext';
import { fetchSchoolAdmins } from '@/lib/api/entities-api';
import { LOGO_BLACK_TEXT, LOGO_WHITE_TEXT } from '@/lib/brand-assets';

export default function Navbar({ variant = "default", transparent = false }) {
  const { user: authUser, isAuthenticated: authIsAuthenticated, navigateToLogin, logout } = useAuth();
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);
  const [schoolAdminRecords, setSchoolAdminRecords] = useState([]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [authIsAuthenticated, authUser]);

  useEffect(() => {
    if (!transparent) return;
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll(); // check initial position
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [transparent]);

  const checkAuth = async () => {
    try {
      setIsAuthenticated(authIsAuthenticated);
      if (authIsAuthenticated && authUser) {
        setUser(authUser);

        try {
          const adminRecords = await fetchSchoolAdmins({ user_id: authUser.id, is_active: true });
          if (adminRecords && adminRecords.length > 0) {
            setIsSchoolAdmin(true);
            setSchoolAdminRecords(adminRecords);
          }
        } catch (filterError) {
          // Silently fail - user just won't see the Manage School button
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }
  };

  const schoolAdminHref = schoolAdminRecords.length === 1
    ? `/schooladmin/${schoolAdminRecords[0].school_id}`
    : '/school-admin';

  // Minimal variant for Consultant page
  if (variant === "minimal") {
    return (
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <Link href={'/'} className="flex items-center gap-2">
            <img src={LOGO_BLACK_TEXT} alt="NextSchool" className="h-8" />
          </Link>
          {isAuthenticated && user ? (
            <div className="flex items-center gap-1">
              <Link href={'/dashboard'} title="Dashboard">
                <Button variant="ghost" size="icon">
                  <User className="h-4 w-4" />
                </Button>
              </Link>
              {isSchoolAdmin && (
                <Link href={schoolAdminHref} title="Manage School">
                  <Button variant="ghost" size="icon">
                    <Building2 className="h-4 w-4" />
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout()}
                className="gap-1 text-slate-500 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigateToLogin(window.location.pathname)}
            >
              Login
            </Button>
          )}
        </div>
      </header>
    );
  }

  // Whether to show full nav (links + auth buttons) or just logo
  const showFull = !transparent || scrolled;

  // Default variant for other pages
  return (
    <header className={`${transparent ? 'fixed' : 'sticky'} top-0 left-0 right-0 z-50 transition-colors duration-300 ${transparent && !scrolled ? 'bg-transparent' : 'bg-slate-900'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
        <Link href={'/'} className="flex items-center gap-2">
          <img src={LOGO_WHITE_TEXT} alt="NextSchool" className="h-10" />
        </Link>
        <nav className={`hidden md:flex gap-6 items-center transition-opacity duration-300 ${showFull ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <Link href={'/how-it-works'} className="text-white/70 hover:text-white text-sm transition-colors">How it Works</Link>
          <Link href={'/schools'} className="text-white/70 hover:text-white text-sm transition-colors">Browse Schools</Link>
          <Link href={'/pricing'} className="text-white/70 hover:text-white text-sm transition-colors">Pricing</Link>
          <Link href={'/for-schools'} className="text-white/70 hover:text-white text-sm transition-colors">For Schools</Link>
        </nav>
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2">
            <Link href={'/dashboard'} title="Dashboard">
              <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10">
                <User className="h-4 w-4" />
              </Button>
            </Link>
            {isSchoolAdmin && (
              <Link href={schoolAdminHref} title="Manage School">
                <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10">
                  <Building2 className="h-4 w-4" />
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-white/70 hover:text-red-400 hover:bg-white/10"
              onClick={() => logout()}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        ) : (
          <div className={`flex items-center gap-3 transition-opacity duration-300 ${showFull ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <button className="text-white/70 hover:text-white text-sm transition-colors" onClick={() => navigateToLogin(window.location.pathname)}>Log in</button>
            <Link href="/consultant">
              <button className="ns-btn-primary text-sm">Start free chat</button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}