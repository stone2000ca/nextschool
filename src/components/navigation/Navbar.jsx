import { Button } from "@/components/ui/button";
import { User, LogOut, Building2 } from "lucide-react";
import Link from 'next/link';
import { useState, useEffect } from "react";
import { useAuth } from '@/lib/AuthContext';
import { SchoolAdmin as SchoolAdminEntity } from '@/lib/entities';
import { LOGO_BLACK_TEXT, LOGO_WHITE_TEXT } from '@/lib/brand-assets';

export default function Navbar({ variant = "default" }) {
  const { user: authUser, isAuthenticated: authIsAuthenticated, navigateToLogin, logout } = useAuth();
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [authIsAuthenticated, authUser]);

  const checkAuth = async () => {
    try {
      setIsAuthenticated(authIsAuthenticated);
      if (authIsAuthenticated && authUser) {
        setUser(authUser);

        try {
          const adminRecords = await SchoolAdminEntity.filter({ user_id: authUser.id, is_active: true });
          if (adminRecords && adminRecords.length > 0) {
            setIsSchoolAdmin(true);
          }
        } catch (filterError) {
          // Silently fail - user just won't see the Manage School button
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }
  };

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
                <Link href={'/school-admin'} title="Manage School">
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

  // Default variant for other pages
  return (
    <header className="bg-slate-900 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
        <Link href={'/'} className="flex items-center gap-2">
          <img src={LOGO_WHITE_TEXT} alt="NextSchool" className="h-10" />
        </Link>
        <nav className="hidden md:flex gap-6 items-center">
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
              <Link href={'/school-admin'} title="Manage School">
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
          <div className="flex items-center gap-3">
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