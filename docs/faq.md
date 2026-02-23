# HackerBoard — FAQ

![Type](https://img.shields.io/badge/Type-FAQ-blue)
![Updated](https://img.shields.io/badge/Updated-2026--02--23-lightgrey)

---

## Deployment & Infrastructure

**Q: What does it cost to run HackerBoard?**

Approximately **$18.15/month** at low traffic:

- App Service Plan (S1 Linux): ~$13.14/month
- Container Registry (Basic): ~$5.00/month
- Cosmos DB NoSQL (Serverless): ~$0.01 at idle — scales with actual usage

During an active event, Cosmos DB costs more but remains well under $1/day for a typical MicroHack.

---

**Q: Can I run HackerBoard in a different Azure region?**

Yes. Pass the `-Location` parameter to `deploy.ps1`:

```powershell
./deploy.ps1 -Location "eastus" -CostCenter "..." -TechnicalContact "..." ...
```

All resource names use the project name as a prefix and are region-agnostic.

---

**Q: What's the minimum App Service SKU?**

B1 is the minimum that supports regional VNet integration (required for the Cosmos DB Private Endpoint). The default is S1 — the subscription used during initial deployment had no P1v3 quota in `centralus` and S1 is the next appropriate tier.

If you want to reduce cost, you can try B1 by passing `-SkuName B1` if the parameter is exposed, or by editing `infra/modules/app-service.bicep` before deploying.

---

**Q: Can I skip the VNet and Private Endpoint to save cost?**

No. The `ModifyCosmosDBLocalAuth` governance policy disables Cosmos DB public network access automatically. The Private Endpoint is the only path for the App Service to reach Cosmos DB.

---

**Q: Do I need to keep the GitHub OAuth App active after the event?**

The OAuth App must remain active for users to sign in. If you decommission HackerBoard, delete the OAuth App in GitHub settings and run `az group delete --name rg-hacker-board-prod` to tear down all Azure resources.

---

**Q: Can I redeploy without losing data?**

Yes. `deploy.ps1` uses Incremental deployment mode — it updates changed resources and leaves existing ones (including Cosmos DB data) untouched. Cosmos DB Serverless does not wipe data on redeployment.

---

**Q: The `deploy.ps1` script requires PowerShell 7. Can I run it differently?**

The script uses PowerShell 7 syntax (splatting, `ConvertFrom-Json`, structured error handling). You can install PowerShell 7 on macOS or Linux via [the official installer](https://learn.microsoft.com/powershell/scripting/install/installing-powershell) and run `pwsh infra/deploy.ps1 ...`.

Alternatively, the underlying `az deployment group create` command can be run directly, but you lose the pre-flight validation and post-deploy verification steps.

---

## Operations & Admin

**Q: How do I add a new admin after the initial deployment?**

Re-run `deploy.ps1` with the updated `-AdminUsers` value:

```powershell
./deploy.ps1 `
  -CostCenter "microhack" `
  -TechnicalContact "you@contoso.com" `
  -GitHubOAuthClientId "<id>" `
  -GitHubOAuthClientSecret "<secret>" `
  -AdminUsers "github:octocat,github:newadmin"
```

The `ADMIN_USERS` app setting is updated in place. Changes take effect on the next request — no restart required.

---

**Q: Can participants change their team after assignment?**

Not through the UI. An admin can update the attendee's team assignment via the API (`PUT /api/attendees/:id`). The API spec is in [api-spec.md](api-spec.md).

---

**Q: How do I reset all scores and start fresh between events?**

```bash
node scripts/cleanup-app-data.js
```

This removes scores, submissions, and attendees but leaves teams and rubrics in place. For a full reset (including teams), use the `--all` flag if available, or manually delete and re-seed via the admin UI.

---

**Q: How do I update the scoring rubric mid-event?**

1. Upload the new Markdown rubric in **Admin → Rubric**
2. Click **Set as Active**

Existing approved scores are not affected — they were recorded with the previous rubric's category values. New submissions will use the updated rubric.

---

**Q: Can I run multiple events on the same deployment?**

Yes, but scores and attendees from previous events will still be visible in the leaderboard. To start clean, run `node scripts/cleanup-app-data.js` between events. You can change the rubric without cleaning up — the leaderboard will use whatever is active.

---

**Q: How do I seed the app with test data for a demo or dry run?**

```bash
COSMOS_ENDPOINT=https://cosmos-hacker-board-prod.documents.azure.com:443/ \
  node scripts/seed-demo-data.js --reset
```

This requires a valid `az login` session so `DefaultAzureCredential` can authenticate to Cosmos DB.

---

## Authentication

**Q: A participant gets "forbidden" even after signing in. What's wrong?**

If the participant sees a 403 rather than being redirected to login, they are authenticated but not authorised. Most likely:

1. They are trying to access an admin-only route while not listed in `ADMIN_USERS` — this is expected behaviour.
2. Their GitHub account is signed into the wrong identity. Ask them to sign out (`/.auth/logout`) and back in.

---

**Q: Can participants sign in without a GitHub account?**

No. GitHub OAuth is the only authentication provider configured. All participants need a GitHub account.

---

**Q: Does HackerBoard store GitHub personal data?**

Only the GitHub username and display name from the OAuth claims — both visible to the user in their own profile. No email addresses or other personal data are stored. Attendee profiles use aliases by default (the real name is not required).

---

## Application

**Q: The leaderboard is not auto-refreshing.**

The leaderboard polls `/api/teams` every 30 seconds. If it stops updating:

- Check the browser console for errors
- Verify `/api/health` returns 200
- Hard-refresh the page (Ctrl + Shift + R)

---

**Q: A submission was approved by mistake. Can it be undone?**

Use **Admin → Review Queue → Override** to correct the score values for an already-approved submission. There is no "unapprove" action — the override replaces the score in place.

---

**Q: Can the same team submit scores more than once?**

Yes. Each submission creates a separate Pending record in the queue. The admin chooses which submission to approve — only the most recently approved submission's score is used for the leaderboard.

---

**Q: How are grades calculated?**

```
grade = (approvedBaseScore / rubricMaxBaseScore) × 100
```

The `rubricMaxBaseScore` comes from the active rubric. Bonus points are added to the total score shown on the leaderboard but do not affect the grade percentage.

---

**Q: What happens if no rubric is active?**

The score submission form and JSON upload will return an error. Set an active rubric in **Admin → Rubric** before the event starts.

---

[← Back to Documentation](README.md)
