import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PearlsRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  variant?: "dark" | "light";
  showCaption?: boolean;
}

export function PearlsRating({ value, onChange, readOnly = false, variant = "dark", showCaption = false }: PearlsRatingProps) {
  return (
    <div>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-default" data-testid="pearls-rating-container">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                disabled={readOnly}
                onClick={() => onChange?.(rating)}
                className={cn(
                  "w-2.5 h-2.5 rounded-full transition-all duration-300 border",
                  variant === "light"
                    ? value >= rating
                      ? "bg-[#C2B4A3] border-[#C2B4A3] shadow-[0_0_6px_rgba(194,180,163,0.5)]"
                      : "bg-transparent border-white/40"
                    : value >= rating
                      ? "bg-[#C2B4A3] border-[#C2B4A3] shadow-[0_0_6px_rgba(194,180,163,0.4)]"
                      : "bg-transparent border-[#D1CDC7]",
                  readOnly ? "cursor-default" : "cursor-pointer hover:border-[#C2B4A3]"
                )}
                aria-label={`Rate ${rating} out of 5`}
              />
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-[#2C2926] text-white/90 text-[10px] font-sans tracking-wide border-none px-3 py-1.5 rounded-full">
          Your personal stay rating on a scale of 1–5
        </TooltipContent>
      </Tooltip>
      {showCaption && (
        <p className="text-[9px] font-sans text-[#78726B]/50 tracking-wide mt-1" data-testid="text-vibe-check-caption">
          Vibe Check · 1–5
        </p>
      )}
    </div>
  );
}
