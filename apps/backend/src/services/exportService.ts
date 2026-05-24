import nodemailer from "nodemailer";
import { prisma } from "../db";
import { config } from "../config";

export const renderTranscriptText = async (meetingId: string): Promise<string> => {
  const meeting = await prisma.meeting.findUniqueOrThrow({
    where: { id: meetingId },
    include: {
      transcript: {
        include: {
          segments: {
            orderBy: { segmentOrder: "asc" },
            include: { speaker: true },
          },
        },
      },
    },
  });

  if (!meeting.transcript) {
    return "";
  }

  return meeting.transcript.segments
    .map((segment) => {
      const ts = new Date(segment.startSec * 1000).toISOString().substring(11, 19);
      const speaker =
        segment.speaker?.confirmedName ?? segment.speaker?.suggestedName ?? segment.speaker?.autoLabel ?? "Speaker";
      return `[${ts}] ${speaker}: ${segment.text}`;
    })
    .join("\n");
};

export const renderMeetingText = async (meetingId: string): Promise<string> => {
  const meeting = await prisma.meeting.findUniqueOrThrow({
    where: { id: meetingId },
    include: {
      summary: true,
      tasks: { orderBy: { taskOrder: "asc" } },
    },
  });

  const lines: string[] = [];
  lines.push(`# ${meeting.title}`);

  if (meeting.summary) {
    lines.push("\n## Саммари");
    try {
      const parsed = JSON.parse(meeting.summary.text) as { topics?: string[]; decisions?: string[] };
      if (Array.isArray(parsed.topics) && parsed.topics.length > 0) {
        lines.push("Темы обсуждения:");
        parsed.topics.forEach((t) => lines.push(`• ${t}`));
      }
      if (Array.isArray(parsed.decisions) && parsed.decisions.length > 0) {
        lines.push("\nПринятые решения:");
        parsed.decisions.forEach((d) => lines.push(`• ${d}`));
      }
    } catch {
      lines.push(meeting.summary.text);
    }
  }

  if (meeting.tasks.length > 0) {
    lines.push("\n## Задачи");
    meeting.tasks.forEach((task, index) => {
      lines.push(
        `${index + 1}. ${task.finalText} | ответственный: ${task.finalAssignee ?? "не определён"} | срок: ${task.finalDueDate ?? "не установлен"}`,
      );
    });
  }

  return lines.join("\n");
};

export const exportToEmail = async (meetingId: string, destination: string): Promise<void> => {
  const text = await renderMeetingText(meetingId);
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
  });

  await transporter.sendMail({
    from: config.smtpFrom,
    to: destination,
    subject: "Meeting export",
    text,
  });
};

export const exportToTelegram = async (meetingId: string, chatIds: string[]): Promise<void> => {
  if (!config.telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }
  const text = await renderMeetingText(meetingId);
  const errors: string[] = [];

  for (const chatId of chatIds) {
    const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) }),
    });
    if (!response.ok) {
      const body = await response.text();
      errors.push(`${chatId}: ${body}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Telegram send errors: ${errors.join("; ")}`);
  }
};
