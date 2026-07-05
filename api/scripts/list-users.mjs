import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const users = await prisma.user.findMany({
  orderBy: { createdAt: 'desc' },
  select: { id: true, username: true, email: true, fullName: true, role: true, status: true },
});
console.log(JSON.stringify(users, null, 2));
await prisma.$disconnect();
