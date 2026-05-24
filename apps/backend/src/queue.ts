import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config";

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

export const processingQueue = new Queue("meeting-processing", { connection });

export type ProcessMeetingJob = {
  meetingId: string;
  runId: string;
};
