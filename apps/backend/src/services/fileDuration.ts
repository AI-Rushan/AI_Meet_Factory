import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffprobe from "ffprobe-static";

const execFileAsync = promisify(execFile);

export const getAudioChannels = async (filePath: string): Promise<number> => {
  if (!ffprobe.path) return 1;
  const { stdout } = await execFileAsync(ffprobe.path, [
    "-v", "quiet",
    "-print_format", "json",
    "-show_streams",
    "-select_streams", "a:0",
    filePath,
  ]);
  const parsed = JSON.parse(stdout) as { streams?: Array<{ channels?: number }> };
  return parsed.streams?.[0]?.channels ?? 1;
};

export const getMediaDurationSec = async (filePath: string): Promise<number> => {
  if (!ffprobe.path) {
    throw new Error("ffprobe binary is unavailable");
  }

  const { stdout } = await execFileAsync(ffprobe.path, [
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_format",
    filePath,
  ]);

  const parsed = JSON.parse(stdout) as { format?: { duration?: string } };
  const durationRaw = parsed.format?.duration;
  const duration = Number(durationRaw);

  if (!durationRaw || Number.isNaN(duration) || duration <= 0) {
    throw new Error("Cannot detect media duration");
  }

  return duration;
};
