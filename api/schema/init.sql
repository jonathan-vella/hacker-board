-- HackerBoard Azure SQL Schema
-- Idempotent DDL — safe to run on every deployment.
-- Entra ID only; no SQL passwords used anywhere.

-- ──────────────────────────────────────────────────────────────────────────────
-- Sequence: atomic hacker number (replaces ETag-based Table Storage counter)
-- ──────────────────────────────────────────────────────────────────────────────

IF NOT EXISTS (
    SELECT 1 FROM sys.sequences WHERE name = 'HackerNumberSequence'
)
BEGIN
    CREATE SEQUENCE dbo.HackerNumberSequence
        AS INT
        START WITH 1
        INCREMENT BY 1
        NO CYCLE;
END;
GO

-- ──────────────────────────────────────────────────────────────────────────────
-- Teams
-- ──────────────────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Teams')
BEGIN
    CREATE TABLE dbo.Teams (
        id          INT            IDENTITY(1,1) PRIMARY KEY,
        teamName    NVARCHAR(100)  NOT NULL,
        teamNumber  INT            NOT NULL DEFAULT 0,
        teamMembers NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
        createdAt   DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
        updatedAt   DATETIME2      NULL,
        CONSTRAINT UQ_Teams_teamName UNIQUE (teamName)
    );

    CREATE INDEX IX_Teams_teamNumber ON dbo.Teams (teamNumber);
END;
GO

-- ──────────────────────────────────────────────────────────────────────────────
-- Attendees
-- ──────────────────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Attendees')
BEGIN
    CREATE TABLE dbo.Attendees (
        id             INT            IDENTITY(1,1) PRIMARY KEY,
        hackerAlias    NVARCHAR(50)   NOT NULL,
        hackerNumber   INT            NOT NULL,
        teamId         INT            NOT NULL,
        gitHubUsername NVARCHAR(200)  NOT NULL,
        registeredAt   DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Attendees_hackerAlias    UNIQUE (hackerAlias),
        CONSTRAINT UQ_Attendees_hackerNumber   UNIQUE (hackerNumber),
        CONSTRAINT UQ_Attendees_gitHubUsername UNIQUE (gitHubUsername),
        CONSTRAINT FK_Attendees_Teams FOREIGN KEY (teamId) REFERENCES dbo.Teams (id)
    );

    CREATE INDEX IX_Attendees_teamId        ON dbo.Attendees (teamId);
    CREATE INDEX IX_Attendees_gitHubUsername ON dbo.Attendees (gitHubUsername);
END;
GO

-- ──────────────────────────────────────────────────────────────────────────────
-- Scores
-- ──────────────────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Scores')
BEGIN
    CREATE TABLE dbo.Scores (
        id             INT            IDENTITY(1,1) PRIMARY KEY,
        teamId         INT            NOT NULL,
        category       NVARCHAR(100)  NOT NULL,
        criterion      NVARCHAR(200)  NOT NULL,
        points         DECIMAL(10,2)  NOT NULL DEFAULT 0,
        maxPoints      DECIMAL(10,2)  NOT NULL DEFAULT 0,
        scoredBy       NVARCHAR(200)  NOT NULL,
        overrideReason NVARCHAR(500)  NULL,
        timestamp      DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Scores_teamId_category_criterion UNIQUE (teamId, category, criterion),
        CONSTRAINT FK_Scores_Teams FOREIGN KEY (teamId) REFERENCES dbo.Teams (id)
    );

    CREATE INDEX IX_Scores_teamId   ON dbo.Scores (teamId);
    CREATE INDEX IX_Scores_category ON dbo.Scores (category);
END;
GO

-- ──────────────────────────────────────────────────────────────────────────────
-- Awards
-- ──────────────────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Awards')
BEGIN
    CREATE TABLE dbo.Awards (
        id         INT            IDENTITY(1,1) PRIMARY KEY,
        category   NVARCHAR(100)  NOT NULL,
        teamId     INT            NOT NULL,
        assignedBy NVARCHAR(200)  NOT NULL,
        timestamp  DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_Awards_category UNIQUE (category),
        CONSTRAINT FK_Awards_Teams FOREIGN KEY (teamId) REFERENCES dbo.Teams (id)
    );
END;
GO

-- ──────────────────────────────────────────────────────────────────────────────
-- Submissions
-- ──────────────────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Submissions')
BEGIN
    CREATE TABLE dbo.Submissions (
        id              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        teamId          INT              NOT NULL,
        submittedBy     NVARCHAR(200)    NOT NULL,
        submittedAt     DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        status          NVARCHAR(20)     NOT NULL DEFAULT 'Pending',
        payload         NVARCHAR(MAX)    NULL,
        calculatedTotal DECIMAL(10,2)   NOT NULL DEFAULT 0,
        reviewedBy      NVARCHAR(200)    NULL,
        reviewedAt      DATETIME2        NULL,
        reason          NVARCHAR(1000)   NULL,
        CONSTRAINT CHK_Submissions_status CHECK (status IN ('Pending', 'Approved', 'Rejected')),
        CONSTRAINT FK_Submissions_Teams FOREIGN KEY (teamId) REFERENCES dbo.Teams (id)
    );

    CREATE INDEX IX_Submissions_teamId ON dbo.Submissions (teamId);
    CREATE INDEX IX_Submissions_status ON dbo.Submissions (status);
END;
GO

-- ──────────────────────────────────────────────────────────────────────────────
-- Rubrics
-- ──────────────────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Rubrics')
BEGIN
    CREATE TABLE dbo.Rubrics (
        id             UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        name           NVARCHAR(200)    NOT NULL,
        version        INT              NOT NULL DEFAULT 1,
        baseTotal      DECIMAL(10,2)    NOT NULL DEFAULT 0,
        bonusTotal     DECIMAL(10,2)    NOT NULL DEFAULT 0,
        isActive       BIT              NOT NULL DEFAULT 0,
        categories     NVARCHAR(MAX)    NULL,
        bonusItems     NVARCHAR(MAX)    NULL,
        gradingScale   NVARCHAR(MAX)    NULL,
        sourceMarkdown NVARCHAR(MAX)    NULL,
        createdBy      NVARCHAR(200)    NOT NULL,
        createdAt      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_Rubrics_isActive  ON dbo.Rubrics (isActive);
    CREATE INDEX IX_Rubrics_createdAt ON dbo.Rubrics (createdAt DESC);
END;
GO

-- ──────────────────────────────────────────────────────────────────────────────
-- Config (feature flags + key-value pairs)
-- ──────────────────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Config')
BEGIN
    CREATE TABLE dbo.Config (
        [key]   NVARCHAR(200) NOT NULL PRIMARY KEY,
        [value] NVARCHAR(MAX) NOT NULL
    );

    -- Seed default feature flag values
    INSERT INTO dbo.Config ([key], [value]) VALUES ('SUBMISSIONS_ENABLED',   'true');
    INSERT INTO dbo.Config ([key], [value]) VALUES ('LEADERBOARD_LOCKED',    'false');
    INSERT INTO dbo.Config ([key], [value]) VALUES ('REGISTRATION_OPEN',     'true');
    INSERT INTO dbo.Config ([key], [value]) VALUES ('AWARDS_VISIBLE',        'true');
    INSERT INTO dbo.Config ([key], [value]) VALUES ('RUBRIC_UPLOAD_ENABLED', 'true');
END;
GO

-- ──────────────────────────────────────────────────────────────────────────────
-- Entra ID access for the SWA managed identity
-- Run AFTER the managed identity has been provisioned by Bicep.
-- The identity name matches the Static Web App resource name.
-- Replace <swa-managed-identity-name> with the actual display name visible
-- in Azure Entra ID (same as the SWA resource name).
-- ──────────────────────────────────────────────────────────────────────────────

-- NOTE: deploy-schema.js executes this block dynamically using the SWA name
-- passed via the --swa-name argument, so this static block serves as reference.

-- IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = '<swa-managed-identity-name>')
-- BEGIN
--     CREATE USER [<swa-managed-identity-name>] FROM EXTERNAL PROVIDER;
--     ALTER ROLE db_datareader ADD MEMBER [<swa-managed-identity-name>];
--     ALTER ROLE db_datawriter ADD MEMBER [<swa-managed-identity-name>];
-- END;
