const ADMIN_EMAIL = "jbacchus19@gmail.com";
const DEMO_EMAIL = "82tram_rumbles@icloud.com";

import { db } from "./db";
import {
  entries,
  wishlistItems,
  follows,
  users,
  tripPlans,
  tripDays,
  tripItineraryItems,
  tripWorkspaceItems,
  notifications,
  siteSettings,
  generateMatchSlug,
  type InsertEntry,
  type Entry,
  type UpdateEntryRequest,
  type InsertWishlistItem,
  type WishlistItem,
  type Follow,
  type InsertFollow,
  type User,
  type TripPlan,
  type InsertTripPlan,
  type TripDay,
  type InsertTripDay,
  type TripItineraryItem,
  type InsertTripItineraryItem,
  type TripWorkspaceItem,
  type InsertTripWorkspaceItem,
  type Notification,
  type InsertNotification,
} from "@shared/schema";
import { eq, desc, asc, and, or, inArray } from "drizzle-orm";

export type SortOption = 'rating' | 'recent';

let cachedAdminId: string | null | undefined = undefined;
async function getAdminId(): Promise<string | null> {
  if (cachedAdminId !== undefined) return cachedAdminId;
  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.email, ADMIN_EMAIL));
  cachedAdminId = admin?.id ?? null;
  return cachedAdminId;
}

let cachedDemoId: string | null | undefined = undefined;
async function getDemoId(): Promise<string | null> {
  if (cachedDemoId !== undefined) return cachedDemoId;
  const [demo] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL));
  cachedDemoId = demo?.id ?? null;
  return cachedDemoId;
}

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

function parseDateOfStay(dateStr: string | null): number {
  if (!dateStr) return 0;
  const parts = dateStr.toLowerCase().trim().split(/\s+/);
  if (parts.length < 2) return 0;
  const month = MONTHS[parts[0]] ?? 0;
  const year = parseInt(parts[1], 10) || 0;
  return year * 12 + month;
}

function sortByRecent(items: Entry[]): Entry[] {
  return [...items].sort((a, b) => parseDateOfStay(b.dateOfStay) - parseDateOfStay(a.dateOfStay));
}

export interface IStorage {
  getEntries(sortBy?: SortOption): Promise<Entry[]>;
  getSeedEntries(sortBy?: SortOption): Promise<Entry[]>;
  getEntriesByUser(userId: string, sortBy?: SortOption): Promise<Entry[]>;
  getEntry(id: number): Promise<Entry | undefined>;
  createEntry(entry: InsertEntry): Promise<Entry>;
  updateEntry(id: number, updates: UpdateEntryRequest): Promise<Entry>;
  deleteEntry(id: number): Promise<void>;
  bulkUpdateSortOrder(updates: { id: number; sortPriority: number }[]): Promise<void>;

  getWishlistItems(): Promise<WishlistItem[]>;
  getWishlistItemsByUser(userId: string): Promise<WishlistItem[]>;
  getWishlistItem(id: number): Promise<WishlistItem | undefined>;
  createWishlistItem(item: InsertWishlistItem): Promise<WishlistItem>;
  deleteWishlistItem(id: number): Promise<void>;

  follow(followerId: string, followingId: string): Promise<Follow>;
  unfollow(followerId: string, followingId: string): Promise<void>;
  getFollowing(userId: string): Promise<User[]>;
  getFollowers(userId: string): Promise<User[]>;
  isFollowing(followerId: string, followingId: string): Promise<boolean>;

  getNetworkEntries(userId: string): Promise<(Entry & { user?: User })[]>;

  searchUsers(query: string): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUser(id: string, updates: Partial<Pick<User, 'firstName' | 'lastName' | 'profileImageUrl' | 'showInArrivals'>>): Promise<User>;

  getCommonGround(userId: string): Promise<{ hotelName: string; city: string; placeId?: string | null; majorCity?: string | null; suburb?: string | null; imageUrl: string | null; friends: Pick<User, 'id' | 'firstName' | 'lastName' | 'profileImageUrl' | 'email'>[] }[]>;

  getTripPlans(userId: string): Promise<TripPlan[]>;
  getTripPlan(id: number): Promise<TripPlan | undefined>;
  createTripPlan(plan: InsertTripPlan): Promise<TripPlan>;
  updateTripPlan(id: number, updates: Partial<Pick<TripPlan, 'name' | 'tripDate' | 'cities' | 'totalDays'>>): Promise<TripPlan>;
  deleteTripPlan(id: number): Promise<void>;

  getTripDays(tripPlanId: number): Promise<TripDay[]>;
  createTripDay(day: InsertTripDay): Promise<TripDay>;
  updateTripDay(id: number, updates: Partial<InsertTripDay>): Promise<TripDay>;
  deleteTripDay(id: number): Promise<void>;
  deleteTripDaysByDay(tripPlanId: number, dayNumber: number): Promise<void>;

  getTripItineraryItems(tripPlanId: number): Promise<TripItineraryItem[]>;
  getTripItineraryItemById(id: number): Promise<TripItineraryItem | undefined>;
  createTripItineraryItem(item: InsertTripItineraryItem): Promise<TripItineraryItem>;
  updateTripItineraryItem(id: number, updates: Partial<Pick<TripItineraryItem, "title" | "url" | "notes" | "timeOfDay">>): Promise<TripItineraryItem>;
  deleteTripItineraryItem(id: number): Promise<void>;

  getTripWorkspaceItems(tripPlanId: number): Promise<TripWorkspaceItem[]>;
  getTripWorkspaceItemById(id: number): Promise<TripWorkspaceItem | undefined>;
  createTripWorkspaceItem(item: InsertTripWorkspaceItem): Promise<TripWorkspaceItem>;
  deleteTripWorkspaceItem(id: number): Promise<void>;

  getNotifications(userId: string): Promise<(Notification & { actor?: User })[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  getNewArrivals(userId: string): Promise<User[]>;

  getStyleMatches(userId: string, cities: string[]): Promise<{
    hotelName: string;
    city: string;
    imageUrl: string | null;
    score: number;
    reasons: string[];
    source: "network" | "common-ground";
    stayedBy?: string;
    stayedByUsers: { id: string; firstName: string | null; profileImageUrl: string | null }[];
  }[]>;
}

export class DatabaseStorage implements IStorage {
  async getEntries(sortBy?: SortOption): Promise<Entry[]> {
    if (sortBy === 'rating') {
      return await db.select().from(entries).orderBy(desc(entries.rating), asc(entries.sortPriority));
    }
    const results = await db.select().from(entries).orderBy(asc(entries.sortPriority));
    if (sortBy === 'recent') return sortByRecent(results);
    return results;
  }

  async getSeedEntries(sortBy?: SortOption): Promise<Entry[]> {
    if (sortBy === 'rating') {
      return await db.select().from(entries)
        .where(eq(entries.isSeed, true))
        .orderBy(desc(entries.rating), asc(entries.sortPriority));
    }
    const results = await db.select().from(entries)
      .where(eq(entries.isSeed, true))
      .orderBy(asc(entries.sortPriority));
    if (sortBy === 'recent') return sortByRecent(results);
    return results;
  }

  async getEntriesByUser(userId: string, sortBy?: SortOption): Promise<Entry[]> {
    if (sortBy === 'rating') {
      return await db.select().from(entries)
        .where(eq(entries.userId, userId))
        .orderBy(desc(entries.rating), asc(entries.sortPriority));
    }
    const results = await db.select().from(entries)
      .where(eq(entries.userId, userId))
      .orderBy(asc(entries.sortPriority));
    if (sortBy === 'recent') return sortByRecent(results);
    return results;
  }

  async getEntry(id: number): Promise<Entry | undefined> {
    const [entry] = await db.select().from(entries).where(eq(entries.id, id));
    return entry;
  }

  async createEntry(insertEntry: InsertEntry): Promise<Entry> {
    const [entry] = await db.insert(entries).values(insertEntry).returning();
    return entry;
  }

  async updateEntry(id: number, updates: UpdateEntryRequest): Promise<Entry> {
    const [updated] = await db.update(entries)
      .set(updates)
      .where(eq(entries.id, id))
      .returning();
    return updated;
  }

  async deleteEntry(id: number): Promise<void> {
    await db.delete(entries).where(eq(entries.id, id));
  }

  async bulkUpdateSortOrder(updates: { id: number; sortPriority: number }[]): Promise<void> {
    for (const update of updates) {
      await db.update(entries)
        .set({ sortPriority: update.sortPriority })
        .where(eq(entries.id, update.id));
    }
  }

  async getWishlistItems(): Promise<WishlistItem[]> {
    return await db.select().from(wishlistItems).orderBy(asc(wishlistItems.sortPriority));
  }

  async getWishlistItemsByUser(userId: string): Promise<WishlistItem[]> {
    return await db.select().from(wishlistItems)
      .where(eq(wishlistItems.userId, userId))
      .orderBy(asc(wishlistItems.sortPriority), desc(wishlistItems.id));
  }

  async getWishlistItem(id: number): Promise<WishlistItem | undefined> {
    const [item] = await db.select().from(wishlistItems).where(eq(wishlistItems.id, id));
    return item;
  }

  async createWishlistItem(item: InsertWishlistItem): Promise<WishlistItem> {
    const slug = generateMatchSlug(item.hotelName, item.city);
    const [created] = await db.insert(wishlistItems).values({ ...item, matchSlug: slug }).returning();
    return created;
  }

  async deleteWishlistItem(id: number): Promise<void> {
    await db.delete(wishlistItems).where(eq(wishlistItems.id, id));
  }

  async follow(followerId: string, followingId: string): Promise<Follow> {
    const existing = await db.select().from(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
    if (existing.length > 0) return existing[0];

    const [follow] = await db.insert(follows).values({ followerId, followingId }).returning();
    return follow;
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    await db.delete(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
  }

  async getFollowing(userId: string): Promise<User[]> {
    const result = await db.select({ user: users })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(eq(follows.followerId, userId));
    const adminId = await getAdminId();
    return result.map(r => r.user).filter(u => u.id !== adminId);
  }

  async getFollowers(userId: string): Promise<User[]> {
    const result = await db.select({ user: users })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, userId));
    return result.map(r => r.user).filter(u => u.email !== ADMIN_EMAIL);
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const result = await db.select().from(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)));
    return result.length > 0;
  }

  async getNetworkEntries(userId: string): Promise<(Entry & { user?: User })[]> {
    const followingList = await db.select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, userId));

    const followerList = await db.select({ followerId: follows.followerId })
      .from(follows)
      .where(eq(follows.followingId, userId));

    const adminId = await getAdminId();
    const demoId = await getDemoId();
    const isAdmin = adminId && userId === adminId;
    const connectedIds = new Set([
      ...followingList.map(f => f.followingId),
      ...followerList.map(f => f.followerId),
    ]);
    connectedIds.delete(userId);
    if (adminId) connectedIds.delete(adminId);
    if (demoId && !isAdmin) connectedIds.delete(demoId);

    const userIds = Array.from(connectedIds);
    if (userIds.length === 0) return [];

    const networkEntries = await db.select()
      .from(entries)
      .where(inArray(entries.userId, userIds))
      .orderBy(desc(entries.id));

    const userMap = new Map<string, User>();
    if (networkEntries.length > 0) {
      const uniqueUserIds = Array.from(new Set(networkEntries.map(e => e.userId).filter(Boolean))) as string[];
      if (uniqueUserIds.length > 0) {
        const usersResult = await db.select().from(users).where(inArray(users.id, uniqueUserIds));
        usersResult.forEach(u => userMap.set(u.id, u));
      }
    }

    return networkEntries.map(entry => ({
      ...entry,
      user: entry.userId ? userMap.get(entry.userId) : undefined,
    }));
  }

  async searchUsers(query: string): Promise<User[]> {
    const allUsers = await db.select().from(users);
    const lowerQuery = query.toLowerCase();
    return allUsers.filter(u => {
      if (u.email === ADMIN_EMAIL) return false;
      if (u.email === DEMO_EMAIL) return false;
      const name = `${u.firstName || ''} ${u.lastName || ''} ${u.email || ''}`.toLowerCase();
      return name.includes(lowerQuery);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async updateUser(id: string, updates: Partial<Pick<User, 'firstName' | 'lastName' | 'profileImageUrl' | 'showInArrivals'>>): Promise<User> {
    const [updated] = await db.update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async getCommonGround(userId: string): Promise<{ hotelName: string; city: string; placeId?: string | null; majorCity?: string | null; suburb?: string | null; imageUrl: string | null; friends: Pick<User, 'id' | 'firstName' | 'lastName' | 'profileImageUrl' | 'email'>[] }[]> {
    const followingList = await db.select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, userId));

    const followerList = await db.select({ followerId: follows.followerId })
      .from(follows)
      .where(eq(follows.followingId, userId));

    const adminId = await getAdminId();
    const connectedIds = new Set([
      ...followingList.map(f => f.followingId),
      ...followerList.map(f => f.followerId),
    ]);
    connectedIds.delete(userId);
    if (adminId) connectedIds.delete(adminId);

    if (connectedIds.size === 0) return [];

    const friendIds = Array.from(connectedIds);

    const myWishlist = await db.select().from(wishlistItems)
      .where(eq(wishlistItems.userId, userId));

    if (myWishlist.length === 0) return [];

    const friendWishlist = await db.select().from(wishlistItems)
      .where(inArray(wishlistItems.userId, friendIds));

    const friendUserMap = new Map<string, User>();
    if (friendIds.length > 0) {
      const friendUsers = await db.select().from(users).where(inArray(users.id, friendIds));
      friendUsers.forEach(u => friendUserMap.set(u.id, u));
    }

    const myByPlaceId = new Map<string, WishlistItem>();
    const myBySlug = new Map<string, WishlistItem>();
    myWishlist.forEach(item => {
      if (item.placeId) myByPlaceId.set(item.placeId, item);
      const slug = item.matchSlug || generateMatchSlug(item.hotelName, item.city);
      myBySlug.set(slug, item);
    });

    const matchMap = new Map<string, { hotelName: string; city: string; placeId?: string | null; majorCity?: string | null; suburb?: string | null; imageUrl: string | null; friends: Pick<User, 'id' | 'firstName' | 'lastName' | 'profileImageUrl' | 'email'>[] }>();

    const findSlugMatch = (friendSlug: string): WishlistItem | undefined => {
      if (myBySlug.has(friendSlug)) return myBySlug.get(friendSlug);
      for (const [mySlug, myItem] of myBySlug) {
        if (mySlug.startsWith(friendSlug) || friendSlug.startsWith(mySlug)) return myItem;
      }
      return undefined;
    };

    friendWishlist.forEach(item => {
      let myItem: WishlistItem | undefined;

      if (item.placeId && myByPlaceId.has(item.placeId)) {
        myItem = myByPlaceId.get(item.placeId)!;
      } else {
        const slug = item.matchSlug || generateMatchSlug(item.hotelName, item.city);
        const found = findSlugMatch(slug);
        if (found) {
          myItem = found;
        } else {
          return;
        }
      }

      const matchKey = `my:${myItem.id}`;

      if (!matchMap.has(matchKey)) {
        matchMap.set(matchKey, {
          hotelName: myItem.hotelName,
          city: myItem.city,
          placeId: myItem.placeId || null,
          majorCity: myItem.majorCity || null,
          suburb: myItem.suburb || null,
          imageUrl: myItem.imageUrl || myItem.googlePhotoUrl || item.imageUrl || item.googlePhotoUrl,
          friends: [],
        });
      }
      const friendUser = item.userId ? friendUserMap.get(item.userId) : undefined;
      if (friendUser && friendUser.email !== ADMIN_EMAIL) {
        const existing = matchMap.get(matchKey)!;
        if (!existing.friends.some(f => f.id === friendUser.id)) {
          existing.friends.push({
            id: friendUser.id,
            firstName: friendUser.firstName,
            lastName: friendUser.lastName,
            profileImageUrl: friendUser.profileImageUrl,
            email: friendUser.email,
          });
        }
      }
    });

    return Array.from(matchMap.values());
  }

  async getTripPlans(userId: string): Promise<TripPlan[]> {
    return await db.select().from(tripPlans)
      .where(eq(tripPlans.userId, userId))
      .orderBy(desc(tripPlans.createdAt));
  }

  async getTripPlan(id: number): Promise<TripPlan | undefined> {
    const [plan] = await db.select().from(tripPlans).where(eq(tripPlans.id, id));
    return plan;
  }

  async createTripPlan(plan: InsertTripPlan): Promise<TripPlan> {
    const [created] = await db.insert(tripPlans).values(plan).returning();
    return created;
  }

  async updateTripPlan(id: number, updates: Partial<Pick<TripPlan, 'name' | 'tripDate' | 'cities' | 'totalDays'>>): Promise<TripPlan> {
    const [updated] = await db.update(tripPlans)
      .set(updates)
      .where(eq(tripPlans.id, id))
      .returning();
    return updated;
  }

  async deleteTripPlan(id: number): Promise<void> {
    await db.delete(tripPlans).where(eq(tripPlans.id, id));
  }

  async getTripDays(tripPlanId: number): Promise<TripDay[]> {
    return await db.select().from(tripDays)
      .where(eq(tripDays.tripPlanId, tripPlanId))
      .orderBy(asc(tripDays.dayNumber), asc(tripDays.sortPriority));
  }

  async createTripDay(day: InsertTripDay): Promise<TripDay> {
    const [created] = await db.insert(tripDays).values(day).returning();
    return created;
  }

  async updateTripDay(id: number, updates: Partial<InsertTripDay>): Promise<TripDay> {
    const [updated] = await db.update(tripDays)
      .set(updates)
      .where(eq(tripDays.id, id))
      .returning();
    return updated;
  }

  async deleteTripDay(id: number): Promise<void> {
    await db.delete(tripDays).where(eq(tripDays.id, id));
  }

  async deleteTripDaysByDay(tripPlanId: number, dayNumber: number): Promise<void> {
    await db.delete(tripDays)
      .where(and(eq(tripDays.tripPlanId, tripPlanId), eq(tripDays.dayNumber, dayNumber)));
  }

  async getTripItineraryItems(tripPlanId: number): Promise<TripItineraryItem[]> {
    return await db.select().from(tripItineraryItems)
      .where(eq(tripItineraryItems.tripPlanId, tripPlanId))
      .orderBy(asc(tripItineraryItems.dayNumber), asc(tripItineraryItems.sortPriority));
  }

  async getTripItineraryItemById(id: number): Promise<TripItineraryItem | undefined> {
    const [item] = await db.select().from(tripItineraryItems).where(eq(tripItineraryItems.id, id));
    return item;
  }

  async createTripItineraryItem(item: InsertTripItineraryItem): Promise<TripItineraryItem> {
    const [created] = await db.insert(tripItineraryItems).values(item).returning();
    return created;
  }

  async updateTripItineraryItem(id: number, updates: Partial<Pick<TripItineraryItem, "title" | "url" | "notes" | "timeOfDay">>): Promise<TripItineraryItem> {
    const [updated] = await db.update(tripItineraryItems).set(updates).where(eq(tripItineraryItems.id, id)).returning();
    return updated;
  }

  async deleteTripItineraryItem(id: number): Promise<void> {
    await db.delete(tripItineraryItems).where(eq(tripItineraryItems.id, id));
  }

  async getTripWorkspaceItems(tripPlanId: number): Promise<TripWorkspaceItem[]> {
    return await db.select().from(tripWorkspaceItems)
      .where(eq(tripWorkspaceItems.tripPlanId, tripPlanId))
      .orderBy(asc(tripWorkspaceItems.sortPriority));
  }

  async getTripWorkspaceItemById(id: number): Promise<TripWorkspaceItem | undefined> {
    const [item] = await db.select().from(tripWorkspaceItems).where(eq(tripWorkspaceItems.id, id));
    return item;
  }

  async createTripWorkspaceItem(item: InsertTripWorkspaceItem): Promise<TripWorkspaceItem> {
    const [created] = await db.insert(tripWorkspaceItems).values(item).returning();
    return created;
  }

  async deleteTripWorkspaceItem(id: number): Promise<void> {
    await db.delete(tripWorkspaceItems).where(eq(tripWorkspaceItems.id, id));
  }

  async getNotifications(userId: string): Promise<(Notification & { actor?: User })[]> {
    const rows = await db.select({
      notification: notifications,
      actor: users,
    })
      .from(notifications)
      .leftJoin(users, eq(notifications.actorId, users.id))
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
    return rows.map(r => ({
      ...r.notification,
      actor: r.actor || undefined,
    }));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async markNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const rows = await db.select().from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return rows.length;
  }

  async getNewArrivals(userId: string): Promise<User[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const following = await db.select({ id: follows.followingId }).from(follows).where(eq(follows.followerId, userId));
    const followingIds = new Set(following.map(f => f.id));
    const recentUsers = await db.select().from(users)
      .where(and(
        eq(users.showInArrivals, true),
      ))
      .orderBy(desc(users.createdAt));
    return recentUsers.filter(u =>
      u.id !== userId &&
      u.email !== ADMIN_EMAIL &&
      u.email !== DEMO_EMAIL &&
      !followingIds.has(u.id) &&
      u.createdAt && u.createdAt >= sevenDaysAgo
    );
  }

  async getStyleMatches(userId: string, cities: string[]): Promise<{
    hotelName: string;
    city: string;
    imageUrl: string | null;
    score: number;
    reasons: string[];
    source: "network" | "common-ground";
    stayedBy?: string;
    stayedByUsers: { id: string; firstName: string | null; profileImageUrl: string | null }[];
  }[]> {
    const normalize = (s: string) => s.toLowerCase().replace(/[\u0027\u2018\u2019\u0060\u00B4]/g, "").replace(/\s+/g, " ").trim();
    const citySet = new Set(cities.map(normalize));

    const userEntries = await db.select().from(entries).where(eq(entries.userId, userId));

    const amenityWeights: Record<string, number> = {
      hasMichelinGuide: 0,
      hasMichelinStar: 0,
      hasForbesTravelGuide: 0,
      hasSpa: 0,
      hasPool: 0,
      hasRestaurant: 0,
      hasConcierge: 0,
      hasGym: 0,
      hasOceanView: 0,
      hasCocktailBar: 0,
      hasDesignForward: 0,
      hasLateNightDining: 0,
      hasRooftop: 0,
    };
    const amenityLabels: Record<string, string> = {
      hasMichelinGuide: "Michelin Key",
      hasMichelinStar: "Michelin Star",
      hasForbesTravelGuide: "Forbes Travel Guide",
      hasSpa: "Spa",
      hasPool: "Pool",
      hasRestaurant: "Restaurant",
      hasConcierge: "Concierge",
      hasGym: "Gym",
      hasOceanView: "Ocean View",
      hasCocktailBar: "Cocktail Bar",
      hasDesignForward: "Design-Forward",
      hasLateNightDining: "Late-Night Dining",
      hasRooftop: "Rooftop",
    };

    for (const entry of userEntries) {
      const ratingWeight = (entry.rating || 3) / 5;
      for (const key of Object.keys(amenityWeights)) {
        if ((entry as any)[key]) {
          amenityWeights[key] += ratingWeight;
        }
      }
    }

    const totalEntries = userEntries.length || 1;
    for (const key of Object.keys(amenityWeights)) {
      amenityWeights[key] = amenityWeights[key] / totalEntries;
    }

    const followingList = await db.select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, userId));
    const followerList = await db.select({ followerId: follows.followerId })
      .from(follows)
      .where(eq(follows.followingId, userId));
    const adminId = await getAdminId();
    const connectedIds = new Set([
      ...followingList.map(f => f.followingId),
      ...followerList.map(f => f.followerId),
    ]);
    connectedIds.delete(userId);
    if (adminId) connectedIds.delete(adminId);
    const friendIds = Array.from(connectedIds);

    if (friendIds.length === 0) return [];

    const friendEntries = await db.select().from(entries)
      .where(inArray(entries.userId, friendIds));

    const friendUsers = await db.select().from(users).where(inArray(users.id, friendIds));
    const friendUserMap = new Map<string, User>();
    friendUsers.forEach(u => friendUserMap.set(u.id, u));

    const commonGroundItems = await this.getCommonGround(userId);
    const commonGroundKeys = new Set(
      commonGroundItems.map(item => `${normalize(item.hotelName)}|${normalize(item.city)}`)
    );

    const aggregated = new Map<string, {
      hotelName: string;
      city: string;
      imageUrl: string | null;
      score: number;
      reasons: Set<string>;
      source: "network" | "common-ground";
      stayedByUsers: Map<string, { id: string; firstName: string | null; profileImageUrl: string | null }>;
    }>();

    const cityMatchesFn = (city: string, majorCity: string | null) => {
      const nc = normalize(city);
      const nmc = majorCity ? normalize(majorCity) : "";
      for (const pc of citySet) {
        if (nc === pc || nmc === pc) return true;
        if (nc.includes(pc) || pc.includes(nc)) return true;
        if (nmc && (nmc.includes(pc) || pc.includes(nmc))) return true;
      }
      return false;
    };

    for (const entry of friendEntries) {
      if (!cityMatchesFn(entry.city, entry.majorCity)) continue;

      const entryKey = `${normalize(entry.hotelName)}|${normalize(entry.city)}`;

      let record = aggregated.get(entryKey);
      if (!record) {
        let score = 0;
        const reasons = new Set<string>();

        for (const key of Object.keys(amenityWeights)) {
          if ((entry as any)[key] && amenityWeights[key] > 0.3) {
            score += amenityWeights[key] * 2;
            reasons.add(amenityLabels[key]);
          }
        }

        if (entry.rating && entry.rating >= 4) {
          score += 1;
          reasons.add(`Rated ${entry.rating}/5`);
        }

        const isCommonGround = commonGroundKeys.has(entryKey);
        if (isCommonGround) {
          score += 3;
          reasons.add("Common Ground match");
        }

        record = {
          hotelName: entry.hotelName,
          city: entry.city,
          imageUrl: entry.imageUrl || entry.googlePhotoUrl,
          score,
          reasons,
          source: isCommonGround ? "common-ground" : "network",
          stayedByUsers: new Map(),
        };
        aggregated.set(entryKey, record);
      }

      if (entry.userId) {
        const friendUser = friendUserMap.get(entry.userId);
        if (friendUser && !record.stayedByUsers.has(friendUser.id)) {
          record.stayedByUsers.set(friendUser.id, {
            id: friendUser.id,
            firstName: friendUser.firstName,
            profileImageUrl: friendUser.profileImageUrl,
          });
          record.score += 0.5;
        }
      }
    }

    const results = Array.from(aggregated.values())
      .filter(r => r.score > 0)
      .map(r => {
        const usersArr = Array.from(r.stayedByUsers.values());
        const stayedBy = usersArr.map(u => u.firstName || "Friend").join(", ");
        if (stayedBy) r.reasons.add(`Stayed in by ${stayedBy}`);
        return {
          hotelName: r.hotelName,
          city: r.city,
          imageUrl: r.imageUrl,
          score: r.score,
          reasons: Array.from(r.reasons),
          source: r.source,
          stayedBy: stayedBy || undefined,
          stayedByUsers: usersArr,
        };
      });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 10);
  }

  async getSiteSetting(key: string): Promise<string | null> {
    const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, key));
    return row?.value ?? null;
  }

  async getAllSiteSettings(): Promise<Record<string, string>> {
    const rows = await db.select().from(siteSettings);
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  async setSiteSetting(key: string, value: string): Promise<void> {
    const [existing] = await db.select().from(siteSettings).where(eq(siteSettings.key, key));
    if (existing) {
      await db.update(siteSettings).set({ value }).where(eq(siteSettings.key, key));
    } else {
      await db.insert(siteSettings).values({ key, value });
    }
  }

  async deleteSiteSetting(key: string): Promise<void> {
    await db.delete(siteSettings).where(eq(siteSettings.key, key));
  }
}

export const storage = new DatabaseStorage();
