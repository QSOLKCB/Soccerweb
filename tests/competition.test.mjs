import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompetition,nextFixture,finishFixture,validCompetition} from '../modes/competition.mjs';
test('cup produces fixtures, simulates other games and completes a championship',async()=>{
  const c=createCompetition('cup',0,1988);assert.equal(new Set(c.field).size,8);
  for(let round=0;round<3;round++){
    assert.equal(nextFixture(c).teams[0],0);await finishFixture(c,[2,1],{});assert.equal(c.round,round+1);
  }
  assert.equal(c.complete,true);assert.equal(c.champion,0);assert.equal(c.history.length,7);assert.ok(validCompetition(c));
});
test('challenge progresses through seven distinct opponents and ends on defeat',async()=>{
  const c=createCompetition('challenge',3),seen=new Set();
  for(let i=0;i<7;i++){seen.add(nextFixture(c).teams[1]);await finishFixture(c,[1,0]);}
  assert.equal(seen.size,7);assert.equal(c.champion,3);assert.equal(c.complete,true);
  const loss=createCompetition('challenge',3);await finishFixture(loss,[0,2]);assert.equal(loss.eliminated,true);assert.equal(loss.complete,true);
});
test('competition state survives JSON serialization and ties cannot advance',async()=>{
  const c=createCompetition('cup',2);assert.ok(validCompetition(JSON.parse(JSON.stringify(c))));assert.equal(validCompetition({}),false);
  await assert.rejects(()=>finishFixture(c,[1,1]));
});
