import { getDb } from "../server/db";
import { users } from "../drizzle/schema";
import { like } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.log("No DB connection");
    return;
  }
  const result = await db.select({
    id: users.id,
    phone: users.phone,
    role: users.role,
    status: users.status,
    name: users.name,
    openId: users.openId,
  }).from(users).where(like(users.phone, "%184503%"));
  
  console.log("Users matching 184503:");
  for (const u of result) {
    console.log(JSON.stringify(u));
  }
  process.exit(0);
}
main().catch(console.error);
