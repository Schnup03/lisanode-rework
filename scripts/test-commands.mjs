/**
 * Test script - Test commands locally (without gateway)
 */
import { allCommands } from '../src/commands/index.mjs';

const TEST_COMMANDS = [
  { command: 'window.list', params: {} },
  { command: 'window.active', params: {} },
  { command: 'mouse.position', params: {} },
  { command: 'screen.monitors', params: {} },
  { command: 'process.list', params: { limit: 5 } },
  { command: 'system.memory', params: {} },
  { command: 'system.cpu', params: {} },
  { command: 'system.disk', params: {} },
  { command: 'ping', params: {} },
  { command: 'clipboard.get', params: {} },
  { command: 'notify', params: { title: 'LisaNode Test', message: 'Test notification' } },
];

async function runTests() {
  console.log('Testing LisaNode Rework Commands\n');
  console.log(`Total commands registered: ${Object.keys(allCommands).length}\n`);

  let passed = 0;
  let failed = 0;

  for (const { command, params } of TEST_COMMANDS) {
    const handler = allCommands[command];
    if (!handler) {
      console.log(`❌ ${command}: HANDLER NOT FOUND`);
      failed++;
      continue;
    }

    try {
      console.log(`Testing: ${command}...`);
      const result = await handler(params);
      console.log(`  ✅ ${command}: OK`);
      if (result) {
        const preview = JSON.stringify(result).slice(0, 100);
        console.log(`     Result: ${preview}...`);
      }
      passed++;
    } catch (err) {
      console.log(`  ❌ ${command}: ${err.message}`);
      failed++;
    }
    console.log('');
  }

  console.log('==================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('==================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
