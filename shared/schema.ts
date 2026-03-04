import { pgTable, text, serial, integer, boolean, timestamp, varchar, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export const entries = pgTable("hotels", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  hotelName: text("hotel_name").notNull(),
  city: text("city").notNull(),
  majorCity: text("major_city"),
  suburb: text("suburb"),
  country: text("country"),
  placeId: text("place_id"),
  rating: integer("rating").notNull().default(3),
  hasSpa: boolean("has_spa").notNull().default(false),
  hasConcierge: boolean("has_concierge").notNull().default(false),
  hasGym: boolean("has_gym").notNull().default(false),
  hasPool: boolean("has_pool").notNull().default(false),
  hasRestaurant: boolean("has_restaurant").notNull().default(false),
  hasMichelinGuide: boolean("has_michelin_guide").notNull().default(false),
  hasMichelinStar: boolean("has_michelin_star").notNull().default(false),
  hasForbesTravelGuide: boolean("has_forbes_travel_guide").notNull().default(false),
  hasOceanView: boolean("has_ocean_view").notNull().default(false),
  hasCocktailBar: boolean("has_cocktail_bar").notNull().default(false),
  hasDesignForward: boolean("has_design_forward").notNull().default(false),
  hasLateNightDining: boolean("has_late_night_dining").notNull().default(false),
  hasRooftop: boolean("has_rooftop").notNull().default(false),
  dateOfStay: text("date_of_stay"),
  imageUrl: text("image_url"),
  googlePhotoUrl: text("google_photo_url"),
  notes: text("notes"),
  sortPriority: integer("sort_priority").notNull().default(0),
  isSeed: boolean("is_seed").notNull().default(false),
});

export const insertEntrySchema = createInsertSchema(entries).omit({
  id: true,
  isSeed: true,
}).extend({
  rating: z.coerce.number().min(1).max(5),
  sortPriority: z.coerce.number(),
  userId: z.string().optional().nullable(),
  majorCity: z.string().optional().nullable(),
  suburb: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  placeId: z.string().optional().nullable(),
  googlePhotoUrl: z.string().optional().nullable(),
});

export type Entry = typeof entries.$inferSelect;
export type InsertEntry = z.infer<typeof insertEntrySchema>;

export type CreateEntryRequest = InsertEntry;
export type UpdateEntryRequest = Partial<InsertEntry>;

export type EntryResponse = Entry;
export type EntriesListResponse = Entry[];

export const wishlistItems = pgTable("wishlist", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  hotelName: text("hotel_name").notNull(),
  city: text("city").notNull(),
  majorCity: text("major_city"),
  suburb: text("suburb"),
  country: text("country"),
  placeId: text("place_id"),
  imageUrl: text("image_url"),
  googlePhotoUrl: text("google_photo_url"),
  sortPriority: integer("sort_priority").notNull().default(0),
  matchSlug: text("match_slug"),
});

export function generateMatchSlug(hotelName: string, city: string): string {
  const slugPart = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${slugPart(hotelName)}-${slugPart(city)}`;
}

export const insertWishlistSchema = createInsertSchema(wishlistItems).omit({
  id: true,
  matchSlug: true,
}).extend({
  sortPriority: z.coerce.number(),
  userId: z.string().optional().nullable(),
  majorCity: z.string().optional().nullable(),
  suburb: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  placeId: z.string().optional().nullable(),
  googlePhotoUrl: z.string().optional().nullable(),
});

export type WishlistItem = typeof wishlistItems.$inferSelect;
export type InsertWishlistItem = z.infer<typeof insertWishlistSchema>;

export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: varchar("follower_id").notNull().references(() => users.id),
  followingId: varchar("following_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("unique_follow").on(table.followerId, table.followingId),
]);

export const insertFollowSchema = createInsertSchema(follows).omit({
  id: true,
  createdAt: true,
});

export type Follow = typeof follows.$inferSelect;
export type InsertFollow = z.infer<typeof insertFollowSchema>;

export const tripPlans = pgTable("trip_plans", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  tripDate: text("trip_date"),
  startDate: text("start_date"),
  cities: text("cities").array(),
  totalDays: integer("total_days").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTripPlanSchema = createInsertSchema(tripPlans).omit({
  id: true,
  createdAt: true,
}).extend({
  tripDate: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  cities: z.array(z.string()).optional().nullable(),
  totalDays: z.coerce.number().min(1).max(30).optional(),
});

export type TripPlan = typeof tripPlans.$inferSelect;
export type InsertTripPlan = z.infer<typeof insertTripPlanSchema>;

export const tripDays = pgTable("trip_days", {
  id: serial("id").primaryKey(),
  tripPlanId: integer("trip_plan_id").notNull().references(() => tripPlans.id, { onDelete: "cascade" }),
  dayNumber: integer("day_number").notNull(),
  hotelName: text("hotel_name").notNull(),
  city: text("city").notNull(),
  majorCity: text("major_city"),
  suburb: text("suburb"),
  country: text("country"),
  placeId: text("place_id"),
  imageUrl: text("image_url"),
  googlePhotoUrl: text("google_photo_url"),
  notes: text("notes"),
  vettedByUserId: text("vetted_by_user_id"),
  sortPriority: integer("sort_priority").notNull().default(0),
});

export const insertTripDaySchema = createInsertSchema(tripDays).omit({
  id: true,
}).extend({
  sortPriority: z.coerce.number(),
});

export type TripDay = typeof tripDays.$inferSelect;
export type InsertTripDay = z.infer<typeof insertTripDaySchema>;

export const tripItineraryItems = pgTable("trip_itinerary_items", {
  id: serial("id").primaryKey(),
  tripPlanId: integer("trip_plan_id").notNull().references(() => tripPlans.id, { onDelete: "cascade" }),
  dayNumber: integer("day_number").notNull(),
  itemType: text("item_type").notNull(),
  title: text("title").notNull(),
  url: text("url"),
  notes: text("notes"),
  placeId: text("place_id"),
  googlePhotoUrl: text("google_photo_url"),
  timeOfDay: text("time_of_day"),
  sortPriority: integer("sort_priority").notNull().default(0),
});

export const insertTripItineraryItemSchema = createInsertSchema(tripItineraryItems).omit({
  id: true,
}).extend({
  sortPriority: z.coerce.number(),
  placeId: z.string().optional().nullable(),
  googlePhotoUrl: z.string().optional().nullable(),
  timeOfDay: z.string().optional().nullable(),
});

export type TripItineraryItem = typeof tripItineraryItems.$inferSelect;
export type InsertTripItineraryItem = z.infer<typeof insertTripItineraryItemSchema>;

export const tripWorkspaceItems = pgTable("trip_workspace_items", {
  id: serial("id").primaryKey(),
  tripPlanId: integer("trip_plan_id").notNull().references(() => tripPlans.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  itemType: text("item_type").notNull().default("attraction"),
  category: text("category"),
  neighborhood: text("neighborhood"),
  url: text("url"),
  imageUrl: text("image_url"),
  placeId: text("place_id"),
  googlePhotoUrl: text("google_photo_url"),
  notes: text("notes"),
  sortPriority: integer("sort_priority").notNull().default(0),
});

export const insertTripWorkspaceItemSchema = createInsertSchema(tripWorkspaceItems).omit({
  id: true,
}).extend({
  sortPriority: z.coerce.number().optional().default(0),
  placeId: z.string().optional().nullable(),
  googlePhotoUrl: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  neighborhood: z.string().optional().nullable(),
});

export type TripWorkspaceItem = typeof tripWorkspaceItems.$inferSelect;
export type InsertTripWorkspaceItem = z.infer<typeof insertTripWorkspaceItemSchema>;

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  actorId: varchar("actor_id").references(() => users.id),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export type SiteSetting = typeof siteSettings.$inferSelect;

export * from "./models/auth";
export * from "./models/chat";
