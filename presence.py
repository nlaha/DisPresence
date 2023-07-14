import time
import pickledb
import discord
import os
import requests
import datetime
import logging
from dateutil.tz import tzutc, tzlocal


# runs at 5:00pm PST on sundays, grabs events from https://api.presence.io/wsu/v1/events
# filters by events that are listed for the next 7 days and posts them to the configured channel
def fetch_week_events():
    # log
    logging.log("Fetching events for the next 7 days...")

    raw_events = requests.get("https://api.presence.io/wsu/v1/events").json()

    # filter events to only include events that are listed for the next 7 days
    # use the startDateTimeUtc field to determine it, this field is a datetime string
    # example: 2021-10-13T17:00:00Z
    # the last character is a Z, which means it's in UTC time

    # get the current time in UTC
    current_time = datetime.utcnow()

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
        if time_difference.days <= 7:
            filtered_events.append(event)

    # log
    logging.log(f"Found {len(filtered_events)} events for the next 7 days")

    return filtered_events


def post_events(bot, ctx, server_channels):
    events = fetch_week_events()

    # get the configured channel id for the server
    channel_id = server_channels.get(str(ctx.guild_id))

    # if the channel id is not set, send a message to the channel
    if channel_id is None:
        logging.error(
            "No channel has been configured for this server, use /set-channel to set one!"
        )
        return

    # get the channel object from the channel id
    channel = bot.get_channel(channel_id)

    # loop through all the events
    for event in events:
        # build a card embed
        embed = discord.Embed(
            title=event["eventName"],
            description=event["description"],
            url=event["url"],
            color=0xA60F2D,
        )

        # add the event start time and convert it to a friendly
        # format using the dateutil library
        embed.add_field(
            name="Start Time",
            value=datetime.datetime.strptime(
                event["startDateTimeUtc"], "%Y-%m-%dT%H:%M:%SZ"
            )
            .astimezone(tzlocal())
            .strftime("%A, %B %d, %Y at %I:%M %p"),
            inline=False,
        )

        # check if the event has a photo
        if event["photoUri"] is not None:
            # add the event image
            embed.set_image(
                url=f"https://wsu-cdn.presence.io/event-photos/{event['eventNoSqlId']/{event['photoUri']}}"
            )

        # check if the event has a location
        if event["location"] is not None:
            # add the location
            embed.add_field(name="Location", value=event["location"], inline=False)

        # check if the event has an organization
        if event["organizationName"] is not None:
            # add the organization
            embed.add_field(
                name="Organization", value=event["organizationName"], inline=False
            )

        # check if the event has an rsvp link
        if event["rsvpLink"] is not None:
            # add the RSVP button
            embed.add_field(
                name="RSVP",
                value=f"[Click Here]({event['rsvpLink']})",
                inline=False,
            )

        # send the embed to the channel
        channel.send(embed=embed)

        # wait 1 second before sending the next embed
        time.sleep(1)
