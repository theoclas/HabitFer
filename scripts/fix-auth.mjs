import fs from "fs";
import path from "path";
const p = path.resolve("C:/Fernando/Desarrollo/Personal/FersuaStore/HabitFer/api/src/auth/auth.controller.ts");
let c = fs.readFileSync(p, "utf8");
c = c.replace("import { CurrentUser, AuthUserPayload }", "import { CurrentUser, type AuthUserPayload }");
fs.writeFileSync(p, c, "utf8");
console.log("fixed auth controller");
