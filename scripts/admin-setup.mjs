import { randomBytes, createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
const folder = path.join(process.cwd(), "data");
await fs.mkdir(folder, { recursive: true });
const file = path.join(folder, "admin-auth.json");
try {
  await fs.access(file);
  console.log(
    "Admin access already exists. Your access file is data/admin-access.txt. No credentials were changed.",
  );
} catch {
  const key = randomBytes(24).toString("base64url");
  await fs.writeFile(
    file,
    JSON.stringify(
      {
        keyHash: createHash("sha256").update(key).digest("hex"),
        sessionSecret: randomBytes(48).toString("base64url"),
      },
      null,
      2,
    ),
    { mode: 0o600, flag: "wx" },
  );
  await fs.writeFile(
    path.join(folder, "admin-access.txt"),
    `SAVRDH Super Admin\nSign-in: http://localhost:3000/admin/login\nAccess key: ${key}\n\nKeep this file private. This key grants access to your local admin records.\n`,
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    "Admin access created. Read data/admin-access.txt for your private key.",
  );
}
