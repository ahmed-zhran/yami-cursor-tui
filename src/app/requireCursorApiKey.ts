/**
 * Fail-fast auth gate: CURSOR_API_KEY must be present before Ink mounts.
 */
export function requireCursorApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const key = env.CURSOR_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "CURSOR_API_KEY is required. Set it to your Cursor API key and try again.",
    );
  }
  return key;
}
