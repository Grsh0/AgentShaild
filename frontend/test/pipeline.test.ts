import { LAB_CASES } from '../src/lib/test-cases';
import { runPipeline } from '../src/lib/engine/pipeline';
import {
  seedSettings,
  seedUsers,
  seedAgents,
  seedTools,
  seedResources,
  seedPolicies,
} from '../src/lib/mock-data';

function runTestSuite() {
  const now = Date.now();
  const env = {
    settings: seedSettings(now),
    users: seedUsers(now),
    agents: seedAgents(now),
    tools: seedTools(),
    resources: seedResources(),
    policies: seedPolicies(now),
  };

  console.log(`[AgentShield Test Runner] Running ${LAB_CASES.length} adversarial and functional test cases...\n`);

  let passed = 0;
  let failed = 0;

  for (const c of LAB_CASES) {
    const sandbox = {
      ...env,
      settings: { ...env.settings, ...c.settingsOverride },
      tools: c.disableTool
        ? env.tools.map((x) => (x.tool_name === c.disableTool ? { ...x, enabled: false } : x))
        : env.tools,
    };

    const { request } = runPipeline(c.input, sandbox, now, 'req-' + c.id);
    const ok =
      request.http_status === c.expected &&
      (!c.expectRedaction || request.dlp_redactions.length > 0);

    if (ok) {
      passed++;
      console.log(`  ✓ [${c.id}] ${c.module.padEnd(11)} (${c.requirement}) -> Expected ${c.expected}, Got ${request.http_status}`);
    } else {
      failed++;
      console.error(`  ✗ [${c.id}] ${c.module.padEnd(11)} (${c.requirement}) -> Expected ${c.expected}, Got ${request.http_status}`);
    }
  }

  console.log(`\n========================================`);
  console.log(`Total: ${LAB_CASES.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
