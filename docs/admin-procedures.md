# Admin Procedures

![Type](https://img.shields.io/badge/Type-Procedures-blue)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Auth](https://img.shields.io/badge/Auth-GitHub%20OAuth%20%2B%20Entra%20ID-181717)

> Operational runbook for assigning admins, running event-day admin workflows,
> and resetting application data between events.

## Application Administrator

By default, the Entra user running the deployment is automatically configured as the application administrator via **Entra ID app role assignment** — no separate invite step is required. During deployment, a Bicep `deploymentScript` creates an Entra ID app registration with an `admin` app role and assigns the deployer to it.

The SWA system-assigned managed identity is also granted the **Cosmos DB Built-in Data Contributor** role for data access.

This auto-configuration happens in two ways depending on the deployment path:

| Deployment Path        | Admin auto-configuration                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `deploy.ps1`           | The signed-in `az login` user’s email is detected automatically and used as `adminEmail` for app role assignment |
| Deploy to Azure button | The deployer enters their email in the portal form — `adminEmail` is used for Entra ID app role assignment       |

### Verify Admin Access

After deployment completes:

1. Navigate to the app URL and sign in with **Entra ID** (the deployer account) or **GitHub** (if invited as admin)
2. Admin-only routes (`/#/review`, `/#/rubrics`, `/#/flags`, `/#/attendees`, `/#/assign`) should be accessible
3. The navigation bar should show admin links: Review Queue, Rubrics, Flags

### Adding Additional Admins (Optional)

If additional organizers need admin access, invite them via the Azure Portal after deployment:

1. Navigate to your Static Web App resource → **Role management**
2. Click **Invite** and set:

| Field                       | Value                                                |
| --------------------------- | ---------------------------------------------------- |
| **Authentication provider** | GitHub                                               |
| **Invitee**                 | GitHub username                                      |
| **Role**                    | `admin`                                              |
| **Expiration**              | Set as appropriate (max 8 hours for one-time events) |

3. Click **Generate** and send the invitation link; the recipient must click it while signed into GitHub

### Remove Admin Access

1. In Azure Portal > Static Web App > **Role management**
2. Find the user entry
3. Click the context menu (**...**) and select **Revoke**

## Admin Rotation

For hackathon events, follow this rotation schedule:

### Pre-Event (Day Before)

1. Verify the deploying user (default admin) can access all admin routes
2. Invite any additional event organizers as admins if required (see [Adding Additional Admins](#adding-additional-admins-optional))
3. Set initial feature flags:

| Flag                    | Initial Value | Notes                                    |
| ----------------------- | ------------- | ---------------------------------------- |
| `REGISTRATION_OPEN`     | ON            | Keep registration open before kickoff    |
| `SUBMISSIONS_ENABLED`   | OFF           | Enable at event start                    |
| `LEADERBOARD_LOCKED`    | OFF           | Keep leaderboard writable during scoring |
| `AWARDS_VISIBLE`        | OFF           | Enable at award ceremony                 |
| `RUBRIC_UPLOAD_ENABLED` | ON            | Required for rubric activation           |

### During Event

1. Upload and activate the scoring rubric (`/#/rubrics`)
2. Bulk import attendees (`/#/attendees`)
3. Assign attendees to teams (`/#/assign`)
4. Enable submissions: set `SUBMISSIONS_ENABLED` to ON (`/#/flags`)
5. Monitor and review submissions (`/#/review`)

### Post-Event

1. Lock the leaderboard: set `LEADERBOARD_LOCKED` to ON
2. Assign awards (`/#/awards`)
3. Make awards visible: set `AWARDS_VISIBLE` to ON
4. Disable submissions: set `SUBMISSIONS_ENABLED` to OFF
5. Revoke admin invitations from temporary organizers

## Data Cleanup

To reset the app for a new event:

```bash
# Preview which tables will be cleared
node scripts/cleanup-app-data.js

# Clear all data (requires --confirm flag for safety)
node scripts/cleanup-app-data.js --confirm

# Clear specific containers only
node scripts/cleanup-app-data.js --confirm --containers scores,submissions
```

## Troubleshooting

| Issue                                     | Resolution                                                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Deploying user cannot access admin routes | Confirm the Entra ID account matches the `adminEmail` used at deploy time; re-run deployment with correct email if needed  |
| Additional admin invite link expired      | Generate a new invitation in Azure Portal → Role management                                                                |
| Cosmos DB data access fails               | Verify SWA managed identity has `Cosmos DB Built-in Data Contributor` role; check governance hasn't re-disabled local auth |
| Feature flags not saving                  | Check browser console for API errors; verify Cosmos DB endpoint app setting is configured on the Static Web App            |
| Scores not appearing on leaderboard       | Ensure submissions are approved in Review Queue; check that `LEADERBOARD_LOCKED` is OFF                                    |

---

[← Back to Documentation](README.md)
