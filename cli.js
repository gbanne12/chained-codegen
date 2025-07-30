#!/usr/bin/env node
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const path = require('path');

// Map 'start' command to 'codegen' to avoid repeating codegen 
const args = process.argv.slice();
const commandIndex = args.findIndex(arg => arg === 'start');
if (commandIndex !== -1) {
  args[commandIndex] = 'codegen';
}

// Use the local build with chained locator support
const localProgramPath = path.join(__dirname, 'packages/playwright-core/lib/cli/program.js');
const { program } = require(localProgramPath);

program
  .command('start [url]')
  .description('open page and generate code for user actions (alias for codegen)')
  .allowUnknownOption(true);

program.parse(args);
