import "dotenv/config";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder
} from "discord.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("Missing DISCORD_TOKEN, CLIENT_ID, or GUILD_ID in .env");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, "..", "data.json");

const MODES = [
  ["Overall", "overall"],
  ["Crystal", "crystal"],
  ["Sword", "sword"],
  ["UHC", "uhc"],
  ["Pot", "pot"],
  ["Netherite Pot", "nethpot"],
  ["SMP", "smp"],
  ["Axe", "axe"],
  ["Mace", "mace"]
];

const TIERS = ["HT1","LT1","HT2","LT2","HT3","LT3","HT4","LT4","HT5","LT5"];
const TIER_SCORE = Object.fromEntries(TIERS.map((tier, i) => [tier, i + 1]));

const TIER_COLORS = {
  HT1: 0xf1c75b,
  LT1: 0xc6c6c6,
  HT2: 0xdf9b57,
  LT2: 0xa9a9a9,
  HT3: 0x6db8f2,
  LT3: 0x8ba0ad,
  HT4: 0x7f7f7f,
  LT4: 0x727272,
  HT5: 0x676767,
  LT5: 0x5c5c5c
};

const STAFF_ROLES = ["Head Tester", "Tester", "Trial Tester"];

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { players: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function modeName(value) {
  return MODES.find(([, v]) => v === value)?.[0] ?? value;
}

function isStaff(member) {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  return STAFF_ROLES.some(name => member.roles.cache.some(role => role.name === name));
}

function safeChannelName(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function ensureRole(guild, name, options = {}) {
  let role = guild.roles.cache.find(r => r.name === name);
  if (!role) {
    role = await guild.roles.create({
      name,
      reason: "Skitjaff tierlist setup",
      ...options
    });
  }
  return role;
}

async function ensureCategory(guild, name, overwrites = undefined) {
  let channel = guild.channels.cache.find(
    c => c.type === ChannelType.GuildCategory && c.name === name
  );
  if (!channel) {
    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      permissionOverwrites: overwrites,
      reason: "Skitjaff tierlist setup"
    });
  }
  return channel;
}

async function ensureText(guild, name, parent, overwrites = undefined, topic = undefined) {
  let channel = guild.channels.cache.find(
    c => c.type === ChannelType.GuildText && c.name === name
  );
  if (!channel) {
    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent,
      permissionOverwrites: overwrites,
      topic,
      reason: "Skitjaff tierlist setup"
    });
  }
  return channel;
}

const commands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Build the Skitjaff tier-list server layout.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("test")
    .setDescription("Request a PvP tier test.")
    .addStringOption(o =>
      o.setName("mode")
        .setDescription("PvP mode")
        .setRequired(true)
        .addChoices(...MODES.slice(1).map(([name, value]) => ({ name, value })))
    )
    .addStringOption(o =>
      o.setName("region")
        .setDescription("Your region")
        .setRequired(true)
        .addChoices(
          { name: "North America", value: "NA" },
          { name: "Europe", value: "EU" },
          { name: "Asia", value: "AS" },
          { name: "South America", value: "SA" },
          { name: "Oceania", value: "OC" }
        )
    ),

  new SlashCommandBuilder()
    .setName("setrank")
    .setDescription("Set a player's tier. Tester only.")
    .addUserOption(o => o.setName("player").setDescription("Player").setRequired(true))
    .addStringOption(o =>
      o.setName("mode")
        .setDescription("PvP mode")
        .setRequired(true)
        .addChoices(...MODES.map(([name, value]) => ({ name, value })))
    )
    .addStringOption(o =>
      o.setName("tier")
        .setDescription("New tier")
        .setRequired(true)
        .addChoices(...TIERS.map(t => ({ name: t, value: t })))
    )
    .addStringOption(o =>
      o.setName("region")
        .setDescription("Player region")
        .setRequired(false)
        .addChoices(
          { name: "North America", value: "NA" },
          { name: "Europe", value: "EU" },
          { name: "Asia", value: "AS" },
          { name: "South America", value: "SA" },
          { name: "Oceania", value: "OC" }
        )
    ),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View a player's tier profile.")
    .addUserOption(o => o.setName("player").setDescription("Player").setRequired(false)),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View the tier leaderboard for a PvP mode.")
    .addStringOption(o =>
      o.setName("mode")
        .setDescription("PvP mode")
        .setRequired(false)
        .addChoices(...MODES.map(([name, value]) => ({ name, value })))
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);
await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
console.log("Registered slash commands.");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (!interaction.inGuild()) {
        await interaction.reply({ content: "Use this command inside the server.", ephemeral: true });
        return;
      }

      if (interaction.commandName === "setup") {
        await interaction.deferReply({ ephemeral: true });

        const guild = interaction.guild;
        const everyone = guild.roles.everyone;

        const headTester = await ensureRole(guild, "Head Tester", {
          color: 0xff7a1a,
          hoist: true
        });
        const tester = await ensureRole(guild, "Tester", {
          color: 0xe99945,
          hoist: true
        });
        const trialTester = await ensureRole(guild, "Trial Tester", {
          color: 0xa56d3b
        });

        for (const tier of TIERS) {
          await ensureRole(guild, tier, {
            color: TIER_COLORS[tier] ?? 0x777777
          });
        }
        await ensureRole(guild, "Unranked", { color: 0x555555 });

        const info = await ensureCategory(guild, "━━ INFO ━━");
        const testing = await ensureCategory(guild, "━━ TESTING ━━");
        const modes = await ensureCategory(guild, "━━ PVP MODES ━━");
        const community = await ensureCategory(guild, "━━ COMMUNITY ━━");

        const staffOverwrites = [
          { id: everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: headTester.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: tester.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: trialTester.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ];
        const staff = await ensureCategory(guild, "━━ STAFF ━━", staffOverwrites);

        const infoReadOnly = [
          { id: everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }
        ];

        const welcome = await ensureText(guild, "welcome", info.id, infoReadOnly);
        const rules = await ensureText(guild, "rules", info.id, infoReadOnly);
        const how = await ensureText(guild, "how-testing-works", info.id, infoReadOnly);
        await ensureText(guild, "announcements", info.id, infoReadOnly);
        await ensureText(guild, "leaderboard", info.id, infoReadOnly);

        await ensureText(guild, "request-a-test", testing.id);
        await ensureText(guild, "test-results", testing.id, infoReadOnly);
        await ensureText(guild, "rank-updates", testing.id, infoReadOnly);

        for (const [name, value] of MODES.slice(1)) {
          await ensureText(guild, value, modes.id, undefined, `${name} PvP discussion and matchmaking.`);
        }

        await ensureText(guild, "general", community.id);
        await ensureText(guild, "clips", community.id);
        await ensureText(guild, "looking-for-duels", community.id);
        await ensureText(guild, "suggestions", community.id);

        await ensureText(guild, "tester-chat", staff.id, staffOverwrites);
        await ensureText(guild, "staff-logs", staff.id, staffOverwrites);

        if (welcome && !welcome.lastMessageId) {
          await welcome.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xff7a1a)
                .setTitle("Welcome to Skitjaff PvP Tiers")
                .setDescription("Get tested, earn a tier, and climb the rankings across competitive Minecraft PvP modes.")
            ]
          });
        }

        if (rules && !rules.lastMessageId) {
          await rules.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xff7a1a)
                .setTitle("Server Rules")
                .setDescription([
                  "1. Respect players and testers.",
                  "2. No cheating, macros, or unfair clients.",
                  "3. Do not spam test requests.",
                  "4. Follow the tester's kit and arena instructions.",
                  "5. Do not fake or edit test results."
                ].join("\n"))
            ]
          });
        }

        if (how && !how.lastMessageId) {
          await how.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xff7a1a)
                .setTitle("How Testing Works")
                .setDescription([
                  "• Run **/test** and choose your mode + region.",
                  "• The bot creates a private testing ticket.",
                  "• A tester claims your ticket and runs the test.",
                  "• Staff use **/setrank** to record your tier.",
                  "• Use **/profile** or **/leaderboard** to view ranks."
                ].join("\n"))
            ]
          });
        }

        await interaction.editReply("Server layout created. Use **/test** to open testing tickets.");
        return;
      }

      if (interaction.commandName === "test") {
        await interaction.deferReply({ ephemeral: true });
        const guild = interaction.guild;
        const mode = interaction.options.getString("mode", true);
        const region = interaction.options.getString("region", true);

        const existing = guild.channels.cache.find(
          c => c.type === ChannelType.GuildText &&
               c.topic?.includes(`test-owner:${interaction.user.id}`)
        );
        if (existing) {
          await interaction.editReply(`You already have an open test ticket: <#${existing.id}>`);
          return;
        }

        const testingCategory = guild.channels.cache.find(
          c => c.type === ChannelType.GuildCategory && c.name === "━━ TESTING ━━"
        );
        if (!testingCategory) {
          await interaction.editReply("The server is not set up yet. An admin needs to run **/setup**.");
          return;
        }

        const staffRoles = STAFF_ROLES
          .map(name => guild.roles.cache.find(r => r.name === name))
          .filter(Boolean);

        const overwrites = [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          ...staffRoles.map(role => ({
            id: role.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          }))
        ];

        const channel = await guild.channels.create({
          name: safeChannelName(`test-${interaction.user.username}-${mode}`),
          type: ChannelType.GuildText,
          parent: testingCategory.id,
          topic: `test-owner:${interaction.user.id};mode:${mode};region:${region}`,
          permissionOverwrites: overwrites,
          reason: "PvP tier test request"
        });

        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`claim:${interaction.user.id}`)
            .setLabel("Claim Test")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`close:${interaction.user.id}`)
            .setLabel("Close")
            .setStyle(ButtonStyle.Danger)
        );

        await channel.send({
          content: `<@${interaction.user.id}>`,
          embeds: [
            new EmbedBuilder()
              .setColor(0xff7a1a)
              .setTitle(`${modeName(mode)} Test Request`)
              .addFields(
                { name: "Player", value: `<@${interaction.user.id}>`, inline: true },
                { name: "Region", value: region, inline: true },
                { name: "Mode", value: modeName(mode), inline: true }
              )
              .setFooter({ text: "Waiting for a tester to claim this request." })
          ],
          components: [buttons]
        });

        await interaction.editReply(`Your testing ticket is ready: <#${channel.id}>`);
        return;
      }

      if (interaction.commandName === "setrank") {
        if (!isStaff(interaction.member)) {
          await interaction.reply({ content: "Only testers can use this command.", ephemeral: true });
          return;
        }

        const user = interaction.options.getUser("player", true);
        const mode = interaction.options.getString("mode", true);
        const tier = interaction.options.getString("tier", true);
        const region = interaction.options.getString("region") ?? "N/A";

        const data = loadData();
        const old = data.players[user.id] ?? {
          username: user.username,
          region,
          ranks: {}
        };

        old.username = user.username;
        if (region !== "N/A") old.region = region;
        old.ranks ??= {};
        old.ranks[mode] = tier;
        data.players[user.id] = old;
        saveData(data);

        if (mode === "overall") {
          const member = await interaction.guild.members.fetch(user.id).catch(() => null);
          if (member) {
            const tierRoles = interaction.guild.roles.cache.filter(r => TIERS.includes(r.name));
            const remove = tierRoles.filter(r => member.roles.cache.has(r.id));
            if (remove.size) await member.roles.remove(remove).catch(() => {});
            const role = interaction.guild.roles.cache.find(r => r.name === tier);
            if (role) await member.roles.add(role).catch(() => {});
          }
        }

        const resultEmbed = new EmbedBuilder()
          .setColor(TIER_COLORS[tier] ?? 0xff7a1a)
          .setTitle("Tier Updated")
          .setDescription(`<@${user.id}> has been placed **${tier}** in **${modeName(mode)}**.`)
          .addFields(
            { name: "Player", value: user.username, inline: true },
            { name: "Mode", value: modeName(mode), inline: true },
            { name: "Tier", value: tier, inline: true }
          )
          .setFooter({ text: `Set by ${interaction.user.username}` })
          .setTimestamp();

        const resultChannel = interaction.guild.channels.cache.find(c => c.name === "test-results");
        const rankChannel = interaction.guild.channels.cache.find(c => c.name === "rank-updates");
        if (resultChannel?.isTextBased()) await resultChannel.send({ embeds: [resultEmbed] });
        if (rankChannel?.isTextBased() && rankChannel.id !== resultChannel?.id) {
          await rankChannel.send({ embeds: [resultEmbed] });
        }

        await interaction.reply({ content: `Updated <@${user.id}> to **${tier}** in **${modeName(mode)}**.`, ephemeral: true });
        return;
      }

      if (interaction.commandName === "profile") {
        const user = interaction.options.getUser("player") ?? interaction.user;
        const data = loadData();
        const player = data.players[user.id];

        if (!player) {
          await interaction.reply({ content: `${user.username} does not have any recorded tiers yet.`, ephemeral: true });
          return;
        }

        const fields = MODES.map(([name, value]) => ({
          name,
          value: player.ranks?.[value] ?? "Unranked",
          inline: true
        }));

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff7a1a)
              .setTitle(`${user.username}'s PvP Profile`)
              .setThumbnail(user.displayAvatarURL())
              .setDescription(`Region: **${player.region ?? "N/A"}**`)
              .addFields(fields)
          ]
        });
        return;
      }

      if (interaction.commandName === "leaderboard") {
        const mode = interaction.options.getString("mode") ?? "overall";
        const data = loadData();

        const ranked = Object.entries(data.players)
          .filter(([, p]) => p.ranks?.[mode])
          .sort((a, b) => {
            const at = TIER_SCORE[a[1].ranks[mode]] ?? 999;
            const bt = TIER_SCORE[b[1].ranks[mode]] ?? 999;
            if (at !== bt) return at - bt;
            return a[1].username.localeCompare(b[1].username);
          })
          .slice(0, 20);

        const description = ranked.length
          ? ranked.map(([id, p], i) =>
              `**${i + 1}.** <@${id}> — **${p.ranks[mode]}** · ${p.region ?? "N/A"}`
            ).join("\n")
          : "No ranked players yet.";

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff7a1a)
              .setTitle(`${modeName(mode)} Leaderboard`)
              .setDescription(description)
          ]
        });
        return;
      }
    }

    if (interaction.isButton()) {
      if (!interaction.inGuild()) return;

      const [action, ownerId] = interaction.customId.split(":");

      if (action === "claim") {
        if (!isStaff(interaction.member)) {
          await interaction.reply({ content: "Only testers can claim tests.", ephemeral: true });
          return;
        }

        const embed = EmbedBuilder.from(interaction.message.embeds[0])
          .setFooter({ text: `Claimed by ${interaction.user.username}` });

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`claim:${ownerId}`)
            .setLabel("Claimed")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`close:${ownerId}`)
            .setLabel("Close")
            .setStyle(ButtonStyle.Danger)
        );

        await interaction.update({ embeds: [embed], components: [disabledRow] });
        await interaction.channel.send(`<@${ownerId}> your test was claimed by <@${interaction.user.id}>.`);
        return;
      }

      if (action === "close") {
        const allowed = interaction.user.id === ownerId || isStaff(interaction.member);
        if (!allowed) {
          await interaction.reply({ content: "You cannot close this ticket.", ephemeral: true });
          return;
        }

        await interaction.reply("Closing this test ticket in 3 seconds...");
        setTimeout(() => interaction.channel.delete("Tier test ticket closed").catch(() => {}), 3000);
      }
    }
  } catch (error) {
    console.error(error);
    const payload = { content: "Something went wrong while running that command.", ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.login(TOKEN);
