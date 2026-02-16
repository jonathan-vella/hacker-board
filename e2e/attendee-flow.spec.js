import { test, expect } from "@playwright/test";

/**
 * E2E flow: attendee bulk import → team assignment → roster display.
 * API responses are mocked via route interception.
 */

let attendees = [];
let teams = [];

function setupMockAuth(page) {
  return page.route("**/.auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        clientPrincipal: {
          userId: "admin-user",
          userDetails: "adminuser",
          userRoles: ["admin", "anonymous", "authenticated"],
          identityProvider: "github",
        },
      }),
    }),
  );
}

function setupMockAPIs(page) {
  return Promise.all([
    page.route("**/api/attendees/bulk", (route) => {
      const body = route.request().postDataJSON();
      const entries = Array.isArray(body) ? body : body.entries || [];
      entries.forEach((e, i) => {
        attendees.push({
          rowKey: `att-${i}-${Date.now()}`,
          partitionKey: "unclaimed",
          name: e.name,
          displayName: e.name,
          email: e.email || "",
        });
      });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          created: entries.length,
          duplicates: 0,
        }),
      });
    }),
    page.route("**/api/attendees", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(attendees),
      }),
    ),
    page.route("**/api/teams/assign", (route) => {
      const body = route.request().postDataJSON();
      const teamCount = body.teamCount || 4;
      teams = [];
      for (let i = 1; i <= teamCount; i++) {
        teams.push({
          rowKey: `team-${i}`,
          name: `Team ${i}`,
          partitionKey: "team",
        });
      }

      const assigned = attendees.map((a, idx) => ({
        ...a,
        teamName: `Team ${(idx % teamCount) + 1}`,
      }));
      attendees = assigned;

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          teamsCreated: teamCount,
          attendeesAssigned: attendees.length,
          teams: teams.map((t) => ({
            name: t.name,
            members: assigned
              .filter((a) => a.teamName === t.name)
              .map((a) => a.displayName),
          })),
        }),
      });
    }),
    page.route("**/api/teams", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(teams),
      }),
    ),
    page.route("**/api/scores*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          leaderboard: [],
          lastUpdated: new Date().toISOString(),
        }),
      }),
    ),
    page.route("**/api/awards", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
    ),
    page.route("**/api/rubrics/active", (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "No active rubric" } }),
      }),
    ),
    page.route("**/api/submissions*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
    ),
    page.route("**/api/flags", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          flags: {
            SUBMISSIONS_ENABLED: true,
            LEADERBOARD_LOCKED: false,
            REGISTRATION_OPEN: true,
            AWARDS_VISIBLE: true,
            RUBRIC_UPLOAD_ENABLED: true,
          },
          descriptions: {},
        }),
      }),
    ),
  ]);
}

test.describe("Attendee & Team Assignment Flow", () => {
  test.beforeEach(() => {
    attendees = [];
    teams = [];
  });

  test("bulk import attendees via paste", async ({ page }) => {
    await setupMockAuth(page);
    await setupMockAPIs(page);

    await page.goto("/#/attendees");
    await expect(
      page.getByRole("heading", { name: /attendee management/i }),
    ).toBeVisible({ timeout: 10000 });

    const textarea = page.locator("#bulk-input");
    await textarea.fill("Alice Smith\nBob Jones\nCarol White\nDave Brown");
    await page.getByRole("button", { name: /import/i }).click();

    await expect(page.getByText(/imported 4 attendees/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("assign attendees to teams", async ({ page }) => {
    attendees = [
      {
        rowKey: "att-1",
        partitionKey: "unclaimed",
        name: "Alice",
        displayName: "Alice",
      },
      {
        rowKey: "att-2",
        partitionKey: "unclaimed",
        name: "Bob",
        displayName: "Bob",
      },
      {
        rowKey: "att-3",
        partitionKey: "unclaimed",
        name: "Carol",
        displayName: "Carol",
      },
      {
        rowKey: "att-4",
        partitionKey: "unclaimed",
        name: "Dave",
        displayName: "Dave",
      },
    ];

    await setupMockAuth(page);
    await setupMockAPIs(page);

    await page.goto("/#/assign");
    await expect(
      page.getByRole("heading", { name: /team assignment/i }),
    ).toBeVisible({ timeout: 10000 });

    await page.fill("#team-count", "2");

    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /assign teams/i }).click();

    await expect(page.getByText(/created 2 teams/i)).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("Team 1")).toBeVisible();
    await expect(page.getByText("Team 2")).toBeVisible();
  });

  test("team roster shows assigned members", async ({ page }) => {
    teams = [
      { rowKey: "team-1", name: "Team 1", partitionKey: "team" },
      { rowKey: "team-2", name: "Team 2", partitionKey: "team" },
    ];
    attendees = [
      {
        rowKey: "att-1",
        partitionKey: "claimed",
        displayName: "Alice",
        teamName: "Team 1",
      },
      {
        rowKey: "att-2",
        partitionKey: "claimed",
        displayName: "Bob",
        teamName: "Team 1",
      },
      {
        rowKey: "att-3",
        partitionKey: "claimed",
        displayName: "Carol",
        teamName: "Team 2",
      },
    ];

    await setupMockAuth(page);
    await setupMockAPIs(page);

    await page.goto("/#/teams");
    await expect(
      page.getByRole("heading", { name: /team roster/i }),
    ).toBeVisible({ timeout: 10000 });

    await expect(page.getByText("Team 1")).toBeVisible();
    await expect(page.getByText("2 members")).toBeVisible();
    await expect(page.getByText("Alice")).toBeVisible();
    await expect(page.getByText("Bob")).toBeVisible();

    await expect(page.getByText("Team 2")).toBeVisible();
    await expect(page.getByText("1 member")).toBeVisible();
    await expect(page.getByText("Carol")).toBeVisible();
  });
});
