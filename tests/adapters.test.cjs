const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('extension/adapters.js','utf8');
function context(host,path,doc){const c={URL,Set,location:{hostname:host,pathname:path,href:'https://'+host+path},document:doc,module:{exports:{}}};vm.runInNewContext(code,c);return c}
const img={currentSrc:'https://p3-pc-sign.douyinpic.com/demo.jpg',alt:'测试视频'};
const anchor={getClientRects:()=>[{}],closest:()=>null,getAttribute:()=>'/video/123',innerText:'视频描述',querySelector:s=>s==='img'?img:s==='p'?{innerText:'视频标题'}:null};
let tab='收藏';
const dy=context('www.douyin.com','/user/self',{querySelectorAll:s=>s.includes('role=')?[{textContent:tab}]:[anchor,anchor]});
let result=dy.module.exports.collect('douyin');assert.equal(result.length,1);assert.equal(result[0].platform,'douyin');assert.equal(result[0].source_types[0],'favorite');
tab='喜欢';assert.equal(dy.module.exports.collect('douyin')[0].source_types[0],'like');tab='作品';assert.throws(()=>dy.module.exports.collect('douyin'));
const card={querySelectorAll:s=>s==='a[href]'?[{href:'https://www.zhihu.com/question/9/answer/123'}]:[],querySelector:s=>s==='.AuthorInfo-name'?{textContent:'作者'}:s==='.ContentItem-title'?{textContent:'问题标题'}:s==='.RichContent-inner,.RichText'?{innerText:'摘要'}:null};
let clicks=0;const next={disabled:false,getAttribute:()=>null,click:()=>clicks++};
const zh=context('www.zhihu.com','/collection/99',{querySelector:s=>s==='main'?{querySelectorAll:()=>[card]}:s.includes('PaginationButton')?next:s==='.CollectionDetailPageHeader-title'?{textContent:'我的收藏'}:null});
result=zh.module.exports.collect('zhihu');assert.equal(result[0].source_id,'answer:123');assert.equal(result[0].source_collection,'我的收藏');assert.equal(zh.module.exports.advance('zhihu'),'next-page');assert.equal(clicks,1);next.disabled=true;assert.equal(zh.module.exports.advance('zhihu'),'end');zh.location.pathname='/collections/mine';assert.throws(()=>zh.module.exports.collect('zhihu'));
console.log('PASS: Douyin collection/likes, dedup, wrong tab, Zhihu answer/title/author/folder, next/end and wrong page');
