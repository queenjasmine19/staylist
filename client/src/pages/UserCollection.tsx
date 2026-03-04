import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { EntryCard } from "@/components/EntryCard";
import { Loader2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useWishlist, useCreateWishlistItem } from "@/hooks/use-wishlist";
import { useEntries } from "@/hooks/use-entries";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { Entry, User } from "@shared/schema";

type UserStats = {
  followerCount: number;
  followingCount: number;
  stayCount: number;
  followers: { id: string; firstName: string | null; profileImageUrl: string | null }[];
};

export default function UserCollection({ params }: { params: { id: string } }) {
  const userId = params.id;

  const { data: profileUser, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}`, { credentials: "include" });
      if (!res.ok) throw new Error("User not found");
      return res.json();
    },
  });

  const { data: entries, isLoading: entriesLoading } = useQuery<Entry[]>({
    queryKey: ["/api/users", userId, "entries"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/entries`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch entries");
      return res.json();
    },
  });

  const { data: stats } = useQuery<UserStats>({
    queryKey: ["/api/users", userId, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/stats`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { data: wishlistItems } = useWishlist();
  const { data: myEntries } = useEntries();
  const createWishlistItem = useCreateWishlistItem();

  const normalize = (s: string) => s.toLowerCase().replace(/[\u0027\u2018\u2019\u0060\u00B4]/g, "").replace(/\s+/g, " ").trim();

  const savedHotelKeys = useMemo(() => {
    if (!wishlistItems) return new Set<string>();
    const keys = new Set<string>();
    wishlistItems.forEach(w => {
      keys.add(`${normalize(w.hotelName)}|${normalize(w.majorCity || w.city)}`);
      if (w.placeId) keys.add(w.placeId);
    });
    return keys;
  }, [wishlistItems]);

  const myStayedKeys = useMemo(() => {
    if (!myEntries) return new Set<string>();
    const keys = new Set<string>();
    myEntries.forEach(e => {
      keys.add(`${normalize(e.hotelName)}|${normalize(e.majorCity || e.city)}`);
      if (e.placeId) keys.add(e.placeId);
    });
    return keys;
  }, [myEntries]);

  const handleSaveToWishlist = async (entry: Entry) => {
    if (createWishlistItem.isPending) return;
    const nameKey = `${normalize(entry.hotelName)}|${normalize(entry.majorCity || entry.city)}`;
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

  const isLoading = userLoading || entriesLoading;

  const displayName = profileUser?.firstName
    ? `${profileUser.firstName}${profileUser.lastName ? ` ${profileUser.lastName}` : ""}`
    : profileUser?.email?.split("@")[0] || "User";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F2F0ED] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#78726B]/40" />
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="min-h-screen bg-[#F2F0ED] pb-28 md:pb-0">
        <header className="pt-16 pb-12 px-6 md:pt-32 md:pb-20 text-center">
          <h1 className="font-serif text-4xl md:text-6xl font-medium text-[#2C2926] mb-4" style={{ letterSpacing: "0.2rem" }}>
            User Not Found
          </h1>
        </header>
        <div className="flex justify-center">
          <Link
            href="/map"
            className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-[#2C2926] text-[#2C2926] font-serif text-sm uppercase tracking-[0.15em] transition-all duration-300 hover:bg-[#2C2926] hover:text-[#F2F0ED]"
            data-testid="link-back-destinations-404"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Destinations
          </Link>
        </div>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F0ED] pb-28 md:pb-0">
      <header className="pt-16 pb-12 px-6 md:pt-32 md:pb-20 text-center">
        <div className="mb-6">
          <Link
            href="/map"
            className="inline-flex items-center gap-2 text-xs font-sans uppercase tracking-[0.2em] text-[#78726B] transition-colors hover:text-[#2C2926]"
            data-testid="link-back-destinations"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Destinations
          </Link>
        </div>

        {profileUser.profileImageUrl && (
          <div className="flex justify-center mb-6">
            <img
              src={profileUser.profileImageUrl}
              alt=""
              className="w-20 h-20 rounded-full object-cover border-[0.5px] border-[#D1CDC7]"
              data-testid="img-user-avatar"
            />
          </div>
        )}

        <h1
          className="font-serif text-3xl md:text-5xl font-medium text-[#2C2926] mb-4"
          style={{ letterSpacing: "0.15rem" }}
          data-testid="text-user-collection-title"
        >
          {displayName}&rsquo;s Collection
        </h1>

        {stats && (
          <div className="flex items-center justify-center gap-6 sm:gap-10 mb-4" data-testid="user-social-stats-bar">
            <div className="flex items-center gap-2" data-testid="user-stat-followers">
              <div className="flex items-center gap-1.5">
                {stats.followers.length > 0 && (
                  <div className="flex -space-x-1.5 mr-1">
                    {stats.followers.slice(0, 3).map((follower) => (
                      <div key={follower.id} className="w-5 h-5 rounded-full border-[1.5px] border-[#F2F0ED] overflow-hidden">
                        {follower.profileImageUrl ? (
                          <img src={follower.profileImageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-[#C2B4A3]" />
                        )}
                      </div>
                    ))}
                    {stats.followerCount > 3 && (
                      <div className="w-5 h-5 rounded-full border-[1.5px] border-[#F2F0ED] bg-[#D1CDC7] flex items-center justify-center">
                        <span className="text-[7px] text-[#2C2926] font-sans">+{stats.followerCount - 3}</span>
                      </div>
                    )}
                  </div>
                )}
                <span className="text-sm font-sans font-medium text-[#2C2926]" data-testid="text-user-follower-count">{stats.followerCount}</span>
                <span className="text-[10px] font-serif tracking-wide text-[#78726B]">Followers</span>
              </div>
            </div>

            <div className="w-px h-4 bg-[#D1CDC7]" />

            <div className="flex items-center gap-1.5" data-testid="user-stat-following">
              <span className="text-sm font-sans font-medium text-[#2C2926]" data-testid="text-user-following-count">{stats.followingCount}</span>
              <span className="text-[10px] font-serif tracking-wide text-[#78726B]">Following</span>
            </div>

            <div className="w-px h-4 bg-[#D1CDC7]" />

            <div className="flex items-center gap-1.5" data-testid="user-stat-stays">
              <span className="text-sm font-sans font-medium text-[#2C2926]" data-testid="text-user-stays-count">{stats.stayCount}</span>
              <span className="text-[10px] font-serif tracking-wide text-[#78726B]">Stays</span>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-12 lg:px-16">
        {entries && entries.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 lg:gap-8"
          >
            {entries.map((entry, index) => {
              const nameKey = `${normalize(entry.hotelName)}|${normalize(entry.majorCity || entry.city)}`;
              const isAlreadySaved = savedHotelKeys.has(nameKey) || (entry.placeId ? savedHotelKeys.has(entry.placeId) : false);
              const isMyStay = myStayedKeys.has(nameKey) || (entry.placeId ? myStayedKeys.has(entry.placeId) : false);
              return (
                <div key={entry.id}>
                  <EntryCard
                    entry={entry}
                    index={index}
                    vettedByUser={profileUser ? { id: profileUser.id, firstName: profileUser.firstName, lastName: profileUser.lastName, profileImageUrl: profileUser.profileImageUrl } : null}
                    onSave={isAuthenticated ? () => handleSaveToWishlist(entry) : undefined}
                    isSaved={isAlreadySaved || isMyStay}
                    hideHeart={isMyStay}
                  />
                </div>
              );
            })}
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-[#78726B]/50 space-y-4">
            <p className="font-serif text-lg tracking-wide">
              No stays yet
            </p>
            <p className="text-xs font-sans text-[#78726B]/60 text-center max-w-xs">
              {displayName} hasn&rsquo;t added any hotel stays to their collection.
            </p>
          </div>
        )}
      </main>
      <Navigation />
    </div>
  );
}
