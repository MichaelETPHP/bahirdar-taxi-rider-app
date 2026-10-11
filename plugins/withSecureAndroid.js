const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = config => withAndroidManifest(config, config => {
  const application = config.modResults.manifest.application[0];
  application.$['android:usesCleartextTraffic'] = 'false';
  const services = application.service || (application.service = []);
  const name = 'io.wazo.callkeep.RNCallKeepBackgroundMessagingService';
  let service = services.find(item => item.$['android:name'] === name);
  if (!service) { service = { $: { 'android:name': name } }; services.push(service); }
  service.$['android:exported'] = 'false';
  return config;
});
