<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { db } from '#lib/db/db';
	import * as repo from '#lib/db/repo';
	import { theme, type ThemeChoice } from '#lib/stores/theme.svelte.js';
	import { toast } from '#lib/stores/toast.svelte.js';

	const VERSION = '0.1.0';

	let counts = $state({ movements: 0, sets: 0, runs: 0 });
	let usage = $state<string>('—');
	let lastBackupAt = $state<string | null>(null);
	let lastImportAt = $state<string | null>(null);

	let importFile = $state<File | null>(null);
	let importMode = $state<'merge' | 'replace'>('merge');
	let confirmReplace = $state(false);
	let pendingReset = $state(false);
	let busy = $state(false);

	const themes: { value: ThemeChoice; label: string }[] = [
		{ value: 'auto', label: 'Auto' },
		{ value: 'light', label: 'Clair' },
		{ value: 'dark', label: 'Sombre' }
	];

	async function refresh(): Promise<void> {
		const [movements, sets, runs] = await Promise.all([
			db.movements.toArray(),
			db.sets.toArray(),
			db.runs.toArray()
		]);
		counts = {
			movements: movements.filter((row) => !row.deletedAt).length,
			sets: sets.filter((row) => !row.deletedAt).length,
			runs: runs.filter((row) => !row.deletedAt).length
		};
		lastBackupAt = await repo.getSetting<string | null>('lastBackupAt', null);
		lastImportAt = await repo.getSetting<string | null>('lastImportAt', null);

		if (navigator.storage?.estimate) {
			const estimate = await navigator.storage.estimate();
			const mb = (estimate.usage ?? 0) / 1024 / 1024;
			usage = `${mb.toFixed(1)} Mo`;
		}
	}

	onMount(async () => {
		await repo.seedIfEmpty();
		await refresh();
	});

	async function exportBackup(): Promise<void> {
		busy = true;
		try {
			const backup = await repo.buildBackup();
			repo.downloadText(repo.backupFilename(), JSON.stringify(backup, null, 2), 'application/json');
			await repo.setSetting('lastBackupAt', new Date().toISOString());
			await refresh();
			toast.show('Sauvegarde exportée.');
		} finally {
			busy = false;
		}
	}

	async function runImport(): Promise<void> {
		if (!importFile) return;
		if (importMode === 'replace' && !confirmReplace) {
			toast.show('Coche la confirmation avant de remplacer.', 'error');
			return;
		}
		busy = true;
		try {
			const backup = await repo.readBackupFile(importFile);
			const result = await repo.importBackup(backup, importMode);
			await refresh();
			importFile = null;
			confirmReplace = false;
			toast.show(`${result.added} ajout(s), ${result.updated} mise(s) à jour.`);
		} catch (error) {
			toast.show((error as Error).message, 'error');
		} finally {
			busy = false;
		}
	}

	async function resetAll(): Promise<void> {
		busy = true;
		try {
			await db.transaction('rw', db.movements, db.sets, db.runs, db.settings, async () => {
				await db.movements.clear();
				await db.sets.clear();
				await db.runs.clear();
				await db.settings.clear();
			});
			await repo.seedIfEmpty();
			pendingReset = false;
			await refresh();
			toast.show('Données locales effacées.');
		} finally {
			busy = false;
		}
	}

	function formatStamp(value: string | null): string {
		if (!value) return 'jamais';
		return new Intl.DateTimeFormat('fr-FR', {
			dateStyle: 'short',
			timeStyle: 'short'
		}).format(new Date(value));
	}
</script>

<svelte:head>
	<title>Réglages — Appito</title>
</svelte:head>

<h1 class="page-title">Réglages</h1>
<p class="page-sub">Apparence, sauvegarde et données locales.</p>

<section class="card">
	<div class="card-head">
		<div>
			<h2 class="card-title">Apparence</h2>
			<p class="card-sub">Le mode automatique suit la préférence du système.</p>
		</div>
	</div>
	<div class="segmented" role="group" aria-label="Thème">
		{#each themes as option (option.value)}
			<button
				type="button"
				aria-pressed={theme.choice === option.value}
				onclick={() => theme.set(option.value)}
			>
				{option.label}
			</button>
		{/each}
	</div>
</section>

<div style="height: var(--sp-4)"></div>

<section class="card">
	<div class="card-head">
		<div>
			<h2 class="card-title">Sauvegarde</h2>
			<p class="card-sub">
				{#if lastBackupAt}
					Dernière sauvegarde le {formatStamp(lastBackupAt)}. Le fichier sert aussi à passer du
					téléphone à l'ordinateur.
				{:else}
					Aucune sauvegarde exportée pour le moment. Le fichier sert aussi à passer du téléphone
					à l'ordinateur.
				{/if}
			</p>
		</div>
		<button class="btn btn-primary" type="button" onclick={exportBackup} disabled={busy}>
			<Icon name="download" size={18} />
			Exporter
		</button>
	</div>

	<div class="import-zone">
		<div class="field">
			<label for="backup-file">Importer un fichier de sauvegarde</label>
			<input
				id="backup-file"
				type="file"
				accept="application/json,.json"
				onchange={(event) => (importFile = event.currentTarget.files?.[0] ?? null)}
			/>
		</div>

		<div class="field">
			<label for="import-mode">Mode</label>
			<select id="import-mode" bind:value={importMode}>
				<option value="merge">Fusionner avec l'existant</option>
				<option value="replace">Remplacer tout</option>
			</select>
		</div>

		{#if importMode === 'replace'}
			<label class="check">
				<input type="checkbox" bind:checked={confirmReplace} />
				Je comprends que les données locales non sauvegardées seront perdues.
			</label>
		{/if}

		<button
			class="btn"
			type="button"
			onclick={runImport}
			disabled={!importFile || busy}
		>
			<Icon name="upload" size={18} />
			Importer
		</button>

		{#if lastImportAt}
			<p class="list-sub">Dernier import : {formatStamp(lastImportAt)}</p>
		{/if}
	</div>
</section>

<div style="height: var(--sp-4)"></div>

<section class="card">
	<div class="card-head">
		<div>
			<h2 class="card-title">Données locales</h2>
			<p class="card-sub">Stockées dans ce navigateur, jamais envoyées à un serveur.</p>
		</div>
	</div>

	<div class="kpi-grid">
		<div class="kpi"><span class="kpi-label">Mouvements</span><span class="kpi-value">{counts.movements}</span></div>
		<div class="kpi"><span class="kpi-label">Séries</span><span class="kpi-value">{counts.sets}</span></div>
		<div class="kpi"><span class="kpi-label">Courses</span><span class="kpi-value">{counts.runs}</span></div>
		<div class="kpi"><span class="kpi-label">Espace</span><span class="kpi-value">{usage}</span></div>
	</div>

	<div style="margin-top: var(--sp-4)">
		{#if pendingReset}
			<div class="notice">
				<Icon name="alert" size={20} />
				<div>
					<strong>Effacer toutes les données ?</strong>
					Exporte d'abord une sauvegarde. Les huit mouvements par défaut seront recréés.
					<div class="confirm-actions">
						<button class="btn btn-danger btn-sm" type="button" onclick={resetAll} disabled={busy}>
							Confirmer l'effacement
						</button>
						<button class="btn btn-ghost btn-sm" type="button" onclick={() => (pendingReset = false)}>
							Annuler
						</button>
					</div>
				</div>
			</div>
		{:else}
			<button class="btn btn-danger" type="button" onclick={() => (pendingReset = true)}>
				<Icon name="trash" size={18} />
				Effacer les données locales
			</button>
		{/if}
	</div>
</section>

<div style="height: var(--sp-4)"></div>

<section class="card">
	<div class="card-head">
		<div>
			<h2 class="card-title">Installer Appito</h2>
			<p class="card-sub">Une fois installée, l'application s'ouvre plein écran et fonctionne hors ligne.</p>
		</div>
	</div>
	<ul class="help">
		<li><strong>Android (Chrome)</strong> : menu ⋮ → « Installer l'application ».</li>
		<li><strong>iOS (Safari)</strong> : bouton Partager → « Sur l'écran d'accueil ».</li>
		<li><strong>Ordinateur (Chrome/Edge)</strong> : icône d'installation dans la barre d'adresse.</li>
	</ul>
	<p class="list-sub" style="margin-top: var(--sp-3)">
		Appito {VERSION} · <a href="https://github.com/Martin-pito/Appito_V2" style="color: var(--red)">code source</a>
	</p>
</section>

<style>
	.import-zone {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
	}

	.check {
		display: flex;
		gap: var(--sp-2);
		align-items: flex-start;
		font-size: var(--fs-sm);
		color: var(--text-muted);
	}

	.check input {
		width: auto;
		min-height: auto;
		margin-top: 3px;
	}

	.confirm-actions {
		display: flex;
		gap: var(--sp-2);
		margin-top: var(--sp-3);
		flex-wrap: wrap;
	}

	.help {
		margin: 0;
		padding-left: var(--sp-5);
		color: var(--text-muted);
		font-size: var(--fs-sm);
	}

	.help li + li {
		margin-top: var(--sp-2);
	}

	.help strong {
		color: var(--text);
	}
</style>
