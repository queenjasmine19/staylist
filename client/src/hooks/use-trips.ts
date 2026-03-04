import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TripPlan, TripDay, TripItineraryItem, User } from "@shared/schema";

type CommonGroundItem = {
  hotelName: string;
  city: string;
  placeId?: string | null;
  majorCity?: string | null;
  suburb?: string | null;
  imageUrl: string | null;
  friends: Pick<User, 'id' | 'firstName' | 'lastName' | 'profileImageUrl' | 'email'>[];
};

type StyleMatchUser = {
  id: string;
  firstName: string | null;
  profileImageUrl: string | null;
};

type StyleMatch = {
  hotelName: string;
  city: string;
  imageUrl: string | null;
  score: number;
  reasons: string[];
  source: "network" | "common-ground";
  stayedBy?: string;
  stayedByUsers: StyleMatchUser[];
};

type AIRecommendation = {
  hotelName: string;
  city: string;
  reason: string;
  rating: number;
  priority?: "network" | "style" | "collective";
};

type AIExperience = {
  name: string;
  city: string;
  type: "dining" | "wellness";
  reason: string;
  mapsQuery: string;
};

export function useCommonGround() {
  return useQuery<CommonGroundItem[]>({
    queryKey: ["/api/common-ground"],
    queryFn: async () => {
      const res = await fetch("/api/common-ground", { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to fetch common ground");
      return res.json();
    },
    retry: false,
  });
}

export function useTripPlans() {
  return useQuery<TripPlan[]>({
    queryKey: ["/api/trips"],
    queryFn: async () => {
      const res = await fetch("/api/trips", { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to fetch trip plans");
      return res.json();
    },
    retry: false,
  });
}

export function useTripDays(tripPlanId: number | null) {
  return useQuery<TripDay[]>({
    queryKey: ["/api/trips", tripPlanId, "days"],
    queryFn: async () => {
      if (!tripPlanId) return [];
      const res = await fetch(`/api/trips/${tripPlanId}/days`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch trip days");
      return res.json();
    },
    enabled: !!tripPlanId,
    retry: false,
  });
}

export function useTripItineraryItems(tripPlanId: number | null) {
  return useQuery<TripItineraryItem[]>({
    queryKey: ["/api/trips", tripPlanId, "itinerary"],
    queryFn: async () => {
      if (!tripPlanId) return [];
      const res = await fetch(`/api/trips/${tripPlanId}/itinerary`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch itinerary items");
      return res.json();
    },
    enabled: !!tripPlanId,
    retry: false,
  });
}

export function useCreateTripPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; tripDate?: string | null; startDate?: string | null; cities?: string[] | null; totalDays?: number }) => {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create trip plan");
      return res.json() as Promise<TripPlan>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
    },
  });
}

export function useUpdateTripPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number; name?: string; tripDate?: string | null; startDate?: string | null; cities?: string[] | null; totalDays?: number }) => {
      const res = await fetch(`/api/trips/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update trip plan");
      return res.json() as Promise<TripPlan>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
    },
  });
}

export function useDeleteTripPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/trips/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete trip plan");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
    },
  });
}

export function useAddTripDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { tripPlanId: number; dayNumber: number; hotelName: string; city: string; imageUrl?: string | null; googlePhotoUrl?: string | null; notes?: string | null; country?: string | null; placeId?: string | null; majorCity?: string | null; suburb?: string | null; vettedByUserId?: string | null }) => {
      const res = await fetch(`/api/trips/${data.tripPlanId}/days`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add trip day");
      return res.json() as Promise<TripDay>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", variables.tripPlanId, "days"] });
    },
  });
}

export function useDeleteTripDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tripPlanId }: { id: number; tripPlanId: number }) => {
      const res = await fetch(`/api/trip-days/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete trip day");
      return { tripPlanId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", data.tripPlanId, "days"] });
    },
  });
}

export function useAddTripItineraryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { tripPlanId: number; dayNumber: number; itemType: string; title: string; url?: string | null; notes?: string | null; placeId?: string | null; googlePhotoUrl?: string | null; timeOfDay?: string | null }) => {
      const res = await fetch(`/api/trips/${data.tripPlanId}/itinerary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add itinerary item");
      return res.json() as Promise<TripItineraryItem>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", variables.tripPlanId, "itinerary"] });
    },
  });
}

export function useUpdateTripItineraryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tripPlanId, ...updates }: { id: number; tripPlanId: number; timeOfDay?: string | null; notes?: string | null }) => {
      const res = await fetch(`/api/trip-itinerary/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update itinerary item");
      return { tripPlanId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", data.tripPlanId, "itinerary"] });
    },
  });
}

export function useDeleteTripItineraryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tripPlanId }: { id: number; tripPlanId: number }) => {
      const res = await fetch(`/api/trip-itinerary/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete itinerary item");
      return { tripPlanId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", data.tripPlanId, "itinerary"] });
    },
  });
}

export function useTripStyleMatches(tripPlanId: number | null) {
  return useQuery<StyleMatch[]>({
    queryKey: ["/api/trips", tripPlanId, "style-matches"],
    queryFn: async () => {
      if (!tripPlanId) return [];
      const res = await fetch(`/api/trips/${tripPlanId}/style-matches`, { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to fetch style matches");
      return res.json();
    },
    enabled: !!tripPlanId,
    retry: false,
  });
}

export function useAIRecommendations(cities: string[] | null) {
  return useQuery<{ recommendations: AIRecommendation[]; experiences: AIExperience[] }>({
    queryKey: ["/api/trips/recommendations", cities],
    queryFn: async () => {
      if (!cities || cities.length === 0) return { recommendations: [], experiences: [] };
      const res = await fetch("/api/trips/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cities, includeExperiences: true }),
        credentials: "include",
      });
      if (res.status === 401) return { recommendations: [], experiences: [] };
      if (!res.ok) return { recommendations: [], experiences: [] };
      const data = await res.json();
      const recommendations = Array.isArray(data) ? data : (data?.recommendations || []);
      const experiences = data?.experiences || [];
      return { recommendations, experiences };
    },
    enabled: !!cities && cities.length > 0,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTripWorkspaceItems(tripPlanId: number | null) {
  return useQuery<{ id: number; tripPlanId: number; title: string; itemType: string; category: string | null; neighborhood: string | null; url: string | null; imageUrl: string | null; placeId: string | null; googlePhotoUrl: string | null; notes: string | null; sortPriority: number }[]>({
    queryKey: ["/api/trips", tripPlanId, "workspace"],
    queryFn: async () => {
      if (!tripPlanId) return [];
      const res = await fetch(`/api/trips/${tripPlanId}/workspace`, { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to fetch workspace items");
      return res.json();
    },
    enabled: !!tripPlanId,
  });
}

export function useAddTripWorkspaceItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { tripPlanId: number; title: string; itemType?: string; url?: string; imageUrl?: string; placeId?: string; googlePhotoUrl?: string; notes?: string; category?: string | null; neighborhood?: string | null }) => {
      const { tripPlanId, ...body } = data;
      const res = await fetch(`/api/trips/${tripPlanId}/workspace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add workspace item");
      return { tripPlanId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", data.tripPlanId, "workspace"] });
    },
  });
}

export function useDeleteTripWorkspaceItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tripPlanId }: { id: number; tripPlanId: number }) => {
      const res = await fetch(`/api/trip-workspace/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete workspace item");
      return { tripPlanId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", data.tripPlanId, "workspace"] });
    },
  });
}

export type { AIRecommendation, AIExperience, StyleMatch, StyleMatchUser };
