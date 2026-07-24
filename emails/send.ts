import { render } from "react-email";
import { createTransport } from "nodemailer";

export interface SendEmailOptions {
  to: string;
  subject: string;
  from?: string;
}

const getTransporter = () => {
  const port = Number(process.env.SMTP_PORT || 587);

  return createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export async function sendEmail<T>(
  template: (props: T) => React.ReactElement,
  props: T,
  options: SendEmailOptions,
) {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    console.warn("[Email] Configuración SMTP incompleta. Email no enviado.");
    return { skipped: true, reason: "SMTP configuration missing" };
  }

  const html = await render(template(props));

  const transporter = getTransporter();

  try {
    await transporter.verify();
  } catch (error) {
    console.error("[Email] No se pudo verificar la conexión SMTP:", error);
    return { skipped: true, reason: "SMTP verification failed" };
  }

  const info = await transporter.sendMail({
    from: options.from || process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: options.to,
    subject: options.subject,
    html,
  });

  return {
    skipped: false,
    data: { messageId: info.messageId, response: info.response },
  };
}
