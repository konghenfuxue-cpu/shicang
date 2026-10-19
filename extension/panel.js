const $=s=>document.querySelector(s);const tabId=Number(new URLSearchParams(location.search).get('tab'));let items=new Map(),running=false,stopped=false;
const themeScript=document.createElement('script');themeScript.src=chrome.runtime.getURL('theme.js');document.head.append(themeScript);
document.title='拾藏 · 跨平台采集';document.querySelector('h1').textContent='把跨平台收藏带回家';document.querySelector('main > p').textContent='支持 X 书签/喜欢、抖音收藏/喜欢、知乎收藏夹。先打开对应的内容页，再点击扩展图标。知乎每轮读取一页，抖音和 X 每轮滚动加载。';
const addressLabel=document.createElement('label');addressLabel.textContent='本地收藏馆地址';const addressInput=document.createElement('input');addressInput.id='address';addressInput.value='http://127.0.0.1:8765';addressLabel.append(addressInput);$('#key').parentElement.before(addressLabel);
chrome.storage.local.get(['key','address']).then(s=>{$('#key').value=s.key||'';addressInput.value=s.address||addressInput.value});
function getAddress(){const value=addressInput.value.trim().replace(/\/$/,'');if(!/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(value))throw Error('地址必须是 http://127.0.0.1:端口');return value}
$('#key').addEventListener('input',()=>{try{const config=JSON.parse($('#key').value);if(typeof config.key==='string'&&typeof config.address==='string'){addressInput.value=config.address;$('#key').value=config.key;status('已识别地址和密钥，请保存连接设置')}}catch{}});
$('#save').onclick=async()=>{try{await chrome.storage.local.set({key:$('#key').value.trim(),address:getAddress()});status('连接设置已保存')}catch(e){status(e.message)}};
function status(s){$('#status').textContent=s}function show(){ $('#preview-list').replaceChildren(...[...items.values()].slice(0,200).map(r=>{const div=document.createElement('div');div.className='item';const platform={x:'X',douyin:'抖音',zhihu:'知乎'}[r.platform||'x'];const types=(r.source_types||[]).map(t=>({bookmark:'书签',favorite:'收藏',like:'喜欢'}[t])).join(' / ');div.textContent=`${platform} · ${types}${r.author_name?' · '+r.author_name:''}\n${r.title||r.excerpt}\n${r.url}`;return div}))}
async function api(path){const response=await fetch(getAddress()+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Collection-Token':$('#key').value.trim()},body:JSON.stringify({items:[...items.values()],mode:stopped?'partial':'browser'})});const data=await response.json();if(!response.ok)throw Error(data.error);return data}
// Runs only after an explicit user click, inside the selected X tab. No cookies or request headers are accessed.
function collectVisible(){
    if(!/^https:\/\/(www\.)?x\.com\/i\/(?:bookmarks|history)(?:\/|$)/.test(location.origin+location.pathname))throw Error('请先打开 X 收藏页面');
    let sourceType='bookmark';
    if(/^\/i\/history(?:\/|$)/.test(location.pathname)){
        const selected=document.querySelector('[role="tab"][aria-selected="true"]');
        const label=selected?.textContent?.trim()||'';
        const href=selected?.getAttribute('href')||'';
        if(/^(喜欢|喜歡|いいね|마음에 들어요|Likes)$/i.test(label)||/^\/i\/(?:history\/)?likes(?:\/|$)/.test(href))sourceType='like';
        else if(/^(书签|書籤|ブックマーク|북마크|Bookmarks)$/i.test(label)||/^\/i\/bookmarks(?:\/|$)/.test(href))sourceType='bookmark';
        else if(/^\/i\/history\/likes\/?$/.test(location.pathname))sourceType='like';
        else throw Error('无法识别来源分类，请选中“书签”或“喜欢”标签后重试');
    }
    return [...document.querySelectorAll('article[data-testid="tweet"]')].flatMap(article=>{
        const time=article.querySelector('time');const anchor=time?.closest('a[href*="/status/"]');if(!anchor)return [];
        const m=new URL(anchor.href).pathname.match(/^\/([A-Za-z0-9_]+)\/status\/(\d+)/);if(!m)return [];
        const user=article.querySelector('[data-testid="User-Name"]');const text=article.querySelector('[data-testid="tweetText"]');const image=article.querySelector('[data-testid="tweetPhoto"] img');
        return [{url:`https://x.com/${m[1]}/status/${m[2]}`,source_id:m[2],source_types:[sourceType],author_handle:m[1],author_name:user?.innerText.split('\n')[0]||m[1],excerpt:text?.innerText||'',thumbnail_url:image?.src||''}];
    });
}
$('#scan').onclick=async()=>{
    if(running)return;running=true;stopped=false;$('#scan').disabled=true;$('#stop').disabled=false;
    let stable=0;const rounds=Math.max(1,Math.min(300,Number($('#rounds').value)||30));
    try{
        const tab=await chrome.tabs.get(tabId);
        const page=new URL(tab.url),platform=['x.com','www.x.com'].includes(page.hostname)?'x':['douyin.com','www.douyin.com'].includes(page.hostname)?'douyin':['www.zhihu.com','zhihu.com'].includes(page.hostname)?'zhihu':null;
        if(!platform)throw Error('请在 X 书签/喜欢、抖音收藏/喜欢或知乎收藏夹内容页点击扩展图标');
        let previousSignature='',waiting=0;
        for(let i=0;i<rounds&&!stopped;i++){
            if(platform!=='x')await chrome.scripting.executeScript({target:{tabId},files:['adapters.js']});
            const result=await chrome.scripting.executeScript({target:{tabId},func:platform==='x'?collectVisible:(p)=>globalThis.ShicangAdapters.collect(p),args:platform==='x'?[]:[platform]});
            const batch=result[0].result||[];
            const signature=batch.map(r=>r.source_id).join(',');
            if(platform==='zhihu'&&(!batch.length||(previousSignature&&signature===previousSignature))){
                if(++waiting>=5)throw Error('知乎翻页后内容未更新，已停止；本次已读取结果仍可提交');
                await new Promise(r=>setTimeout(r,2000));continue;
            }
            previousSignature=signature;waiting=0;
            const before=items.size;
            for(const r of batch){
                const identity=(r.platform||'x')+':'+r.source_id,old=items.get(identity),manual=$('#collection').value.trim();
                items.set(identity,{...r,source_types:[...new Set([...(old?.source_types||[]),...r.source_types])],source_collection:manual&&manual!=='未分类'?manual:(r.source_collection||'未分类')});
            }
            stable=before===items.size?stable+1:0;
            status(`扫描第 ${i+1}/${rounds} 轮，累计 ${items.size} 条。${stable?'等待更多内容加载…':''}`);show();
            if(stable>=5){status(`扫描停止：连续 5 轮没有新记录，累计 ${items.size} 条。页面可能到底、加载受限或需要登录，请核对 X 页面；此结果不保证覆盖全部历史。`);stopped=true;break}
            if(platform==='x')await chrome.scripting.executeScript({target:{tabId},func:()=>window.scrollBy(0,Math.max(600,innerHeight*.8))});
            else{
                const moved=await chrome.scripting.executeScript({target:{tabId},func:p=>globalThis.ShicangAdapters.advance(p),args:[platform]});
                if(moved[0].result==='end'){stopped=true;status(`已读取当前可访问页面，共 ${items.size} 条。未发现可用的下一页，请核对页面数量后提交。`);break}
            }
            await new Promise(r=>setTimeout(r,2000));
        }
        if(!stopped){stopped=true;status(`已达到本次扫描上限，保留 ${items.size} 条部分结果。可继续扫描或检查新增。`)}
    }catch(e){stopped=true;status('扫描中断：'+e.message+'。已采集内容仍可导出。')}
    finally{running=false;$('#scan').disabled=false;$('#stop').disabled=true}
};
$('#stop').onclick=()=>{stopped=true;status(`已请求停止，保留 ${items.size} 条部分结果。`)};
$('#preview').onclick=async()=>{try{const r=await api('preview');status(`预览：新增 ${r.added}，已有 ${r.existing}，无效 ${r.failed}。确认后点击提交。`)}catch(e){status('无法连接收藏馆：'+e.message+'。请启动服务并检查密钥；也可先导出 JSON。')}};
$('#import').onclick=async()=>{if(running)return status('请先停止扫描，再预览和提交');try{const p=await api('preview');if(!confirm(`新增 ${p.added}，已有 ${p.existing}，无效 ${p.failed}。确认提交？`))return;const r=await api('import');status(`提交完成：新增 ${r.added}，更新 ${r.updated}，重复 ${r.unchanged}，失败 ${r.failed}。`)}catch(e){status('提交失败：'+e.message+'。数据仍在此面板，请重试或导出。')}};
$('#export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({items:[...items.values()],partial:true,exported_at:new Date().toISOString()},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='x-favorites.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
