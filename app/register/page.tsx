import Image from "next/image";
import Link from "next/link";
import RegisterForm from "./RegisterForm";
import styles from "./register.module.css";

type RegisterPageProps = {
  searchParams?: {
    userId?: string;
    source?: string;
    token?: string;
  };
};

export default function RegisterPage({ searchParams }: RegisterPageProps) {
  const initialUserId = searchParams?.userId?.trim() || "";
  const fromKakao = searchParams?.source?.trim() === "kakao";
  const accessToken = searchParams?.token?.trim() || "";
  const canRegister = Boolean(initialUserId && accessToken);

  return (
    <main className={styles.page}>
      <div className={styles.background} />
      <section className={styles.shell}>
        <div className={styles.hero}>
          <div className={styles.heroArt}>
            <Image
              src="/character_write.png"
              alt="사주 정보 기록"
              width={360}
              height={360}
              priority
              className={styles.heroImage}
            />
          </div>
        </div>

        <div className={styles.formPanel}>
          {canRegister ? (
            <RegisterForm initialUserId={initialUserId} fromKakao={fromKakao} accessToken={accessToken} />
          ) : (
            <div className={styles.noticeCard}>
              <p className={styles.noticeEyebrow}>Private Registration Link</p>
              <h2 className={styles.noticeTitle}>카카오에서 받은 등록 링크로만 기록할 수 있습니다.</h2>
              <p className={styles.noticeText}>
                이 화면은 공개 등록창이 아닙니다. 카카오 채널에서 안내 카드의 등록 버튼을 눌러 다시 들어오십시오.
              </p>
              <Link href="/" className={styles.noticeLink}>
                홈으로 돌아가기
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
