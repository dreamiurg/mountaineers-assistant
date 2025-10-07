import { defineConfig } from "eslint/config";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import tseslint from "typescript-eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

const browserGlobals = {
    ...globals.browser,
    chrome: "readonly",
};

const tsConfigs = tseslint.configs.recommended.map((config) => ({
    ...config,
    files: [
        "**/*.ts",
        "**/*.tsx",
        "**/*.mts",
        "**/*.cts",
    ],
    languageOptions: {
        ...config.languageOptions,
        globals: browserGlobals,
        parserOptions: {
            ...config.languageOptions?.parserOptions,
            projectService: true,
            tsconfigRootDir: __dirname,
        },
    },
}));

export default defineConfig([
    {
        extends: compat.extends("eslint:recommended"),

        languageOptions: {
            globals: browserGlobals,
            ecmaVersion: "latest",
            sourceType: "module",
        },

        rules: {
            "no-console": "off",
        },
    },
    ...tsConfigs,
    {
        files: ["**/*.config.js", "**/postcss.config.js", "**/tailwind.config.js"],

        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    {
        files: ["scripts/**/*.js"],

        languageOptions: {
            globals: {
                ...globals.node,
            },
            sourceType: "commonjs",
        },
    },
    {
        ignores: [
            "src/chrome-ext/vendor/**",
            "dist/**",
        ],
    },
]);
