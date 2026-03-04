import { useEntries, useReorderEntries } from "@/hooks/use-entries";
import { EntryCard } from "@/components/EntryCard";
import { Navigation } from "@/components/Navigation";
import { Loader2, GripVertical, Check, LogIn, ArrowUpDown, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback, useRef } from "react";
import { EntryDialog } from "@/components/EntryDialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useFollowers, useFollowing } from "@/hooks/use-social";
import type { Entry } from "@shared/schema";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableEntryCard({ entry, index, onEdit, isReordering }: { entry: Entry; index: number; onEdit: (entry: Entry) => void; isReordering: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "w-full relative",
        isDragging && "scale-[1.02]",
      )}
    >
      {isReordering && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-5 left-5 z-30 p-2 rounded-full bg-black/30 backdrop-blur-md text-white cursor-grab active:cursor-grabbing touch-none"
          data-testid={`drag-handle-${entry.id}`}
        >
          <GripVertical className="w-5 h-5" />
        </div>
      )}
      <EntryCard entry={entry} index={index} onEdit={isReordering ? undefined : onEdit} />
    </div>
  );
}

type SortOption = 'custom' | 'recent' | 'rating';
const SORT_LABELS: Record<SortOption, string> = {
  custom: 'Custom Layout',
  recent: 'Most Recent',
  rating: 'Highest Rated',
};

export default function Home() {
  const [sortBy, setSortBy] = useState<SortOption>('custom');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const { data: entries, isLoading, error } = useEntries(
    sortBy !== 'custom' ? { sortBy: sortBy as 'rating' | 'recent' } : undefined
  );
  const reorderEntries = useReorderEntries();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { data: followers } = useFollowers();
  const { data: following } = useFollowing();
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [localEntries, setLocalEntries] = useState<Entry[]>([]);
  const cleanupTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const forceBodyCleanup = useCallback(() => {
    document.body.style.pointerEvents = '';
    document.body.style.overflow = '';
    document.body.style.removeProperty('pointer-events');
    document.body.style.removeProperty('overflow');
    document.body.removeAttribute('data-scroll-locked');
    const radixOverlay = document.querySelector('[data-radix-portal]');
    if (!radixOverlay) {
      document.body.style.removeProperty('--scrollbar-width');
    }
  }, []);

  useEffect(() => {
    if (!isDialogOpen) {
      const timers = [50, 150, 300, 500].map(delay =>
        setTimeout(forceBodyCleanup, delay)
      );
      cleanupTimersRef.current = timers;

      const observer = new MutationObserver(() => {
        if (!isDialogOpen) forceBodyCleanup();
      });
      observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
      const disconnectTimer = setTimeout(() => observer.disconnect(), 600);

      return () => {
        timers.forEach(clearTimeout);
        clearTimeout(disconnectTimer);
        observer.disconnect();
      };
    }
  }, [isDialogOpen, forceBodyCleanup]);

  useEffect(() => {
    if (entries) {
      setLocalEntries(entries);
    }
  }, [entries]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleEdit = (entry: Entry) => {
    setEditingEntry(entry);
    setIsDialogOpen(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLocalEntries((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleSaveOrder = async () => {
    const updates = localEntries.map((entry, index) => ({
      id: entry.id,
      sortPriority: index,
    }));

    try {
      await reorderEntries.mutateAsync(updates);
      toast({
        title: "Order Saved",
        description: "Your collection has been rearranged.",
      });
      setIsReordering(false);
    } catch {
      toast({
        title: "Error",
        description: "Could not save the new order.",
        variant: "destructive",
      });
    }
  };

  const handleToggleReorder = () => {
    if (isReordering) {
      handleSaveOrder();
    } else {
      setIsReordering(true);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F2F0ED] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#78726B]/40" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F2F0ED] flex flex-col items-center justify-center p-6 text-center">
        <h2 className="font-serif text-3xl text-[#2C2926] mb-4">Unable to load collection</h2>
        <p className="font-sans text-sm text-[#78726B]">Please check your connection and try again.</p>
      </div>
    );
  }

  const displayEntries = isReordering ? localEntries : (entries || []);
  const followerCount = followers?.length || 0;
  const followingCount = following?.length || 0;
  const stayCount = displayEntries.length;

  return (
    <div className="min-h-screen bg-[#F2F0ED] pb-28 md:pb-0">
      <EntryDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingEntry(null);
          }
        }}
        editingEntry={editingEntry}
      />
      <header className="pt-16 pb-6 px-6 md:pt-32 md:pb-10 text-center">
        <h1 className="font-serif text-4xl md:text-6xl font-medium text-[#2C2926] mb-2" style={{ letterSpacing: '0.15em' }} data-testid="text-title">My Collection</h1>
        <p className="font-sans text-xs uppercase tracking-[0.3em] text-[#78726B] mb-8">
          {isAuthenticated ? "Your Curated Hotel Archive" : "Your Curated Hotel Collection"}
        </p>

        {isAuthenticated && (
          <div className="flex items-center justify-center gap-6 sm:gap-10 mb-8" data-testid="social-stats-bar">
            <div className="flex items-center gap-2" data-testid="stat-followers">
              <div className="flex items-center gap-1.5">
                {followers && followers.length > 0 && (
                  <div className="flex -space-x-1.5 mr-1">
                    {followers.slice(0, 3).map((follower) => (
                      <div key={follower.id} className="w-5 h-5 rounded-full border-[1.5px] border-[#F2F0ED] overflow-hidden">
                        {follower.profileImageUrl ? (
                          <img src={follower.profileImageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-[#C2B4A3]" />
                        )}
                      </div>
                    ))}
                    {followers.length > 3 && (
                      <div className="w-5 h-5 rounded-full border-[1.5px] border-[#F2F0ED] bg-[#D1CDC7] flex items-center justify-center">
                        <span className="text-[7px] text-[#2C2926] font-sans">+{followers.length - 3}</span>
                      </div>
                    )}
                  </div>
                )}
                <span className="text-sm font-sans font-medium text-[#2C2926]" data-testid="text-follower-count">{followerCount}</span>
                <span className="text-[10px] font-serif tracking-wide text-[#78726B]">Followers</span>
              </div>
            </div>

            <div className="w-px h-4 bg-[#D1CDC7]" />

            <div className="flex items-center gap-1.5" data-testid="stat-following">
              <span className="text-sm font-sans font-medium text-[#2C2926]" data-testid="text-following-count">{followingCount}</span>
              <span className="text-[10px] font-serif tracking-wide text-[#78726B]">Following</span>
            </div>

            <div className="w-px h-4 bg-[#D1CDC7]" />

            <div className="flex items-center gap-1.5" data-testid="stat-stays">
              <span className="text-sm font-sans font-medium text-[#2C2926]" data-testid="text-stays-count">{stayCount}</span>
              <span className="text-[10px] font-serif tracking-wide text-[#78726B]">Stays</span>
            </div>
          </div>
        )}

        <div className="mt-2 md:mt-4">
          {isAuthenticated ? (
            <button
              onClick={() => setIsDialogOpen(true)}
              className="px-8 py-2.5 rounded-full border border-[#2C2926] bg-transparent text-[#2C2926] font-serif text-sm uppercase tracking-[0.15em] transition-all duration-300 hover:bg-[#F2F0ED]"
              data-testid="button-add-stay"
            >
              Add Stay
            </button>
          ) : (
            <a
              href="/api/login"
              className="inline-flex items-center gap-2 px-8 py-2.5 rounded-full border border-[#2C2926] bg-transparent text-[#2C2926] font-serif text-sm uppercase tracking-[0.15em] transition-all duration-300 hover:bg-[#2C2926] hover:text-[#F2F0ED]"
              data-testid="button-sign-in-to-add"
            >
              <LogIn className="w-4 h-4" />
              Sign in to add a stay
            </a>
          )}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-3 sm:px-10 lg:px-12">
        {displayEntries.length > 1 && (
          <div className="flex items-center justify-between gap-4 mb-10">
            <div className="relative">
              <button
                onClick={() => setSortMenuOpen(!sortMenuOpen)}
                className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-serif tracking-wide transition-all duration-300 border border-[#D1CDC7] hover:border-[#2C2926] bg-transparent text-[#2C2926]"
                data-testid="button-sort-menu"
              >
                <ArrowUpDown className="w-3 h-3" />
                <span>{SORT_LABELS[sortBy]}</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform", sortMenuOpen && "rotate-180")} />
              </button>
              {sortMenuOpen && (
                <div className="absolute top-full left-0 mt-2 bg-[#F2F0ED] border border-[#D1CDC7] rounded-md overflow-hidden z-40 min-w-[160px]">
                  {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        setSortBy(option);
                        setSortMenuOpen(false);
                        if (isReordering) setIsReordering(false);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-2.5 text-sm font-sans tracking-wide transition-colors",
                        sortBy === option
                          ? "text-[#2C2926] bg-[#E8E5E1]"
                          : "text-[#78726B] hover:text-[#2C2926] hover:bg-[#E8E5E1]/50"
                      )}
                      data-testid={`sort-option-${option}`}
                    >
                      {SORT_LABELS[option]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {isAuthenticated && sortBy === 'custom' && (
              <button
                onClick={handleToggleReorder}
                disabled={reorderEntries.isPending}
                className={cn(
                  "flex items-center gap-2 px-5 py-2 rounded-full text-sm font-serif tracking-wide transition-all duration-300 border",
                  isReordering
                    ? "bg-[#2C2926] text-white border-[#2C2926]"
                    : "bg-transparent text-[#2C2926] border-[#D1CDC7] hover:border-[#2C2926]"
                )}
                data-testid="button-toggle-reorder"
              >
                {reorderEntries.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : isReordering ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>Save Order</span>
                  </>
                ) : (
                  <>
                    <GripVertical className="w-3 h-3" />
                    <span>Edit Layout</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {displayEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-[#78726B]/50 space-y-4">
            <div className="w-20 h-20 rounded-full border-[0.5px] border-[#D1CDC7] flex items-center justify-center">
              <span className="font-serif text-3xl text-[#78726B]/40">0</span>
            </div>
            {isAuthenticated ? (
              <>
                <p className="font-serif text-lg tracking-wide">No stays yet</p>
                <p className="font-sans text-sm text-[#78726B]/70">Add your first hotel to start your collection</p>
              </>
            ) : (
              <>
                <p className="font-serif text-lg tracking-wide">Welcome to Staylist</p>
                <p className="font-sans text-sm text-[#78726B]/70">Sign in to start curating your personal hotel collection</p>
              </>
            )}
          </div>
        ) : isReordering ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localEntries.map((e) => e.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 lg:gap-8">
                {localEntries.map((entry, index) => (
                  <div key={entry.id}>
                    <SortableEntryCard
                      entry={entry}
                      index={index}
                      onEdit={handleEdit}
                      isReordering={isReordering}
                    />
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 lg:gap-8">
            {displayEntries.map((entry, index) => (
              <div key={entry.id}>
                <EntryCard entry={entry} index={index} onEdit={isAuthenticated ? handleEdit : undefined} />
              </div>
            ))}
          </div>
        )}
      </main>
      <Navigation />
    </div>
  );
}
