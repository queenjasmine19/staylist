import { z } from 'zod';
import { insertEntrySchema, entries, insertWishlistSchema, wishlistItems } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  entries: {
    list: {
      method: 'GET' as const,
      path: '/api/entries' as const,
      input: z.object({
        sortBy: z.enum(['rating']).optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof entries.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/entries/:id' as const,
      responses: {
        200: z.custom<typeof entries.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/entries' as const,
      input: insertEntrySchema,
      responses: {
        201: z.custom<typeof entries.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/entries/:id' as const,
      input: insertEntrySchema.partial(),
      responses: {
        200: z.custom<typeof entries.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/entries/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  wishlist: {
    list: {
      method: 'GET' as const,
      path: '/api/wishlist' as const,
      responses: {
        200: z.array(z.custom<typeof wishlistItems.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/wishlist' as const,
      input: insertWishlistSchema,
      responses: {
        201: z.custom<typeof wishlistItems.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/wishlist/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type EntryInput = z.infer<typeof api.entries.create.input>;
export type EntryResponse = z.infer<typeof api.entries.create.responses[201]>;
export type EntriesListResponse = z.infer<typeof api.entries.list.responses[200]>;

export type WishlistInput = z.infer<typeof api.wishlist.create.input>;
export type WishlistResponse = z.infer<typeof api.wishlist.create.responses[201]>;
export type WishlistListResponse = z.infer<typeof api.wishlist.list.responses[200]>;
