import { config } from "dotenv";
config();

import { PrismaClient, DayOfWeek } from "@prisma/client";
import bcrypt from "bcryptjs";
import { IANAZone } from "luxon";

const prisma = new PrismaClient();

function getArgValue(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (index === -1) return undefined;
  if (args[index].includes("=")) {
    return args[index].split("=")[1];
  }
  return args[index + 1];
}

async function main() {
  console.log("==================================================");
  console.log("⚡ Slotbook: Production Host Provisioning");
  console.log("==================================================");

  const name = getArgValue("--name") || process.env.HOST_NAME;
  const email = getArgValue("--email") || process.env.HOST_EMAIL;
  const slug = getArgValue("--slug") || process.env.HOST_SLUG;
  const timezone = getArgValue("--timezone") || process.env.HOST_TIMEZONE || "UTC";
  const password = getArgValue("--password") || process.env.HOST_PASSWORD;

  if (!name || !email || !slug || !password) {
    console.error("Usage: npm run create-host -- --name <name> --email <email> --slug <slug> --timezone <tz> --password <password>");
    console.error("Or set HOST_NAME, HOST_EMAIL, HOST_SLUG, HOST_TIMEZONE, HOST_PASSWORD environment variables.");
    process.exit(1);
  }

  // 1. Validate timezone
  if (!IANAZone.isValidSpecifier(timezone)) {
    console.error(`Error: '${timezone}' is not a valid IANA timezone specifier.`);
    process.exit(1);
  }

  // 2. Validate slug format
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugRegex.test(slug)) {
    console.error("Error: Slug must be lowercase alphanumeric with hyphens (e.g. 'john-doe').");
    process.exit(1);
  }

  // 3. Validate password strength
  if (password.length < 8) {
    console.error("Error: Password must be at least 8 characters long.");
    process.exit(1);
  }

  // 4. Check if host already exists
  const existing = await prisma.host.findFirst({
    where: { OR: [{ email }, { slug }] },
  });

  if (existing) {
    console.error(`Error: A host with email '${email}' or slug '${slug}' already exists.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // 5. Create host transactionally with default event type and weekday availability
  const result = await prisma.$transaction(async (tx) => {
    const host = await tx.host.create({
      data: {
        name,
        email,
        slug,
        timezone,
        passwordHash,
      },
    });

    // Default 30-minute meeting
    const eventType = await tx.eventType.create({
      data: {
        hostId: host.id,
        title: "30-Minute Meeting",
        slug: "30-min-meeting",
        description: "Initial introductory meeting or discussion session.",
        duration: 30,
        bufferBefore: 5,
        bufferAfter: 5,
        location: "Video Call",
        isActive: true,
      },
    });

    // Default Monday-Friday 09:00 - 17:00 availability
    const weekdays = [
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
    ];

    const defaultStartTime = new Date("1970-01-01T09:00:00.000Z");
    const defaultEndTime = new Date("1970-01-01T17:00:00.000Z");

    await tx.availability.createMany({
      data: weekdays.map((day) => ({
        hostId: host.id,
        dayOfWeek: day,
        startTime: defaultStartTime,
        endTime: defaultEndTime,
      })),
    });

    return { host, eventType };
  });

  console.log(`\n✅ Host created successfully:`);
  console.log(`  - Name:     ${result.host.name}`);
  console.log(`  - Email:    ${result.host.email}`);
  console.log(`  - Slug:     ${result.host.slug}`);
  console.log(`  - Timezone: ${result.host.timezone}`);
  console.log(`  - Booking:  /book/${result.host.slug}/${result.eventType.slug}`);
  console.log(`  - Login:    /login\n`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error creating host:", err);
  prisma.$disconnect();
  process.exit(1);
});

