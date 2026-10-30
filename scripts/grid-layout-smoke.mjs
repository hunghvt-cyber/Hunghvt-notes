// Real Chromium layout check for note-card rows; uses synthetic in-memory Notes only.
import {chromium,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {backend} from '../test/helpers/collection.mjs';
import {createAppHandler,productionProject} from '../lib/app-config.mjs';
import {provisionStore} from '../lib/production-store.mjs';

const origin='https://notes.test',password='synthetic-test-only';
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{})});
const b=backend(),user='synthetic',appPassword='synthetic',namespace='Hunghvt-Notes-Data-'+randomUUID(),store=b.makeStore({user,password:appPassword,namespace});
try{
 await provisionStore(store);
 const longTitle='Kế hoạch phát hành với tiêu đề dài để kiểm tra đủ chiều cao hàng trên điện thoại';
 const longText=('Preview nhiều dòng để xác nhận grid row theo chiều cao nội dung và không che metadata cuối thẻ. ').repeat(4);
 const longFolder='Công việc với tên thư mục tổng hợp rất dài cho nhóm sản phẩm';
 for(let i=0;i<10;i++)await store.save(randomUUID(),{title:i%2?`Ghi chú ${i}`:`${longTitle} ${i}`,text:i%3?`Đoạn ngắn ${i}`:longText,checklist:[],folder:i%2?'Danh sách':longFolder},null,randomUUID());
 const env={NOTES_MODE:'live-v1',NOTES_PROJECT_ID:productionProject,VERCEL_PROJECT_ID:productionProject,VERCEL_ENV:'production',NOTES_BASE_URL:origin,NOTES_DATA_NAMESPACE:namespace,NOTES_SESSION_PASSWORD:randomUUID()+randomUUID(),NOTES_PASSWORD:password,KOOFR_NOTES_USER:user,KOOFR_NOTES_APP_PASSWORD:appPassword};
 const handler=createAppHandler({env:()=>env,makeStore:b.makeStore,observe:()=>{}}),context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route(origin+'/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname==='/api/app'){
   const data=req.postData(),response=await handler(new Request(req.url(),{method:req.method(),headers:await req.allHeaders(),...(data?{body:data}:{})}));
   return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  }
  const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
  if(!['index.html','app.css','app.js','sync.js','cache.js','sort.js'].includes(name))return route.fulfill({status:404,body:''});
  const file=new URL('../public/'+name,import.meta.url),body=await readFile(file);
  return route.fulfill({status:200,contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html',body});
 });
 const page=await context.newPage();page.on('pageerror',error=>{throw error;});
 await page.goto(origin+'/');await expect(page.locator('#login')).toBeVisible();await page.locator('#password').fill(password);await page.locator('#login-form button').click();await expect(page.locator('#workspace')).toBeVisible();await expect(page.locator('.card')).toHaveCount(10);
 const screenshotDir=new URL('../docs/UI-HEADER-CLEANUP-20261030/after/',import.meta.url);
 for(const width of [360,390]){
  await page.setViewportSize({width,height:844});
  const geometry=await page.locator('#note-list').evaluate(root=>{
   const gridStyle=getComputedStyle(root),gap=parseFloat(gridStyle.rowGap),cards=[...root.querySelectorAll('.card')],rows=[];
   for(const card of cards){const rect=card.getBoundingClientRect(),row=rows.find(item=>Math.abs(item.top-rect.top)<0.75);if(row){row.bottom=Math.max(row.bottom,rect.bottom);row.cards.push({bottom:rect.bottom,folderBottom:card.querySelector('small').getBoundingClientRect().bottom,cardBottom:rect.bottom,scrollHeight:card.scrollHeight,clientHeight:card.clientHeight});}else rows.push({top:rect.top,bottom:rect.bottom,cards:[{bottom:rect.bottom,folderBottom:card.querySelector('small').getBoundingClientRect().bottom,cardBottom:rect.bottom,scrollHeight:card.scrollHeight,clientHeight:card.clientHeight}]});}
   return {gridAutoRows:gridStyle.gridAutoRows,gridTemplateRows:gridStyle.gridTemplateRows,gap,rows};
  });
  expect(geometry.gridAutoRows).toBe('max-content');
  for(let i=0;i<geometry.rows.length;i++){
   const row=geometry.rows[i],next=geometry.rows[i+1];
   for(const card of row.cards){expect(card.folderBottom).toBeLessThanOrEqual(card.cardBottom+0.75);expect(card.scrollHeight).toBeLessThanOrEqual(card.clientHeight+2);if(next)expect(card.bottom+geometry.gap).toBeLessThanOrEqual(next.top+0.75);}
   if(next)expect(row.bottom+geometry.gap).toBeLessThanOrEqual(next.top+0.75);
  }
  const suffix=String(width);
  await page.screenshot({path:new URL(`list-phone-${suffix}.png`,screenshotDir).pathname});
  if(width===390)await page.screenshot({path:new URL('list-phone-390.png',screenshotDir).pathname});
  await page.locator('#sort-toggle').click();await expect(page.locator('input[name="sort-mode"]')).toHaveCount(4);
  await page.screenshot({path:new URL(`sort-open-phone-${suffix}.png`,screenshotDir).pathname});
  if(width===390)await page.screenshot({path:new URL('sort-open-phone-390.png',screenshotDir).pathname});
  await page.keyboard.press('Escape');await expect(page.locator('#sort-toggle')).toBeFocused();
  console.log(JSON.stringify({width,gridAutoRows:geometry.gridAutoRows,gridTemplateRows:geometry.gridTemplateRows,gap:geometry.gap,rows:geometry.rows.length,noOverlap:true,folderMetadataVisible:true}));
 }
 await context.close();
}finally{store.agent.destroy();await browser.close();}
