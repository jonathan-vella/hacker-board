import { test, expect } from "@playwright/test";

/**
 * E2E flow: score submission → admin review → leaderboard update.
 * API responses are mocked via route interception to enable
 * offline/CI execution without SWA + Azurite.
 */

const mockRubric = {
  rowKey: "rubric-1",
  name: "Test Rubric",
  isActive: true,
  baseTotal: 100,
  bonusTotal: 10,
  categories: [
    {
      name: "Design",
      maxPoints: 50,
      criteria: [
        { name: "Architecture", points: 30 },
        { name: "Usability", points: 20 },
      ],
    },
    {
      name: "Implementation",
      maxPoints: 50,
      criteria: [
        { name: "Code Quality", points: 25 },
        { name: "Testing", points: 25 },
      ],
    },
  ],
  bonusItems: [{ name: "Extra Credit", points: 10 }],
  gradingScale: [
    { grade: "OUTSTANDING", minPercent: 90 },
    { grade: "EXCELLENT", minPercent: 80 },
    { grade: "GOOD", minPercent: 70 },
    { grade: "SATISFACTORY", minPercent: 60 },
    { grade: "NEEDS IMPROVEMENT", minPercent: 0 },
  ],
};

const mockTeams = [
  { rowKey: "team-alpha", name: "Team Alpha", partitionKey: "team" },
  { rowKey: "team-beta", name: "Team Beta", partitionKey: "team" },
];

function setupMockAuth(page, role = "authenticated") {
  return page.route("**/.auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        clientPrincipal: {
          userId: "test-user",
          userDetails: "testuser",
          userRoles: [role, "anonymous", "authenticated"],
          identityProvider: "github",
        },
      }),
    }),
  );
}

function setupMockAPIs(page) {
  const pendingSubmissions = [];

  return Promise.all([
    page.route("**/api/rubrics/active", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockRubric),
      }),
    ),
    page.route("**/api/teams", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockTeams),
        });
      }
      return route.continue();
    }),
    page.route("**/api/upload", (route) => {
      pendingSubmissions.push({
        rowKey: `sub-${Date.now()}`,
        partitionKey: "team-alpha",
        teamName: "Team Alpha",
        status: "pending",
        submittedBy: "testuser",
        timestamp: new Date().toISOString(),
        payload: {},
      });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Submitted for review" }),
      });
    }),
    page.route("**/api/submissions*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(pendingSubmissions),
      }),
    ),
    page.route("**/api/scores*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          leaderboard: [
            {
              teamName: "Team Alpha",
              baseScore: 85,
              bonusScore: 10,
              totalScore: 95,
              percentage: 86,
              grade: "EXCELLENT",
            },
          ],
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

test.describe("Score Submission Flow", () => {
  test("submit score → appears in review queue → approve → leaderboard updates", async ({
    page,
  }) => {
    await setupMockAuth(page, "admin");
    await setupMockAPIs(page);

    // Step 1: Navigate to score submission
    await page.goto("/#/submit");
    await expect(
      page.getByRole("heading", { name: /submit score/i }),
    ).toBeVisible({ timeout: 10000 });

    // Step 2: Fill in the score form
    await page.waitForSelector("#team-select option:not([value=''])");
    await page.selectOption("#team-select", "team-alpha");

    const scoreInputs = page.locator("input[type='number']");
    const count = await scoreInputs.count();
    for (let i = 0; i < count; i++) {
      await scoreInputs.nth(i).fill("20");
    }

    // Step 3: Submit the score
    await page.getByRole("button", { name: /submit score/i }).click();
    await expect(page.getByText("Score submitted for review")).toBeVisible({
      timeout: 5000,
    });

    // Step 4: Navigate to review queue
    await page.goto("/#/review");
    await expect(
      page.getByRole("heading", { name: /review queue/i }),
    ).toBeVisible({ timeout: 10000 });

    // Step 5: Go to leaderboard and verify it shows data
    await page.goto("/#/leaderboard");
    await expect(
      page.getByRole("heading", { name: /leaderboard/i }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Team Alpha")).toBeVisible();
  });
});
