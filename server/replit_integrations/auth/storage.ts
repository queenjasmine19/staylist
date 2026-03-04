import { users, type User, type UpsertUser } from "@shared/models/auth";
import { follows } from "@shared/schema";
import { db } from "../../db";
import { eq, and, ne, notInArray } from "drizzle-orm";

const ADMIN_EMAIL = "jbacchus19@gmail.com";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const id = userData.id as string;
    const existing = await this.getUser(id);

    if (existing) {
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (userData.email) updates.email = userData.email;
      if (userData.firstName && !existing.firstName) updates.firstName = userData.firstName;
      if (userData.lastName && !existing.lastName) updates.lastName = userData.lastName;
      if (userData.profileImageUrl && !existing.profileImageUrl) updates.profileImageUrl = userData.profileImageUrl;

      const [user] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, id))
        .returning();

      if (user.email === ADMIN_EMAIL) {
        this.adminFollowAllUsers(user.id).catch(() => {});
      }

      return user;
    }

    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();

    if (user.email === ADMIN_EMAIL) {
      this.adminFollowAllUsers(user.id).catch(() => {});
    } else {
      this.autoFollowFromAdmin(user).catch(() => {});
    }

    return user;
  }

  private async adminFollowAllUsers(adminId: string): Promise<void> {
    const alreadyFollowing = await db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, adminId));

    const followedIds = alreadyFollowing.map(f => f.followingId);
    const idsToExclude = [adminId, ...followedIds];

    const unfollowed = await db
      .select({ id: users.id })
      .from(users)
      .where(notInArray(users.id, idsToExclude));

    if (unfollowed.length === 0) return;

    await db.insert(follows).values(
      unfollowed.map(u => ({ followerId: adminId, followingId: u.id }))
    );
  }

  private async autoFollowFromAdmin(newUser: User): Promise<void> {
    if (newUser.email === ADMIN_EMAIL) return;

    const [admin] = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL));
    if (!admin || admin.id === newUser.id) return;

    const [existing] = await db.select().from(follows)
      .where(and(eq(follows.followerId, admin.id), eq(follows.followingId, newUser.id)));
    if (existing) return;

    await db.insert(follows).values({ followerId: admin.id, followingId: newUser.id });
  }
}

export const authStorage = new AuthStorage();
