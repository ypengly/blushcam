import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 60_000, retries: process.env.CI ? 1 : 0,
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'],
    // Fake camera device + auto-granted permission: CI never touches a real camera or real people's photos.
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }, permissions: ['camera'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] }, permissions: ['camera'] } }],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: 'npm run build && npm run start', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 180_000 },
});
