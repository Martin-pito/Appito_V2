<script lang="ts">
	import '../app.css';
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import Toast from '#lib/components/Toast.svelte';
	import { theme } from '#lib/stores/theme.svelte.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const links = [
		{ href: resolve('/'), label: "Aujourd'hui", icon: 'home' as const, exact: true },
		{ href: resolve('/musculation'), label: 'Musculation', icon: 'dumbbell' as const, exact: false },
		{ href: resolve('/course'), label: 'Course', icon: 'run' as const, exact: false },
		{ href: resolve('/gestion'), label: 'Gestion', icon: 'sliders' as const, exact: false }
	];

	function isActive(href: string, exact: boolean): boolean {
		const path = page.url.pathname.replace(/\/+$/, '') || '/';
		const target = href.replace(/\/+$/, '') || '/';
		if (exact) return path === target;
		return path === target || path.startsWith(target + '/');
	}

	$effect(() => {
		theme.init();
		theme.apply();
	});

	const themeIcon = $derived(
		theme.choice === 'auto' ? 'auto' : theme.choice === 'light' ? 'sun' : 'moon'
	);
	const themeLabel = $derived(
		theme.choice === 'auto'
			? 'Thème automatique (suivant le système)'
			: theme.choice === 'light'
				? 'Thème clair'
				: 'Thème sombre'
	);

	function cycleTheme(): void {
		const order = ['auto', 'light', 'dark'] as const;
		const current = order.indexOf(theme.choice);
		theme.set(order[(current + 1) % order.length]);
	}
</script>

<div class="app-shell">
	<header class="app-header">
		<a class="app-brand" href={resolve('/')} aria-label="Appito, accueil">
			<img src={asset('icons/icon-192.png')} alt="" width="30" height="30" />
			<span>Appito</span>
		</a>
		<div class="app-header-spacer"></div>
		<button class="icon-btn" type="button" onclick={cycleTheme} aria-label={themeLabel} title={themeLabel}>
			<Icon name={themeIcon} size={20} />
		</button>
		<a class="icon-btn" href={resolve('/reglages')} aria-label="Réglages">
			<Icon name="settings" size={20} />
		</a>
	</header>

	<nav class="app-nav" aria-label="Navigation principale">
		{#each links as link (link.href)}
			<a
				class="nav-item"
				href={link.href}
				aria-current={isActive(link.href, link.exact) ? 'page' : undefined}
			>
				<Icon name={link.icon} />
				<span>{link.label}</span>
			</a>
		{/each}
	</nav>

	<main class="app-main">
		{@render children()}
	</main>
</div>

<Toast />
