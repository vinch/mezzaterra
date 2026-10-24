import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	// Mode runes pour le code du projet : `pnpm check` et la compilation refusent l'ancienne syntaxe.
	compilerOptions: { runes: true },
	// Les dépendances gardent leur propre mode (une bibliothèque en ancienne syntaxe compile).
	vitePlugin: {
		dynamicCompileOptions: ({ filename }) =>
			filename.split(/[/\\]/).includes('node_modules') ? { runes: undefined } : undefined
	},

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter()
	}
};

export default config;
