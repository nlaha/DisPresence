import type { CommandInteraction, Guild } from "discord.js";
import type { GuildConfig } from "../../types";
const { unscheduleJob } = require("../../presence");
const { SlashCommandBuilder } = require("discord.js");
const { logger } = require("../../logger");
const { db } = require("../../bot");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("disable")
    .setDescription("Disable DisPresence worker in the current channel"),
  async execute(interaction: CommandInteraction) {
    // make sure guild id is not null
    if (!interaction.guildId) {
      await interaction.reply({
        content: "This command can only be used in a server.",
      });
      return;
    }

    // Check if the guild_configs array contains the current guild id
    if (db.data.guild_configs.some((config: GuildConfig) => config.guild_id === interaction.guildId || "0")) {
      db.data.guild_configs.splice(
        db.data.guild_configs.findIndex(
          (config: GuildConfig) => config.guild_id === interaction.guildId || "0"
        ),
        1
      );
      await db.write()

      // cancel the worker
      await unscheduleJob(interaction.guildId);

      await interaction.reply({
          content: "DisPresence has been disabled in this channel.",
      });
    } else {
      await interaction.reply({
          content: "DisPresence is already disabled in this channel.",
      });
    }
  },
};
