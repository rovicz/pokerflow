import test from 'node:test';
import assert from 'node:assert/strict';
import {deck,score,start,act,view} from '../lib/engine.mjs';
test('deck is unique',()=>{assert.equal(new Set(deck()).size,52)});
test('royal flush beats four of a kind',()=>{assert.ok(score([8,9,10,11,12])>score([12,25,38,51,0]))});
test('2–8 players: privacy, termination and chip conservation',()=>{for(let n=2;n<=8;n++)for(let round=0;round<30;round++){const s={phase:'waiting',dealer:-1,hand:0,sb:10,bb:20,seconds:60,players:Array.from({length:n},(_,i)=>({id:String(i),name:'P'+i,stack:2000}))};start(s);const v=view(s,'0');assert.equal(v.deck,undefined);for(const p of v.players.filter(p=>p.id!=='0'))assert.deepEqual(p.cards,[-1,-1]);let steps=0;while(s.phase!=='settled'){assert.ok(++steps<100);const p=s.players[s.turn];act(s,p.id,p.bet<s.current?'call':'check')}assert.equal(s.players.reduce((a,p)=>a+p.stack,0),2000*n)}});
test('last action is recorded for table sounds',()=>{const s={phase:'waiting',dealer:-1,hand:0,sb:10,bb:20,seconds:60,players:[{id:'a',name:'A',stack:500},{id:'b',name:'B',stack:500}]};start(s);const seat=s.turn;act(s,s.players[seat].id,'call');assert.deepEqual(s.last,{seat,type:'call',seq:1});act(s,s.players[s.turn].id,'check');assert.equal(s.last.type,'check');assert.equal(s.last.seq,2)});
import {cleanAvatar} from '../lib/avatars.mjs';
test('avatar: aceita só estilo da lista e seed simples',()=>{assert.deepEqual(cleanAvatar({style:'bottts',seed:'abc-1'},'Ana'),{style:'bottts',seed:'abc-1'});assert.deepEqual(cleanAvatar({style:'../x',seed:'a'},'Ana B'),{style:'lorelei',seed:'Ana_B'});assert.equal(cleanAvatar({style:'bottts',seed:'<script>'},'').seed,'zake')});
