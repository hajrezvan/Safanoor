import { test, expect } from '@playwright/test';

test('page reading, finish confirmation, fallback and aligned downloads', async ({ page, context }) => {
  const group='20000000-0000-4000-8000-000000000003', path='70000000-0000-4000-8000-000000000001';
  const items=[{id:'70000000-0000-4000-8000-000000000002',bookTitle:'کتاب آزمون',bookAuthor:'نویسندهٔ نمونه',totalPages:100,currentPage:0,readingStatus:'not_started',pdfUrl:'/sample.pdf',readingHistory:[]}, {id:'70000000-0000-4000-8000-000000000003',bookTitle:'کتاب دوم با نام بلندتر برای بررسی هم‌ترازی',totalPages:200,currentPage:0,readingStatus:'not_started',readingHistory:[]}];
  const detail=()=>({id:path,title:'سیر آزمایشی',groupId:group,items,canManage:false,canTrackReading:true,readingProgress:{started:items.some(i=>i.readingStatus!=='not_started'),completedCount:items.filter(i=>i.readingStatus==='completed').length,totalCount:2,percent:items.filter(i=>i.readingStatus==='completed').length*50}});
  const writes: Record<string,unknown>[]=[];
  await page.route('**/api/v1/**', async route=>{
    const url=new URL(route.request().url());
    let data:unknown={items:[],page:1,limit:50,total:0};
    if(url.pathname.endsWith('/people/me'))data={person:{id:'10000000-0000-4000-8000-000000000011',firstName:'رضا',lastName:'نمونه',orgLevel:'member',groupId:group},activeRole:{kind:'member'},capabilities:{},children:[],consentRequired:false};
    else if(url.pathname.endsWith('/auth/csrf'))data={csrfToken:'visual-test-csrf'};
    else if(url.pathname.endsWith('/groups'))data={items:[{id:group,canManage:false}]};
    else if(url.pathname.endsWith('/reading')){const body=route.request().postDataJSON();writes.push(body);items[0].readingStatus=body.status;items[0].currentPage=body.currentPage;data=detail();}
    else if(url.pathname===`/api/v1/study-paths/${path}`)data=detail();
    else if(url.pathname.endsWith('/study-paths'))data={items:[{id:path,title:'سیر آزمایشی',itemCount:2}],total:1};
    await route.fulfill({json:data});
  });
  const open=async()=>{await page.goto('/library');await page.getByRole('button',{name:'مشاهده',exact:true}).click();await expect(page.getByText('کتاب آزمون',{exact:true})).toBeVisible();};
  await page.addInitScript(() => { window.open = ((url: string | URL | undefined) => { (window as unknown as { openedBook: string }).openedBook=String(url); return null; }) as typeof window.open; });
  await open();
  await page.getByRole('button',{name:'دانلود کتاب',exact:true}).first().click();
  expect(await page.evaluate(()=>(window as unknown as { openedBook:string }).openedBook)).toBe('/sample.pdf');
  await page.getByRole('button',{name:'شروع کردم',exact:true}).first().click();
  await expect(page.getByRole('slider')).toHaveAttribute('aria-valuemax','100');
  const input=page.getByRole('textbox',{name:'تا صفحهٔ',exact:true});
  await input.fill('60');await page.getByRole('button',{name:'ثبت پیشرفت',exact:true}).click();
  await expect.poll(()=>writes.at(-1)?.currentPage).toBe(60);
  await input.fill('100');await page.getByRole('button',{name:'ثبت پیشرفت',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(writes.at(-1)?.currentPage).toBe(60);
  await page.getByRole('button',{name:'نه، ادامه می‌دهم',exact:true}).click();
  await expect.poll(()=>writes.at(-1)?.currentPage).toBe(99);
  await input.fill('100');await page.getByRole('button',{name:'ثبت پیشرفت',exact:true}).click();
  await page.getByRole('button',{name:'بله، تمام کردم',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText('کتاب را تمام کردم',{exact:true})).toBeVisible();
  expect(writes.at(-1)).toMatchObject({status:'completed',currentPage:100,confirmCompleted:true});
  for(const mode of ['light','dark']) {await context.addCookies([{name:'sf_theme',value:mode,domain:'localhost',path:'/'}]);for(const width of [390,1440]){await page.setViewportSize({width,height:978});await open();await page.evaluate(()=>document.fonts.ready);if(width===1440){const buttons=page.getByRole('button',{name:'دانلود کتاب',exact:true});const a=await buttons.nth(0).boundingBox(),b=await buttons.nth(1).boundingBox();expect(Math.abs(a!.y-b!.y)).toBeLessThan(2);}await page.screenshot({path:`docs/screens/reading-pages-${width}-${mode}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}}
});
