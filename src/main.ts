import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Polyfill per sockjs-client e altre lib che si aspettano Node.js "global" nel browser
if (typeof (window as unknown as { global?: unknown }).global === 'undefined') {
  (window as unknown as { global: typeof window }).global = window;
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
