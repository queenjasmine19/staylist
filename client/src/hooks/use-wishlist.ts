import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type WishlistInput } from "@shared/routes";

export function useWishlist() {
  return useQuery({
    queryKey: [api.wishlist.list.path],
    queryFn: async () => {
      const res = await fetch(api.wishlist.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch wishlist");
      return api.wishlist.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateWishlistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: WishlistInput) => {
      const validated = api.wishlist.create.input.parse(data);
      const res = await fetch(api.wishlist.create.path, {
        method: api.wishlist.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.wishlist.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create wishlist item");
      }
      return api.wishlist.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.wishlist.list.path] });
    },
  });
}

export function useDeleteWishlistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.wishlist.delete.path, { id });
      const res = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 404) throw new Error("Wishlist item not found");
      if (!res.ok) throw new Error("Failed to delete wishlist item");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.wishlist.list.path] });
    },
  });
}
