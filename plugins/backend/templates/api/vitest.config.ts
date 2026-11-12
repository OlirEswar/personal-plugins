// Tests call the app in-process with app.request() — no server or port needed.
// They use the database in .env.test, which global-setup wipes and migrates first.
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(".env.test");
} catch {}

export default defineConfig({
  test: {
    globalSetup: "./test/global-setup.ts",
    fileParallelism: false, // test files share one database
  },
});
