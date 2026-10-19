const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('extension/theme.js','utf8');
function run(saved){
    const state={'collector-theme':saved},root={dataset:{}},main={prepend(node){this.control=node}};
    const document={documentElement:root,querySelector:()=>main,createElement:()=>({append(...nodes){this.children=nodes},setAttribute(){},addEventListener(event,fn){this[event]=fn}})};
    const context={document,localStorage:{getItem:k=>state[k],setItem:(k,v)=>state[k]=v},Option:function(text,value){this.text=text;this.value=value}};
    vm.runInNewContext(source,context);
    return {state,root,select:main.control.children[0]};
}
let result=run(null);assert.equal(result.root.dataset.theme,'light');
result.select.value='dark';result.select.change();assert.equal(result.root.dataset.theme,'dark');assert.equal(result.state['collector-theme'],'dark');
result=run('dark');assert.equal(result.root.dataset.theme,'dark');
result.select.value='light';result.select.change();assert.equal(result.state['collector-theme'],'light');
assert.equal(run('unexpected').root.dataset.theme,'light');
console.log('PASS: light default, dark/light switching, saved preference and invalid-value fallback');
