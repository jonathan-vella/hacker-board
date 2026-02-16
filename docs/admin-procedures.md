# Admin Procedures

## Admin Role Assignment

Azure Static Web Apps uses [role-based access control](https://learn.microsoft.com/azure/static-web-apps/authentication-authorization) with role invitations.

### Invite a New Admin

1. Open the [Azure Portal](https://portal.azure.com)
2. Navigate to your Static Web App resource
3. Select **Role management** from the left menu
4. Click **Invite**
5. Set:
   - **Authentication provider**: GitHub
   - **Invitee**: GitHub username
   - **Role**: `admin`
   - **Expiration**: Set as appropriate (max 8 hours for one-time events)
6. Click **Generate** to create the invitation link
7. Send the link to the new admin; they must click it while signed into GitHub

### Verify Admin Access

After the invitee accepts:

1. They navigate to the app and sign in via GitHub
2. Admin-only routes (`/#/review`, `/#/rubrics`, `/#/flags`, `/#/attendees`, `/#/assign`) should be accessible
3. The navigation bar should show admin links: Review Queue, Rubrics, Flags

### Remove Admin Access

1. In Azure Portal > Static Web App > **Role management**
2. Find the user's invitation
3. Click the context menu (**...**) and select **Revoke**

## Admin Rotation

For hackathon events, follow this rotation schedule:

### Pre-Event (Day Before)

1. Invite all event organizers as admins
2. Verify each admin can access the admin panel
3. Set initial feature flags:
   - `REGISTRATION_OPEN`: ON
   - `SUBMISSIONS_ENABLED`: OFF (enable at event start)
   - `LEADERBOARD_LOCKED`: OFF
   - `AWARDS_VISIBLE`: OFF (enable at award ceremony)
   - `RUBRIC_UPLOAD_ENABLED`: ON

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

# Clear specific tables only
node scripts/cleanup-app-data.js --confirm --tables scores,submissions
```

## Troubleshooting

| Issue                                     | Resolution                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| Admin invite link expired                 | Generate a new invitation in Azure Portal                                                    |
| User shows as authenticated but not admin | Verify they accepted the invite link; check Role Management in Azure Portal                  |
| Feature flags not saving                  | Check browser console for API errors; verify `AZURE_STORAGE_CONNECTION_STRING` is configured |
| Scores not appearing on leaderboard       | Ensure submissions are approved in Review Queue; check that `LEADERBOARD_LOCKED` is OFF      |
