import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// GitHub Pages sert le site sous /Appito_V2 : la CI passe BASE_PATH.
// En local, BASE_PATH est vide et l'app est servie à la racine.
const base = (process.env.BASE_PATH ?? '') as '' | `/${string}`;

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Mode runes partout : le projet est neuf, pas de compatibilité legacy.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			paths: { base },
			adapter: adapter({
				pages: 'build',
				assets: 'build',
				strict: true
			})
		})
	]
});
