import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests',timeout:240000,workers:1,use:{baseURL:'http://localhost:3033',browserName:'chromium',channel:process.env.CI?undefined:'chrome',trace:'retain-on-failure'},reporter:'list'});
