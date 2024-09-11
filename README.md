# DisPresence
[![CodeQL Advanced](https://github.com/nlaha/DisPresence/actions/workflows/codeql.yml/badge.svg)](https://github.com/nlaha/DisPresence/actions/workflows/codeql.yml)

A discord bot that downloads updates from presence.io sites

## Hosting

1. Install [Bun](https://bun.sh/)
> NodeJS can also be used, but Bun is faster and better
3. Run `bun install` in the project directory
4. Either set the `TOKEN` environment variable manually or create a `.env` file with `TOKEN` set to your Discord bot token
5. Run `bun start --reload-commands` to register the Discord slash commands and start the bot

> For future runs with the same token, use `bun start` to avoid getting rate limited by Discord

## How to use

1. Run `/enable` **in the channel you would like events to be posted in** to enable the scheduler, it will download events from presence every Sunday at 10 AM PST, and it will post events starting in the next 7 days. The number of events it posts is limited to 25. Religious and Greek life events are filtered out to prevent spam.

You can also run the `/fetch` command to manually fetch all events occurring in the next 7 days and post them. Note, with this method you might run into some duplicate events the next time the scheduler is run.

If you would like to turn off the automatic posting, simply run `/disable`

## Example event post

![image](https://github.com/nlaha/DisPresence/assets/10292944/4770274a-11e3-422b-a75b-d7abb95abfb0)
