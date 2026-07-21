import {
  type APIGuild,
  type APIMessage,
  type APIUser,
  type RESTAPIPartialCurrentUserGuild,
} from "discord-api-types/v10";

import type { DiscordChannel } from "./discord-api.js";

type UnknownRecord = Record<string, unknown>;

const CHANNEL_TYPE_NAMES: Readonly<Record<number, string>> = {
  0: "GuildText",
  1: "DM",
  2: "GuildVoice",
  3: "GroupDM",
  4: "GuildCategory",
  5: "GuildAnnouncement",
  10: "AnnouncementThread",
  11: "PublicThread",
  12: "PrivateThread",
  13: "GuildStageVoice",
  14: "GuildDirectory",
  15: "GuildForum",
  16: "GuildMedia",
};

function record(value: unknown): UnknownRecord {
  return value as UnknownRecord;
}

function optionalString(source: UnknownRecord, key: string): string | null {
  const value = source[key];
  return typeof value === "string" ? value : null;
}

function optionalNumber(source: UnknownRecord, key: string): number | null {
  const value = source[key];
  return typeof value === "number" ? value : null;
}

function optionalBoolean(source: UnknownRecord, key: string): boolean | null {
  const value = source[key];
  return typeof value === "boolean" ? value : null;
}

export function normalizeUser(user: APIUser): UnknownRecord {
  return {
    id: user.id,
    username: user.username,
    global_name: user.global_name ?? null,
    discriminator: user.discriminator,
    bot: user.bot ?? false,
    avatar: user.avatar ?? null,
  };
}

export function normalizePartialGuild(
  guild: RESTAPIPartialCurrentUserGuild,
): UnknownRecord {
  return {
    id: guild.id,
    name: guild.name,
    owner: guild.owner,
    icon: guild.icon,
    banner: guild.banner,
    permissions: String(guild.permissions),
    approximate_member_count: guild.approximate_member_count ?? null,
    approximate_presence_count: guild.approximate_presence_count ?? null,
    features: guild.features,
  };
}

export function normalizeGuild(guild: APIGuild): UnknownRecord {
  return {
    id: guild.id,
    name: guild.name,
    description: guild.description,
    owner_id: guild.owner_id,
    icon: guild.icon,
    banner: guild.banner,
    preferred_locale: guild.preferred_locale,
    verification_level: guild.verification_level,
    approximate_member_count: guild.approximate_member_count ?? null,
    approximate_presence_count: guild.approximate_presence_count ?? null,
    features: guild.features,
  };
}

export function normalizeChannel(channel: DiscordChannel): UnknownRecord {
  const source = record(channel);
  const typeValue = typeof source.type === "number" ? source.type : -1;
  const typeName =
    typeValue >= 0
      ? (CHANNEL_TYPE_NAMES[typeValue] ?? `Unknown(${typeValue})`)
      : "Unknown";

  return {
    id: String(source.id),
    guild_id: optionalString(source, "guild_id"),
    type: typeValue,
    type_name: typeName,
    name: optionalString(source, "name"),
    topic: optionalString(source, "topic"),
    parent_id: optionalString(source, "parent_id"),
    position: optionalNumber(source, "position"),
    nsfw: optionalBoolean(source, "nsfw"),
    last_message_id: optionalString(source, "last_message_id"),
    rate_limit_per_user: optionalNumber(source, "rate_limit_per_user"),
  };
}

function normalizeEmbed(embed: APIMessage["embeds"][number]): UnknownRecord {
  return {
    type: embed.type,
    title: embed.title ?? null,
    description: embed.description ?? null,
    url: embed.url ?? null,
    timestamp: embed.timestamp ?? null,
    author: embed.author
      ? { name: embed.author.name, url: embed.author.url ?? null }
      : null,
    footer: embed.footer?.text ?? null,
    fields:
      embed.fields?.map((field) => ({
        name: field.name,
        value: field.value,
        inline: field.inline ?? false,
      })) ?? [],
  };
}

export function normalizeMessage(message: APIMessage): UnknownRecord {
  const source = record(message);
  const referencedMessage = message.referenced_message;
  const normalizedReference =
    referencedMessage === undefined || referencedMessage === null
      ? null
      : referencedMessage.channel_id === message.channel_id
        ? {
            id: referencedMessage.id,
            channel_id: referencedMessage.channel_id,
            author: normalizeUser(referencedMessage.author),
            content: referencedMessage.content,
            timestamp: referencedMessage.timestamp,
            redacted: false,
          }
        : {
            id: referencedMessage.id,
            channel_id: referencedMessage.channel_id,
            redacted: true,
            redaction_reason: "cross_channel_reference",
          };

  return {
    id: message.id,
    type: message.type,
    flags: message.flags ?? 0,
    channel_id: message.channel_id,
    guild_id: optionalString(source, "guild_id"),
    author: normalizeUser(message.author),
    content: message.content,
    timestamp: message.timestamp,
    edited_timestamp: message.edited_timestamp,
    pinned: message.pinned,
    tts: message.tts,
    webhook_id: message.webhook_id ?? null,
    mentions: message.mentions.map(normalizeUser),
    mention_roles: message.mention_roles,
    attachments: message.attachments.map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      description: attachment.description ?? null,
      content_type: attachment.content_type ?? null,
      size: attachment.size,
      url: attachment.url,
      width: attachment.width ?? null,
      height: attachment.height ?? null,
    })),
    embeds: message.embeds.map(normalizeEmbed),
    components: Array.isArray(source.components) ? source.components : [],
    poll: source.poll ?? null,
    message_snapshots: Array.isArray(source.message_snapshots)
      ? source.message_snapshots.map(() => ({
          redacted: true,
          redaction_reason: "forwarded_message_boundary",
        }))
      : [],
    reactions:
      message.reactions?.map((reaction) => ({
        emoji: reaction.emoji,
        count: reaction.count,
        me: reaction.me,
      })) ?? [],
    message_reference: message.message_reference ?? null,
    referenced_message: normalizedReference,
  };
}
