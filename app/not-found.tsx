import Link from "next/link";
import styles from "./page.module.css";

export default function NotFound() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.intro}>
          <p style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#888" }}>
            ERROR 404
          </p>
          <h1>¡Te fuiste fuera de juego! 🚩</h1>
          <p>
            La página o el endpoint que estás buscando no existe o fue movido a
            otra posición.
          </p>
        </div>

        <div className={styles.ctas}>
          <Link className={styles.primary} href="/">
            Volver al inicio 🏠
          </Link>
          <Link className={styles.secondary} href="/api">
            Ir a la API 🚀
          </Link>
        </div>
      </main>
    </div>
  );
}
