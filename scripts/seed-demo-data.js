#!/usr/bin/env node

/**
 * Seed script for HackerBoard local development.
 * Populates Azurite Table Storage with demo data.
 *
 * Usage:
 *   node scripts/seed-demo-data.js                # seed with defaults
 *   node scripts/seed-demo-data.js --reset        # clear tables first
 *   node scripts/seed-demo-data.js --teams 6 --attendees 30
 */

import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

// Resolve @azure/data-tables from api/ directory
const require = createRequire(new URL("../api/", import.meta.url));
const { TableClient } = require("@azure/data-tables");

const CONNECTION_STRING =
  process.env.AZURE_STORAGE_CONNECTION_STRING || "UseDevelopmentStorage=true";

const TABLE_NAMES = [
  "Teams",
  "Scores",
  "Attendees",
  "Submissions",
  "Awards",
  "Rubrics",
];

const { values: args } = parseArgs({
  options: {
    reset: { type: "boolean", default: false },
    teams: { type: "string", default: "4" },
    attendees: { type: "string", default: "20" },
  },
});

const TEAM_COUNT = parseInt(args.teams, 10);
const ATTENDEE_COUNT = parseInt(args.attendees, 10);

function getClient(tableName) {
  return TableClient.fromConnectionString(CONNECTION_STRING, tableName);
}

async function ensureTable(tableName) {
  const client = getClient(tableName);
  try {
    await client.createTable();
    console.log(`  Created table: ${tableName}`);
  } catch (err) {
    if (err.statusCode === 409) {
      console.log(`  Table exists: ${tableName}`);
    } else {
      throw err;
    }
  }
  return client;
}

async function clearTable(client, tableName) {
  const entities = client.listEntities();
  let count = 0;
  for await (const entity of entities) {
    await client.deleteEntity(entity.partitionKey, entity.rowKey);
    count++;
  }
  if (count > 0) {
    console.log(`  Cleared ${count} entities from ${tableName}`);
  }
}

function generateTeams(count) {
  const adjectives = [
    "Alpha",
    "Beta",
    "Gamma",
    "Delta",
    "Epsilon",
    "Zeta",
    "Theta",
    "Lambda",
  ];
  return Array.from({ length: count }, (_, i) => ({
    partitionKey: "team",
    rowKey: `team-${adjectives[i % adjectives.length].toLowerCase()}`,
    teamName: `Team ${adjectives[i % adjectives.length]}`,
    teamMembers: JSON.stringify([]),
    createdAt: new Date().toISOString(),
  }));
}

function generateAttendees(count, teams) {
  return Array.from({ length: count }, (_, i) => {
    const team = teams[i % teams.length];
    return {
      partitionKey: "attendee",
      rowKey: `user-${i + 1}`,
      displayName: `Hacker ${i + 1}`,
      githubUsername: `hacker${i + 1}`,
      teamId: team.rowKey,
      registeredAt: new Date().toISOString(),
    };
  });
}

function generateScores(teams) {
  return teams.map((team) => {
    const innovation = Math.floor(Math.random() * 30) + 5;
    const implementation = Math.floor(Math.random() * 30) + 5;
    const impact = Math.floor(Math.random() * 25) + 5;
    const presentation = Math.floor(Math.random() * 20) + 5;
    const totalScore = innovation + implementation + impact + presentation;

    return {
      partitionKey: "score",
      rowKey: team.rowKey,
      teamId: team.rowKey,
      teamName: team.teamName,
      innovation,
      implementation,
      impact,
      presentation,
      totalScore,
      bonusPoints: 0,
      status: "approved",
      updatedAt: new Date().toISOString(),
    };
  });
}

const DEFAULT_RUBRIC = {
  partitionKey: "rubric",
  rowKey: "default-rubric",
  name: "Default Hackathon Rubric",
  version: "1.0",
  isActive: true,
  baseTotal: 105,
  bonusTotal: 25,
  categories: JSON.stringify([
    {
      name: "Innovation & Creativity",
      maxPoints: 30,
      criteria: [
        { name: "Originality of idea", maxPoints: 10 },
        { name: "Creative use of technology", maxPoints: 10 },
        { name: "Problem-solving approach", maxPoints: 10 },
      ],
    },
    {
      name: "Technical Implementation",
      maxPoints: 30,
      criteria: [
        { name: "Code quality & organization", maxPoints: 10 },
        { name: "Functionality & completeness", maxPoints: 10 },
        { name: "Use of Azure services", maxPoints: 10 },
      ],
    },
    {
      name: "Impact & Usefulness",
      maxPoints: 25,
      criteria: [
        { name: "Real-world applicability", maxPoints: 10 },
        { name: "Scalability potential", maxPoints: 8 },
        { name: "User experience", maxPoints: 7 },
      ],
    },
    {
      name: "Presentation & Demo",
      maxPoints: 20,
      criteria: [
        { name: "Clarity of presentation", maxPoints: 10 },
        { name: "Live demo quality", maxPoints: 10 },
      ],
    },
  ]),
  bonusItems: JSON.stringify([
    { name: "Uses AI/ML services", points: 5 },
    { name: "Open-source contribution", points: 5 },
    { name: "Accessibility compliance", points: 5 },
    { name: "CI/CD pipeline implemented", points: 5 },
    { name: "Documentation excellence", points: 5 },
  ]),
  gradingScale: JSON.stringify([
    { grade: "A+", label: "Exceptional", minPercent: 95 },
    { grade: "A", label: "Outstanding", minPercent: 90 },
    { grade: "A-", label: "Excellent", minPercent: 85 },
    { grade: "B+", label: "Very Good", minPercent: 80 },
    { grade: "B", label: "Good", minPercent: 75 },
    { grade: "B-", label: "Above Average", minPercent: 70 },
    { grade: "C+", label: "Average", minPercent: 65 },
    { grade: "C", label: "Satisfactory", minPercent: 60 },
    { grade: "C-", label: "Below Average", minPercent: 55 },
    { grade: "D", label: "Needs Improvement", minPercent: 50 },
    { grade: "F", label: "Unsatisfactory", minPercent: 0 },
  ]),
  createdAt: new Date().toISOString(),
};

async function seed() {
  console.log("HackerBoard Seed Script");
  console.log(`  Teams: ${TEAM_COUNT}, Attendees: ${ATTENDEE_COUNT}`);
  console.log("");

  console.log("Ensuring tables exist...");
  const clients = {};
  for (const name of TABLE_NAMES) {
    clients[name] = await ensureTable(name);
  }

  if (args.reset) {
    console.log("\nClearing existing data (--reset)...");
    for (const name of TABLE_NAMES) {
      await clearTable(clients[name], name);
    }
  }

  console.log("\nSeeding teams...");
  const teams = generateTeams(TEAM_COUNT);
  for (const team of teams) {
    await clients.Teams.upsertEntity(team);
  }
  console.log(`  Created ${teams.length} teams`);

  console.log("\nSeeding attendees...");
  const attendees = generateAttendees(ATTENDEE_COUNT, teams);
  for (const attendee of attendees) {
    await clients.Attendees.upsertEntity(attendee);
  }
  console.log(`  Created ${attendees.length} attendees`);

  // Update team member lists
  for (const team of teams) {
    const members = attendees
      .filter((a) => a.teamId === team.rowKey)
      .map((a) => a.githubUsername);
    team.teamMembers = JSON.stringify(members);
    await clients.Teams.upsertEntity(team);
  }
  console.log("  Updated team member lists");

  console.log("\nSeeding scores...");
  const scores = generateScores(teams);
  for (const score of scores) {
    await clients.Scores.upsertEntity(score);
  }
  console.log(`  Created ${scores.length} scores`);

  console.log("\nSeeding default rubric...");
  await clients.Rubrics.upsertEntity(DEFAULT_RUBRIC);
  console.log("  Created default rubric (105+25 model)");

  console.log("\nSeed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
