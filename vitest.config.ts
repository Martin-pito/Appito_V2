import { defineConfig } from 'vitest/config';

// Le domaine (calculs, fusion, formatage) est testé sans navigateur :
// aucun plugin Svelte n'est nécessaire ici.
export default defineConfig({
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
