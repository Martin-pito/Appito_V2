<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import * as repo from '#lib/db/repo';
	import type { MovementSummary } from '#lib/db/repo';
	import { toast } from '#lib/stores/toast.svelte.js';
	import { formatRelativeDate, formatVolume, formatWeight } from '#lib/domain/sets';

	let ready = $state(false);
	let summaries = $state<MovementSummary[]>([]);
	let newName = $state('');
	let editingId = $state<string | null>(null);
	let editName = $state('');
	let pendingDelete = $state<string | null>(null);
	let deleteCount = $state(0);

	async function refresh(): Promise<void> {
		summaries = await repo.movementSummaries();
	}

	onMount(async () => {
		await repo.seedIfEmpty();
		await refresh();
		ready = true;
	});

	async function create(): Promise<void> {
		try {
			const movement = await repo.createMovement(newName);
			newName = '';
			await refresh();
			toast.show(`« ${movement.name} » créé.`);
		} catch (error) {
			toast.show((error as Error).message, 'error');
		}
	}

	function startRename(id: string, name: string): void {
		editingId = id;
		editName = name;
		pendingDelete = null;
	}

	async function saveRename(): Promise<void> {
		if (!editingId) return;
		try {
			await repo.renameMovement(editingId, editName);
			editingId = null;
			await refresh();
			toast.show('Mouvement renommé.');
		} catch (error) {
			toast.show((error as Error).message, 'error');
		}
	}

	async function askDelete(id: string): Promise<void> {
		pendingDelete = id;
		editingId = null;
		deleteCount = await repo.countSetsFor(id);
	}

	async function confirmDelete(id: string): Promise<void> {
		try {
			const result = await repo.deleteMovement(id);
			pendingDelete = null;
			await refresh();
			toast.show(`Mouvement supprimé, ${result.removedSets} saisie(s) retirée(s).`);
		} catch (error) {
			toast.show((error as Error).message, 'error');
		}
	}
</script>

<svelte:head>
	<title>Gestion — Appito</title>
</svelte:head>

<h1 class="page-title">Gestion</h1>
<p class="page-sub">Mouvements et correction des séances.</p>

<section class="card">
	<div class="card-head">
		<div>
			<h2 class="card-title">Nouveau mouvement</h2>
			<p class="card-sub">Entre 2 et 40 caractères, doublons refusés sans tenir compte de la casse.</p>
		</div>
	</div>

	<form
		class="create-row"
		onsubmit={(event) => {
			event.preventDefault();
			create();
		}}
	>
		<div class="field">
			<label class="sr-only" for="nouveau">Nom du mouvement</label>
			<input
				id="nouveau"
				type="text"
				bind:value={newName}
				placeholder="Ex. : Développé incliné"
				maxlength="40"
				required
			/>
		</div>
		<button class="btn btn-primary" type="submit">
			<Icon name="plus" size={18} />
			Créer
		</button>
	</form>
</section>

<div style="height: var(--sp-4)"></div>

<section class="card">
	<div class="card-head">
		<div>
			<h2 class="card-title">Mouvements suivis</h2>
			<p class="card-sub">
				{summaries.length} mouvement(s) · {formatVolume(summaries.reduce((sum, row) => sum + row.volume, 0))} au total
			</p>
		</div>
	</div>

	{#if !ready}
		<p class="list-sub">Chargement…</p>
	{:else if summaries.length === 0}
		<div class="empty">
			<strong>Aucun mouvement</strong>
			Crée le premier ci-dessus.
		</div>
	{:else}
		<div class="list">
			{#each summaries as row (row.movement.id)}
				<div class="movement">
					{#if editingId === row.movement.id}
						<form
							class="rename-row"
							onsubmit={(event) => {
								event.preventDefault();
								saveRename();
							}}
						>
							<input type="text" bind:value={editName} maxlength="40" aria-label="Nouveau nom" required />
							<button class="btn btn-primary btn-sm" type="submit">Enregistrer</button>
							<button class="btn btn-ghost btn-sm" type="button" onclick={() => (editingId = null)}>
								Annuler
							</button>
						</form>
					{:else}
						<div class="row-main">
							<div class="list-title">{row.movement.name}</div>
							<div class="list-sub">
								{row.entries} saisie(s) · {row.totalSets} série(s)
								{#if row.lastDate}· {formatRelativeDate(row.lastDate)}{/if}
							</div>
						</div>
						<div class="row-stats">
							<div class="list-value">{formatWeight(row.maxWeight)}</div>
							<div class="list-sub">{formatVolume(row.volume)}</div>
						</div>
						<div class="row-actions">
							<button
								class="icon-btn"
								type="button"
								aria-label="Renommer {row.movement.name}"
								onclick={() => startRename(row.movement.id, row.movement.name)}
							>
								<Icon name="pencil" size={18} />
							</button>
							<button
								class="icon-btn"
								type="button"
								aria-label="Supprimer {row.movement.name}"
								onclick={() => askDelete(row.movement.id)}
							>
								<Icon name="trash" size={18} />
							</button>
						</div>
					{/if}

					{#if pendingDelete === row.movement.id}
						<div class="confirm-box">
							<p>
								Supprimer <strong>{row.movement.name}</strong> efface aussi
								<strong>{deleteCount}</strong> saisie(s). Cette action sera propagée à la prochaine
								sauvegarde.
							</p>
							<div class="confirm-actions">
								<button class="btn btn-danger btn-sm" type="button" onclick={() => confirmDelete(row.movement.id)}>
									Supprimer définitivement
								</button>
								<button class="btn btn-ghost btn-sm" type="button" onclick={() => (pendingDelete = null)}>
									Annuler
								</button>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</section>

<div style="height: var(--sp-4)"></div>

<section class="card">
	<div class="card-head">
		<div>
			<h2 class="card-title">Corriger une séance</h2>
			<p class="card-sub">La correction détaillée (date, poids, reps, séries) arrive au jalon M6.</p>
		</div>
		<span class="badge">M6</span>
	</div>
	<p class="list-sub">
		En attendant, une série peut être supprimée depuis la page Musculation et ressaisie avec la
		bonne date.
	</p>
	<div style="margin-top: var(--sp-3)">
		<a class="btn btn-ghost btn-sm" href={resolve('/musculation')}>
			Aller à la saisie
			<Icon name="chevron" size={16} />
		</a>
	</div>
</section>

<style>
	.create-row {
		display: flex;
		gap: var(--sp-3);
		align-items: flex-end;
		flex-wrap: wrap;
	}

	.create-row .field {
		flex: 1;
		min-width: 200px;
	}

	.movement {
		padding: var(--sp-3) 0;
		border-bottom: 1px solid var(--border-soft);
	}

	.movement:last-child {
		border-bottom: none;
	}

	.row-main {
		display: flex;
		align-items: center;
		gap: var(--sp-3);
	}

	.row-main .list-title {
		flex: 1;
	}

	.row-stats {
		text-align: right;
		margin-left: auto;
	}

	.row-actions {
		display: flex;
		gap: var(--sp-2);
		margin-left: var(--sp-3);
	}

	.rename-row {
		display: flex;
		gap: var(--sp-2);
		flex-wrap: wrap;
	}

	.rename-row input {
		flex: 1;
		min-width: 160px;
	}

	.confirm-box {
		margin-top: var(--sp-3);
		padding: var(--sp-3);
		border: 1px solid var(--border-red);
		border-radius: var(--radius-sm);
		background: var(--red-soft);
		font-size: var(--fs-sm);
	}

	.confirm-actions {
		display: flex;
		gap: var(--sp-2);
		margin-top: var(--sp-3);
		flex-wrap: wrap;
	}
</style>
