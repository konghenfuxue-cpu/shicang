const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('web/app.js','utf8');const start=source.indexOf('function tapFeedback('),end=source.indexOf("document.addEventListener('pointerdown',tapFeedback)",start);
let calls=0;const styles={},classes=new Set();const button={disabled:false,style:{setProperty:(k,v)=>styles[k]=v},classList:{add:k=>{classes.add(k);calls++},remove:k=>classes.delete(k)},getBoundingClientRect:()=>({left:10,top:20,width:100,height:40}),offsetWidth:100};
const context={setTimeout:()=>1,clearTimeout(){}};vm.createContext(context);vm.runInContext(source.slice(start,end),context);
const target={closest:()=>button};context.tapFeedback({target,type:'pointerdown',clientX:35,clientY:30});assert.equal(styles['--tap-x'],'25px');assert.equal(styles['--tap-y'],'10px');assert.ok(classes.has('tap-flash'));
context.tapFeedback({target,type:'keydown',key:'Enter',repeat:false});assert.equal(styles['--tap-x'],'50px');assert.equal(calls,2);
context.tapFeedback({target,type:'keydown',key:'a'});button.disabled=true;context.tapFeedback({target,type:'pointerdown'});assert.equal(calls,2);
console.log('PASS: pointer-position flash, keyboard center and ignored non-action/disabled input');
