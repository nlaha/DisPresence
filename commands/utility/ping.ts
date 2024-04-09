import type { CommandInteraction } from "discord.js";
const { SlashCommandBuilder } = require("discord.js");
const { logger } = require("../../logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!"),
    async execute(interaction: CommandInteraction) {
        // get time difference between when the message was received and when the message was sent
        const delay = Math.abs(Date.now() - interaction.createdTimestamp);
        // reply to the user with the time difference
        await interaction.reply(`Pong! Time difference: ${delay}ms`);
  },
};
