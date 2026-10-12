/* 完整信纸 PNG 导出：短信单张 PNG；长信逐页 PNG 自动装进 ZIP，不裁掉尾段。无外部依赖。 */
(() => {
  'use strict';
  const WIDTH=900,HEIGHT=1420,SCALE=1.6,LEFT=92,RIGHT=808,BODY_MAX=1170;
  const BODY_FONT="26px 'Noto Serif SC','Songti SC',STSong,serif";
  const TITLE_FONT="bold 43px 'Noto Serif SC','Songti SC',STSong,serif";
  const enc=new TextEncoder();
  const cleanName=s=>String(s||'一封来信').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,55);
  function download(blob,name){const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);}
  function canvas(){const c=document.createElement('canvas');c.width=Math.round(WIDTH*SCALE);c.height=Math.round(HEIGHT*SCALE);const ctx=c.getContext('2d',{alpha:false});if(!ctx)throw new Error('浏览器无法创建信纸画布。');ctx.scale(SCALE,SCALE);return {c,ctx};}
  function tokens(text){if(typeof Intl.Segmenter==='function')return [...new Intl.Segmenter('zh',{granularity:'grapheme'}).segment(text)].map(x=>x.segment);return Array.from(text);}
  function wrap(ctx,text,maxWidth,font){ctx.font=font;if(text==='')return [''];const out=[];let line='';for(const token of tokens(text)){
    if(line && ctx.measureText(line+token).width>maxWidth){out.push(line);line=token;}else line+=token;
  }if(line)out.push(line);return out;}
  function fitLines(ctx,text,width,font){return String(text||'').replace(/\r\n?/g,'\n').split('\n').flatMap(line=>wrap(ctx,line,width,font));}
  function createLayout(l){const {c,ctx}=canvas();const titleLines=fitLines(ctx,l.title,RIGHT-LEFT,TITLE_FONT);
    const bodyLines=fitLines(ctx,l.body,RIGHT-LEFT,BODY_FONT);
    const items=[];titleLines.forEach((line,i)=>items.push({type:'title',text:line,height:62,first:i===0}));items.push({type:'separator',height:53});
    bodyLines.forEach(line=>items.push({type:'body',text:line,height:49}));
    items.push({type:'gap',height:42});items.push({type:'signature',text:'落款：'+l.author,height:54});
    const pages=[];let page=[],y=235;for(const item of items){if(y+item.height>BODY_MAX && page.length){pages.push(page);page=[];y=210;}page.push({...item,y});y+=item.height;}
    if(page.length||!pages.length)pages.push(page);c.width=0;c.height=0;return pages;
  }
  function background(ctx,page,total,l){
    const grad=ctx.createLinearGradient(0,0,WIDTH,HEIGHT);grad.addColorStop(0,'#fffaf8');grad.addColorStop(.54,'#fdf9fb');grad.addColorStop(1,'#eef4f6');ctx.fillStyle=grad;ctx.fillRect(0,0,WIDTH,HEIGHT);
    const glow=ctx.createRadialGradient(780,130,10,740,180,470);glow.addColorStop(0,'rgba(235,207,220,0.5)');glow.addColorStop(1,'rgba(235,207,220,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.strokeStyle='rgba(190,154,173,.35)';ctx.lineWidth=1.5;ctx.strokeRect(38,38,WIDTH-76,HEIGHT-76);ctx.strokeStyle='rgba(190,154,173,.14)';ctx.strokeRect(51,51,WIDTH-102,HEIGHT-102);
    ctx.font='17px Georgia,serif';ctx.fillStyle='#b18d9f';ctx.textBaseline='alphabetic';ctx.textAlign='left';ctx.fillText('L E T T E R S   B E T W E E N   U S',LEFT,111);
    ctx.font='19px Georgia,serif';ctx.fillStyle='#c2a2b4';ctx.textAlign='right';ctx.fillText('✳',RIGHT,114);ctx.textAlign='left';
    ctx.strokeStyle='rgba(192,162,177,.45)';ctx.beginPath();ctx.moveTo(LEFT,139);ctx.lineTo(RIGHT,139);ctx.stroke();
    ctx.fillStyle='#b89dad';ctx.font='17px Georgia,serif';ctx.fillText(l.type==='incoming'?'FROM · SHEN YANQI':'FROM · A DAI',LEFT,188);
    ctx.textAlign='right';ctx.fillText(`${page+1} / ${total}`,RIGHT,188);ctx.textAlign='left';
    ctx.beginPath();ctx.moveTo(LEFT,1268);ctx.lineTo(RIGHT,1268);ctx.stroke();
    ctx.font='17px Georgia,serif';ctx.fillStyle='#b59cac';ctx.fillText('任君凭栏，我栖春山。',LEFT,1310);
    ctx.textAlign='right';ctx.fillText('FOX POST  ·  A PRIVATE LETTER',RIGHT,1310);ctx.textAlign='left';
    ctx.fillStyle='#d9bfcc';ctx.font='38px Georgia,serif';ctx.textAlign='center';ctx.fillText('✳',WIDTH/2,1370);ctx.textAlign='left';
  }
  function drawPage(l,items,page,total){const {c,ctx}=canvas();background(ctx,page,total,l);for(const item of items){
      if(item.type==='title'){ctx.font=TITLE_FONT;ctx.fillStyle='#625568';ctx.fillText(item.text,LEFT,item.y+45);}
      if(item.type==='separator'){ctx.fillStyle='#caa3b6';ctx.fillRect(LEFT,item.y+15,65,2);}
      if(item.type==='body'){ctx.font=BODY_FONT;ctx.fillStyle='#625b68';ctx.fillText(item.text,LEFT,item.y+33);}
      if(item.type==='signature'){ctx.textAlign='right';ctx.font="26px 'Noto Serif SC','Songti SC',STSong,serif";ctx.fillStyle='#a17e94';ctx.fillText(item.text,RIGHT,item.y+35);ctx.textAlign='left';}
    }return new Promise((resolve,reject)=>{c.toBlob(blob=>{c.width=0;c.height=0;blob?resolve(blob):reject(new Error('浏览器无法导出 PNG。'))},'image/png');});}
  const CRC_TABLE=(()=>{const table=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xEDB88320^(c>>>1):c>>>1;table[i]=c>>>0;}return table;})();
  function crc32(bytes){let c=0xFFFFFFFF;for(const b of bytes)c=CRC_TABLE[(c^b)&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
  function le16(view,pos,val){view.setUint16(pos,val,true);}function le32(view,pos,val){view.setUint32(pos,val>>>0,true);}
  function dosDate(){const d=new Date();return {time:(d.getHours()<<11)|(d.getMinutes()<<5)|(Math.floor(d.getSeconds()/2)),date:((Math.max(d.getFullYear(),1980)-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate()};}
  async function zipStored(entries){const parts=[],directory=[];let offset=0;const dt=dosDate();for(const entry of entries){
      const bytes=new Uint8Array(await entry.blob.arrayBuffer());const filename=enc.encode(entry.name),len=bytes.length,crc=crc32(bytes);
      const local=new Uint8Array(30);let v=new DataView(local.buffer);le32(v,0,0x04034b50);le16(v,4,20);le16(v,6,0x0800);le16(v,8,0);le16(v,10,dt.time);le16(v,12,dt.date);le32(v,14,crc);le32(v,18,len);le32(v,22,len);le16(v,26,filename.length);le16(v,28,0);parts.push(local,filename,entry.blob);
      const central=new Uint8Array(46);v=new DataView(central.buffer);le32(v,0,0x02014b50);le16(v,4,20);le16(v,6,20);le16(v,8,0x0800);le16(v,10,0);le16(v,12,dt.time);le16(v,14,dt.date);le32(v,16,crc);le32(v,20,len);le32(v,24,len);le16(v,28,filename.length);le16(v,30,0);le16(v,32,0);le16(v,34,0);le16(v,36,0);le32(v,38,0);le32(v,42,offset);directory.push(central,filename);offset+=30+filename.length+len;
    }
    const directoryBytes=directory.reduce((total,v)=>total+v.byteLength,0);const end=new Uint8Array(22);const v=new DataView(end.buffer);le32(v,0,0x06054b50);le16(v,4,0);le16(v,6,0);le16(v,8,entries.length);le16(v,10,entries.length);le32(v,12,directoryBytes);le32(v,16,offset);le16(v,20,0);return new Blob([...parts,...directory,end],{type:'application/zip'});
  }
  async function exportLetter(l){
    // 本字体已预先在页面使用，离线时优先采用系统宋体兜底。
    if(document.fonts?.ready)await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,1500))]);
    const pages=createLayout(l);const title=cleanName(l.title);if(pages.length>60000)throw new Error('分页数量超过 ZIP 格式上限。');
    if(pages.length===1){download(await drawPage(l,pages[0],0,1),`${title}.png`);return {pages:1};}
    const entries=[];for(let i=0;i<pages.length;i++){
      const blob=await drawPage(l,pages[i],i,pages.length);entries.push({name:`${title}-第${String(i+1).padStart(3,'0')}页.png`,blob});
    }
    const zip=await zipStored(entries);download(zip,`${title}-完整信纸-${pages.length}页.zip`);return {pages:pages.length};
  }
  window.FoxPNG={exportLetter};
})();
