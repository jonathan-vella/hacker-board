import { getContainer } from "./cosmos.js";

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

  const container = getContainer("config");
  flagCache = { ...DEFAULT_FLAGS };

  for (const key of Object.keys(DEFAULT_FLAGS)) {
    try {
      const { resource } = await container.item(key, key).read();
      if (resource) {
        flagCache[key] =
          resource.configValue === "true" || resource.configValue === true;
      }
    } catch (err) {
      if (err.code !== 404) throw err;
    }
  }

  return { ...flagCache };
}

export async function setFlags(flags) {
  const current = await getFlags();
  const updated = { ...current };
  const container = getContainer("config");

  for (const [key, value] of Object.entries(flags)) {
    if (key in DEFAULT_FLAGS) {
      updated[key] = value === true || value === "true";
    }
  }

  for (const [key, value] of Object.entries(updated)) {
    await container.items.upsert({
      id: key,
      configValue: String(value),
      updatedAt: new Date().toISOString(),
    });
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
