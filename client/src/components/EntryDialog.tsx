import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateEntry, useUpdateEntry } from "@/hooks/use-entries";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Upload, X, Award } from "lucide-react";
import { PearlsRating } from "@/components/PearlsRating";
import { PlacesAutocomplete } from "@/components/PlacesAutocomplete";
import type { Entry } from "@shared/schema";

interface EntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingEntry?: Entry | null;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function generateYears() {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current + 2; y >= 2000; y--) {
    years.push(y);
  }
  return years;
}

export function EntryDialog({ open, onOpenChange, editingEntry }: EntryDialogProps) {
  const { toast } = useToast();
  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    hotelName: "",
    city: "",
    majorCity: "",
    suburb: "",
    country: "",
    placeId: "",
    imageUrl: "",
    googlePhotoUrl: "",
    notes: "",
    rating: 3,
    hasSpa: false,
    hasConcierge: false,
    hasGym: false,
    hasPool: false,
    hasRestaurant: false,
    hasMichelinGuide: false,
    hasMichelinStar: false,
    hasForbesTravelGuide: false,
    hasOceanView: false,
    hasCocktailBar: false,
    hasDesignForward: false,
    hasLateNightDining: false,
    hasRooftop: false,
    dateOfStay: "",
    sortPriority: 0,
  });

  const [stayMonth, setStayMonth] = useState("");
  const [stayYear, setStayYear] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCheckingAwards, setIsCheckingAwards] = useState(false);
  const [awardResults, setAwardResults] = useState<{ hasMichelinGuide: boolean; hasMichelinStar: boolean; hasForbesTravelGuide: boolean } | null>(null);

  const checkAwards = useCallback(async (hotelName: string, city: string, country?: string, majorCity?: string) => {
    if (!hotelName) return;
    setIsCheckingAwards(true);
    setAwardResults(null);
    try {
      const res = await fetch("/api/hotels/check-awards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelName, city, country, majorCity }),
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setAwardResults(data);
        if (data.hasMichelinGuide || data.hasMichelinStar || data.hasForbesTravelGuide) {
          setFormData(prev => ({
            ...prev,
            hasMichelinGuide: prev.hasMichelinGuide || data.hasMichelinGuide,
            hasMichelinStar: prev.hasMichelinStar || data.hasMichelinStar,
            hasForbesTravelGuide: prev.hasForbesTravelGuide || data.hasForbesTravelGuide,
          }));
        }
      }
    } catch {
    } finally {
      setIsCheckingAwards(false);
    }
  }, []);

  useEffect(() => {
    if (editingEntry) {
      setFormData({
        hotelName: editingEntry.hotelName,
        city: editingEntry.city,
        majorCity: editingEntry.majorCity || "",
        suburb: editingEntry.suburb || "",
        country: editingEntry.country || "",
        placeId: editingEntry.placeId || "",
        imageUrl: editingEntry.imageUrl || "",
        googlePhotoUrl: editingEntry.googlePhotoUrl || "",
        notes: editingEntry.notes || "",
        rating: editingEntry.rating,
        hasSpa: editingEntry.hasSpa,
        hasConcierge: editingEntry.hasConcierge,
        hasGym: editingEntry.hasGym,
        hasPool: editingEntry.hasPool,
        hasRestaurant: editingEntry.hasRestaurant,
        hasMichelinGuide: editingEntry.hasMichelinGuide,
        hasMichelinStar: editingEntry.hasMichelinStar,
        hasForbesTravelGuide: editingEntry.hasForbesTravelGuide,
        hasOceanView: editingEntry.hasOceanView,
        hasCocktailBar: editingEntry.hasCocktailBar,
        hasDesignForward: editingEntry.hasDesignForward,
        hasLateNightDining: editingEntry.hasLateNightDining,
        hasRooftop: editingEntry.hasRooftop,
        dateOfStay: editingEntry.dateOfStay || "",
        sortPriority: editingEntry.sortPriority,
      });
      if (editingEntry.dateOfStay) {
        const parts = editingEntry.dateOfStay.split(" ");
        if (parts.length === 2) {
          setStayMonth(parts[0]);
          setStayYear(parts[1]);
        }
      } else {
        setStayMonth("");
        setStayYear("");
      }
    } else {
      setFormData({
        hotelName: "",
        city: "",
        majorCity: "",
        suburb: "",
        country: "",
        placeId: "",
        imageUrl: "",
        googlePhotoUrl: "",
        notes: "",
        rating: 3,
        hasSpa: false,
        hasConcierge: false,
        hasGym: false,
        hasPool: false,
        hasRestaurant: false,
        hasMichelinGuide: false,
        hasForbesTravelGuide: false,
        hasOceanView: false,
        hasCocktailBar: false,
        hasDesignForward: false,
        hasLateNightDining: false,
        hasRooftop: false,
        dateOfStay: "",
        sortPriority: 0,
      });
      setStayMonth("");
      setStayYear("");
    }
    setSelectedFile(null);
    setFilePreview(null);
    setAwardResults(null);
    setIsCheckingAwards(false);
  }, [editingEntry, open]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = /\.(jpg|jpeg|png|gif|webp|avif)$/i;
    if (!allowed.test(file.name)) {
      toast({
        title: "Invalid file type",
        description: "Please select a JPG, PNG, GIF, or WebP image.",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB.",
      });
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setFilePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadFile = async (): Promise<string | null> => {
    if (!selectedFile) return null;
    setIsUploading(true);
    try {
      try {
        const metaRes = await fetch("/api/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: selectedFile.name,
            size: selectedFile.size,
            contentType: selectedFile.type || "application/octet-stream",
          }),
          credentials: "include",
        });
        if (!metaRes.ok) {
          if (metaRes.status === 401) {
            throw new Error("Your session has expired. Please sign in again and try once more.");
          }
          throw new Error("storage_unavailable");
        }
        const { uploadURL, objectPath } = await metaRes.json();

        const putRes = await fetch(uploadURL, {
          method: "PUT",
          body: selectedFile,
          headers: { "Content-Type": selectedFile.type || "application/octet-stream" },
        });
        if (!putRes.ok) {
          throw new Error("storage_unavailable");
        }

        return objectPath;
      } catch (signedUrlError: any) {
        if (signedUrlError.message === "Your session has expired. Please sign in again and try once more.") {
          throw signedUrlError;
        }
        const formData = new FormData();
        formData.append("file", selectedFile);
        const directRes = await fetch("/api/uploads/direct", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!directRes.ok) {
          if (directRes.status === 401) {
            throw new Error("Your session has expired. Please sign in again and try once more.");
          }
          throw new Error("Could not upload image. Please try again.");
        }
        const { objectPath } = await directRes.json();
        return objectPath;
      }
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Could not upload image. Please try again.",
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let finalImageUrl = formData.imageUrl;

      if (selectedFile) {
        const uploadedUrl = await uploadFile();
        if (uploadedUrl) {
          finalImageUrl = uploadedUrl;
        } else {
          return;
        }
      }

      const dateOfStay = stayMonth && stayYear ? `${stayMonth} ${stayYear}` : "";

      const submitData = { ...formData, imageUrl: finalImageUrl, dateOfStay };

      if (editingEntry) {
        await updateEntry.mutateAsync({ id: editingEntry.id, ...submitData });
      } else {
        await createEntry.mutateAsync(submitData);
      }

      toast({
        title: editingEntry ? "Stay Updated" : "Stay Added",
        description: editingEntry ? "Your hotel details have been updated." : "A new stay has been added to your collection.",
      });
      onOpenChange(false);
    } catch (error: any) {
      const msg = error?.message || "";
      let description = `Could not ${editingEntry ? 'update' : 'add'} this stay. Please try again.`;
      if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("Authentication")) {
        description = "Your session has expired. Please sign in again and try once more.";
      } else if (msg.includes("Failed to create") || msg.includes("Failed to update")) {
        description = `Could not ${editingEntry ? 'update' : 'add'} this stay. Please check your connection and try again.`;
      } else if (msg) {
        description = msg;
      }
      toast({
        title: "Error",
        description,
        variant: "destructive",
      });
    }
  };

  const isPending = createEntry.isPending || updateEntry.isPending || isUploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[500px] bg-white border-[0.5px] border-[#D1CDC7] p-0 overflow-y-auto max-h-[90vh] rounded-none"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          setTimeout(() => {
            document.body.style.pointerEvents = '';
            document.body.style.overflow = '';
            document.body.style.removeProperty('pointer-events');
            document.body.style.removeProperty('overflow');
          }, 0);
        }}
      >
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#D1CDC7] to-transparent" />

        <div className="px-8 pb-8 pt-4">
          <DialogHeader className="mb-8 text-center space-y-2">
            <DialogTitle className="font-serif text-3xl font-normal text-[#2C2926]">
              {editingEntry ? "Edit Stay" : "Add Stay"}
            </DialogTitle>
            <p className="text-xs font-sans uppercase tracking-widest text-[#78726B]">
              {editingEntry ? "Update hotel details" : "Log a new hotel experience"}
            </p>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-sans uppercase tracking-wider text-[#78726B]">Hotel</Label>
                <PlacesAutocomplete
                  initialValue={formData.hotelName}
                  placeholder="Search for a hotel..."
                  testIdPrefix="entry-hotel"
                  onSelect={(details) => {
                    setFormData({
                      ...formData,
                      hotelName: details.name,
                      city: details.city,
                      majorCity: details.majorCity || details.city,
                      suburb: details.suburb || "",
                      country: details.country,
                      placeId: details.placeId,
                      googlePhotoUrl: details.photoUrl || "",
                    });
                    checkAwards(details.name, details.city, details.country, details.majorCity || details.city);
                  }}
                />
                {formData.city && (
                  <p className="text-[11px] font-sans text-[#78726B]/60 mt-1">
                    {formData.city}{formData.country ? `, ${formData.country}` : ""}
                  </p>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <Label className="text-xs font-sans uppercase tracking-wider text-[#78726B]">Date of Stay</Label>
                <div className="flex gap-3">
                  <select
                    value={stayMonth}
                    onChange={(e) => setStayMonth(e.target.value)}
                    className="flex-1 bg-transparent border-0 border-b border-[#D1CDC7] px-0 py-2 text-sm text-[#2C2926] focus:outline-none focus:border-[#2C2926] appearance-none cursor-pointer"
                    data-testid="select-stay-month"
                  >
                    <option value="">Month</option>
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={stayYear}
                    onChange={(e) => setStayYear(e.target.value)}
                    className="w-24 bg-transparent border-0 border-b border-[#D1CDC7] px-0 py-2 text-sm text-[#2C2926] focus:outline-none focus:border-[#2C2926] appearance-none cursor-pointer"
                    data-testid="select-stay-year"
                  >
                    <option value="">Year</option>
                    {generateYears().map((y) => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Label className="text-xs font-sans uppercase tracking-wider text-[#78726B]">Photo</Label>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="imageUrl" className="text-[10px] font-sans uppercase tracking-wider text-[#78726B]/60">Direct URL</Label>
                    <Input
                      id="imageUrl"
                      data-testid="input-image-url"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="bg-transparent border-0 border-b border-[#D1CDC7] rounded-none px-0 focus-visible:ring-0 focus-visible:border-[#2C2926] text-xs font-mono text-[#2C2926] placeholder:text-[#D1CDC7]"
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-[#D1CDC7]/40" />
                    <span className="text-[10px] font-sans uppercase tracking-widest text-[#78726B]/40">or</span>
                    <div className="flex-1 h-px bg-[#D1CDC7]/40" />
                  </div>

                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                      onChange={handleFileSelect}
                      className="hidden"
                      data-testid="input-file-upload"
                    />

                    {filePreview ? (
                      <div className="relative rounded-none overflow-hidden">
                        <img src={filePreview} alt="Preview" className="w-full h-32 object-cover" />
                        <button
                          type="button"
                          onClick={clearFile}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors"
                          data-testid="button-clear-file"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-4 rounded-none border border-dashed border-[#D1CDC7] flex flex-col items-center gap-2 text-[#78726B]/50 font-serif transition-colors hover:border-[#78726B] hover:text-[#78726B]"
                        data-testid="button-upload-trigger"
                      >
                        <Upload className="w-5 h-5" />
                        <span className="text-xs font-sans uppercase tracking-widest">Upload Photo</span>
                        <span className="text-[10px] font-sans opacity-60">JPG, PNG, GIF, WebP up to 10MB</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Label className="text-xs font-sans uppercase tracking-wider text-[#78726B]">Amenities</Label>
                <p className="text-[11px] font-sans text-[#78726B]/60">Tap to rate your favorite amenities.</p>
                {isCheckingAwards && (
                  <div className="flex items-center gap-2 py-1.5 px-3 rounded-full bg-[#C2B4A3]/10 border-[0.5px] border-[#C2B4A3]/20 w-fit" data-testid="status-checking-awards">
                    <Loader2 className="w-3 h-3 animate-spin text-[#C2B4A3]" />
                    <span className="text-[10px] font-sans text-[#78726B]/70">Checking Forbes & Michelin status...</span>
                  </div>
                )}
                {!isCheckingAwards && awardResults && (awardResults.hasMichelinGuide || awardResults.hasMichelinStar || awardResults.hasForbesTravelGuide) && (
                  <div className="flex items-center gap-2 py-1.5 px-3 rounded-full bg-[#C2B4A3]/15 border-[0.5px] border-[#C2B4A3]/30 w-fit" data-testid="status-awards-detected">
                    <Award className="w-3.5 h-3.5 text-[#C2B4A3]" />
                    <span className="text-[10px] font-sans text-[#2C2926]/70">
                      {[
                        awardResults.hasMichelinGuide && "Michelin Key",
                        awardResults.hasMichelinStar && "Michelin Star",
                        awardResults.hasForbesTravelGuide && "Forbes Travel Guide",
                      ].filter(Boolean).join(" & ")} detected
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  {[
                    { id: "spa", label: "Spa", key: "hasSpa" as const },
                    { id: "concierge", label: "Concierge", key: "hasConcierge" as const },
                    { id: "gym", label: "Gym", key: "hasGym" as const },
                    { id: "pool", label: "Pool", key: "hasPool" as const },
                    { id: "restaurant", label: "Restaurant", key: "hasRestaurant" as const },
                    { id: "michelinkey", label: "Michelin Key", key: "hasMichelinGuide" as const },
                    { id: "michelinstar", label: "Michelin Star", key: "hasMichelinStar" as const },
                    { id: "forbes", label: "Forbes Travel Guide", key: "hasForbesTravelGuide" as const },
                    { id: "oceanview", label: "Ocean View", key: "hasOceanView" as const },
                    { id: "cocktailbar", label: "Cocktail Bar", key: "hasCocktailBar" as const },
                    { id: "designforward", label: "Design-Forward", key: "hasDesignForward" as const },
                    { id: "latenightdining", label: "Late-Night Dining", key: "hasLateNightDining" as const },
                    { id: "rooftop", label: "Rooftop", key: "hasRooftop" as const },
                  ].map(({ id, label, key }) => (
                    <div key={id} className="flex items-center space-x-2">
                      <Checkbox
                        id={id}
                        checked={formData[key]}
                        onCheckedChange={(checked) => setFormData({ ...formData, [key]: !!checked })}
                        className="border-[#D1CDC7] data-[state=checked]:bg-[#2C2926] data-[state=checked]:border-[#2C2926]"
                      />
                      <label htmlFor={id} className="text-sm font-sans text-[#2C2926] cursor-pointer">{label}</label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label className="text-xs font-sans uppercase tracking-wider text-[#78726B]">Vibe Check</Label>
                <p className="text-[11px] font-sans text-[#78726B]/60 leading-relaxed">Your personal stay rating on a scale of 1–5</p>
                <div className="flex justify-center py-2">
                  <PearlsRating
                    value={formData.rating}
                    onChange={(val: number) => setFormData({ ...formData, rating: val })}
                    showCaption
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-xs font-sans uppercase tracking-wider text-[#78726B]">Notes</Label>
                <Textarea
                  id="notes"
                  data-testid="input-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="bg-[#F2F0ED]/50 border-[0.5px] border-[#D1CDC7] min-h-[100px] resize-none focus-visible:ring-0 focus-visible:border-[#78726B] font-sans text-sm text-[#2C2926] placeholder:text-[#D1CDC7] rounded-none"
                  placeholder="How was your stay?"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-3 rounded-full border border-[#2C2926] text-[#2C2926] text-sm font-serif tracking-wide transition-all duration-300 hover:bg-[#2C2926] hover:text-white disabled:opacity-50 flex items-center justify-center"
              data-testid="button-submit-entry"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingEntry ? "Update Stay" : "Add Stay")}
            </button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
