<script lang="ts">
	let {
		label,
		value,
		hint = ''
	}: {
		label: string;
		value: string;
		hint?: string;
	} = $props();
</script>

<div class="kpi">
	<span class="kpi-label">{label}</span>
	<span class="kpi-value">{value}</span>
	{#if hint}<span class="kpi-hint">{hint}</span>{/if}
</div>
