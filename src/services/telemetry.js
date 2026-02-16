const TELEMETRY_ENDPOINT = "https://dc.services.visualstudio.com/v2/track";

let connectionString;
let instrumentationKey;

function parseConnectionString(connStr) {
  if (!connStr) return {};
  const pairs = {};
  connStr.split(";").forEach((part) => {
    const [key, ...valueParts] = part.split("=");
    if (key) pairs[key.trim()] = valueParts.join("=").trim();
  });
  return pairs;
}

export function initTelemetry() {
  // Connection string is exposed via a meta tag or fetched from API
  const meta = document.querySelector('meta[name="ai-connection-string"]');
  if (meta?.content) {
    connectionString = meta.content;
    const parsed = parseConnectionString(connectionString);
    instrumentationKey = parsed.InstrumentationKey;
  }

  if (!instrumentationKey) return;

  trackPageView();
  window.addEventListener("hashchange", trackPageView);
  window.addEventListener("error", (event) => {
    trackException(event.error || new Error(event.message));
  });
  window.addEventListener("unhandledrejection", (event) => {
    trackException(
      event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason)),
    );
  });
}

function getPageName() {
  const hash = window.location.hash.replace("#/", "").replace("#", "");
  return hash || "leaderboard";
}

export function trackPageView() {
  if (!instrumentationKey) return;

  sendTelemetry("PageviewData", {
    name: getPageName(),
    url: window.location.href,
    duration: "00:00:00.000",
    properties: {
      theme: document.documentElement.getAttribute("data-theme") || "light",
    },
  });
}

export function trackException(error) {
  if (!instrumentationKey) return;

  sendTelemetry("ExceptionData", {
    exceptions: [
      {
        typeName: error?.name || "Error",
        message: error?.message || "Unknown error",
        hasFullStack: Boolean(error?.stack),
        stack: error?.stack || "",
      },
    ],
    properties: {
      page: getPageName(),
    },
  });
}

export function trackEvent(name, properties = {}) {
  if (!instrumentationKey) return;

  sendTelemetry("EventData", {
    name,
    properties: {
      page: getPageName(),
      ...properties,
    },
  });
}

function sendTelemetry(type, data) {
  const envelope = {
    name: `Microsoft.ApplicationInsights.${instrumentationKey.replace(/-/g, "")}.${type}`,
    time: new Date().toISOString(),
    iKey: instrumentationKey,
    tags: {
      "ai.session.id": getSessionId(),
      "ai.device.type": "Browser",
      "ai.operation.name": getPageName(),
    },
    data: {
      baseType: type,
      baseData: data,
    },
  };

  // Use sendBeacon for reliability on page unload
  if (navigator.sendBeacon) {
    navigator.sendBeacon(TELEMETRY_ENDPOINT, JSON.stringify(envelope));
  } else {
    fetch(TELEMETRY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
      keepalive: true,
    }).catch(() => {
      /* telemetry failures are non-critical */
    });
  }
}

function getSessionId() {
  let id = sessionStorage.getItem("hb-session-id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("hb-session-id", id);
  }
  return id;
}
