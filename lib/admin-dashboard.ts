import { prisma } from "./prisma";
import type { AdminEventStatus, AdminEventType } from "./admin-event-log";
import { formatSeoulDate, getSeoulDateKey } from "./seoul-time";

export type AdminCalendarType = "solar" | "lunar" | "unknown" | "other";
export type AdminShareStatus = "all" | "active" | "expired";
export type AdminLogStatusFilter = "all" | AdminEventStatus;
export type AdminLogEventTypeFilter = "all" | AdminEventType;

export type AdminUserListItem = {
  userId: string;
  name: string | null;
  calendarType: string;
  createdAt: Date;
  updatedAt: Date;
  questionUsageCountToday: number;
  shareRewardCountToday: number;
  pendingQuestionInput: boolean;
  todayQuestionUsed: boolean;
};

export type AdminUserDetail = AdminUserListItem & {
  birthDate: Date;
  hasBirthTime: boolean;
  pendingQuestionExpiresAt: Date | null;
  shareSnapshotCount: number;
};

export type AdminShareListItem = {
  snapshotId: string;
  userId: string;
  displayName: string;
  targetDateKey: string;
  createdAt: Date;
  expiresAt: Date;
  status: Exclude<AdminShareStatus, "all">;
};

export type AdminOverview = {
  todayKey: string;
  todayLabel: string;
  registrationsToday: number;
  updatesToday: number;
  sharesToday: number;
  activeShares: number;
  expiredShares: number;
  pendingQuestionUsers: number;
  calendarTypeCounts: Record<AdminCalendarType, number>;
  recentUsers: AdminUserListItem[];
  recentShares: AdminShareListItem[];
  recentLogs: AdminEventLogListItem[];
};

export type AdminUserPage = {
  items: AdminUserListItem[];
  page: number;
  hasNext: boolean;
};

export type AdminSharePage = {
  items: AdminShareListItem[];
  page: number;
  hasNext: boolean;
};

export type AdminEventLogListItem = {
  id: string;
  eventType: AdminEventType;
  status: AdminEventStatus;
  source: string;
  userId: string | null;
  message: string;
  questionText: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

export type AdminLogPage = {
  items: AdminEventLogListItem[];
  page: number;
  hasNext: boolean;
};

type AdminEventLogRow = {
  id: string;
  eventType: string;
  status: string;
  source: string;
  userId: string | null;
  message: string;
  questionText: string | null;
  metadata: unknown;
  createdAt: Date;
};

type AdminEventLogModel = {
  findMany(args: {
    where?: {
      eventType?: string;
      status?: string;
      userId?: { contains: string; mode: "insensitive" };
    };
    take: number;
    skip?: number;
    orderBy: { createdAt: "desc" };
    select: {
      id: true;
      eventType: true;
      status: true;
      source: true;
      userId: true;
      message: true;
      questionText: true;
      metadata: true;
      createdAt: true;
    };
  }): Promise<AdminEventLogRow[]>;
};

function getAdminEventLogModel(): AdminEventLogModel | null {
  return (prisma as unknown as { adminEventLog?: AdminEventLogModel }).adminEventLog ?? null;
}

function getSeoulDayWindow(date: Date = new Date()): { dateKey: string; start: Date; end: Date } {
  const dateKey = getSeoulDateKey(date);
  const start = new Date(`${dateKey}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { dateKey, start, end };
}

function toTodayCount(dateKey: string | null, count: number | null, todayKey: string): number {
  if (dateKey !== todayKey || !Number.isFinite(count)) {
    return 0;
  }

  return Math.max(0, Number(count));
}

function toPendingState(enabled: boolean, expiresAt: Date | null, now: Date): boolean {
  return enabled && Boolean(expiresAt && expiresAt.getTime() > now.getTime());
}

function normalizeCalendarCount(
  rows: Array<{ calendarType: string; _count: { _all: number } }>,
): Record<AdminCalendarType, number> {
  const counts: Record<AdminCalendarType, number> = {
    solar: 0,
    lunar: 0,
    unknown: 0,
    other: 0,
  };

  rows.forEach((row) => {
    if (row.calendarType === "solar" || row.calendarType === "lunar" || row.calendarType === "unknown") {
      counts[row.calendarType] += row._count._all;
      return;
    }

    counts.other += row._count._all;
  });

  return counts;
}

function extractDisplayName(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "알 수 없음";
  }

  const value = (payload as Record<string, unknown>).displayName;
  return typeof value === "string" && value.trim() ? value.trim() : "알 수 없음";
}

function toAdminUserListItem(
  row: {
    userId: string;
    name: string | null;
    calendarType: string;
    createdAt: Date;
    updatedAt: Date;
    questionUsageDateKey: string | null;
    questionUsageCount: number;
    shareRewardDateKey: string | null;
    shareRewardCount: number;
    pendingQuestionInput: boolean;
    pendingQuestionExpiresAt: Date | null;
  },
  params: { todayKey: string; now: Date },
): AdminUserListItem {
  const questionUsageCountToday = toTodayCount(
    row.questionUsageDateKey,
    row.questionUsageCount,
    params.todayKey,
  );
  const shareRewardCountToday = toTodayCount(
    row.shareRewardDateKey,
    row.shareRewardCount,
    params.todayKey,
  );

  return {
    userId: row.userId,
    name: row.name,
    calendarType: row.calendarType,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    questionUsageCountToday,
    shareRewardCountToday,
    pendingQuestionInput: toPendingState(
      row.pendingQuestionInput,
      row.pendingQuestionExpiresAt,
      params.now,
    ),
    todayQuestionUsed: questionUsageCountToday > 0,
  };
}

function toAdminShareListItem(
  row: {
    id: string;
    userId: string;
    targetDateKey: string;
    createdAt: Date;
    expiresAt: Date;
    payload: unknown;
  },
  now: Date,
): AdminShareListItem {
  return {
    snapshotId: row.id,
    userId: row.userId,
    displayName: extractDisplayName(row.payload),
    targetDateKey: row.targetDateKey,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    status: row.expiresAt.getTime() > now.getTime() ? "active" : "expired",
  };
}

function toAdminEventLogListItem(row: {
  id: string;
  eventType: string;
  status: string;
  source: string;
  userId: string | null;
  message: string;
  questionText: string | null;
  metadata: unknown;
  createdAt: Date;
}): AdminEventLogListItem {
  return {
    id: row.id,
    eventType: row.eventType as AdminEventType,
    status: row.status as AdminEventStatus,
    source: row.source,
    userId: row.userId,
    message: row.message,
    questionText: row.questionText,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
    createdAt: row.createdAt,
  };
}

export async function getAdminOverview(date: Date = new Date()): Promise<AdminOverview> {
  const now = date;
  const { dateKey, start, end } = getSeoulDayWindow(date);
  const adminEventLogModel = getAdminEventLogModel();
  const [
    registrationsToday,
    updatesToday,
    sharesToday,
    activeShares,
    expiredShares,
    pendingQuestionUsers,
    calendarTypeCounts,
    recentUsers,
    recentShares,
    recentLogs,
  ] = await Promise.all([
    prisma.sajuProfile.count({
      where: {
        createdAt: { gte: start, lt: end },
      },
    }),
    prisma.sajuProfile.count({
      where: {
        updatedAt: { gte: start, lt: end },
      },
    }),
    prisma.fortuneShareSnapshot.count({
      where: {
        createdAt: { gte: start, lt: end },
      },
    }),
    prisma.fortuneShareSnapshot.count({
      where: {
        expiresAt: { gt: now },
      },
    }),
    prisma.fortuneShareSnapshot.count({
      where: {
        expiresAt: { lte: now },
      },
    }),
    prisma.sajuProfile.count({
      where: {
        pendingQuestionInput: true,
        pendingQuestionExpiresAt: { gt: now },
      },
    }),
    prisma.sajuProfile.groupBy({
      by: ["calendarType"],
      _count: {
        _all: true,
      },
    }),
    prisma.sajuProfile.findMany({
      take: 10,
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        userId: true,
        name: true,
        calendarType: true,
        createdAt: true,
        updatedAt: true,
        questionUsageDateKey: true,
        questionUsageCount: true,
        shareRewardDateKey: true,
        shareRewardCount: true,
        pendingQuestionInput: true,
        pendingQuestionExpiresAt: true,
      },
    }),
    prisma.fortuneShareSnapshot.findMany({
      take: 10,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        userId: true,
        targetDateKey: true,
        createdAt: true,
        expiresAt: true,
        payload: true,
      },
    }),
    adminEventLogModel
      ? adminEventLogModel.findMany({
          take: 10,
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            eventType: true,
            status: true,
            source: true,
            userId: true,
            message: true,
            questionText: true,
            metadata: true,
            createdAt: true,
          },
        })
      : Promise.resolve([] as AdminEventLogRow[]),
  ]);

  return {
    todayKey: dateKey,
    todayLabel: formatSeoulDate(date, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    }),
    registrationsToday,
    updatesToday,
    sharesToday,
    activeShares,
    expiredShares,
    pendingQuestionUsers,
    calendarTypeCounts: normalizeCalendarCount(calendarTypeCounts),
    recentUsers: recentUsers.map((row: (typeof recentUsers)[number]) => toAdminUserListItem(row, { todayKey: dateKey, now })),
    recentShares: recentShares.map((row: (typeof recentShares)[number]) => toAdminShareListItem(row, now)),
    recentLogs: recentLogs.map(toAdminEventLogListItem),
  };
}

export async function getAdminUsersPage(params?: {
  q?: string;
  page?: number;
  pageSize?: number;
  date?: Date;
}): Promise<AdminUserPage> {
  const page = Math.max(1, params?.page ?? 1);
  const pageSize = Math.max(1, Math.min(params?.pageSize ?? 12, 50));
  const todayKey = getSeoulDateKey(params?.date ?? new Date());
  const now = params?.date ?? new Date();
  const q = params?.q?.trim();
  const where = q
    ? {
        OR: [
          { userId: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const rows = await prisma.sajuProfile.findMany({
    where,
    take: pageSize + 1,
    skip: (page - 1) * pageSize,
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      userId: true,
      name: true,
      calendarType: true,
      createdAt: true,
      updatedAt: true,
      questionUsageDateKey: true,
      questionUsageCount: true,
      shareRewardDateKey: true,
      shareRewardCount: true,
      pendingQuestionInput: true,
      pendingQuestionExpiresAt: true,
    },
  });

  return {
    items: rows.slice(0, pageSize).map((row) => toAdminUserListItem(row, { todayKey, now })),
    page,
    hasNext: rows.length > pageSize,
  };
}

export async function getAdminUserDetail(
  userId: string,
  date: Date = new Date(),
): Promise<AdminUserDetail | null> {
  const todayKey = getSeoulDateKey(date);
  const row = await prisma.sajuProfile.findUnique({
    where: { userId },
    select: {
      userId: true,
      name: true,
      birthDate: true,
      birthTime: true,
      calendarType: true,
      createdAt: true,
      updatedAt: true,
      questionUsageDateKey: true,
      questionUsageCount: true,
      shareRewardDateKey: true,
      shareRewardCount: true,
      pendingQuestionInput: true,
      pendingQuestionExpiresAt: true,
      _count: {
        select: {
          shareSnapshots: true,
        },
      },
    },
  });

  if (!row) {
    return null;
  }

  const item = toAdminUserListItem(row, { todayKey, now: date });
  return {
    ...item,
    birthDate: row.birthDate,
    hasBirthTime: Boolean(row.birthTime),
    pendingQuestionExpiresAt: row.pendingQuestionExpiresAt,
    shareSnapshotCount: row._count.shareSnapshots,
  };
}

export async function getAdminSharesPage(params?: {
  status?: AdminShareStatus;
  page?: number;
  pageSize?: number;
  date?: Date;
}): Promise<AdminSharePage> {
  const page = Math.max(1, params?.page ?? 1);
  const pageSize = Math.max(1, Math.min(params?.pageSize ?? 12, 50));
  const now = params?.date ?? new Date();
  const status = params?.status ?? "all";
  const where =
    status === "active"
      ? { expiresAt: { gt: now } }
      : status === "expired"
        ? { expiresAt: { lte: now } }
        : undefined;

  const rows = await prisma.fortuneShareSnapshot.findMany({
    where,
    take: pageSize + 1,
    skip: (page - 1) * pageSize,
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      userId: true,
      targetDateKey: true,
      createdAt: true,
      expiresAt: true,
      payload: true,
    },
  });

  return {
    items: rows.slice(0, pageSize).map((row) => toAdminShareListItem(row, now)),
    page,
    hasNext: rows.length > pageSize,
  };
}

export async function getRecentAdminEventLogs(limit = 10): Promise<AdminEventLogListItem[]> {
  const model = getAdminEventLogModel();
  if (!model) {
    return [];
  }

  const rows = await model.findMany({
    take: Math.max(1, Math.min(limit, 50)),
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      eventType: true,
      status: true,
      source: true,
      userId: true,
      message: true,
      questionText: true,
      metadata: true,
      createdAt: true,
    },
  });

  return rows.map(toAdminEventLogListItem);
}

export async function getAdminLogsPage(params?: {
  eventType?: AdminLogEventTypeFilter;
  status?: AdminLogStatusFilter;
  userId?: string;
  page?: number;
  pageSize?: number;
}): Promise<AdminLogPage> {
  const model = getAdminEventLogModel();
  if (!model) {
    return {
      items: [],
      page: Math.max(1, params?.page ?? 1),
      hasNext: false,
    };
  }

  const page = Math.max(1, params?.page ?? 1);
  const pageSize = Math.max(1, Math.min(params?.pageSize ?? 12, 50));
  const userId = params?.userId?.trim();
  const where = {
    ...(params?.eventType && params.eventType !== "all" ? { eventType: params.eventType } : {}),
    ...(params?.status && params.status !== "all" ? { status: params.status } : {}),
    ...(userId ? { userId: { contains: userId, mode: "insensitive" as const } } : {}),
  };

  const rows = await model.findMany({
    where,
    take: pageSize + 1,
    skip: (page - 1) * pageSize,
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      eventType: true,
      status: true,
      source: true,
      userId: true,
      message: true,
      questionText: true,
      metadata: true,
      createdAt: true,
    },
  });

  return {
    items: rows.slice(0, pageSize).map(toAdminEventLogListItem),
    page,
    hasNext: rows.length > pageSize,
  };
}
