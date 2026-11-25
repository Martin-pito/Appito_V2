<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Kpi from '#lib/components/Kpi.svelte';
	import { db, type Run } from '#lib/db/db';
	import {
		formatDuration,
		formatPace,
		paceSecondsPerKm,
		summarizeRuns
	} from '#lib/domain/runs';
	import { formatNumber } from '#lib/domain/sets';

	let ready = $state(false);
	let runs = $state<Run[]>([]);

	const summary = $derived(summarizeRuns(runs));

	onMount(async () => {
		const rows = await db.runs.toArray();
		runs = rows
			.filter((run) => !run.deletedAt)
			.sort((a, b) => b.date.localeCompare(a.date));
		ready = true;
	});
</script>

<svelte:head>
	<title>Course — Appito</title>
</svelte:head>

<h1 class="page-title">Course</h1>
<p class="page-sub">Activités de course à pied, importées depuis Garmin Connect.</p>

{#if !ready}
	<p class="list-sub">Chargement…</p>
{:else if runs.length === 0}
	<section class="card">
		<div class="card-head">
			<div>
				<h2 class="card-title">Aucune course importée</h2>
				<p class="card-sub">Cette page reprend les métriques de la v1, alimentées par un fichier Garmin.</p>
			</div>
			<span class="badge">jalon M5</span>
		</div>

		<p class="list-sub" style="margin-bottom: var(--sp-3)">
			La clé API Garmin ne peut pas être embarquée dans l'application : un script local, sur ton
			ordinateur, produit un fichier <code>garmin-courses.json</code> que cette page importera.
			La logique de conversion de la v1 (<code>R/course_utils.R</code>) est réutilisée telle quelle.
		</p>

		<div class="list">
			<div class="list-row">
				<Icon name="check" size={18} />
				<div class="list-main">
					<div class="list-title">Vue d'ensemble</div>
					<div class="list-sub">courses, distance, D+, temps, allure, FC moyenne</div>
				</div>
			</div>
			<div class="list-row">
				<Icon name="check" size={18} />
				<div class="list-main">
					<div class="list-title">Cœur & intensité</div>
					<div class="list-sub">FC pondérée, zones Z1–Z5, part de haute intensité</div>
				</div>
			</div>
			<div class="list-row">
				<Icon name="check" size={18} />
				<div class="list-main">
					<div class="list-title">Allure & volume</div>
					<div class="list-sub">meilleure allure, meilleur kilomètre, volume hebdomadaire</div>
				</div>
			</div>
			<div class="list-row">
				<Icon name="check" size={18} />
				<div class="list-main">
					<div class="list-title">Charge & récupération</div>
					<div class="list-sub">body battery, cadence, foulée, calories</div>
				</div>
			</div>
		</div>
	</section>
{:else}
	<div class="kpi-grid">
		<Kpi label="Courses" value={String(summary.count)} hint="sur la période importée" />
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
				<p class="card-sub">Les activités importées, de la plus récente à la plus ancienne.</p>
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
