"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./register.module.css";

type RegisterFormProps = {
  initialUserId: string;
  fromKakao: boolean;
};

type CalendarType = "solar" | "lunar" | "unknown";

export default function RegisterForm({ initialUserId, fromKakao }: RegisterFormProps) {
  const router = useRouter();
  const [userId] = useState(initialUserId);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [calendarType, setCalendarType] = useState<CalendarType>("solar");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId.trim()) {
      setError("카카오 사용자 ID가 필요합니다.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userId.trim(),
          name,
          birthDate,
          birthTime: birthTime || undefined,
          calendarType,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "등록 중 오류가 발생했습니다.");
      }

      router.push(`/fortune/${encodeURIComponent(userId.trim())}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "등록 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formHeader}>
        <div>
          <p className={styles.formEyebrow}>Registration Form</p>
          <h2 className={styles.formTitle}>사주 기본 정보</h2>
        </div>
        <p className={styles.formNote}>출생시간을 모르면 비워도 됩니다.</p>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>이름</span>
        <input
          className={styles.input}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="예: 홍길동"
          autoComplete="name"
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>생년월일</span>
        <input
          className={styles.input}
          type="date"
          value={birthDate}
          onChange={(event) => setBirthDate(event.target.value)}
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>출생시간</span>
        <input
          className={styles.input}
          type="time"
          value={birthTime}
          onChange={(event) => setBirthTime(event.target.value)}
        />
      </label>

      <fieldset className={styles.fieldset}>
        <legend className={styles.label}>달력 기준</legend>
        <div className={styles.segmented}>
          <label className={styles.segment}>
            <input
              type="radio"
              name="calendarType"
              value="solar"
              checked={calendarType === "solar"}
              onChange={() => setCalendarType("solar")}
            />
            <span>양력</span>
          </label>
          <label className={styles.segment}>
            <input
              type="radio"
              name="calendarType"
              value="lunar"
              checked={calendarType === "lunar"}
              onChange={() => setCalendarType("lunar")}
            />
            <span>음력</span>
          </label>
          <label className={styles.segment}>
            <input
              type="radio"
              name="calendarType"
              value="unknown"
              checked={calendarType === "unknown"}
              onChange={() => setCalendarType("unknown")}
            />
            <span>모름</span>
          </label>
        </div>
      </fieldset>

      {error ? <p className={styles.error}>{error}</p> : null}

      <button className={styles.submitButton} type="submit" disabled={submitting}>
        {submitting ? "사주 정보 기록 중" : fromKakao ? "등록하고 오늘 운세 보기" : "저장하고 상세 운세 보기"}
      </button>
    </form>
  );
}
