import fs from "fs";
import path from "path";
const root = path.resolve("C:/Fernando/Desarrollo/Personal/FersuaStore/HabitFer");
const w = (rel, c) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, "utf8"); };

let utils = fs.readFileSync(path.join(root, "api/src/tasks/tasks.utils.ts"), "utf8");
if (!utils.includes("computeReminderAt")) {
  utils += `

export function computeReminderAt(
  reminderEnabled: boolean,
  dueDate: string | null | undefined,
  dueTime: string | null | undefined,
): Date | null {
  if (!reminderEnabled || !dueDate) return null;
  const [y, m, d] = dueDate.split('-').map(Number);
  const [hh, mm] = (dueTime ?? '09:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}
`;
  fs.writeFileSync(path.join(root, "api/src/tasks/tasks.utils.ts"), utils, "utf8");
}

let svc = fs.readFileSync(path.join(root, "api/src/tasks/tasks.service.ts"), "utf8");
svc = svc.replace(
  "import { isDueToday, isOverdue, parseDateKey, startOfDay, toDateKey } from './tasks.utils';",
  "import { computeReminderAt, isDueToday, isOverdue, parseDateKey, startOfDay, toDateKey } from './tasks.utils';"
);
svc = svc.replace(
  `        dueTime: dto.dueTime ?? null,
        reminderEnabled: dto.reminderEnabled ?? false,
      },`,
  `        dueTime: dto.dueTime ?? null,
        reminderEnabled: dto.reminderEnabled ?? false,
        reminderAt: computeReminderAt(dto.reminderEnabled ?? false, dto.dueDate ?? null, dto.dueTime ?? null),
      },`
);
svc = svc.replace(
  `        dueTime: dto.dueTime === undefined ? undefined : dto.dueTime,
        reminderEnabled: dto.reminderEnabled,
      },`,
  `        dueTime: dto.dueTime === undefined ? undefined : dto.dueTime,
        reminderEnabled: dto.reminderEnabled,
        reminderAt:
          dto.reminderEnabled === undefined && dto.dueDate === undefined && dto.dueTime === undefined
            ? undefined
            : computeReminderAt(
                dto.reminderEnabled ?? false,
                dto.dueDate === undefined ? undefined : dto.dueDate,
                dto.dueTime === undefined ? undefined : dto.dueTime,
              ),
      },`
);
fs.writeFileSync(path.join(root, "api/src/tasks/tasks.service.ts"), svc, "utf8");

let remSvc = fs.readFileSync(path.join(root, "api/src/reminders/reminders.service.ts"), "utf8");
remSvc = remSvc.replace(
  "import { isScheduledDay, toDateKey as habitDateKey, startOfDay as habitStartOfDay } from '../habits/habits.utils';",
  "import { isScheduledDay } from '../habits/habits.utils';"
);
fs.writeFileSync(path.join(root, "api/src/reminders/reminders.service.ts"), remSvc, "utf8");

console.log("tasks reminderAt ok");
