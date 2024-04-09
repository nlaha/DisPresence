import { REST, Routes, type Interaction } from "discord.js";
import { JSONFilePreset } from "lowdb/node";
import type { BotCommand, Database } from "./types";
import { postEvents, scheduleJob } from "./presence";
const { logger } = require("./logger");

// Require the necessary discord.js classes
const fs = require("node:fs");
const path = require("node:path");
const { Client, Collection, Events, GatewayIntentBits } = require("discord.js");

// load config from .env file
require("dotenv").config();

// set up JSON database
export const db = await JSONFilePreset<Database>("bot_db.json", {
    guild_configs: [],
    stats: {
        presence_errors: 0,
        events_total: 0,
        events_this_week: 0,
    },
    
});

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// set up collection for commands
client.commands = new Collection();

const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

/**
 * Load commands from the commands directory
 */
for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file: string) => file.endsWith(".ts"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}

/**
 * Handle ready event
 */
client.once(Events.ClientReady, async (readyClient: typeof Client) => {
    logger.info(`Bot ready! Logged in as ${readyClient.user.tag}`);
    
    // schedule jobs for each guild present in the database
    db.data.guild_configs.forEach(async (config) => {
        await scheduleJob(readyClient, config.guild_id);
    });
  
    // register slash commands if the CLI argument '--reload-command' is present
    if (process.argv.includes("--reload-commands")) {
      const commands = client.commands.map((command: BotCommand) => command.data.toJSON());
      const rest = new REST().setToken(process.env.TOKEN || "");
      try {
        logger.info(
          `Started refreshing ${commands.length} application (/) commands.`
        );
        await rest.put(
          Routes.applicationCommands(client.user.id),
          { body: commands },
        );
        logger.info(
          `Successfully reloaded ${commands.length} application (/) commands.`
        );
      } catch (error) {
        logger.error(error);
      }
    }
});


/**
 * Handle interactions
 */
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // Find the command that was executed
    const command = (interaction.client as typeof Client).commands.get(
        interaction.commandName
    );

    // If the command doesn't exist, log an error and return
    if (!command) {
        logger.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    // Try to execute the command
    try {
        await command.execute(interaction);
    } catch (error) {
        // If an error occurs, log the error and send a message to the user
        logger.error(error);
        if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
            content: "There was an error while executing this command!",
            ephemeral: true,
        });
        } else {
        await interaction.reply({
            content: "There was an error while executing this command!",
            ephemeral: true,
        });
        }
    }
});

// Log in to Discord with your client's token
client.login(process.env.TOKEN);
