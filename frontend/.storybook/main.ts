import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  addons: [
    "@chromatic-com/storybook",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
  ],
  framework: "@storybook/react-vite",
  async viteFinal(config) {
    // 移除 Docker 專用的 serveHtmlFromCachePlugin，避免攔截 Storybook 請求
    config.plugins = (config.plugins ?? []).filter((p) => {
      const name = p && typeof p === "object" && "name" in p ? p.name : undefined;
      return name !== "serve-html-from-cache";
    });
    return config;
  },
};
export default config;
