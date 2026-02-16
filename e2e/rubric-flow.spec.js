import { test, expect } from "@playwright/test";

/**
 * E2E flow: rubric upload → activation → score form adapts.
 * API responses are mocked via route interception.
 */

const initialRubric = {
  rowKey: "rubric-1",
  name: "Original Rubric",
  isActive: true,
  baseTotal: 100,
  bonusTotal: 0,
  categories: [
    {
      name: "Design",
      maxPoints: 100,
      criteria: [{ name: "Architecture", points: 100 }],
    },
  ],
  bonusItems: [],
  gradingScale: [
    { grade: "OUTSTANDING", minPercent: 90 },
    { grade: "GOOD", minPercent: 60 },
    { grade: "NEEDS IMPROVEMENT", minPercent: 0 },
  ],
};

const updatedRubric = {
  rowKey: "rubric-2",
  name: "Updated Rubric",
  isActive: true,
  baseTotal: 130,
  bonusTotal: 25,
  categories: [
    {
      name: "Security",
      maxPoints: 65,
      criteria: [
        { name: "IAM", points: 35 },
        { name: "Network", points: 30 },
      ],
    },
    {
      name: "Reliability",
      maxPoints: 65,
      criteria: [
        { name: "Backup", points: 30 },
        { name: "Monitoring", points: 35 },
      ],
    },
  ],
  bonusItems: [{ name: "Bonus Deploy", points: 25 }],
  gradingScale: [
    { grade: "OUTSTANDING", minPercent: 90 },
    { grade: "GOOD", minPercent: 60 },
    { grade: "NEEDS IMPROVEMENT", minPercent: 0 },
  ],
};

let activeRubric = initialRubric;

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
    page.route("**/api/rubrics/active", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(activeRubric),
      }),
    ),
    page.route("**/api/rubrics", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([initialRubric, updatedRubric]),
        });
      }
      if (route.request().method() === "POST") {
        activeRubric = updatedRubric;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ message: "Rubric created and activated" }),
        });
      }
      return route.continue();
    }),
    page.route("**/api/teams", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { rowKey: "team-1", name: "Team One", partitionKey: "team" },
        ]),
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

test.describe("Rubric Upload Flow", () => {
  test.beforeEach(() => {
    activeRubric = initialRubric;
  });

  test("score form shows categories from active rubric", async ({ page }) => {
    await setupMockAuth(page);
    await setupMockAPIs(page);

    await page.goto("/#/submit");
    await expect(
      page.getByRole("heading", { name: /submit score/i }),
    ).toBeVisible({ timeout: 10000 });

    // The initial rubric has "Design" category with "Architecture" criterion
    await expect(page.getByText("Design")).toBeVisible();
    await expect(page.getByText("Architecture")).toBeVisible();
  });

  test("rubric manager shows list of rubrics", async ({ page }) => {
    await setupMockAuth(page);
    await setupMockAPIs(page);

    await page.goto("/#/rubrics");
    await expect(
      page.getByRole("heading", { name: /rubric management/i }),
    ).toBeVisible({ timeout: 10000 });

    await expect(page.getByText("Original Rubric")).toBeVisible();
    await expect(page.getByText("Upload New Rubric")).toBeVisible();
  });

  test("after rubric activation, score form shows new categories", async ({
    page,
  }) => {
    await setupMockAuth(page);
    await setupMockAPIs(page);

    // First verify original rubric categories in score form
    await page.goto("/#/submit");
    await expect(page.getByText("Design")).toBeVisible({ timeout: 10000 });

    // Simulate rubric switch by changing the active rubric
    activeRubric = updatedRubric;

    // Navigate to score form again (forces re-render with new rubric)
    await page.goto("/#/leaderboard");
    await page.goto("/#/submit");

    // Updated rubric should show Security and Reliability
    await expect(page.getByText("Security")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Reliability")).toBeVisible();
    await expect(page.getByText("IAM")).toBeVisible();
    await expect(page.getByText("Bonus Deploy")).toBeVisible();
  });
});
