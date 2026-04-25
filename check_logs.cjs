const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER_ERROR_LOG:', msg.text());
    } else {
      console.log('BROWSER_LOG:', msg.text());
    }
  });
  page.on('pageerror', error => console.log('BROWSER_PAGE_ERROR:', error.message));
  
  await page.goto('http://localhost:5174/');
  console.log('Navigated to localhost');
  await page.waitForTimeout(1000);
  
  // Find and click the Performance Charts sidebar item
  await page.click('text="Performance Charts"');
  console.log('Clicked Performance Charts');
  
  await page.waitForTimeout(3000);
  await browser.close();
})();
