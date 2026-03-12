import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminDashboardConfigured } from "../../../lib/admin-auth";
import { isAdminAuthenticated } from "../../../lib/admin-session";
import styles from "../admin.module.css";

type LoginPageProps = {
  searchParams?: {
    error?: string;
  };
};

function readErrorMessage(error?: string): string | null {
  if (error === "invalid") {
    return "관리자 시크릿이 올바르지 않습니다.";
  }

  if (error === "config") {
    return "ADMIN_DASHBOARD_SECRET 환경변수가 설정되지 않았습니다.";
  }

  return null;
}

export default function AdminLoginPage({ searchParams }: LoginPageProps) {
  if (isAdminDashboardConfigured() && isAdminAuthenticated(cookies())) {
    redirect("/admin");
  }

  return (
    <main className={styles.loginShell}>
      <section className={styles.loginCard}>
        <p className={styles.eyebrow}>Admin Access</p>
        <h1 className={styles.title}>관리자 대시보드</h1>
        <p className={styles.lead}>
          운영 현황과 사용자 상태를 확인하는 내부 화면입니다. 관리자 시크릿을 입력해야 접근할 수 있습니다.
        </p>

        {!isAdminDashboardConfigured() ? (
          <div className={styles.errorBox}>
            <strong>환경변수 누락</strong>
            <div>서버에 `ADMIN_DASHBOARD_SECRET`을 설정한 뒤 다시 시도하세요.</div>
          </div>
        ) : null}

        {readErrorMessage(searchParams?.error) ? (
          <div className={styles.errorBox}>{readErrorMessage(searchParams?.error)}</div>
        ) : null}

        <form method="post" action="/api/admin/session" className={styles.form}>
          <div>
            <label htmlFor="secret" className={styles.label}>
              관리자 시크릿
            </label>
            <input
              id="secret"
              name="secret"
              type="password"
              autoComplete="current-password"
              className={styles.input}
              placeholder="관리자 시크릿 입력"
              required
            />
          </div>
          <button type="submit" className={styles.button} disabled={!isAdminDashboardConfigured()}>
            로그인
          </button>
        </form>
      </section>
    </main>
  );
}
