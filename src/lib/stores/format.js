import { writable } from 'svelte/store';

// Save format: png, jpeg, svg
export const saveFormat = writable('png');

// Share method: link, twitter, other
export const shareMethod = writable('link');
