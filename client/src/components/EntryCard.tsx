import { motion, AnimatePresence } from "framer-motion";
import { MoreHorizontal, Pencil, Trash2, X, Eye, Users, CalendarDays, Plus, Loader2, Heart } from "lucide-react";
import { PearlsRating } from "./PearlsRating";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDeleteEntry } from "@/hooks/use-entries";
import { useCommonGround, useTripPlans, useCreateTripPlan, useAddTripDay, useTripDays } from "@/hooks/use-trips";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useState, useCallback, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import type { Entry, User } from "@shared/schema";
import { getDynamicOverlayNameClass, getDynamicInlineNameClass } from "@/lib/utils";

interface EntryCardProps {
  entry: Entry;
  index: number;
  onEdit?: (entry: Entry) => void;
  vettedByUser?: Pick<User, 'id' | 'firstName' | 'lastName' | 'profileImageUrl'> | null;
  onSave?: () => void;
  isSaved?: boolean;
  hideHeart?: boolean;
}

function EntryDetailModal({ entry, open, onClose, onEdit, vettedByUser }: { entry: Entry; open: boolean; onClose: () => void; onEdit?: (entry: Entry) => void; vettedByUser?: Pick<User, 'id' | 'firstName' | 'lastName' | 'profileImageUrl'> | null }) {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const deleteEntry = useDeleteEntry();
  const [imgError, setImgError] = useState(false);
  const { data: commonGroundItems } = useCommonGround();
  const { data: tripPlans } = useTripPlans();
  const createTripPlan = useCreateTripPlan();
  const addDay = useAddTripDay();
  const [showTripSelect, setShowTripSelect] = useState(false);
  const [showNewTripForm, setShowNewTripForm] = useState(false);
  const [newTripName, setNewTripName] = useState("");
  const [newTripDate, setNewTripDate] = useState("");
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);

  const displayImage = entry.imageUrl || entry.googlePhotoUrl || null;
  const hasImage = displayImage && !imgError;

  const collectiveMatch = useMemo(() => {
    if (!commonGroundItems || !isAuthenticated) return null;
    const normalize = (s: string) => s.toLowerCase().replace(/['']/g, "").replace(/\s+/g, " ").trim();
    if (entry.placeId) {
      return commonGroundItems.find(item => item.placeId && item.placeId === entry.placeId) || null;
    }
    const key = `${normalize(entry.hotelName)}|${normalize(entry.majorCity || entry.city)}`;
    return commonGroundItems.find(item =>
      `${normalize(item.hotelName)}|${normalize(item.majorCity || item.city)}` === key
    ) || null;
  }, [commonGroundItems, entry, isAuthenticated]);

  const handleDelete = async () => {
    if (confirm("Are you sure you want to remove this stay?")) {
      try {
        await deleteEntry.mutateAsync(entry.id);
        toast({
          title: "Stay Removed",
          description: "The hotel has been removed from your collection.",
        });
        onClose();
      } catch {
        toast({
          title: "Error",
          description: "Could not remove this stay.",
          variant: "destructive",
        });
      }
    }
  };

  const handleAddToTrip = async (tripId: number) => {
    try {
      const daysRes = await fetch(`/api/trips/${tripId}/days`, { credentials: "include" });
      const existingDays = daysRes.ok ? await daysRes.json() : [];
      const maxDay = existingDays.length > 0
        ? Math.max(...existingDays.map((d: any) => d.dayNumber))
        : 0;

      await addDay.mutateAsync({
        tripPlanId: tripId,
        dayNumber: maxDay + 1,
        hotelName: entry.hotelName,
        city: entry.city,
        majorCity: entry.majorCity || null,
        suburb: entry.suburb || null,
        imageUrl: entry.imageUrl || entry.googlePhotoUrl,
        vettedByUserId: vettedByUser?.id || null,
      });
      toast({ title: "Added to Trip", description: `${entry.hotelName} added to Day ${maxDay + 1}.` });
      setShowTripSelect(false);
    } catch {
      toast({ title: "Error", description: "Could not add to trip.", variant: "destructive" });
    }
  };

  const handleCreateNewTrip = async () => {
    if (!newTripName.trim()) return;
    setIsCreatingTrip(true);
    try {
      const trip = await createTripPlan.mutateAsync({
        name: newTripName.trim(),
        tripDate: newTripDate || null,
        totalDays: 7,
      });
      await addDay.mutateAsync({
        tripPlanId: trip.id,
        dayNumber: 1,
        hotelName: entry.hotelName,
        city: entry.city,
        majorCity: entry.majorCity || null,
        suburb: entry.suburb || null,
        imageUrl: entry.imageUrl || entry.googlePhotoUrl,
        vettedByUserId: vettedByUser?.id || null,
      });
      toast({ title: "Trip Created", description: `${entry.hotelName} added to Day 1 of "${newTripName.trim()}".` });
      setShowTripSelect(false);
      setShowNewTripForm(false);
      setNewTripName("");
      setNewTripDate("");
      onClose();
      navigate("/map?mode=trip-planner");
    } catch {
      toast({ title: "Error", description: "Could not create trip.", variant: "destructive" });
    } finally {
      setIsCreatingTrip(false);
    }
  };

  const amenities = [
    entry.hasSpa && "Spa",
    entry.hasConcierge && "Concierge",
    entry.hasGym && "Gym",
    entry.hasPool && "Pool",
    entry.hasRestaurant && "Restaurant",
    entry.hasMichelinGuide && "Michelin Key",
    entry.hasMichelinStar && "Michelin Star",
    entry.hasForbesTravelGuide && "Forbes Travel Guide",
    entry.hasOceanView && "Ocean View",
    entry.hasCocktailBar && "Cocktail Bar",
    entry.hasDesignForward && "Design-Forward",
    entry.hasLateNightDining && "Late-Night Dining",
    entry.hasRooftop && "Rooftop",
  ].filter(Boolean) as string[];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
          onClick={onClose}
          data-testid={`modal-backdrop-${entry.id}`}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#F2F0ED] rounded-none border-[0.5px] border-[#D1CDC7]"
            onClick={(e) => e.stopPropagation()}
            data-testid={`modal-detail-${entry.id}`}
          >
            <div className="relative w-full aspect-[4/3] overflow-hidden">
              {hasImage ? (
                <img
                  src={displayImage!}
                  alt={entry.hotelName}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#D1CDC7] to-[#F2F0ED]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/30 backdrop-blur-md text-white/90 transition-opacity"
                data-testid={`button-close-modal-${entry.id}`}
              >
                <X className="w-4 h-4" />
              </button>

              {collectiveMatch && (
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#C2B4A3]/80 backdrop-blur-sm border border-[#C2B4A3]">
                  <Users className="w-3 h-3 text-white" />
                  <span className="text-[9px] font-serif italic text-white tracking-wide" data-testid={`badge-collective-${entry.id}`}>
                    In Collective
                  </span>
                </div>
              )}

              {onEdit && (
                <div className="absolute bottom-4 right-4 flex items-center gap-2">
                  <button
                    onClick={() => { onClose(); onEdit(entry); }}
                    className="p-2 rounded-full bg-black/30 backdrop-blur-md text-white/90 transition-opacity"
                    data-testid={`button-modal-edit-${entry.id}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="p-2 rounded-full bg-black/30 backdrop-blur-md text-white/90 transition-opacity"
                    data-testid={`button-modal-delete-${entry.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="px-8 py-8 space-y-6">
              <div>
                <h2 className={`font-serif ${getDynamicInlineNameClass(entry.hotelName)} md:text-2xl text-[#2C2926] leading-tight mb-2`} data-testid={`modal-hotel-name-${entry.id}`}>
                  {entry.hotelName}
                </h2>
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-sm text-[#78726B] font-sans tracking-wide">{entry.majorCity || entry.city}</p>
                  {entry.suburb && entry.suburb !== (entry.majorCity || entry.city) && (
                    <>
                      <span className="text-[#D1CDC7]">&middot;</span>
                      <p className="text-xs text-[#78726B]/60 font-sans italic">Located in {entry.suburb}</p>
                    </>
                  )}
                  {entry.dateOfStay && (
                    <>
                      <span className="text-[#D1CDC7]">&middot;</span>
                      <p className="text-xs text-[#78726B]/70 font-sans tracking-wide">{entry.dateOfStay}</p>
                    </>
                  )}
                </div>
              </div>

              {collectiveMatch && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-none bg-[#C2B4A3]/10 border-[0.5px] border-[#C2B4A3]/30">
                  <div className="flex -space-x-2">
                    {collectiveMatch.friends.slice(0, 3).map((friend) => (
                      <div key={friend.id} className="w-6 h-6 rounded-full border-[1.5px] border-[#F2F0ED] overflow-hidden">
                        {friend.profileImageUrl ? (
                          <img src={friend.profileImageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-[#C2B4A3]" />
                        )}
                      </div>
                    ))}
                  </div>
                  <span className="text-[10px] font-serif italic text-[#78726B] tracking-wide" data-testid={`text-collective-modal-${entry.id}`}>
                    Also in {collectiveMatch.friends[0]?.firstName || collectiveMatch.friends[0]?.email?.split("@")[0] || "friend"}'s Collective
                    {collectiveMatch.friends.length > 1 && ` +${collectiveMatch.friends.length - 1} more`}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60">Vibe Check</span>
                <div className="h-px flex-1 bg-[#D1CDC7]/40" />
                <PearlsRating value={entry.rating} readOnly variant="dark" />
              </div>

              {amenities.length > 0 && (
                <div>
                  <span className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60 block mb-3">Amenities & Accolades</span>
                  <div className="flex flex-wrap gap-2">
                    {amenities.map((amenity) => (
                      <span
                        key={amenity}
                        className="text-[10px] font-sans uppercase tracking-widest px-3 py-1 rounded-full border border-[#D1CDC7] text-[#2C2926]/70 bg-white/50"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {entry.notes && (
                <div>
                  <span className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60 block mb-3">Notes</span>
                  <p className="text-sm text-[#2C2926]/80 font-sans leading-relaxed whitespace-pre-wrap" data-testid={`modal-notes-${entry.id}`}>
                    {entry.notes}
                  </p>
                </div>
              )}

              {vettedByUser && (
                <button
                  onClick={() => navigate(`/user/${vettedByUser.id}`)}
                  className="flex items-center gap-3 px-4 py-3 rounded-none bg-[#C2B4A3]/10 border-[0.5px] border-[#C2B4A3]/30 w-full text-left transition-all hover:bg-[#C2B4A3]/20 cursor-pointer"
                  data-testid={`badge-vetted-by-${entry.id}`}
                >
                  <div className="w-7 h-7 rounded-full border-[1.5px] border-[#F2F0ED] overflow-hidden flex-shrink-0">
                    {vettedByUser.profileImageUrl ? (
                      <img src={vettedByUser.profileImageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#C2B4A3]" />
                    )}
                  </div>
                  <span className="text-[10px] font-serif italic text-[#78726B] tracking-wide">
                    Vetted by {vettedByUser.firstName || "friend"}
                  </span>
                </button>
              )}

              {isAuthenticated && (
                <div className="pt-2">
                  {showTripSelect ? (
                    <div className="space-y-2">
                      <span className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60 block">Add to Trip</span>

                      {showNewTripForm ? (
                        <div className="p-4 rounded-none border-[0.5px] border-[#D1CDC7] bg-white/50 space-y-3">
                          <input
                            type="text"
                            value={newTripName}
                            onChange={(e) => setNewTripName(e.target.value)}
                            placeholder="e.g. Paris Summer '26"
                            className="w-full bg-transparent border-0 border-b border-[#D1CDC7] px-0 py-1.5 text-sm font-sans text-[#2C2926] placeholder:text-[#D1CDC7] focus:outline-none focus:border-[#2C2926]"
                            data-testid="input-new-trip-name"
                            autoFocus
                          />
                          <input
                            type="date"
                            value={newTripDate}
                            onChange={(e) => setNewTripDate(e.target.value)}
                            className="w-full bg-transparent border-0 border-b border-[#D1CDC7] px-0 py-1.5 text-sm font-sans text-[#2C2926] focus:outline-none focus:border-[#2C2926]"
                            data-testid="input-new-trip-date"
                          />
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={handleCreateNewTrip}
                              disabled={!newTripName.trim() || isCreatingTrip}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full bg-[#2C2926] text-white text-xs font-serif tracking-widest uppercase transition-all duration-300 hover:bg-[#2C2926]/90 disabled:opacity-50"
                              data-testid="button-confirm-new-trip"
                            >
                              {isCreatingTrip ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                            </button>
                            <button
                              onClick={() => { setShowNewTripForm(false); setNewTripName(""); setNewTripDate(""); }}
                              className="px-4 py-2.5 rounded-full border-[0.5px] border-[#D1CDC7] text-xs font-serif tracking-wide text-[#78726B] hover:border-[#2C2926] hover:text-[#2C2926] transition-all duration-300"
                              data-testid="button-cancel-new-trip"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowNewTripForm(true)}
                          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-full border-[0.5px] border-[#2C2926] text-sm font-serif tracking-wide text-[#2C2926] hover:bg-[#2C2926] hover:text-white transition-all duration-300 text-left"
                          data-testid="button-create-new-trip"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Create New Trip
                        </button>
                      )}

                      {tripPlans && tripPlans.map((plan) => (
                        <button
                          key={plan.id}
                          onClick={() => handleAddToTrip(plan.id)}
                          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-full border-[0.5px] border-[#D1CDC7] text-xs font-serif tracking-wide text-[#2C2926] hover:border-[#2C2926] transition-all duration-300 text-left"
                          data-testid={`button-add-to-trip-${plan.id}`}
                        >
                          <CalendarDays className="w-3 h-3 text-[#78726B]" />
                          {plan.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowTripSelect(true)}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#2C2926] text-white text-xs font-serif tracking-widest uppercase transition-all duration-300 hover:bg-[#2C2926]/90"
                      data-testid={`button-plan-trip-${entry.id}`}
                    >
                      <CalendarDays className="w-3.5 h-3.5" />
                      Plan Trip
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function EntryCard({ entry, index, onEdit, vettedByUser, onSave, isSaved, hideHeart }: EntryCardProps) {
  const { toast } = useToast();
  const deleteEntry = useDeleteEntry();
  const [imgError, setImgError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownJustClosedRef = useRef(false);

  const handleDelete = async () => {
    if (confirm("Are you sure you want to remove this stay?")) {
      try {
        await deleteEntry.mutateAsync(entry.id);
        toast({
          title: "Stay Removed",
          description: "The hotel has been removed from your collection.",
        });
      } catch {
        toast({
          title: "Error",
          description: "Could not remove this stay.",
          variant: "destructive",
        });
      }
    }
  };

  const displayImage = entry.imageUrl || entry.googlePhotoUrl || null;
  const hasImage = displayImage && !imgError;
  const amenities = [
    entry.hasSpa && "Spa",
    entry.hasConcierge && "Concierge",
    entry.hasGym && "Gym",
    entry.hasPool && "Pool",
    entry.hasRestaurant && "Restaurant",
    entry.hasMichelinGuide && "Michelin Key",
    entry.hasMichelinStar && "Michelin Star",
    entry.hasForbesTravelGuide && "Forbes",
    entry.hasOceanView && "Ocean View",
    entry.hasCocktailBar && "Cocktail Bar",
    entry.hasDesignForward && "Design-Forward",
    entry.hasLateNightDining && "Late-Night",
    entry.hasRooftop && "Rooftop",
  ].filter(Boolean) as string[];

  const handleDropdownChange = useCallback((open: boolean) => {
    setIsDropdownOpen(open);
    if (!open) {
      dropdownJustClosedRef.current = true;
      setTimeout(() => { dropdownJustClosedRef.current = false; }, 200);
      [50, 150, 300].forEach(delay => setTimeout(() => {
        if (!document.querySelector('[data-state="open"][role="dialog"]')) {
          document.body.style.pointerEvents = '';
          document.body.style.removeProperty('pointer-events');
        }
      }, delay));
    }
  }, []);

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (isDropdownOpen || dropdownJustClosedRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-card-click]')) return;
    setIsModalOpen(true);
  }, [isDropdownOpen]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
        className="group relative w-full overflow-hidden rounded-none border-[0.5px] border-[#D1CDC7] aspect-[3/4] cursor-pointer"
        data-testid={`card-entry-${entry.id}`}
        onClick={handleCardClick}
      >
        {hasImage ? (
          <img
            src={displayImage!}
            alt={entry.hotelName}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 md:group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#D1CDC7] to-[#F2F0ED]" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {onEdit && (
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-20 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300" data-no-card-click>
            <DropdownMenu onOpenChange={handleDropdownChange}>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-2 rounded-full bg-black/30 backdrop-blur-md text-white/90 transition-colors"
                  data-testid={`button-actions-${entry.id}`}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white border-[0.5px] border-[#D1CDC7] rounded-md p-1 font-sans text-xs">
                <DropdownMenuItem
                  onSelect={() => onEdit?.(entry)}
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md transition-colors text-[#2C2926]"
                  data-testid={`button-edit-${entry.id}`}
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={handleDelete}
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer text-red-500 rounded-md transition-colors"
                  data-testid={`button-delete-${entry.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
          <div className="absolute bottom-0 left-0 right-0 h-16 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity duration-300 items-center justify-center pointer-events-auto" data-no-card-click>
            <span className="flex items-center gap-2 text-[10px] font-sans uppercase tracking-widest text-white/80 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/20">
              <Eye className="w-3 h-3" />
              View Details
            </span>
          </div>

          <div className="p-3 sm:p-5 md:p-8">
            {amenities.length > 0 && (
              <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-2 sm:mb-3">
                {amenities.map((amenity) => (
                  <span
                    key={amenity}
                    className="text-[7px] sm:text-[9px] font-sans uppercase tracking-widest px-1.5 sm:px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm text-white/80 border border-white/20"
                    data-testid={`tag-amenity-${amenity.toLowerCase()}-${entry.id}`}
                  >
                    {amenity}
                  </span>
                ))}
              </div>
            )}

            <h3 className={`font-serif ${getDynamicOverlayNameClass(entry.hotelName)} text-white leading-tight mb-1 sm:mb-2`} data-testid={`text-hotel-${entry.id}`}>
              {entry.hotelName}
            </h3>

            <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
              <p className="text-[10px] sm:text-sm text-white/70 font-sans tracking-wide" data-testid={`text-city-${entry.id}`}>
                {entry.majorCity || entry.city}
              </p>
              {entry.dateOfStay && (
                <>
                  <span className="text-white/30 hidden sm:inline">&middot;</span>
                  <p className="text-[9px] sm:text-xs text-white/50 font-sans tracking-wide hidden sm:block" data-testid={`text-date-${entry.id}`}>
                    {entry.dateOfStay}
                  </p>
                </>
              )}
              <span className="text-white/30">|</span>
              <div className="flex items-center gap-1.5" data-testid={`rating-display-${entry.id}`}>
                <PearlsRating value={entry.rating} readOnly variant="light" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <EntryDetailModal
        entry={entry}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEdit={onEdit}
        vettedByUser={vettedByUser}
      />
    </>
  );
}
