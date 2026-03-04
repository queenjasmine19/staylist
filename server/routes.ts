import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { db } from "./db";
import { entries, wishlistItems, follows, generateMatchSlug, insertTripWorkspaceItemSchema } from "@shared/schema";
import { eq, isNull, inArray } from "drizzle-orm";
import OpenAI from "openai";

function getUserId(req: any): string | null {
  return req.user?.claims?.sub || null;
}

function getUserEmail(req: any): string | null {
  return req.user?.claims?.email || null;
}

const ADMIN_EMAIL = "jbacchus19@gmail.com";

async function backfillWishlistSlugs() {
  try {
    const itemsWithoutSlug = await db.select().from(wishlistItems).where(isNull(wishlistItems.matchSlug));
    if (itemsWithoutSlug.length === 0) return;
    for (const item of itemsWithoutSlug) {
      const slug = generateMatchSlug(item.hotelName, item.city);
      await db.update(wishlistItems).set({ matchSlug: slug, hotelName: item.hotelName.trim(), city: item.city.trim() }).where(eq(wishlistItems.id, item.id));
    }
    console.log(`Backfilled ${itemsWithoutSlug.length} wishlist slugs.`);
  } catch (err) {
    console.error("Backfill wishlist slugs error:", err);
  }
}

async function seedDatabase() {
  const existingSeedEntries = await storage.getSeedEntries();
  if (existingSeedEntries.length === 0) {
    console.log("Seeding database with luxury hotel entries...");

    const seedEntries = [
      {
        hotelName: "The Ritz Paris",
        city: "Paris",
        imageUrl: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?q=80&w=2070&auto=format&fit=crop",
        notes: "Impeccable service, timeless elegance. The suite overlooking Place Vendome was unforgettable.",
        rating: 5,
        hasSpa: true,
        hasConcierge: true,
        hasGym: true,
        hasPool: true,
        hasRestaurant: true,
        hasMichelinGuide: true,
        hasForbesTravelGuide: true,
        dateOfStay: "January 2025",
        sortPriority: 0,
      },
      {
        hotelName: "Aman Tokyo",
        city: "Tokyo",
        imageUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=2070&auto=format&fit=crop",
        notes: "Minimalist luxury at its finest. The spa experience was transcendent. Views of the Imperial Palace gardens.",
        rating: 5,
        hasSpa: true,
        hasConcierge: true,
        hasGym: true,
        hasPool: true,
        hasRestaurant: true,
        hasMichelinGuide: false,
        hasForbesTravelGuide: true,
        dateOfStay: "March 2025",
        sortPriority: 1,
      },
      {
        hotelName: "Claridge's",
        city: "London",
        imageUrl: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=2070&auto=format&fit=crop",
        notes: "Art deco grandeur meets modern comfort. The afternoon tea was a highlight. Concierge arranged the most wonderful theatre tickets.",
        rating: 4,
        hasSpa: true,
        hasConcierge: true,
        hasGym: true,
        hasPool: false,
        hasRestaurant: true,
        hasMichelinGuide: true,
        hasForbesTravelGuide: false,
        dateOfStay: "November 2024",
        sortPriority: 2,
      },
    ];

    for (const seedEntry of seedEntries) {
      const entry = await storage.createEntry(seedEntry);
      await db.update(entries).set({ isSeed: true }).where(eq(entries.id, entry.id));
    }
    console.log("Database seeded successfully.");
  }
}

async function isAdminUser(userId: string, claimsEmail?: string | null): Promise<boolean> {
  if (claimsEmail === ADMIN_EMAIL) return true;
  const user = await storage.getUser(userId);
  return user?.email === ADMIN_EMAIL;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  await seedDatabase();
  await backfillWishlistSlugs();

  registerObjectStorageRoutes(app);

  app.get(api.entries.list.path, async (req: any, res) => {
    const sortBy = req.query.sortBy as 'rating' | 'recent' | undefined;
    const userId = getUserId(req);
    if (userId) {
      const userEntries = await storage.getEntriesByUser(userId, sortBy);
      res.json(userEntries);
    } else {
      const adminUser = await storage.getUserByEmail(ADMIN_EMAIL);
      if (adminUser) {
        const adminEntries = await storage.getEntriesByUser(adminUser.id, sortBy);
        res.json(adminEntries);
      } else {
        res.json([]);
      }
    }
  });

  app.get(api.entries.get.path, async (req, res) => {
    const id = Number(req.params.id);
    const entry = await storage.getEntry(id);
    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }
    res.json(entry);
  });

  app.post(api.entries.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.entries.create.input.parse(req.body);
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      input.userId = userId;
      const entry = await storage.createEntry(input);
      res.status(201).json(entry);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put("/api/entries/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const schema = z.array(z.object({ id: z.number(), sortPriority: z.number() }));
      const updates = schema.parse(req.body);
      await storage.bulkUpdateSortOrder(updates);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid reorder data" });
      }
      throw err;
    }
  });

  app.put(api.entries.update.path, async (req, res) => {
    const id = Number(req.params.id);
    try {
      const input = api.entries.update.input.parse(req.body);
      const existing = await storage.getEntry(id);
      if (!existing) {
        return res.status(404).json({ message: "Entry not found" });
      }
      const userId = getUserId(req);
      if (existing.userId && userId && existing.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to edit this entry" });
      }
      const updated = await storage.updateEntry(id, input);
      res.json(updated);
    } catch (err) {
       if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.entries.delete.path, async (req: any, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getEntry(id);
    if (!existing) {
      return res.status(404).json({ message: "Entry not found" });
    }
    const userId = getUserId(req);
    if (existing.userId && userId && existing.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to delete this entry" });
    }
    await storage.deleteEntry(id);
    res.status(204).send();
  });

  app.get(api.wishlist.list.path, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.json([]);
    }
    const items = await storage.getWishlistItemsByUser(userId);
    console.log(`[wishlist] GET /api/wishlist for user ${userId}: ${items.length} items, ids=[${items.map(i => i.id).join(',')}]`);
    res.json(items);
  });

  app.post(api.wishlist.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.wishlist.create.input.parse(req.body);
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Authentication required" });
      input.userId = userId;

      if (!input.imageUrl) {
        const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
        if (unsplashKey) {
          const queries = [
            `${input.hotelName} ${input.city}`,
            `${input.city} luxury hotel`,
            `${input.city} travel`,
          ];
          for (const q of queries) {
            try {
              const encoded = encodeURIComponent(q);
              const unsplashRes = await fetch(
                `https://api.unsplash.com/search/photos?query=${encoded}&per_page=1`,
                { headers: { Authorization: `Client-ID ${unsplashKey}` } }
              );
              if (unsplashRes.ok) {
                const data = await unsplashRes.json();
                if (data.results && data.results.length > 0) {
                  input.imageUrl = data.results[0].urls.regular;
                  break;
                }
              }
            } catch (e) {
              console.log("Unsplash fetch failed for query:", q, e);
            }
          }
        }
      }

      const existing = await storage.getWishlistItemsByUser(userId);
      const norm = (s: string) => s.toLowerCase().replace(/[\u0027\u2018\u2019\u0060\u00B4]/g, "").replace(/\s+/g, " ").trim();
      const isDuplicate = existing.some(w => {
        if (input.placeId && w.placeId && input.placeId === w.placeId) return true;
        return norm(w.hotelName) === norm(input.hotelName) && norm(w.majorCity || w.city) === norm(input.majorCity || input.city);
      });
      if (isDuplicate) {
        return res.status(400).json({ message: `${input.hotelName} is already on your wishlist.` });
      }

      const item = await storage.createWishlistItem(input);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.wishlist.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getWishlistItem(id);
    if (!existing) {
      return res.status(404).json({ message: "Wishlist item not found" });
    }
    const userId = getUserId(req);
    if (existing.userId && userId && existing.userId !== userId) {
      return res.status(403).json({ message: "Not authorized to delete this wishlist item" });
    }
    await storage.deleteWishlistItem(id);
    res.status(204).send();
  });

  const DEMO_EMAIL = "82tram_rumbles@icloud.com";

  app.post("/api/follows/:userId", isAuthenticated, async (req: any, res) => {
    const followerId = getUserId(req);
    const followingId = req.params.userId;
    if (!followerId) return res.status(401).json({ message: "Unauthorized" });
    if (followerId === followingId) return res.status(400).json({ message: "Cannot follow yourself" });

    const followerUser = await storage.getUser(followerId);
    const targetUser = await storage.getUser(followingId);
    if (targetUser?.email === DEMO_EMAIL && followerUser?.email !== ADMIN_EMAIL) {
      return res.status(403).json({ message: "This account cannot be followed." });
    }

    try {
      const follow = await storage.follow(followerId, followingId);
      const follower = await storage.getUser(followerId);
      const displayName = follower?.firstName || follower?.email?.split("@")[0] || "Someone";
      await storage.createNotification({
        userId: followingId,
        type: "new_follower",
        actorId: followerId,
        message: `${displayName} started following your collection.`,
        isRead: false,
      });
      res.status(201).json(follow);
    } catch (err) {
      res.status(500).json({ message: "Failed to follow user" });
    }
  });

  app.delete("/api/follows/:userId", isAuthenticated, async (req: any, res) => {
    const followerId = getUserId(req);
    const followingId = req.params.userId;
    if (!followerId) return res.status(401).json({ message: "Unauthorized" });
    try {
      await storage.unfollow(followerId, followingId);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to unfollow user" });
    }
  });

  app.get("/api/follows/following", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const following = await storage.getFollowing(userId);
    res.json(following);
  });

  app.get("/api/follows/followers", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const followers = await storage.getFollowers(userId);
    res.json(followers);
  });

  app.get("/api/follows/check/:userId", isAuthenticated, async (req: any, res) => {
    const followerId = getUserId(req);
    const followingId = req.params.userId;
    if (!followerId) return res.status(401).json({ message: "Unauthorized" });
    const isFollowing = await storage.isFollowing(followerId, followingId);
    res.json({ isFollowing });
  });

  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const notifs = await storage.getNotifications(userId);
    res.json(notifs);
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const count = await storage.getUnreadNotificationCount(userId);
    res.json({ count });
  });

  app.post("/api/notifications/mark-read", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    await storage.markNotificationsRead(userId);
    res.json({ success: true });
  });

  app.get("/api/users/:id/stats", async (req: any, res) => {
    try {
      const targetUserId = req.params.id;
      const [followers, following, userEntries] = await Promise.all([
        storage.getFollowers(targetUserId),
        storage.getFollowing(targetUserId),
        storage.getEntriesByUser(targetUserId),
      ]);
      res.json({
        followerCount: followers.length,
        followingCount: following.length,
        stayCount: userEntries.length,
        followers: followers.slice(0, 5).map(f => ({
          id: f.id,
          firstName: f.firstName,
          profileImageUrl: f.profileImageUrl,
        })),
      });
    } catch {
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  app.get("/api/arrivals", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const arrivals = await storage.getNewArrivals(userId);
    res.json(arrivals);
  });

  app.get("/api/network/feed", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const entries = await storage.getNetworkEntries(userId);
    res.json(entries);
  });

  app.get("/api/users/search", isAuthenticated, async (req: any, res) => {
    const query = req.query.q as string;
    if (!query || query.length < 2) return res.json([]);
    const currentUserId = getUserId(req);
    const users = await storage.searchUsers(query);
    const filtered = users.filter(u => u.id !== currentUserId);
    res.json(filtered);
  });

  app.get("/api/users/:id", async (req, res) => {
    const user = await storage.getUser(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  });

  app.get("/api/users/:id/entries", async (req, res) => {
    const entries = await storage.getEntriesByUser(req.params.id);
    res.json(entries);
  });

  app.put("/api/users/profile", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const schema = z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        profileImageUrl: z.string().optional(),
        showInArrivals: z.boolean().optional(),
      });
      const updates = schema.parse(req.body);
      const updated = await storage.updateUser(userId, updates);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get("/api/common-ground", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const results = await storage.getCommonGround(userId);
      res.json(results);
    } catch (err) {
      console.error("Common ground error:", err);
      res.status(500).json({ message: "Failed to fetch common ground" });
    }
  });

  app.get("/api/trips", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const plans = await storage.getTripPlans(userId);
    res.json(plans);
  });

  app.post("/api/trips", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const schema = z.object({
        name: z.string().min(1),
        tripDate: z.string().optional().nullable(),
        startDate: z.string().optional().nullable(),
        cities: z.array(z.string()).optional().nullable(),
        totalDays: z.number().min(1).max(30).optional(),
      });
      const { name, tripDate, startDate, cities, totalDays } = schema.parse(req.body);
      const plan = await storage.createTripPlan({ userId, name, tripDate: tripDate || null, startDate: startDate || null, cities: cities || null, totalDays: totalDays || 1 });
      res.status(201).json(plan);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put("/api/trips/:id", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const plan = await storage.getTripPlan(Number(req.params.id));
    if (!plan) return res.status(404).json({ message: "Trip plan not found" });
    if (plan.userId !== userId) return res.status(403).json({ message: "Not authorized" });
    try {
      const schema = z.object({
        name: z.string().min(1).optional(),
        tripDate: z.string().optional().nullable(),
        startDate: z.string().optional().nullable(),
        cities: z.array(z.string()).optional().nullable(),
        totalDays: z.number().min(1).max(30).optional(),
      });
      const updates = schema.parse(req.body);
      const updated = await storage.updateTripPlan(plan.id, updates);
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Invalid request" });
    }
  });

  app.delete("/api/trips/:id", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const plan = await storage.getTripPlan(Number(req.params.id));
    if (!plan) return res.status(404).json({ message: "Trip plan not found" });
    if (plan.userId !== userId) return res.status(403).json({ message: "Not authorized" });
    await storage.deleteTripPlan(plan.id);
    res.status(204).send();
  });

  app.get("/api/trips/:id/days", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const plan = await storage.getTripPlan(Number(req.params.id));
    if (!plan) return res.status(404).json({ message: "Trip plan not found" });
    if (plan.userId !== userId) return res.status(403).json({ message: "Not authorized" });
    const days = await storage.getTripDays(plan.id);
    res.json(days);
  });

  app.post("/api/trips/:id/days", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const plan = await storage.getTripPlan(Number(req.params.id));
    if (!plan) return res.status(404).json({ message: "Trip plan not found" });
    if (plan.userId !== userId) return res.status(403).json({ message: "Not authorized" });
    try {
      const maxDay = plan.totalDays || 30;
      const schema = z.object({
        dayNumber: z.number().min(1).max(maxDay),
        hotelName: z.string().min(1),
        city: z.string().min(1),
        country: z.string().nullable().optional(),
        placeId: z.string().nullable().optional(),
        majorCity: z.string().nullable().optional(),
        suburb: z.string().nullable().optional(),
        imageUrl: z.string().nullable().optional(),
        googlePhotoUrl: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        vettedByUserId: z.string().nullable().optional(),
        sortPriority: z.number().default(0),
      });
      const input = schema.parse(req.body);
      const day = await storage.createTripDay({ ...input, tripPlanId: plan.id });
      res.status(201).json(day);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.get("/api/trips/:id/style-matches", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const plan = await storage.getTripPlan(Number(req.params.id));
    if (!plan) return res.status(404).json({ message: "Trip plan not found" });
    if (plan.userId !== userId) return res.status(403).json({ message: "Not authorized" });
    try {
      const cities = plan.cities || [];
      if (cities.length === 0) return res.json([]);
      const matches = await storage.getStyleMatches(userId, cities);
      res.json(matches);
    } catch (err) {
      console.error("Style matches error:", err);
      res.status(500).json({ message: "Failed to fetch style matches" });
    }
  });

  app.delete("/api/trip-days/:id", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    await storage.deleteTripDay(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/trips/:id/itinerary", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const plan = await storage.getTripPlan(Number(req.params.id));
    if (!plan) return res.status(404).json({ message: "Trip plan not found" });
    if (plan.userId !== userId) return res.status(403).json({ message: "Not authorized" });
    const items = await storage.getTripItineraryItems(plan.id);
    res.json(items);
  });

  app.post("/api/trips/:id/itinerary", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const plan = await storage.getTripPlan(Number(req.params.id));
    if (!plan) return res.status(404).json({ message: "Trip plan not found" });
    if (plan.userId !== userId) return res.status(403).json({ message: "Not authorized" });
    try {
      const maxDay = plan.totalDays || 30;
      const schema = z.object({
        dayNumber: z.number().min(1).max(maxDay),
        itemType: z.string().min(1),
        title: z.string().min(1),
        url: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        placeId: z.string().nullable().optional(),
        googlePhotoUrl: z.string().nullable().optional(),
        timeOfDay: z.string().nullable().optional(),
        sortPriority: z.number().default(0),
      });
      const input = schema.parse(req.body);
      const item = await storage.createTripItineraryItem({ ...input, tripPlanId: plan.id });
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.patch("/api/trip-itinerary/:id", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const item = await storage.getTripItineraryItemById(Number(req.params.id));
    if (!item) return res.status(404).json({ message: "Itinerary item not found" });
    const plan = await storage.getTripPlan(item.tripPlanId);
    if (!plan || plan.userId !== userId) return res.status(403).json({ message: "Not authorized" });
    try {
      const schema = z.object({
        timeOfDay: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      });
      const updates = schema.parse(req.body);
      const updated = await storage.updateTripItineraryItem(item.id, updates);
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Invalid request" });
    }
  });

  app.delete("/api/trip-itinerary/:id", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const item = await storage.getTripItineraryItemById(Number(req.params.id));
    if (!item) return res.status(404).json({ message: "Itinerary item not found" });
    const plan = await storage.getTripPlan(item.tripPlanId);
    if (!plan || plan.userId !== userId) return res.status(403).json({ message: "Not authorized" });
    await storage.deleteTripItineraryItem(item.id);
    res.status(204).send();
  });

  app.get("/api/trips/:tripPlanId/workspace", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const plan = await storage.getTripPlan(Number(req.params.tripPlanId));
    if (!plan || plan.userId !== userId) return res.status(403).json({ message: "Not authorized" });
    const items = await storage.getTripWorkspaceItems(plan.id);
    res.json(items);
  });

  app.post("/api/trips/:tripPlanId/workspace", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const plan = await storage.getTripPlan(Number(req.params.tripPlanId));
    if (!plan || plan.userId !== userId) return res.status(403).json({ message: "Not authorized" });
    try {
      const parsed = insertTripWorkspaceItemSchema.parse({
        ...req.body,
        tripPlanId: plan.id,
      });
      const item = await storage.createTripWorkspaceItem(parsed);
      res.status(201).json(item);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Invalid request" });
    }
  });

  app.delete("/api/trip-workspace/:id", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const item = await storage.getTripWorkspaceItemById(Number(req.params.id));
    if (!item) return res.status(404).json({ message: "Workspace item not found" });
    const plan = await storage.getTripPlan(item.tripPlanId);
    if (!plan || plan.userId !== userId) return res.status(403).json({ message: "Not authorized" });
    await storage.deleteTripWorkspaceItem(item.id);
    res.status(204).send();
  });

  app.post("/api/trips/recommendations", isAuthenticated, async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const { cities, includeExperiences } = req.body || {};
      const userEntries = await storage.getEntriesByUser(userId);
      const wishlistItems = await storage.getWishlistItemsByUser(userId);

      const followingList = await db.select({ followingId: follows.followingId })
        .from(follows).where(eq(follows.followerId, userId));
      const followerList = await db.select({ followerId: follows.followerId })
        .from(follows).where(eq(follows.followingId, userId));
      const adminUser = await storage.getUserByEmail(ADMIN_EMAIL);
      const connectedIds = new Set([
        ...followingList.map(f => f.followingId),
        ...followerList.map(f => f.followerId),
      ]);
      connectedIds.delete(userId);
      if (adminUser) connectedIds.delete(adminUser.id);
      const friendIds = Array.from(connectedIds);
      let networkContext = "";
      if (friendIds.length > 0) {
        const friendEntries = await db.select().from(entries)
          .where(inArray(entries.userId, friendIds));
        const relevantFriendStays = cities?.length
          ? friendEntries.filter((e: any) => {
              const norm = (s: string) => s.toLowerCase().trim();
              return cities.some((c: string) => norm(c) === norm(e.city) || (e.majorCity && norm(c) === norm(e.majorCity)));
            })
          : friendEntries;
        if (relevantFriendStays.length > 0) {
          networkContext = `\nHotels their trusted network has stayed at: ${relevantFriendStays.slice(0, 15).map((e: any) => `${e.hotelName} in ${e.city} (rated ${e.rating}/5)`).join("; ")}`;
        }
      }

      const commonGround = await storage.getCommonGround(userId);
      const commonGroundContext = commonGround.length > 0
        ? `\nHotels on both their wishlist and friends' collections (Common Ground): ${commonGround.slice(0, 10).map(cg => `${cg.hotelName} in ${cg.city}`).join("; ")}`
        : "";

      const visitedHotels = userEntries.map(e => `${e.hotelName} in ${e.city} (rated ${e.rating}/5)`).join("; ");
      const wishlistHotels = wishlistItems.map(w => `${w.hotelName} in ${w.city}`).join("; ");
      const cityFilter = cities?.length ? `\nIMPORTANT: Only recommend places in these specific cities: ${cities.join(", ")}. Do not suggest places outside these destinations.` : "";

      const experienceSection = includeExperiences ? `
Also include an "experiences" key containing an array of up to 6 objects for dining and wellness recommendations:
- name: string (the EXACT official business name as it appears on Google Maps — do not paraphrase, abbreviate, or combine words)
- city: string
- type: "dining" | "wellness" (dining for restaurants/bars, wellness for spas/gyms/pilates)
- reason: string (1-2 sentence intimate, editorial reason in second person — e.g., "Your warmth-forward aesthetic pairs beautifully with their timber-clad dining room and seasonal tasting menu." Reference design details and atmosphere.)
- mapsQuery: string (Google Maps search query to find this place)

For experiences, ONLY suggest places you are highly confident exist:
- Michelin-starred or Michelin-recommended restaurants (current year listings only)
- Well-known acclaimed restaurants with major press coverage (NYT, Eater, Infatuation)
- Established luxury hotel spas (e.g., Aman Spa, Four Seasons Spa)
- Major branded wellness studios with multiple locations (e.g., Barry's, Equinox, SoulCycle)
- Do NOT suggest obscure studios, unnamed pop-ups, or niche single-location businesses unless you are certain of the exact name and location` : "";

      const prompt = `You are Room Service AI, a luxury hotel concierge for discerning travelers with a "Warm Minimalist" aesthetic. Based on this traveler's profile, provide personalized recommendations.

Their visited hotels: ${visitedHotels || "None yet"}
Their wishlist: ${wishlistHotels || "None yet"}${networkContext}${commonGroundContext}${cityFilter}

CRITICAL RULES — FOLLOW THESE EXACTLY:
1. ONLY recommend real, currently operating establishments. Every name must be the EXACT official business name as listed on Google Maps. Do NOT invent, guess, or approximate names.
2. If you are not at least 95% confident a place exists with that exact name in that exact city, do NOT include it. It is better to return fewer recommendations than to hallucinate.
3. For hotels: stick to well-known luxury and boutique hotels — properties featured in Condé Nast Traveler, Travel + Leisure, or major hotel booking platforms.
4. For restaurants: stick to Michelin-recognized, James Beard nominated, or widely reviewed establishments.
5. For wellness: stick to established brands or hotel-affiliated spas. Do NOT invent studio names.

PRIORITY RANKING (follow this order strictly):
1. HIGHEST PRIORITY: Hotels and places already in their friends' Collections or Common Ground wishlists — these are socially validated.
2. SECOND PRIORITY: High-rated boutique hotels and Michelin-recognized dining that align with their "Warm Minimalist" travel aesthetic — think design-forward, intimate properties.
3. THIRD PRIORITY: Recommendations that would appeal to discerning travelers with similar taste profiles — luxury with soul, not corporate luxury.

Return a JSON object with a "recommendations" key containing an array of up to 8 objects with these fields:
- hotelName: string (the EXACT official hotel name as it appears on Google Maps or booking sites — no paraphrasing)
- city: string (must match the destination cities exactly)
- reason: string (1-2 sentence intimate, editorial reason written in second person — e.g., "Aligned with your preference for warm minimalist design and a favorite among the collective in Sydney." Reference specific style cues like "timber accents," "raw stone," "wabi-sabi," "organic textures," or network connections like "a favorite of your network." Never use generic phrases like "you'll love it.")
- rating: number (expected rating 1-5 based on their preferences)
- priority: string ("network" | "style" | "collective" — which ranking tier this comes from)${experienceSection}

Remember: accuracy over quantity. If you cannot confidently name 8 real places, return fewer. Never fabricate establishment names.`;

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 8192,
      });

      const content = response.choices[0]?.message?.content || "{}";
      let result: any = {};
      try {
        const parsed = JSON.parse(content);
        const recs = Array.isArray(parsed) ? parsed : parsed.recommendations || parsed.hotels || [];
        result.recommendations = recs;
        if (includeExperiences && parsed.experiences) {
          result.experiences = parsed.experiences;
        }
      } catch {
        result = { recommendations: [], experiences: [] };
      }

      const placesApiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (placesApiKey) {
        const validatePlace = async (name: string, city: string): Promise<{ valid: boolean; placeId?: string; googlePhotoUrl?: string }> => {
          try {
            const searchQuery = `"${name}" ${city}`;
            const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": placesApiKey,
                "X-Goog-FieldMask": "places.id,places.displayName,places.photos",
              },
              body: JSON.stringify({ textQuery: searchQuery, maxResultCount: 5 }),
            });
            if (!searchRes.ok) return { valid: false };
            const searchData = await searchRes.json();
            if (!searchData.places || searchData.places.length === 0) return { valid: false };

            const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
            const queryNorm = normalize(name);

            let bestPlace: any = null;
            let bestScore = 0;
            let isExact = false;

            for (const place of searchData.places) {
              const displayNorm = normalize(place.displayName?.text || "");
              if (displayNorm === queryNorm) {
                bestPlace = place;
                bestScore = 1;
                isExact = true;
                break;
              }
              if (displayNorm.includes(queryNorm) || queryNorm.includes(displayNorm)) {
                const len = Math.max(displayNorm.length, queryNorm.length);
                const score = Math.min(displayNorm.length, queryNorm.length) / len;
                if (score > bestScore) {
                  bestScore = score;
                  bestPlace = place;
                  isExact = score > 0.7;
                }
                continue;
              }
              const queryWords = queryNorm.split(/\s+/).filter((w: string) => w.length > 1);
              const displayWords = displayNorm.split(/\s+/).filter((w: string) => w.length > 1);
              const forwardMatch = queryWords.filter((w: string) => displayNorm.includes(w)).length;
              const reverseMatch = displayWords.filter((w: string) => queryNorm.includes(w)).length;
              const score = queryWords.length > 0 && displayWords.length > 0
                ? (forwardMatch / queryWords.length + reverseMatch / displayWords.length) / 2
                : 0;
              if (score > bestScore) {
                bestScore = score;
                bestPlace = place;
              }
            }

            if (!bestPlace || bestScore < 0.4) return { valid: false };

            let photoUrl: string | undefined;
            if (isExact && bestPlace.photos?.length > 0) {
              photoUrl = `https://places.googleapis.com/v1/${bestPlace.photos[0].name}/media?key=${placesApiKey}&maxWidthPx=400&maxHeightPx=300`;
            }
            return { valid: true, placeId: isExact ? bestPlace.id : undefined, googlePhotoUrl: photoUrl };
          } catch {
            return { valid: true };
          }
        };

        if (result.recommendations?.length) {
          const validated = await Promise.all(
            result.recommendations.map(async (rec: any) => {
              const v = await validatePlace(rec.hotelName, rec.city);
              if (!v.valid) return null;
              return { ...rec, placeId: v.placeId, googlePhotoUrl: v.googlePhotoUrl };
            })
          );
          result.recommendations = validated.filter(Boolean);
        }

        if (result.experiences?.length) {
          const validated = await Promise.all(
            result.experiences.map(async (exp: any) => {
              const v = await validatePlace(exp.name, exp.city);
              if (!v.valid) return null;
              return { ...exp, placeId: v.placeId, googlePhotoUrl: v.googlePhotoUrl };
            })
          );
          result.experiences = validated.filter(Boolean);
        }
      }

      res.json(result);
    } catch (err) {
      console.error("AI recommendations error:", err);
      res.status(500).json({ message: "Failed to generate recommendations" });
    }
  });

  const awardsCache = new Map<string, { result: { hasMichelinGuide: boolean; hasMichelinStar: boolean; hasForbesTravelGuide: boolean }; ts: number }>();
  const AWARDS_CACHE_TTL = 1000 * 60 * 60 * 24;

  app.post("/api/hotels/check-awards", isAuthenticated, async (req: any, res) => {
    const { hotelName, city, country, majorCity } = req.body;
    if (!hotelName) return res.json({ hasMichelinGuide: false, hasMichelinStar: false, hasForbesTravelGuide: false });

    const locationParts = [majorCity || city || "", country || ""].filter(Boolean).join(", ");
    const cacheKey = `${hotelName}|${locationParts}`.toLowerCase().trim();
    const cached = awardsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < AWARDS_CACHE_TTL) {
      return res.json(cached.result);
    }

    try {
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{
          role: "user",
          content: `You are a luxury hospitality awards expert with deep knowledge of global hotel and restaurant accolades. For "${hotelName}" in "${locationParts || "unknown location"}", determine these THREE separate categories:

1. MICHELIN KEY (hasMichelinGuide): Answer true ONLY if the HOTEL itself holds a Michelin Key — the Michelin hotel distinction (launched 2024). This is specifically for hotel/accommodation quality, not restaurant dining.

2. MICHELIN STAR (hasMichelinStar): Answer true if the establishment (hotel OR restaurant) currently holds one or more Michelin stars (1, 2, or 3 stars) for its DINING. This includes hotels with Michelin-starred restaurants on premises, standalone Michelin-starred restaurants, or Bib Gourmand recognition. Consider all recent years: 2023, 2024, 2025, 2026.

3. FORBES TRAVEL GUIDE (hasForbesTravelGuide): Answer true if the hotel or resort currently holds a Forbes Travel Guide star rating (Four-Star or Five-Star) for any recent year (2023, 2024, 2025, 2026).

Important: A hotel can have BOTH a Michelin Key AND a Michelin Star (e.g., a luxury hotel with a starred restaurant). Evaluate each independently. Answer true if you have reasonable confidence.

Respond in JSON format exactly like this:
{"hasMichelinGuide": true/false, "hasMichelinStar": true/false, "hasForbesTravelGuide": true/false}`
        }],
        response_format: { type: "json_object" },
        max_completion_tokens: 256,
      });

      const content = response.choices[0]?.message?.content || "{}";
      let result = { hasMichelinGuide: false, hasMichelinStar: false, hasForbesTravelGuide: false };
      try {
        const parsed = JSON.parse(content);
        result = {
          hasMichelinGuide: !!parsed.hasMichelinGuide,
          hasMichelinStar: !!parsed.hasMichelinStar,
          hasForbesTravelGuide: !!parsed.hasForbesTravelGuide,
        };
      } catch {}
      awardsCache.set(cacheKey, { result, ts: Date.now() });
      res.json(result);
    } catch (err) {
      console.error("Award check error:", err);
      res.json({ hasMichelinGuide: false, hasMichelinStar: false, hasForbesTravelGuide: false });
    }
  });

  const photoCache = new Map<string, { photoUrl: string | null; ts: number }>();
  const PHOTO_CACHE_TTL = 1000 * 60 * 60;

  app.get("/api/places/photo-lookup", async (req, res) => {
    const name = req.query.name as string;
    const city = req.query.city as string;
    if (!name) return res.json({ photoUrl: null });

    const cacheKey = `${name}|${city || ""}`.toLowerCase();
    const cached = photoCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < PHOTO_CACHE_TTL) {
      return res.json({ photoUrl: cached.photoUrl });
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return res.json({ photoUrl: null });

    try {
      const searchInput = `${name} ${city || ""}`.trim();
      const acResponse = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
        body: JSON.stringify({ input: searchInput, includedPrimaryTypes: ["lodging", "restaurant", "spa", "gym", "bar"], languageCode: "en" }),
      });

      if (!acResponse.ok) { photoCache.set(cacheKey, { photoUrl: null, ts: Date.now() }); return res.json({ photoUrl: null }); }
      const acData = await acResponse.json();
      const firstSuggestion = (acData.suggestions || []).find((s: any) => s.placePrediction);
      if (!firstSuggestion) { photoCache.set(cacheKey, { photoUrl: null, ts: Date.now() }); return res.json({ photoUrl: null }); }

      const placeId = firstSuggestion.placePrediction.placeId;
      const detailsResponse = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "photos" },
      });

      if (!detailsResponse.ok) { photoCache.set(cacheKey, { photoUrl: null, ts: Date.now() }); return res.json({ photoUrl: null }); }
      const detailsData = await detailsResponse.json();

      let photoUrl = null;
      if (detailsData.photos && detailsData.photos.length > 0) {
        const photoName = detailsData.photos[0].name;
        photoUrl = `https://places.googleapis.com/v1/${photoName}/media?key=${apiKey}&maxWidthPx=400&maxHeightPx=400`;
      }

      photoCache.set(cacheKey, { photoUrl, ts: Date.now() });
      res.json({ photoUrl });
    } catch (err) {
      console.error("Photo lookup error:", err);
      res.json({ photoUrl: null });
    }
  });

  app.get("/api/places/autocomplete", async (req, res) => {
    const input = req.query.input as string;
    if (!input || input.length < 2) return res.json([]);

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return res.status(500).json({ message: "Google Places API key not configured" });

    const typesParam = req.query.types as string | undefined;
    const requestBody: any = { input, languageCode: "en" };
    if (typesParam === undefined) {
      requestBody.includedPrimaryTypes = ["lodging"];
    } else if (typesParam.length > 0) {
      const types = typesParam.split(",").map(t => t.trim()).filter(Boolean);
      if (types.length > 0) requestBody.includedPrimaryTypes = types;
    }

    try {
      const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("Places Autocomplete error:", err);
        return res.status(500).json({ message: "Places search failed" });
      }

      const data = await response.json();
      const suggestions = (data.suggestions || [])
        .filter((s: any) => s.placePrediction)
        .map((s: any) => ({
          placeId: s.placePrediction.placeId,
          mainText: s.placePrediction.structuredFormat?.mainText?.text || s.placePrediction.text?.text || "",
          secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text || "",
          fullText: s.placePrediction.text?.text || "",
        }));
      res.json(suggestions);
    } catch (err) {
      console.error("Places Autocomplete error:", err);
      res.status(500).json({ message: "Places search failed" });
    }
  });

  app.get("/api/places/details/:placeId", async (req, res) => {
    const { placeId } = req.params;
    if (!placeId) return res.status(400).json({ message: "placeId required" });

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return res.status(500).json({ message: "Google Places API key not configured" });

    try {
      const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "id,displayName,formattedAddress,addressComponents,photos,editorialSummary,websiteUri",
        },
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("Places Details error:", err);
        return res.status(500).json({ message: "Place details fetch failed" });
      }

      const data = await response.json();
      let locality = "";
      let adminLevel2 = "";
      let adminLevel1 = "";
      let country = "";
      let sublocality = "";
      let neighborhoodComp = "";

      if (data.addressComponents) {
        for (const comp of data.addressComponents) {
          if (comp.types?.includes("locality")) {
            locality = comp.longText || comp.shortText || "";
          }
          if (comp.types?.includes("sublocality") || comp.types?.includes("sublocality_level_1")) {
            sublocality = comp.longText || comp.shortText || "";
          }
          if (comp.types?.includes("neighborhood")) {
            neighborhoodComp = comp.longText || comp.shortText || "";
          }
          if (comp.types?.includes("administrative_area_level_2")) {
            adminLevel2 = comp.longText || comp.shortText || "";
          }
          if (comp.types?.includes("administrative_area_level_1")) {
            adminLevel1 = comp.longText || comp.shortText || "";
          }
          if (comp.types?.includes("country")) {
            country = comp.longText || comp.shortText || "";
          }
        }
      }

      const cleanAdminName = (name: string) => {
        return name
          .replace(/\s+(Governorate|Prefecture|Province|Region|District|Municipality|Department|Oblast|County|State)$/i, "")
          .replace(/^(City of|Council of the City of)\s+/i, "")
          .trim();
      };

      const cleanedAdmin2 = cleanAdminName(adminLevel2);
      const cleanedAdmin1 = cleanAdminName(adminLevel1);

      let majorCity = "";
      let suburb = "";

      const adminWasCleaned = cleanedAdmin1 !== adminLevel1 && cleanedAdmin1.length > 0;

      if (locality) {
        majorCity = locality;
        suburb = sublocality || neighborhoodComp || "";
      } else if (adminWasCleaned && cleanedAdmin1) {
        majorCity = cleanedAdmin1;
        suburb = cleanedAdmin2 || sublocality || neighborhoodComp || "";
      } else if (cleanedAdmin2) {
        majorCity = cleanedAdmin2;
        suburb = sublocality || neighborhoodComp || "";
      } else if (cleanedAdmin1) {
        majorCity = cleanedAdmin1;
        suburb = neighborhoodComp || "";
      }

      const city = locality || majorCity || cleanedAdmin2 || cleanedAdmin1 || "";

      if (!majorCity) majorCity = city;

      let photoUrl = null;
      if (data.photos && data.photos.length > 0) {
        const photoName = data.photos[0].name;
        photoUrl = `https://places.googleapis.com/v1/${photoName}/media?key=${apiKey}&maxWidthPx=800&maxHeightPx=600`;
      }

      res.json({
        placeId: data.id || placeId,
        name: data.displayName?.text || "",
        formattedAddress: data.formattedAddress || "",
        city,
        majorCity,
        suburb,
        country,
        photoUrl,
        editorialSummary: data.editorialSummary?.text || null,
        websiteUrl: data.websiteUri || null,
      });
    } catch (err) {
      console.error("Places Details error:", err);
      res.status(500).json({ message: "Place details fetch failed" });
    }
  });

  app.get("/api/admin/check", async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.json({ isAdmin: false });
    const admin = await isAdminUser(userId, req.user?.claims?.email);
    res.json({ isAdmin: admin });
  });

  app.get("/api/site-settings", async (_req: any, res) => {
    try {
      const settings = await storage.getAllSiteSettings();
      const cleaned: Record<string, string> = {};
      for (const [key, value] of Object.entries(settings)) {
        if (value.startsWith("data:") && value.length > 300_000) {
          storage.deleteSiteSetting(key).catch(() => {});
        } else {
          cleaned[key] = value;
        }
      }
      res.json(cleaned);
    } catch (err) {
      console.error("Error fetching site settings:", err);
      res.status(500).json({ message: "Failed to fetch site settings" });
    }
  });

  app.put("/api/site-settings/:key", async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const admin = await isAdminUser(userId, req.user?.claims?.email);
    if (!admin) return res.status(403).json({ message: "Admin access required" });

    const { key } = req.params;
    const { value } = req.body;
    if (!value || typeof value !== "string") {
      return res.status(400).json({ message: "Value is required" });
    }

    try {
      await storage.setSiteSetting(key, value);
      res.json({ success: true });
    } catch (err) {
      console.error("Error updating site setting:", err);
      res.status(500).json({ message: "Failed to update site setting" });
    }
  });

  app.delete("/api/site-settings/:key", async (req: any, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const admin = await isAdminUser(userId, req.user?.claims?.email);
    if (!admin) return res.status(403).json({ message: "Admin access required" });

    const { key } = req.params;
    try {
      await storage.deleteSiteSetting(key);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting site setting:", err);
      res.status(500).json({ message: "Failed to delete site setting" });
    }
  });

  return httpServer;
}
