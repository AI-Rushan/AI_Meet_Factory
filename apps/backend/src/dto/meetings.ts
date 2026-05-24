import { MeetingStatus } from "@prisma/client";
import { z } from "zod";

export const createMeetingSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export const updateMeetingSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    status: z.nativeEnum(MeetingStatus).optional(),
  })
  .refine((payload) => payload.title !== undefined || payload.status !== undefined, {
    message: "At least one field is required",
  });

export type CreateMeetingDto = z.infer<typeof createMeetingSchema>;
export type UpdateMeetingDto = z.infer<typeof updateMeetingSchema>;
