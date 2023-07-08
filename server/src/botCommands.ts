import { addburpee } from './commands/addburpee';
import { addcommand } from './commands/addcommand';
import { addissue } from './commands/addissue';
import { addpushup } from './commands/addpushup';
import { addsquat } from './commands/addsquat';
import { commands } from './commands/commands';
import { delvoid } from './commands/delvoid';
import { followage } from './commands/followage';
import { forodor } from './commands/forodor';
import { help } from './commands/help';
import { hasBotCommandParams } from './commands/helpers/hasBotCommandParams';
import { sendChatMessage } from './commands/helpers/sendChatMessage';
import { issue } from './commands/issue';
import { lutf1sk } from './commands/lutf1sk';
import { play } from './commands/play';
import { queuesong } from './commands/queuesong';
import { quote } from './commands/quote';
import { randomissue } from './commands/randomissue';
import { removecommand } from './commands/removecommand';
import { roll } from './commands/roll';
import { setalias } from './commands/setalias';
import { setcategory } from './commands/setcategory';
import { setcooldown } from './commands/setcooldown';
import { setdescription } from './commands/setdescription';
import { settags } from './commands/settags';
import { settask } from './commands/settask';
import { settitle } from './commands/settitle';
import { skipsong } from './commands/skipsong';
import { skiptts } from './commands/skiptts';
import { song } from './commands/song';
import { songqueue } from './commands/songqueue';
import { task } from './commands/task';
import { tts } from './commands/tts';
import { viewers } from './commands/viewers';
import { welcome } from './commands/welcome';
import { whoami } from './commands/whoami';
import Config from './config';
import { fetchChatters } from './handlers/twitch/helix/fetchChatters';
import { playSound } from './playSound';
import { getIO } from './runSocketServer';
import { Commands } from './storage-models/command-model';
import type { BotCommand } from './types';
import { mention } from './utils/mention';

const botCommands: BotCommand[] = [];

export function loadBotCommands() {
  botCommands.length = 0;
  const customCommands = loadCustomCommands();
  const spotifyCommands = loadSpotifyCommands();
  const githubCommands = loadGitHubCommands();
  botCommands.push(...spotifyCommands, ...githubCommands, ...customCommands);
}

export function loadCustomCommands(): BotCommand[] {
  if (Config.features.commands_handler) {
    const messageCommands = loadMessageCommands();
    return [...complexBotCommands, ...messageCommands];
  }
  return [];
}

export function loadSpotifyCommands(): BotCommand[] {
  if (Config.spotify.enabled) {
    return spotifyCommands;
  }
  return [];
}

export function getBotCommands(): BotCommand[] {
  return botCommands;
}

export function loadGitHubCommands(): BotCommand[] {
  if (Config.github.enabled) {
    return githubCommands;
  }
  return [];
}

const spotifyCommands: BotCommand[] = [skipsong, song, songqueue, queuesong];

const githubCommands: BotCommand[] = [addissue, randomissue];

const complexBotCommands: BotCommand[] = [
  addburpee,
  addcommand,
  addpushup,
  addsquat,
  commands,
  delvoid,
  followage,
  forodor,
  help,
  issue,
  lutf1sk,
  play,
  quote,
  removecommand,
  roll,
  setalias,
  setcategory,
  setcooldown,
  setdescription,
  settags,
  settask,
  settitle,
  skiptts,
  task,
  tts,
  viewers,
  welcome,
  whoami,
];

function loadMessageCommands(): BotCommand[] {
  const commands = Commands.data;

  const botCommands: BotCommand[] = commands.map((c) => ({
    command: c.command,
    id: c.commandId,
    description: c.description || '',
    cooldown: c.cooldown || 0,
    callback: async (connection, parsedCommand) => {
      const command = Commands.data.find((cmd) => cmd.command === c.command);
      if (!command) {
        return;
      }

      const soundsToPlay: string[] = [];
      const soundMatchRegex = /%sound:([a-zA-Z0-9-_.]+)%/g;
      if (c.message.includes('%sound')) {
        let match;

        while ((match = soundMatchRegex.exec(c.message)) !== null) {
          soundsToPlay.push(match[1]);
        }
      }

      const messagesToEmit: string[] = [];
      const messageMatchRegex = /%emit:([a-zA-Z0-9-_.]+)%/g;
      if (c.message.includes('%emit')) {
        let match;

        while ((match = messageMatchRegex.exec(c.message)) !== null) {
          messagesToEmit.push(match[1]);
        }
      }

      // Remove all instances of %sound:[something]% and %emit:[something]% from the message
      const message = c.message.replace(soundMatchRegex, '').replace(messageMatchRegex, '');

      // If there was a message other than just sounds, send it
      if (message) {
        let target = '';
        if (message.includes('%target%') && hasBotCommandParams(parsedCommand.parsedMessage)) {
          const chatters = await fetchChatters();

          const botCommandParam = parsedCommand.parsedMessage.command.botCommandParams.split(' ')[0];
          if (chatters.findIndex((chatter) => chatter.user_login === botCommandParam || chatter.user_name === botCommandParam) > -1) {
            target = mention(botCommandParam);
          }
        }

        let user = 'unknown';
        if (message.includes('%user%') && parsedCommand.parsedMessage.tags && parsedCommand.parsedMessage.tags['display-name']) {
          user = parsedCommand.parsedMessage.tags['display-name'];
        }

        sendChatMessage(
          connection,
          message
            .replace('%user%', user)
            .replace('%target%', target)
            .replace('%now%', new Date().toTimeString())
            .replace('%count%', String(command.timesUsed + 1)),
        );
      }

      // Emit all messages in sequence to the local socket server
      if (messagesToEmit.length > 0) {
        for (const message of messagesToEmit) {
          getIO().emit(message);
        }
      }

      // Play all sounds in sequence
      if (soundsToPlay.length > 0) {
        for (const sound of soundsToPlay) {
          if (sound.includes('.')) {
            const [soundName, soundExtension] = sound.split('.');
            if (soundExtension !== 'mp3') {
              // TODO: Support other sound formats
              continue;
            }
            await playSound(soundName, 'mp3');
          } else {
            // Default to wav
            await playSound(sound);
          }
        }
      }
    },
  }));

  return botCommands;
}
