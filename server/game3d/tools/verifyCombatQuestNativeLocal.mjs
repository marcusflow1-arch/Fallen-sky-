#!/usr/bin/env node
// Run native Node 22 tests for specific private Combat/Quest PR heads without
// changing the user's working tree or merging unverified application code.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { evaluateGame3DNodeTap847 } from '../privatePgTapSummary847.mjs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const PRS = Object.freeze({
  '794': {
    title: '86.8 original authenticated admission',
    suites: [
      'combat868.admission-shutdown.test.mjs',
      'combat845.admission.test.mjs',
      'combat857.original-chain.test.mjs',
      'combat846.host.test.mjs',
    ],
  },
  '798': {
    title: '86.9 original scheduler shutdown',
    suites: [
      'combat869.scheduler-shutdown.test.mjs',
      'combat844.scheduler.test.mjs',
      'combat857.original-chain.test.mjs',
    ],
  },
  '804': {
    title: '87.0 reconciled original scheduler and authenticated admission',
    suites: [
      'combat870.combined-shutdown.test.mjs',
      'combat868.admission-shutdown.test.mjs',
      'combat869.scheduler-shutdown.test.mjs',
      'combat857.original-chain.test.mjs',
      'combat845.admission.test.mjs',
      'combat844.scheduler.test.mjs',
      'combat846.host.test.mjs',
      'combat851.offline.test.mjs',
    ],
  },
  '807': {
    title: '87.1 original scheduler monotonic world-lease clock',
    suites: [
      'combat871.monotonic-clock.test.mjs',
      'combat844.scheduler.test.mjs',
      'combat869.scheduler-shutdown.test.mjs',
      'combat857.original-chain.test.mjs',
    ],
  },
  // Stacked 95.0 PR head: execute the actual independent original-world
  // source suites together, not just synthetic V8 fixture tests or CI metadata.
  '934': {
    title: '95.0 proposed original Combat/Quest authority and Questbook',
    suites: [
      'combat870.combined-shutdown.test.mjs',
      'combat868.admission-shutdown.test.mjs',
      'combat869.scheduler-shutdown.test.mjs',
      'combat857.original-chain.test.mjs',
      'combat845.admission.test.mjs',
      'combat844.scheduler.test.mjs',
      'combat846.host.test.mjs',
      'combat871.monotonic-clock.test.mjs',
      'combat872.lease-snapshot.test.mjs',
      'combat873.post-input-lease.test.mjs',
      'combat851.offline.test.mjs',
    ],
  },
  '938': {
    // Main-based draft integration candidate with the original 95.0 final
    // source. Fetch it independently; passing stacked #934 is NOT proof
    // the effective change tree on current main passes.
    title: '95.0 main-based integration candidate (DRAFT; no release approval)',
    suites: [
      'combat870.combined-shutdown.test.mjs',
      'combat868.admission-shutdown.test.mjs',
      'combat869.scheduler-shutdown.test.mjs',
      'combat857.original-chain.test.mjs',
      'combat845.admission.test.mjs',
      'combat844.scheduler.test.mjs',
      'combat846.host.test.mjs',
      'combat871.monotonic-clock.test.mjs',
      'combat872.lease-snapshot.test.mjs',
      'combat873.post-input-lease.test.mjs',
      'combat851.offline.test.mjs',
    ],
  },
});
// Current merged original-world / Questbook regression targets. Unlike legacy
// PR modes this executes the existing local main ref without fetching a PR.
const MAIN_SUITES = Object.freeze([...new Set([
  ...PRS['804'].suites, ...PRS['807'].suites,
  'combat872.lease-snapshot.test.mjs',
  // The original 87.3 lease-fence test is now on main after PR #938 merged.
  // Require it in the native main gate; never silently skip merged security tests.
  'combat873.post-input-lease.test.mjs',
])]);
// Preserve historical original-repository PR modes, but allow safe main-only
// source verification in the Game 3D clone. PR numbers are repo-specific.
export function verifyCombatQuestNativeRepositoryTarget(origin, mode) {
  if (typeof origin !== 'string' || typeof mode !== 'string')
    return { ok: false, reason: 'unsupported_origin' };
  const match = /^(?:https:\/\/(?:[^/@]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)marcusflow1-arch\/(atom-x-eve-os|gitsync-pro)(?:\.git)?\/?$/.exec(origin.trim());
  if (!match) return { ok: false, reason: 'unsupported_origin' };
  if (match[1] === 'gitsync-pro' && mode !== 'main')
    return { ok: false, reason: 'clone_requires_main' };
  return { ok: true, repository: match[1] };
}

const MAX_OUTPUT = 12 * 1024 * 1024;
const TEST_TIMEOUT_MS = 120_000;
const supportedNode = Number(process.versions.node.split('.')[0]) >= 22;
const sha256 = text => createHash('sha256').update(text).digest('hex');
function usage() {
  return [
    'Native Game 3D PR verifier — Node.js 22+ and Git required.',
    'Usage: node verifyCombatQuestNativeLocal.mjs [--pr main|938|934|794|798|804|807|both|combined] [--repo PATH] [--output PATH] [--expect-head FULL_40_CHAR_SHA]',
    'Defaults: --pr main (local refs/heads/main, no remote freshness claim); --repo cwd; --output temp evidence folder.',
    'Main pins local main; --pr 938 tests the exact main-based 95.0 draft; --pr 934 tests its stacked ancestor.',
    'Combined mode overlays only verified #794 runtime/tests onto #798 in a temporary worktree.',
    'It never merges, pushes, modifies main, starts PostgreSQL, or runs production services.',
    'Optional --expect-head pins the exact fetched commit for one PR or local main; mismatches fail before tests.',
  ].join('\n');
}
function parseArgs(args) {
  const opts = { pr: 'main', repo: process.cwd(), output: null, expectHead: null };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') return null;
    if (!['--pr', '--repo', '--output', '--expect-head'].includes(arg) || i === args.length - 1)
      throw Error(`Unrecognized or incomplete argument: ${arg}`);
    const value = args[++i];
    if (arg === '--expect-head') opts.expectHead = value;
    else opts[arg.slice(2)] = value;
  }
  if (!['main', '938', '934', '794', '798', '804', '807', 'both', 'combined'].includes(opts.pr))
    throw Error('--pr must be main, 938, 934, 794, 798, 804, 807, both, or combined');
  if (opts.expectHead !== null) {
    if (!/^[0-9a-f]{40}$/i.test(opts.expectHead))
      throw Error('--expect-head requires an exact 40-character Git SHA');
    if (['both', 'combined'].includes(opts.pr))
      throw Error('--expect-head requires exactly one selected PR or main');
    opts.expectHead = opts.expectHead.toLowerCase();
  }
  return opts;
}
function exec(file, args, { cwd, timeout = 30_000 } = {}) {
  // An outer `node --test` runner must not leak recursive test context to
  // subprocesses, or Node will silently skip nested native test files.
  const childEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;
  const result = spawnSync(file, args, {
    cwd, encoding: 'utf8', timeout, maxBuffer: MAX_OUTPUT, env: childEnv,
    shell: false, windowsHide: true,
  });
  return {
    code: result.status,
    signal: result.signal ?? null,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error ? String(result.error) : null,
    ok: result.status === 0 && !result.error && !result.signal,
  };
}
function required(result, label) {
  if (!result.ok) throw Error(`${label} failed: ${result.stderr.slice(0, 500)} ${result.error ?? ''}`);
  return result.stdout.trim();
}
function writeEvidence(folder, name, details) {
  const content = `${details.stdout ?? ''}${details.stderr ? `\n[stderr]\n${details.stderr}` : ''}`;
  const path = join(folder, name);
  writeFileSync(path, content, 'utf8');
  return { file: path, sha256: sha256(content), bytes: Buffer.byteLength(content) };
}
function summarizeTap(result) {
  // Reuse the existing original Combat/Quest 84.7 TAP acceptance contract.
  // First-match regex parsing could mistake duplicated, truncated or
  // contradictory summaries for a native pass, including in main mode.
  const report = evaluateGame3DNodeTap847({
    output: result.stdout, exitCode: result.code,
    signal: result.signal, error: result.error,
  });
  return {
    tests: report.tests ?? null,
    passed: report.pass ?? null,
    failed: report.fail ?? null,
    skipped: report.skipped ?? null,
    cancelled: report.cancelled ?? null,
    tapVerified: report.ok === true,
    tapReason: report.ok ? null : report.reason,
  };
}
function verifyOne(repo, id, folder, expectedHead = null) {
  const localMain = id === 'main';
  const rule = localMain
    ? {title:'Original Combat / Quest suites on pinned local main',suites:MAIN_SUITES}
    : PRS[id];
  // Main mode is offline and pins the EXISTING local ref, never a mutable
  // working directory or an unverified remote head. Preserve old PR modes.
  const acquire = localMain
    ? exec('git', ['rev-parse', '--verify', 'refs/heads/main^{commit}'], {cwd:repo})
    : exec('git', ['fetch', '--no-tags', 'origin', `pull/${id}/head`],
      {cwd:repo,timeout:90_000});
  if (!acquire.ok) return {pr:localMain?'main':Number(id),title:rule.title,
    status:localMain?'main_ref_unavailable':'fetch_failed',
    evidence:writeEvidence(folder,`source-${id}-error.txt`,acquire)};
  const head = localMain ? acquire.stdout.trim()
    : required(exec('git', ['rev-parse', 'FETCH_HEAD'], {cwd:repo}),
      `PR #${id} head`);
  if(!/^[0-9a-f]{40}$/i.test(head))
    return {pr:localMain?'main':Number(id),title:rule.title,status:'invalid_head'};
  // Fail before a checkout or test when the remote PR head changed since review.
  if (expectedHead && head.toLowerCase() !== expectedHead)
    return {pr:localMain?'main':Number(id),title:rule.title,
      status:'head_mismatch',head,expectedHead,cases:[],
      provenance:localMain?'local_refs_heads_main':'github_pr_head'};
  const temp = mkdtempSync(join(tmpdir(), `axe-${id}-`));
  let attached = false;
  let safelyRemoved = false;
  const cases = [];
  try {
    required(exec('git', ['worktree', 'add', '--detach', '--force', temp, head], { cwd: repo, timeout: 60_000 }), `PR #${id} worktree`);
    attached = true;
    for (const name of rule.suites) {
      const script = join(temp, 'server', 'game3d', 'tests', name);
      let source;
      try { source = readFileSync(script, 'utf8'); }
      catch { cases.push({ suite: name, status: 'missing_suite' }); continue; }
      const syntax = exec(process.execPath, ['--check', script], { cwd: temp });
      if (!syntax.ok) {
        cases.push({ suite: name, status: 'syntax_failed', evidence: writeEvidence(folder, `pr-${id}-${name}.syntax.txt`, syntax) });
        continue;
      }
      const run = exec(process.execPath, ['--test', '--test-reporter=tap', script], {
        cwd: temp, timeout: TEST_TIMEOUT_MS,
      });
      const taps = summarizeTap(run);
      const evidence = writeEvidence(folder, `pr-${id}-${name}.tap.txt`, run);
      const pass = run.ok && taps.tapVerified;
      cases.push({
        suite: name, status: pass ? 'passed' : 'failed',
        ...taps, exitCode: run.code, signal: run.signal,
        testSourceSha256: sha256(source), evidence,
      });
    }
  } finally {
    if (attached) {
      const cleanup = exec('git', ['worktree', 'remove', '--force', temp], { cwd: repo, timeout: 60_000 });
      if (!cleanup.ok) {
        writeEvidence(folder, `pr-${id}-cleanup-error.txt`, cleanup);
        cases.push({suite:'git_worktree_cleanup',status:'failed',
          reason:'worktree_remove_failed'});
      } else safelyRemoved = true;
    }
    if (!attached || safelyRemoved) rmSync(temp, { recursive: true, force: true });
  }
  return {
    pr: localMain ? 'main' : Number(id), title: rule.title, head,
    provenance: localMain ? 'local_refs_heads_main' : 'github_pr_head',
    remoteFreshnessVerified: false,
    status: cases.every(c => c.status === 'passed') ? 'passed' : 'failed',
    cases,
  };
}
// This is a TEMPORARY source composition, not a merge commit or a claimed
// production artifact. It tests the two independently pinned PR heads together.
function verifyCombined(repo, previous, folder) {
  const a = previous.find(result => result.pr === 794);
  const b = previous.find(result => result.pr === 798);
  if (a?.status !== 'passed' || b?.status !== 'passed' || !a.head || !b.head)
    return { pr: 'combined', status: 'individual_prs_not_verified' };
  const temp = mkdtempSync(join(tmpdir(), 'axe-pr-combined-'));
  let attached = false;
  let safelyRemoved = false;
  const overlayPaths = [
    'server/game3d/privateCombatQuestAdmission845.mjs',
    'server/game3d/tests/combat868.admission-shutdown.test.mjs',
  ];
  const modifiedPaths = [...overlayPaths,
    'server/game3d/tools/verifyCombatQuest851.mjs',
    'server/game3d/tests/combat851.offline.test.mjs'];
  const suites = [...new Set([...PRS['794'].suites, ...PRS['798'].suites,
    'combat851.offline.test.mjs'])];
  const cases = [];
  try {
    required(exec('git', ['worktree', 'add', '--detach', '--force', temp, b.head],
      { cwd: repo, timeout: 60_000 }), 'Combined worktree');
    attached = true;
    for (const path of overlayPaths) {
      const source = required(exec('git', ['show', a.head + ':' + path],
        { cwd: repo }), '#794 original source: ' + path);
      writeFileSync(join(temp, path), source + '\n', 'utf8');
    }
    const manifest = join(temp, 'server/game3d/tools/verifyCombatQuest851.mjs');
    const requiredSuites = join(temp, 'server/game3d/tests/combat851.offline.test.mjs');
    let index = readFileSync(manifest, 'utf8');
    const marker = " 'combat869.scheduler-shutdown.test.mjs',";
    if (!index.includes(marker) || index.includes(" 'combat868.admission-shutdown.test.mjs',"))
      throw Error('Unknown offline source manifest: fail closed instead of resolving changes');
    index = index.replace(marker,
      " 'combat868.admission-shutdown.test.mjs',\n" + marker);
    writeFileSync(manifest, index, 'utf8');
    let offline = readFileSync(requiredSuites, 'utf8');
    const oldCount = 'requiredSuites.length,26';
    const oldHeading = 'all twenty-six original source regressions';
    if (!offline.includes(oldCount) || !offline.includes(oldHeading))
      throw Error('Unknown offline test count: fail closed rather than silently skipping suites');
    offline = offline.replace(oldCount, 'requiredSuites.length,27')
      .replace(oldHeading, 'all twenty-seven original source regressions');
    writeFileSync(requiredSuites, offline, 'utf8');
    for (const name of suites) {
      const script = join(temp, 'server', 'game3d', 'tests', name);
      let source;
      try { source = readFileSync(script, 'utf8'); }
      catch { cases.push({ suite: name, status: 'missing_suite' }); continue; }
      const syntax = exec(process.execPath, ['--check', script], { cwd: temp });
      if (!syntax.ok) {
        cases.push({ suite: name, status: 'syntax_failed',
          evidence: writeEvidence(folder, 'combined-' + name + '.syntax.txt', syntax) });
        continue;
      }
      const run = exec(process.execPath, ['--test', '--test-reporter=tap', script],
        { cwd: temp, timeout: TEST_TIMEOUT_MS });
      const taps = summarizeTap(run);
      const evidence = writeEvidence(folder, 'combined-' + name + '.tap.txt', run);
      const pass = run.ok && taps.tapVerified;
      cases.push({ suite: name, status: pass ? 'passed' : 'failed',
        ...taps, exitCode: run.code, testSourceSha256: sha256(source), evidence });
    }
  } finally {
    if (attached) {
      const cleanup = exec('git', ['worktree', 'remove', '--force', temp],
        { cwd: repo, timeout: 60_000 });
      if (!cleanup.ok) {
        writeEvidence(folder, 'combined-cleanup-error.txt', cleanup);
        cases.push({suite:'git_worktree_cleanup',status:'failed',
          reason:'worktree_remove_failed'});
      } else safelyRemoved = true;
    }
    if (!attached || safelyRemoved) rmSync(temp, { recursive: true, force: true });
  }
  return {
    pr: 'combined', status: cases.every(c => c.status === 'passed') ? 'passed' : 'failed',
    composition: 'uncommitted_source_overlay_not_a_merge',
    heads: { admissionPr794: a.head, schedulerPr798: b.head },
    overlaidPaths: modifiedPaths, databaseVerified: false, cases,
  };
}

function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${error.message}\n${usage()}\n`); return 2; }
  if (!args) { process.stdout.write(`${usage()}\n`); return 0; }
  if (!supportedNode) { process.stderr.write('Node.js 22 or newer is required.\n'); return 2; }
  const repo = resolve(args.repo);
  const root = exec('git', ['rev-parse', '--show-toplevel'], { cwd: repo });
  if (!root.ok) { process.stderr.write('Not a Git checkout. Supply --repo <path to private Atom X Eve checkout>.\n'); return 2; }
  const currentRoot = resolve(root.stdout.trim());
  // Read the configured URL, not `git remote get-url` after insteadOf rewrites.
  const remotes = required(exec('git', ['config', '--get', 'remote.origin.url'], { cwd: currentRoot }), 'origin remote');
  const target = verifyCombatQuestNativeRepositoryTarget(remotes, args.pr);
  if (!target.ok) {
    process.stderr.write(target.reason === 'clone_requires_main'
      ? 'Game 3D clone supports --pr main only; historical PR IDs belong to the original repository.\n'
      : 'Refusing to verify: origin is not an approved Atom X Eve or Game 3D clone repository.\n');
    return 2;
  }
  const folder = args.output ? resolve(args.output) : mkdtempSync(join(tmpdir(), 'axe-native-ci-evidence-'));
  mkdirSync(folder, { recursive: true });
  const requested = ['both', 'combined'].includes(args.pr) ? ['794', '798'] : [args.pr];
  const summary = {
    status: 'not_verified', verification: 'native-local-node',
    databaseVerified: false, base44Verified: false, liveGameVerified: false,
    timestamp: new Date().toISOString(), node: process.version, repo: currentRoot,
    requestedPrs: requested.map(id=>id==='main'?'main':Number(id)),
    expectedHead: args.expectHead, results: [],
  };
  for (const id of requested) {
    try { summary.results.push(verifyOne(currentRoot, id, folder, args.expectHead)); }
    catch (error) { summary.results.push({ pr: Number(id), status: 'error', message: String(error) }); }
  }
  if (args.pr === 'combined') {
    try { summary.results.push(verifyCombined(currentRoot, summary.results, folder)); }
    catch (error) { summary.results.push({ pr: 'combined', status: 'error', message: String(error) }); }
  }
  summary.status = summary.results.every(r => r.status === 'passed')
    ? (args.pr === 'combined' ? 'native_source_overlay_verified' : 'native_source_tests_passed')
    : 'failed';
  const output = join(folder, 'summary.json');
  writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ status: summary.status, summary: output,
    results: summary.results.map(r => ({ pr: r.pr, head: r.head, status: r.status,
      suites: r.cases?.map(c => ({ suite: c.suite, status: c.status, passed: c.passed, tests: c.tests })) })) }, null, 2)}\n`);
  return ['native_source_tests_passed', 'native_source_overlay_verified'].includes(summary.status) ? 0 : 1;
}
// Importing this module from a unit test must not start the CLI.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  process.exitCode = main();
