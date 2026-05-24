import { Worker } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config";
import { processMeetingRun } from "./services/processingPipeline";
import { ProcessMeetingJob } from "./queue";
import { bootstrap } from "./bootstrap";

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

const start = async (): Promise<void> => {
  await bootstrap();

  const worker = new Worker<ProcessMeetingJob>(
    "meeting-processing",
    async (job) => {
      await processMeetingRun(job.data.meetingId, job.data.runId);
    },
    { connection, concurrency: 2 },
  );

  worker.on("completed", (job) => {
    // eslint-disable-next-line no-console
    console.log(`Job ${job?.id} completed`);
  });

  worker.on("failed", (job, error) => {
    // eslint-disable-next-line no-console
    console.error(`Job ${job?.id} failed`, error);
  });
};

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Worker startup failed", error);
  process.exit(1);
});
