import "dotenv/config";
import { createRecommendationApp } from "./http.js";

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be between 1 and 65535");
const app = await createRecommendationApp();
app.enableShutdownHooks();
await app.listen(port);
console.log(`Recommendation API: http://localhost:${port}`);
