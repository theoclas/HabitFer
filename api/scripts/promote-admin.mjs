import { PrismaClient } from '@prisma/client';

const identifier = process.argv[2];
if (!identifier) {
  console.error('Usage: node scripts/promote-admin.mjs <username|email>');
  process.exit(1);
}

const prisma = new PrismaClient();
const user = await prisma.user.findFirst({
  where: {
    OR: [{ username: identifier }, { email: identifier.toLowerCase() }],
  },
});

if (!user) {
  console.error('Usuario no encontrado:', identifier);
  process.exit(1);
}

const updated = await prisma.user.update({
  where: { id: user.id },
  data: {
    role: 'ADMIN',
    status: 'ACTIVE',
    approvedAt: user.approvedAt ?? new Date(),
  },
  select: { id: true, username: true, email: true, fullName: true, role: true, status: true },
});

console.log('Usuario actualizado a administrador:');
console.log(JSON.stringify(updated, null, 2));
await prisma.$disconnect();
