import { useState, useRef, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { useAuth } from "@/hooks/use-auth";
import { useUpload } from "@/hooks/use-upload";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Camera, LogIn, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

export default function Profile() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
    }
  }, [user?.id]);

  const { uploadFile, isUploading } = useUpload({
    onSuccess: async (response) => {
      try {
        await updateProfile.mutateAsync({ profileImageUrl: response.objectPath });
        toast({ title: "Photo Updated", description: "Your profile photo has been updated." });
      } catch {
        toast({ title: "Error", description: "Could not update profile photo.", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Could not upload photo.", variant: "destructive" });
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: { firstName?: string; lastName?: string; profileImageUrl?: string; showInArrivals?: boolean }) => {
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const handleSaveName = async () => {
    try {
      await updateProfile.mutateAsync({ firstName: firstName.trim(), lastName: lastName.trim() });
      toast({ title: "Profile Updated", description: "Your name has been saved." });
    } catch {
      toast({ title: "Error", description: "Could not save your name.", variant: "destructive" });
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const resizeImage = (file: File, maxSize: number): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width <= maxSize && height <= maxSize) {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Canvas not supported")); return; }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error("Resize failed")); return; }
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          }, "image/jpeg", 0.85);
          return;
        }
        const scale = maxSize / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not supported")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("Resize failed")); return; }
          resolve(new File([blob], file.name, { type: "image/jpeg" }));
        }, "image/jpeg", 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
      img.src = url;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid File", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Please select an image under 10MB.", variant: "destructive" });
      return;
    }
    try {
      const resized = await resizeImage(file, 400);
      await uploadFile(resized);
    } catch {
      toast({ title: "Error", description: "Could not process the image.", variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
        <header className="pt-16 pb-12 px-6 md:pt-32 md:pb-20 text-center">
          <h1 className="font-serif text-4xl md:text-6xl font-medium text-[#2C2926] mb-4" style={{ letterSpacing: '0.2rem' }}>Profile</h1>
        </header>
        <div className="flex flex-col items-center justify-center py-24 text-[#78726B]/50 space-y-4">
          <p className="font-serif text-lg tracking-wide">Sign in to manage your profile</p>
          <a
            href="/api/login"
            className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-[#2C2926] text-[#2C2926] font-serif text-sm uppercase tracking-[0.15em] transition-all duration-300 hover:bg-[#2C2926] hover:text-[#F2F0ED]"
            data-testid="button-sign-in-profile"
          >
            <LogIn className="w-4 h-4" />
            Sign in
          </a>
        </div>
        <Navigation />
      </div>
    );
  }

  const avatarUrl = user?.profileImageUrl || null;
  const displayInitials = (user?.firstName?.[0] || user?.email?.[0] || "?").toUpperCase();
  const hasNameChanged = firstName.trim() !== (user?.firstName || "") || lastName.trim() !== (user?.lastName || "");

  return (
    <div className="min-h-screen bg-[#F2F0ED] pb-28 md:pb-0">
      <header className="pt-16 pb-12 px-6 md:pt-32 md:pb-20 text-center">
        <h1 className="font-serif text-4xl md:text-6xl font-medium text-[#2C2926] mb-4" style={{ letterSpacing: '0.2rem' }} data-testid="text-profile-title">Profile</h1>
      </header>

      <main className="max-w-md mx-auto px-6">
        <div className="flex flex-col items-center mb-12">
          <div className="relative group mb-6">
            <button
              onClick={handleAvatarClick}
              disabled={isUploading}
              className="relative w-28 h-28 rounded-full overflow-hidden border-[0.5px] border-[#D1CDC7] focus:outline-none"
              data-testid="button-change-avatar"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#E8E5E1] flex items-center justify-center">
                  <span className="font-serif text-3xl text-[#78726B]">{displayInitials}</span>
                </div>
              )}
              <div className={cn(
                "absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity",
                isUploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}>
                {isUploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              data-testid="input-avatar-file"
            />
          </div>
          <p className="text-xs font-sans text-[#78726B] tracking-wide">Tap to change photo</p>
        </div>

        <div className="space-y-6 mb-8">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-xs font-sans uppercase tracking-wider text-[#78726B]">First Name</Label>
            <Input
              id="firstName"
              data-testid="input-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="bg-transparent border-0 border-b border-[#D1CDC7] rounded-none px-0 focus-visible:ring-0 focus-visible:border-[#2C2926] font-serif text-xl text-[#2C2926] placeholder:text-[#D1CDC7]"
              placeholder="First name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-xs font-sans uppercase tracking-wider text-[#78726B]">Last Name</Label>
            <Input
              id="lastName"
              data-testid="input-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="bg-transparent border-0 border-b border-[#D1CDC7] rounded-none px-0 focus-visible:ring-0 focus-visible:border-[#2C2926] font-serif text-xl text-[#2C2926] placeholder:text-[#D1CDC7]"
              placeholder="Last name"
            />
          </div>
        </div>

        <div className="space-y-4 mb-8">
          <div className="space-y-1">
            <Label className="text-xs font-sans uppercase tracking-wider text-[#78726B]">Email</Label>
            <p className="font-sans text-sm text-[#2C2926]" data-testid="text-profile-email">{user?.email || "Not available"}</p>
          </div>
        </div>

        <div className="border-t border-[#D1CDC7]/40 pt-6 mb-8">
          <Label className="text-xs font-sans uppercase tracking-wider text-[#78726B] mb-4 block">Privacy</Label>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="font-sans text-sm text-[#2C2926]">Show me in New Arrivals</p>
              <p className="font-sans text-[11px] text-[#78726B]/60 mt-0.5">Let others discover you joined within the past week</p>
            </div>
            <Switch
              data-testid="switch-show-arrivals"
              checked={user?.showInArrivals !== false}
              onCheckedChange={(checked) => {
                updateProfile.mutate({ showInArrivals: checked }, {
                  onSuccess: () => {
                    toast({ title: "Privacy Updated", description: checked ? "You'll appear in New Arrivals." : "You won't appear in New Arrivals." });
                  },
                });
              }}
            />
          </div>
        </div>

        {hasNameChanged && (
          <button
            onClick={handleSaveName}
            disabled={updateProfile.isPending}
            className="w-full py-3 rounded-full border border-[#2C2926] text-[#2C2926] text-sm font-serif tracking-wide transition-all duration-300 hover:bg-[#2C2926] hover:text-white disabled:opacity-50 flex items-center justify-center"
            data-testid="button-save-profile"
          >
            {updateProfile.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
          </button>
        )}
      </main>
      <Navigation />
    </div>
  );
}
