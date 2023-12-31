import time
import pickledb
import discord
import os
import requests
import datetime
import logging
from dateutil.tz import tzutc, tzlocal
import re
import asyncio


# runs at 5:00pm PST on sundays, grabs events from https://api.presence.io/wsu/v1/events
# filters by events that are listed for the next 7 days and posts them to the configured channel
def fetch_week_events():
    # log
    logging.info("Fetching events for the next 7 days...")

    raw_events = requests.get("https://api.presence.io/wsu/v1/events").json()

    # filter events to only include events that are listed for the next 7 days
    # use the startDateTimeUtc field to determine it, this field is a datetime string
    # example: 2021-10-13T17:00:00Z
    # the last character is a Z, which means it's in UTC time

    # get the current time in UTC
    current_time = datetime.datetime.utcnow()

    # create a list to store the filtered events
    filtered_events = []

    # loop through all the events
    for event in raw_events:
        # if the event doesn't have a startDateTimeUtc field, skip it
        if "startDateTimeUtc" not in event:
            continue

        # convert the startDateTimeUtc field to a datetime object
        start_time = datetime.datetime.strptime(
            event["startDateTimeUtc"], "%Y-%m-%dT%H:%M:%SZ"
        )

        # calculate the difference between the current time and the event start time
        time_difference = start_time - current_time

        # if the event is within the next 7 days, add it to the list
        if time_difference.days <= 7 and time_difference.days >= 0:
            filtered_events.append(event)

    # sort the events by start time
    filtered_events.sort(
        key=lambda event: datetime.datetime.strptime(
            event["startDateTimeUtc"], "%Y-%m-%dT%H:%M:%SZ"
        )
    )

    # log
    logging.info(f"Found {len(filtered_events)} events for the next 7 days")

    return filtered_events


def post_events(bot, guild_id, server_channels):
    # get the configured channel id for the server
    channel_id = server_channels.get(str(guild_id))

    # if the channel id is not set, send a message to the channel
    if channel_id is None:
        logging.error(
            "No channel has been configured for this server, use /set-channel to set one!"
        )
        return

    # get the channel object from the channel id
    channel = bot.get_channel(channel_id)

    if channel is None:
        logging.error("The channel id is invalid!")
        return

    events = fetch_week_events()

    # post a message to the channel letting the user
    # know what week the bot is posting events for.
    # posting n events for the week of m/d/y

    asyncio.create_task(
        channel.send(
            f"Posting {len(events)} events occurring this next week, after {datetime.datetime.now().strftime('%m/%d/%Y')}"
        )
    )

    # loop through all the events
    for event in events:
        formatted_description = re.sub("<[^<]+?>", "", event["description"])

        if len(formatted_description) > 1024:
            formatted_description = formatted_description[:1021] + "..."

        # build a card embed
        embed = discord.Embed(
            title=event["eventName"],
            # strip HTML from the description (note, this doesn't sanitize)
            description=formatted_description,
            url=f"https://wsu.presence.io/event/{event['uri']}",
            color=0xA60F2D,
        )

        # add the event start time and convert it to a friendly
        # format using the dateutil library
        formatted_time = (
            datetime.datetime.strptime(event["startDateTimeUtc"], "%Y-%m-%dT%H:%M:%SZ")
            .replace(tzinfo=datetime.timezone.utc)
            .astimezone(tz=datetime.timezone(datetime.timedelta(hours=-7)))
            .strftime("%A, %B %d, %Y at %I:%M %p")
        )

        logging.info(event["eventName"] + " | " + formatted_time)
        embed.add_field(
            name="Start Time",
            value=formatted_time,
            inline=False,
        )

        # check if the event has a photo
        if "photoUri" in event:
            # add the event image
            embed.set_image(
                url=f"https://wsu-cdn.presence.io/event-photos/618a42cf-1860-4f89-9fd4-0f42bdbf546c/{event['photoUri']}"
            )

        # check if the event has a location
        if "location" in event:
            # add the location
            embed.add_field(name="Location", value=event["location"], inline=False)

        # check if the event has an organization
        if "organizationName" in event:
            # add the organization
            embed.add_field(
                name="Organization", value=event["organizationName"], inline=False
            )

        # check if the event has an rsvp link
        if "rsvpLink" in event:
            # add the RSVP button
            embed.add_field(
                name="RSVP",
                value=f"[Click Here]({event['rsvpLink']})",
                inline=False,
            )

        # send the embed to the channel
        asyncio.create_task(channel.send(embed=embed))

        # wait 1 second before sending the next embed
        time.sleep(1)
