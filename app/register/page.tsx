import Image from "next/image";
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
          <RegisterForm initialUserId={initialUserId} fromKakao={fromKakao} accessToken={accessToken} />
        </div>
      </section>
    </main>
  );
}
