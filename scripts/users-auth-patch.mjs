import fs from "fs";
import path from "path";
const root = path.resolve("C:/Fernando/Desarrollo/Personal/FersuaStore/HabitFer");

let usersModule = fs.readFileSync(path.join(root, "api/src/users/users.module.ts"), "utf8");
if (!usersModule.includes("RolesGuard")) {
  usersModule = usersModule.replace(
    "import { Module } from '@nestjs/common';",
    "import { Module } from '@nestjs/common';\nimport { RolesGuard } from '../common/guards/roles.guard';"
  );
  usersModule = usersModule.replace("providers: [UsersService],", "providers: [UsersService, RolesGuard],");
  fs.writeFileSync(path.join(root, "api/src/users/users.module.ts"), usersModule, "utf8");
}

let authSvc = fs.readFileSync(path.join(root, "api/src/auth/auth.service.ts"), "utf8");
authSvc = authSvc.replace("import { RegisterDto } from './dto/register.dto';", "import { RegisterDto } from './dto/register.dto';\nimport { UserRole } from '@prisma/client';");
authSvc = authSvc.replace(
  "    const passwordHash = await bcrypt.hash(dto.password, 10);\n    const user = await this.prisma.user.create({",
  "    const passwordHash = await bcrypt.hash(dto.password, 10);\n    const count = await this.prisma.user.count();\n    const user = await this.prisma.user.create({"
);
authSvc = authSvc.replace(
  "        passwordHash,\n      },",
  "        passwordHash,\n        role: count === 0 ? UserRole.ADMIN : UserRole.USER,\n      },"
);
authSvc = authSvc.replace(
  "    return { id: user.id, email: user.email, username: user.username, fullName: user.fullName };",
  "    return { id: user.id, email: user.email, username: user.username, fullName: user.fullName, role: user.role };"
);
authSvc = authSvc.replace(
  "  private sign(user: { id: string; email: string; username: string; fullName: string }) {",
  "  private sign(user: { id: string; email: string; username: string; fullName: string; role: string }) {"
);
authSvc = authSvc.replace(
  "    const payload = { sub: user.id, email: user.email, username: user.username };",
  "    const payload = { sub: user.id, email: user.email, username: user.username, role: user.role };"
);
authSvc = authSvc.replace(
  "      user: { id: user.id, email: user.email, username: user.username, fullName: user.fullName },",
  "      user: { id: user.id, email: user.email, username: user.username, fullName: user.fullName, role: user.role },"
);
fs.writeFileSync(path.join(root, "api/src/auth/auth.service.ts"), authSvc, "utf8");

let jwt = fs.readFileSync(path.join(root, "api/src/auth/jwt.strategy.ts"), "utf8");
jwt = jwt.replace(
  "  validate(payload: { sub: string; email: string; username: string }): AuthUserPayload {",
  "  validate(payload: { sub: string; email: string; username: string; role?: string }): AuthUserPayload {"
);
jwt = jwt.replace(
  "    return { userId: payload.sub, email: payload.email, username: payload.username };",
  "    return { userId: payload.sub, email: payload.email, username: payload.username, role: payload.role };"
);
fs.writeFileSync(path.join(root, "api/src/auth/jwt.strategy.ts"), jwt, "utf8");

let decorator = fs.readFileSync(path.join(root, "api/src/common/decorators/current-user.decorator.ts"), "utf8");
decorator = decorator.replace(
  "export type AuthUserPayload = { userId: string; email: string; username: string };",
  "export type AuthUserPayload = { userId: string; email: string; username: string; role?: string };"
);
fs.writeFileSync(path.join(root, "api/src/common/decorators/current-user.decorator.ts"), decorator, "utf8");

console.log("auth role updates ok");
