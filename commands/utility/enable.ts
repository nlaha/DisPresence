import { type CommandInteraction } from "discord.js";
import type { GuildConfig } from "../../types";
const { PermissionFlagsBits } = require("discord.js");
const { scheduleJob } = require("../../presence");
const { db } = require("../../bot");
const { SlashCommandBuilder } = require("discord.js");
const { logger } = require("../../logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("enable")
    .setDescription("Enable DisPresence worker in the current channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setDMPermission(false),
  async execute(interaction: CommandInteraction) {
    // make sure guild id is not null
    if (!interaction.guildId) {
      await interaction.reply({
        content: "This command can only be used in a server.",
      });
      return;
    }

    // Check if the guild_configs array contains the current guild id
    if (!db.data.guild_configs.some((config: GuildConfig) => config.guild_id === interaction.guildId || "0")) {
      // Add the current channel to the guild_configs array
      db.data.guild_configs.push({
        guild_id: interaction.guildId || "0",
        channel_id: interaction.channelId,
      });
      await db.write();

      // schedule the worker
      await scheduleJob(interaction.client, interaction.guildId);

      await interaction.reply({
        content: "DisPresence has been enabled in this channel. Scheduled worker for Sunday at 10:00 AM.",
      });
    } else {
      await interaction.reply({
        content: "DisPresence is already enabled in this channel.",
      });
    }
  },
};
