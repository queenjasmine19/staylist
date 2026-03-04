import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Search, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type PlaceSuggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
};

type PlaceDetails = {
  placeId: string;
  name: string;
  formattedAddress: string;
  city: string;
  majorCity: string;
  suburb: string;
  country: string;
  photoUrl: string | null;
  secondaryText?: string;
};

interface PlacesAutocompleteProps {
  onSelect: (details: PlaceDetails) => void;
  initialValue?: string;
  placeholder?: string;
  compact?: boolean;
  testIdPrefix?: string;
  types?: string[];
}

export function PlacesAutocomplete({ onSelect, initialValue = "", placeholder = "Search hotels...", compact = false, testIdPrefix = "places", types }: PlacesAutocompleteProps) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    try {
      const typesQuery = types !== undefined ? `&types=${encodeURIComponent(types.join(","))}` : "";
      const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(input)}${typesQuery}`, {
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setSuggestions(data);
      setIsOpen(data.length > 0);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setSuggestions([]);
        setIsOpen(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [types]);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
  };

  const handleSelect = async (suggestion: PlaceSuggestion) => {
    setQuery(suggestion.mainText);
    setIsOpen(false);
    setSuggestions([]);
    setIsFetchingDetails(true);

    try {
      const res = await fetch(`/api/places/details/${suggestion.placeId}`);
      if (!res.ok) throw new Error("Failed to fetch details");
      const details: PlaceDetails = await res.json();
      details.secondaryText = suggestion.secondaryText;
      onSelect(details);
    } catch {
      const fallbackCity = suggestion.secondaryText.split(",")[0]?.trim() || "";
      onSelect({
        placeId: suggestion.placeId,
        name: suggestion.mainText,
        formattedAddress: suggestion.fullText,
        city: fallbackCity,
        majorCity: fallbackCity,
        suburb: "",
        country: "",
        photoUrl: null,
      });
    } finally {
      setIsFetchingDetails(false);
    }
  };

  const inputClasses = compact
    ? "w-full bg-transparent border-0 border-b border-[#D1CDC7] px-0 py-2 text-sm text-[#2C2926] focus:outline-none focus:border-[#2C2926] placeholder:text-[#D1CDC7] font-sans"
    : "w-full bg-transparent border-0 border-b border-[#D1CDC7] rounded-none px-0 py-2 focus-visible:ring-0 focus-visible:outline-none focus:border-[#2C2926] font-serif text-xl text-[#2C2926] placeholder:text-[#D1CDC7]";

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className={inputClasses}
          data-testid={`${testIdPrefix}-input`}
        />
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          {isLoading || isFetchingDetails ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#C2B4A3]" />
          ) : (
            <Search className="w-4 h-4 text-[#D1CDC7]" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 left-0 right-0 mt-2 rounded-none border-[0.5px] border-[#D1CDC7] bg-white shadow-lg overflow-hidden"
            data-testid={`${testIdPrefix}-dropdown`}
          >
            <div className="py-1">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={suggestion.placeId}
                  type="button"
                  onClick={() => handleSelect(suggestion)}
                  className="w-full px-4 py-3 flex items-start gap-3 text-left transition-colors hover:bg-[#F2F0ED] focus:bg-[#F2F0ED] focus:outline-none"
                  data-testid={`${testIdPrefix}-suggestion-${idx}`}
                >
                  <MapPin className="w-4 h-4 mt-0.5 text-[#C2B4A3] flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-sm text-[#2C2926] truncate leading-snug">{suggestion.mainText}</p>
                    <p className="font-sans text-[11px] text-[#78726B]/60 truncate mt-0.5">{suggestion.secondaryText}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-[#D1CDC7]/30">
              <p className="text-[9px] font-sans text-[#78726B]/40 text-right tracking-wide">Powered by Google</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
