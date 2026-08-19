import { registerRootComponent } from 'expo';

// Must be imported before anything else — TaskManager.defineTask() has to
// run at JS-bundle load time so Android can find the task by name even when
// this file is the ONLY thing that runs (a fully killed app woken solely to
// handle a background push, before App.js ever mounts).
import './src/services/backgroundCallTask';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
