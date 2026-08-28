// @ts-check
import js from '@eslint/js'
import globals from 'globals'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'coverage/**',
            'research/**',
            '.next/**',
            'test-results/**',
            'playwright-report/**',
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.{ts,tsx}'],
        // .flat[…] is required: configs['recommended-latest'] has `plugins` as an array of
        // strings, which ESLint 10 rejects outright.
        ...reactHooks.configs.flat['recommended-latest'],
        rules: {
            ...reactHooks.configs.flat['recommended-latest'].rules,
            // warn in recommended-latest; a library should fail on it
            'react-hooks/exhaustive-deps': 'error',
        },
    },
    {
        files: ['scripts/**/*.mjs'],
        languageOptions: { globals: globals.node },
    },
    {
        rules: {
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/consistent-type-imports': [
                'error',
                { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
            ],
        },
    },
    prettier,
)
