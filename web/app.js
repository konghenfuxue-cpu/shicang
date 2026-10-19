const $=s=>document.querySelector(s);let rows=[],editing;let key=localStorage.getItem('collection-key')||'';
const platformNames={x:'X',douyin:'抖音',zhihu:'知乎'};
const platformFilter=element('select');platformFilter.id='platform';platformFilter.setAttribute('aria-label','来源平台');platformFilter.append(new Option('所有平台',''),...Object.entries(platformNames).map(([value,text])=>new Option(text,value)));$('#collection').before(platformFilter);platformFilter.onchange=()=>render();
const sourceFilter=element('select');sourceFilter.id='source-type';sourceFilter.setAttribute('aria-label','来源类型');sourceFilter.append(new Option('所有来源类型',''),new Option('书签','bookmark'),new Option('喜欢','like'),new Option('收藏','favorite'));$('#collection').before(sourceFilter);sourceFilter.onchange=()=>render();
const sourceNames={bookmark:'书签',like:'喜欢',favorite:'收藏'};
document.title='拾藏 · 跨平台收藏馆';document.querySelector('.intro h1').textContent='你的灵感收藏馆 / X · 抖音 · 知乎';
const hash=new URLSearchParams(location.hash.slice(1));if(hash.has('key')){key=hash.get('key');localStorage.setItem('collection-key',key);history.replaceState(null,'',location.pathname)}$('#key').value=key;
const reducedMotion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function message(text){const toast=$('#message');toast.textContent=text;toast.style.display='block';toast.getAnimations().forEach(a=>a.cancel());if(!reducedMotion())toast.animate([{opacity:0,translate:'0 8px'},{opacity:1,translate:'0 0'}],{duration:160,easing:'ease-out'});clearTimeout(message.timer);message.timer=setTimeout(()=>{const animation=reducedMotion()?null:toast.animate([{opacity:1},{opacity:0}],{duration:130});if(animation)animation.onfinish=()=>toast.style.display='none';else toast.style.display='none'},4000)}
async function action(button,pending,task){
    if(button.disabled)return;
    const label=button.textContent;button.style.minInlineSize=button.getBoundingClientRect().width+'px';button.disabled=true;button.setAttribute('aria-busy','true');button.textContent=pending;
    try{await task();button.classList.add('is-complete');setTimeout(()=>button.classList.remove('is-complete'),900)}catch(e){message(e.message)}
    finally{button.disabled=false;button.removeAttribute('aria-busy');if(button.textContent===pending)button.textContent=label;button.style.minInlineSize=''}
}
function openDialog(dialog){dialog.getAnimations().forEach(a=>a.cancel());if(!dialog.open)dialog.showModal();if(!reducedMotion())dialog.animate([{opacity:0,transform:'translateY(8px) scale(.99)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:180,easing:'cubic-bezier(.2,.7,.2,1)'})}
function closeDialog(dialog){if(!dialog.open||dialog.dataset.closing)return;dialog.dataset.closing='true';const finish=()=>{dialog.close();delete dialog.dataset.closing};if(reducedMotion())return finish();dialog.getAnimations().forEach(a=>a.cancel());dialog.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(5px)'}],{duration:120,easing:'ease-in'}).onfinish=finish}
function updateCount(){const count=$('#cards').children.length;$('#count').textContent=`${count} 件收藏 · 共 ${rows.length} 件`;$('#empty').hidden=count>0}
function refreshCard(record){const card=$(`#cards [data-record-id="${record.id}"]`);if(card){if(matchesFilters(record))card.replaceWith(createCard(record));else card.remove()}const selected=$('#tag').value;options('#tag',[...new Set([...rows.flatMap(r=>r.tags),...(selected?[selected]:[])])].sort(),'所有标签');updateCount()}
async function api(path,body,method='POST'){const r=await fetch('/api/'+path,{method:body===undefined?'GET':method,headers:{'Content-Type':'application/json','X-Collection-Token':key},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error||'请求失败');return data}
function element(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
function options(id,values,label){const node=$(id),old=node.value;node.replaceChildren(new Option(label,''),...values.map(x=>new Option(x,x)));node.value=old}
async function load(){try{rows=await api('bookmarks');options('#collection',[...new Set(rows.map(r=>r.source_collection))].sort(),'所有收藏夹');options('#tag',[...new Set(rows.flatMap(r=>r.tags))].sort(),'所有标签');render()}catch(e){message(e.message)}}
function matchesFilters(r){const query=$('#search').value.toLowerCase(),col=$('#collection').value,tag=$('#tag').value,state=$('#read').value;return (!platformFilter.value||r.platform===platformFilter.value)&&(!sourceFilter.value||(r.source_types||['bookmark']).includes(sourceFilter.value))&&(!query||[r.title,r.author_name,r.author_handle,r.excerpt,r.note,...r.tags].join(' ').toLowerCase().includes(query))&&(!col||r.source_collection===col)&&(!tag||r.tags.includes(tag))&&(!state||(state==='read')===r.is_read)}
function render(){let filtered=rows.filter(matchesFilters);if($('#sort').value==='old')filtered=filtered.slice().reverse();$('#cards').replaceChildren();$('#empty').hidden=filtered.length>0;$('#count').textContent=`${filtered.length} 件收藏 · 共 ${rows.length} 件`;
for(const r of filtered)$('#cards').append(createCard(r));
}
function createCard(r){
    const card=element('article',undefined,'card');card.dataset.recordId=r.id;
    if(r.thumbnail_url){const image=element('img');image.src=r.thumbnail_url;image.loading='lazy';image.alt='收藏预览';image.referrerPolicy='no-referrer';image.onerror=()=>image.remove();card.append(image)}
    const content=element('div',undefined,'content');
    content.append(element('div',r.author_name||r.author_handle||platformNames[r.platform]+'收藏','author'),element('div',(r.author_handle?'@'+r.author_handle+' · ':'')+platformNames[r.platform],'handle'));
    for(const type of r.source_types||['bookmark'])content.append(element('span',sourceNames[type]||type,'tag'));
    if(r.title)content.append(element('h3',r.title));
    if(r.excerpt!==r.title)content.append(element('div',r.excerpt||'一条值得保留的收藏','excerpt'));
    for(const tag of r.tags)content.append(element('span',tag,'tag'));
    if(r.note)content.append(element('p',r.note,'note'));
    content.append(element('div',`${r.source_collection} · ${new Date(r.first_imported_at).toLocaleDateString()}`,'meta'));
    const actions=element('div',undefined,'actions'),link=element('a','打开原帖 ↗');link.href=r.canonical_url;link.target='_blank';link.rel='noopener noreferrer';
    const read=element('button',r.is_read?'✓ 已看':'标记已看');read.setAttribute('aria-pressed',String(r.is_read));read.classList.toggle('is-read',r.is_read);read.onclick=()=>action(read,'保存中…',async()=>{await api('bookmarks/'+r.id,{is_read:!r.is_read},'PATCH');r.is_read=!r.is_read;read.textContent=r.is_read?'✓ 已看':'标记已看';read.setAttribute('aria-pressed',String(r.is_read));read.classList.toggle('is-read',r.is_read);if($('#read').value&&($('#read').value==='read')!==r.is_read){card.remove();updateCount()}message(r.is_read?'已标记为看过':'已恢复为未看')});
    const edit=element('button','整理');edit.onclick=()=>{editing=r;$('#tags').value=r.tags.join(', ');$('#note').value=r.note;openDialog($('#editor'))};
    actions.append(link,read,edit);content.append(actions);card.append(content);return card;
}
$('#connect').onclick=()=>{key=$('#key').value.trim();localStorage.setItem('collection-key',key);load()};$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(key);message('已复制，请粘贴到扩展配置')}catch{message('请手动复制连接密钥')}};
for(const id of ['#search','#collection','#tag','#read','#sort'])$(id).addEventListener('input',render);
$('#save').onclick=e=>{e.preventDefault();const record=editing,patch={tags:[...new Set($('#tags').value.split(/[,，]/).map(t=>t.trim().slice(0,80)).filter(Boolean))].slice(0,30),note:$('#note').value.slice(0,10000)};action($('#save'),'保存中…',async()=>{await api('bookmarks/'+record.id,patch,'PATCH');Object.assign(record,patch);closeDialog($('#editor'));refreshCard(record);message('标签与备注已保存')})};
function download(data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=element('a');a.href=url;a.download='x-collection-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('#export').onclick=async()=>{try{download(await api('export'))}catch(e){message(e.message)}};
$('#file').onchange=async e=>{try{const data=JSON.parse(await e.target.files[0].text()),items=Array.isArray(data)?data:data.items;if(!Array.isArray(items))throw Error('JSON 中没有记录数组');const p=await api('preview',{items});if(confirm(`新增 ${p.added}，已有 ${p.existing}，无效 ${p.failed}。确认导入？`)){const result=await api('import',{items,mode:'json'});message(`已收录 ${result.added} 条，更新 ${result.updated} 条`);await load()}}catch(err){message(err.message)}finally{e.target.value=''}};
$('#history').onclick=()=>action($('#history'),'读取中…',async()=>{const list=await api('history');$('#record-list').replaceChildren(...list.map(r=>element('div',`${new Date(r.time).toLocaleString()} · ${r.mode}\n新增 ${r.added} / 更新 ${r.updated} / 重复 ${r.unchanged} / 失败 ${r.failed}`,'record')));openDialog($('#records'))});$('#close-records').onclick=()=>closeDialog($('#records'));
$('#copy').onclick=()=>action($('#copy'),'复制中…',async()=>{try{await navigator.clipboard.writeText(JSON.stringify({address:location.origin,key}));message('已复制地址和密钥，粘贴到扩展密钥栏后保存')}catch{throw Error('复制未成功，请手动填写当前网页地址并复制密钥')}});
for(const dialog of document.querySelectorAll('dialog')){
    dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog(dialog)});
    dialog.addEventListener('click',e=>{if(e.target.closest('button[value="cancel"]')){e.preventDefault();closeDialog(dialog)}if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(dialog)}});
}
if(key)load();else render();
function tapFeedback(event){const target=event.target.closest('button,.button,.actions a');if(!target||target.disabled)return;if(event.type==='keydown'&&(!['Enter',' '].includes(event.key)||event.repeat))return;const rect=target.getBoundingClientRect();target.style.setProperty('--tap-x',(event.type==='pointerdown'?event.clientX-rect.left:rect.width/2)+'px');target.style.setProperty('--tap-y',(event.type==='pointerdown'?event.clientY-rect.top:rect.height/2)+'px');target.classList.remove('tap-flash');void target.offsetWidth;target.classList.add('tap-flash');clearTimeout(target._tapTimer);target._tapTimer=setTimeout(()=>target.classList.remove('tap-flash'),500)}
document.addEventListener('pointerdown',tapFeedback);document.addEventListener('keydown',tapFeedback);
