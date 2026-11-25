// Site entièrement statique : chaque route est prérendue en HTML, ce qui rend
// la navigation hors ligne fiable (pas de fallback SPA à charger).
export const prerender = true;
export const ssr = true;

// GitHub Pages sert `dossier/index.html` : chaque route finit par un slash,
// ce qui la rend accessible en lien direct et par le service worker.
export const trailingSlash = 'always';
