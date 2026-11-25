<script lang="ts">
	import { toast } from '#lib/stores/toast.svelte.js';
</script>

<div class="toasts" aria-live="polite" aria-atomic="true">
	{#each toast.items as item (item.id)}
		<div class="toast" class:is-error={item.kind === 'error'} role="status">
			{item.message}
		</div>
	{/each}
</div>

<style>
	.toasts {
		position: fixed;
		left: 50%;
		bottom: calc(var(--nav-h) + var(--safe-bottom) + 16px);
		z-index: 60;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		gap: var(--sp-2);
		width: min(92vw, 420px);
		pointer-events: none;
	}

	@media (min-width: 900px) {
		.toasts {
			left: auto;
			right: var(--sp-6);
			bottom: var(--sp-6);
			transform: none;
		}
	}

	.toast {
		padding: var(--sp-3) var(--sp-4);
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--bg-2) 92%, transparent);
		backdrop-filter: blur(10px);
		box-shadow: var(--shadow);
		font-size: var(--fs-sm);
		animation: slide-up 0.22s ease-out;
	}

	.toast.is-error {
		border-color: var(--border-red);
		background: color-mix(in srgb, var(--red-deep) 32%, var(--bg-2));
		color: #fff;
	}

	@keyframes slide-up {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
