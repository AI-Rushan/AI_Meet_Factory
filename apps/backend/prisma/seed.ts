import { PrismaClient, WorkspaceKind } from "@prisma/client";

const prisma = new PrismaClient();

const personalWorkspaceNameFromEmail = (email: string): string => {
  const local = email.split("@")[0] ?? "User";
  return `${local} personal workspace`;
};

async function main(): Promise<void> {
  const users = await prisma.user.findMany({
    include: {
      personalWorkspace: true,
      memberships: true,
    },
  });

  for (const user of users) {
    let workspaceId = user.personalWorkspace?.id;

    if (!workspaceId) {
      const workspace = await prisma.workspace.create({
        data: {
          name: personalWorkspaceNameFromEmail(user.email),
          kind: WorkspaceKind.PERSONAL,
          personalOwnerUserId: user.id,
        },
      });
      workspaceId = workspace.id;
    }

    const hasMembership = user.memberships.some((membership) => membership.workspaceId === workspaceId);
    if (!hasMembership) {
      await prisma.membership.create({
        data: {
          userId: user.id,
          workspaceId,
          role: "OWNER",
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
