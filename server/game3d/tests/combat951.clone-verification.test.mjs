// Combat/Quest 95.1 — clone ONLY. Validate that the native 95.0 proof runs
// and no private world/Questbook authority has been activated in public play.
// A passing offline test never proves PostgreSQL/live integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {OFFLINE_GAME3D_SUITES_851,verifyGame3DEntryPoint851,
  buildGame3DOfflineChildEnv851} from '../tools/verifyCombatQuest851.mjs';
import {combatFoundationHealthDisclosure} from '../combatFoundationManifest.mjs';

const file=path=>new URL('../../../'+path,import.meta.url);
const source=path=>readFileSync(file(path),'utf8');
const workflowPath='.github/workflows/game3d-combat-950.yml';
const gate=source(workflowPath);

test('clone 95.1 restores the formerly missing 95.0 native Node 22 CI workflow',()=>{
  assert.equal(existsSync(file(workflowPath)),true);
  assert.match(gate,/node-version:\s*'22'/);
  assert.match(gate,/node --test server\/game3d\/tests\/combat950\.ci-release-gate\.test\.mjs/);
  assert.match(gate,/node --test server\/game3d\/tests\/combat951\.clone-verification\.test\.mjs/);
  assert.match(gate,/node server\/game3d\/tools\/verifyCombatQuest851\.mjs/);
  assert.doesNotMatch(gate,/continue-on-error:\s*true|\|\|\s*true/);
});

test('95.1 executes all 31 merged offline regression suites, including post-input lease',()=>{
  assert.equal(OFFLINE_GAME3D_SUITES_851.length,31);
  assert.equal(new Set(OFFLINE_GAME3D_SUITES_851).size,31);
  for(const name of ['combat844.scheduler.test.mjs',
    'combat868.admission-shutdown.test.mjs',
    'combat869.scheduler-shutdown.test.mjs',
    'combat870.combined-shutdown.test.mjs',
    'combat871.monotonic-clock.test.mjs',
    'combat872.lease-snapshot.test.mjs',
    'combat873.post-input-lease.test.mjs']){
    assert.ok(OFFLINE_GAME3D_SUITES_851.includes(name),name+' missing from offline verification');
    assert.equal(existsSync(file('server/game3d/tests/'+name)),true,
      name+' required suite must exist');
  }
});

test('95.1 clone must not mount a private staging authority into the duel worker',()=>{
  const entry=source('server/game3d/index.mjs');
  assert.deepEqual(verifyGame3DEntryPoint851(entry),{ok:true});
  for(const name of [
    'privateCombatQuestScheduler844.mjs',
    'privateCombatQuestAdmission845.mjs',
    'privateCombatQuestStaging850.mjs',
    'privateQuestbookPreviewTransport850.mjs',
  ])assert.equal(verifyGame3DEntryPoint851("import './"+name+"'").ok,false);
});

test('95.1 leaves production reward, open world cutover and release switches off',()=>{
  const health=combatFoundationHealthDisclosure();
  for(const key of [
    'publicPlayerSessionIssuanceEnabled',
    'privateWorldPublicPlayerTransportInstalled',
    'worldCombatCandidateRewardAuthority',
    'openWorldCombatAuthorityConnected',
    'progressionRewardsActivated',
    'productionReleaseApproved',
    'gameplayIntegrationBetaVerified',
  ])assert.equal(health[key],false,key+' must not be enabled by native preview proof');
});

test('95.1 child Node test gate blocks inherited test context and accidental previews',()=>{
  const parent={NODE_TEST_CONTEXT:'child-v8',
    GAME3D_PRIVATE_QUESTBOOK_PREVIEW_850:'true'};
  const child=buildGame3DOfflineChildEnv851(parent);
  assert.equal(Object.hasOwn(child,'NODE_TEST_CONTEXT'),false);
  assert.equal(child.GAME3D_PRIVATE_QUESTBOOK_PREVIEW_850,'');
  assert.equal(parent.NODE_TEST_CONTEXT,'child-v8');
});
