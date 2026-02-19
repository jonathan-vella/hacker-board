#!/usr/bin/env node

/**
 * Seed script for HackerBoard local development and demo environments.
 * Populates Azure SQL with demo teams, attendees, scores, rubric, and feature flags.
 *
 * Usage:
 *   node scripts/seed-demo-data.js                # seed with defaults
 *   node scripts/seed-demo-data.js --reset        # truncate first, then seed
 *   node scripts/seed-demo-data.js --teams 6 --attendees 30
 *
 * Required environment variables (same as api/shared/db.js):
 *   SQL_SERVER_FQDN      — Azure SQL server FQDN
 *   SQL_DATABASE_NAME    — Azure SQL database name
 *
 * Optional (local dev override):
 *   SQL_CONNECTION_STRING — full mssql connection string
 */

import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import sql from "mssql";
import { DefaultAzureCredential } from "@azure/identity";

const SQL_SERVER_FQDN = process.env.SQL_SERVER_FQDN;
const SQL_DATABASE_NAME = process.env.SQL_DATABASE_NAME;
const SQL_CONNECTION_STRING = process.env.SQL_CONNECTION_STRING;

const { values: args } = parseArgs({
  options: {
    reset: { type: "boolean", default: false },
    teams: { type: "string", default: "4" },
    attendees: { type: "string", default: "20" },
  },
});

const TEAM_COUNT = parseInt(args.teams, 10);
const ATTENDEE_COUNT = parseInt(args.attendees, 10);

async function buildConfig() {
  if (SQL_CONNECTION_STRING) {
    return { connectionString: SQL_CONNECTION_STRING };
  }

  if (!SQL_SERVER_FQDN || !SQL_DATABASE_NAME) {
    console.error("❌  Missing required env vars: SQL_SERVER_FQDN and SQL_DATABASE_NAME");
    process.exit(1);
  }

  const credential = new DefaultAzureCredential();
  const tokenResponse = await credential.getToken("https://database.windows.net/.default");

  return {
    server: SQL_SERVER_FQDN,
    database: SQL_DATABASE_NAME,
    options: { encrypt: true, trustServerCertificate: false },
    authentication: {
      type: "azure-active-directory-access-token",
      options: { token: tokenResponse.token },
    },
  };
}

const DEFAULT_RUBRIC_CATEGORIES = JSON.stringify([
  {
    name: "Innovation & Creativity", maxPoints: 30,
    criteria: [
      { name: "Originality of idea", maxPoints: 10 },
      { name: "Creative use of technology", maxPoints: 10 },
      { name: "Problem-solving approach", maxPoints: 10 },
    ],
  },
  {
    name: "Technical Implementation", maxPoints: 30,
    criteria: [
      { name: "Code quality & organization", maxPoints: 10 },
      { name: "Functionality & completeness", maxPoints: 10 },
      { name: "Use of Azure services", maxPoints: 10 },
    ],
  },
  {
    name: "Impact & Usefulness", maxPoints: 25,
    criteria: [
      { name: "Real-world applicability", maxPoints: 10 },
      { name: "Scalability potential", maxPoints: 8 },
      { name: "User experience", maxPoints: 7 },
    ],
  },
  {
    name: "Presentation & Demo", maxPoints: 20,
    criteria: [
      { name: "Clarity of presentation", maxPoints: 10 },
      { name: "Live demo quality", maxPoints: 10 },
    ],
  },
]);

const DEFAULT_BONUS_ITEMS = JSON.stringify([
  { name: "Uses AI/ML services", points: 5 },
  { name: "Open-source contribution", points: 5 },
  { name: "Accessibility compliance", points: 5 },
  { name: "CI/CD pipeline implemented", points: 5 },
  { name: "Documentation excellence", points: 5 },
]);

async function seed() {
  console.log("");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║     HackerBoard — Demo Data Seed         ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`  Teams: ${TEAM_COUNT}, Attendees: ${ATTENDEE_COUNT}`);
  console.log("");

  const config = await buildConfig();
  const pool = await sql.connect(config);
  console.log(`✅ Connected to ${SQL_SERVER_FQDN ?? "local"}`);

  if (args.reset) {
    console.log("\n🗑️  Resetting data (--reset)...");
    await pool.request().query(`
      DELETE FROM dbo.Scores;
      DELETE FROM dbo.Awards;
      DELETE FROM dbo.Submissions;
      DELETE FROM dbo.Attendees;
      DELETE FROM dbo.Teams;
      DELETE FROM dbo.Rubrics;
      DELETE FROM dbo.Config;
    `);
    await pool.request().query(
      "ALTER SEQUENCE dbo.HackerNumberSequence RESTART WITH 1",
    );
    console.log("  ✅ All tables cleared, sequence reset");
  }

  // ── Teams ──────────────────────────────────────────────────────────────────
  console.log("\n🏆 Seeding teams...");
  const teamRows = [];
  for (let i = 0; i < TEAM_COUNT; i++) {
    const n = String(i + 1).padStart(2, "0");
    const teamName = `Team${n}`;
    const req = pool.request();
    req.input("teamName", sql.NVarChar, teamName);
    req.input("teamNumber", sql.Int, i + 1);
    const result = await req.query(`
      MERGE dbo.Teams AS t
      USING (SELECT @teamName AS teamName) AS s ON t.teamName = s.teamName
      WHEN NOT MATCHED THEN INSERT (teamName, teamNumber) VALUES (@teamName, @teamNumber)
      WHEN MATCHED THEN UPDATE SET teamNumber = @teamNumber
      OUTPUT INSERTED.id, INSERTED.teamName;
    `);
    teamRows.push(result.recordset[0]);
  }
  console.log(`  ✅ Created ${teamRows.length} teams`);

  // ── Attendees ──────────────────────────────────────────────────────────────
  console.log("\n👩‍💻 Seeding attendees...");
  const attendeeRows = [];
  for (let i = 0; i < ATTENDEE_COUNT; i++) {
    const team = teamRows[i % teamRows.length];
    const h = String(i + 1).padStart(2, "0");
    const hackerAlias = `Hacker${h}`;
    const gitHubUsername = `demo-hacker-${i + 1}`;

    const req = pool.request();
    req.input("hackerAlias", sql.NVarChar, hackerAlias);
    req.input("hackerNumber", sql.Int, i + 1);
    req.input("teamId", sql.Int, team.id);
    req.input("gitHubUsername", sql.NVarChar, gitHubUsername);
    const result = await req.query(`
      MERGE dbo.Attendees AS a
      USING (SELECT @hackerAlias AS hackerAlias) AS s ON a.hackerAlias = s.hackerAlias
      WHEN NOT MATCHED THEN
        INSERT (hackerAlias, hackerNumber, teamId, gitHubUsername)
        VALUES (@hackerAlias, @hackerNumber, @teamId, @gitHubUsername)
      WHEN MATCHED THEN
        UPDATE SET hackerNumber = @hackerNumber, teamId = @teamId, gitHubUsername = @gitHubUsername
      OUTPUT INSERTED.id, INSERTED.hackerAlias, INSERTED.teamId;
    `);
    attendeeRows.push(result.recordset[0]);
  }
  // Update team member lists
  for (const team of teamRows) {
    const members = attendeeRows
      .filter((a) => a.teamId === team.id)
      .map((a) => a.hackerAlias);
    const req = pool.request();
    req.input("id", sql.Int, team.id);
    req.input("teamMembers", sql.NVarChar, JSON.stringify(members));
    await req.query("UPDATE dbo.Teams SET teamMembers = @teamMembers WHERE id = @id");
  }
  console.log(`  ✅ Created ${attendeeRows.length} anonymous hackers, updated team rosters`);

  // ── Scores ─────────────────────────────────────────────────────────────────
  console.log("\n📊 Seeding scores...");
  const categories = [
    { name: "Innovation & Creativity", criterion: "Originality", maxPoints: 30 },
    { name: "Technical Implementation", criterion: "Code quality", maxPoints: 30 },
    { name: "Impact & Usefulness", criterion: "Real-world applicability", maxPoints: 25 },
    { name: "Presentation & Demo", criterion: "Clarity", maxPoints: 20 },
  ];
  let scoreCount = 0;
  for (const team of teamRows) {
    for (const cat of categories) {
      const points = Math.floor(Math.random() * cat.maxPoints * 0.7) + Math.floor(cat.maxPoints * 0.3);
      const req = pool.request();
      req.input("teamId", sql.Int, team.id);
      req.input("category", sql.NVarChar, cat.name);
      req.input("criterion", sql.NVarChar, cat.criterion);
      req.input("points", sql.Decimal(10, 2), points);
      req.input("maxPoints", sql.Decimal(10, 2), cat.maxPoints);
      req.input("scoredBy", sql.NVarChar, "seed-script");
      await req.query(`
        MERGE dbo.Scores AS s
        USING (SELECT @teamId AS teamId, @category AS category, @criterion AS criterion) AS src
          ON s.teamId = src.teamId AND s.category = src.category AND s.criterion = src.criterion
        WHEN NOT MATCHED THEN
          INSERT (teamId, category, criterion, points, maxPoints, scoredBy)
          VALUES (@teamId, @category, @criterion, @points, @maxPoints, @scoredBy)
        WHEN MATCHED THEN
          UPDATE SET points = @points, scoredBy = @scoredBy;
      `);
      scoreCount++;
    }
  }
  console.log(`  ✅ Created ${scoreCount} score rows`);

  // ── Rubric ─────────────────────────────────────────────────────────────────
  console.log("\n📋 Seeding default rubric...");
  const rubricId = randomUUID();
  const rreq = pool.request();
  rreq.input("id", sql.NVarChar, rubricId);
  rreq.input("name", sql.NVarChar, "Default Hackathon Rubric");
  rreq.input("version", sql.NVarChar, "1.0");
  rreq.input("categories", sql.NVarChar, DEFAULT_RUBRIC_CATEGORIES);
  rreq.input("bonusItems", sql.NVarChar, DEFAULT_BONUS_ITEMS);
  rreq.input("baseTotal", sql.Int, 105);
  rreq.input("bonusTotal", sql.Int, 25);
  await rreq.query(`
    MERGE dbo.Rubrics AS r
    USING (SELECT @name AS name) AS s ON r.name = s.name
    WHEN NOT MATCHED THEN
      INSERT (id, name, version, categories, bonusItems, baseTotal, bonusTotal, isActive)
      VALUES (@id, @name, @version, @categories, @bonusItems, @baseTotal, @bonusTotal, 1)
    WHEN MATCHED THEN
      UPDATE SET version = @version, isActive = 1;
  `);
  console.log("  ✅ Created default rubric (105+25 model)");

  // ── Feature flags ──────────────────────────────────────────────────────────
  console.log("\n🚩 Seeding feature flags...");
  const flags = {
    SUBMISSIONS_ENABLED: "true",
    LEADERBOARD_LOCKED: "false",
    REGISTRATION_OPEN: "true",
    AWARDS_VISIBLE: "true",
    RUBRIC_UPLOAD_ENABLED: "true",
  };
  for (const [key, value] of Object.entries(flags)) {
    const freq = pool.request();
    freq.input("configKey", sql.NVarChar, key);
    freq.input("configValue", sql.NVarChar, value);
    await freq.query(`
      MERGE dbo.Config AS c
      USING (SELECT @configKey AS configKey) AS s ON c.configKey = s.configKey
      WHEN NOT MATCHED THEN INSERT (configKey, configValue) VALUES (@configKey, @configValue)
      WHEN MATCHED THEN UPDATE SET configValue = @configValue;
    `);
  }
  console.log(`  ✅ Set ${Object.keys(flags).length} feature flags`);

  await pool.close();
  console.log("\n✅ Seed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
