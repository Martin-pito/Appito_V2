<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Kpi from '#lib/components/Kpi.svelte';
	import { db, type Run } from '#lib/db/db';
	import * as repo from '#lib/db/repo';
	import {
		formatDuration,
		formatPace,
		paceSecondsPerKm,
		summarizeRuns
	} from '#lib/domain/runs';
	import { formatNumber } from '#lib/domain/sets';
	import { SyncError, syncRuns } from '#lib/garmin/client';
	import { getSyncToken, hasSyncToken, setSyncToken } from '#lib/garmin/token';
	import { toast } from '#lib/stores/toast.svelte.js';

	let ready = $state(false);
	let runs = $state<Run[]>([]);
	let tokenSaved = $state(false);
	let token = $state('');
	let syncing = $state(false);
	let lastSyncAt = $state<string | null>(null);
	let notice = $state<{ text: string; error: boolean } | null>(null);

	const summary = $derived(summarizeRuns(runs));

	async function loadRuns(): Promise<void> {
		const rows = await db.runs.toArray();
		runs = rows.filter((run) => !run.deletedAt).sort((a, b) => b.date.localeCompare(a.date));
	}

	onMount(async () => {
		await loadRuns();
		tokenSaved = hasSyncToken();
		lastSyncAt = await repo.getSetting<string | null>('garminLastSyncAt', null);
		ready = true;
	});

	function saveToken(): void {
		setSyncToken(token);
		token = '';
		tokenSaved = hasSyncToken();
		if (!tokenSaved) {
			notice = { text: 'Le jeton est vide.', error: true };
			return;
		}
		toast.show('Jeton enregistré sur cet appareil.');
		void synchronize();
	}

	function syncMessage(error: unknown): string {
		const kind = error instanceof SyncError ? error.kind : 'server';
		switch (kind) {
			case 'offline':
				return 'Pas de réseau : les courses déjà présentes restent disponibles.';
			case 'unauthorized':
				return 'Jeton refusé. Vérifie-le dans les Réglages.';
			case 'config':
				return 'Aucun jeton enregistré sur cet appareil.';
			case 'payload':
				return 'Réponse inattendue du relais Garmin. Réessaie plus tard.';
			default:
				return 'La synchronisation a échoué côté serveur. Réessaie plus tard.';
		}
	}

	async function synchronize(): Promise<void> {
		const current = getSyncToken();
		if (!current) {
			notice = { text: 'Enregistre d’abord le jeton de synchronisation.', error: true };
			return;
		}

		syncing = true;
		notice = null;
		try {
			const result = await syncRuns({ token: current });
			const stamp = new Date().toISOString();
			await repo.setSetting('garminLastSyncAt', stamp);
			lastSyncAt = stamp;
			await loadRuns();

			notice = {
				text:
					result.added === 0 && result.updated === 0
						? `${result.unchanged} course(s) déjà à jour.`
						: `${result.added} ajout(s), ${result.updated} mise(s) à jour, ${result.unchanged} inchangée(s).`,
				error: false
			};
			toast.show('Synchronisation terminée.');
		} catch (error) {
			notice = { text: syncMessage(error), error: true };
		} finally {
			syncing = false;
		}
	}

	function syncLabel(): string {
		if (!lastSyncAt) return 'Jamais synchronisé sur cet appareil.';
		const formatted = new Intl.DateTimeFormat('fr-FR', {
			dateStyle: 'short',
			timeStyle: 'short'
		}).format(new Date(lastSyncAt));
		return `Dernière synchronisation le ${formatted}.`;
	}
</script>

<svelte:head>
	<title>Course — Appito</title>
</svelte:head>

<h1 class="page-title">Course</h1>
<p class="page-sub">Activités de course à pied, lues depuis Garmin Connect.</p>

<section class="card">
	<div class="card-head">
		<div>
			<h2 class="card-title">Synchronisation Garmin</h2>
			<p class="card-sub">{syncLabel()}</p>
		</div>
		{#if tokenSaved}
			<button class="btn btn-primary" type="button" onclick={synchronize} disabled={syncing}>
				<Icon name="refresh" size={18} />
				{syncing ? 'Synchronisation…' : 'Synchroniser'}
			</button>
		{/if}
	</div>

	{#if !tokenSaved}
		<div class="field">
			<label for="sync-token">Jeton de synchronisation</label>
			<input
				id="sync-token"
				type="password"
				autocomplete="off"
				autocapitalize="off"
				spellcheck={false}
				placeholder="Colle le jeton fourni avec l'application"
				bind:value={token}
			/>
			<p class="list-sub">
				À saisir une fois par appareil. Il reste dans ce navigateur et ne part jamais dans le
				code de l'application.
			</p>
		</div>
		<button class="btn" type="button" onclick={saveToken} disabled={!token.trim()}>
			<Icon name="check" size={18} />
			Enregistrer le jeton
		</button>
	{:else}
		<p class="list-sub">
			Jeton enregistré sur cet appareil. Pour le remplacer, passe par les Réglages.
		</p>
	{/if}

	{#if notice}
		<p class="sync-notice" class:is-error={notice.error} role="status">{notice.text}</p>
	{/if}
</section>

<div style="height: var(--sp-4)"></div>

{#if !ready}
	<p class="list-sub">Chargement…</p>
{:else if runs.length === 0}
	<section class="card">
		<div class="card-head">
			<div>
				<h2 class="card-title">Aucune course pour l'instant</h2>
				<p class="card-sub">
					{#if tokenSaved}
						Lance une synchronisation : les activités de course de Garmin Connect arrivent ici.
					{:else}
						Enregistre le jeton ci-dessus, puis synchronise : les activités de course de Garmin
						Connect arrivent ici.
					{/if}
				</p>
			</div>
		</div>

		<div class="list">
			<div class="list-row feature">
				<Icon name="check" size={18} />
				<div class="list-main">
					<div class="list-title">Vue d'ensemble</div>
					<div class="list-sub">courses, distance, D+, temps, allure, FC moyenne</div>
				</div>
			</div>
			<div class="list-row feature">
				<Icon name="check" size={18} />
				<div class="list-main">
					<div class="list-title">Cœur & intensité</div>
					<div class="list-sub">FC pondérée, zones Z1–Z5, part de haute intensité</div>
				</div>
			</div>
			<div class="list-row feature">
				<Icon name="check" size={18} />
				<div class="list-main">
					<div class="list-title">Allure & volume</div>
					<div class="list-sub">meilleure allure, meilleur kilomètre, volume hebdomadaire</div>
				</div>
			</div>
			<div class="list-row feature">
				<Icon name="check" size={18} />
				<div class="list-main">
					<div class="list-title">Charge & récupération</div>
					<div class="list-sub">body battery, cadence, foulée, calories</div>
				</div>
			</div>
		</div>

		<p class="list-sub" style="margin-top: var(--sp-3)">
			Hors ligne, la synchronisation attend que le réseau revienne ; les courses déjà présentes
			restent consultables.
		</p>
	</section>
{:else}
	<div class="kpi-grid">
		<Kpi label="Courses" value={String(summary.count)} hint="sur la période synchronisée" />
		<Kpi
			label="Distance"
			value={`${formatNumber(summary.distanceKm, 1)} km`}
			hint={`D+ ${formatNumber(summary.elevationGainM, 0)} m`}
		/>
		<Kpi label="Temps" value={formatDuration(summary.durationS)} hint="temps de course cumulé" />
		<Kpi
			label="Allure moy."
			value={formatPace(summary.avgPace)}
			hint={summary.avgHr ? `FC ${formatNumber(summary.avgHr, 0)} bpm` : 'FC non disponible'}
		/>
	</div>

	<div style="height: var(--sp-4)"></div>

	<section class="card">
		<div class="card-head">
			<div>
				<h2 class="card-title">Historique</h2>
				<p class="card-sub">Les activités synchronisées, de la plus récente à la plus ancienne.</p>
			</div>
		</div>

		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th>Date</th>
						<th>Activité</th>
						<th class="num">km</th>
						<th class="num">Temps</th>
						<th class="num">Allure</th>
						<th class="num">FC</th>
						<th class="num">D+</th>
					</tr>
				</thead>
				<tbody>
					{#each runs as run (run.garminId)}
						<tr>
							<td>{run.date.slice(0, 10)}</td>
							<td>{run.name}</td>
							<td class="num">{formatNumber((run.distanceM ?? 0) / 1000, 2)}</td>
							<td class="num">{formatDuration(run.durationS)}</td>
							<td class="num">{formatPace(paceSecondsPerKm(run))}</td>
							<td class="num">{run.avgHr ? formatNumber(run.avgHr, 0) : '—'}</td>
							<td class="num">{run.elevationGainM ? formatNumber(run.elevationGainM, 0) : '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{/if}

<style>
	.feature {
		align-items: flex-start;
	}

	.feature :global(svg) {
		margin-top: 2px;
		flex-shrink: 0;
	}

	.sync-notice {
		margin: var(--sp-3) 0 0;
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}

	.sync-notice.is-error {
		color: var(--red);
	}

	.card > .btn {
		margin-top: var(--sp-3);
	}
</style>
