import { expect, mock, test } from 'bun:test';
import { createPinningInitializer } from '../src/security/pinningInitialization';

test('concurrent requests share successful native security initialization', async () => {
  const native = mock(async () => {});
  const initialize = createPinningInitializer(native);
  const first = initialize();
  expect(initialize()).toBe(first);
  await first;
  await initialize();
  expect(native).toHaveBeenCalledTimes(1);
});

test('failed initialization can retry without bypassing security', async () => {
  const native = mock(async () => {}).mockRejectedValueOnce(new Error('Native setup failed'));
  const initialize = createPinningInitializer(native);
  await expect(initialize()).rejects.toThrow('Native setup failed');
  await initialize();
  expect(native).toHaveBeenCalledTimes(2);
});

test('hung native setup is bounded and the next attempt can recover', async () => {
  const native = mock(async () => {}).mockImplementationOnce(() => new Promise(() => {}));
  const initialize = createPinningInitializer(native, 5);
  await expect(initialize()).rejects.toMatchObject({ code: 'SECURE_CONNECTION_TIMEOUT' });
  await initialize();
  expect(native).toHaveBeenCalledTimes(2);
});

test('missing native module errors stay fail-closed on every retry', async () => {
  const native = mock(async () => { throw Object.assign(new Error('Install the latest app build'), { code: 'NATIVE_BUILD_REQUIRED' }); });
  const initialize = createPinningInitializer(native);
  await expect(initialize()).rejects.toMatchObject({ code: 'NATIVE_BUILD_REQUIRED' });
  await expect(initialize()).rejects.toMatchObject({ code: 'NATIVE_BUILD_REQUIRED' });
  expect(native).toHaveBeenCalledTimes(2);
});
