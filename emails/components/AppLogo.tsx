import { Img, Section } from "react-email";

interface AppLogoProps {
  src?: string;
  alt?: string;
  width?: number;
}

export default function AppLogo({
  src = "https://tu-dominio.com/logo.png",
  alt = "Pick verso",
  width = 120,
}: AppLogoProps) {
  return (
    <Section style={{ textAlign: "center", padding: "24px 0" }}>
      <Img src={src} alt={alt} width={width} style={{ margin: "0 auto" }} />
    </Section>
  );
}
