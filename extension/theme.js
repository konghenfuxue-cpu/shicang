// Theme preference is independent of connection credentials and scan state.
(() => {
    const saved=localStorage.getItem('collector-theme');
    const theme=saved==='dark'?'dark':'light';
    document.documentElement.dataset.theme=theme;
    const label=document.createElement('label');
    label.className='theme-control';
    label.textContent='页面外观';
    const select=document.createElement('select');
    select.setAttribute('aria-label','采集页面外观');
    select.append(new Option('浅色 · 暖纸','light'),new Option('暗色 · 夜间','dark'));
    select.value=theme;
    select.addEventListener('change',()=>{
        document.documentElement.dataset.theme=select.value;
        localStorage.setItem('collector-theme',select.value);
    });
    label.append(select);
    document.querySelector('main').prepend(label);
})();
