import { useEntries } from "@/hooks/use-entries";
import { useAuth } from "@/hooks/use-auth";
import { useNetworkFeed } from "@/hooks/use-social";
import { useWishlist } from "@/hooks/use-wishlist";
import { useTripPlans, useTripDays, useTripItineraryItems, useCreateTripPlan, useUpdateTripPlan, useDeleteTripPlan, useAddTripDay, useDeleteTripDay, useAddTripItineraryItem, useUpdateTripItineraryItem, useDeleteTripItineraryItem, useTripStyleMatches, useAIRecommendations, useTripWorkspaceItems, useAddTripWorkspaceItem, useDeleteTripWorkspaceItem } from "@/hooks/use-trips";
import type { AIExperience } from "@/hooks/use-trips";
import { PlacesAutocomplete } from "@/components/PlacesAutocomplete";
import { Navigation } from "@/components/Navigation";
import { Loader2, Sparkles, CalendarDays, Plus, Trash2, MapPin, UtensilsCrossed, X, Check, Star, Dumbbell, Pen, GripVertical, Compass, ChevronDown, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getDynamicInlineNameClass } from "@/lib/utils";

function PlacePhotoThumb({ name, city, size = "sm", className = "", variant = "vetted" }: { name: string; city: string; size?: "sm" | "md" | "lg"; className?: string; variant?: "vetted" | "ai" }) {
  const { data } = useQuery<{ photoUrl: string | null }>({
    queryKey: [`/api/places/photo-lookup?name=${encodeURIComponent(name)}&city=${encodeURIComponent(city)}`],
    staleTime: 1000 * 60 * 30,
  });
  const photoUrl = data?.photoUrl;
  const dims = size === "lg" ? "w-20 h-20 rounded-none" : size === "md" ? "w-14 h-14 rounded-none" : "w-10 h-10 rounded-none";

  const badge = variant === "ai" ? (
    <span className="absolute bottom-0.5 right-0.5 bg-[#C2B4A3]/80 w-4 h-4 rounded-none flex items-center justify-center">
      <Sparkles className="w-2.5 h-2.5 text-white/90" />
    </span>
  ) : (
    <span className="absolute bottom-0.5 right-0.5 text-[7px] font-serif font-bold text-white/90 bg-[#C2B4A3]/80 w-4 h-4 rounded-none flex items-center justify-center leading-none" style={{ textShadow: "0 0.5px 1px rgba(0,0,0,0.2)" }}>V</span>
  );

  const placeholder = variant === "ai" ? (
    <div className="w-full h-full bg-[#C2B4A3]/10 flex items-center justify-center">
      <Sparkles className="text-[#C2B4A3]" style={{ width: size === "lg" ? 18 : size === "md" ? 14 : 11, height: size === "lg" ? 18 : size === "md" ? 14 : 11 }} />
    </div>
  ) : (
    <div className="w-full h-full bg-[#C2B4A3]/10 flex items-center justify-center">
      <span className="font-serif text-[#C2B4A3] font-bold" style={{ fontSize: size === "lg" ? "16px" : size === "md" ? "14px" : "11px" }}>V</span>
    </div>
  );

  return (
    <div className={`${dims} relative overflow-hidden flex-shrink-0 ${className}`}>
      {photoUrl ? (
        <>
          <img src={photoUrl} alt="" className="w-full h-full object-cover" />
          {badge}
        </>
      ) : placeholder}
    </div>
  );
}

function CityMultiSelect({ allCities, selected, onChange }: { allCities: string[]; selected: string[]; onChange: (cities: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = allCities.filter(c =>
    c.toLowerCase().includes(search.toLowerCase()) && !selected.includes(c)
  );

  const trimmed = search.trim();
  const canAddCustom = trimmed.length >= 2 &&
    !selected.some(c => c.toLowerCase() === trimmed.toLowerCase()) &&
    !filtered.some(c => c.toLowerCase() === trimmed.toLowerCase());

  const addCity = (city: string) => {
    onChange([...selected, city]);
    setSearch("");
    setOpen(false);
  };

  const formatCity = (s: string) => s.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

  const commitSearch = () => {
    if (!trimmed) return;
    const exactMatch = filtered.find(c => c.toLowerCase() === trimmed.toLowerCase());
    if (exactMatch) {
      addCity(exactMatch);
    } else if (canAddCustom) {
      addCity(formatCity(trimmed));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && trimmed) {
      e.preventDefault();
      commitSearch();
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      commitSearch();
      setOpen(false);
    }, 150);
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1.5 min-h-[38px] p-2 rounded-[12px] border-[0.5px] border-[#D1CDC7] bg-transparent cursor-text" onClick={() => setOpen(true)}>
        {selected.map(city => (
          <span key={city} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#C2B4A3]/20 text-[10px] font-sans text-[#2C2926] tracking-wide">
            {city}
            <button
              onClick={(e) => { e.stopPropagation(); onChange(selected.filter(c => c !== city)); }}
              className="text-[#78726B]"
              data-testid={`button-remove-city-${city.replace(/\s+/g, '-').toLowerCase()}`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={selected.length === 0 ? "Type any city (e.g. San Diego, Tokyo)..." : "Add another city..."}
          className="flex-1 min-w-[80px] bg-transparent outline-none text-xs text-[#2C2926] placeholder:text-[#D1CDC7]"
          data-testid="input-city-multi-select"
        />
      </div>
      {open && (filtered.length > 0 || canAddCustom) && (
        <div className="absolute z-20 top-full mt-1 left-0 right-0 max-h-40 overflow-y-auto rounded-[12px] border-[0.5px] border-[#D1CDC7] bg-[#F2F0ED] shadow-lg">
          {filtered.slice(0, 10).map(city => (
            <button
              key={city}
              onClick={() => addCity(city)}
              className="w-full text-left px-3 py-2 text-xs font-sans text-[#2C2926] tracking-wide transition-colors hover:bg-[#C2B4A3]/10"
              data-testid={`button-select-city-${city.replace(/\s+/g, '-').toLowerCase()}`}
            >
              {city}
            </button>
          ))}
          {canAddCustom && (
            <button
              onClick={() => {
                const formatted = trimmed.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
                addCity(formatted);
              }}
              className="w-full text-left px-3 py-2 text-xs font-sans text-[#2C2926] tracking-wide transition-colors hover:bg-[#C2B4A3]/10 border-t border-[#D1CDC7]/30"
              data-testid="button-add-custom-city"
            >
              <span className="text-[#C2B4A3] mr-1.5">+</span> Add "{trimmed.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")}"
            </button>
          )}
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}

function FacePile({ users }: { users: { id: string; firstName: string | null; lastName?: string | null; profileImageUrl: string | null }[] }) {
  if (!users || users.length === 0) return null;
  const shown = users.slice(0, 4);
  const extra = users.length - shown.length;
  const fullName = (u: { firstName: string | null; lastName?: string | null }) =>
    u.firstName ? `${u.firstName}${u.lastName ? ` ${u.lastName}` : ''}` : "Friend";
  const names = shown.map(u => u.firstName || "Friend");
  let label: string;
  if (names.length === 1) {
    label = names[0];
  } else if (names.length === 2 && extra === 0) {
    label = `${names[0]} and ${names[1]}`;
  } else {
    const rest = names.length - 1 + extra;
    label = `${names[0]} and ${rest} ${rest === 1 ? "other" : "others"}`;
  }
  return (
    <div className="flex items-center mt-1.5">
      <div className="flex -space-x-2">
        {shown.map((u) => (
          u.profileImageUrl ? (
            <img key={u.id} src={u.profileImageUrl} alt={u.firstName || ""} title={fullName(u)} className="w-5 h-5 rounded-full border-[1.5px] border-white object-cover" />
          ) : (
            <div key={u.id} title={fullName(u)} className="w-5 h-5 rounded-full border-[1.5px] border-white bg-[#C2B4A3]/30 flex items-center justify-center text-[7px] font-sans font-medium text-[#78726B]">
              {(u.firstName || "?")[0]}
            </div>
          )
        ))}
      </div>
      <span className="text-[9px] font-serif text-[#C2B4A3] ml-1.5">
        {label}
      </span>
    </div>
  );
}

type DragPayload =
  | { type: "hotel"; hotelName: string; city: string; imageUrl: string | null }
  | { type: "dining" | "wellness" | "workspace"; name: string; city: string; mapsQuery: string; url?: string; placeId?: string; googlePhotoUrl?: string; category?: string };

function SidebarHotelCard({ hotel, index }: {
  hotel: { hotelName: string; city: string; imageUrl: string | null; score?: number; reasons?: string[]; source?: string; stayedBy?: string; stayedByUsers?: { id: string; firstName: string | null; profileImageUrl: string | null }[] };
  index: number;
}) {
  const [imgError, setImgError] = useState(false);
  const hasImage = hotel.imageUrl && !imgError;

  const handleDragStart = (e: React.DragEvent) => {
    const payload: DragPayload = { type: "hotel", hotelName: hotel.hotelName, city: hotel.city, imageUrl: hotel.imageUrl };
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex gap-3 p-3 rounded-none border-[0.5px] border-[#D1CDC7] bg-white/50 cursor-grab active:cursor-grabbing hover:border-[#C2B4A3] transition-all group"
      data-testid={`sidebar-hotel-${index}`}
    >
      <div className="flex items-center flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity">
        <GripVertical className="w-3 h-3 text-[#78726B]" />
      </div>
      {hasImage ? (
        <div className="w-14 h-14 rounded-none relative overflow-hidden flex-shrink-0">
          <img src={hotel.imageUrl!} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} />
          <span className="absolute bottom-0.5 right-0.5 text-[6px] font-serif font-bold text-white/90 bg-[#C2B4A3]/80 w-3.5 h-3.5 rounded-none flex items-center justify-center leading-none">V</span>
        </div>
      ) : (
        <PlacePhotoThumb name={hotel.hotelName} city={hotel.city} size="md" />
      )}
      <div className="flex-1 min-w-0">
        <h4 className={`font-serif ${getDynamicInlineNameClass(hotel.hotelName)} text-[#2C2926] leading-snug`}>{hotel.hotelName}</h4>
        <p className="text-[10px] font-sans text-[#78726B] tracking-wide mt-0.5">{hotel.city}</p>
        {hotel.source === "common-ground" && (
          <span className="inline-block text-[7px] font-sans uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#C2B4A3]/20 text-[#C2B4A3] mt-1">Common Ground</span>
        )}
        {hotel.reasons && hotel.reasons.filter(r => !r.startsWith("Stayed") && r !== "Common Ground match").length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {hotel.reasons.filter(r => !r.startsWith("Stayed") && r !== "Common Ground match").slice(0, 2).map((reason) => (
              <span key={reason} className="text-[7px] font-sans uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-[#2C2926]/5 text-[#78726B]">{reason}</span>
            ))}
          </div>
        )}
        {hotel.stayedByUsers && hotel.stayedByUsers.length > 0 && (
          <FacePile users={hotel.stayedByUsers} />
        )}
      </div>
    </div>
  );
}

function SidebarAICard({ rec, index }: {
  rec: { hotelName: string; city: string; reason: string; rating: number; priority?: string };
  index: number;
}) {
  const handleDragStart = (e: React.DragEvent) => {
    const payload: DragPayload = { type: "hotel", hotelName: rec.hotelName, city: rec.city, imageUrl: null };
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  };

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(rec.hotelName + " " + rec.city)}`;

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex gap-3 p-3 rounded-none border-[0.5px] border-[#D1CDC7] bg-white/50 cursor-grab active:cursor-grabbing hover:border-[#C2B4A3] transition-all group"
      data-testid={`sidebar-ai-hotel-${index}`}
    >
      <div className="flex items-center flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity">
        <GripVertical className="w-3 h-3 text-[#78726B]" />
      </div>
      <PlacePhotoThumb name={rec.hotelName} city={rec.city} size="md" variant="ai" />
      <div className="flex-1 min-w-0">
        <h4 className={`font-serif ${getDynamicInlineNameClass(rec.hotelName)} text-[#2C2926] leading-snug`}>{rec.hotelName}</h4>
        <p className="text-[10px] font-sans text-[#78726B] tracking-wide mt-0.5">{rec.city}</p>
        <p className="text-[9px] font-sans text-[#78726B]/60 mt-1 line-clamp-2 leading-relaxed">{rec.reason}</p>
      </div>
      <a
        href={searchUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-[#C2B4A3] hover:text-[#2C2926] transition-colors flex-shrink-0 self-center opacity-0 group-hover:opacity-100"
        data-testid={`link-ai-hotel-${index}`}
        title="Search online"
      >
        <MapPin className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

function SidebarExperienceCard({ exp, index }: {
  exp: AIExperience;
  index: number;
}) {
  const handleDragStart = (e: React.DragEvent) => {
    const payload: DragPayload = { type: exp.type, name: exp.name, city: exp.city, mapsQuery: exp.mapsQuery };
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  };

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(exp.name + " " + exp.city)}`;

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex gap-3 p-3 rounded-none border-[0.5px] border-[#D1CDC7] bg-white/50 cursor-grab active:cursor-grabbing hover:border-[#C2B4A3] transition-all group"
      data-testid={`sidebar-exp-${exp.type}-${index}`}
    >
      <div className="flex items-center flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity">
        <GripVertical className="w-3 h-3 text-[#78726B]" />
      </div>
      <PlacePhotoThumb name={exp.name} city={exp.city} size="md" variant="ai" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {exp.type === "dining" ? <UtensilsCrossed className="w-3 h-3 text-[#C2B4A3] flex-shrink-0" /> : <Dumbbell className="w-3 h-3 text-[#C2B4A3] flex-shrink-0" />}
          <h4 className="font-serif text-sm text-[#2C2926] leading-snug">{exp.name}</h4>
        </div>
        <p className="text-[10px] font-sans text-[#78726B] tracking-wide mt-0.5">{exp.city}</p>
        <p className="text-[9px] font-sans text-[#78726B]/60 mt-1 line-clamp-2 leading-relaxed">{exp.reason}</p>
      </div>
      <a
        href={searchUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-[#C2B4A3] hover:text-[#2C2926] transition-colors flex-shrink-0 self-center opacity-0 group-hover:opacity-100"
        data-testid={`link-ai-exp-${index}`}
        title="Search online"
      >
        <MapPin className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}


function DropZone({ label, icon, dayNum, slotType, onDropHotel, onDropExperience, children, isEmpty }: {
  label: string;
  icon: React.ReactNode;
  dayNum: number;
  slotType: "hotel" | "dining" | "wellness" | "attraction";
  onDropHotel?: (hotel: { hotelName: string; city: string; imageUrl: string | null }) => void;
  onDropExperience?: (exp: { name: string; city: string; mapsQuery: string; type: "dining" | "wellness" | "attraction"; url?: string; placeId?: string; googlePhotoUrl?: string }) => void;
  children?: React.ReactNode;
  isEmpty: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    setDragOver(false);
    try {
      const payload: DragPayload = JSON.parse(e.dataTransfer.getData("application/json"));
      if (slotType === "hotel" && payload.type === "hotel" && onDropHotel) {
        e.preventDefault();
        e.stopPropagation();
        onDropHotel({ hotelName: payload.hotelName, city: payload.city, imageUrl: payload.imageUrl });
      } else if (slotType !== "hotel" && payload.type !== "hotel" && onDropExperience) {
        e.preventDefault();
        e.stopPropagation();
        onDropExperience({ name: payload.name, city: payload.city, mapsQuery: payload.mapsQuery, type: slotType as "dining" | "wellness" | "attraction", url: payload.url, placeId: payload.placeId, googlePhotoUrl: payload.googlePhotoUrl });
      }
    } catch {}
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-none border-[0.5px] transition-all duration-200 ${
        dragOver
          ? "border-[#C2B4A3] bg-[#C2B4A3]/10 shadow-sm"
          : isEmpty
            ? "border-dashed border-[#D1CDC7]/50 bg-white/20"
            : "border-[#D1CDC7] bg-white/40"
      } p-3`}
      data-testid={`dropzone-${slotType}-day-${dayNum}`}
    >
      {isEmpty ? (
        <div className="flex items-center gap-2 py-2 text-[#78726B]/40">
          {icon}
          <span className="text-[10px] font-sans uppercase tracking-widest">{dragOver ? `Drop here` : label}</span>
        </div>
      ) : (
        <>
          {dragOver && (
            <div className="flex items-center gap-2 py-1 mb-1 text-[#C2B4A3]">
              {icon}
              <span className="text-[9px] font-sans uppercase tracking-widest">Drop here</span>
            </div>
          )}
          {children}
        </>
      )}
    </div>
  );
}

function InlineNoteEditor({ value, onSave }: { value: string; onSave: (note: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  if (!editing) {
    return (
      <button
        onClick={() => { setText(value); setEditing(true); }}
        className="flex items-center gap-1 text-[9px] font-sans text-[#78726B]/40 hover:text-[#2C2926] transition-colors mt-1"
        data-testid="button-edit-note"
      >
        <Pen className="w-2.5 h-2.5" />
        {value ? value : "Add a note..."}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { onSave(text); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
        autoFocus
        placeholder="e.g., 7pm reservation"
        className="flex-1 text-[10px] font-sans text-[#2C2926] bg-transparent border-b border-[#D1CDC7] outline-none py-0.5 placeholder:text-[#D1CDC7]"
        data-testid="input-inline-note"
      />
      <button onClick={() => { onSave(text); setEditing(false); }} className="text-[#C2B4A3] hover:text-[#2C2926]" data-testid="button-save-note">
        <Check className="w-3 h-3" />
      </button>
      <button onClick={() => setEditing(false)} className="text-[#78726B]/40 hover:text-[#2C2926]">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function TripPlannerView() {
  const { toast } = useToast();
  const { data: tripPlans, isLoading: plansLoading } = useTripPlans();
  const createPlan = useCreateTripPlan();
  const updatePlan = useUpdateTripPlan();
  const deletePlan = useDeleteTripPlan();
  const addDay = useAddTripDay();
  const deleteDay = useDeleteTripDay();
  const addItineraryItem = useAddTripItineraryItem();
  const updateItineraryItem = useUpdateTripItineraryItem();
  const deleteItineraryItem = useDeleteTripItineraryItem();
  const addWorkspaceItem = useAddTripWorkspaceItem();
  const deleteWorkspaceItem = useDeleteTripWorkspaceItem();
  const { data: wishlistItems } = useWishlist();
  const { data: networkFeed } = useNetworkFeed();
  const { data: allEntries } = useEntries();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const selectedPlan = tripPlans?.find(p => p.id === selectedPlanId);
  const { data: tripDays } = useTripDays(selectedPlanId);
  const { data: itineraryItems } = useTripItineraryItems(selectedPlanId);
  const { data: styleMatches } = useTripStyleMatches(selectedPlanId);
  const { data: aiData, isLoading: aiLoading } = useAIRecommendations(selectedPlan?.cities || null);
  const aiRecommendations = aiData?.recommendations || [];
  const aiExperiences = aiData?.experiences || [];
  const { data: workspaceItems } = useTripWorkspaceItems(selectedPlanId);
  const [showWorkspaceAdd, setShowWorkspaceAdd] = useState(false);
  const [pendingWorkspaceItem, setPendingWorkspaceItem] = useState<{
    title: string; url: string; placeId: string; googlePhotoUrl?: string; neighborhood?: string;
  } | null>(null);
  const [workspaceCategory, setWorkspaceCategory] = useState<string | null>(null);
  const [workspaceCustomImage, setWorkspaceCustomImage] = useState("");
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanDate, setNewPlanDate] = useState("");
  const [newPlanStartDate, setNewPlanStartDate] = useState("");
  const [newPlanCities, setNewPlanCities] = useState<string[]>([]);
  const [newPlanDays, setNewPlanDays] = useState("3");
  const [editingPlan, setEditingPlan] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editCities, setEditCities] = useState<string[]>([]);
  const [editTotalDays, setEditTotalDays] = useState("3");
  const [focusedDay, setFocusedDay] = useState<number>(1);
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(new Set());
  const [stayPickerDay, setStayPickerDay] = useState<number | null>(null);
  const [styleMatchLimit, setStyleMatchLimit] = useState(4);
  const [showCustomHotel, setShowCustomHotel] = useState(false);
  const [customHotelName, setCustomHotelName] = useState("");
  const [customHotelCity, setCustomHotelCity] = useState("");
  const [customHotelMajorCity, setCustomHotelMajorCity] = useState("");
  const [customHotelSuburb, setCustomHotelSuburb] = useState("");
  const [customHotelCountry, setCustomHotelCountry] = useState("");
  const [customHotelPlaceId, setCustomHotelPlaceId] = useState("");
  const timelineRef = useRef<HTMLDivElement>(null);

  const normalize = useCallback((s: string) => s.toLowerCase().replace(/['']/g, "").replace(/\s+/g, " ").trim(), []);

  const allCities = useMemo(() => {
    const citySet: Record<string, string> = {};
    const allCityNames: string[] = [
      ...(allEntries || []).map(e => e.majorCity || e.city),
      ...(wishlistItems || []).map(w => w.majorCity || w.city),
      ...((networkFeed || []) as Array<{ city: string; majorCity?: string | null }>).map(e => e.majorCity || e.city),
    ];
    allCityNames.forEach(city => {
      const key = normalize(city);
      if (!citySet[key]) citySet[key] = city;
    });
    return Object.values(citySet).sort();
  }, [allEntries, wishlistItems, networkFeed, normalize]);

  const stayByDay = useMemo(() => {
    const map: Record<number, typeof tripDays extends (infer T)[] | undefined ? T : never> = {};
    if (tripDays) {
      for (const d of tripDays) {
        map[d.dayNumber] = d;
      }
    }
    return map;
  }, [tripDays]);

  const itineraryByDay = useMemo(() => {
    const map: Record<number, NonNullable<typeof itineraryItems>> = {};
    if (itineraryItems) {
      for (const item of itineraryItems) {
        if (!map[item.dayNumber]) map[item.dayNumber] = [];
        map[item.dayNumber].push(item);
      }
    }
    return map;
  }, [itineraryItems]);

  const assignedHotels = useMemo(() => {
    const set = new Set<string>();
    if (tripDays) {
      for (const d of tripDays) {
        set.add(`${normalize(d.hotelName)}|${normalize(d.city)}`);
      }
    }
    return set;
  }, [tripDays, normalize]);

  const hotelOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { hotelName: string; city: string; imageUrl: string | null; majorCity?: string; suburb?: string; country?: string; placeId?: string }[] = [];
    const planCities = selectedPlan?.cities?.length ? new Set(selectedPlan.cities.map(normalize)) : null;

    const cityMatches = (testCity: string, planSet: Set<string>) => {
      const n = normalize(testCity);
      if (planSet.has(n)) return true;
      for (const pc of planSet) {
        if (n.includes(pc) || pc.includes(n)) return true;
      }
      return false;
    };

    const addOption = (name: string, city: string, img: string | null, mc?: string | null, sub?: string | null, country?: string | null, placeId?: string | null) => {
      const effectiveMajorCity = mc || city;
      if (planCities && !cityMatches(effectiveMajorCity, planCities) && !cityMatches(city, planCities)) return;
      const key = `${normalize(name)}|${normalize(city)}`;
      if (seen.has(key)) return;
      seen.add(key);
      options.push({ hotelName: name, city, imageUrl: img, majorCity: effectiveMajorCity, suburb: sub || "", country: country || "", placeId: placeId || "" });
    };

    (wishlistItems || []).forEach(w => addOption(w.hotelName, w.city, w.imageUrl || w.googlePhotoUrl, w.majorCity, w.suburb, w.country, w.placeId));
    (allEntries || []).forEach(e => addOption(e.hotelName, e.city, e.imageUrl || e.googlePhotoUrl, e.majorCity, e.suburb, e.country, e.placeId));
    return options;
  }, [wishlistItems, allEntries, selectedPlan, normalize]);

  const focusedDayCity = useMemo(() => {
    const stay = stayByDay[focusedDay];
    if (stay) return stay.majorCity || stay.city;
    if (selectedPlan?.cities?.length) return selectedPlan.cities[0];
    return undefined;
  }, [focusedDay, stayByDay, selectedPlan]);

  const matchesCity = useCallback((itemCity: string, filterCity: string) => {
    const nc = normalize(itemCity);
    const nf = normalize(filterCity);
    return nc === nf || nc.includes(nf) || nf.includes(nc);
  }, [normalize]);

  const sidebarMatches = useMemo(() => {
    return (styleMatches || []).filter(m => {
      if (assignedHotels.has(`${normalize(m.hotelName)}|${normalize(m.city)}`)) return false;
      if (focusedDayCity) return matchesCity(m.city, focusedDayCity);
      if (selectedPlan?.cities?.length) return selectedPlan.cities.some(pc => matchesCity(m.city, pc));
      return true;
    });
  }, [styleMatches, assignedHotels, focusedDayCity, selectedPlan, normalize, matchesCity]);

  const sidebarAI = useMemo(() => {
    return aiRecommendations.filter(r => {
      if (assignedHotels.has(`${normalize(r.hotelName)}|${normalize(r.city)}`)) return false;
      if (focusedDayCity) return matchesCity(r.city, focusedDayCity);
      if (selectedPlan?.cities?.length) return selectedPlan.cities.some(pc => matchesCity(r.city, pc));
      return true;
    });
  }, [aiRecommendations, assignedHotels, focusedDayCity, selectedPlan, normalize, matchesCity]);

  const sidebarExperiences = useMemo(() => {
    return aiExperiences.filter(e => {
      if (focusedDayCity) return matchesCity(e.city, focusedDayCity);
      if (selectedPlan?.cities?.length) return selectedPlan.cities.some(pc => matchesCity(e.city, pc));
      return true;
    });
  }, [aiExperiences, focusedDayCity, selectedPlan, matchesCity]);

  const handleCreatePlan = async () => {
    if (!newPlanName.trim()) return;
    const days = Math.max(1, Math.min(30, parseInt(newPlanDays) || 3));
    try {
      const plan = await createPlan.mutateAsync({
        name: newPlanName.trim(),
        tripDate: newPlanDate.trim() || null,
        startDate: newPlanStartDate.trim() || null,
        cities: newPlanCities.length > 0 ? newPlanCities : null,
        totalDays: days,
      });
      setSelectedPlanId(plan.id);
      setNewPlanName("");
      setNewPlanDate("");
      setNewPlanStartDate("");
      setNewPlanCities([]);
      setNewPlanDays("3");
      setShowNewPlan(false);
      toast({ title: "Trip Created", description: `"${plan.name}" is ready — ${days} days to plan.` });
    } catch {
      toast({ title: "Error", description: "Could not create trip plan.", variant: "destructive" });
    }
  };

  const handleUpdatePlan = async () => {
    if (!selectedPlanId || !editName.trim()) return;
    const days = Math.max(1, Math.min(30, parseInt(editTotalDays) || 3));
    try {
      await updatePlan.mutateAsync({
        id: selectedPlanId,
        name: editName.trim(),
        tripDate: editDate.trim() || null,
        startDate: editStartDate.trim() || null,
        cities: editCities.length > 0 ? editCities : null,
        totalDays: days,
      });
      setEditingPlan(false);
      toast({ title: "Updated", description: "Trip details saved." });
    } catch {
      toast({ title: "Error", description: "Could not update trip.", variant: "destructive" });
    }
  };

  const startEditing = () => {
    if (!selectedPlan) return;
    setEditName(selectedPlan.name);
    setEditDate(selectedPlan.tripDate || "");
    setEditStartDate(selectedPlan.startDate || "");
    setEditCities(selectedPlan.cities || []);
    setEditTotalDays(String(selectedPlan.totalDays || 3));
    setEditingPlan(true);
  };

  const handleSetStay = async (dayNumber: number, hotel: { hotelName: string; city: string; imageUrl: string | null; googlePhotoUrl?: string | null; country?: string; placeId?: string; majorCity?: string; suburb?: string }) => {
    if (!selectedPlanId) return;
    const existing = stayByDay[dayNumber];
    if (existing) {
      await deleteDay.mutateAsync({ id: existing.id, tripPlanId: selectedPlanId });
    }
    let googlePhotoUrl = hotel.googlePhotoUrl || null;
    if (!hotel.imageUrl && !googlePhotoUrl) {
      try {
        const res = await fetch(`/api/places/photo-lookup?name=${encodeURIComponent(hotel.hotelName)}&city=${encodeURIComponent(hotel.city)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.photoUrl) googlePhotoUrl = data.photoUrl;
        }
      } catch {}
    }
    const dayPayload = {
      tripPlanId: selectedPlanId,
      dayNumber,
      hotelName: hotel.hotelName,
      city: hotel.city,
      majorCity: hotel.majorCity || null,
      suburb: hotel.suburb || null,
      country: hotel.country || null,
      placeId: hotel.placeId || null,
      imageUrl: hotel.imageUrl || null,
      googlePhotoUrl,
    };
    await addDay.mutateAsync(dayPayload);

    const total = selectedPlan?.totalDays || 1;
    if (dayNumber === 1 && total < 5) {
      for (let d = 2; d <= total; d++) {
        const ex = stayByDay[d];
        if (ex) continue;
        await addDay.mutateAsync({ ...dayPayload, dayNumber: d });
      }
      closeStayPicker();
      toast({ title: "Stay Set", description: `${hotel.hotelName} assigned to Days 1–${total}.` });
    } else {
      closeStayPicker();
      toast({ title: "Stay Set", description: `${hotel.hotelName} assigned to Day ${dayNumber}.` });
    }
  };

  const closeStayPicker = () => {
    setStayPickerDay(null);
    setShowCustomHotel(false);
    setCustomHotelName("");
    setCustomHotelCity("");
    setCustomHotelMajorCity("");
    setCustomHotelSuburb("");
    setCustomHotelCountry("");
    setCustomHotelPlaceId("");
  };

  const handleAddCustomHotel = async (dayNumber: number) => {
    if (!customHotelName.trim() || !customHotelCity.trim()) return;
    await handleSetStay(dayNumber, { hotelName: customHotelName.trim(), city: customHotelCity.trim(), imageUrl: null, country: customHotelCountry || undefined, placeId: customHotelPlaceId || undefined, majorCity: customHotelMajorCity || undefined, suburb: customHotelSuburb || undefined });
  };

  const handleClearStay = async (dayNumber: number) => {
    if (!selectedPlanId) return;
    const existing = stayByDay[dayNumber];
    if (existing) {
      await deleteDay.mutateAsync({ id: existing.id, tripPlanId: selectedPlanId });
    }
  };

  const handleAddItineraryItem = async (dayNumber: number, type: "dining" | "wellness" | "attraction", title: string, opts?: { url?: string; placeId?: string; googlePhotoUrl?: string }) => {
    if (!selectedPlanId || !title.trim()) return;
    const stay = stayByDay[dayNumber];
    let finalUrl = opts?.url || null;
    if (!finalUrl && stay) {
      const query = type === "dining"
        ? `restaurants+near+${encodeURIComponent(stay.hotelName)}+${encodeURIComponent(stay.city)}`
        : `${encodeURIComponent(title)}+near+${encodeURIComponent(stay.hotelName)}+${encodeURIComponent(stay.city)}`;
      finalUrl = `https://www.google.com/maps/search/${query}`;
    }
    try {
      await addItineraryItem.mutateAsync({
        tripPlanId: selectedPlanId,
        dayNumber,
        itemType: type,
        title: title.trim(),
        url: finalUrl,
        placeId: opts?.placeId || null,
        googlePhotoUrl: opts?.googlePhotoUrl || null,
      });
      toast({ title: "Added", description: `${title.trim()} added to Day ${dayNumber}.` });
    } catch {
      toast({ title: "Error", description: "Could not add item.", variant: "destructive" });
    }
  };

  const handleDropExperience = (dayNumber: number, exp: { name: string; city: string; mapsQuery: string; type: "dining" | "wellness"; url?: string; placeId?: string; googlePhotoUrl?: string }) => {
    const url = exp.url || `https://www.google.com/maps/search/${encodeURIComponent(exp.mapsQuery)}`;
    handleAddItineraryItem(dayNumber, exp.type, exp.name, { url, placeId: exp.placeId, googlePhotoUrl: exp.googlePhotoUrl });
  };

  const totalDays = selectedPlan?.totalDays || 1;
  const dayNumbers = Array.from({ length: totalDays }, (_, i) => i + 1);

  if (plansLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-10 h-10 animate-spin text-[#78726B]/40" />
      </div>
    );
  }

  const inputClasses = "bg-transparent border-[0.5px] border-[#D1CDC7] rounded-[12px] text-sm text-[#2C2926] placeholder:text-[#D1CDC7] focus-visible:ring-0 focus-visible:border-[#78726B]";

  return (
    <div className="space-y-8">
      <div className="text-center mb-4">
        <p className="text-xs sm:text-sm font-serif italic text-[#C2B4A3] tracking-wide max-w-md mx-auto leading-relaxed">
          Drag vetted recommendations from the sidebar into your day timeline.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {tripPlans?.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setSelectedPlanId(plan.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full border-[0.5px] text-sm font-serif tracking-wide transition-all duration-300 ${
                selectedPlanId === plan.id
                  ? "bg-[#2C2926] text-white border-[#2C2926]"
                  : "text-[#78726B] border-[#D1CDC7] hover:border-[#2C2926] hover:text-[#2C2926]"
              }`}
              data-testid={`button-trip-plan-${plan.id}`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>{plan.name}</span>
              {plan.tripDate && (
                <span className={`text-[10px] font-sans ${selectedPlanId === plan.id ? "text-white/60" : "text-[#78726B]/50"}`}>
                  {plan.tripDate}
                </span>
              )}
            </button>
          ))}
        </div>

        {!showNewPlan && (
          <button
            onClick={() => setShowNewPlan(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full border-[0.5px] border-[#D1CDC7] text-sm font-serif tracking-wide text-[#78726B] hover:border-[#2C2926] hover:text-[#2C2926] transition-all duration-300"
            data-testid="button-new-trip"
          >
            <Plus className="w-4 h-4" />
            New Trip
          </button>
        )}
      </div>

      <AnimatePresence>
        {showNewPlan && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-6 sm:p-8 rounded-none border-[0.5px] border-[#D1CDC7] bg-white/40 space-y-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-sans uppercase tracking-widest text-[#78726B]/60">New Trip</span>
              <button onClick={() => setShowNewPlan(false)} className="p-1.5 text-[#78726B]" data-testid="button-close-new-trip">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60 block mb-2">Trip Name</label>
                <Input value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} placeholder="e.g., Italian Summer" className={inputClasses} data-testid="input-new-trip-name" />
              </div>
              <div>
                <label className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60 block mb-2">When</label>
                <Input value={newPlanDate} onChange={(e) => setNewPlanDate(e.target.value)} placeholder="e.g., Summer 2026" className={inputClasses} data-testid="input-new-trip-date" />
              </div>
              <div>
                <label className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60 block mb-2">Start Date <span className="normal-case tracking-normal text-[#78726B]/30">(optional)</span></label>
                <Input type="date" value={newPlanStartDate} onChange={(e) => setNewPlanStartDate(e.target.value)} className={inputClasses} data-testid="input-new-trip-start-date" />
              </div>
              <div>
                <label className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60 block mb-2">Total Days</label>
                <Input type="number" min={1} max={30} value={newPlanDays} onChange={(e) => setNewPlanDays(e.target.value)} className={inputClasses} data-testid="input-new-trip-days" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60 block mb-2">Destinations</label>
              <CityMultiSelect allCities={allCities} selected={newPlanCities} onChange={setNewPlanCities} />
            </div>
            <div className="flex justify-end">
              <button onClick={handleCreatePlan} disabled={!newPlanName.trim()} className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#2C2926] text-white text-sm font-serif tracking-wide disabled:opacity-40 transition-opacity" data-testid="button-create-trip">
                <Check className="w-4 h-4" />
                Create Trip
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedPlanId && selectedPlan ? (
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {editingPlan ? (
              <motion.div key="edit-form" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-6 sm:p-8 rounded-none border-[0.5px] border-[#D1CDC7] bg-white/40 space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-sans uppercase tracking-widest text-[#78726B]/60">Edit Trip</span>
                  <button onClick={() => setEditingPlan(false)} className="p-1.5 text-[#78726B]"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60 block mb-2">Trip Name</label>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputClasses} data-testid="input-edit-trip-name" />
                  </div>
                  <div>
                    <label className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60 block mb-2">When</label>
                    <Input value={editDate} onChange={(e) => setEditDate(e.target.value)} placeholder="e.g., Summer 2026" className={inputClasses} data-testid="input-edit-trip-date" />
                  </div>
                  <div>
                    <label className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60 block mb-2">Start Date <span className="normal-case tracking-normal text-[#78726B]/30">(optional)</span></label>
                    <Input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className={inputClasses} data-testid="input-edit-trip-start-date" />
                  </div>
                  <div>
                    <label className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60 block mb-2">Total Days</label>
                    <Input type="number" min={1} max={30} value={editTotalDays} onChange={(e) => setEditTotalDays(e.target.value)} className={inputClasses} data-testid="input-edit-trip-days" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/60 block mb-2">Destinations</label>
                  <CityMultiSelect allCities={allCities} selected={editCities} onChange={setEditCities} />
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setEditingPlan(false)} className="px-5 py-2 rounded-full border-[0.5px] border-[#D1CDC7] text-sm font-serif text-[#78726B]">Cancel</button>
                  <button onClick={handleUpdatePlan} disabled={!editName.trim()} className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#2C2926] text-white text-sm font-serif disabled:opacity-40" data-testid="button-update-trip">
                    <Check className="w-4 h-4" /> Save
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="plan-header" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-2xl text-[#2C2926] tracking-wide">{selectedPlan.name}</h2>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {selectedPlan.tripDate && <span className="text-xs font-sans text-[#78726B]/60">{selectedPlan.tripDate}</span>}
                    {selectedPlan.startDate && (() => {
                      const start = new Date(selectedPlan.startDate + "T00:00:00");
                      const end = new Date(start);
                      end.setDate(end.getDate() + (selectedPlan.totalDays || 1) - 1);
                      const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                      return <span className="text-xs font-sans text-[#78726B]/60">{fmt(start)} – {fmt(end)}</span>;
                    })()}
                    {selectedPlan.cities?.map(c => (
                      <span key={c} className="text-[10px] font-sans px-2.5 py-0.5 rounded-full bg-[#C2B4A3]/15 text-[#78726B] tracking-wide">{c}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={startEditing} className="p-2 rounded-full text-[#78726B]/40 hover:text-[#2C2926] transition-colors" data-testid="button-edit-trip">
                    <Pen className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => { if (confirm("Delete this trip?")) { await deletePlan.mutateAsync(selectedPlanId); setSelectedPlanId(null); } }}
                    className="p-2 rounded-full text-[#78726B]/40 hover:text-[#2C2926] transition-colors"
                    data-testid="button-delete-trip"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col md:flex-row md:gap-8">
            <div className="md:w-[65%]" ref={timelineRef}>
              <div className="relative pl-8 border-l-[2px] border-[#D1CDC7]/30 ml-3 space-y-6">
                {dayNumbers.map((dayNum) => {
                  const stay = stayByDay[dayNum];
                  const dayItems = itineraryByDay[dayNum] || [];
                  const diningItems = dayItems.filter(i => i.itemType === "dining");
                  const wellnessItems = dayItems.filter(i => i.itemType === "wellness");
                  const attractionItems = dayItems.filter(i => i.itemType === "attraction");
                  const isFocused = focusedDay === dayNum;

                  return (
                    <motion.div
                      key={dayNum}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: dayNum * 0.04 }}
                      className="relative group/day"
                      onClick={() => setFocusedDay(dayNum)}
                      data-testid={`day-block-${dayNum}`}
                    >
                      <div className={`absolute -left-[37px] top-2 w-5 h-5 rounded-full border-[3px] border-[#F2F0ED] transition-colors ${isFocused ? "bg-[#2C2926]" : stay ? "bg-[#C2B4A3]" : "bg-[#D1CDC7]/50"}`} />

                      <div
                        className={`p-5 rounded-none border-[0.5px] transition-all duration-200 ${isFocused ? "border-[#C2B4A3] shadow-sm" : "border-[#D1CDC7]"} bg-white/40`}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                        onDrop={(e) => {
                          try {
                            const payload: DragPayload = JSON.parse(e.dataTransfer.getData("application/json"));
                            if (payload.type === "hotel") return;
                            e.preventDefault();
                            e.stopPropagation();
                            const itemType = payload.type === "workspace" ? (payload.category === "Wellness" ? "wellness" : payload.category === "Attraction" ? "attraction" : "dining") : payload.type;
                            const url = payload.url || `https://www.google.com/maps/search/${encodeURIComponent(payload.mapsQuery)}`;
                            handleAddItineraryItem(dayNum, itemType, payload.name, { url, placeId: payload.placeId, googlePhotoUrl: payload.googlePhotoUrl });
                          } catch {}
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCollapsedDays(prev => {
                                  const next = new Set(prev);
                                  if (next.has(dayNum)) next.delete(dayNum);
                                  else next.add(dayNum);
                                  return next;
                                });
                              }}
                              className="p-0.5 text-[#78726B]/40 hover:text-[#2C2926] transition-colors"
                              data-testid={`button-collapse-day-${dayNum}`}
                            >
                              {collapsedDays.has(dayNum) ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                            <span className={`text-xs font-sans uppercase tracking-widest font-medium ${isFocused ? "text-[#2C2926]" : "text-[#C2B4A3]"}`}>Day {dayNum}</span>
                            {selectedPlan?.startDate && (() => {
                              const d = new Date(selectedPlan.startDate + "T00:00:00");
                              d.setDate(d.getDate() + dayNum - 1);
                              return (
                                <span className="text-[10px] font-sans text-[#78726B]/50">
                                  {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                </span>
                              );
                            })()}
                            {collapsedDays.has(dayNum) && stay && (
                              <span className="text-[10px] font-sans text-[#78726B]/50 ml-1">— {stay.hotelName}{dayItems.length > 0 ? ` + ${dayItems.length} item${dayItems.length > 1 ? "s" : ""}` : ""}</span>
                            )}
                          </div>
                          {stay && !collapsedDays.has(dayNum) && (
                            <div className="flex items-center gap-1 opacity-0 group-hover/day:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); setStayPickerDay(stayPickerDay === dayNum ? null : dayNum); }} className="p-1.5 rounded-full text-[#78726B]/30 hover:text-[#2C2926] transition-colors" data-testid={`button-change-stay-${dayNum}`} title="Change hotel">
                                <Pen className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleClearStay(dayNum); }} className="p-1.5 rounded-full text-[#78726B]/30 hover:text-[#2C2926] transition-colors" data-testid={`button-clear-stay-${dayNum}`} title="Remove stay">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {!collapsedDays.has(dayNum) && <div className="space-y-3 mt-4">
                          <DropZone
                            label="Drop a hotel here"
                            icon={<Star className="w-3.5 h-3.5" />}
                            dayNum={dayNum}
                            slotType="hotel"
                            onDropHotel={(hotel) => handleSetStay(dayNum, hotel)}
                            isEmpty={!stay && stayPickerDay !== dayNum}
                          >
                            {stay && (
                              <div className="flex items-center gap-4">
                                {(stay.imageUrl || stay.googlePhotoUrl) ? (
                                  <div className="w-14 h-14 rounded-none relative overflow-hidden flex-shrink-0">
                                    <img src={stay.imageUrl || stay.googlePhotoUrl!} alt="" className="w-full h-full object-cover" />
                                  </div>
                                ) : (
                                  <PlacePhotoThumb name={stay.hotelName} city={stay.city} size="md" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className={`font-serif ${getDynamicInlineNameClass(stay.hotelName)} text-[#2C2926] leading-snug`} data-testid={`text-stay-hotel-${dayNum}`}>{stay.hotelName}</h4>
                                  <p className="text-[10px] font-sans text-[#78726B] tracking-wide mt-0.5">{stay.majorCity || stay.city}{stay.suburb && stay.suburb !== (stay.majorCity || stay.city) ? ` · ${stay.suburb}` : ""}</p>
                                </div>
                              </div>
                            )}
                          </DropZone>

                          {!stay && stayPickerDay !== dayNum && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setStayPickerDay(dayNum); }}
                              className="flex items-center gap-1.5 text-[10px] font-sans uppercase tracking-widest text-[#C2B4A3] hover:text-[#2C2926] transition-colors"
                              data-testid={`button-assign-stay-${dayNum}`}
                            >
                              <Plus className="w-3 h-3" />
                              Or pick from your collection
                            </button>
                          )}

                          <AnimatePresence>
                            {stayPickerDay === dayNum && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="p-3 rounded-none bg-[#F2F0ED]/60 space-y-3">
                                  <span className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/50">{stay ? "Change hotel" : "Pick a hotel"}</span>

                                  {(() => {
                                    const pickerCity = stay?.majorCity || stay?.city || (selectedPlan?.cities?.length ? selectedPlan.cities[0] : null);
                                    const collectionKeys = new Set(hotelOptions.map(o => `${normalize(o.hotelName)}|${normalize(o.city)}`));
                                    const pickerMatches = (styleMatches || []).filter(m => {
                                      const mKey = `${normalize(m.hotelName)}|${normalize(m.city)}`;
                                      if (assignedHotels.has(mKey)) return false;
                                      if (collectionKeys.has(mKey)) return false;
                                      if (stay && normalize(m.hotelName) === normalize(stay.hotelName)) return false;
                                      if (pickerCity) return matchesCity(m.city, pickerCity);
                                      return true;
                                    });
                                    const filteredCollection = hotelOptions.filter(opt => !stay || !(opt.hotelName === stay.hotelName && opt.city === stay.city));
                                    const hasVetted = pickerMatches.length > 0;
                                    const hasCollection = filteredCollection.length > 0;
                                    if (!hasVetted && !hasCollection) return null;
                                    return (
                                      <div className="max-h-56 overflow-y-auto space-y-3">
                                        {hasVetted && (
                                          <div className="space-y-2">
                                            <span className="text-[9px] font-sans uppercase tracking-widest text-[#C2B4A3]">Vetted for You</span>
                                            <div className="grid gap-2">
                                              {pickerMatches.slice(0, 4).map((m) => (
                                                <button
                                                  key={`${m.hotelName}-${m.city}`}
                                                  onClick={() => handleSetStay(dayNum, { hotelName: m.hotelName, city: m.city, imageUrl: m.imageUrl })}
                                                  className="flex items-center gap-3 p-2.5 rounded-none border-[0.5px] border-[#C2B4A3]/40 hover:border-[#2C2926] transition-all text-left bg-white/30"
                                                  data-testid={`button-pick-vetted-${dayNum}-${m.hotelName}`}
                                                >
                                                  {m.imageUrl ? (
                                                    <div className="w-9 h-9 rounded-none relative overflow-hidden flex-shrink-0">
                                                      <img src={m.imageUrl} alt="" className="w-full h-full object-cover" />
                                                      <span className="absolute bottom-0 right-0 text-[5px] font-serif font-bold text-white/90 bg-[#C2B4A3]/80 w-3 h-3 rounded-none flex items-center justify-center leading-none">V</span>
                                                    </div>
                                                  ) : (
                                                    <PlacePhotoThumb name={m.hotelName} city={m.city} size="sm" />
                                                  )}
                                                  <div className="min-w-0 flex-1">
                                                    <p className={`font-serif ${getDynamicInlineNameClass(m.hotelName)} text-[#2C2926] leading-snug`}>{m.hotelName}</p>
                                                    <p className="text-[10px] font-sans text-[#78726B]">{m.city}</p>
                                                    {m.stayedByUsers && m.stayedByUsers.length > 0 && (
                                                      <FacePile users={m.stayedByUsers} />
                                                    )}
                                                  </div>
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        {hasCollection && (
                                          <div className="space-y-2">
                                            <span className="text-[9px] font-sans uppercase tracking-widest text-[#78726B]/40">Your Collection</span>
                                            <div className="grid gap-2">
                                              {filteredCollection.map((opt) => (
                                                <button
                                                  key={`${opt.hotelName}-${opt.city}`}
                                                  onClick={() => handleSetStay(dayNum, opt)}
                                                  className="flex items-center gap-3 p-2.5 rounded-none border-[0.5px] border-[#D1CDC7] hover:border-[#2C2926] transition-all text-left"
                                                  data-testid={`button-pick-hotel-${dayNum}-${opt.hotelName}`}
                                                >
                                                  {opt.imageUrl ? (
                                                    <img src={opt.imageUrl} alt="" className="w-9 h-9 rounded-none object-cover flex-shrink-0" />
                                                  ) : (
                                                    <PlacePhotoThumb name={opt.hotelName} city={opt.city} size="sm" />
                                                  )}
                                                  <div className="min-w-0">
                                                    <p className={`font-serif ${getDynamicInlineNameClass(opt.hotelName)} text-[#2C2926] leading-snug`}>{opt.hotelName}</p>
                                                    <p className="text-[10px] font-sans text-[#78726B]">{opt.city}</p>
                                                  </div>
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                  {showCustomHotel ? (
                                    <div className="space-y-3">
                                      <PlacesAutocomplete
                                        compact
                                        placeholder="Search for a hotel..."
                                        testIdPrefix={`custom-hotel-${dayNum}`}
                                        onSelect={(details) => {
                                          setCustomHotelName(details.name);
                                          setCustomHotelCity(details.city);
                                          setCustomHotelMajorCity(details.majorCity || details.city);
                                          setCustomHotelSuburb(details.suburb || "");
                                          setCustomHotelCountry(details.country);
                                          setCustomHotelPlaceId(details.placeId);
                                        }}
                                      />
                                      {customHotelCity && <p className="text-[10px] font-sans text-[#78726B]/50">{customHotelCity}{customHotelCountry ? `, ${customHotelCountry}` : ""}</p>}
                                      <div className="flex items-center gap-2">
                                        <button onClick={() => handleAddCustomHotel(dayNum)} disabled={!customHotelName.trim() || !customHotelCity.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2C2926] text-white text-[10px] font-sans uppercase tracking-widest disabled:opacity-30" data-testid={`button-confirm-custom-hotel-${dayNum}`}>
                                          <Check className="w-3 h-3" /> Add
                                        </button>
                                        <button onClick={() => { setShowCustomHotel(false); setCustomHotelName(""); setCustomHotelCity(""); }} className="text-[10px] font-sans text-[#78726B]/40 hover:text-[#2C2926]">Cancel</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button onClick={() => setShowCustomHotel(true)} className="flex items-center gap-1.5 text-[10px] font-sans uppercase tracking-widest text-[#C2B4A3] hover:text-[#2C2926] transition-colors" data-testid={`button-show-custom-hotel-${dayNum}`}>
                                      <Pen className="w-3 h-3" /> Search for a hotel
                                    </button>
                                  )}
                                  <button onClick={() => closeStayPicker()} className="text-[10px] font-sans text-[#78726B]/40 hover:text-[#2C2926]" data-testid={`button-cancel-picker-${dayNum}`}>Cancel</button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {diningItems.length > 0 && (
                            <DropZone
                              label="Drop dining here"
                              icon={<UtensilsCrossed className="w-3.5 h-3.5" />}
                              dayNum={dayNum}
                              slotType="dining"
                              onDropExperience={(exp) => handleDropExperience(dayNum, exp)}
                              isEmpty={false}
                            >
                              <div className="space-y-2">
                                <div className="flex items-center gap-1.5">
                                  <UtensilsCrossed className="w-3 h-3 text-[#C2B4A3]" />
                                  <span className="text-[9px] font-sans uppercase tracking-widest text-[#C2B4A3]">Dining</span>
                                </div>
                                {diningItems.map(item => (
                                  <ItineraryItemRow key={item.id} item={item} selectedPlanId={selectedPlanId!} deleteItineraryItem={deleteItineraryItem} updateItineraryItem={updateItineraryItem} />
                                ))}
                              </div>
                            </DropZone>
                          )}

                          {wellnessItems.length > 0 && (
                            <DropZone
                              label="Drop wellness here"
                              icon={<Dumbbell className="w-3.5 h-3.5" />}
                              dayNum={dayNum}
                              slotType="wellness"
                              onDropExperience={(exp) => handleDropExperience(dayNum, exp)}
                              isEmpty={false}
                            >
                              <div className="space-y-2">
                                <div className="flex items-center gap-1.5">
                                  <Dumbbell className="w-3 h-3 text-[#C2B4A3]" />
                                  <span className="text-[9px] font-sans uppercase tracking-widest text-[#C2B4A3]">Wellness</span>
                                </div>
                                {wellnessItems.map(item => (
                                  <ItineraryItemRow key={item.id} item={item} selectedPlanId={selectedPlanId!} deleteItineraryItem={deleteItineraryItem} updateItineraryItem={updateItineraryItem} />
                                ))}
                              </div>
                            </DropZone>
                          )}

                          {attractionItems.length > 0 && (
                            <DropZone
                              label="Drop attraction here"
                              icon={<Compass className="w-3.5 h-3.5" />}
                              dayNum={dayNum}
                              slotType="attraction"
                              onDropExperience={(exp) => handleAddItineraryItem(dayNum, "attraction", exp.name, { url: exp.url || `https://www.google.com/maps/search/${encodeURIComponent(exp.mapsQuery)}`, placeId: exp.placeId, googlePhotoUrl: exp.googlePhotoUrl })}
                              isEmpty={false}
                            >
                              <div className="space-y-2">
                                <div className="flex items-center gap-1.5">
                                  <Compass className="w-3 h-3 text-[#C2B4A3]" />
                                  <span className="text-[9px] font-sans uppercase tracking-widest text-[#C2B4A3]">Attractions</span>
                                </div>
                                {attractionItems.map(item => (
                                  <ItineraryItemRow key={item.id} item={item} selectedPlanId={selectedPlanId!} deleteItineraryItem={deleteItineraryItem} updateItineraryItem={updateItineraryItem} />
                                ))}
                              </div>
                            </DropZone>
                          )}

                        </div>}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <div className="md:w-[35%] mt-8 md:mt-0">
              <div className="md:sticky md:top-24 md:max-h-[calc(100vh-120px)] md:overflow-y-auto space-y-6 scrollbar-thin">
                <div>
                  <h3 className="font-serif text-lg text-[#2C2926] tracking-wide mb-1">The Style Match</h3>
                  <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-[#C2B4A3] mb-4">
                    {focusedDayCity ? `For Day ${focusedDay} · ${focusedDayCity}` : "Drag into your timeline"}
                  </p>
                </div>

                {sidebarMatches.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[9px] font-sans uppercase tracking-widest text-[#78726B]/50">From Your Network</span>
                    {sidebarMatches.slice(0, 6).map((match, i) => (
                      <SidebarHotelCard key={`${match.hotelName}-${match.city}`} hotel={match} index={i} />
                    ))}
                  </div>
                )}

                {sidebarAI.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-[#C2B4A3]" />
                      <span className="text-[9px] font-sans uppercase tracking-widest text-[#78726B]/50">Your Style Matches</span>
                    </div>
                    {sidebarAI.slice(0, styleMatchLimit).map((rec, i) => (
                      <SidebarAICard key={`${rec.hotelName}-${rec.city}`} rec={rec} index={i} />
                    ))}
                    {sidebarAI.length > styleMatchLimit && (
                      <button
                        onClick={() => setStyleMatchLimit(prev => prev + 2)}
                        className="w-full py-2 text-[10px] font-sans uppercase tracking-widest text-[#C2B4A3] hover:text-[#2C2926] transition-colors border-[0.5px] border-dashed border-[#D1CDC7] hover:border-[#C2B4A3] rounded-none"
                        data-testid="button-show-more-style-matches"
                      >
                        Show More
                      </button>
                    )}
                  </div>
                )}

                {aiLoading && (
                  <div className="flex items-center gap-2 py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-[#C2B4A3]" />
                    <span className="text-[10px] font-sans text-[#78726B]/60">Finding style matches...</span>
                  </div>
                )}

                {sidebarExperiences.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[9px] font-sans uppercase tracking-widest text-[#78726B]/50">Dining & Wellness</span>
                    {sidebarExperiences.map((exp, i) => (
                      <SidebarExperienceCard key={`${exp.name}-${i}`} exp={exp} index={i} />
                    ))}
                  </div>
                )}

                {sidebarMatches.length === 0 && sidebarAI.length === 0 && sidebarExperiences.length === 0 && !aiLoading && (
                  <div className="text-center py-8">
                    <Sparkles className="w-8 h-8 text-[#D1CDC7] mx-auto mb-3" />
                    <p className="text-xs font-sans text-[#78726B]/50">Add cities to your trip to see vetted recommendations.</p>
                  </div>
                )}

                <div className="space-y-2 pt-4 border-t border-[#D1CDC7]/30">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-sans uppercase tracking-widest text-[#78726B]/50">Workspace</span>
                    <button
                      onClick={() => {
                        setShowWorkspaceAdd(!showWorkspaceAdd);
                        if (showWorkspaceAdd) {
                          setPendingWorkspaceItem(null);
                          setWorkspaceCategory(null);
                          setWorkspaceCustomImage("");
                        }
                      }}
                      className="text-[#C2B4A3] hover:text-[#2C2926] transition-colors"
                      data-testid="button-toggle-workspace-add"
                    >
                      {showWorkspaceAdd ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    </button>
                  </div>

                  {showWorkspaceAdd && selectedPlanId && !pendingWorkspaceItem && (
                    <div className="p-3 rounded-none border-[0.5px] border-[#D1CDC7] bg-white/50">
                      <PlacesAutocomplete
                        compact
                        placeholder="Search any place..."
                        testIdPrefix="workspace-place"
                        types={[]}
                        onSelect={(details) => {
                          const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${details.placeId}`;
                          const streetFromSecondary = details.secondaryText?.split(",")[0]?.trim() || "";
                          const neighborhoodLabel = streetFromSecondary || details.suburb || undefined;
                          setPendingWorkspaceItem({
                            title: details.name,
                            url: mapsUrl,
                            placeId: details.placeId,
                            googlePhotoUrl: details.photoUrl || undefined,
                            neighborhood: neighborhoodLabel,
                          });
                          setWorkspaceCategory(null);
                          setWorkspaceCustomImage("");
                        }}
                      />
                    </div>
                  )}

                  {pendingWorkspaceItem && selectedPlanId && (
                    <div className="p-3 rounded-none border-[0.5px] border-[#D1CDC7] bg-white/50 space-y-3">
                      <div>
                        <p className="font-serif text-xs text-[#2C2926] leading-snug">{pendingWorkspaceItem.title}</p>
                        {pendingWorkspaceItem.neighborhood && (
                          <p className="text-[9px] font-sans text-[#78726B]/60 mt-0.5">{pendingWorkspaceItem.neighborhood}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[9px] font-sans uppercase tracking-widest text-[#78726B]/50 mb-1.5">Label</p>
                        <div className="flex flex-wrap gap-1.5">
                          {["Shopping", "Wellness", "Dining", "Attraction", "Cocktail Bar"].map((cat) => (
                            <button
                              key={cat}
                              onClick={() => setWorkspaceCategory(workspaceCategory === cat ? null : cat)}
                              className={`px-2.5 py-1 text-[9px] font-sans uppercase tracking-wider rounded-full border-[0.5px] transition-all ${
                                workspaceCategory === cat
                                  ? "bg-[#2C2926] text-white border-[#2C2926]"
                                  : "bg-transparent text-[#78726B] border-[#D1CDC7] hover:border-[#C2B4A3]"
                              }`}
                              data-testid={`button-category-${cat.toLowerCase().replace(/\s+/g, "-")}`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] font-sans uppercase tracking-widest text-[#78726B]/50 mb-1.5">Custom Photo URL <span className="normal-case tracking-normal">(optional)</span></p>
                        <Input
                          value={workspaceCustomImage}
                          onChange={(e) => setWorkspaceCustomImage(e.target.value)}
                          placeholder="https://..."
                          className="bg-transparent border-[0.5px] border-[#D1CDC7] rounded-none text-[10px] text-[#2C2926] placeholder:text-[#D1CDC7] focus-visible:ring-0 focus-visible:border-[#78726B] h-7"
                          data-testid="input-workspace-custom-image"
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => {
                            addWorkspaceItem.mutateAsync({
                              tripPlanId: selectedPlanId,
                              title: pendingWorkspaceItem.title,
                              url: pendingWorkspaceItem.url,
                              placeId: pendingWorkspaceItem.placeId,
                              googlePhotoUrl: pendingWorkspaceItem.googlePhotoUrl || undefined,
                              imageUrl: workspaceCustomImage.trim() || undefined,
                              category: workspaceCategory,
                              neighborhood: pendingWorkspaceItem.neighborhood || undefined,
                            });
                            setPendingWorkspaceItem(null);
                            setShowWorkspaceAdd(false);
                            setWorkspaceCategory(null);
                            setWorkspaceCustomImage("");
                          }}
                          className="flex-1 px-3 py-1.5 text-[10px] font-serif uppercase tracking-wider bg-[#2C2926] text-white rounded-full hover:bg-[#2C2926]/90 transition-colors"
                          data-testid="button-save-workspace-item"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setPendingWorkspaceItem(null);
                            setWorkspaceCategory(null);
                            setWorkspaceCustomImage("");
                          }}
                          className="px-3 py-1.5 text-[10px] font-sans text-[#78726B] hover:text-[#2C2926] transition-colors"
                          data-testid="button-cancel-workspace-item"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {(workspaceItems || []).map((item) => {
                    const handleDragStart = (e: React.DragEvent) => {
                      const payload: DragPayload = { type: "workspace", name: item.title, city: "", mapsQuery: item.title, url: item.url || undefined, placeId: item.placeId || undefined, googlePhotoUrl: item.imageUrl || item.googlePhotoUrl || undefined, category: item.category || undefined };
                      e.dataTransfer.setData("application/json", JSON.stringify(payload));
                      e.dataTransfer.effectAllowed = "copy";
                    };

                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={handleDragStart}
                        className="flex gap-3 p-3 rounded-none border-[0.5px] border-[#D1CDC7] bg-white/50 cursor-grab active:cursor-grabbing hover:border-[#C2B4A3] transition-all group"
                        data-testid={`workspace-item-${item.id}`}
                      >
                        <div className="flex items-center flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity">
                          <GripVertical className="w-3 h-3 text-[#78726B]" />
                        </div>
                        {(item.imageUrl || item.googlePhotoUrl) ? (
                          <div className="w-10 h-10 rounded-none relative overflow-hidden flex-shrink-0">
                            <img src={item.imageUrl || item.googlePhotoUrl!} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <PlacePhotoThumb name={item.title} city="" size="sm" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`font-serif ${getDynamicInlineNameClass(item.title)} text-[#2C2926] leading-snug`}>{item.title}</p>
                          {(item.neighborhood || item.category) && (
                            <p className="text-[9px] font-sans text-[#78726B]/60 mt-0.5 line-clamp-1">
                              {[item.neighborhood, item.category].filter(Boolean).join(" · ")}
                            </p>
                          )}
                          {item.notes && <p className="text-[9px] font-sans text-[#78726B]/40 mt-0.5 line-clamp-1">{item.notes}</p>}
                        </div>
                        {item.url && (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[#C2B4A3] hover:text-[#2C2926] transition-colors flex-shrink-0 self-center" data-testid={`link-workspace-${item.id}`}>
                            <MapPin className="w-3 h-3" />
                          </a>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteWorkspaceItem.mutateAsync({ id: item.id, tripPlanId: selectedPlanId! }); }}
                          className="text-[#78726B]/20 hover:text-[#2C2926] transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 self-center"
                          data-testid={`button-delete-workspace-${item.id}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}

                  {(!workspaceItems || workspaceItems.length === 0) && !showWorkspaceAdd && (
                    <p className="text-[10px] font-sans text-[#78726B]/30 py-2">Save places here while you plan.</p>
                  )}
                </div>

                {hotelOptions.length > 0 && (
                  <div className="space-y-2 pt-4 border-t border-[#D1CDC7]/30">
                    <span className="text-[9px] font-sans uppercase tracking-widest text-[#78726B]/50">Your Collection</span>
                    {hotelOptions.slice(0, 4).map((opt, i) => {
                      const handleDragStart = (e: React.DragEvent) => {
                        const payload: DragPayload = { type: "hotel", hotelName: opt.hotelName, city: opt.city, imageUrl: opt.imageUrl };
                        e.dataTransfer.setData("application/json", JSON.stringify(payload));
                        e.dataTransfer.effectAllowed = "copy";
                      };
                      return (
                        <div
                          key={`${opt.hotelName}-${opt.city}`}
                          draggable
                          onDragStart={handleDragStart}
                          className="flex gap-3 p-3 rounded-none border-[0.5px] border-[#D1CDC7] bg-white/50 cursor-grab active:cursor-grabbing hover:border-[#C2B4A3] transition-all group"
                          data-testid={`sidebar-collection-${i}`}
                        >
                          <div className="flex items-center flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity">
                            <GripVertical className="w-3 h-3 text-[#78726B]" />
                          </div>
                          {opt.imageUrl ? (
                            <img src={opt.imageUrl} alt="" className="w-10 h-10 rounded-none object-cover flex-shrink-0" />
                          ) : (
                            <PlacePhotoThumb name={opt.hotelName} city={opt.city} size="sm" />
                          )}
                          <div className="min-w-0">
                            <p className={`font-serif ${getDynamicInlineNameClass(opt.hotelName)} text-[#2C2926] leading-snug`}>{opt.hotelName}</p>
                            <p className="text-[10px] font-sans text-[#78726B]">{opt.city}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : !showNewPlan ? (
        <div className="text-center py-24 text-[#78726B]/50">
          <CalendarDays className="w-14 h-14 mx-auto mb-5 text-[#D1CDC7]" />
          <p className="font-serif text-xl tracking-wide mb-3">Plan Your Next Trip</p>
          <p className="text-sm font-sans text-[#78726B]/60 max-w-sm mx-auto">Create a new trip to organize your hotel stays day-by-day with dining and wellness plans.</p>
        </div>
      ) : null}
    </div>
  );
}

function ItineraryItemRow({ item, selectedPlanId, deleteItineraryItem, updateItineraryItem }: { item: any; selectedPlanId: number; deleteItineraryItem: any; updateItineraryItem: any }) {
  const [editingTime, setEditingTime] = useState(false);
  const [timeValue, setTimeValue] = useState(item.timeOfDay || "");
  const prevTimeRef = useRef(item.timeOfDay);

  if (prevTimeRef.current !== item.timeOfDay) {
    prevTimeRef.current = item.timeOfDay;
    if (!editingTime) {
      setTimeValue(item.timeOfDay || "");
    }
  }

  const handleSaveTime = async () => {
    try {
      await updateItineraryItem.mutateAsync({
        id: item.id,
        tripPlanId: selectedPlanId,
        timeOfDay: timeValue.trim() || null,
      });
    } catch {}
    setEditingTime(false);
  };

  const formatTime = (t: string) => {
    const [h, m] = t.split(":");
    if (!h || !m) return t;
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:${m} ${ampm}`;
  };

  return (
    <div className="flex items-start gap-4 py-2">
      {item.googlePhotoUrl ? (
        <div className="w-14 h-14 rounded-none overflow-hidden flex-shrink-0">
          <img src={item.googlePhotoUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <PlacePhotoThumb name={item.title} city="" size="md" />
      )}
      <div className="flex-1 min-w-0">
        <span className={`font-serif ${getDynamicInlineNameClass(item.title)} text-[#2C2926] leading-snug`}>{item.title}</span>
        {item.timeOfDay && !editingTime && (
          <button
            onClick={(e) => { e.stopPropagation(); setTimeValue(item.timeOfDay || ""); setEditingTime(true); }}
            className="block text-[10px] font-sans text-[#78726B] tracking-wide mt-0.5 hover:text-[#2C2926] hover:underline transition-colors cursor-pointer text-left"
            data-testid={`button-edit-time-${item.id}`}
            title="Edit time"
          >
            {formatTime(item.timeOfDay)}
          </button>
        )}
        {editingTime && (
          <div className="flex items-center gap-1 mt-1">
            <input
              type="time"
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveTime(); if (e.key === "Escape") { setEditingTime(false); setTimeValue(item.timeOfDay || ""); } }}
              autoFocus
              className="text-[10px] font-sans text-[#2C2926] bg-transparent border-b border-[#C2B4A3] outline-none w-[70px] py-0.5"
              data-testid={`input-time-${item.id}`}
            />
            <button onClick={handleSaveTime} className="text-[#C2B4A3] hover:text-[#2C2926]"><Check className="w-3 h-3" /></button>
            <button onClick={() => { setEditingTime(false); setTimeValue(item.timeOfDay || ""); }} className="text-[#78726B]/40 hover:text-[#2C2926]"><X className="w-3 h-3" /></button>
          </div>
        )}
        {!item.timeOfDay && !editingTime && (
          <button
            onClick={() => { setTimeValue(""); setEditingTime(true); }}
            className="block text-[10px] font-sans transition-colors text-[#D1CDC7] hover:text-[#78726B] opacity-0 group-hover/day:opacity-100 mt-0.5"
            data-testid={`button-time-${item.id}`}
            title="Add time"
          >
            Add time
          </button>
        )}
      </div>
      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[#C2B4A3] hover:text-[#2C2926] transition-colors flex-shrink-0 mt-1" data-testid={`link-itinerary-${item.id}`}>
          <MapPin className="w-3.5 h-3.5" />
        </a>
      )}
      <button onClick={() => deleteItineraryItem.mutateAsync({ id: item.id, tripPlanId: selectedPlanId })} className="text-[#78726B]/20 hover:text-[#2C2926] transition-colors flex-shrink-0 opacity-0 group-hover/day:opacity-100 mt-1" data-testid={`button-remove-itinerary-${item.id}`}>
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

const ITEM_TYPE_PLACEHOLDERS: Record<string, string> = {
  dining: "Search restaurants...",
  wellness: "Search wellness & spas...",
  attraction: "Search attractions...",
};

function PlacesInlineAdd({ dayNum, itemType, onAdd }: { dayNum: number; itemType: string; onAdd: (title: string, opts?: { url?: string; placeId?: string; googlePhotoUrl?: string }) => void }) {
  const [adding, setAdding] = useState(false);

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="flex items-center gap-1 text-[9px] font-sans uppercase tracking-widest text-[#78726B]/40 hover:text-[#2C2926] transition-colors"
        data-testid={`button-add-${itemType}-${dayNum}`}
      >
        <Plus className="w-2.5 h-2.5" /> Add
      </button>
    );
  }

  return (
    <div className="mt-1 relative">
      <div className="flex items-center gap-1.5">
        <div className="flex-1">
          <PlacesAutocomplete
            compact
            placeholder={ITEM_TYPE_PLACEHOLDERS[itemType] || "Search places..."}
            testIdPrefix={`${itemType}-place-${dayNum}`}
            types={[]}
            onSelect={(details) => {
              const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${details.placeId}`;
              onAdd(details.name, {
                url: mapsUrl,
                placeId: details.placeId,
                googlePhotoUrl: details.photoUrl || undefined,
              });
              setAdding(false);
            }}
          />
        </div>
        <button onClick={() => setAdding(false)} className="text-[#78726B]/40 hover:text-[#2C2926] flex-shrink-0" data-testid={`button-cancel-${itemType}-${dayNum}`}>
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export default function Itinerary() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F2F0ED] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#78726B]/40" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F2F0ED] pb-28 md:pb-0">
        <header className="pt-16 pb-6 px-6 md:pt-32 md:pb-10 text-center">
          <h1 className="font-serif text-4xl md:text-6xl font-medium text-[#2C2926] mb-4" style={{ letterSpacing: '0.2rem' }}>My Itinerary</h1>
          <p className="font-sans text-xs uppercase tracking-[0.3em] text-[#78726B] mb-8">Intentional Itineraries</p>
        </header>
        <div className="max-w-2xl mx-auto px-6 text-center py-16">
          <CalendarDays className="w-12 h-12 text-[#C2B4A3]/40 mx-auto mb-6" />
          <p className="font-serif text-lg text-[#2C2926] mb-3">Plan your next journey</p>
          <p className="text-sm font-sans text-[#78726B]/60 mb-8">Sign in to create and manage your travel itineraries.</p>
          <a
            href="/api/login"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full border border-[#2C2926] text-[#2C2926] font-serif text-sm uppercase tracking-[0.15em] transition-all duration-300 hover:bg-[#2C2926] hover:text-white"
            data-testid="button-login-itinerary"
          >
            Sign In
          </a>
        </div>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F0ED] pb-28 md:pb-0">
      <header className="pt-16 pb-6 px-6 md:pt-32 md:pb-10 text-center">
        <h1 className="font-serif text-4xl md:text-6xl font-medium text-[#2C2926] mb-4" style={{ letterSpacing: '0.2rem' }}>My Itinerary</h1>
        <p className="font-sans text-xs uppercase tracking-[0.3em] text-[#78726B] mb-8">Intentional Itineraries</p>
      </header>
      <div className="max-w-7xl mx-auto px-3 sm:px-8 lg:px-12">
        <TripPlannerView />
      </div>
      <Navigation />
    </div>
  );
}
