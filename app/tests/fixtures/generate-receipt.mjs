/**
 * Generates a test receipt image (PNG) for agentic vision user flow testing.
 * Run: node tests/fixtures/generate-receipt.mjs
 * Output: tests/fixtures/test-receipt.png
 */
import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const receiptHTML = `<!DOCTYPE html>
<html>
<head>
<style>
  body {
    margin: 0; padding: 24px; font-family: 'Courier New', monospace;
    background: #fefcf3; width: 320px; font-size: 14px; color: #222;
  }
  .header { text-align: center; border-bottom: 2px dashed #888; padding-bottom: 12px; margin-bottom: 12px; }
  .header h1 { font-size: 20px; margin: 0 0 4px; }
  .header p { margin: 2px 0; font-size: 12px; color: #555; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  td { padding: 3px 0; }
  td:last-child { text-align: right; }
  .sep { border-top: 1px dashed #888; }
  .total { font-weight: bold; font-size: 16px; }
  .footer { text-align: center; margin-top: 16px; font-size: 11px; color: #888; }
</style>
</head>
<body>
  <div class="header">
    <h1>SUNNY CAFE</h1>
    <p>123 Market Street, San Francisco, CA 94105</p>
    <p>Tel: (415) 555-0198</p>
    <p>Date: 02/08/2026 &nbsp; Time: 12:34 PM</p>
    <p>Server: Maria &nbsp; Table: 7</p>
  </div>
  <table>
    <tr><td>2x Cappuccino</td><td>$11.00</td></tr>
    <tr><td>1x Avocado Toast</td><td>$14.50</td></tr>
    <tr><td>1x Greek Salad</td><td>$12.75</td></tr>
    <tr><td>1x Blueberry Muffin</td><td>$4.25</td></tr>
    <tr><td>1x Fresh OJ</td><td>$6.50</td></tr>
  </table>
  <table>
    <tr class="sep"><td>Subtotal</td><td>$49.00</td></tr>
    <tr><td>Tax (8.625%)</td><td>$4.23</td></tr>
    <tr><td>Tip (20%)</td><td>$9.80</td></tr>
    <tr class="sep total"><td>TOTAL</td><td>$63.03</td></tr>
  </table>
  <table>
    <tr class="sep"><td>Payment: Visa ****4821</td><td></td></tr>
    <tr><td>Auth: 829471</td><td></td></tr>
  </table>
  <div class="footer">
    <p>Thank you for dining with us!</p>
    <p>Receipt #: SC-20260208-0742</p>
  </div>
</body>
</html>`

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 368, height: 600 } })
  await page.setContent(receiptHTML)
  await page.screenshot({
    path: path.join(__dirname, 'test-receipt.png'),
    fullPage: true,
    type: 'png',
  })
  await browser.close()
  console.log('Generated test-receipt.png')
}

main().catch(console.error)
