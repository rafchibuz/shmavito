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
const createdSubmissionIds = [];
const createdListingIds = [];

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
  if (createdListingIds.length) {
    await db.listing.deleteMany({ where: { id: { in: createdListingIds } } });
  }
  if (createdSubmissionIds.length) {
    await db.auditLog.deleteMany({ where: { targetType: "Submission", targetId: { in: createdSubmissionIds } } });
    await db.submission.deleteMany({ where: { id: { in: createdSubmissionIds } } });
  }
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

  const category = await db.category.findFirst({ where: { isVisible: true, deletedAt: null } });
  invariant(category, "Smoke test requires a visible category");
  const smokeSourceUrl = `https://www.avito.ru/moskva/telefony/smoke_${runId}_9999999999`;
  const smokeImages = Array.from(
    { length: 12 },
    (_, index) => `https://00.img.avito.st/image/1/shmavito-${runId}-${index}.jpg`,
  );
  const submissionPayload = await request("/api/submissions", {
    token: viewerToken,
    method: "POST",
    body: {
      sourceUrl: smokeSourceUrl,
      categoryId: category.id,
      title: `Smoke listing ${runId}`,
      originalTitle: `Original Avito title ${runId}`,
      submitterComment: "Worth showing on stream",
      description: "Temporary moderation flow check",
      price: 123456,
      city: "Москва",
      imageUrls: smokeImages,
      importMode: "automatic",
    },
    expected: 201,
  });
  createdSubmissionIds.push(submissionPayload.submission.id);
  const moderationQueue = await request("/api/admin/submissions", { token: moderatorToken });
  const queuedSubmission = moderationQueue.submissions.find((item) => item.id === submissionPayload.submission.id);
  invariant(queuedSubmission?.sourceUrl === smokeSourceUrl, "Moderation queue missed the source URL");
  invariant(queuedSubmission?.rawSnapshot?.title === `Smoke listing ${runId}`, "Moderation queue missed imported fields");
  invariant(queuedSubmission?.rawSnapshot?.originalTitle === `Original Avito title ${runId}`, "Moderation queue missed the original Avito title");
  invariant(queuedSubmission?.rawSnapshot?.submitterComment === "Worth showing on stream", "Moderation queue missed the submitter comment");
  invariant(queuedSubmission?.rawSnapshot?.imageUrls?.length === smokeImages.length, "Moderation queue truncated the gallery");
  const approved = await request(`/api/admin/submissions/${submissionPayload.submission.id}/decision`, {
    token: moderatorToken,
    method: "POST",
    body: {
      decision: "APPROVED",
      categoryId: category.id,
      title: `Smoke listing edited ${runId}`,
      originalTitle: `Original title edited ${runId}`,
      submitterComment: "Moderator checked this comment",
      description: "Edited by moderator",
      price: 120000,
      city: "Москва",
    },
  });
  createdListingIds.push(approved.listing.id);
  const catalogAfterApproval = await request("/api/listings");
  invariant(catalogAfterApproval.listings.some((item) => item.id === approved.listing.id && item.title.includes("edited") && item.originalTitle.includes("edited") && item.submitterComment.includes("Moderator") && item.images?.length === smokeImages.length), "Approved listing copy or its full gallery did not reach the public catalog");
  const overview = await request("/api/admin/overview", { token: moderatorToken });
  invariant(overview.publishedCount >= 1, "Admin overview did not count published listings");
  invariant(Number.isInteger(overview.pendingCount) && Number.isInteger(overview.availabilityErrors24h), "Admin overview returned invalid metrics");

  const authenticatedCatalog = await request("/api/listings", { token: viewerToken });
  invariant(authenticatedCatalog.viewer?.id === viewer.id, "Authenticated viewer was not returned");

  if (process.env.SMOKE_AVITO_IMPORT === "1") {
    const avitoSmokeUrl = process.env.SMOKE_AVITO_URL || listing.sourceUrl;
    const imported = await request("/api/import/avito", {
      token: viewerToken,
      method: "POST",
      body: { sourceUrl: avitoSmokeUrl },
    });
    invariant(imported.mode === "automatic", `Avito import did not finish automatically: ${JSON.stringify(imported)}`);
    invariant(imported.title && imported.description, "Avito import missed title or description");
    invariant(imported.price > 0 && imported.city, "Avito import missed price or city");
    const minimumImages = Math.max(1, Number(process.env.SMOKE_EXPECT_MIN_IMAGES) || 1);
    invariant(imported.imageUrls?.length >= minimumImages, `Avito import returned fewer than ${minimumImages} listing images`);
    console.log(`Avito import passed: ${imported.title}; ${imported.price} ₽; ${imported.city}; ${imported.imageUrls.length} image(s).`);
  }

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
    body: { action: "REMOVE_CONTENT" },
  });
  const removedComment = await db.comment.findUnique({ where: { id: reply.comment.id } });
  invariant(removedComment?.deletedAt, "Reported comment was not soft-deleted");

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
