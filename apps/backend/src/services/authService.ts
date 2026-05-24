import { MembershipRole, WorkspaceKind } from "@prisma/client";
import { prisma } from "../db";
import { hashPassword, verifyPassword } from "../lib/hash";
import { signToken, type AuthPayload } from "../lib/jwt";
import type { LoginDto, RegisterDto } from "../dto/auth";

const pickActiveWorkspaceId = (
  memberships: Array<{ workspaceId: string; role: MembershipRole; workspace: { kind: WorkspaceKind } }>,
): string | null => {
  const personalOwner = memberships.find(
    (membership) => membership.workspace.kind === WorkspaceKind.PERSONAL && membership.role === MembershipRole.OWNER,
  );
  if (personalOwner) {
    return personalOwner.workspaceId;
  }

  return memberships[0]?.workspaceId ?? null;
};

export const authService = {
  async register(payload: RegisterDto): Promise<{ token: string; user: { id: string; email: string; name: string | null; workspaceId: string } }> {
    const existing = await prisma.user.findUnique({ where: { email: payload.email } });
    if (existing) {
      throw new Error("EMAIL_ALREADY_REGISTERED");
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: payload.email,
          name: payload.name ?? null,
          passwordHash: await hashPassword(payload.password),
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: payload.workspaceName,
          kind: WorkspaceKind.PERSONAL,
          personalOwnerUserId: user.id,
        },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: MembershipRole.OWNER,
        },
      });

      return {
        token: signToken({ userId: user.id, workspaceId: workspace.id, isAdmin: user.isAdmin }),
        user: { id: user.id, email: user.email, name: user.name, workspaceId: workspace.id },
      };
    });

    return result;
  },

  async login(payload: LoginDto): Promise<{ token: string; user: { id: string; email: string; name: string | null; workspaceId: string } }> {
    const user = await prisma.user.findUnique({
      where: { email: payload.email },
      include: {
        memberships: {
          include: {
            workspace: {
              select: { kind: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const valid = await verifyPassword(payload.password, user.passwordHash);
    if (!valid) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const workspaceId = pickActiveWorkspaceId(user.memberships);
    if (!workspaceId) {
      throw new Error("NO_WORKSPACE_MEMBERSHIP");
    }

    return {
      token: signToken({ userId: user.id, workspaceId, isAdmin: user.isAdmin }),
      user: { id: user.id, email: user.email, name: user.name, workspaceId },
    };
  },

  async getSession(auth: AuthPayload): Promise<{ user: { id: string; email: string; name: string | null; isAdmin: boolean }; workspaceId: string } | null> {
    const membership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: auth.userId,
          workspaceId: auth.workspaceId,
        },
      },
      include: {
        user: { select: { id: true, email: true, name: true, isAdmin: true } },
      },
    });

    if (!membership) {
      return null;
    }

    return {
      user: membership.user,
      workspaceId: membership.workspaceId,
    };
  },
};
