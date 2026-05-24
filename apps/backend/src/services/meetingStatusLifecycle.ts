import { MeetingStatus } from "@prisma/client";

const transitionMap: Record<MeetingStatus, MeetingStatus[]> = {
  CREATED: [MeetingStatus.PROCESSING],
  PROCESSING: [MeetingStatus.READY, MeetingStatus.FAILED],
  READY: [],
  FAILED: [MeetingStatus.PROCESSING],
};

export const canMoveMeetingStatus = (from: MeetingStatus, to: MeetingStatus): boolean => {
  if (from === to) {
    return true;
  }
  return transitionMap[from].includes(to);
};

export const assertMeetingStatusTransition = (from: MeetingStatus, to: MeetingStatus): void => {
  if (!canMoveMeetingStatus(from, to)) {
    throw new Error(`Invalid meeting status transition: ${from} -> ${to}`);
  }
};
