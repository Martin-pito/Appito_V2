export interface ToastItem {
	id: number;
	message: string;
	kind: 'ok' | 'error';
}

class ToastState {
	items = $state<ToastItem[]>([]);
	private sequence = 0;

	show(message: string, kind: 'ok' | 'error' = 'ok'): void {
		const id = ++this.sequence;
		this.items = [...this.items, { id, message, kind }];
		setTimeout(() => this.dismiss(id), kind === 'error' ? 5000 : 3000);
	}

	dismiss(id: number): void {
		this.items = this.items.filter((item) => item.id !== id);
	}
}

export const toast = new ToastState();
