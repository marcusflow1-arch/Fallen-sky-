// Clone Combat/Quest 95.2: make native main verification possible on the
// dedicated clone without accidentally fetching an unrelated original PR.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyCombatQuestNativeRepositoryTarget } from '../tools/verifyCombatQuestNativeLocal.mjs';

const runner = fileURLToPath(new URL('../tools/verifyCombatQuestNativeLocal.mjs', import.meta.url));

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  return result.stdout.trim();
}

test('95.2 recognizes the clone main ref across approved GitHub remote forms', () => {
  for (const origin of [
    'https://github.com/marcusflow1-arch/gitsync-pro.git',
    'git@github.com:marcusflow1-arch/gitsync-pro.git',
    'ssh://git@github.com/marcusflow1-arch/gitsync-pro',
  ]) assert.deepEqual(verifyCombatQuestNativeRepositoryTarget(origin, 'main'),
    { ok: true, repository: 'gitsync-pro' });
});

test('95.2 retains the original repository historical PR verifier', () => {
  for (const mode of ['main', '934', '938', 'combined', 'both'])
    assert.deepEqual(verifyCombatQuestNativeRepositoryTarget(
      'https://github.com/marcusflow1-arch/atom-x-eve-os.git', mode),
    { ok: true, repository: 'atom-x-eve-os' });
});

test('95.2 clone cannot use original-repository PR IDs or combined overlays', () => {
  for (const mode of ['934', '938', '794', 'both', 'combined']) {
    assert.deepEqual(verifyCombatQuestNativeRepositoryTarget(
      'git@github.com:marcusflow1-arch/gitsync-pro.git', mode),
    { ok: false, reason: 'clone_requires_main' });
  }
});

test('95.2 rejects arbitrary repos, owners, and lookalike hosts', () => {
  for (const origin of [
    'https://evilgithub.com/marcusflow1-arch/gitsync-pro.git',
    'https://github.com/other-owner/gitsync-pro.git',
    'https://github.com/marcusflow1-arch/gitsync-pro-evil.git',
    'https://github.com/marcusflow1-arch/atom-x-eve-os-other.git',
    '',
  ]) assert.deepEqual(verifyCombatQuestNativeRepositoryTarget(origin, 'main'),
    { ok: false, reason: 'unsupported_origin' });
});

test('95.2 clone main verifier reaches pinned git evidence, not origin denial', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'axe-clone-952-test-'));
  try {
    git(fixture, 'init', '-b', 'main');
    writeFileSync(join(fixture, 'README.md'), 'fixture only\n');
    git(fixture, 'add', 'README.md');
    git(fixture, '-c', 'user.name=Native Test',
      '-c', 'user.email=native-test@example.invalid', 'commit', '-m', 'test fixture');
    git(fixture, 'remote', 'add', 'origin',
      'https://github.com/marcusflow1-arch/gitsync-pro.git');
    const sha = git(fixture, 'rev-parse', 'HEAD');
    const output = join(fixture, 'evidence');
    const run = spawnSync(process.execPath, [
      runner, '--pr', 'main', '--repo', fixture,
      '--output', output, '--expect-head', sha,
    ], { encoding: 'utf8', timeout: 25000 });

    // This fixture intentionally does not contain real Combat/Quest suites.
    // The verifier must fail closed, but only AFTER it accepts the clone,
    // pins the exact main SHA and records each missing required suite.
    assert.equal(run.status, 1, run.stderr || String(run.error));
    assert.doesNotMatch(run.stderr, /Refusing to verify|supports --pr main only/);
    const report = JSON.parse(readFileSync(join(output, 'summary.json'), 'utf8'));
    assert.equal(report.status, 'failed');
    assert.equal(report.results[0].pr, 'main');
    assert.equal(report.results[0].head, sha);
    assert.equal(report.results[0].provenance, 'local_refs_heads_main');
    assert.ok(report.results[0].cases.some(c => c.status === 'missing_suite'));
    assert.equal(report.databaseVerified, false);
    assert.equal(report.liveGameVerified, false);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('95.2 CLI blocks cross-repo PR checkout before any fetch', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'axe-clone-952-blocked-'));
  try {
    git(fixture, 'init', '-b', 'main');
    git(fixture, 'remote', 'add', 'origin',
      'https://github.com/marcusflow1-arch/gitsync-pro.git');
    const run = spawnSync(process.execPath, [
      runner, '--pr', '934', '--repo', fixture,
    ], { encoding: 'utf8', timeout: 10000 });
    assert.equal(run.status, 2);
    assert.match(run.stderr, /clone supports --pr main only/i);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
