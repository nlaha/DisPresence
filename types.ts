// Export types for the application

import type { CommandInteraction, SlashCommandBuilder } from "discord.js";

/**
 * @typedef {Object} BotCommand
 * @property {SlashCommandBuilder} data - The command data
 * @property {(interaction: CommandInteraction) => Promise<void>} execute - The command execution function
 */
export type BotCommand = {
  data: SlashCommandBuilder;
  execute: (interaction: CommandInteraction) => Promise<void>;
};

/**
 * @typedef {Object} GuildConfig
 * @property {string} guild_id - The guild ID
 * @property {string} channel_id - The channel ID
 */
export type GuildConfig = {
  guild_id: string;
  channel_id: string;
};

/**
 * @typedef {Object} Stats
 * @property {number} presence_errors - The number of presence errors
 * @property {number} events_total - The total number of events
 * @property {number} events_this_week - The number of events this week
 */
export type Stats = {
  presence_errors: number;
  events_total: number;
  events_this_week: number;
};

/**
 * @typedef {Object} Database
 * @property {GuildConfig[]} guild_configs - The guild configurations
 * @property {Stats} stats - The bot statistics
 */
export type Database = {
    guild_configs: GuildConfig[];
    stats: Stats;
};

/**
 * @typedef {Object} PresenceEvent
 */
export type PresenceEvent = {
  apiId: string;
  eventNoSqlId: string;
  uri: string;
  subdomain: string;
  campusName: string;
  eventName: string;
  organizationName: string;
  organizationUri: string;
  orgStructureNoSqlId: string;
  description: string;
  location: string;
  isVirtualEventLink: boolean;
  hasVirtualEventIntegration: boolean;
  hasEventEnded: boolean;
  rsvpLink: string;
  contactName: string;
  contactEmail: string;
  hasCoverImage: boolean;
  photoUri: string;
  photoType: string;
  photoUriWithVersion: string;
  startDateTimeUtc: string;
  endDateTimeUtc: string;
  statusId: number;
  tags: string[];
}

/**
 * @typedef {Object} ParsedPresenceEvent
 * @property {string} name - The event name
 * @property {string} location - The event location
 * @property {string} organization - The event organization
 * @property {Date} start - The event start date
 * @property {Date} end - The event end date
 * @property {string} description - The event description
 * @property {boolean} isVirtualEvent - Whether the event is virtual
 * @property {string} uri - The event URI
 */
export type ParsedEvent = {
    eventName: string;
    location: string;
    organizationName: string;
    startDateTimeUtc: Date;
    endDateTimeUtc: Date;
    description: string;
    isVirtualEventLink: boolean;
    uri: string;
}