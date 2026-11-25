import { mount } from 'svelte';
import './styles.css';
import App from './App.svelte';
import { start } from './game.svelte';

mount(App, { target: document.getElementById('app')! });
start();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
