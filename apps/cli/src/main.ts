#!/usr/bin/env node
import { config } from 'dotenv';
import { Command } from 'commander';
import { iconCommand } from './commands/icon.js';

// Load .env from cwd
config();

const program = new Command()
  .name('bp')
  .description('Builder Pipeline — all-in-one toolkit for solo builders')
  .version('0.0.1');

program.addCommand(iconCommand);

program.parseAsync();
