/**
 * Command Registry - Aggregates all command modules
 */
import { commands as windowCommands } from './window.mjs';
import { commands as mouseCommands } from './mouse.mjs';
import { commands as screenCommands } from './screen.mjs';
import { commands as systemCommands } from './system.mjs';
import { commands as networkCommands } from './network.mjs';
import { commands as browserCommands } from './browser.mjs';

export const allCommands = {
  ...windowCommands,
  ...mouseCommands,
  ...screenCommands,
  ...systemCommands,
  ...networkCommands,
  ...browserCommands
};

export const commandList = Object.keys(allCommands).sort();
