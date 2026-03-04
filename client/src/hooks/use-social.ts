import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User, Entry } from "@shared/schema";

type NetworkEntry = Entry & { user?: User };

export function useNetworkFeed() {
  return useQuery<NetworkEntry[]>({
    queryKey: ["/api/network/feed"],
    queryFn: async () => {
      const res = await fetch("/api/network/feed", { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to fetch network feed");
      return res.json();
    },
    retry: false,
  });
}

export function useFollowing() {
  return useQuery<User[]>({
    queryKey: ["/api/follows/following"],
    queryFn: async () => {
      const res = await fetch("/api/follows/following", { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to fetch following");
      return res.json();
    },
    retry: false,
  });
}

export function useFollowers() {
  return useQuery<User[]>({
    queryKey: ["/api/follows/followers"],
    queryFn: async () => {
      const res = await fetch("/api/follows/followers", { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to fetch followers");
      return res.json();
    },
    retry: false,
  });
}

export function useIsFollowing(userId: string) {
  return useQuery<{ isFollowing: boolean }>({
    queryKey: ["/api/follows/check", userId],
    queryFn: async () => {
      const res = await fetch(`/api/follows/check/${userId}`, { credentials: "include" });
      if (res.status === 401) return { isFollowing: false };
      if (!res.ok) throw new Error("Failed to check follow status");
      return res.json();
    },
    enabled: !!userId,
    retry: false,
  });
}

export function useFollow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/follows/${userId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to follow user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/follows/following"] });
      queryClient.invalidateQueries({ queryKey: ["/api/follows/check"] });
      queryClient.invalidateQueries({ queryKey: ["/api/network/feed"] });
    },
  });
}

export function useUnfollow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/follows/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to unfollow user");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/follows/following"] });
      queryClient.invalidateQueries({ queryKey: ["/api/follows/check"] });
      queryClient.invalidateQueries({ queryKey: ["/api/network/feed"] });
    },
  });
}

export function useSearchUsers(query: string) {
  return useQuery<User[]>({
    queryKey: ["/api/users/search", query],
    queryFn: async () => {
      if (!query || query.length < 2) return [];
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to search users");
      return res.json();
    },
    enabled: query.length >= 2,
    retry: false,
  });
}

export function useUserEntries(userId: string) {
  return useQuery<Entry[]>({
    queryKey: ["/api/users", userId, "entries"],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/entries`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch user entries");
      return res.json();
    },
    enabled: !!userId,
  });
}
