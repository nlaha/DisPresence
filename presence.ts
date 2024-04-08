import type { Client, TextChannel } from "discord.js";
import { type PresenceEvent, type ParsedEvent as ParsedPresenceEvent } from "./types";
const { logger } = require("./logger");
import { db } from "./bot";
const cron = require("node-cron");

// Keywords to filter out events
const FILTERED_KEYWORDS = [
    "greek", "fraternity", "sorority", "religious", "church", "temple", "mosque",
    "synagogue", "prayer", "worship", "faith", "god", "jesus", "allah", "buddha",
    "hindu", "christian", "muslim", "jewish", "buddhist", "hinduism", "christianity",
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
    const response = await fetch("https://api.presence.io/wsu/v1/dashboard/events");
    // if the response is not OK, throw an error
    if (!response.ok) {
        logger.error(`Failed to fetch events from the Presence API: ${response.statusText}`);
        // increment the presence errors counter
        db.data.stats.presence_errors++;
        db.write();
    }

    const events: PresenceEvent[] = await response.json();
    
    // first, parse events into a more usable format
    const parsedEvents = events.map((event: PresenceEvent): ParsedPresenceEvent => {
        // dates are of format "%Y-%m-%dT%H:%M:%SZ"
        const startDate = new Date(event.startDateTimeUtc);
        const endDate = new Date(event.endDateTimeUtc);
        return {
            name: event.eventName,
            location: event.location,
            organization: event.organizationName,
            start: startDate,
            end: endDate,
            description: event.description,
            isVirtualEvent: event.isVirtualEventLink,
            uri: `https://wsu.presence.io/event/${event.uri}`,
        };
    }).filter((event: ParsedPresenceEvent) => {
        // filter out events that have already ended and are not within the next week
        const now = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        let res = event.end >= now && event.start <= nextWeek;
        // also filter out greek life events and religious events
        // simply do a search for a list of keywords in the event name and description
        // if there are any matches, filter out the event
        for (const keyword of FILTERED_KEYWORDS) {
            if (event.name.toLowerCase().includes(keyword) || event.description.toLowerCase().includes(keyword)) {
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
    // get the next week's events
    let events = await getNextWeekEvents();

    // sort events by start date
    events.sort((a, b) => a.start.getTime() - b.start.getTime());
    // limit to 25 events
    events = events.slice(0, 25);

    // log
    logger.info(`Found ${events.length} events for the next week.`);
  
    // get the channel to post events in
    db.data.guild_configs.forEach((config) => {
        const channel = client.channels.cache.get(config.channel_id) as TextChannel;
        if (!channel) {
            logger.warn(`Channel with ID ${config.channel_id} not found. Skipping posting events.`);
            return;
        }
        
        // post the events
        // this will be one big message with all the events as links
        // use discord.js embeds to make it look nice, each event will be a field
        channel.send({
            content: "Here are the events for the next week (max 25):",
            embeds: [
                {
                    title: "Events",
                    fields: events.map((event) => {
                        return {
                            name: event.name,
                            value: `**Organization:** ${event.organization}\n**Location:** ${event.location}\n**Start:** ${event.start.toUTCString()}\n**End:** ${event.end.toUTCString()}\n**Description:** ${event.description}\n**Virtual Event:** ${event.isVirtualEvent ? "Yes" : "No"}\n[Link to Event](${event.uri})`,
                        };
                    }),
                    // add "See more" link to the bottom
                    footer: {
                        text: "For more events, visit https://wsu.presence.io",
                    },
                },
            ],
        });
    });
}

/**
 * Schedule a job for a guild
 * @param client  The Discord client
 * @param guildId The guild ID to schedule the job for
 */
export async function scheduleJob(client: Client, guildId: string): Promise<void> {
    cron.schedule('* * * * *', async () => {
    //cron.schedule('0 10 * * 0', function(){
        logger.log("[JOB] Running DisPresence worker for guild " + guildId);
        await postEvents(client);
    }, {
        name: guildId,
        scheduled: true,
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