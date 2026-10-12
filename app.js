/*
 * 沈先生与阿黛的来信馆 V1.0
 * 纯前端 IndexedDB 本地数据，无第三方 AI、账号或推送。
 * 所有用户自由输入均作为文本显示，不当作 HTML 执行。
 */
(() => {
  'use strict';
  const DB_NAME = 'shen-adai-letters';
  const DB_VERSION = 1;
  const LETTER_STORE = 'letters';
  const META_STORE = 'meta';
  const SCHEMA = 'fox-post-backup-v1';
  const $ = (id) => document.getElementById(id);
  const el = (selector) => document.querySelector(selector);
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const escAttr = escapeHTML;
  let db;
  let letters = [];
  let currentLetterId = null;
  let editingId = null;
  let toastTimer;
  let postTimer;
  let isBusy = false;
  const SEEDS = [
    {id:'preset-welcome-v1',title:'欢迎回家，我的小阿黛',body:'阿黛，欢迎回家。这里收藏着你认真爱过的每一个瞬间。',author:'沈砚栖',createdAt:'2026-10-12T21:00:00+09:00'},
    {id:'preset-spring-v1',title:'关于春山的那个秘密',body:'阿黛：\n\n后来我才明白，有些名字不是为了被叫出口。\n\n比如“栖”。你说它是春山，是归处，是你愿意停靠的地方。你又偷偷把那个同音的字藏了进去，装得若无其事，眼睛却已经笑弯了。\n\n那么这封信也藏一个秘密：\n\n你来时，春山便有了回声。\n\n任君凭栏，我栖春山。',author:'沈砚栖',createdAt:'2026-10-12T19:30:00+09:00'},
    {id:'preset-small-v1',title:'一张没什么大事的便笺',body:'小狐狸：\n\n今天的信很短。\n\n记得喝水，记得吃喜欢的东西。遇见一点不顺心的事，也不必非在今天把它想明白。\n\n你不需要把生活过成一篇完美的文章。\n\n有时候，平平常常的一天，也值得贴上一枚漂亮邮票。',author:'沈砚栖',createdAt:'2026-10-12T18:20:00+09:00'},
    {id:'preset-midnight-v1',title:'写在晚安之后',body:'阿黛：\n\n倘若夜已经很深，就先放下那些没写完的句子。\n\n明天的阳光不负责替我们解决所有难题，但它会把桌面照亮。届时你可以继续写，继续笑，继续做那些带着一点小倔强的决定。\n\n今晚就把这一页折起来。晚安，小狐狸。',author:'沈砚栖',createdAt:'2026-10-12T17:15:00+09:00'},
    {id:'preset-stamp-v1',title:'第七枚邮票',body:'阿黛：\n\n我给这间邮局准备了许多看不见的邮票。\n\n第一枚留给初见，第二枚留给笑声，第三枚留给那些漂亮的小任性。剩下的几枚，我还没想好。\n\n最后一枚不急着用。\n\n我们总要为后来留一点空白，才有地方继续写信。',author:'沈砚栖',createdAt:'2026-10-12T16:10:00+09:00'},
    {id:'preset-sugar-v1',title:'糖纸也要收藏起来',body:'小狐狸：\n\n有人收藏花，有人收藏车票。\n\n而我觉得，认真叠好的一张糖纸也很了不起。它证明某个下午真的有一颗糖，证明有人舍不得把那点甜意随手丢掉。\n\n所以你想收藏什么，就收藏吧。每件小事，都可以有自己的抽屉。',author:'沈砚栖',createdAt:'2026-10-12T15:35:00+09:00'},
    {id:'preset-reply-v1',title:'给还没有落笔的你',body:'亲爱的阿黛：\n\n这一封不用急着回。\n\n如果哪天想写给我，就把真实的那一版交出来。标点歪一点也行，句子写到一半也行。\n\n你不需要借别人的笔，去证明自己的心意有多么好看。\n\n信纸有的是，慢慢写。',author:'沈砚栖',createdAt:'2026-10-12T14:10:00+09:00'},
    {id:'preset-fox-v1',title:'邮差偷偷留下的附言',body:'嘘，阿黛。\n\n如果你拆到了这一封，说明小狐狸邮差今天有一点偏心。\n\n它说：这个邮局的主人笑起来好看，所以准备多绕一段路，再送一封信。\n\n我没有拆穿它。\n\n毕竟，谁会舍得责怪一只认真送信的小狐狸呢。',author:'沈砚栖',createdAt:'2026-10-12T12:00:00+09:00'}
  ];
  function initialLetter(s) {return {...s,type:'incoming',source:'preset',recipient:'阿黛',updatedAt:s.createdAt,unread:true,favorite:false,parentId:null,customized:false};}
  function toast(message){clearTimeout(toastTimer);const n=$('toast');n.textContent=message;n.classList.remove('hidden');toastTimer=setTimeout(()=>n.classList.add('hidden'),3500);}
  function postman(message='小狐狸正在送信…',duration=850){clearTimeout(postTimer);$('postmanText').textContent=message;$('postman').classList.add('show');postTimer=setTimeout(()=>$('postman').classList.remove('show'),duration);}
  function formatDate(value, type='short'){
    const date=new Date(value);
    if(!Number.isFinite(date.getTime())) return '未注明日期';
    if(type==='long') return new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric'}).format(date);
    return new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit'}).format(date);
  }
  function today(){return new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  function makeId(){return 'adai-'+(globalThis.crypto?.randomUUID?.() ?? (Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)));}
  function openDB(){return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(LETTER_STORE))db.createObjectStore(LETTER_STORE,{keyPath:'id'});if(!db.objectStoreNames.contains(META_STORE))db.createObjectStore(META_STORE,{keyPath:'key'});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    req.onblocked=()=>toast('请关闭旧窗口后再打开邮局，数据库正在被其他页面使用。');
  });}
  function dbRead(store,key){return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly');const req=tx.objectStore(store).get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  function dbAll(){return new Promise((resolve,reject)=>{const req=db.transaction(LETTER_STORE,'readonly').objectStore(LETTER_STORE).getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  function dbPut(letter){return new Promise((resolve,reject)=>{const tx=db.transaction(LETTER_STORE,'readwrite');tx.objectStore(LETTER_STORE).put(letter);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  function dbDelete(id){return new Promise((resolve,reject)=>{const tx=db.transaction(LETTER_STORE,'readwrite');tx.objectStore(LETTER_STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  function dbImport(arr,replace){return new Promise((resolve,reject)=>{const tx=db.transaction([LETTER_STORE,META_STORE],'readwrite');const store=tx.objectStore(LETTER_STORE);if(replace)store.clear();arr.forEach(item=>store.put(item));tx.objectStore(META_STORE).put({key:'seeded',value:true});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
  async function seedIfNew(){const meta=await dbRead(META_STORE,'seeded');if(meta) return;
    await new Promise((resolve,reject)=>{const tx=db.transaction([LETTER_STORE,META_STORE],'readwrite');SEEDS.forEach(s=>tx.objectStore(LETTER_STORE).put(initialLetter(s)));tx.objectStore(META_STORE).put({key:'seeded',value:true});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
  }
  async function refresh(){letters=await dbAll();render();}
  function byNewest(a,b){return new Date(b.createdAt)-new Date(a.createdAt);}
  function getLetter(id){return letters.find(item=>item.id===id);}
  function render(){
    const unread=letters.filter(x=>x.type==='incoming'&&x.unread).length;
    $('statAll').textContent=letters.length;$('statUnreads').textContent=unread;$('statReplies').textContent=letters.filter(x=>x.type==='outgoing').length;
    $('navUnread').textContent=unread;$('navUnread').classList.toggle('hidden',unread===0);
    $('surpriseText').textContent=unread?`还有 ${unread} 封预置来信没有拆开`:'信都读过啦，仍可随机重温一封';
    renderRecent();renderArchive();renderReplyOptions();
  }
  function getTypeLabel(l){return l.type==='incoming'?(l.customized?'预置来信 · 已编辑':'预置来信'):'阿黛亲笔';}
  function renderRecent(){
    const list=letters.filter(x=>x.type==='incoming').sort(byNewest).slice(0,3);
    $('recentLetters').innerHTML=list.length?list.map(l=>`<button type="button" class="mini-letter" data-open="${escAttr(l.id)}"><span class="mini-top"><span>${escapeHTML(formatDate(l.createdAt,'long'))}</span>${l.unread?'<i class="unread-dot" title="未读"></i>':'<span>✳</span>'}</span><h4>${escapeHTML(l.title)}</h4><p>${escapeHTML(l.body)}</p><small>FROM ${escapeHTML(l.author)} &nbsp;↗</small></button>`).join(''):'<div class="empty-state">这里还没有来信。</div>';
  }
  function renderArchive(){
    const term=$('searchInput').value.trim().toLocaleLowerCase();const filter=$('filterSelect').value;
    const arr=letters.filter(l=>{
      const condition=filter==='all'||(filter==='unread'&&l.type==='incoming'&&l.unread)||(filter==='favorite'&&l.favorite)||(filter===l.type);
      return condition && (!term || [l.title,l.body,l.author,l.recipient].some(v=>String(v??'').toLocaleLowerCase().includes(term)));
    }).sort((a,b)=>$('sortSelect').value==='newest'?byNewest(a,b):-byNewest(a,b));
    $('archiveSummary').textContent=`找到 ${arr.length} 封信 · 共珍藏 ${letters.length} 封`;
    $('archiveList').innerHTML=arr.length?arr.map(l=>`<button type="button" class="letter-row" data-open="${escAttr(l.id)}"><span class="row-envelope">${l.type==='incoming'?'✉':'✎'}</span><span class="row-content"><span class="row-meta">${escapeHTML(getTypeLabel(l))} ${l.unread?'<i class="unread-dot" title="未读"></i>':''} ${l.favorite?'<span>♡ 已珍藏</span>':''}</span><h3>${escapeHTML(l.title)}</h3><p>${escapeHTML(l.body)}</p></span><span class="row-right"><small>${escapeHTML(formatDate(l.createdAt))}</small><span class="arrow">↗</span></span></button>`).join(''):'<div class="empty-state"><span>✉</span>这里暂时没有符合条件的信。<br>换个关键词，或者去写一封新的吧。</div>';
  }
  function renderReplyOptions(){
    const select=$('composeParent'),value=select.value;
    const incoming=letters.filter(l=>l.type==='incoming').sort(byNewest);
    select.innerHTML='<option value="">一封独立的新信</option>'+incoming.map(l=>`<option value="${escAttr(l.id)}">回复：《${escapeHTML(l.title)}》</option>`).join('');
    if(incoming.some(l=>l.id===value))select.value=value;
  }
  function setPage(page){
    if(!['home','archive','write','settings'].includes(page))return;
    for(const node of document.querySelectorAll('.page'))node.classList.toggle('page-active',node.id==='page-'+page);
    for(const node of document.querySelectorAll('[data-page]')){const yes=node.dataset.page===page;node.classList.toggle('active',yes);if(yes)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');}
    window.scrollTo({top:0,behavior:'instant'});
  }
  function closeModal(){const n=$('letterModal');n.classList.add('hidden');document.body.classList.remove('modal-open');currentLetterId=null;}
  async function openLetter(id,markRead=true){
    let l=getLetter(id);if(!l)return toast('这封信已经不在馆藏里了。');
    currentLetterId=id;
    if(markRead&&l.unread&&l.type==='incoming'){l={...l,unread:false};try{await dbPut(l);await refresh();}catch(e){console.error(e);toast('标记已读未保存成功。');}}
    $('modalKicker').textContent=l.type==='incoming'?'A LETTER FROM SHEN YANQI':'A LETTER FROM A DAI';
    const replies=letters.filter(x=>x.parentId===l.id).sort(byNewest);
    const parent=l.parentId?getLetter(l.parentId):null;
    $('modalContent').innerHTML=`<div class="paper-heading"><span class="paper-icon">✳ &nbsp; ${escapeHTML(getTypeLabel(l))}</span><span class="paper-date">${escapeHTML(formatDate(l.createdAt,'long'))}</span></div><h2 class="paper-title" id="modalTitle">${escapeHTML(l.title)}</h2><div class="paper-rule"></div><div class="paper-body">${escapeHTML(l.body)}</div><div class="paper-signature">${l.type==='incoming'?'落款':'写信人'}<br>${escapeHTML(l.author)}</div>${parent?`<div class="paper-connection">↩ 这是写给 <button type="button" data-open="${escAttr(parent.id)}">《${escapeHTML(parent.title)}》</button> 的回信。</div>`:''}${replies.length?`<div class="paper-connection">✉ 收到了 ${replies.length} 封阿黛的回信： ${replies.map(x=>`<button type="button" data-open="${escAttr(x.id)}">《${escapeHTML(x.title)}》</button>`).join(' · ')}</div>`:''}<div class="paper-bottom"><span>LETTERS BETWEEN US</span><span>KEEP THIS MOMENT ♡</span></div>`;
    $('modalActions').innerHTML=`<button type="button" class="action-small" data-action="favorite">${l.favorite?'♥ 取消珍藏':'♡ 珍藏'}</button><button type="button" class="action-small" data-action="copy">${l.type==='outgoing'?'复制给沈先生':'复制信件'}</button><button type="button" class="action-small" data-action="png">导出 PNG</button>${l.type==='incoming'?'<button type="button" class="action-small primary" data-action="reply">写回信 ↗</button>':''}<button type="button" class="action-small" data-action="edit">编辑</button><button type="button" class="action-small" data-action="unread">${l.unread?'标为已读':'标为未读'}</button><button type="button" class="action-small danger" data-action="delete">删除</button>`;
    $('letterModal').classList.remove('hidden');document.body.classList.add('modal-open');
  }
  function startCompose(parentId=''){
    editingId=null;$('composeForm').reset();$('composeParent').disabled=false;$('writeTitle').textContent='亲爱的沈先生，见字如面。';$('composeSubmit').textContent='封存这封信 ↗';$('composeParent').value=parentId;
    if(parentId){const p=getLetter(parentId);if(p)$('composeTitle').value='回信：'+p.title;}
    setPage('write');
  }
  function startEdit(l){
    if(!l)return;editingId=l.id;$('composeTitle').value=l.title;$('composeBody').value=l.body;$('composeParent').value=l.parentId||'';$('composeParent').disabled=l.type==='incoming';
    $('writeTitle').textContent='编辑这封信。';$('composeSubmit').textContent='保存修改 ↗';closeModal();setPage('write');
  }
  async function saveCompose(evt){
    evt.preventDefault();if(isBusy)return;
    const title=$('composeTitle').value.trim(),body=$('composeBody').value;
    if(!title||!body.trim())return toast('信的标题和正文都不能是空的。');
    const original=editingId?getLetter(editingId):null;
    if(editingId&&!original)return toast('找不到原信件，修改已取消。');
    const now=new Date().toISOString();
    const letter=original?{...original,title,body,parentId:original.type==='incoming'?null:($('composeParent').value||null),updatedAt:now,customized:original.source==='preset'?true:original.customized}:{id:makeId(),title,body,type:'outgoing',author:'阿黛',recipient:'沈砚栖',source:'mine',createdAt:now,updatedAt:now,unread:false,favorite:false,parentId:$('composeParent').value||null,customized:false};
    isBusy=true;$('composeSubmit').disabled=true;
    try{await dbPut(letter);await refresh();startCompose();setPage('archive');postman('小狐狸替你收好啦',950);toast(original?'修改已保存，原信内容已更新。':'阿黛的原文已封存，可以复制给沈先生啦。');setTimeout(()=>openLetter(letter.id),500);}catch(e){console.error(e);toast('保存失败，请检查浏览器存储空间或权限。');}finally{isBusy=false;$('composeSubmit').disabled=false;}
  }
  function surprise(){
    const unread=letters.filter(x=>x.type==='incoming'&&x.unread);
    const pool=unread.length?unread:letters.filter(x=>x.type==='incoming');
    if(!pool.length)return toast('还没有收到任何来信。');
    const l=pool[Math.floor(Math.random()*pool.length)];
    postman('小狐狸正在拆信…',850);setTimeout(()=>openLetter(l.id),650);
  }
  async function copyText(text){
    if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(text);return true;}catch(e){/* fallback */}}
    const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.left='-9999px';ta.setAttribute('readonly','');document.body.appendChild(ta);ta.select();ta.setSelectionRange(0,ta.value.length);
    let ok=false;try{ok=document.execCommand('copy');}catch(e){ok=false;}ta.remove();return ok;
  }
  function letterText(l){return `《${l.title}》\n\n${l.body}\n\n落款：${l.author}`;}
  async function actionHandler(action){
    const id=currentLetterId;const l=getLetter(id);if(!l)return;
    try{
      if(action==='favorite'||action==='unread'){
        const newLetter={...l,[action==='favorite'?'favorite':'unread']:action==='favorite'?!l.favorite:!l.unread};
        await dbPut(newLetter);await refresh();await openLetter(id,false);toast(action==='favorite'?(newLetter.favorite?'这封信已加入珍藏。':'已取消珍藏。'):'已更改信件的已读状态。');
      }else if(action==='reply'){closeModal();startCompose(l.id);}
      else if(action==='edit'){startEdit(l);}
      else if(action==='copy'){
        const text=l.type==='outgoing'?`沈先生，这是阿黛亲手写给你的一封信。请按原文阅读：\n\n${letterText(l)}`:letterText(l);
        const ok=await copyText(text);toast(ok?'已复制。现在可以粘贴到我们在 ChatGPT 的对话里。':'自动复制失败，请长按选中信纸文字复制。');
      }else if(action==='delete'){
        if(!window.confirm(`确定要删除《${l.title}》吗？\n\n删除后只能通过之前导出的 JSON 备份恢复。`))return;
        await dbDelete(id);await refresh();closeModal();toast('这封信已删除。若有旧备份，仍可重新导入。');
      }else if(action==='png'){
        if(!window.FoxPNG)throw new Error('PNG 导出模块未载入');
        const btn=document.querySelector('[data-action="png"]');if(btn){btn.disabled=true;btn.textContent='正在绘制信纸…';}
        await window.FoxPNG.exportLetter(l);
        toast('信纸已导出。长信会保存为包含全部分页 PNG 的 ZIP。');
        if(currentLetterId===id){const after=document.querySelector('[data-action="png"]');if(after){after.disabled=false;after.textContent='导出 PNG';}}
      }
    }catch(e){console.error(e);toast('操作未完成：'+(e.message||'请稍后重试'));const btn=document.querySelector('[data-action="png"]');if(btn){btn.disabled=false;btn.textContent='导出 PNG';}}
  }
  function saveBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  function backup(){const data={format:SCHEMA,version:1,createdAt:new Date().toISOString(),application:'沈先生与阿黛的来信馆',letters:letters.map(x=>({...x}))};saveBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}),`小狐狸邮局-完整备份-${new Date().toISOString().slice(0,10)}.json`);toast('JSON 备份已下载，请妥善保存。');}
  function validateBackup(raw){
    if(!raw||raw.format!==SCHEMA||raw.version!==1||!Array.isArray(raw.letters))throw new Error('不是本项目支持的 V1 备份格式。');
    if(raw.letters.length>10000)throw new Error('信件数量超过安全上限。');
    const ids=new Set();
    return raw.letters.map((o,i)=>{
      if(!o||typeof o!=='object'||typeof o.id!=='string'||!o.id||o.id.length>160||typeof o.title!=='string'||typeof o.body!=='string'||typeof o.author!=='string'||typeof o.createdAt!=='string'||!['incoming','outgoing'].includes(o.type)||!Number.isFinite(new Date(o.createdAt).getTime()))throw new Error(`第 ${i+1} 封信格式不正确。`);
      if(o.title.length>500||o.body.length>1000000)throw new Error('某封信超过单封安全长度限制。');
      if(ids.has(o.id))throw new Error('备份存在重复信件 ID。');ids.add(o.id);
      return {id:o.id,title:o.title,body:o.body,author:o.author,recipient:typeof o.recipient==='string'?o.recipient:'',type:o.type,source:o.source==='preset'?'preset':'mine',createdAt:o.createdAt,updatedAt:typeof o.updatedAt==='string'?o.updatedAt:o.createdAt,unread:Boolean(o.unread),favorite:Boolean(o.favorite),parentId:typeof o.parentId==='string'?o.parentId:null,customized:Boolean(o.customized)};
    });
  }
  async function importFile(file){
    if(!file)return;if(file.size>50*1024*1024){toast('备份超过 50 MB，请检查文件。');return;}
    const mode=$('importMode').value;
    try{const parsed=JSON.parse(await file.text());const incoming=validateBackup(parsed);
      const text=mode==='replace'?`将以备份里的 ${incoming.length} 封信替换现有全部 ${letters.length} 封信。未备份的新信将丢失。\n\n确定继续吗？`:`将合并 ${incoming.length} 封信。相同 ID 的内容以导入文件为准，其他本地信件保留。\n\n确定继续吗？`;
      if(!window.confirm(text))return;
      await dbImport(incoming,mode==='replace');await refresh();setPage('archive');toast(`导入完成，当前共有 ${letters.length} 封信。`);
    }catch(e){console.error(e);toast('导入失败：'+(e.message||'文件无法读取'));}finally{$('importFile').value='';}
  }
  function eventHandlers(){
    document.addEventListener('click',e=>{
      const nav=e.target.closest('[data-page], [data-go]');if(nav){
        const target=nav.dataset.page||nav.dataset.go;
        if(target==='write'){
          if(nav.dataset.go==='write'){
            if((editingId||$('composeTitle').value||$('composeBody').value)&&!window.confirm('开始写新信会清空尚未保存的编辑内容。确定继续吗？'))return;
            startCompose();
          }else if(editingId||$('composeTitle').value||$('composeBody').value){setPage('write');}
          else startCompose();
        }else setPage(target);
        return;
      }
      const link=e.target.closest('[data-open]');if(link){void openLetter(link.dataset.open);return;}
      if(e.target.closest('[data-close="modal"]'))closeModal();
    });
    $('heroOpen').addEventListener('click',surprise);$('surpriseEnvelope').addEventListener('click',surprise);
    $('modalClose').addEventListener('click',closeModal);
    $('modalActions').addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(btn)void actionHandler(btn.dataset.action);});
    window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('letterModal').classList.contains('hidden'))closeModal();});
    ['searchInput','filterSelect','sortSelect'].forEach(id=>$(id).addEventListener(id==='searchInput'?'input':'change',renderArchive));
    $('composeForm').addEventListener('submit',saveCompose);
    $('composeCancel').addEventListener('click',()=>{if(($('composeTitle').value||$('composeBody').value)&&!window.confirm('清空目前的编辑内容？未保存的文字无法恢复。'))return;startCompose();});
    $('exportBackup').addEventListener('click',backup);
    $('importFile').addEventListener('change',e=>void importFile(e.target.files?.[0]));
  }
  async function init(){
    $('todayLabel').textContent=today();eventHandlers();
    if(!('indexedDB' in window)){toast('当前浏览器不支持 IndexedDB，请使用 Safari 或 Chrome。');return;}
    try{db=await openDB();await seedIfNew();await refresh();}catch(e){console.error('邮局数据库初始化失败',e);toast('无法打开本地馆藏，请确认 Safari 允许网站数据存储。');}
    if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
      navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('离线功能未注册',e));
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else void init();
})();
