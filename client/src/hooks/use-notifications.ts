import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Notification, User } from "@shared/schema";

type NotificationWithActor = Notification & { actor?: User };

export function useNotifications() {
  return useQuery<NotificationWithActor[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    retry: false,
    refetchInterval: 30000,
  });
}

export function useUnreadNotificationCount() {
  return useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/unread-count", { credentials: "include" });
      if (res.status === 401) return { count: 0 };
      if (!res.ok) throw new Error("Failed to fetch unread count");
      return res.json();
    },
    retry: false,
    refetchInterval: 30000,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/mark-read", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });
}

export function useArrivals() {
  return useQuery<User[]>({
    queryKey: ["/api/arrivals"],
    queryFn: async () => {
      const res = await fetch("/api/arrivals", { credentials: "include" });
      if (res.status === 401) return [];
      if (!res.ok) throw new Error("Failed to fetch arrivals");
      return res.json();
    },
    retry: false,
  });
}
