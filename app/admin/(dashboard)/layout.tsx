import React from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { formatSeoulDateLabel } from "../../../lib/seoul-time";
import { requireAdminPageSession } from "../../../lib/admin-session";
import styles from "../admin.module.css";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/shares", label: "Shares" },
];

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  requireAdminPageSession(cookies());

  return (
    <div className={styles.dashboardShell}>
      <aside className={styles.sidebar}>
        <p className={styles.eyebrow}>Admin Console</p>
        <h1 className={styles.brand}>사주도령</h1>
        <p className={styles.sidebarCopy}>
          운영 현황, 사용자 상태, 공유 스냅샷을 확인하는 내부 대시보드입니다.
        </p>

        <nav className={styles.nav} aria-label="관리자 메뉴">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={styles.navLink}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <form method="post" action="/api/admin/session/logout">
            <button type="submit" className={styles.ghostButton}>
              로그아웃
            </button>
          </form>
        </div>
      </aside>

      <main className={styles.content}>
        <header className={styles.topbar}>
          <div>
            <p className={styles.eyebrow}>Operations</p>
            <h2 className={styles.topbarTitle}>관리자 대시보드</h2>
            <p className={styles.topbarMeta}>{formatSeoulDateLabel(new Date())} 기준</p>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
