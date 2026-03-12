import React from "react";
import { getAdminOverview } from "../../../lib/admin-dashboard";
import { hasDatabaseUrl } from "../../../lib/profile";
import { formatSeoulDate } from "../../../lib/seoul-time";
import styles from "../admin.module.css";

function renderCalendarTypeLabel(value: string): string {
  if (value === "solar") return "양력";
  if (value === "lunar") return "음력";
  if (value === "unknown") return "모름";
  return "기타";
}

export default async function AdminOverviewPage() {
  if (!hasDatabaseUrl()) {
    return (
      <section className={styles.noticeBox}>
        DATABASE_URL 또는 POSTGRES_PRISMA_URL이 설정되지 않아 관리자 집계를 불러올 수 없습니다.
      </section>
    );
  }

  const overview = await getAdminOverview();

  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>오늘 핵심 지표</h2>
            <p className={styles.sectionMeta}>{overview.todayLabel}</p>
          </div>
        </div>

        <div className={styles.kpiGrid}>
          <article className={styles.kpiCard}>
            <p className={styles.kpiLabel}>신규 등록</p>
            <p className={styles.kpiValue}>{overview.registrationsToday}</p>
          </article>
          <article className={styles.kpiCard}>
            <p className={styles.kpiLabel}>프로필 업데이트</p>
            <p className={styles.kpiValue}>{overview.updatesToday}</p>
          </article>
          <article className={styles.kpiCard}>
            <p className={styles.kpiLabel}>공유 생성</p>
            <p className={styles.kpiValue}>{overview.sharesToday}</p>
          </article>
          <article className={styles.kpiCard}>
            <p className={styles.kpiLabel}>활성 공유</p>
            <p className={styles.kpiValue}>{overview.activeShares}</p>
            <p className={styles.kpiMeta}>만료 {overview.expiredShares}</p>
          </article>
        </div>

        <div className={styles.miniKpiGrid}>
          <article className={styles.kpiCard}>
            <p className={styles.kpiLabel}>양력</p>
            <p className={styles.kpiValue}>{overview.calendarTypeCounts.solar}</p>
          </article>
          <article className={styles.kpiCard}>
            <p className={styles.kpiLabel}>음력</p>
            <p className={styles.kpiValue}>{overview.calendarTypeCounts.lunar}</p>
          </article>
          <article className={styles.kpiCard}>
            <p className={styles.kpiLabel}>모름</p>
            <p className={styles.kpiValue}>{overview.calendarTypeCounts.unknown}</p>
          </article>
          <article className={styles.kpiCard}>
            <p className={styles.kpiLabel}>질문 대기</p>
            <p className={styles.kpiValue}>{overview.pendingQuestionUsers}</p>
          </article>
        </div>
      </section>

      <section className={styles.gridTwo}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>최근 사용자</h2>
              <p className={styles.sectionMeta}>최근 수정 기준 10건</p>
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>userId</th>
                  <th>이름</th>
                  <th>달력</th>
                  <th>질문</th>
                  <th>공유 적립</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentUsers.map((user) => (
                  <tr key={user.userId}>
                    <td>{user.userId}</td>
                    <td>{user.name ?? "미입력"}</td>
                    <td>{renderCalendarTypeLabel(user.calendarType)}</td>
                    <td>{user.questionUsageCountToday}</td>
                    <td>{user.shareRewardCountToday}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>최근 공유</h2>
              <p className={styles.sectionMeta}>최근 생성 기준 10건</p>
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>snapshotId</th>
                  <th>userId</th>
                  <th>이름</th>
                  <th>상태</th>
                  <th>생성일</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentShares.map((share) => (
                  <tr key={share.snapshotId}>
                    <td>{share.snapshotId}</td>
                    <td>{share.userId}</td>
                    <td>{share.displayName}</td>
                    <td>
                      <span className={share.status === "active" ? styles.badgeActive : styles.badgeWarning}>
                        {share.status === "active" ? "active" : "expired"}
                      </span>
                    </td>
                    <td>{formatSeoulDate(share.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </>
  );
}
