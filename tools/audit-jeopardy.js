#!/usr/bin/env node
/* Three real, separately stored phone pages through the real relay. Run with
   NODE_PATH=$(npm root -g) node tools/audit-jeopardy.js. No test content is shipped. */
'use strict';
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const path = require('node:path');
const {chromium} = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const PORT = 8124;
const BASE = process.env.AUDIT_URL || `http://127.0.0.1:${PORT}`;
let passed=0, failed=0, debug=async()=>{};
async function test(name, fn){
  try{ await fn(); passed++; console.log('ok   '+name); }
  catch(e){ failed++; console.error('FAIL '+name+'\n'+e.stack); await debug(); }
}
async function main(){
  const relay = process.env.AUDIT_URL ? null : spawn(process.execPath,[path.join(ROOT,'tools/buzzer-relay.js')],{env:{...process.env,PORT},stdio:'ignore'});
  let browser;
  try{
    for(let n=0;n<50;n++){
      if(await fetch(BASE+'/buzzer/health').then(r=>r.ok).catch(()=>false)) break;
      await new Promise(r=>setTimeout(r,100));
    }
    browser=await chromium.launch();
    const hostContext=await browser.newContext({viewport:{width:1280,height:720}});
    const host=await hostContext.newPage();
    const errors=[];
    const track=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error' && /TypeError|ReferenceError|SyntaxError/.test(m.text()))errors.push(m.text())});p.setDefaultTimeout(6000);};
    track(host);
    await host.goto(BASE+'/game-hub-lab.html');
    await host.evaluate(()=>{
      const S=HubSettings;S.set('intro','off');S.set('cardFlip','off');S.set('sound',false);
      S.set('roster','solo');S.set('buzzers',true);S.set('roundWinBanner',false);
      S.set('roundOpenToAll',true);S.set('roundSend',true);
    });
    await host.getByText('Lab',{exact:false}).first().click();
    await host.locator('h3:visible',{hasText:'Jeopardy'}).first().click();
    await host.waitForFunction(()=>window.HubHost);
    const code=await host.evaluate(()=>HubHost.code);
    const phones=await Promise.all(['Alice','Bob','Carol'].map(async name=>{
      const p=await browser.newPage({viewport:{width:390,height:664},isMobile:true,hasTouch:true});track(p);
      await p.goto(BASE+'/join.html?code='+code);
      await p.locator('#name').fill(name);await p.locator('#join-btn').click();
      await p.locator('#screen-play.active').waitFor();return p;
    }));
    await host.waitForFunction(()=>HubHost.players().length===3&&HubEnv.teams().length===3);
    for(let i=0;i<3;i++)await host.locator('#content-list input').nth(i).check();
    await host.locator('#start-btn').click();
    await host.waitForFunction(()=>document.querySelector('#board .tile'));
    await host.evaluate(()=>HubHost.on('response',d=>window.__auditReply=d));

    await test('a hidden word table has valid geometry before it is shown',async()=>{
      await host.evaluate(()=>{
        const mount=document.createElement('div');mount.style.display='none';
        const canvas=document.createElement('canvas');mount.append(canvas);document.body.append(mount);
        try{
          const table=HubKit.table({canvas});
          table.slots({cols:'auto',bar:true,labels:['one','two','three']});
          table.setPieces(['one','two','three']);table.draw(performance.now());
          if(table.slotBox(0).w<=0)throw new Error('Hidden table has a negative slot');
        }finally{mount.remove()}
      });
    });
    await test('three simultaneous real joins have separate seats',async()=>{
      const p=await host.evaluate(()=>HubHost.players());assert.equal(new Set(p.map(x=>x.team)).size,3);
      assert.equal(new Set(p.map(x=>x.id)).size,3);
    });
    await test('settings bench updates an open board and does not overwrite later choices',async()=>{
      const bench=await hostContext.newPage();await bench.goto(BASE+'/playground/question-bench.html');
      await bench.evaluate(()=>{HubSettings.set('round_default','write');HubSettings.set('jRules','classic');HubSettings.set('jDeduct',false);});
      await host.waitForFunction(()=>HubSettings.get('round_default','jeopardy')==='buzz'&&HubSettings.get('jDeduct','jeopardy')===false);
      await host.evaluate(()=>HubSettings.set('sound',false));
      assert.equal(await bench.evaluate(()=>HubSettings.get('jDeduct','jeopardy')),false);
      const variants=await bench.evaluate(()=>HubSettings.variantsFor('roundPay').map(v=>v.value));
      assert.deepEqual(variants.sort(),['clock','equal','podium','winner']);
      await bench.close();
      await host.evaluate(()=>{HubSettings.set('jRules','hub');HubSettings.set('roundWinBanner',false);});
    });
    debug=async()=>{console.log('HOST',await host.evaluate(()=>({state:HubEnv.roundState()&&{mode:HubEnv.roundState().mode,input:HubEnv.roundState().input,picks:HubEnv.roundState().picks,done:HubEnv.roundState().done,got:HubEnv.roundState().got,assign:HubEnv.roundState().assign},players:HubHost.players(),results:HubKit.round.results.list(),last:window.__auditReply})));for(const p of phones)console.log('PHONE',await p.evaluate(()=>({cells:window.__tbl?.table.cells(),text:document.body.innerText,arm:window.__auditArm,delivery:window.__auditDelivery})));};
    for(const p of phones)await p.evaluate(()=>{HubPlayer.on('armed',d=>window.__auditArm=d);HubPlayer.on('joined',d=>window.__auditArm=d);HubPlayer.on('delivery',d=>window.__auditDelivery=d)});
    const open=async(id,physics)=>{
      const previous=await Promise.all(phones.map(p=>p.evaluate(()=>window.__auditArm?.roundId)));
      await host.evaluate(({id,physics})=>{
        const E=HubEnv,def=HubKit.round.get(id),item=JSON.parse(JSON.stringify(def.sample));
        if(physics!=null)item.physics=physics;
        E.setClueValue(100);
        E.openRoundOnCard({game:'jeopardy',mode:'jeopardy',item,topline:'Audit · '+def.label});
      },{id,physics});
      await Promise.all(phones.map((p,i)=>p.waitForFunction(old=>window.__auditArm?.roundId&&window.__auditArm.roundId!==old,previous[i])));
    };
    const complete=async(p,words)=>{
      if(await p.locator('#table').isVisible()){
        await p.waitForFunction(()=>window.__tbl&&window.__tbl.table);
        await p.evaluate(words=>{words.forEach((w,i)=>__tbl.table.place(i,w));__tbl.send();},words);
      }else if(await p.locator('#arrange').isVisible()){
        // Public pointer controls: each tile is dragged into a slot by its label.
        for(const word of words){
          const tile=p.locator('#ana-tray .ana-tile').filter({hasText:new RegExp('^'+word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).first();
          await tile.click();
        }
      }else{
        for(const word of words)await p.locator('#opts button').filter({hasText:new RegExp('^'+word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).click();
      }
      if(await p.locator('#commit').isVisible())await p.locator('#commit').click();
    };
    const solution=async id=>host.evaluate(id=>{
      const s=HubEnv.roundState();
      if(id==='choice')return [s.answer];
      if(id==='grouping')return s.pick;
      if(id==='ordering')return s.scale.slice().reverse();
      if(id==='anagram')return s.answer.split('');
      if(id==='scramble')return s.answer.split(' ');
      return s.groups.flatMap(g=>g.words);
    },id);
    const close=async()=>{
      if(await host.locator('#reveal-btn').isVisible())await host.locator('#reveal-btn').click();
      await host.locator('#close-btn').waitFor({state:'visible'});
      await host.locator('#close-btn').click();
      await host.locator('#clue-modal').waitFor({state:'hidden'});
    };
    for(const [id,physics] of [['choice',false],['choice',true],['grouping',false],['grouping',true],['anagram',true],['scramble',true],['ordering',true],['connections',true]]){
      await test(id+(physics?' flick':' tap')+': three players finish, receive verdicts and score once',async()=>{
        const before=await host.evaluate(()=>HubEnv.teams().map(t=>t.score));
        await open(id,physics);
        const words=await solution(id);
        for(let i=0;i<phones.length;i++){
          await complete(phones[i],words);
          await host.waitForFunction(n=>HubKit.round.results.finished().length===n,i+1);
          assert.equal(await host.evaluate(()=>HubEnv.roundLive()),true,'first finish must leave the round open');
          await phones[i].waitForFunction(()=>document.querySelector('#commit').textContent==='Complete');
        }
        const reply=await host.evaluate(()=>window.__auditReply.latest.value);
        assert.equal(reply,words.join('|'),'relay carries the entire arrangement');
        await close();
        const after=await host.evaluate(()=>HubEnv.teams().map(t=>t.score));
        assert.equal(after.reduce((a,x,i)=>a+x-before[i],0),200,'100/50/50 podium, once each');
        assert.deepEqual(errors,[]);
      });
    }
    await test('a failed delivery can be retried without losing the answer',async()=>{
      await open('choice',false);const words=await solution('choice');
      await phones[0].route('**/buzzer/send',route=>route.abort());
      await complete(phones[0],words);
      await phones[0].waitForFunction(()=>document.querySelector('#state').textContent.startsWith('Not sent'));
      assert.equal(await host.evaluate(()=>HubKit.round.results.finished().length),0);
      await phones[0].unroute('**/buzzer/send');
      await phones[0].locator('#commit').click();
      await host.waitForFunction(()=>HubKit.round.results.finished().length===1);
      await close();
    });
    await test('a delayed answer cannot enter the next question',async()=>{
      await open('choice',false);
      const old=await phones[0].evaluate(()=>({id:HubPlayer.id,roundId:window.__auditArm.roundId}));
      await host.locator('#close-btn').click();await open('grouping',false);
      const result=await phones[0].evaluate(async ({old,code})=>fetch('/buzzer/send',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...old,room:code,type:'respond',value:'late'})
      }).then(r=>r.json()),{old,code});
      assert.equal(result.ignored,'old question');
      assert.equal(await host.evaluate(()=>HubKit.round.results.finished().length),0);
      await host.locator('#close-btn').click();
    });
    await test('a wrong Connections arrangement can be corrected',async()=>{
      await open('connections',true);const words=await solution('connections');
      const wrong=words.slice();[wrong[0],wrong[4]]=[wrong[4],wrong[0]];
      await complete(phones[0],wrong);
      await phones[0].waitForFunction(()=>document.body.dataset.verdict==='wrong');
      assert.equal(await host.evaluate(()=>HubKit.round.results.finished().length),0);
      await phones[0].waitForFunction(()=>!document.querySelector('#commit').disabled,null,{timeout:15000});
      await phones[0].evaluate(words=>{const t=__tbl.table,a=window.__auditArm;t.reset();t.slots({cols:a.cols,rows:a.rows,bar:a.bar,labels:words});t.setPieces(words)},words);
      await complete(phones[0],words);
      await host.waitForFunction(()=>HubKit.round.results.finished().length===1);
      await close();
    });
    await test('completed phone reload preserves identity, answer and completion',async()=>{
      await open('connections',true);const words=await solution('connections');
      await complete(phones[0],words);await host.waitForFunction(()=>HubKit.round.results.finished().length===1);
      const id=await phones[0].evaluate(()=>HubPlayer.id);
      await phones[0].reload();
      await phones[0].waitForFunction(()=>window.HubPlayer&&document.querySelector('#commit').textContent==='Complete');
      assert.equal(await phones[0].evaluate(()=>HubPlayer.id),id);
      assert.deepEqual(await phones[0].evaluate(()=>__tbl.table.cells()),words);
      const result=await phones[0].evaluate(()=>HubPlayer.respond('again'));
      assert.equal(result.ignored,'finished');
      await phones[0].evaluate(()=>{HubPlayer.on('armed',d=>window.__auditArm=d);HubPlayer.on('joined',d=>window.__auditArm=d)});
      await close();
    });
    await test('Information Gap lets all individual players finish',async()=>{
      await open('infogap');
      for(let i=0;i<phones.length;i++){
        const id=await phones[i].evaluate(()=>HubPlayer.id);
        const word=await host.evaluate(id=>{const s=HubEnv.roundState();return s.targets[s.assign[id].ti].word;},id);
        await phones[i].locator('#reply').fill(word);await phones[i].locator('#send').click();
        await host.waitForFunction(n=>HubKit.round.results.finished().length===n,i+1);
      }
      assert.equal(await host.evaluate(()=>HubEnv.roundLive()),true);await close();
    });
    await test('no browser exceptions across the rehearsal',async()=>assert.deepEqual(errors,[]));
    await host.screenshot({path:'/tmp/engishism-jeopardy-audit.png'});
  }finally{
    if(browser)await browser.close();if(relay)relay.kill();
  }
  console.log(`${passed} passed, ${failed} failed`);process.exitCode=failed?1:0;
}
main().catch(e=>{console.error(e);process.exitCode=1});
