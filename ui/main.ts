import { mount } from 'svelte';
import './styles.css';
import App from './App.svelte';
import { start } from './game.svelte';
import { startUpdateChecks } from './update';

mount(App, { target: document.getElementById('app')! });
start();
startUpdateChecks();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
