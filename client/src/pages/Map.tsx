import { useEntries } from "@/hooks/use-entries";
import { useAuth } from "@/hooks/use-auth";
import { useNetworkFeed, useFollowing, useFollow, useUnfollow, useSearchUsers } from "@/hooks/use-social";
import { useWishlist, useCreateWishlistItem } from "@/hooks/use-wishlist";
import { useArrivals } from "@/hooks/use-notifications";
import { PlacesAutocomplete } from "@/components/PlacesAutocomplete";
import { Navigation } from "@/components/Navigation";
import { Loader2, Search, UserPlus, UserMinus, Users, Heart, Compass, Plus, MapPin, X, Star, ChevronUp, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EntryCard } from "@/components/EntryCard";
import { PearlsRating } from "@/components/PearlsRating";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Entry, User } from "@shared/schema";
import { getDynamicOverlayNameClass, getDynamicInlineNameClass } from "@/lib/utils";


function normalizeCityName(city: string): string {
  return city.toLowerCase().replace(/[\u0027\u2018\u2019\u0060\u00B4]/g, "").replace(/\s+/g, " ").trim();
}

function pickDisplayCity(cities: string[]): string {
  const titleCased = cities.find(c => c !== c.toLowerCase() && c !== c.toUpperCase());
  return titleCased || cities[0] || "";
}
type NetworkEntry = Entry & { user?: User };

const ADMIN_EMAIL = "jbacchus19@gmail.com";

type GroupedHotel = {
  key: string;
  hotelName: string;
  city: string;
  majorCity: string;
  suburb: string;
  coverImage: string | null;
  amenities: string[];
  bestRating: number;
  stays: NetworkEntry[];
};

function groupNetworkEntries(entries: NetworkEntry[]): GroupedHotel[] {
  const groups: Record<string, GroupedHotel> = {};

  entries.forEach(entry => {
    const groupCity = entry.majorCity || entry.city;
    const key = entry.placeId || `${normalizeCityName(entry.hotelName)}|${normalizeCityName(groupCity)}`;
    if (!groups[key]) {
      groups[key] = {
        key,
        hotelName: entry.hotelName,
        city: entry.city,
        majorCity: entry.majorCity || entry.city,
        suburb: entry.suburb || "",
        coverImage: null,
        amenities: [],
        bestRating: 0,
        stays: [],
      };
    }
    groups[key].stays.push(entry);
  });

  Object.values(groups).forEach(group => {
    const adminStay = group.stays.find(s => s.user?.email === ADMIN_EMAIL);
    const sorted = [...group.stays].sort((a, b) => (b.id || 0) - (a.id || 0));
    const bestImage = (s: NetworkEntry) => s.imageUrl || s.googlePhotoUrl || null;
    group.coverImage = bestImage(adminStay || sorted.find(s => bestImage(s)) || sorted[0]) || null;

    const amenitySet = new Set<string>();
    group.stays.forEach(stay => {
      if (stay.hasSpa) amenitySet.add("Spa");
      if (stay.hasConcierge) amenitySet.add("Concierge");
      if (stay.hasGym) amenitySet.add("Gym");
      if (stay.hasPool) amenitySet.add("Pool");
      if (stay.hasRestaurant) amenitySet.add("Restaurant");
      if (stay.hasMichelinGuide) amenitySet.add("Michelin Key");
      if (stay.hasMichelinStar) amenitySet.add("Michelin Star");
      if (stay.hasForbesTravelGuide) amenitySet.add("Forbes");
      if (stay.hasOceanView) amenitySet.add("Ocean View");
      if (stay.hasCocktailBar) amenitySet.add("Cocktail Bar");
      if (stay.hasDesignForward) amenitySet.add("Design-Forward");
      if (stay.hasLateNightDining) amenitySet.add("Late-Night");
      if (stay.hasRooftop) amenitySet.add("Rooftop");
    });
    group.amenities = Array.from(amenitySet);

    group.bestRating = Math.max(...group.stays.map(s => s.rating || 0));

    const refStay = adminStay || sorted[0];
    group.hotelName = refStay?.hotelName || group.hotelName;
    group.city = refStay?.city || group.city;
    group.majorCity = refStay?.majorCity || refStay?.city || group.majorCity;
    group.suburb = refStay?.suburb || group.suburb;
  });

  return Object.values(groups);
}

function getFirstName(user?: User | Pick<User, 'id' | 'firstName' | 'lastName' | 'profileImageUrl' | 'email'>): string {
  if (!user) return "Unknown";
  return user.firstName || user.email?.split("@")[0] || "Unknown";
}

function getFullName(user?: User | Pick<User, 'id' | 'firstName' | 'lastName' | 'profileImageUrl' | 'email'>): string {
  if (!user) return "Unknown";
  return user.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
    : user.email?.split("@")[0] || "Unknown";
}

function ReviewCarouselModal({ group, onClose, savedHotelKeys, myStayedKeys, onSave, currentUserId }: {
  group: GroupedHotel;
  onClose: () => void;
  savedHotelKeys: Set<string>;
  myStayedKeys: Set<string>;
  onSave: (entry: { hotelName: string; city: string; imageUrl?: string | null; googlePhotoUrl?: string | null; majorCity?: string | null; suburb?: string | null; placeId?: string | null }) => void;
  currentUserId?: string;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const activeStay = group.stays[activeIdx];
  const [imgError, setImgError] = useState(false);
  const displayImage = activeStay?.imageUrl || activeStay?.googlePhotoUrl || null;
  const hasImage = displayImage && !imgError;

  const isSaved = savedHotelKeys.has(group.key);

  useEffect(() => {
    setImgError(false);
  }, [activeIdx]);

  if (!activeStay) return null;

  const amenities = [
    activeStay.hasSpa && "Spa",
    activeStay.hasConcierge && "Concierge",
    activeStay.hasGym && "Gym",
    activeStay.hasPool && "Pool",
    activeStay.hasRestaurant && "Restaurant",
    activeStay.hasMichelinGuide && "Michelin Key",
    activeStay.hasMichelinStar && "Michelin Star",
    activeStay.hasForbesTravelGuide && "Forbes",
    activeStay.hasOceanView && "Ocean View",
    activeStay.hasCocktailBar && "Cocktail Bar",
    activeStay.hasDesignForward && "Design-Forward",
    activeStay.hasLateNightDining && "Late-Night Dining",
    activeStay.hasRooftop && "Rooftop",
  ].filter(Boolean) as string[];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      data-testid="modal-review-carousel"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-none bg-[#F2F0ED] border-[0.5px] border-[#D1CDC7]"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          className="absolute top-3 right-3 z-20 bg-white/80 backdrop-blur-sm"
          data-testid="button-close-review-modal"
        >
          <X className="w-4 h-4" />
        </Button>

        <div className="relative aspect-[4/3] overflow-hidden rounded-none">
          {hasImage ? (
            <img src={displayImage!} alt={group.hotelName} className="w-full h-full object-cover" onError={() => setImgError(true)} />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#D1CDC7] to-[#F2F0ED]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h2 className={`font-serif ${getDynamicOverlayNameClass(group.hotelName)} text-white leading-tight`}>{group.hotelName}</h2>
            <p className="text-sm text-white/70 font-sans tracking-wide mt-1">{group.majorCity || group.city}</p>
          </div>
        </div>

        {group.stays.length > 1 && (
          <div className="flex gap-1.5 px-5 pt-4 overflow-x-auto">
            {group.stays.map((stay, i) => {
              const first = getFirstName(stay.user);
              const full = getFullName(stay.user);
              return (
                <Button
                  key={stay.id}
                  size="sm"
                  variant={i === activeIdx ? "default" : "outline"}
                  onClick={() => setActiveIdx(i)}
                  className="flex-shrink-0 rounded-full text-[10px] font-serif tracking-wide gap-1.5"
                  title={full}
                  data-testid={`button-review-tab-${stay.id}`}
                >
                  {stay.user?.profileImageUrl ? (
                    <img src={stay.user.profileImageUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-[#C2B4A3]/40" />
                  )}
                  {first}'s Review
                </Button>
              );
            })}
          </div>
        )}

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Link href={`/user/${activeStay.userId}`} className="flex items-center gap-2" data-testid={`link-reviewer-${activeStay.id}`}>
              {activeStay.user?.profileImageUrl ? (
                <img src={activeStay.user.profileImageUrl} alt="" className="w-8 h-8 rounded-full object-cover border border-[#D1CDC7]" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#C2B4A3]/30" />
              )}
              <span className="text-sm font-serif text-[#2C2926]" title={getFullName(activeStay.user)}>{getFirstName(activeStay.user)}</span>
            </Link>
            {activeStay.dateOfStay && (
              <span className="text-[10px] font-sans text-[#78726B] tracking-wide">{activeStay.dateOfStay}</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <PearlsRating value={activeStay.rating} readOnly showCaption />
          </div>

          {amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {amenities.map(a => (
                <span key={a} className="text-[9px] font-sans uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#C2B4A3]/15 text-[#78726B]">
                  {a}
                </span>
              ))}
            </div>
          )}

          {activeStay.notes && (
            <div>
              <span className="text-[9px] font-sans uppercase tracking-widest text-[#78726B]/60 block mb-1.5">Notes</span>
              <p className="text-sm font-sans text-[#2C2926] leading-relaxed">{activeStay.notes}</p>
            </div>
          )}

          {activeStay.userId !== currentUserId && !myStayedKeys.has(group.key) && (
            <Button
              variant={isSaved ? "secondary" : "outline"}
              size="sm"
              onClick={(e) => { e.stopPropagation(); onSave({ hotelName: group.hotelName, city: group.city, imageUrl: activeStay?.imageUrl || null, googlePhotoUrl: activeStay?.googlePhotoUrl || null, majorCity: group.majorCity, suburb: group.suburb, placeId: group.stays[0]?.placeId || null }); }}
              disabled={isSaved}
              className="rounded-full font-serif tracking-wide gap-2"
              data-testid={`button-save-from-modal-${activeStay.id}`}
            >
              <Heart className={`w-3.5 h-3.5 ${isSaved ? "fill-current" : ""}`} />
              {isSaved ? "On Wishlist" : "Save to Wishlist"}
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function MasterCard({ group, index, isSaved, hideHeart, onSave, currentUserId, onOpenReviews }: {
  group: GroupedHotel;
  index: number;
  isSaved: boolean;
  hideHeart?: boolean;
  onSave: () => void;
  currentUserId?: string;
  onOpenReviews: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const hasImage = group.coverImage && !imgError;
  const allOwn = group.stays.every(s => s.userId === currentUserId);

  const stayUsers = group.stays
    .map(s => s.user)
    .filter((u): u is User => !!u)
    .filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i);

  let stayedLabel: string;
  if (stayUsers.length === 0) {
    stayedLabel = "your network";
  } else if (stayUsers.length === 1) {
    stayedLabel = getFirstName(stayUsers[0]);
  } else if (stayUsers.length === 2) {
    stayedLabel = `${getFirstName(stayUsers[0])} and ${getFirstName(stayUsers[1])}`;
  } else {
    const others = stayUsers.length - 1;
    stayedLabel = `${getFirstName(stayUsers[0])} and ${others} ${others === 1 ? "other" : "others"}`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="group relative w-full overflow-hidden rounded-none border-[0.5px] border-[#D1CDC7] aspect-[3/4] cursor-pointer"
      onClick={onOpenReviews}
      data-testid={`card-master-${group.key}`}
    >
      {hasImage ? (
        <img
          src={group.coverImage!}
          alt={group.hotelName}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 md:group-hover:scale-105"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#D1CDC7] to-[#F2F0ED]" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10" data-no-card-click>
        <Link
          href={stayUsers.length === 1 ? `/user/${stayUsers[0].id}` : "#"}
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); if (stayUsers.length !== 1) e.preventDefault(); }}
          className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 transition-all hover:bg-white/25"
        >
          <div className="flex -space-x-1.5">
            {stayUsers.slice(0, 3).map(u => (
              <div key={u.id} title={getFullName(u)} className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-[1.5px] border-white/50 overflow-hidden">
                {u.profileImageUrl ? (
                  <img src={u.profileImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#C2B4A3]" />
                )}
              </div>
            ))}
            {stayUsers.length > 3 && (
              <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-[1.5px] border-white/50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <span className="text-[6px] text-white/90 font-sans">+{stayUsers.length - 3}</span>
              </div>
            )}
          </div>
          <span className="text-[7px] sm:text-[9px] font-sans uppercase tracking-widest text-white/90" data-testid={`text-stayed-by-${group.key}`}>
            Vetted by {stayedLabel}
          </span>
        </Link>
      </div>

      {!allOwn && !hideHeart && (
        <button
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          disabled={isSaved}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10 p-1.5 sm:p-2 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 transition-all duration-300 hover:bg-white/30 disabled:opacity-100"
          data-testid={`button-save-master-${group.key}`}
        >
          <Heart
            className={`w-3 h-3 sm:w-4 sm:h-4 transition-colors duration-300 ${
              isSaved ? "fill-white text-white" : "text-white/80"
            }`}
          />
        </button>
      )}

      <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
        <div className="p-3 sm:p-5 md:p-8">
          {group.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-2 sm:mb-3">
              {group.amenities.map((amenity) => (
                <span
                  key={amenity}
                  className="text-[7px] sm:text-[9px] font-sans uppercase tracking-widest px-1.5 sm:px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm text-white/80 border border-white/20"
                >
                  {amenity}
                </span>
              ))}
            </div>
          )}

          <h3 className={`font-serif ${getDynamicOverlayNameClass(group.hotelName)} text-white leading-tight mb-1 sm:mb-2`} data-testid={`text-master-hotel-${group.key}`}>
            {group.hotelName}
          </h3>

          <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
            <p className="text-[10px] sm:text-sm text-white/70 font-sans tracking-wide">
              {group.majorCity || group.city}
            </p>
            {group.stays.length > 1 && (
              <>
                <span className="text-white/30">&middot;</span>
                <p className="text-[9px] sm:text-xs text-white/50 font-sans tracking-wide">
                  {group.stays.length} reviews
                </p>
              </>
            )}
            <span className="text-white/30">|</span>
            <PearlsRating value={group.bestRating} readOnly variant="light" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}


function NewArrivalsSection({ onFollow, followingIds }: { onFollow: (userId: string) => void; followingIds: Set<string> }) {
  const { data: arrivals } = useArrivals();

  if (!arrivals || arrivals.length === 0) return null;

  return (
    <div>
      <span className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60 block mb-3">New Arrivals</span>
      <p className="text-[10px] font-sans text-[#78726B]/50 mb-3">Friends who recently joined Room Service</p>
      <div className="space-y-2">
        {arrivals.map((person) => (
          <div key={person.id} className="flex items-center justify-between py-2" data-testid={`arrival-user-${person.id}`}>
            <Link
              href={`/user/${person.id}`}
              className="flex items-center gap-2 min-w-0 transition-opacity hover:opacity-70"
              data-testid={`link-arrival-user-${person.id}`}
            >
              {person.profileImageUrl ? (
                <img src={person.profileImageUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-[#D1CDC7] flex-shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#C2B4A3]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-serif text-[#78726B]">{(person.firstName?.[0] || person.email?.[0] || "?").toUpperCase()}</span>
                </div>
              )}
              <span className="text-xs font-sans text-[#2C2926] truncate">
                {person.firstName || person.email?.split("@")[0] || "User"}
              </span>
            </Link>
            {!followingIds.has(person.id) && (
              <button
                onClick={() => onFollow(person.id)}
                className="p-1.5 rounded-full text-[#78726B] transition-colors hover:text-[#2C2926]"
                data-testid={`button-follow-arrival-${person.id}`}
              >
                <UserPlus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FollowSidebar({ cityCounts, selectedCity, onSelectCity, currentUser }: {
  cityCounts: Record<string, number>;
  selectedCity: string | null;
  onSelectCity: (city: string | null) => void;
  currentUser?: { email?: string | null } | null;
}) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const { data: following } = useFollowing();
  const { data: searchResults } = useSearchUsers(searchQuery);
  const followMutation = useFollow();
  const unfollowMutation = useUnfollow();
  const sortedCities = Object.keys(cityCounts).sort();

  const handleFollow = async (userId: string) => {
    try {
      await followMutation.mutateAsync(userId);
      toast({ title: "Following", description: "You're now following this user." });
    } catch {
      toast({ title: "Error", description: "Could not follow this user.", variant: "destructive" });
    }
  };

  const handleUnfollow = async (userId: string) => {
    try {
      await unfollowMutation.mutateAsync(userId);
      toast({ title: "Unfollowed", description: "You've unfollowed this user." });
    } catch {
      toast({ title: "Error", description: "Could not unfollow this user.", variant: "destructive" });
    }
  };

  const followingIds = new Set((following || []).map(u => u.id));
  const [citiesExpanded, setCitiesExpanded] = useState(true);

  return (
    <div className="space-y-8">
      <div>
        <span className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60 block mb-3">Find Friends</span>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#78726B]/40" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email"
            className="pl-9 bg-transparent border-[0.5px] border-[#D1CDC7] rounded-full text-xs text-[#2C2926] placeholder:text-[#D1CDC7] focus-visible:ring-0 focus-visible:border-[#78726B]"
            data-testid="input-search-users"
          />
        </div>

        {searchResults && searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map((user) => (
              <div key={user.id} className="flex items-center justify-between py-2">
                <Link
                  href={`/user/${user.id}`}
                  className="flex items-center gap-2 min-w-0 transition-opacity hover:opacity-70"
                  data-testid={`link-search-user-${user.id}`}
                >
                  {user.profileImageUrl ? (
                    <img src={user.profileImageUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-[#D1CDC7] flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#D1CDC7]/30 flex-shrink-0" />
                  )}
                  <span className="text-xs font-sans text-[#2C2926] truncate">
                    {user.firstName || user.email?.split("@")[0] || "User"}
                  </span>
                </Link>
                {followingIds.has(user.id) ? (
                  <button
                    onClick={() => handleUnfollow(user.id)}
                    className="p-1.5 rounded-full text-[#78726B] transition-colors hover:text-[#2C2926]"
                    data-testid={`button-unfollow-${user.id}`}
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleFollow(user.id)}
                    className="p-1.5 rounded-full text-[#78726B] transition-colors hover:text-[#2C2926]"
                    data-testid={`button-follow-${user.id}`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {currentUser?.email === ADMIN_EMAIL && (
        <NewArrivalsSection onFollow={handleFollow} followingIds={followingIds} />
      )}

      {sortedCities.length > 0 && (
        <div>
          <button
            onClick={() => setCitiesExpanded(!citiesExpanded)}
            className="flex items-center gap-1.5 w-full text-left mb-3 group"
            data-testid="button-toggle-cities"
          >
            <span className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60">Cities</span>
            {citiesExpanded ? (
              <ChevronUp className="w-3 h-3 text-[#78726B]/40 transition-colors group-hover:text-[#78726B]" />
            ) : (
              <ChevronDown className="w-3 h-3 text-[#78726B]/40 transition-colors group-hover:text-[#78726B]" />
            )}
          </button>
          <AnimatePresence initial={false}>
            {citiesExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="space-y-1">
                  <button
                    onClick={() => onSelectCity(null)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-full text-xs font-serif tracking-wide transition-all duration-300 ${
                      selectedCity === null
                        ? "bg-[#2C2926] text-white"
                        : "text-[#78726B] hover:text-[#2C2926]"
                    }`}
                    data-testid="button-city-all"
                  >
                    <span>All Cities</span>
                    <span className={`text-[10px] font-sans ${selectedCity === null ? "text-white/60" : "text-[#78726B]/40"}`}>
                      {Object.values(cityCounts).reduce((a, b) => a + b, 0)}
                    </span>
                  </button>
                  {sortedCities.map((city) => (
                    <button
                      key={city}
                      onClick={() => onSelectCity(city)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-full text-xs font-serif tracking-wide transition-all duration-300 ${
                        selectedCity === city
                          ? "bg-[#2C2926] text-white"
                          : "text-[#78726B] hover:text-[#2C2926]"
                      }`}
                      data-testid={`button-city-${city.toLowerCase().replace(/\s/g, '-')}`}
                    >
                      <span>{city}</span>
                      <span className={`text-[10px] font-sans ${selectedCity === city ? "text-white/60" : "text-[#78726B]/40"}`}>
                        {cityCounts[city]}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {following && following.length > 0 && (
        <div>
          <span className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60 block mb-3">
            Following ({following.length})
          </span>
          <div className="space-y-2">
            {following.map((user) => (
              <div key={user.id} className="flex items-center justify-between py-2">
                <Link
                  href={`/user/${user.id}`}
                  className="flex items-center gap-2 min-w-0 transition-opacity hover:opacity-70"
                  data-testid={`link-user-collection-${user.id}`}
                >
                  {user.profileImageUrl ? (
                    <img src={user.profileImageUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-[#D1CDC7] flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#D1CDC7]/30 flex-shrink-0" />
                  )}
                  <span className="text-xs font-sans text-[#2C2926] truncate">
                    {user.firstName || user.email?.split("@")[0] || "User"}
                  </span>
                </Link>
                <button
                  onClick={() => handleUnfollow(user.id)}
                  className="p-1.5 rounded-full text-[#78726B] transition-colors hover:text-[#2C2926]"
                  data-testid={`button-unfollow-sidebar-${user.id}`}
                >
                  <UserMinus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CityBrowser() {
  const { data: entries, isLoading } = useEntries();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const cities = useMemo(() => {
    if (!entries) return {};
    const normalized: Record<string, { display: string; entries: Entry[] }> = {};
    entries.forEach(entry => {
      const displayCity = entry.majorCity || entry.city;
      const key = normalizeCityName(displayCity);
      if (!normalized[key]) {
        normalized[key] = { display: displayCity, entries: [] };
      } else {
        normalized[key].display = pickDisplayCity([normalized[key].display, displayCity]);
      }
      normalized[key].entries.push(entry);
    });
    const result: Record<string, Entry[]> = {};
    Object.values(normalized).forEach(({ display, entries: e }) => {
      result[display] = e;
    });
    return result;
  }, [entries]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-[#78726B]/40" />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row md:gap-16">
      <div className="order-2 md:order-first md:w-1/4 md:mb-0 md:sticky md:top-24 md:h-fit mt-10 md:mt-0">
        <div className="flex flex-wrap gap-3 md:flex-col md:gap-3">
          <button
            onClick={() => setSelectedCity(null)}
            className={`px-5 py-2 rounded-full border transition-all duration-300 text-sm font-serif tracking-wide ${
              selectedCity === null
                ? "bg-[#2C2926] text-white border-[#2C2926]"
                : "bg-transparent text-[#78726B] border-[#D1CDC7] hover:border-[#2C2926] hover:text-[#2C2926]"
            }`}
            data-testid="button-filter-all"
          >
            All Cities
          </button>
          {Object.keys(cities).sort().map((city) => (
            <button
              key={city}
              onClick={() => setSelectedCity(city)}
              className={`flex items-center justify-between gap-2 px-5 py-2 rounded-full border transition-all duration-300 text-sm font-serif tracking-wide ${
                selectedCity === city
                  ? "bg-[#2C2926] text-white border-[#2C2926]"
                  : "bg-transparent text-[#78726B] border-[#D1CDC7] hover:border-[#2C2926] hover:text-[#2C2926]"
              }`}
              data-testid={`button-filter-${city.toLowerCase().replace(/\s/g, '-')}`}
            >
              <span>{city}</span>
              <span className="ml-2 opacity-40 text-[10px] font-sans">{cities[city].length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="order-1 md:order-last md:w-3/4">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedCity || "all"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 lg:gap-8"
          >
            {(selectedCity
              ? cities[selectedCity]
              : entries || []
            ).map((entry, index) => (
              <div key={entry.id}>
                <EntryCard entry={entry} index={index} />
              </div>
            ))}
          </motion.div>
        </AnimatePresence>

        {(!entries || entries.length === 0) && (
           <div className="text-center py-24 text-[#78726B]/50 font-serif text-lg tracking-wide">
             No hotels found
           </div>
        )}
      </div>
    </div>
  );
}

export default function Map() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { data: networkEntries, isLoading: feedLoading } = useNetworkFeed();
  const { data: wishlistItems } = useWishlist();
  const { data: myEntries } = useEntries();
  const createWishlistItem = useCreateWishlistItem();
  const { toast } = useToast();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [reviewGroup, setReviewGroup] = useState<GroupedHotel | null>(null);

  const savedHotelKeys = useMemo(() => {
    if (!wishlistItems) return new Set<string>();
    const keys = new Set<string>();
    wishlistItems.forEach(item => {
      const nameKey = `${normalizeCityName(item.hotelName)}|${normalizeCityName(item.majorCity || item.city)}`;
      keys.add(nameKey);
      if (item.placeId) keys.add(item.placeId);
    });
    return keys;
  }, [wishlistItems]);

  const myStayedKeys = useMemo(() => {
    if (!myEntries) return new Set<string>();
    const keys = new Set<string>();
    myEntries.forEach(entry => {
      const nameKey = `${normalizeCityName(entry.hotelName)}|${normalizeCityName(entry.majorCity || entry.city)}`;
      keys.add(nameKey);
      if (entry.placeId) keys.add(entry.placeId);
    });
    return keys;
  }, [myEntries]);

  const handleSaveToWishlist = async (entry: { hotelName: string; city: string; imageUrl?: string | null; googlePhotoUrl?: string | null; majorCity?: string | null; suburb?: string | null; placeId?: string | null }) => {
    if (createWishlistItem.isPending) return;
    const nameKey = `${normalizeCityName(entry.hotelName)}|${normalizeCityName(entry.majorCity || entry.city)}`;
    if (myStayedKeys.has(nameKey) || (entry.placeId && myStayedKeys.has(entry.placeId))) {
      toast({ title: "Already Stayed", description: `${entry.hotelName} is already in your collection.` });
      return;
    }
    if (savedHotelKeys.has(nameKey) || (entry.placeId && savedHotelKeys.has(entry.placeId))) {
      toast({ title: "Already Saved", description: `${entry.hotelName} is already on your wishlist.` });
      return;
    }
    try {
      await createWishlistItem.mutateAsync({
        hotelName: entry.hotelName,
        city: entry.city,
        majorCity: entry.majorCity || null,
        suburb: entry.suburb || null,
        placeId: entry.placeId || null,
        imageUrl: entry.imageUrl || null,
        googlePhotoUrl: entry.googlePhotoUrl || null,
        sortPriority: 0,
      });
      toast({ title: "Saved", description: `${entry.hotelName} added to your wishlist.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save to wishlist.";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const groupedEntries = useMemo(() => {
    if (!networkEntries) return [];
    return groupNetworkEntries(networkEntries);
  }, [networkEntries]);

  const cityCounts = useMemo(() => {
    if (!groupedEntries) return {};
    return groupedEntries.reduce((acc, group) => {
      const display = group.majorCity || group.city;
      const key = normalizeCityName(display);
      const existing = Object.keys(acc).find(k => normalizeCityName(k) === key);
      if (existing) {
        acc[existing] = (acc[existing] || 0) + 1;
      } else {
        acc[display] = 1;
      }
      return acc;
    }, {} as Record<string, number>);
  }, [groupedEntries]);

  const filteredGroups = useMemo(() => {
    if (!groupedEntries) return [];
    const base = selectedCity
      ? groupedEntries.filter(g => normalizeCityName(g.majorCity || g.city) === normalizeCityName(selectedCity))
      : [...groupedEntries];
    return base.sort((a, b) => a.hotelName.localeCompare(b.hotelName));
  }, [groupedEntries, selectedCity]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F2F0ED] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#78726B]/40" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F2F0ED] pb-28">
        <header className="pt-16 pb-12 px-6 md:pt-32 md:pb-20 text-center">
          <h1 className="font-serif text-4xl md:text-6xl font-medium text-[#2C2926] mb-4" style={{ letterSpacing: '0.2rem' }}>My Network</h1>
          <p className="font-sans text-xs uppercase tracking-[0.3em] text-[#78726B]">Browse by City</p>
        </header>
        <div className="max-w-6xl mx-auto px-3 sm:px-12 lg:px-16">
          <CityBrowser />
        </div>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F0ED] pb-28 md:pb-0">
      <header className="pt-16 pb-6 px-6 md:pt-32 md:pb-10 text-center">
        <h1 className="font-serif text-4xl md:text-6xl font-medium text-[#2C2926] mb-4" style={{ letterSpacing: '0.2rem' }}>My Network</h1>
        <p className="font-sans text-xs uppercase tracking-[0.3em] text-[#78726B] mb-8">Your Network's Hotel Stays</p>
      </header>

      <div className="max-w-6xl mx-auto px-3 sm:px-12 lg:px-16">
        <div className="flex flex-col md:flex-row md:gap-16">
          <div className="order-2 md:order-first md:w-1/4 md:mb-0 md:sticky md:top-24 md:h-fit mt-10 md:mt-0">
            <FollowSidebar cityCounts={cityCounts} selectedCity={selectedCity} onSelectCity={setSelectedCity} currentUser={user} />
          </div>

          <div className="order-1 md:order-last md:w-3/4">
            {feedLoading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-[#78726B]/40" />
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-[#78726B]/50 space-y-4">
                <div className="w-20 h-20 rounded-full border-[0.5px] border-[#D1CDC7] flex items-center justify-center">
                  <Users className="w-8 h-8 text-[#78726B]/30" />
                </div>
                <p className="font-serif text-lg tracking-wide">
                  {selectedCity ? `No stays in ${selectedCity}` : "No stays in your network yet"}
                </p>
                {!selectedCity && (
                  <p className="text-xs font-sans text-[#78726B]/60 text-center max-w-xs">
                    Follow friends to see their hotel experiences here, or add your own stays in the Collection tab.
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 lg:gap-8">
                {filteredGroups.map((group, index) => {
                  const isSaved = savedHotelKeys.has(group.key);
                  const isStayed = myStayedKeys.has(group.key);
                  return (
                    <div key={group.key}>
                      <MasterCard
                        group={group}
                        index={index}
                        isSaved={isSaved || isStayed}
                        hideHeart={isStayed}
                        currentUserId={user?.id}
                        onSave={() => handleSaveToWishlist({ hotelName: group.hotelName, city: group.city, imageUrl: group.coverImage, majorCity: group.majorCity, suburb: group.suburb, placeId: group.stays[0]?.placeId })}
                        onOpenReviews={() => setReviewGroup(group)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <Navigation />

      <AnimatePresence>
        {reviewGroup && (
          <ReviewCarouselModal
            group={reviewGroup}
            onClose={() => setReviewGroup(null)}
            savedHotelKeys={savedHotelKeys}
            myStayedKeys={myStayedKeys}
            onSave={handleSaveToWishlist}
            currentUserId={user?.id}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
