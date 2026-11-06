import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verify() {
  console.log("================ DATABASE VERIFICATION ================\n");

  // 1. Verify tables
  const tables: Array<{ table_name: string }> = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name != '_prisma_migrations'
    ORDER BY table_name;
  `);
  console.log(`📋 Tables found (${tables.length}):`);
  tables.forEach((t) => console.log(`   - ${t.table_name}`));

  // 2. Verify Enums
  const enums: Array<{ typname: string }> = await prisma.$queryRawUnsafe(`
    SELECT t.typname 
    FROM pg_type t 
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace 
    WHERE n.nspname = 'public' AND t.typtype = 'e'
    ORDER BY t.typname;
  `);
  console.log(`\n🏷️ Enums found (${enums.length}):`);
  enums.forEach((e) => console.log(`   - ${e.typname}`));

  // 3. Verify Foreign Keys and ON DELETE behavior
  const foreignKeys: Array<{
    constraint_name: string;
    table_name: string;
    column_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
    delete_rule: string;
  }> = await prisma.$queryRawUnsafe(`
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name;
  `);
  console.log(`\n🔗 Foreign Keys found (${foreignKeys.length}):`);
  foreignKeys.forEach((fk) =>
    console.log(
      `   - ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name} (ON DELETE: ${fk.delete_rule})`
    )
  );

  // 4. Verify Check Constraints
  const checkConstraints: Array<{
    table_name: string;
    conname: string;
    consrc: string;
  }> = await prisma.$queryRawUnsafe(`
    SELECT
      rel.relname AS table_name,
      con.conname,
      pg_get_constraintdef(con.oid) AS consrc
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = con.connamespace
    WHERE con.contype = 'c' AND nsp.nspname = 'public'
    ORDER BY rel.relname, con.conname;
  `);
  console.log(`\n🛡️ Check Constraints found (${checkConstraints.length}):`);
  checkConstraints.forEach((c) =>
    console.log(`   - ${c.table_name}: ${c.conname} => ${c.consrc}`)
  );

  // 5. Verify Indexes
  const indexes: Array<{ tablename: string; indexname: string; indexdef: string }> =
    await prisma.$queryRawUnsafe(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
    ORDER BY tablename, indexname;
  `);
  console.log(`\n⚡ Indexes found (${indexes.length}):`);
  indexes.forEach((i) => console.log(`   - ${i.tablename}.${i.indexname}`));

  // 6. Verify Seeded Records
  const hosts = await prisma.host.findMany({
    include: {
      eventTypes: true,
      availabilities: true,
      dateOverrides: true,
    },
  });

  console.log(`\n🌱 Seeded Records Verification:`);
  console.log(`   - Hosts count: ${hosts.length}`);
  for (const h of hosts) {
    console.log(`     • Host: ${h.name} (${h.email}) | Timezone: ${h.timezone}`);
    console.log(`       EventTypes (${h.eventTypes.length}):`);
    h.eventTypes.forEach((et) =>
      console.log(`         * ${et.title} [slug: ${et.slug}, duration: ${et.duration}m, buffer: ${et.bufferBefore}+${et.bufferAfter}m]`)
    );
    console.log(`       Availability windows (${h.availabilities.length}):`);
    h.availabilities.forEach((a) =>
      console.log(`         * ${a.dayOfWeek}: ${a.startTime.toISOString().substring(11, 16)} - ${a.endTime.toISOString().substring(11, 16)}`)
    );
    console.log(`       Date Overrides (${h.dateOverrides.length}):`);
    h.dateOverrides.forEach((o) =>
      console.log(
        `         * ${o.date.toISOString().substring(0, 10)}: isUnavailable=${o.isUnavailable}${
          o.startTime ? ` (${o.startTime.toISOString().substring(11, 16)} - ${o.endTime?.toISOString().substring(11, 16)})` : ""
        }`
      )
    );
  }

  // 7. Test Check Constraint Enforcement
  console.log(`\n🧪 Testing PostgreSQL CHECK Constraint Enforcement:`);
  try {
    const hostId = hosts[0].id;
    const eventTypeId = hosts[0].eventTypes[0].id;
    // Attempt inserting invalid booking where endAt is BEFORE startAt
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Booking" ("id", "hostId", "eventTypeId", "guestName", "guestEmail", "startAt", "endAt", "status", "createdAt", "updatedAt")
      VALUES (
        '00000000-0000-0000-0000-000000000099',
        '${hostId}',
        '${eventTypeId}',
        'Invalid Guest',
        'invalid@example.com',
        '2026-11-10 10:00:00+00',
        '2026-11-10 09:00:00+00',
        'CONFIRMED',
        NOW(),
        NOW()
      );
    `);
    console.log("   ❌ FAILED: Check constraint did not reject invalid booking!");
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("check_booking_start_before_end")) {
      console.log("   ✅ PASSED: 'check_booking_start_before_end' successfully rejected invalid start/end timestamps!");
    } else if (err instanceof Error) {
      console.log("   ⚠️ Unexpected error during constraint test:", err.message);
    } else {
      console.log("   ⚠️ Unknown error during constraint test:", String(err));
    }
  }

  console.log("\n========================================================");
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
