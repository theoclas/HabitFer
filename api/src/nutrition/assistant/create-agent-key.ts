/**
 * Crea una llave para que un asistente (Claude) lea el informe de NutriFer y escribe en la salida SOLO la llave,
 * para guardarla directo en un archivo sin que quede a la vista:
 *
 *   node dist/nutrition/assistant/create-agent-key.js [--name "Claude en el PC"] [--user <id o correo>] > llave.txt
 *
 * Sin --user, es para quien más ha anotado en NutriFer. A quién se le creó y la pista salen por stderr. Se ve y se
 * quita en NutriFer › Meta › Claude, igual que las que se crean desde la app.
 */
import { PrismaClient } from '@prisma/client';
import { cleanKeyName, MAX_AGENT_KEYS, newAgentKey } from './agent-keys';

const say = (msg: string) => process.stderr.write(`[nutrifer] ${msg}\n`);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const who = arg('user');
    let userId: string;
    if (who) {
      const user = await prisma.user.findFirst({
        where: who.includes('@') ? { email: who } : { id: who },
        select: { id: true },
      });
      if (!user) throw new Error('No encontré ese usuario.');
      userId = user.id;
    } else {
      const [top] = await prisma.mealEntry.groupBy({
        by: ['userId'],
        _count: { userId: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 1,
      });
      if (!top)
        throw new Error('Nadie ha anotado comidas todavía: usa --user.');
      userId = top.userId;
    }
    const count = await prisma.nutritionAgentKey.count({ where: { userId } });
    if (count >= MAX_AGENT_KEYS)
      throw new Error(
        `Ese usuario ya tiene ${MAX_AGENT_KEYS} llaves: quita una en NutriFer › Meta › Claude.`,
      );
    const key = newAgentKey();
    const name = cleanKeyName(arg('name'));
    await prisma.nutritionAgentKey.create({
      data: { userId, name, tokenHash: key.tokenHash, hint: key.hint },
    });
    say(
      `Llave «${name}» creada para el usuario ${userId} (termina en …${key.hint}).`,
    );
    process.stdout.write(`${key.token}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  say(`Falló: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
