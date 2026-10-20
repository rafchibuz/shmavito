import crypto from "node:crypto";
import nextEnv from "@next/env";
import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { SignJWT } from "jose";

nextEnv.loadEnvConfig(process.cwd());

const db = new PrismaClient();
const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const origin = new URL(baseUrl).origin;
const runId = crypto.randomUUID().slice(0, 8);
const createdCommentIds = [];
const createdReportIds = [];
const createdUserIds = [];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function sessionToken(userId) {
  const secret = process.env.AUTH_SECRET;
  invariant(secret && secret.length >= 32, "AUTH_SECRET must contain at least 32 characters");
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(secret));
}

async function request(path, { token, method = "GET", body, expected = 200 } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { cookie: `shmavito_session=${token}` } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
      ...(method === "GET" ? {} : { origin }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  invariant(
    response.status === expected,
    `${method} ${path}: expected ${expected}, received ${response.status} ${JSON.stringify(payload)}`,
  );
  return payload;
}

async function cleanup() {
  if (createdReportIds.length) {
    await db.auditLog.deleteMany({ where: { targetType: "Report", targetId: { in: createdReportIds } } });
    await db.report.deleteMany({ where: { id: { in: createdReportIds } } });
  }
  if (createdCommentIds.length) {
    await db.notification.deleteMany({
      where: {
        OR: createdCommentIds.map((commentId) => ({ payload: { path: ["commentId"], equals: commentId } })),
      },
    });
    await db.comment.deleteMany({ where: { id: { in: createdCommentIds } } });
  }
  if (createdUserIds.length) {
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
}

async function main() {
  const publicCatalog = await request("/api/listings");
  invariant(publicCatalog.viewer === null, "Public catalog unexpectedly has an authenticated viewer");
  invariant(publicCatalog.listings.length > 0, "Smoke test requires at least one published listing");
  const listing = publicCatalog.listings[0];

  const [viewer, moderator] = await Promise.all([
    db.user.create({
      data: {
        twitchId: `smoke-viewer-${runId}`,
        login: `smoke_viewer_${runId}`,
        displayName: "Smoke Viewer",
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
    }),
    db.user.create({
      data: {
        twitchId: `smoke-moderator-${runId}`,
        login: `smoke_moderator_${runId}`,
        displayName: "Smoke Moderator",
        role: UserRole.MODERATOR,
        status: UserStatus.ACTIVE,
      },
    }),
  ]);
  createdUserIds.push(viewer.id, moderator.id);

  const [viewerToken, moderatorToken] = await Promise.all([
    sessionToken(viewer.id),
    sessionToken(moderator.id),
  ]);

  const authenticatedCatalog = await request("/api/listings", { token: viewerToken });
  invariant(authenticatedCatalog.viewer?.id === viewer.id, "Authenticated viewer was not returned");

  const firstView = await request(`/api/listings/${listing.id}/view`, { token: viewerToken, method: "POST" });
  invariant(firstView.viewed === true && firstView.openCount === 1, "First view was not registered");

  const liked = await request(`/api/listings/${listing.id}/like`, { token: viewerToken, method: "POST" });
  invariant(liked.liked === true, "Like was not added");
  const unliked = await request(`/api/listings/${listing.id}/like`, { token: viewerToken, method: "POST" });
  invariant(unliked.liked === false, "Like was not removed");

  const author = await db.user.findUnique({ where: { id: listing.author.id } });
  invariant(author, "Listing author was not found");
  await request(`/api/listings/${listing.id}/like`, {
    token: await sessionToken(author.id),
    method: "POST",
    expected: 409,
  });

  const root = await request(`/api/listings/${listing.id}/comments`, {
    token: viewerToken,
    method: "POST",
    body: { body: `Smoke comment ${runId}` },
    expected: 201,
  });
  createdCommentIds.push(root.comment.id);

  const reply = await request(`/api/listings/${listing.id}/comments`, {
    token: moderatorToken,
    method: "POST",
    body: { body: `Smoke reply ${runId}`, parentId: root.comment.id },
    expected: 201,
  });
  createdCommentIds.unshift(reply.comment.id);

  const comments = await request(`/api/listings/${listing.id}/comments`);
  invariant(comments.comments.some((comment) => comment.id === root.comment.id), "Root comment is absent");
  invariant(comments.comments.some((comment) => comment.id === reply.comment.id), "Reply is absent");
  const replyNotification = await db.notification.findFirst({
    where: { userId: viewer.id, type: "comment.reply" },
  });
  invariant(replyNotification, "Reply notification was not created");

  const listingReport = await request("/api/reports", {
    token: viewerToken,
    method: "POST",
    body: { targetType: "listing", targetId: listing.id, reason: `Smoke listing report ${runId}` },
    expected: 201,
  });
  createdReportIds.push(listingReport.report.id);
  await request("/api/reports", {
    token: viewerToken,
    method: "POST",
    body: { targetType: "listing", targetId: listing.id, reason: `Duplicate smoke report ${runId}` },
    expected: 409,
  });

  const commentReport = await request("/api/reports", {
    token: viewerToken,
    method: "POST",
    body: { targetType: "comment", targetId: reply.comment.id, reason: `Smoke comment report ${runId}` },
    expected: 201,
  });
  createdReportIds.push(commentReport.report.id);

  const queue = await request("/api/admin/reports?status=OPEN", { token: moderatorToken });
  invariant(
    createdReportIds.every((id) => queue.reports.some((report) => report.id === id)),
    "Moderator queue does not contain all smoke reports",
  );

  await request(`/api/admin/reports/${listingReport.report.id}`, {
    token: moderatorToken,
    method: "PATCH",
    body: { status: "RESOLVED" },
  });
  await request(`/api/admin/reports/${commentReport.report.id}`, {
    token: moderatorToken,
    method: "PATCH",
    body: { status: "DISMISSED" },
  });

  const auditCount = await db.auditLog.count({
    where: { targetType: "Report", targetId: { in: createdReportIds } },
  });
  invariant(auditCount === 2, "Report decisions were not fully audited");

  console.log("Smoke test passed: catalog, auth session, views, likes, comments, replies, notifications, reports, moderation.");
}

try {
  await main();
} finally {
  await cleanup();
  await db.$disconnect();
}
