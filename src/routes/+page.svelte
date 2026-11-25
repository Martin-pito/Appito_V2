<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import Kpi from '#lib/components/Kpi.svelte';
	import * as repo from '#lib/db/repo';
	import type { Movement, WorkSet } from '#lib/db/db';
	import {
		filterByPeriod,
		formatPrescription,
		formatRelativeDate,
		formatVolume,
		formatWeight,
		volumeOf
	} from '#lib/domain/sets';

	let ready = $state(false);
	let movements = $state<Movement[]>([]);
	let sets = $state<WorkSet[]>([]);
	let lastBackupAt = $state<string | null>(null);

	const todayLabel = new Intl.DateTimeFormat('fr-FR', {
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	}).format(new Date());
	const todayTitle = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1);

	const nameById = $derived(new Map(movements.map((movement) => [movement.id, movement.name])));
	const week = $derived(filterByPeriod(sets, 7));
	const weekVolume = $derived(week.reduce((sum, set) => sum + volumeOf(set), 0));
	const weekSets = $derived(week.reduce((sum, set) => sum + set.setCount, 0));
	const last = $derived(sets[0]);
	const recent = $derived(sets.slice(0, 5));

	const backupWarning = $derived.by(() => {
		if (sets.length === 0) return false;
		if (!lastBackupAt) return true;
		const age = (Date.now() - new Date(lastBackupAt).getTime()) / 86_400_000;
		return age > 30;
	});

	onMount(async () => {
		await repo.seedIfEmpty();
		movements = await repo.listMovements();
		const rows = await repo.allActiveSets();
		sets = rows.sort(
			(a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
		);
		lastBackupAt = await repo.getSetting<string | null>('lastBackupAt', null);
		ready = true;
	});
</script>

<svelte:head>
	<title>Aujourd'hui — Appito</title>
</svelte:head>

<h1 class="page-title">Aujourd'hui</h1>
<p class="page-sub">{todayTitle}</p>

{#if backupWarning}
	<div class="notice" role="status">
		<Icon name="alert" size={20} />
		<div>
			<strong>Pense à sauvegarder.</strong>
			{#if lastBackupAt}
				Dernière sauvegarde il y a plus de 30 jours.
			{:else}
				Aucune sauvegarde exportée pour le moment.
			{/if}
			<a href={resolve('/reglages')} style="color: var(--red); font-weight: 600">Ouvrir les réglages</a>
		</div>
	</div>
	<div style="height: var(--sp-4)"></div>
{/if}

<section class="hero card">
	<div class="hero-text">
		<h2 class="card-title">Nouvelle série</h2>
		<p class="card-sub">
			{#if last}
				Dernière fois : {nameById.get(last.movementId) ?? '—'} · {formatPrescription(last)}
			{:else}
				Ta première série t'attend. Les huit mouvements de base sont déjà là.
			{/if}
		</p>
	</div>
	<a class="btn btn-primary" href={resolve('/musculation')}>
		<Icon name="plus" size={20} />
		Enregistrer
	</a>
</section>

<div style="height: var(--sp-4)"></div>

<div class="kpi-grid">
	<Kpi label="Séries · 7 j" value={String(weekSets)} hint="répétitions comptées en séries" />
	<Kpi label="Volume · 7 j" value={formatVolume(weekVolume)} hint="poids × reps × séries" />
	<Kpi label="Mouvements" value={String(movements.length)} hint="suivis actuellement" />
	<Kpi
		label="Dernière séance"
		value={last ? formatWeight(last.weight) : '—'}
		hint={last ? formatRelativeDate(last.date) : 'aucune encore'}
	/>
</div>

<div style="height: var(--sp-4)"></div>

<section class="card">
	<div class="card-head">
		<div>
			<h2 class="card-title">Dernières séries</h2>
			<p class="card-sub">Les cinq derniers enregistrements, tous mouvements confondus.</p>
		</div>
		{#if sets.length > 0}
			<a class="btn btn-ghost btn-sm" href={resolve('/musculation')}>
				Tout voir
				<Icon name="chevron" size={16} />
			</a>
		{/if}
	</div>

	{#if !ready}
		<p class="list-sub">Chargement…</p>
	{:else if recent.length === 0}
		<div class="empty">
			<strong>Aucune série enregistrée</strong>
			Ouvre la page Musculation pour saisir ta première séance.
		</div>
	{:else}
		<div class="list">
			{#each recent as set (set.id)}
				<div class="list-row">
					<div class="list-main">
						<div class="list-title">{nameById.get(set.movementId) ?? 'Mouvement supprimé'}</div>
						<div class="list-sub">{formatRelativeDate(set.date)} · {formatPrescription(set)}</div>
					</div>
					<div class="list-value">{formatVolume(volumeOf(set))}</div>
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.hero {
		display: flex;
		align-items: center;
		gap: var(--sp-4);
		flex-wrap: wrap;
		border-color: var(--border-red);
	}

	.hero-text {
		flex: 1;
		min-width: 180px;
	}
</style>
