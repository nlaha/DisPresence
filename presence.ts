import { ActivityType, type Client, type TextChannel } from "discord.js";
import { type PresenceEvent, type ParsedEvent as ParsedPresenceEvent } from "./types";
const { logger } = require("./logger");
import { db } from "./bot";
const cron = require("node-cron");

// Keywords to filter out events
const FILTERED_KEYWORDS = [
    "greek", "fraternity", "sorority", "religious", "church", "temple", "mosque",
    "synagogue", "prayer", "worship", "faith", "god", "jesus", "allah", "buddha",
    "hindu", "christian", "muslim", "jewish", "buddhist", "hinduism", "christianity", "catholic",
    "islam", "judaism", "buddhism", "religious", "spiritual", "spirituality",
    "spiritualism", "spiritualist", "spiritualistic", "spiritualistic", "spiritualistic",
    "kappa", "alpha", "delta", "sigma", "phi", "theta", "omega", "beta", "gamma",
    "zeta", "iota", "lambda", "mu", "nu", "xi", "omicron", "pi", "rho", "tau", "upsilon",
];

/**
 * Get the next week's events from the Presence API
 * @returns A promise that resolves to an array of parsed events
 */
export async function getNextWeekEvents(): Promise<ParsedPresenceEvent[]> {
    // Fetch events from the API
    const response = await fetch("https://api.presence.io/wsu/v1/events");
    // if the response is not OK, throw an error
    if (!response.ok) {
        logger.error(`Failed to fetch events from the Presence API: ${response.statusText}`);
        // increment the presence errors counter
        db.data.stats.presence_errors++;
        db.write();
    }

    const responseJson = await response.json();
    const events: PresenceEvent[] = responseJson;
    
    // first, parse events into a more usable format
    const parsedEvents = events.map((event: PresenceEvent): ParsedPresenceEvent => {
        // dates are of format "%Y-%m-%dT%H:%M:%SZ"
        const startDate = new Date(event.startDateTimeUtc);
        const endDate = new Date(event.endDateTimeUtc);
        if (event.description === null) {
            logger.warn(`Event ${event.eventName} has no description.`);
        }
        return {
            eventName: event.eventName || "No Name",
            location: event.location || "No Location",
            organizationName: event.organizationName || "",
            startDateTimeUtc: startDate || new Date(),
            endDateTimeUtc: endDate || new Date(),
            description: event.description || "No Description",
            isVirtualEventLink: event.isVirtualEventLink || false,
            uri: `https://wsu.presence.io/event/${event.uri}` || "https://wsu.presence.io",
        };
    }).filter((event: ParsedPresenceEvent) => {
        // filter out events that have already ended and are not within the next week
        const now = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        let res = event.startDateTimeUtc >= now && event.startDateTimeUtc <= nextWeek;
        
        // also filter out greek life events and religious events
        // simply do a search for a list of keywords in the event name, description and organization name
        // if there are any matches, filter out the event
        for (const keyword of FILTERED_KEYWORDS) {
            if (
                event.eventName.toLowerCase().includes(keyword) ||
                event.description.toLowerCase().includes(keyword) ||
                event.organizationName.toLowerCase().includes(keyword)) {
                    res = false;
                    break;
            }
        }

        return res;
    });
    
    return Promise.resolve(parsedEvents);
}

/**
 * Post events for the next week in the configured channels
 * @param client The Discord client
 */
export async function postEvents(client: Client): Promise<void> {
    logger.info("Posting events for the next week...");
    // get the next week's events
    let events = await getNextWeekEvents();
    // update the stats
    db.data.stats.events_this_week = events.length;
    db.write();

    client.user?.setActivity({
        type: ActivityType.Watching,
        name: `for ${events.length} events this week`,
    });

    // sort events by start date
    events.sort((a, b) => a.startDateTimeUtc.getTime() - b.startDateTimeUtc.getTime());
    // limit to 25 events
    events = events.slice(0, 25);

    // log
    logger.info(`Found ${events.length} events for the next week.`);
  
    // get the channel to post events in
    db.data.guild_configs.forEach((config) => {
        const channel = client.channels.cache.get(config.channel_id) as TextChannel;
        if (!channel) {
            logger.warn(`Channel with ID ${config.channel_id} not found. Skipping posting events.`);
            return Promise.reject(`Channel with ID ${config.channel_id} not found.`);
        }
        
        // post the events
        // this will be one big message with all the events as links
        // use discord.js embeds to make it look nice, each event will be a field
        channel.send({
            content: "",
            embeds: [
                {
                    title: events.length > 0 ? `Upcoming ${events.length} Events in the Next Week (Max 25 Shown)` : "No Upcoming Events in the Next Week",
                    // WSU crimson
                    color: 10038562,
                    fields: events.map((event) => {
                        const localStartTime = event.startDateTimeUtc.toLocaleTimeString([], { timeStyle: 'short', timeZone: 'America/Los_Angeles'});
                        const localEndTime = event.endDateTimeUtc.toLocaleTimeString([], { timeStyle: 'short', timeZone: 'America/Los_Angeles'});
                        return {
                            name: `${event.startDateTimeUtc.toDateString()} - ${localStartTime} to ${localEndTime}`,
                            value: `[${event.eventName} - ${event.organizationName}](${event.uri})`,
                        };
                    }),
                    // add "See more" link to the bottom
                    footer: {
                        text: "For more events, visit https://wsu.presence.io",
                    },
                    timestamp: new Date().toISOString(),
                },
            ],
        });
    });

    return Promise.resolve();
}

/**
 * Schedule a job for a guild
 * @param client  The Discord client
 * @param guildId The guild ID to schedule the job for
 */
export async function scheduleJob(client: Client, guildId: string): Promise<void> {

    // schedule a job to post events every Sunday at 10:00 AM
    cron.schedule('0 10 * * 0', () => postEvents(client).catch((e) => logger.error(e)), {
        name: guildId,
        timezone: "America/Los_Angeles"
    });

    logger.info(`Scheduled job for guild ${guildId}`);
}

/**
 * Unschedule a job for a guild
 * @param guildId The guild ID to unschedule the job for
 * @returns void
 */
export async function unscheduleJob(guildId: string): Promise<void> {
    // get tasks
    const tasks = cron.getTasks();

    // find the task with the given name
    for (let [key, value] of tasks.entries()) {
        if (key === guildId) {
            value.stop();
            logger.info(`Unscheduled job for guild ${guildId}`);
            return;
        }
    }
}