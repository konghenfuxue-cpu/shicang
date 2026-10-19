// DOM-only platform adapters. This file may be injected repeatedly after navigation.
(() => {
    function douyin(){
        if(!['www.douyin.com','douyin.com'].includes(location.hostname)||!/^\/user\//.test(location.pathname))throw Error('请打开抖音“我的”页面并选择收藏或喜欢');
        const tabs=[...document.querySelectorAll('[role="tab"][aria-selected="true"]')];
        const selected=tabs.find(e=>/^(收藏|喜欢)/.test(e.textContent.trim()));
        if(!selected)throw Error('请先在抖音个人页选中“收藏”或“喜欢”，不要在作品或推荐页扫描');
        const type=selected.textContent.trim().startsWith('喜欢')?'like':'favorite';
        const seen=new Set();
        return [...document.querySelectorAll('a[href*="/video/"],a[href*="/note/"]')].flatMap(a=>{
            if(!a.getClientRects().length||a.closest('header,nav,aside'))return [];
            const u=new URL(a.getAttribute('href'),location.href),m=u.pathname.match(/^\/(video|note)\/(\d+)\/?$/);
            if(!['www.douyin.com','douyin.com'].includes(u.hostname)||!m||seen.has(m[2]))return [];
            seen.add(m[2]);const image=a.querySelector('img');
            const title=(a.querySelector('p')?.innerText||image?.alt||a.innerText||'').trim();
            return [{platform:'douyin',source_id:m[2],url:`https://www.douyin.com/${m[1]}/${m[2]}`,source_types:[type],title:title.slice(0,500),excerpt:title.slice(0,10000),author_name:'',author_handle:'',thumbnail_url:image?.currentSrc||image?.src||'',source_collection:'未分类'}];
        });
    }
    function zhihu(){
        if(!['www.zhihu.com','zhihu.com'].includes(location.hostname)||!/^\/collection\/\d+\/?$/.test(location.pathname))throw Error('请打开一个知乎收藏夹的内容页，不能在收藏夹列表页扫描');
        const collection=document.querySelector('.CollectionDetailPageHeader-title')?.textContent.trim()||document.querySelector('h1')?.textContent.trim()||'未分类';
        const main=document.querySelector('main')||document;const seen=new Set();
        return [...main.querySelectorAll('.ContentItem')].flatMap(card=>{
            const urls=[...card.querySelectorAll('a[href]')].map(a=>a.href).concat([...card.querySelectorAll('meta[itemprop="url"]')].map(e=>e.content));
            const url=urls.find(link=>{try{const u=new URL(link,location.href);return ['www.zhihu.com','zhihu.com'].includes(u.hostname)?/^\/(question\/\d+\/answer\/\d+|pin\/\d+|zvideo\/\d+)\/?$/.test(u.pathname):u.hostname==='zhuanlan.zhihu.com'&&/^\/p\/\d+\/?$/.test(u.pathname)}catch{return false}});
            if(!url)return [];const u=new URL(url,location.href),match=u.pathname.match(/(?:answer|pin|zvideo|p)\/(\d+)/);const kind=u.hostname==='zhuanlan.zhihu.com'?'article':u.pathname.includes('/answer/')?'answer':u.pathname.includes('/pin/')?'pin':'video';
            const id=kind+':'+match[1];if(seen.has(id))return [];seen.add(id);
            const author=card.querySelector('.AuthorInfo-name');const image=card.querySelector('.RichContent-cover img,.RichText img');
            return [{platform:'zhihu',source_id:id,url:u.href,source_types:['favorite'],title:card.querySelector('.ContentItem-title')?.textContent.trim()||'',excerpt:(card.querySelector('.RichContent-inner,.RichText')?.innerText||'').slice(0,10000),author_name:author?.textContent.trim()||'',author_handle:'',thumbnail_url:image?.currentSrc||image?.src||'',source_collection:collection}];
        });
    }
    function advance(platform){
        if(platform==='zhihu'){
            const next=document.querySelector('button.PaginationButton-next,a.PaginationButton-next');
            if(next&&!next.disabled&&next.getAttribute('aria-disabled')!=='true'){next.click();return 'next-page'}
            return 'end';
        }
        const candidates=[...document.querySelectorAll('main,section,div')].filter(e=>e.clientHeight>200&&e.scrollHeight>e.clientHeight+100&&['auto','scroll'].includes(getComputedStyle(e).overflowY));
        const container=candidates.filter(e=>e.querySelector('a[href*="/video/"],a[href*="/note/"]')).sort((a,b)=>a.clientHeight-b.clientHeight)[0];
        if(container)container.scrollBy(0,Math.max(600,container.clientHeight*.8));else window.scrollBy(0,Math.max(600,innerHeight*.8));
        return 'scroll';
    }
    const api={collect:platform=>platform==='douyin'?douyin():platform==='zhihu'?zhihu():(()=>{throw Error('不支持的平台')})(),advance};
    globalThis.ShicangAdapters=api;
    if(typeof module!=='undefined')module.exports=api;
})();
