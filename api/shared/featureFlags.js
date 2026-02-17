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

export async function getFlags(tableClient) {
  if (flagCache) return { ...flagCache };

  try {
    const entity = await tableClient.getEntity("config", "featureFlags");
    flagCache = { ...DEFAULT_FLAGS };
    for (const key of Object.keys(DEFAULT_FLAGS)) {
      if (entity[key] !== undefined) {
        flagCache[key] = entity[key] === true || entity[key] === "true";
      }
    }
    return { ...flagCache };
  } catch (err) {
    if (err.statusCode === 404) {
      flagCache = { ...DEFAULT_FLAGS };
      // Persist defaults so they appear in the Config table immediately
      await tableClient.upsertEntity({
        partitionKey: "config",
        rowKey: "featureFlags",
        ...flagCache,
      });
      return { ...flagCache };
    }
    throw err;
  }
}

export async function setFlags(tableClient, flags) {
  const current = await getFlags(tableClient);
  const updated = { ...current };

  for (const [key, value] of Object.entries(flags)) {
    if (key in DEFAULT_FLAGS) {
      updated[key] = value === true || value === "true";
    }
  }

  await tableClient.upsertEntity({
    partitionKey: "config",
    rowKey: "featureFlags",
    ...updated,
  });

  flagCache = { ...updated };
  return updated;
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

export function clearFlagCache() {
  flagCache = undefined;
}
