import React from "react";
import Link from "next/link";
import {
  getAdminLogsPage,
  type AdminLogEventTypeFilter,
  type AdminLogStatusFilter,
} from "../../../../lib/admin-dashboard";
import { truncateAdminIdentifier } from "../../../../lib/admin-display";
import { hasDatabaseUrl } from "../../../../lib/profile";
import { formatSeoulDate } from "../../../../lib/seoul-time";
import styles from "../../admin.module.css";

type LogsPageProps = {
  searchParams?: {
    eventType?: string;
    status?: string;
    userId?: string;
    page?: string;
    logId?: string;
  };
};

function parsePage(value?: string): number {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function parseEventType(value?: string): AdminLogEventTypeFilter {
  const allowed: AdminLogEventTypeFilter[] = [
    "all",
    "question_answered",
    "share_created",
    "profile_registration_failed",
    "kakao_request_failed",
    "openai_question_fallback",
    "openai_fortune_fallback",
  ];
  return allowed.includes(value as AdminLogEventTypeFilter) ? (value as AdminLogEventTypeFilter) : "all";
}

function parseStatus(value?: string): AdminLogStatusFilter {
  const allowed: AdminLogStatusFilter[] = ["all", "success", "fallback", "error"];
  return allowed.includes(value as AdminLogStatusFilter) ? (value as AdminLogStatusFilter) : "all";
}

function buildLogsHref(params: {
  eventType: AdminLogEventTypeFilter;
  status: AdminLogStatusFilter;
  userId?: string;
  page: number;
  logId?: string;
}): string {
  const search = new URLSearchParams();
  if (params.eventType !== "all") search.set("eventType", params.eventType);
  if (params.status !== "all") search.set("status", params.status);
  if (params.userId) search.set("userId", params.userId);
  if (params.page > 1) search.set("page", String(params.page));
  if (params.logId) search.set("logId", params.logId);
  const query = search.toString();
  return query ? `/admin/logs?${query}` : "/admin/logs";
}

export default async function AdminLogsPage({ searchParams }: LogsPageProps) {
  if (!hasDatabaseUrl()) {
    return (
      <section className={styles.noticeBox}>
        DATABASE_URL 또는 POSTGRES_PRISMA_URL이 설정되지 않아 운영 로그를 불러올 수 없습니다.
      </section>
    );
  }

  const eventType = parseEventType(searchParams?.eventType);
  const status = parseStatus(searchParams?.status);
  const userId = searchParams?.userId?.trim() ?? "";
  const page = parsePage(searchParams?.page);
  const selectedLogId = searchParams?.logId?.trim();
  const logs = await getAdminLogsPage({ eventType, status, userId, page });
  const selectedLog = logs.items.find((item) => item.id === selectedLogId) ?? logs.items[0] ?? null;

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>운영 로그</h2>
          <p className={styles.sectionMeta}>핵심 이벤트 추적과 필터 조회</p>
        </div>
      </div>

      <form method="get" className={styles.toolbar}>
        <div className={styles.toolbarField}>
          <label htmlFor="eventType" className={styles.label}>
            eventType
          </label>
          <select id="eventType" name="eventType" defaultValue={eventType} className={styles.select}>
            <option value="all">all</option>
            <option value="question_answered">question_answered</option>
            <option value="share_created">share_created</option>
            <option value="profile_registration_failed">profile_registration_failed</option>
            <option value="kakao_request_failed">kakao_request_failed</option>
            <option value="openai_question_fallback">openai_question_fallback</option>
            <option value="openai_fortune_fallback">openai_fortune_fallback</option>
          </select>
        </div>
        <div className={styles.toolbarField}>
          <label htmlFor="status" className={styles.label}>
            status
          </label>
          <select id="status" name="status" defaultValue={status} className={styles.select}>
            <option value="all">all</option>
            <option value="success">success</option>
            <option value="fallback">fallback</option>
            <option value="error">error</option>
          </select>
        </div>
        <div className={styles.toolbarField}>
          <label htmlFor="userId" className={styles.label}>
            userId
          </label>
          <input id="userId" name="userId" defaultValue={userId} className={styles.input} placeholder="userId" />
        </div>
        <div className={styles.toolbarActions}>
          <button type="submit" className={styles.button}>
            적용
          </button>
          <Link href="/admin/logs" className={styles.ghostButton}>
            초기화
          </Link>
        </div>
      </form>

      {logs.items.length === 0 ? (
        <div className={styles.emptyBox}>조건에 맞는 운영 로그가 없습니다.</div>
      ) : (
        <div className={styles.splitLayout}>
          <div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>시각</th>
                    <th>eventType</th>
                    <th>status</th>
                    <th>userId</th>
                    <th>message</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.items.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <Link
                          href={buildLogsHref({ eventType, status, userId, page, logId: log.id })}
                          className={styles.tableLink}
                        >
                          {formatSeoulDate(log.createdAt, {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Link>
                      </td>
                      <td>{log.eventType}</td>
                      <td>
                        <span
                          className={
                            log.status === "success"
                              ? styles.badgeActive
                              : log.status === "fallback"
                                ? styles.badgeMuted
                                : styles.badgeWarning
                          }
                        >
                          {log.status}
                        </span>
                      </td>
                      <td>
                        {log.userId ? (
                          <span className={styles.codeText} title={log.userId}>
                            {truncateAdminIdentifier(log.userId)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.pagination}>
              <span className={styles.paginationInfo}>페이지 {logs.page}</span>
              {page > 1 ? (
                <Link href={buildLogsHref({ eventType, status, userId, page: page - 1 })} className={styles.ghostButton}>
                  이전
                </Link>
              ) : null}
              {logs.hasNext ? (
                <Link href={buildLogsHref({ eventType, status, userId, page: page + 1 })} className={styles.ghostButton}>
                  다음
                </Link>
              ) : null}
            </div>
          </div>

          <aside className={styles.detailCard}>
            <p className={styles.eyebrow}>Log Detail</p>
            <h3 className={styles.sectionTitle}>{selectedLog ? selectedLog.eventType : "로그 선택"}</h3>
            {!selectedLog ? (
              <p className={styles.sectionMeta}>테이블에서 항목을 선택하면 상세 로그가 표시됩니다.</p>
            ) : (
              <>
                <p className={styles.sectionMeta}>{selectedLog.message}</p>
                <dl className={styles.detailList}>
                  <div className={styles.detailRow}>
                    <dt>status</dt>
                    <dd>{selectedLog.status}</dd>
                  </div>
                  <div className={styles.detailRow}>
                    <dt>source</dt>
                    <dd>{selectedLog.source}</dd>
                  </div>
                  <div className={styles.detailRow}>
                    <dt>userId</dt>
                    <dd className={styles.codeText}>{selectedLog.userId ?? "-"}</dd>
                  </div>
                  <div className={styles.detailRow}>
                    <dt>createdAt</dt>
                    <dd>{formatSeoulDate(selectedLog.createdAt, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</dd>
                  </div>
                </dl>
                <div className={styles.detailList}>
                  <div>
                    <p className={styles.label}>questionText</p>
                    <div className={styles.logBlock}>{selectedLog.questionText ?? "-"}</div>
                  </div>
                  <div>
                    <p className={styles.label}>metadata</p>
                    <pre className={styles.logBlock}>
                      {selectedLog.metadata ? JSON.stringify(selectedLog.metadata, null, 2) : "-"}
                    </pre>
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
