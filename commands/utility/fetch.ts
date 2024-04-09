import type { CommandInteraction } from "discord.js";
import type { GuildConfig } from "../../types";
const { postEvents } = require("../../presence");
const { scheduleJob } = require("../../presence");
const { db } = require("../../bot");
const { SlashCommandBuilder } = require("discord.js");
const { logger } = require("../../logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fetch")
    .setDescription("Manually fetch events and post them in the current channel"),
    async execute(interaction: CommandInteraction) {
        await interaction.reply({
            content: "Fetching events...",
        });
        await postEvents(interaction.client).then(async () => {
            await interaction.followUp({
                content: "Events have been fetched and posted in this channel.",
            });
        }).catch(async (error: Error) => {
            logger.error(`Error fetching events: ${error.message}`);
            await interaction.followUp({
                content: "An error occurred while fetching events.",
            });
        });
  },
};
