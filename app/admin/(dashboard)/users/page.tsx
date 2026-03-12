import React from "react";
import Link from "next/link";
import {
  getAdminUserDetail,
  getAdminUsersPage,
  type AdminUserListItem,
} from "../../../../lib/admin-dashboard";
import { hasDatabaseUrl } from "../../../../lib/profile";
import { formatSeoulDate, formatStoredDate } from "../../../../lib/seoul-time";
import styles from "../../admin.module.css";

type UsersPageProps = {
  searchParams?: {
    q?: string;
    page?: string;
    userId?: string;
  };
};

function parsePage(value?: string): number {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function renderCalendarTypeLabel(value: string): string {
  if (value === "solar") return "양력";
  if (value === "lunar") return "음력";
  if (value === "unknown") return "모름";
  return value;
}

function buildUsersPageHref(params: { q?: string; page: number; userId?: string }): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.page > 1) search.set("page", String(params.page));
  if (params.userId) search.set("userId", params.userId);
  const query = search.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}

function renderPendingBadge(user: AdminUserListItem) {
  if (user.pendingQuestionInput) {
    return <span className={styles.badgeWarning}>질문 대기</span>;
  }

  if (user.todayQuestionUsed) {
    return <span className={styles.badgeActive}>오늘 질문 사용</span>;
  }

  return <span className={styles.badgeMuted}>대기 없음</span>;
}

export default async function AdminUsersPage({ searchParams }: UsersPageProps) {
  if (!hasDatabaseUrl()) {
    return (
      <section className={styles.noticeBox}>
        DATABASE_URL 또는 POSTGRES_PRISMA_URL이 설정되지 않아 사용자 목록을 불러올 수 없습니다.
      </section>
    );
  }

  const q = searchParams?.q?.trim() ?? "";
  const page = parsePage(searchParams?.page);
  const selectedUserId = searchParams?.userId?.trim();
  const users = await getAdminUsersPage({ q, page });
  const selectedUser = selectedUserId ? await getAdminUserDetail(selectedUserId) : null;

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>사용자 조회</h2>
          <p className={styles.sectionMeta}>userId와 이름 기준 부분 검색</p>
        </div>
      </div>

      <form method="get" className={styles.toolbar}>
        <div className={styles.toolbarField}>
          <label htmlFor="q" className={styles.label}>
            검색어
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            className={styles.input}
            placeholder="userId 또는 이름"
          />
        </div>
        <div className={styles.toolbarActions}>
          <button type="submit" className={styles.button}>
            검색
          </button>
          <Link href="/admin/users" className={styles.ghostButton}>
            초기화
          </Link>
        </div>
      </form>

      {users.items.length === 0 ? (
        <div className={styles.emptyBox}>검색 조건에 맞는 사용자가 없습니다.</div>
      ) : (
        <div className={styles.splitLayout}>
          <div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>userId</th>
                    <th>이름</th>
                    <th>달력</th>
                    <th>질문</th>
                    <th>공유 적립</th>
                    <th>상태</th>
                    <th>수정일</th>
                  </tr>
                </thead>
                <tbody>
                  {users.items.map((user) => (
                    <tr key={user.userId}>
                      <td>
                        <Link
                          href={buildUsersPageHref({ q, page, userId: user.userId })}
                          className={styles.tableLink}
                        >
                          {user.userId}
                        </Link>
                      </td>
                      <td>{user.name ?? "미입력"}</td>
                      <td>{renderCalendarTypeLabel(user.calendarType)}</td>
                      <td>{user.questionUsageCountToday}</td>
                      <td>{user.shareRewardCountToday}</td>
                      <td>{renderPendingBadge(user)}</td>
                      <td>{formatSeoulDate(user.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.pagination}>
              <span className={styles.paginationInfo}>페이지 {users.page}</span>
              {page > 1 ? (
                <Link
                  href={buildUsersPageHref({ q, page: page - 1, userId: selectedUserId })}
                  className={styles.ghostButton}
                >
                  이전
                </Link>
              ) : null}
              {users.hasNext ? (
                <Link
                  href={buildUsersPageHref({ q, page: page + 1, userId: selectedUserId })}
                  className={styles.ghostButton}
                >
                  다음
                </Link>
              ) : null}
            </div>
          </div>

          <aside className={styles.detailCard}>
            <p className={styles.eyebrow}>User Detail</p>
            <h3 className={styles.sectionTitle}>{selectedUser ? selectedUser.userId : "사용자 선택"}</h3>
            {!selectedUser ? (
              <p className={styles.sectionMeta}>테이블에서 userId를 선택하면 상세 정보가 표시됩니다.</p>
            ) : (
              <>
                <p className={styles.sectionMeta}>
                  {selectedUser.name ?? "미입력"} / {renderCalendarTypeLabel(selectedUser.calendarType)}
                </p>
                <dl className={styles.detailList}>
                  <div className={styles.detailRow}>
                    <dt>출생일</dt>
                    <dd>{formatStoredDate(selectedUser.birthDate)}</dd>
                  </div>
                  <div className={styles.detailRow}>
                    <dt>출생시간</dt>
                    <dd>{selectedUser.hasBirthTime ? "입력됨" : "미입력"}</dd>
                  </div>
                  <div className={styles.detailRow}>
                    <dt>오늘 질문 사용</dt>
                    <dd>{selectedUser.questionUsageCountToday}</dd>
                  </div>
                  <div className={styles.detailRow}>
                    <dt>오늘 공유 적립</dt>
                    <dd>{selectedUser.shareRewardCountToday}</dd>
                  </div>
                  <div className={styles.detailRow}>
                    <dt>질문 대기</dt>
                    <dd>{selectedUser.pendingQuestionInput ? "활성" : "없음"}</dd>
                  </div>
                  <div className={styles.detailRow}>
                    <dt>공유 스냅샷 수</dt>
                    <dd>{selectedUser.shareSnapshotCount}</dd>
                  </div>
                  <div className={styles.detailRow}>
                    <dt>생성일</dt>
                    <dd>{formatSeoulDate(selectedUser.createdAt)}</dd>
                  </div>
                  <div className={styles.detailRow}>
                    <dt>수정일</dt>
                    <dd>{formatSeoulDate(selectedUser.updatedAt)}</dd>
                  </div>
                </dl>
              </>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
