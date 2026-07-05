import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const users = await prisma.$queryRawUnsafe(`
  SELECT id, username, email, fullName, role, createdAt
  FROM User
  ORDER BY createdAt DESC
`);
console.log(JSON.stringify(users, null, 2));
await prisma.$disconnect();
