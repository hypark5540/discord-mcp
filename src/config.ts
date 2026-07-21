const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export interface AppConfig {
  readonly token: string;
  readonly writesEnabled: boolean;
  readonly deletesEnabled: boolean;
  readonly unrestrictedWritesEnabled: boolean;
  readonly allowedGuildIds: ReadonlySet<string>;
  readonly allowedChannelIds: ReadonlySet<string>;
  readonly maxResponseChars: number;
}

type SafetyConfig = Pick<
  AppConfig,
  | "writesEnabled"
  | "deletesEnabled"
  | "unrestrictedWritesEnabled"
  | "allowedGuildIds"
  | "allowedChannelIds"
>;

export function assertSafeConfig(config: SafetyConfig): void {
  if (config.deletesEnabled && !config.writesEnabled) {
    throw new ConfigurationError(
      "DISCORD_ENABLE_DELETES=true requires DISCORD_ENABLE_WRITES=true.",
    );
  }
  if (
    config.writesEnabled &&
    config.allowedGuildIds.size === 0 &&
    config.allowedChannelIds.size === 0 &&
    !config.unrestrictedWritesEnabled
  ) {
    throw new ConfigurationError(
      "Write mode requires DISCORD_ALLOWED_GUILD_IDS or DISCORD_ALLOWED_CHANNEL_IDS. To deliberately allow writes in every visible guild channel, set DISCORD_ALLOW_UNRESTRICTED_WRITES=true.",
    );
  }
}

function parseBoolean(
  name: string,
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new ConfigurationError(
    `${name} must be true or false (received ${JSON.stringify(value)}).`,
  );
}

function parseSnowflakeSet(
  name: string,
  value: string | undefined,
): ReadonlySet<string> {
  if (value === undefined || value.trim() === "") {
    return new Set<string>();
  }

  const ids = value
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  const invalid = ids.find((id) => !SNOWFLAKE_PATTERN.test(id));
  if (invalid !== undefined) {
    throw new ConfigurationError(
      `${name} contains an invalid Discord snowflake: ${JSON.stringify(invalid)}.`,
    );
  }

  return new Set(ids);
}

function parseMaxResponseChars(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return 50_000;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1_000 || parsed > 200_000) {
    throw new ConfigurationError(
      "DISCORD_MAX_RESPONSE_CHARS must be an integer between 1000 and 200000.",
    );
  }
  return parsed;
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const token = (env.DISCORD_TOKEN ?? env.DISCORD_BOT_TOKEN)?.trim();
  if (token === undefined || token.length === 0) {
    throw new ConfigurationError(
      "DISCORD_TOKEN is required. Pass a Discord bot token through the MCP client's environment configuration.",
    );
  }
  if (/\s/.test(token)) {
    throw new ConfigurationError("DISCORD_TOKEN must not contain whitespace.");
  }

  const writesEnabled = parseBoolean(
    "DISCORD_ENABLE_WRITES",
    env.DISCORD_ENABLE_WRITES,
    false,
  );
  const deletesEnabled = parseBoolean(
    "DISCORD_ENABLE_DELETES",
    env.DISCORD_ENABLE_DELETES,
    false,
  );
  const unrestrictedWritesEnabled = parseBoolean(
    "DISCORD_ALLOW_UNRESTRICTED_WRITES",
    env.DISCORD_ALLOW_UNRESTRICTED_WRITES,
    false,
  );

  const allowedGuildIds = parseSnowflakeSet(
    "DISCORD_ALLOWED_GUILD_IDS",
    env.DISCORD_ALLOWED_GUILD_IDS,
  );
  const allowedChannelIds = parseSnowflakeSet(
    "DISCORD_ALLOWED_CHANNEL_IDS",
    env.DISCORD_ALLOWED_CHANNEL_IDS,
  );
  const config = {
    token,
    writesEnabled,
    deletesEnabled,
    unrestrictedWritesEnabled,
    allowedGuildIds,
    allowedChannelIds,
    maxResponseChars: parseMaxResponseChars(env.DISCORD_MAX_RESPONSE_CHARS),
  };
  assertSafeConfig(config);
  return config;
}

export { SNOWFLAKE_PATTERN };
