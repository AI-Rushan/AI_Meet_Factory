import type { AuthPayload } from "../lib/jwt";
import { prisma } from "../db";
import { assertMeetingStatusTransition } from "./meetingStatusLifecycle";
import type { CreateMeetingDto, UpdateMeetingDto } from "../dto/meetings";

const assertWorkspaceMembership = async (auth: AuthPayload): Promise<void> => {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: auth.userId,
        workspaceId: auth.workspaceId,
      },
    },
  });

  if (!membership) {
    throw new Error("NO_WORKSPACE_MEMBERSHIP");
  }
};

const getOwnedMeeting = async (meetingId: string, auth: AuthPayload) =>
  prisma.meeting.findFirst({
    where: {
      id: meetingId,
      workspaceId: auth.workspaceId,
      workspace: { memberships: { some: { userId: auth.userId } } },
    },
  });

export const meetingsService = {
  async listMyMeetings(auth: AuthPayload) {
    await assertWorkspaceMembership(auth);

    return prisma.meeting.findMany({
      where: {
        workspaceId: auth.workspaceId,
        workspace: { memberships: { some: { userId: auth.userId } } },
      },
      orderBy: { createdAt: "desc" },
      include: {
        summary: true,
        transcript: true,
        _count: { select: { tasks: true, speakers: true } },
      },
    });
  },

  async createMeeting(auth: AuthPayload, payload: CreateMeetingDto) {
    await assertWorkspaceMembership(auth);

    return prisma.meeting.create({
      data: {
        workspaceId: auth.workspaceId,
        createdByUserId: auth.userId,
        title: payload.title,
      },
    });
  },

  async getMeetingById(auth: AuthPayload, meetingId: string) {
    return prisma.meeting.findFirst({
      where: {
        id: meetingId,
        workspaceId: auth.workspaceId,
        workspace: { memberships: { some: { userId: auth.userId } } },
      },
      include: {
        transcript: {
          include: {
            segments: {
              include: { speaker: true },
              orderBy: { segmentOrder: "asc" },
            },
          },
        },
        speakers: { orderBy: { autoLabel: "asc" } },
        summary: true,
        tasks: { orderBy: { taskOrder: "asc" } },
        questions: { orderBy: { createdAt: "asc" } },
        runs: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
  },

  async updateMeeting(auth: AuthPayload, meetingId: string, payload: UpdateMeetingDto) {
    const meeting = await getOwnedMeeting(meetingId, auth);
    if (!meeting) {
      throw new Error("MEETING_NOT_FOUND");
    }

    if (payload.status) {
      assertMeetingStatusTransition(meeting.status, payload.status);
    }

    return prisma.meeting.update({
      where: { id: meetingId },
      data: {
        title: payload.title,
        status: payload.status,
      },
    });
  },
};
