const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('web/app.js','utf8');
const code=source.slice(source.indexOf('async function action('),source.indexOf('function openDialog('));
const messages=[];const context={message:text=>messages.push(text),setTimeout:()=>0};vm.createContext(context);vm.runInContext(code,context);
function button(){return {textContent:'保存',disabled:false,style:{},attributes:{},classList:{add(){},remove(){}},getBoundingClientRect:()=>({width:88}),setAttribute(k,v){this.attributes[k]=v},removeAttribute(k){delete this.attributes[k]}}}
(async()=>{
    const b=button();let count=0,release;
    const deferred=new Promise(resolve=>release=resolve);
    const first=context.action(b,'保存中…',async()=>{count++;await deferred});
    assert.equal(b.disabled,true);assert.equal(b.textContent,'保存中…');assert.equal(b.attributes['aria-busy'],'true');
    await context.action(b,'保存中…',async()=>count++);assert.equal(count,1);
    release();await first;assert.equal(b.disabled,false);assert.equal(b.textContent,'保存');assert.equal(b.attributes['aria-busy'],undefined);
    await context.action(b,'保存中…',async()=>{throw Error('网络不可用')});assert.equal(b.disabled,false);assert.equal(b.textContent,'保存');assert.deepEqual(messages,['网络不可用']);
    console.log('PASS: immediate feedback, duplicate-click guard, success reset and error recovery');
})().catch(error=>{console.error(error);process.exitCode=1});
