import { test, expect } from "@playwright/test";

function setupMocks(page) {
  return Promise.all([
    page.route("**/.auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          clientPrincipal: {
            userId: "test-user",
            userDetails: "testuser",
            userRoles: ["authenticated", "anonymous"],
            identityProvider: "github",
          },
        }),
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
    page.route("**/api/rubrics/active", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rowKey: "rubric-1",
          name: "Test Rubric",
          isActive: true,
          baseTotal: 100,
          bonusTotal: 10,
          categories: [],
          bonusItems: [],
          gradingScale: [
            { grade: "OUTSTANDING", minPercent: 90 },
            { grade: "EXCELLENT", minPercent: 80 },
            { grade: "GOOD", minPercent: 60 },
            { grade: "NEEDS IMPROVEMENT", minPercent: 0 },
          ],
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
    page.route("**/api/teams", (route) =>
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
    page.route("**/api/submissions*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
    ),
  ]);
}

test.describe("Leaderboard", () => {
  test("loads the dashboard and shows leaderboard", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByText("HackerBoard")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /leaderboard/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("theme toggle switches between light and dark", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /toggle/i });
    await expect(toggle).toBeVisible();
    await toggle.click();
    const theme = await page.locator("html").getAttribute("data-theme");
    expect(theme).toBe("dark");
    await toggle.click();
    const theme2 = await page.locator("html").getAttribute("data-theme");
    expect(theme2).toBe("light");
  });

  test("navigation has correct links", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Leaderboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Awards" })).toBeVisible();
  });

  test("navigating to awards page renders awards section", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/#/awards");
    await expect(page.getByRole("heading", { name: /awards/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("404 page shows for unknown routes", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/#/nonexistent");
    await expect(page.getByText("Page Not Found")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /back to leaderboard/i }),
    ).toBeVisible();
  });
});
