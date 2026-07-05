import { PrismaClient } from '@prisma/client';

const identifier = process.argv[2];
if (!identifier) {
  console.error('Usage: node scripts/promote-admin-raw.mjs <username|email>');
  process.exit(1);
}

const prisma = new PrismaClient();
const rows = await prisma.$queryRawUnsafe(
  `SELECT id, username, email, role FROM User WHERE username = ? OR email = ? LIMIT 1`,
  identifier,
  identifier.toLowerCase(),
);

const user = rows[0];
if (!user) {
  console.error('Usuario no encontrado:', identifier);
  process.exit(1);
}

await prisma.$executeRawUnsafe(`UPDATE User SET role = 'ADMIN' WHERE id = ?`, user.id);

const updated = await prisma.$queryRawUnsafe(
  `SELECT id, username, email, fullName, role FROM User WHERE id = ?`,
  user.id,
);

console.log('Usuario actualizado a administrador:');
console.log(JSON.stringify(updated[0], null, 2));
await prisma.$disconnect();
