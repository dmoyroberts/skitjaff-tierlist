# Skitjaff Tierlist Discord Bot

This bot can build and run the Discord side of the Skitjaff PvP tier list.

## What it does

- `/setup` creates the tier-list server layout, roles and channels.
- `/test` opens a private testing ticket for a PvP mode.
- Testers can claim and close testing tickets with buttons.
- `/setrank` saves a player's rank for a mode and posts the result.
- `/profile` shows all saved ranks for a player.
- `/leaderboard` shows ranked players for a mode.
- Overall tier roles are automatically updated when `/setrank ... mode:overall` is used.

## Setup

1. Create a bot at the Discord Developer Portal.
2. Turn on **Server Members Intent** for the bot.
3. Invite it to your server with these permissions:
   - Manage Roles
   - Manage Channels
   - View Channels
   - Send Messages
   - Embed Links
   - Read Message History
4. Copy `.env.example` to `.env`.
5. Put your bot token, application/client ID and server/guild ID in `.env`.
6. Run:
   ```
   npm install
   npm start
   ```
7. In Discord, run `/setup`.

Keep your real bot token private. Do not commit `.env`.
