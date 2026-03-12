import React from "react";
import Link from "next/link";
import {
  getAdminSharesPage,
  type AdminShareStatus,
} from "../../../../lib/admin-dashboard";
import { hasDatabaseUrl } from "../../../../lib/profile";
import { formatSeoulDate } from "../../../../lib/seoul-time";
import styles from "../../admin.module.css";

type SharesPageProps = {
  searchParams?: {
    page?: string;
    status?: string;
  };
};

function parsePage(value?: string): number {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function parseStatus(value?: string): AdminShareStatus {
  return value === "active" || value === "expired" ? value : "all";
}

function buildSharesHref(params: { status: AdminShareStatus; page: number }): string {
  const search = new URLSearchParams();
  if (params.status !== "all") {
    search.set("status", params.status);
  }
  if (params.page > 1) {
    search.set("page", String(params.page));
  }
  const query = search.toString();
  return query ? `/admin/shares?${query}` : "/admin/shares";
}

export default async function AdminSharesPage({ searchParams }: SharesPageProps) {
  if (!hasDatabaseUrl()) {
    return (
      <section className={styles.noticeBox}>
        DATABASE_URL 또는 POSTGRES_PRISMA_URL이 설정되지 않아 공유 목록을 불러올 수 없습니다.
      </section>
    );
  }

  const page = parsePage(searchParams?.page);
  const status = parseStatus(searchParams?.status);
  const shares = await getAdminSharesPage({ page, status });

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>공유 스냅샷</h2>
          <p className={styles.sectionMeta}>만료 상태 기준 필터와 최근 생성 이력</p>
        </div>
      </div>

      <form method="get" className={styles.toolbar}>
        <div className={styles.toolbarField}>
          <label htmlFor="status" className={styles.label}>
            상태
          </label>
          <select id="status" name="status" defaultValue={status} className={styles.select}>
            <option value="all">전체</option>
            <option value="active">active</option>
            <option value="expired">expired</option>
          </select>
        </div>
        <div className={styles.toolbarActions}>
          <button type="submit" className={styles.button}>
            적용
          </button>
          <Link href="/admin/shares" className={styles.ghostButton}>
            초기화
          </Link>
        </div>
      </form>

      {shares.items.length === 0 ? (
        <div className={styles.emptyBox}>조건에 맞는 공유 스냅샷이 없습니다.</div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>snapshotId</th>
                  <th>userId</th>
                  <th>이름</th>
                  <th>targetDateKey</th>
                  <th>createdAt</th>
                  <th>expiresAt</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {shares.items.map((share) => (
                  <tr key={share.snapshotId}>
                    <td>{share.snapshotId}</td>
                    <td>{share.userId}</td>
                    <td>{share.displayName}</td>
                    <td>{share.targetDateKey}</td>
                    <td>{formatSeoulDate(share.createdAt)}</td>
                    <td>{formatSeoulDate(share.expiresAt)}</td>
                    <td>
                      <span className={share.status === "active" ? styles.badgeActive : styles.badgeWarning}>
                        {share.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>페이지 {shares.page}</span>
            {page > 1 ? (
              <Link href={buildSharesHref({ status, page: page - 1 })} className={styles.ghostButton}>
                이전
              </Link>
            ) : null}
            {shares.hasNext ? (
              <Link href={buildSharesHref({ status, page: page + 1 })} className={styles.ghostButton}>
                다음
              </Link>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
