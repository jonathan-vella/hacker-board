#!/usr/bin/env node

/**
 * Seeds Cosmos DB with teams (Team01 … Team06) and fictitious
 * attendees with per-team numbering for testing.
 *
 * Usage:
 *   node scripts/seed-test-users.js                 # default 18 users
 *   node scripts/seed-test-users.js --users 30      # custom count
 *   node scripts/seed-test-users.js --reset          # delete existing attendees first
 *
 * Requires:
 *   COSMOS_ENDPOINT env var (uses DefaultAzureCredential)
 */

import { CosmosClient } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    users: { type: "string", default: "18" },
    reset: { type: "boolean", default: false },
  },
});

const USER_COUNT = parseInt(args.users, 10);
const TEAM_COUNT = 6;

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
if (!COSMOS_ENDPOINT) {
  console.error("Missing COSMOS_ENDPOINT env var");
  process.exit(1);
}

const client = new CosmosClient({
  endpoint: COSMOS_ENDPOINT,
  aadCredentials: new DefaultAzureCredential(),
});
const db = client.database("hackerboard");

const FIRST_NAMES = [
  "Alice",
  "Bob",
  "Carlos",
  "Dana",
  "Elif",
  "Frank",
  "Grace",
  "Hiro",
  "Ines",
  "Jamal",
  "Kira",
  "Leo",
  "Mia",
  "Navid",
  "Olga",
  "Priya",
  "Quinn",
  "Rosa",
  "Sam",
  "Tanya",
  "Uri",
  "Vera",
  "Will",
  "Xena",
  "Yuki",
  "Zara",
  "Amir",
  "Bea",
  "Chen",
  "Dev",
];

async function deleteAllInContainer(containerName) {
  const container = db.container(containerName);
  const { resources } = await container.items
    .query("SELECT c.id FROM c")
    .fetchAll();
  let deleted = 0;
  for (const doc of resources) {
    try {
      await container.item(doc.id, doc.id).delete();
      deleted++;
    } catch {
      // partition key might differ — try without explicit pk
      try {
        await container.item(doc.id).delete();
        deleted++;
      } catch {
        /* skip */
      }
    }
  }
  return deleted;
}

async function seedTeams() {
  const container = db.container("teams");

  // Delete existing teams
  const deleted = await deleteAllInContainer("teams");
  console.log(`  Deleted ${deleted} old team docs`);

  const teams = [];
  for (let i = 1; i <= TEAM_COUNT; i++) {
    const n = String(i).padStart(2, "0");
    const teamName = `Team${n}`;
    const doc = {
      id: teamName,
      teamName,
      teamNumber: i,
      teamMembers: [],
      createdAt: new Date().toISOString(),
    };
    await container.items.create(doc);
    teams.push(doc);
    console.log(`  Created ${teamName}`);
  }
  return teams;
}

async function seedAttendees(teams) {
  const container = db.container("attendees");

  if (args.reset) {
    const deleted = await deleteAllInContainer("attendees");
    console.log(`  Deleted ${deleted} old attendee docs`);
  }

  // Reset hacker number counter
  const configContainer = db.container("config");
  try {
    await configContainer
      .item("hackerNumberCounter", "hackerNumberCounter")
      .replace({
        id: "hackerNumberCounter",
        currentNumber: 0,
      });
  } catch {
    await configContainer.items.upsert({
      id: "hackerNumberCounter",
      currentNumber: 0,
    });
  }

  const attendees = [];
  const teamMemberCounts = new Map();
  teams.forEach((t) => teamMemberCounts.set(t.teamName, 0));

  for (let i = 0; i < USER_COUNT; i++) {
    const hackerNumber = i + 1;
    const name = FIRST_NAMES[i % FIRST_NAMES.length];
    const suffix =
      i >= FIRST_NAMES.length
        ? String(Math.floor(i / FIRST_NAMES.length) + 1)
        : "";
    const githubUser = `${name.toLowerCase()}${suffix}`;

    // Round-robin assignment with per-team numbering
    const team = teams[i % teams.length];
    const perTeamNum = teamMemberCounts.get(team.teamName) + 1;
    teamMemberCounts.set(team.teamName, perTeamNum);
    const alias = `${team.teamName}-Hacker${String(perTeamNum).padStart(2, "0")}`;

    const doc = {
      id: randomUUID(),
      hackerAlias: alias,
      hackerNumber,
      teamId: team.id,
      teamName: team.teamName,
      gitHubUsername: githubUser,
      registeredAt: new Date().toISOString(),
    };

    await container.items.create(doc);
    attendees.push(doc);
  }

  // Update team member lists
  const teamsContainer = db.container("teams");
  for (const team of teams) {
    const members = attendees
      .filter((a) => a.teamName === team.teamName)
      .map((a) => a.hackerAlias);
    if (members.length > 0) {
      const { resource } = await teamsContainer.item(team.id, team.id).read();
      resource.teamMembers = members;
      await teamsContainer.item(team.id, team.id).replace(resource);
    }
  }

  // Update hacker number counter
  await configContainer
    .item("hackerNumberCounter", "hackerNumberCounter")
    .replace({
      id: "hackerNumberCounter",
      currentNumber: USER_COUNT,
    });

  return attendees;
}

async function main() {
  console.log(
    `\nSeeding ${TEAM_COUNT} teams and ${USER_COUNT} fictitious users...\n`,
  );

  console.log("Step 1: Seeding teams (Team01 … Team06)");
  const teams = await seedTeams();

  console.log(`\nStep 2: Creating ${USER_COUNT} attendees`);
  const attendees = await seedAttendees(teams);

  console.log("\nDone! Summary:");
  for (const team of teams) {
    const count = attendees.filter((a) => a.teamName === team.teamName).length;
    console.log(`  ${team.teamName}: ${count} members`);
  }
  console.log();
}

main().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
