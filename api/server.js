// NOTE: Must be imported first — Application Insights patches Node.js HTTP/HTTPS
// modules at startup. Any imports before this will not be auto-instrumented.
import "./shared/telemetry.js";

import { createApp } from "./app.js";

const app = createApp();

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`HackerBoard server listening on port ${PORT}`);
});
