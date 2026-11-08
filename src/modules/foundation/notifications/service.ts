import { prisma } from "@/lib/prisma";
import type { AppSession } from "@/core/auth/session";

export async function listNotifications(session: AppSession, onlyUnread = false, take = 50) {
  return prisma.notification.findMany({ where: { userId: session.userId, ...(onlyUnread ? { isRead: false } : {}) }, orderBy: { createdAt: "desc" }, take });
}

export async function markRead(session: AppSession, id: string | "all") {
  if (id === "all") {
    await prisma.notification.updateMany({ where: { userId: session.userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
    return true;
  }
  await prisma.notification.updateMany({ where: { id, userId: session.userId }, data: { isRead: true, readAt: new Date() } });
  return true;
}
