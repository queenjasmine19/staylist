import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { CalendarDays, Compass, Grid, Heart, LogIn, LogOut, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function Navigation() {
  const [location] = useLocation();
  const { user, isLoading, isAuthenticated } = useAuth();

  const isActive = (path: string) => location === path;

  const displayName = user?.firstName
    ? user.firstName
    : user?.email
    ? user.email.split("@")[0]
    : null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 w-full bg-[#F2F0ED]/95 backdrop-blur-md border-t border-[#D1CDC7]/40 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] px-0 m-0 md:top-0 md:bottom-auto md:border-t-0 md:border-b md:pt-0 md:pb-0 md:px-6">
      <div className="w-full max-w-5xl mx-auto flex items-center justify-evenly px-2 md:h-20 md:gap-4 md:px-0">

        <Link href="/">
          <span className="hidden md:block font-serif text-xl tracking-[0.15em] text-[#2C2926] cursor-pointer mr-4" data-testid="text-nav-logo">
            Staylist
          </span>
        </Link>

        <Link href="/app">
          <div className={cn(
            "flex flex-col items-center gap-1 cursor-pointer transition-colors duration-300 md:flex-row md:gap-3",
            isActive("/app") ? "text-[#2C2926]" : "text-[#78726B]/60 hover:text-[#2C2926]"
          )}>
            <Grid className="w-5 h-5 stroke-[1.5px]" />
            <span className="text-[10px] uppercase tracking-widest font-serif font-medium md:text-xs">Collection</span>
          </div>
        </Link>

        <Link href="/map">
          <div className={cn(
            "flex flex-col items-center gap-1 cursor-pointer transition-colors duration-300 md:flex-row md:gap-3",
            isActive("/map") ? "text-[#2C2926]" : "text-[#78726B]/60 hover:text-[#2C2926]"
          )}>
            <Compass className="w-5 h-5 stroke-[1.5px]" />
            <span className="text-[10px] uppercase tracking-widest font-sans font-medium md:text-xs">Network</span>
          </div>
        </Link>

        <Link href="/wishlist">
          <div className={cn(
            "flex flex-col items-center gap-1 cursor-pointer transition-colors duration-300 md:flex-row md:gap-3",
            isActive("/wishlist") ? "text-[#2C2926]" : "text-[#78726B]/60 hover:text-[#2C2926]"
          )}>
            <Heart className="w-5 h-5 stroke-[1.5px]" />
            <span className="text-[10px] uppercase tracking-widest font-sans font-medium md:text-xs">Wishlist</span>
          </div>
        </Link>

        <Link href="/itinerary">
          <div className={cn(
            "flex flex-col items-center gap-1 cursor-pointer transition-colors duration-300 md:flex-row md:gap-3",
            isActive("/itinerary") ? "text-[#2C2926]" : "text-[#78726B]/60 hover:text-[#2C2926]"
          )}>
            <CalendarDays className="w-5 h-5 stroke-[1.5px]" />
            <span className="text-[10px] uppercase tracking-widest font-sans font-medium md:text-xs">Itinerary</span>
          </div>
        </Link>

        {!isLoading && (
          isAuthenticated ? (
            <>
              <Link href="/profile">
                <div
                  data-testid="link-profile"
                  className={cn(
                    "flex flex-col items-center gap-1 cursor-pointer transition-colors duration-300 md:flex-row md:gap-3",
                    isActive("/profile") ? "text-[#2C2926]" : "text-[#78726B]/60 hover:text-[#2C2926]"
                  )}>
                  {user?.profileImageUrl ? (
                    <img
                      src={user.profileImageUrl}
                      alt=""
                      className="w-5 h-5 rounded-full object-cover border border-[#D1CDC7]"
                    />
                  ) : (
                    <User className="w-5 h-5 stroke-[1.5px]" />
                  )}
                  <span className="text-[10px] uppercase tracking-widest font-sans font-medium md:text-xs">
                    {displayName || "Profile"}
                  </span>
                </div>
              </Link>
              <a
                href="/api/logout"
                className="flex flex-col items-center gap-1 cursor-pointer transition-colors duration-300 text-[#78726B]/60 hover:text-[#2C2926] md:flex-row md:gap-3"
                data-testid="button-logout"
              >
                <LogOut className="w-5 h-5 stroke-[1.5px]" />
                <span className="text-[10px] uppercase tracking-widest font-sans font-medium md:text-xs">Logout</span>
              </a>
            </>
          ) : (
            <a
              href="/api/login"
              className="flex flex-col items-center gap-1 cursor-pointer transition-colors duration-300 text-[#2C2926] md:flex-row md:gap-2 md:px-4 md:py-1.5 md:rounded-full md:border md:border-[#2C2926] md:hover:bg-[#2C2926] md:hover:text-[#F2F0ED]"
              data-testid="button-login"
            >
              <LogIn className="w-5 h-5 stroke-[1.5px]" />
              <span className="text-[10px] uppercase tracking-widest font-sans font-medium md:text-xs">Login / Sign Up</span>
            </a>
          )
        )}
      </div>
    </nav>
  );
}
