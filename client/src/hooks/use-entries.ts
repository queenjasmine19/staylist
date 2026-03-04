import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type EntryInput, type EntryResponse, type EntriesListResponse } from "@shared/routes";

export function useEntries(filters?: { sortBy?: 'rating' | 'recent' }) {
  const queryKey = [api.entries.list.path, filters?.sortBy].filter(Boolean);

  return useQuery({
    queryKey,
    queryFn: async () => {
      const url = new URL(api.entries.list.path, window.location.origin);
      if (filters?.sortBy) url.searchParams.set('sortBy', filters.sortBy);

      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch entries');
      return api.entries.list.responses[200].parse(await res.json());
    },
  });
}

export function useEntry(id: number) {
  return useQuery({
    queryKey: [api.entries.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.entries.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to fetch entry');
      return api.entries.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: EntryInput) => {
      const validated = api.entries.create.input.parse(data);
      const res = await fetch(api.entries.create.path, {
        method: api.entries.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Your session has expired. Please sign in again.');
        }
        if (res.status === 400) {
          const error = api.entries.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error('Failed to create entry');
      }
      return api.entries.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.entries.list.path] });
    },
  });
}

export function useUpdateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<EntryInput>) => {
      const validated = api.entries.update.input.parse(updates);
      const url = buildUrl(api.entries.update.path, { id });

      const res = await fetch(url, {
        method: api.entries.update.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Your session has expired. Please sign in again.');
        }
        if (res.status === 400) {
          const error = api.entries.update.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        if (res.status === 404) throw new Error('Entry not found');
        throw new Error('Failed to update entry');
      }
      return api.entries.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.entries.list.path] });
    },
  });
}

export function useReorderEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id: number; sortPriority: number }[]) => {
      const res = await fetch("/api/entries/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to reorder entries");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.entries.list.path] });
    },
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.entries.delete.path, { id });
      const res = await fetch(url, {
        method: api.entries.delete.method,
        credentials: "include"
      });

      if (res.status === 404) throw new Error('Entry not found');
      if (!res.ok) throw new Error('Failed to delete entry');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.entries.list.path] });
    },
  });
}
