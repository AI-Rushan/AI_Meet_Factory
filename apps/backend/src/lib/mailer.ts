import nodemailer from "nodemailer";
import { config } from "../config";

type MailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const sendViaResend = async (opts: MailOptions): Promise<void> => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.smtpFrom,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error ${response.status}: ${body}`);
  }
};

const sendViaSmtp = async (opts: MailOptions): Promise<void> => {
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    ...(config.smtpUser ? { auth: { user: config.smtpUser, pass: config.smtpPass } } : {}),
  });

  await transporter.sendMail({
    from: config.smtpFrom,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
};

export const sendMail = (opts: MailOptions): Promise<void> => {
  if (config.resendApiKey) {
    return sendViaResend(opts);
  }
  return sendViaSmtp(opts);
};
