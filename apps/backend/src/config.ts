import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
  maxMeetingMinutes: Number(process.env.MAX_MEETING_MINUTES ?? 120),
  transcriptionProvider: process.env.TRANSCRIPTION_PROVIDER ?? "mock",
  postprocessingProvider: process.env.POSTPROCESSING_PROVIDER ?? "mock",
  // AI provider keys
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  gladiaApiKey: process.env.GLADIA_API_KEY ?? "",
  deepgramApiKey: process.env.DEEPGRAM_API_KEY ?? "",
  assemblyAiApiKey: process.env.ASSEMBLYAI_API_KEY ?? "",
  whisperLocalUrl: process.env.WHISPER_LOCAL_URL ?? "http://localhost:8080",
  // Other integrations
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  smtpHost: process.env.SMTP_HOST ?? "localhost",
  smtpPort: Number(process.env.SMTP_PORT ?? 1025),
  smtpFrom: process.env.SMTP_FROM ?? "meeting-ai@example.local",
};
