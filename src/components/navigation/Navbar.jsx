import { Button } from "@/components/ui/button";
import { User, LogOut, Building2 } from "lucide-react";
import Link from 'next/link';
import { useState, useEffect } from "react";
import { useAuth } from '@/lib/AuthContext';
import { SchoolAdmin as SchoolAdminEntity } from '@/lib/entities';

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
            <img src="/logo.png" alt="NextSchool" className="h-8" />
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
    <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50" style={{ borderColor: 'var(--ns-border)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <Link href={'/'} className="flex items-center gap-2">
          <img src="/logo.png" alt="NextSchool" className="h-10" />
        </Link>
        <nav className="hidden md:flex gap-8 items-center">
          <Link href={'/how-it-works'} className="text-slate-600 hover:text-teal-600 text-sm">How it Works</Link>
          <Link href={'/schools'} className="text-slate-600 hover:text-teal-600 text-sm">
            Browse Schools
          </Link>
          <Link href={'/guides'} className="text-slate-600 hover:text-teal-600 text-sm">Guides</Link>
          <Link href={'/pricing'} className="text-slate-600 hover:text-teal-600 text-sm">Pricing</Link>
          <Link href={'/for-schools'} className="text-slate-600 hover:text-teal-600 text-sm">For Schools</Link>
          <Link href={'/about'} className="text-slate-600 hover:text-teal-600 text-sm">About</Link>
        </nav>
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2">
            <Link href={'/dashboard'} title="Dashboard">
              <Button variant="outline" size="icon">
                <User className="h-4 w-4" />
              </Button>
            </Link>
            {isSchoolAdmin && (
              <Link href={'/school-admin'} title="Manage School">
                <Button variant="outline" size="icon">
                  <Building2 className="h-4 w-4" />
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-slate-600 hover:text-red-600"
              onClick={() => logout()}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button className="ns-btn-outline" onClick={() => navigateToLogin(window.location.pathname)}>Log In</button>
            <button className="ns-btn-primary" onClick={() => navigateToLogin(window.location.pathname)}>Sign Up</button>
          </div>
        )}
      </div>
    </header>
  );
}