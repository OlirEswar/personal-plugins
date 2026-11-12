// Types shared across the app. `AppEnv` tells Hono what `c.get(...)` returns.
export type PublicUser = { id: string; email: string; emailVerifiedAt: Date | null; createdAt: Date };

export type AppEnv = {
  Variables: {
    requestId: string;
    user: PublicUser | null; // set by loadSession on every request
  };
};
