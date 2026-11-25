<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import Kpi from '#lib/components/Kpi.svelte';
	import * as repo from '#lib/db/repo';
	import type { Movement, WorkSet } from '#lib/db/db';
	import { toast } from '#lib/stores/toast.svelte.js';
	import {
		computeKpis,
		filterByPeriod,
		filterByReps,
		formatNumber,
		formatPercent,
		formatPrescription,
		formatRelativeDate,
		formatVolume,
		formatWeight,
		previousWindow,
		todayISO,
		volumeOf
	} from '#lib/domain/sets';

	let ready = $state(false);
	let movements = $state<Movement[]>([]);
	let recent = $state<Movement[]>([]);
	let selectedId = $state('');
	let sets = $state<WorkSet[]>([]);

	let date = $state(todayISO());
	let weight = $state(60);
	let reps = $state(8);
	let setCount = $state(4);

	let period = $state(30);
	let repsFilter = $state<'all' | number>('all');
	let pendingDelete = $state<string | null>(null);

	const periods = [
		{ days: 30, label: '30 j' },
		{ days: 90, label: '90 j' },
		{ days: 365, label: '1 an' },
		{ days: 0, label: 'Tout' }
	];

	const selected = $derived(movements.find((movement) => movement.id === selectedId));
	const filtered = $derived(filterByReps(filterByPeriod(sets, period), repsFilter));
	const previous = $derived(previousWindow(sets, period));
	const kpis = $derived(computeKpis(filtered, previous));
	const availableReps = $derived([...new Set(sets.map((set) => set.reps))].sort((a, b) => a - b));
	const parsedReps = $derived(repsFilter === 'all' ? 'all' : Number(repsFilter));

	async function loadSets(prefill: boolean): Promise<void> {
		if (!selectedId) {
			sets = [];
			return;
		}
		sets = await repo.listSets(selectedId);
		repsFilter = 'all';
		pendingDelete = null;
		if (prefill && sets[0]) {
			weight = sets[0].weight;
			reps = sets[0].reps;
			setCount = sets[0].setCount;
		}
	}

	async function load(): Promise<void> {
		await repo.seedIfEmpty();
		movements = await repo.listMovements();
		recent = await repo.recentMovements();

		const stored = await repo.getSetting<string>('lastMovementId', '');
		selectedId = movements.some((movement) => movement.id === stored)
			? stored
			: (movements[0]?.id ?? '');

		await loadSets(true);
		ready = true;
	}

	onMount(load);

	async function selectMovement(id: string): Promise<void> {
		if (!id || id === selectedId) return;
		selectedId = id;
		await repo.setSetting('lastMovementId', id);
		await loadSets(true);
	}

	async function save(): Promise<void> {
		if (!selectedId) return;
		try {
			await repo.addSet({ movementId: selectedId, date, weight, reps, setCount });
			await loadSets(false);
			recent = await repo.recentMovements();
			toast.show(`Enregistré : ${setCount} × ${reps} @ ${formatNumber(weight)} kg`);
			date = todayISO();
		} catch (error) {
			toast.show((error as Error).message, 'error');
		}
	}

	async function removeSet(id: string): Promise<void> {
		try {
			await repo.deleteSet(id);
			await loadSets(false);
			toast.show('Série supprimée.');
		} catch (error) {
			toast.show((error as Error).message, 'error');
		}
	}

	function exportCsv(): void {
		const name = selected?.name ?? 'mouvement';
		const rows = filtered.map((set) => ({
			date: set.date,
			movement: name,
			weight: set.weight,
			reps: set.reps,
			setCount: set.setCount
		}));
		const slug = name
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '');
		repo.downloadText(`appito-${slug}-${todayISO()}.csv`, repo.toCsv(rows), 'text/csv;charset=utf-8');
	}

	function adjust(delta: number): void {
		weight = Math.min(500, Math.max(0, Math.round((weight + delta) * 10) / 10));
	}
</script>

<svelte:head>
	<title>Musculation — Appito</title>
</svelte:head>

<h1 class="page-title">Musculation</h1>
<p class="page-sub">Saisis une série, retrouve ta progression.</p>

{#if !ready}
	<p class="list-sub">Chargement…</p>
{:else if movements.length === 0}
	<div class="card empty">
		<strong>Aucun mouvement</strong>
		Crée un mouvement dans la page Gestion pour commencer.
		<div style="margin-top: var(--sp-4)">
			<a class="btn btn-primary" href={resolve('/gestion')}>Ouvrir Gestion</a>
		</div>
	</div>
{:else}
	<div class="workout-layout">
			<section class="card">
			<div class="card-head">
				<div>
					<h2 class="card-title">Saisie</h2>
					<p class="card-sub">
						{#if sets[0]}
							Dernière fois : {formatPrescription(sets[0])} · {formatRelativeDate(sets[0].date)}
						{:else}
							Première série pour ce mouvement.
						{/if}
					</p>
				</div>
			</div>

			{#if recent.length > 0}
				<div class="chips" role="group" aria-label="Mouvements récents">
					{#each recent as movement (movement.id)}
						<button
							type="button"
							class="chip"
							aria-pressed={movement.id === selectedId}
							onclick={() => selectMovement(movement.id)}
						>
							{movement.name}
						</button>
					{/each}
				</div>
				<div style="height: var(--sp-3)"></div>
			{/if}

			<div class="field">
				<label for="mouvement">Mouvement</label>
				<select
					id="mouvement"
					value={selectedId}
					onchange={(event) => selectMovement(event.currentTarget.value)}
				>
					{#each movements as movement (movement.id)}
						<option value={movement.id}>{movement.name}</option>
					{/each}
				</select>
			</div>

			<div style="height: var(--sp-3)"></div>

			<form class="form-grid" onsubmit={(event) => { event.preventDefault(); save(); }}>
				<div class="field span-2">
					<label for="date">Date de la séance</label>
					<input id="date" type="date" bind:value={date} max={todayISO()} required />
				</div>

				<div class="field span-2">
					<label for="poids">Poids (kg)</label>
					<div class="stepper">
						<button type="button" class="step-btn" onclick={() => adjust(-2.5)} aria-label="Diminuer de 2,5 kg">
							−
						</button>
						<input
							id="poids"
							type="number"
							bind:value={weight}
							min="0"
							max="500"
							step="2.5"
							inputmode="decimal"
							required
						/>
						<button type="button" class="step-btn" onclick={() => adjust(2.5)} aria-label="Augmenter de 2,5 kg">
							+
						</button>
					</div>
				</div>

				<div class="field">
					<label for="reps">Répétitions</label>
					<input id="reps" type="number" bind:value={reps} min="1" max="100" step="1" inputmode="numeric" required />
				</div>

				<div class="field">
					<label for="series">Séries faites</label>
					<input
						id="series"
						type="number"
						bind:value={setCount}
						min="1"
						max="50"
						step="1"
						inputmode="numeric"
						required
					/>
				</div>

				<div class="span-2">
					<button class="btn btn-primary btn-block" type="submit">
						<Icon name="plus" size={20} />
						Enregistrer {setCount} × {reps} @ {formatNumber(weight)} kg
					</button>
				</div>
			</form>
		</section>

		<div class="workout-side">
			<div class="kpi-grid">
			<Kpi label="Séries" value={String(kpis.totalSets)} hint={`${kpis.entries} saisie(s)`} />
			<Kpi label="Poids max" value={formatWeight(kpis.maxWeight)} hint="sur la période" />
			<Kpi label="Volume" value={formatVolume(kpis.volume)} hint="poids × reps × séries" />
			<Kpi
				label="Progression"
				value={formatPercent(kpis.progressionPct)}
				hint={period === 0 ? 'période complète' : 'vs période précédente'}
			/>
		</div>

		<section class="card">
			<div class="card-head">
				<div>
					<h2 class="card-title">Progression</h2>
					<p class="card-sub">
						{filtered.length} saisie(s) affichée(s) · {formatVolume(kpis.volume)}
					</p>
				</div>
				<button class="btn btn-ghost btn-sm" type="button" onclick={exportCsv} disabled={filtered.length === 0}>
					<Icon name="download" size={16} />
					CSV
				</button>
			</div>

			<div class="filters">
				<div class="segmented" role="group" aria-label="Période">
					{#each periods as option (option.days)}
						<button
							type="button"
							aria-pressed={period === option.days}
							onclick={() => (period = option.days)}
						>
							{option.label}
						</button>
					{/each}
				</div>

				<div class="field reps-filter">
					<label class="sr-only" for="filtre-reps">Répétitions</label>
					<select
						id="filtre-reps"
						value={String(parsedReps)}
						onchange={(event) =>
							(repsFilter = event.currentTarget.value === 'all' ? 'all' : Number(event.currentTarget.value))}
					>
						<option value="all">Toutes les répétitions</option>
						{#each availableReps as value (value)}
							<option value={String(value)}>{value} répétitions</option>
						{/each}
					</select>
				</div>
			</div>

			{#if filtered.length === 0}
				<div class="empty">
					<strong>Aucune série pour ce filtre</strong>
					Élargis la période ou change le nombre de répétitions.
				</div>
			{:else}
				<div class="list">
					{#each filtered.slice(0, 15) as set (set.id)}
						<div class="list-row">
							<div class="list-main">
								<div class="list-title">{formatPrescription(set)}</div>
								<div class="list-sub">{formatRelativeDate(set.date)}</div>
							</div>
							<div class="list-value">{formatVolume(volumeOf(set))}</div>
							{#if pendingDelete === set.id}
								<div class="confirm">
									<button class="btn btn-danger btn-sm" type="button" onclick={() => removeSet(set.id)}>
										Supprimer
									</button>
									<button class="btn btn-ghost btn-sm" type="button" onclick={() => (pendingDelete = null)}>
										Annuler
									</button>
								</div>
							{:else}
								<button
									class="icon-btn"
									type="button"
									aria-label="Supprimer cette série"
									onclick={() => (pendingDelete = set.id)}
								>
									<Icon name="trash" size={18} />
								</button>
							{/if}
						</div>
					{/each}
				</div>
				{#if filtered.length > 15}
					<p class="list-sub" style="margin-top: var(--sp-3)">
						Les {filtered.length - 15} saisies plus anciennes restent disponibles dans l'export CSV.
					</p>
				{/if}
			{/if}
		</section>
		</div>
	</div>
{/if}

<style>
	.workout-layout {
		display: grid;
		gap: var(--sp-4);
	}

	.workout-side {
		display: grid;
		gap: var(--sp-4);
	}

	/* Sur grand écran, la saisie et l'analyse vivent côte à côte : un
	   formulaire de 550 px dans une carte de 1100 px laissait un vide. */
	@media (min-width: 1000px) {
		.workout-layout {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			align-items: start;
		}

		.workout-side .kpi-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.stepper {
		display: grid;
		grid-template-columns: 52px 1fr 52px;
		gap: var(--sp-2);
		align-items: stretch;
	}

	.step-btn {
		min-height: 48px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: var(--surface-strong);
		color: var(--text);
		font-size: var(--fs-xl);
		font-weight: 600;
		cursor: pointer;
	}

	.step-btn:hover {
		background: var(--surface-hover);
	}

	.stepper input {
		text-align: center;
		font-size: var(--fs-xl);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-3);
		align-items: center;
		margin-bottom: var(--sp-3);
	}

	.reps-filter {
		flex: 1;
		min-width: 180px;
	}

	.reps-filter select {
		min-height: 44px;
	}

	.confirm {
		display: flex;
		gap: var(--sp-2);
	}
</style>
