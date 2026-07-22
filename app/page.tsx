import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.intro}>
          <h1>Bienvenido a la API de PickVerso ⚽🎯</h1>
          <p>
            Pronósticos verificados para Colombia y Latinoamérica. Estadísticas
            reales, picks auditados, sin humo.
          </p>
        </div>

        <div className={styles.ctas}>
          <Link className={styles.primary} href="/api">
            Explorar la API 🚀
          </Link>
        </div>
      </main>
    </div>
  );
}
