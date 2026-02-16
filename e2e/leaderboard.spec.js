import { test, expect } from "@playwright/test";

test.describe("Leaderboard", () => {
  test("loads the dashboard and shows leaderboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByText("HackerBoard")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /leaderboard/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("theme toggle switches between light and dark", async ({ page }) => {
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
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Leaderboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Awards" })).toBeVisible();
  });

  test("navigating to awards page renders awards section", async ({ page }) => {
    await page.goto("/#/awards");
    await expect(page.getByRole("heading", { name: /awards/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("404 page shows for unknown routes", async ({ page }) => {
    await page.goto("/#/nonexistent");
    await expect(page.getByText("Page Not Found")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /back to leaderboard/i }),
    ).toBeVisible();
  });
});
