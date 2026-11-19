import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@bazaar.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: Role.ADMIN },
    create: {
      email: adminEmail,
      name: "Platform Admin",
      passwordHash,
      role: Role.ADMIN,
    },
    select: { id: true, email: true, role: true, name: true },
  });

  const categories = ["Home", "Kitchen", "Fashion", "Crafts", "Electronics"];
  for (const name of categories) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await prisma.category.upsert({ where: { slug }, update: { name }, create: { name, slug } });
  }

  console.log("Seed complete:", { admin, adminPassword: adminPassword === "Admin@12345" ? "(default - change in production)" : "(from env)", categories });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
