import { Link } from "wouter";
import { useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Camera, Loader2 } from "lucide-react";

const DEFAULT_IMAGES: Record<string, string> = {
  landing_hero: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=2070&auto=format&fit=crop",
  landing_step_archive: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=800&auto=format&fit=crop",
  landing_step_cosign: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?q=80&w=800&auto=format&fit=crop",
  landing_step_execute: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=800&auto=format&fit=crop",
};

function compressImage(file: File, maxWidth: number = 1200, quality: number = 0.7): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, width, height);

      const tryCompress = (q: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Compression failed"));
            if (blob.size > 180_000 && q > 0.3) {
              tryCompress(q - 0.1);
            } else {
              resolve(blob);
            }
          },
          "image/jpeg",
          q
        );
      };
      tryCompress(quality);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

function AdminImageOverlay({ settingKey, onUpload, isUploading }: { settingKey: string; onUpload: (key: string, file: File) => void; isUploading: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(settingKey, file);
          if (inputRef.current) inputRef.current.value = "";
        }}
        data-testid={`input-upload-${settingKey}`}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="absolute bottom-4 right-4 z-20 flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full text-[#2C2926] font-sans text-xs uppercase tracking-wider shadow-lg transition-all hover:bg-white hover:shadow-xl disabled:opacity-60"
        data-testid={`button-change-${settingKey}`}
      >
        {isUploading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Camera className="w-3.5 h-3.5" />
        )}
        {isUploading ? "Uploading..." : "Change Photo"}
      </button>
    </>
  );
}

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    queryFn: async () => {
      const res = await fetch("/api/admin/check", { credentials: "include" });
      return res.json();
    },
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<Record<string, string>>({
    queryKey: ["/api/site-settings"],
    queryFn: async () => {
      const res = await fetch("/api/site-settings");
      return res.json();
    },
  });

  const isAdmin = adminCheck?.isAdmin ?? false;
  const settingsReady = !settingsLoading;

  const getImage = useCallback((key: string) => {
    if (!settingsReady) return "";
    return settings?.[key] || DEFAULT_IMAGES[key] || "";
  }, [settings, settingsReady]);

  const uploadMutation = useMutation({
    mutationFn: async ({ key, file }: { key: string; file: File }) => {
      const compressed = await compressImage(file, 1200, 0.75);
      const compressedFile = new File([compressed], "image.jpg", { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", compressedFile);
      const uploadRes = await fetch("/api/uploads/direct", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { objectPath } = await uploadRes.json();

      const settingRes = await fetch(`/api/site-settings/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: objectPath }),
        credentials: "include",
      });
      if (!settingRes.ok) throw new Error("Failed to save setting");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
    },
    onError: (error: Error) => {
      alert(error.message || "Upload failed. Please try again with a smaller image.");
    },
  });

  const handleUpload = (key: string, file: File) => {
    uploadMutation.mutate({ key, file });
  };

  return (
    <div className="min-h-screen bg-[#F2F0ED] text-[#2C2926]">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#F2F0ED]/95 backdrop-blur-md border-b border-[#D1CDC7]/40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <span className="font-serif text-xl tracking-[0.15em] text-[#2C2926]" data-testid="text-landing-logo">
            Staylist
          </span>
          <div className="flex items-center gap-6">
          </div>
        </div>
      </header>

      <section className="min-h-screen flex flex-col md:flex-row pt-20" data-testid="section-hero">
        <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-16 md:py-0">
          <h1
            className="font-serif text-4xl md:text-5xl lg:text-6xl font-medium leading-[1.15] mb-8"
            style={{ letterSpacing: "0.02em" }}
            data-testid="text-hero-title"
          >
            Your Travel Plans,
            <br />
            Co-signed.
          </h1>
          <p
            className="font-sans text-base md:text-lg text-[#78726B] leading-relaxed max-w-lg mb-12"
            data-testid="text-hero-description"
          >
            A private social ecosystem for travelers with discerning taste. Curate your stays,
            scout intentional spaces, and plan your next getaway.
          </p>

          <Link href="/app">
            <span
              className="inline-flex items-center gap-3 px-8 py-4 bg-[#2C2926] text-white rounded-full font-sans text-sm tracking-wide transition-opacity duration-300 hover:opacity-85 cursor-pointer"
              data-testid="button-explore"
            >
              Explore the Edit
              <ArrowRight className="w-4 h-4" />
            </span>
          </Link>
        </div>

        <div className="flex-1 relative min-h-[50vh] md:min-h-0">
          <div
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ${getImage("landing_hero") ? "opacity-100" : "opacity-0"}`}
            style={{ backgroundImage: getImage("landing_hero") ? `url('${getImage("landing_hero")}')` : "none" }}
            data-testid="img-hero"
          >
            <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#F2F0ED]/20" />
          </div>
          {isAdmin && <AdminImageOverlay settingKey="landing_hero" onUpload={handleUpload} isUploading={uploadMutation.isPending} />}
        </div>
      </section>

      <section className="py-24 md:py-32 px-8 md:px-16 lg:px-24" data-testid="section-how-it-works">
        <div className="max-w-7xl mx-auto">
          <h2
            className="font-serif text-3xl md:text-4xl lg:text-5xl font-light uppercase text-center text-[#2C2926] mb-6"
            style={{ letterSpacing: "0.2em" }}
            data-testid="text-how-it-works-title"
          >
            The Blueprint
          </h2>
          <p className="font-sans text-xs uppercase tracking-[0.3em] text-[#78726B] text-center mb-16 md:mb-24">How It Works</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 lg:gap-8">
            <div className="relative rounded-[40px] overflow-hidden aspect-[3/4] group" data-testid="step-archive">
              <img
                src={getImage("landing_step_archive") || undefined}
                alt="Boutique hotel interior"
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${getImage("landing_step_archive") ? "opacity-100" : "opacity-0"}`}
                data-testid="img-step-archive"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/5" />
              {isAdmin && <AdminImageOverlay settingKey="landing_step_archive" onUpload={handleUpload} isUploading={uploadMutation.isPending} />}
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 z-10">
                <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-white/50 mb-3">
                  01 / Collection
                </p>
                <p className="font-sans text-sm md:text-base text-white/90 leading-relaxed">
                  Build your personal archive of boutique hotels and unique stays.
                </p>
              </div>
            </div>

            <div className="relative rounded-[40px] overflow-hidden aspect-[3/4] group" data-testid="step-cosign">
              <img
                src={getImage("landing_step_cosign") || undefined}
                alt="Luxury travel collective"
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${getImage("landing_step_cosign") ? "opacity-100" : "opacity-0"}`}
                data-testid="img-step-cosign"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/5" />
              {isAdmin && <AdminImageOverlay settingKey="landing_step_cosign" onUpload={handleUpload} isUploading={uploadMutation.isPending} />}
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 z-10">
                <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-white/50 mb-3">
                  02 / Network
                </p>
                <p className="font-sans text-sm md:text-base text-white/90 leading-relaxed">
                  Find where your tastes overlap with your trusted circle.
                </p>
              </div>
            </div>

            <div className="relative rounded-[40px] overflow-hidden aspect-[3/4] group" data-testid="step-execute">
              <img
                src={getImage("landing_step_execute") || undefined}
                alt="Curated travel planning"
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${getImage("landing_step_execute") ? "opacity-100" : "opacity-0"}`}
                data-testid="img-step-execute"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/5" />
              {isAdmin && <AdminImageOverlay settingKey="landing_step_execute" onUpload={handleUpload} isUploading={uploadMutation.isPending} />}
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 z-10">
                <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-white/50 mb-3">
                  03 / Itinerary
                </p>
                <p className="font-sans text-sm md:text-base text-white/90 leading-relaxed">
                  Design your next trip using AI-powered recommendations from your network.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-12 px-8 border-t border-[#D1CDC7]/40 text-center">
        <span className="font-sans text-xs text-[#78726B]/60 tracking-wide">
          &copy; {new Date().getFullYear()} Staylist
        </span>
      </footer>
    </div>
  );
}
