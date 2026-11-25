export type ThemeChoice = 'auto' | 'light' | 'dark';

/**
 * Thème : choix explicite mémorisé, sinon préférence système.
 * Le premier rendu est déjà correct : app.html applique le thème avant la
 * peinture, ce store ne fait que suivre et propager les changements.
 */
class ThemeState {
	choice = $state<ThemeChoice>('auto');
	systemLight = $state(false);
	private started = false;

	get resolved(): 'light' | 'dark' {
		if (this.choice === 'auto') return this.systemLight ? 'light' : 'dark';
		return this.choice;
	}

	init(): void {
		if (this.started || typeof window === 'undefined') return;
		this.started = true;

		const stored = window.localStorage.getItem('appito-theme');
		if (stored === 'light' || stored === 'dark' || stored === 'auto') {
			this.choice = stored;
		}

		const media = window.matchMedia('(prefers-color-scheme: light)');
		this.systemLight = media.matches;
		media.addEventListener('change', (event) => {
			this.systemLight = event.matches;
		});
	}

	set(choice: ThemeChoice): void {
		this.choice = choice;
		try {
			window.localStorage.setItem('appito-theme', choice);
		} catch {
			/* mode privé : le thème reste valable pour la session */
		}
	}

	apply(): void {
		if (typeof document === 'undefined') return;
		const resolved = this.resolved;
		document.documentElement.setAttribute('data-theme', resolved);
		const meta = document.querySelector('meta[name="theme-color"]');
		meta?.setAttribute('content', resolved === 'light' ? '#f2f2f6' : '#050507');
	}
}

export const theme = new ThemeState();
