import { query } from "./db.js";

const DEFAULT_FLAGS = {
  SUBMISSIONS_ENABLED: true,
  LEADERBOARD_LOCKED: false,
  REGISTRATION_OPEN: true,
  AWARDS_VISIBLE: true,
  RUBRIC_UPLOAD_ENABLED: true,
};

const FLAG_DESCRIPTIONS = {
  SUBMISSIONS_ENABLED: "Allow teams to submit scores",
  LEADERBOARD_LOCKED: "Freeze the leaderboard (no new scores applied)",
  REGISTRATION_OPEN: "Allow new attendee registrations",
  AWARDS_VISIBLE: "Show award badges on leaderboard",
  RUBRIC_UPLOAD_ENABLED: "Allow admins to upload new rubrics",
};

let flagCache;

export function getDefaultFlags() {
  return { ...DEFAULT_FLAGS };
}

export function getFlagDescriptions() {
  return { ...FLAG_DESCRIPTIONS };
}

export async function getFlags() {
  if (flagCache) return { ...flagCache };

  const result = await query(
    `SELECT configKey, configValue FROM dbo.Config WHERE configKey IN (${Object.keys(
      DEFAULT_FLAGS,
    )
      .map((_, i) => `@k${i}`)
      .join(",")})`,
    Object.fromEntries(Object.keys(DEFAULT_FLAGS).map((k, i) => [`k${i}`, k])),
  );

  flagCache = { ...DEFAULT_FLAGS };
  for (const row of result.recordset) {
    if (row.configKey in flagCache) {
      flagCache[row.configKey] =
        row.configValue === "true" || row.configValue === true;
    }
  }
  return { ...flagCache };
}

export async function setFlags(flags) {
  const current = await getFlags();
  const updated = { ...current };

  for (const [key, value] of Object.entries(flags)) {
    if (key in DEFAULT_FLAGS) {
      updated[key] = value === true || value === "true";
    }
  }

  // MERGE each flag into Config table
  for (const [key, value] of Object.entries(updated)) {
    await query(
      `MERGE dbo.Config AS target
       USING (SELECT @configKey AS configKey) AS source ON target.configKey = source.configKey
       WHEN MATCHED THEN UPDATE SET configValue = @configValue, updatedAt = @updatedAt
       WHEN NOT MATCHED THEN INSERT (configKey, configValue, updatedAt) VALUES (@configKey, @configValue, @updatedAt);`,
      {
        configKey: key,
        configValue: String(value),
        updatedAt: new Date().toISOString(),
      },
    );
  }

  flagCache = { ...updated };
  return updated;
}

export function clearFlagCache() {
  flagCache = undefined;
}

export function requireFeature(flags, flagName) {
  if (!flags[flagName]) {
    return {
      status: 503,
      jsonBody: {
        error: {
          code: "FEATURE_DISABLED",
          message: `${flagName} is currently disabled`,
        },
      },
    };
  }
  return undefined;
}
