import discord
import os  # default module
from dotenv import load_dotenv
import pickledb
import logging
import schedule, time
import datetime
import presence

load_dotenv()  # load all the variables from the env file
bot = discord.AutoShardedBot()

# stores the configured event channel id for each server
server_channels = pickledb.load("server_channels.db", False)
server_enables = pickledb.load("server_enables.db", False)

# configure logging
logging.basicConfig(format="%(asctime)s - %(message)s", datefmt="%d-%b-%y %H:%M:%S")

server_jobs = {}


@bot.event
async def on_ready():
    logging.log(f"{bot.user} is ready and online!")

    # for each server, check if the bot is enabled
    for server_id in server_enables.getall():
        # if the bot is enabled, start the scheduler
        if server_enables.get(server_id) is True:
            job = (
                schedule.every()
                .sunday.at("17:00")
                .do(presence.post_events, bot, server_id, server_channels)
            )

            server_jobs[server_id] = job


@bot.slash_command(name="hello", description="Say hello to the bot")
async def hello(ctx):
    await ctx.respond("Hey!")


# set a channel to watch for new events
@bot.slash_command(
    name="set-channel",
    description="Set the channel that new presence events will be sent to",
)
async def set_channel(ctx):
    if ctx.author.guild_permissions.administrator is False:
        # if the user is not an admin, send a message to the channel
        await ctx.respond("You need to be a server admin to use this command!")
        return

    # get the channel id from the context
    channel_id = ctx.channel_id

    server_channels.set(str(ctx.guild_id), channel_id)

    # send a message to the channel
    await ctx.respond(
        "From now on, I'll post newly detected events from presence here!"
    )


@bot.slash_command(
    name="enable",
    description="Enables the bot, will start posting events to the configured channel every Sunday at 5:00pm PST",
)
async def enable(ctx):
    if ctx.author.guild_permissions.administrator is False:
        # if the user is not an admin, send a message to the channel
        await ctx.respond("You need to be a server admin to use this command!")
        return

    # start the scheduler
    job = (
        schedule.every()
        .sunday.at("17:00")
        .do(presence.post_events, bot, ctx, server_channels)
    )

    # log
    logging.log(f"Enabled the bot for {ctx.guild_id}")

    server_jobs[str(ctx.guild_id)] = job

    # save server enable status
    server_enables.set(str(ctx.guild_id), True)


@bot.slash_command(
    name="disable",
    description="Disables the bot, will no longer post to the configured channel",
)
async def disable(ctx):
    if ctx.author.guild_permissions.administrator is False:
        # if the user is not an admin, send a message to the channel
        await ctx.respond("You need to be a server admin to use this command!")
        return

    # cancel the scheduler
    job = server_jobs.get(str(ctx.guild_id))

    if job is None:
        await ctx.respond("The bot is not enabled!")
        return

    job.cancel()

    # log
    logging.log(f"Disabled the bot for {ctx.guild_id}")

    # save server enable status
    server_enables.set(str(ctx.guild_id), False)


bot.run(os.getenv("TOKEN"))  # run the bot with the token
