# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: checkout-no-card-inputs.spec.ts >> Checkout — PCI compliance: no raw card inputs >> payment section mentions Paystack but has no card form
- Location: e2e/checkout-no-card-inputs.spec.ts:60:7

# Error details

```
Error: browserType.launch: Executable doesn't exist at /Users/lyte/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell
╔════════════════════════════════════════════════════════════╗
║ Looks like Playwright was just installed or updated.       ║
║ Please run the following command to download new browsers: ║
║                                                            ║
║     npx playwright install                                 ║
║                                                            ║
║ <3 Playwright Team                                         ║
╚════════════════════════════════════════════════════════════╝
```