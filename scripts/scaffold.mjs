import fs from "fs";
import path from "path";

const root = path.resolve("C:/Fernando/Desarrollo/Personal/FersuaStore/HabitFer");

function write(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
}

const files = {
  "api/prisma/schema.prisma": `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  username     String   @unique @db.VarChar(64)
  passwordHash String
  fullName     String   @db.VarChar(120)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
`,
};

for (const [rel, content] of Object.entries(files)) {
  write(rel, content);
}
console.log("done", Object.keys(files).length);
