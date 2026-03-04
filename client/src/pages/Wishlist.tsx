import { useWishlist, useCreateWishlistItem, useDeleteWishlistItem } from "@/hooks/use-wishlist";
import { useCommonGround } from "@/hooks/use-trips";
import { Navigation } from "@/components/Navigation";
import { Loader2, Plus, X, LogIn, Users, Heart, Award, MapPin, ExternalLink } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlacesAutocomplete } from "@/components/PlacesAutocomplete";
import { getDynamicOverlayNameClass } from "@/lib/utils";
import type { WishlistItem, User } from "@shared/schema";

interface WishlistDetailData {
  editorialSummary: string | null;
  awards: { hasMichelinGuide: boolean; hasMichelinStar: boolean; hasForbesTravelGuide: boolean } | null;
  friends: Pick<User, 'id' | 'firstName' | 'lastName' | 'profileImageUrl' | 'email'>[];
  heroPhotoUrl: string | null;
  websiteUrl: string | null;
}

function WishlistDetailModal({ item, commonGroundItems, open, onOpenChange }: {
  item: WishlistItem | null;
  commonGroundItems: { hotelName: string; city: string; imageUrl: string | null; friends: Pick<User, 'id' | 'firstName' | 'lastName' | 'profileImageUrl' | 'email'>[] }[] | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = useState<WishlistDetailData>({
    editorialSummary: null,
    awards: null,
    friends: [],
    heroPhotoUrl: null,
    websiteUrl: null,
  });
  const [loading, setLoading] = useState(false);

  const fetchDetails = useCallback(async (wishlistItem: WishlistItem) => {
    setLoading(true);
    setDetail({ editorialSummary: null, awards: null, friends: [], heroPhotoUrl: null, websiteUrl: null });

    const normalize = (s: string) => s.toLowerCase().replace(/['']/g, "").replace(/\s+/g, " ").trim();
    const matchingCG = (commonGroundItems || []).find(cg =>
      normalize(cg.hotelName) === normalize(wishlistItem.hotelName) &&
      (normalize(cg.city) === normalize(wishlistItem.city) || normalize(cg.city).includes(normalize(wishlistItem.majorCity || wishlistItem.city)))
    );
    const friends = matchingCG?.friends || [];

    let editorialSummary: string | null = null;
    let heroPhotoUrl: string | null = wishlistItem.imageUrl || wishlistItem.googlePhotoUrl || null;
    let websiteUrl: string | null = null;

    let resolvedPlaceId = wishlistItem.placeId;
    if (!resolvedPlaceId) {
      try {
        const searchQuery = `${wishlistItem.hotelName} ${wishlistItem.majorCity || wishlistItem.city}`;
        const acRes = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(searchQuery)}`, { credentials: "include" });
        if (acRes.ok) {
          const acData = await acRes.json();
          if (acData.length > 0) {
            resolvedPlaceId = acData[0].placeId;
          }
        }
      } catch {}
    }

    if (resolvedPlaceId) {
      try {
        const res = await fetch(`/api/places/details/${resolvedPlaceId}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          editorialSummary = data.editorialSummary || null;
          websiteUrl = data.websiteUrl || null;
          if (data.photoUrl && !heroPhotoUrl) {
            heroPhotoUrl = data.photoUrl;
          }
        }
      } catch {}
    }

    let awards: WishlistDetailData["awards"] = null;
    try {
      const res = await fetch("/api/hotels/check-awards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelName: wishlistItem.hotelName,
          city: wishlistItem.city,
          country: wishlistItem.country,
          majorCity: wishlistItem.majorCity,
        }),
        credentials: "include",
      });
      if (res.ok) {
        awards = await res.json();
      }
    } catch {}

    setDetail({ editorialSummary, awards, friends, heroPhotoUrl, websiteUrl });
    setLoading(false);
  }, [commonGroundItems]);

  useEffect(() => {
    if (open && item) {
      fetchDetails(item);
    }
  }, [open, item, fetchDetails]);

  if (!item) return null;

  const hasAnyAward = detail.awards && (detail.awards.hasMichelinGuide || detail.awards.hasMichelinStar || detail.awards.hasForbesTravelGuide);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="fixed z-50 inset-0 flex items-center justify-center pointer-events-none"
          >
          <div
            className="pointer-events-auto w-full max-w-[520px] max-h-[85vh] overflow-y-auto bg-[#F2F0ED] border-[0.5px] border-[#D1CDC7] rounded-none mx-4 relative"
          >
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/30 backdrop-blur-md text-white/90 hover:bg-black/50 transition-colors"
              data-testid="button-close-detail"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative w-full aspect-[16/10] overflow-hidden rounded-t-[24px] sm:rounded-none">
              {detail.heroPhotoUrl ? (
                <img
                  src={detail.heroPhotoUrl}
                  alt={item.hotelName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#D1CDC7] to-[#F2F0ED]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <span className="text-[9px] font-sans uppercase tracking-widest text-white/60 block mb-1.5">Wishlist</span>
                <h2 className="font-serif text-2xl sm:text-3xl text-white leading-tight" data-testid="text-detail-hotel-name">
                  {item.hotelName}
                </h2>
                <div className="flex items-center gap-1.5 mt-2">
                  <MapPin className="w-3 h-3 text-white/60" />
                  <p className="text-xs font-sans text-white/70 tracking-wide">
                    {item.majorCity || item.city}{item.suburb && item.suburb !== (item.majorCity || item.city) ? ` · ${item.suburb}` : ""}{item.country ? `, ${item.country}` : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 pt-4 space-y-5">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-[#C2B4A3]" />
                </div>
              ) : (
                <>
                  {hasAnyAward && (
                    <div className="space-y-2.5" data-testid="section-accolades">
                      <span className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60">Accolades</span>
                      <div className="flex flex-wrap gap-2">
                        {detail.awards!.hasMichelinGuide && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#C2B4A3]/15 border-[0.5px] border-[#C2B4A3]/30" data-testid="badge-michelin-key">
                            <Award className="w-3.5 h-3.5 text-[#C2B4A3]" />
                            <span className="text-[10px] font-serif tracking-wide text-[#2C2926]">Michelin Key</span>
                          </div>
                        )}
                        {detail.awards!.hasMichelinStar && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#C2B4A3]/15 border-[0.5px] border-[#C2B4A3]/30" data-testid="badge-michelin-star">
                            <Award className="w-3.5 h-3.5 text-[#C2B4A3]" />
                            <span className="text-[10px] font-serif tracking-wide text-[#2C2926]">Michelin Star</span>
                          </div>
                        )}
                        {detail.awards!.hasForbesTravelGuide && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#C2B4A3]/15 border-[0.5px] border-[#C2B4A3]/30" data-testid="badge-forbes">
                            <Award className="w-3.5 h-3.5 text-[#C2B4A3]" />
                            <span className="text-[10px] font-serif tracking-wide text-[#2C2926]">Forbes Travel Guide</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {detail.editorialSummary && (
                    <div className="space-y-2" data-testid="section-description">
                      <span className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60">About</span>
                      <p className="text-sm font-sans text-[#2C2926]/80 leading-relaxed">
                        {detail.editorialSummary}
                      </p>
                    </div>
                  )}

                  {detail.friends.length > 0 && (
                    <div className="space-y-2.5" data-testid="section-social-context">
                      <span className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60">Also on Their Wishlist</span>
                      <div className="flex items-center gap-3 p-3 rounded-none bg-white/50 border-[0.5px] border-[#D1CDC7]/40">
                        <div className="flex -space-x-2">
                          {detail.friends.slice(0, 4).map((friend) => (
                            <div key={friend.id} className="w-8 h-8 rounded-full border-2 border-[#F2F0ED] overflow-hidden" title={friend.firstName || "Friend"}>
                              {friend.profileImageUrl ? (
                                <img src={friend.profileImageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-[#C2B4A3]/30 flex items-center justify-center">
                                  <span className="text-[10px] font-serif font-medium text-[#78726B]">{(friend.firstName || "?")[0].toUpperCase()}</span>
                                </div>
                              )}
                            </div>
                          ))}
                          {detail.friends.length > 4 && (
                            <div className="w-8 h-8 rounded-full border-2 border-[#F2F0ED] bg-[#C2B4A3]/20 flex items-center justify-center">
                              <span className="text-[9px] font-sans text-[#78726B]">+{detail.friends.length - 4}</span>
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] font-serif italic text-[#78726B] tracking-wide">
                          {(() => {
                            const names = detail.friends.map(f => f.firstName || f.email?.split("@")[0] || "Friend");
                            if (names.length === 1) return `Vetted by ${names[0]}`;
                            if (names.length === 2) return `Vetted by ${names[0]} and ${names[1]}`;
                            return `Vetted by ${names[0]} and ${names.length - 1} others`;
                          })()}
                        </span>
                      </div>
                    </div>
                  )}

                  {!detail.editorialSummary && !hasAnyAward && detail.friends.length === 0 && !detail.websiteUrl && (
                    <div className="text-center py-4">
                      <p className="text-xs font-sans text-[#78726B]/50">A beautiful stay awaits you.</p>
                    </div>
                  )}

                  {detail.websiteUrl && (
                    <a
                      href={detail.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-full border border-[#2C2926] text-[#2C2926] font-serif text-sm uppercase tracking-[0.15em] transition-all duration-300 hover:bg-[#C2B4A3] hover:border-[#C2B4A3] hover:text-white"
                      data-testid="button-visit-website"
                    >
                      <span>Visit Website</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function WishlistCard({ item, index, onClick }: { item: WishlistItem; index: number; onClick: () => void }) {
  const { toast } = useToast();
  const deleteItem = useDeleteWishlistItem();

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Remove this hotel from your wishlist?")) {
      try {
        await deleteItem.mutateAsync(item.id);
        toast({
          title: "Removed",
          description: "Hotel removed from your wishlist.",
        });
      } catch {
        toast({
          title: "Error",
          description: "Could not remove this hotel.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="group relative w-full overflow-hidden rounded-none border-[0.5px] border-[#D1CDC7] aspect-[3/4] cursor-pointer"
      onClick={onClick}
      data-testid={`card-wishlist-${item.id}`}
    >
      {(item.imageUrl || item.googlePhotoUrl) ? (
        <img
          src={item.imageUrl || item.googlePhotoUrl!}
          alt={item.hotelName}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 md:group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#D1CDC7] to-[#F2F0ED]" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-20 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
        <button
          onClick={handleDelete}
          className="p-1.5 sm:p-2 rounded-full bg-black/30 backdrop-blur-md text-white/90 transition-colors"
          data-testid={`button-delete-wishlist-${item.id}`}
        >
          <X className="w-3 h-3 sm:w-4 sm:h-4" />
        </button>
      </div>

      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10">
        <span className="text-[7px] sm:text-[9px] font-sans uppercase tracking-widest px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-white/15 backdrop-blur-sm text-white/80 border border-white/20" data-testid={`badge-planned-${item.id}`}>
          Planned
        </span>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-5 md:p-8 z-10">
        <h3 className="font-serif text-base sm:text-xl md:text-3xl text-white leading-tight mb-1 sm:mb-2" data-testid={`text-wishlist-hotel-${item.id}`}>
          {item.hotelName}
        </h3>
        <p className="text-[10px] sm:text-sm text-white/70 font-sans tracking-wide" data-testid={`text-wishlist-city-${item.id}`}>
          {item.majorCity || item.city}{item.suburb && item.suburb !== (item.majorCity || item.city) ? ` · ${item.suburb}` : ""}
        </p>
      </div>
    </motion.div>
  );
}

const VIBE_CHECKS = [
  "You both gravitate toward warm minimalist interiors.",
  "A shared eye for heritage architecture and quiet luxury.",
  "You both seek out design-forward escapes.",
  "A mutual love for understated elegance.",
  "You share a taste for intimate, storied properties.",
  "Both drawn to places with character and soul.",
  "A shared appreciation for curated, boutique stays.",
  "You both value atmosphere over amenity lists.",
];

function getVibeCheck(hotelName: string, index: number): string {
  const hash = hotelName.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return VIBE_CHECKS[(hash + index) % VIBE_CHECKS.length];
}

function CommonGroundCard({ item, index, onClick }: { item: { hotelName: string; city: string; imageUrl: string | null; friends: Pick<User, 'id' | 'firstName' | 'lastName' | 'profileImageUrl' | 'email'>[] }; index: number; onClick: () => void }) {
  const [imgError, setImgError] = useState(false);
  const hasImage = item.imageUrl && !imgError;

  const friendNames = item.friends.map(f => f.firstName || f.email?.split("@")[0] || "Friend");
  const vettedLabel = friendNames.length === 1
    ? `Also Vetted by ${friendNames[0]}`
    : friendNames.length === 2
    ? `Also Vetted by ${friendNames[0]} and ${friendNames[1]}`
    : `Also Vetted by ${friendNames[0]} and ${friendNames.length - 1} others`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="group relative w-full overflow-hidden rounded-none border-[0.5px] border-[#D1CDC7] aspect-[3/4] cursor-pointer"
      onClick={onClick}
      data-testid={`card-common-ground-${index}`}
    >
      {hasImage ? (
        <img
          src={item.imageUrl!}
          alt={item.hotelName}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 md:group-hover:scale-105"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#D1CDC7] to-[#F2F0ED]" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

      <div className="absolute inset-0 z-10 bg-[#2C2926]/40 opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="flex -space-x-2.5 mb-4">
          {item.friends.slice(0, 4).map((friend) => (
            <div key={friend.id} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-white/30 overflow-hidden">
              {friend.profileImageUrl ? (
                <img src={friend.profileImageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#C2B4A3]/40 flex items-center justify-center">
                  <span className="text-xs font-serif font-medium text-white">{(friend.firstName || "?")[0].toUpperCase()}</span>
                </div>
              )}
            </div>
          ))}
          {item.friends.length > 4 && (
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-white/30 bg-black/30 backdrop-blur-sm flex items-center justify-center">
              <span className="text-[10px] text-white/90 font-sans">+{item.friends.length - 4}</span>
            </div>
          )}
        </div>
        <p className="font-serif text-sm sm:text-base text-[#C2B4A3] text-center tracking-wide mb-3" data-testid={`text-vetted-hover-${index}`}>
          {vettedLabel}
        </p>
        <div className="w-8 h-px bg-[#C2B4A3]/40 mb-3" />
        <p className="font-serif italic text-[10px] sm:text-xs text-white/70 text-center leading-relaxed max-w-[200px]" data-testid={`text-vibe-check-${index}`}>
          {getVibeCheck(item.hotelName, index)}
        </p>
      </div>

      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10 flex items-center gap-1.5 md:group-hover:opacity-0 transition-opacity duration-300">
        <div className="flex -space-x-2">
          {item.friends.slice(0, 3).map((friend) => (
            <div key={friend.id} className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-[1.5px] border-white/40 overflow-hidden">
              {friend.profileImageUrl ? (
                <img src={friend.profileImageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#C2B4A3]" />
              )}
            </div>
          ))}
          {item.friends.length > 3 && (
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-[1.5px] border-white/40 bg-black/40 backdrop-blur-sm flex items-center justify-center">
              <span className="text-[7px] text-white/90 font-sans">+{item.friends.length - 3}</span>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none md:group-hover:opacity-0 transition-opacity duration-300">
        <div className="p-3 sm:p-5 md:p-8">
          <div className="mb-2 sm:mb-3">
            <span className="text-[8px] sm:text-[10px] font-serif italic text-[#C2B4A3] tracking-wide" data-testid={`text-collective-${index}`}>
              Also in {item.friends[0]?.firstName || item.friends[0]?.email?.split("@")[0] || "friend"}'s Collective
              {item.friends.length > 1 && ` +${item.friends.length - 1} more`}
            </span>
          </div>

          <h3 className={`font-serif ${getDynamicOverlayNameClass(item.hotelName)} text-white leading-tight mb-1 sm:mb-2`}>
            {item.hotelName}
          </h3>

          <p className="text-[10px] sm:text-sm text-white/70 font-sans tracking-wide">
            {item.city}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

type WishlistMode = "my-wishlist" | "common-ground";

export default function Wishlist() {
  const { data: items, isLoading } = useWishlist();
  const createItem = useCreateWishlistItem();
  const { data: commonGroundItems, isLoading: cgLoading } = useCommonGround();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [mode, setMode] = useState<WishlistMode>("my-wishlist");
  const [hotelName, setHotelName] = useState("");
  const [city, setCity] = useState("");
  const [majorCity, setMajorCity] = useState("");
  const [suburb, setSuburb] = useState("");
  const [country, setCountry] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [googlePhotoUrl, setGooglePhotoUrl] = useState("");

  const [detailItem, setDetailItem] = useState<WishlistItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [cityFilter, setCityFilter] = useState<string | null>(null);

  const wishlistCities = (() => {
    if (!items || items.length === 0) return [];
    const cityMap = new Map<string, number>();
    for (const item of items) {
      const c = (item.majorCity || item.city || "").trim();
      if (c) cityMap.set(c, (cityMap.get(c) || 0) + 1);
    }
    return Array.from(cityMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);
  })();

  const filteredItems = cityFilter
    ? (items || []).filter(item => (item.majorCity || item.city || "").trim() === cityFilter)
    : items;

  const [cgDetailItem, setCgDetailItem] = useState<WishlistItem | null>(null);

  const handleOpenDetail = (item: WishlistItem) => {
    setDetailItem(item);
    setIsDetailOpen(true);
  };

  const handleOpenCGDetail = (cgItem: { hotelName: string; city: string; imageUrl: string | null; placeId?: string | null; majorCity?: string | null; suburb?: string | null; country?: string | null; friends: any[] }) => {
    const fakeWishlistItem: WishlistItem = {
      id: 0,
      userId: null,
      hotelName: cgItem.hotelName,
      city: cgItem.city,
      imageUrl: cgItem.imageUrl,
      googlePhotoUrl: null,
      placeId: cgItem.placeId || null,
      majorCity: cgItem.majorCity || null,
      suburb: cgItem.suburb || null,
      country: cgItem.country || null,
      sortPriority: 0,
      matchSlug: null,
    };
    setDetailItem(fakeWishlistItem);
    setIsDetailOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createItem.mutateAsync({
        hotelName,
        city,
        majorCity: majorCity || undefined,
        suburb: suburb || undefined,
        country: country || undefined,
        placeId: placeId || undefined,
        imageUrl: imageUrl.trim() || undefined,
        googlePhotoUrl: googlePhotoUrl || undefined,
        sortPriority: items?.length || 0,
      });
      toast({
        title: "Added to Wishlist",
        description: `${hotelName} has been added to your wishlist.`,
      });
      setHotelName("");
      setCity("");
      setMajorCity("");
      setSuburb("");
      setCountry("");
      setPlaceId("");
      setImageUrl("");
      setGooglePhotoUrl("");
      setIsDialogOpen(false);
    } catch (err: any) {
      const msg = err?.message || "Could not add to wishlist.";
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F2F0ED] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#78726B]/40" />
      </div>
    );
  }

  const modeSubtitles: Record<WishlistMode, string> = {
    "my-wishlist": "The Suite Life, Eventually.",
    "common-ground": "Mutual Wishlist Matches",
  };

  return (
    <div className="min-h-screen bg-[#F2F0ED] pb-28 md:pb-0">
      <header className="pt-16 pb-6 px-6 md:pt-32 md:pb-10 text-center">
        <h1 className="font-serif text-4xl md:text-6xl font-medium text-[#2C2926] mb-4" style={{ letterSpacing: '0.2rem' }} data-testid="text-wishlist-title">My Wishlist</h1>
        <p className="font-sans text-xs uppercase tracking-[0.3em] text-[#78726B] mb-8">{modeSubtitles[mode]}</p>

        {isAuthenticated && (
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            <button
              onClick={() => setMode("my-wishlist")}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-serif tracking-wide transition-all duration-300 ${
                mode === "my-wishlist"
                  ? "bg-[#2C2926] text-white"
                  : "text-[#78726B] border-[0.5px] border-[#D1CDC7] hover:border-[#2C2926] hover:text-[#2C2926]"
              }`}
              data-testid="button-mode-my-wishlist"
            >
              <Heart className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">My Wishlist</span>
            </button>
            <button
              onClick={() => setMode("common-ground")}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-[10px] sm:text-xs font-serif tracking-wide transition-all duration-300 ${
                mode === "common-ground"
                  ? "bg-[#2C2926] text-white"
                  : "text-[#78726B] border-[0.5px] border-[#D1CDC7] hover:border-[#2C2926] hover:text-[#2C2926]"
              }`}
              data-testid="button-mode-common-ground"
            >
              <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Common Ground</span>
            </button>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-12 lg:px-16">
        <AnimatePresence mode="wait">
          {mode === "my-wishlist" && (
            <motion.div
              key="my-wishlist"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {isAuthenticated && (
                <div className="flex items-center justify-between mb-6">
                  <div className="flex-1" />
                  <button
                    onClick={() => setIsDialogOpen(true)}
                    className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-serif tracking-wide transition-all duration-300 border border-[#D1CDC7] text-[#2C2926] hover:border-[#2C2926]"
                    data-testid="button-add-wishlist"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add to Wishlist</span>
                  </button>
                </div>
              )}

              {wishlistCities.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-8">
                  <button
                    onClick={() => setCityFilter(null)}
                    className={`px-3.5 py-1.5 rounded-full text-[10px] font-sans uppercase tracking-wider transition-all duration-200 border-[0.5px] ${
                      !cityFilter
                        ? "bg-[#2C2926] text-white border-[#2C2926]"
                        : "text-[#78726B] border-[#D1CDC7] hover:border-[#2C2926] hover:text-[#2C2926]"
                    }`}
                    data-testid="button-filter-all"
                  >
                    All
                  </button>
                  {wishlistCities.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCityFilter(cityFilter === c ? null : c)}
                      className={`px-3.5 py-1.5 rounded-full text-[10px] font-sans uppercase tracking-wider transition-all duration-200 border-[0.5px] ${
                        cityFilter === c
                          ? "bg-[#2C2926] text-white border-[#2C2926]"
                          : "text-[#78726B] border-[#D1CDC7] hover:border-[#2C2926] hover:text-[#2C2926]"
                      }`}
                      data-testid={`button-filter-${c.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}

              {(!filteredItems || filteredItems.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-24 text-[#78726B]/50 space-y-4">
                  <div className="w-20 h-20 rounded-full border-[0.5px] border-[#D1CDC7] flex items-center justify-center">
                    <span className="font-serif text-3xl text-[#78726B]/40">0</span>
                  </div>
                  {isAuthenticated ? (
                    <p className="font-serif text-lg tracking-wide">No hotels on your wishlist yet</p>
                  ) : (
                    <>
                      <p className="font-serif text-lg tracking-wide">Your future stays await</p>
                      <a
                        href="/api/login"
                        className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-[#2C2926] text-[#2C2926] font-serif text-sm uppercase tracking-[0.15em] transition-all duration-300 hover:bg-[#2C2926] hover:text-[#F2F0ED]"
                        data-testid="button-sign-in-wishlist"
                      >
                        <LogIn className="w-4 h-4" />
                        Sign in to start your wishlist
                      </a>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 lg:gap-8">
                  {filteredItems!.map((item, index) => (
                    <div key={item.id}>
                      <WishlistCard item={item} index={index} onClick={() => handleOpenDetail(item)} />
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {mode === "common-ground" && (
            <motion.div
              key="common-ground"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {cgLoading ? (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="w-8 h-8 animate-spin text-[#78726B]/40" />
                </div>
              ) : commonGroundItems && commonGroundItems.length > 0 ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 lg:gap-8">
                  {commonGroundItems.map((item, index) => (
                    <CommonGroundCard key={`${item.hotelName}-${item.city}`} item={item} index={index} onClick={() => handleOpenCGDetail(item)} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-[#78726B]/50 space-y-4">
                  <div className="w-20 h-20 rounded-full border-[0.5px] border-[#D1CDC7] flex items-center justify-center">
                    <Heart className="w-8 h-8 text-[#78726B]/30" />
                  </div>
                  <p className="font-serif text-lg tracking-wide">No Common Ground Yet</p>
                  <p className="text-xs font-sans text-[#78726B]/60 text-center max-w-xs">
                    When you and your friends have the same hotels on your wishlists, they'll appear here.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <WishlistDetailModal
        item={detailItem}
        commonGroundItems={commonGroundItems}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[420px] bg-white border-[0.5px] border-[#D1CDC7] p-0 overflow-y-auto max-h-[90vh] rounded-none">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[#D1CDC7] to-transparent" />
          <div className="px-8 pb-8 pt-4">
            <DialogHeader className="mb-8 text-center space-y-2">
              <DialogTitle className="font-serif text-3xl font-normal text-[#2C2926]">
                Add to Wishlist
              </DialogTitle>
              <p className="text-xs font-sans uppercase tracking-widest text-[#78726B]">
                Save a hotel you'd love to visit
              </p>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-sans uppercase tracking-wider text-[#78726B]">Hotel</Label>
                  <PlacesAutocomplete
                    initialValue={hotelName}
                    placeholder="Search for a hotel..."
                    testIdPrefix="wishlist-hotel"
                    onSelect={(details) => {
                      setHotelName(details.name);
                      setCity(details.city);
                      setMajorCity(details.majorCity || details.city);
                      setSuburb(details.suburb || "");
                      setCountry(details.country);
                      setPlaceId(details.placeId);
                      if (details.photoUrl) setGooglePhotoUrl(details.photoUrl);
                    }}
                  />
                  {city && (
                    <p className="text-[11px] font-sans text-[#78726B]/60 mt-1">
                      {city}{country ? `, ${country}` : ""}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wishlistImage" className="text-xs font-sans uppercase tracking-wider text-[#78726B]">Image URL <span className="normal-case tracking-normal text-[#C2B4A3]">(optional)</span></Label>
                  <Input
                    id="wishlistImage"
                    data-testid="input-wishlist-image"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="bg-transparent border-0 border-b border-[#D1CDC7] rounded-none px-0 focus-visible:ring-0 focus-visible:border-[#2C2926] text-[#2C2926] placeholder:text-[#D1CDC7] text-sm"
                    placeholder="https://..."
                    type="text"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={createItem.isPending}
                className="w-full py-3 rounded-full border border-[#2C2926] text-[#2C2926] text-sm font-serif tracking-wide transition-all duration-300 hover:bg-[#2C2926] hover:text-white disabled:opacity-50 flex items-center justify-center"
                data-testid="button-submit-wishlist"
              >
                {createItem.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add to Wishlist"}
              </button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
      <Navigation />
    </div>
  );
}
