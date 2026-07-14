export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/**',
      '**/*.ts',
      '**/*.tsx',
    ],
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
]
