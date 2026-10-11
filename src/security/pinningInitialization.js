export function createPinningInitializer(initialize, timeoutMs = 5000) {
  let initialization = null;
  return () => {
    if (initialization) return initialization;
    let timer;
    const attempt = Promise.race([
      Promise.resolve().then(initialize),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error('Secure connection setup timed out. Please retry.');
          error.code = 'SECURE_CONNECTION_TIMEOUT';
          reject(error);
        }, timeoutMs);
      }),
    ]).finally(() => clearTimeout(timer));
    initialization = attempt.catch((error) => {
      // A transient native failure must not poison every subsequent API call.
      initialization = null;
      throw error;
    });
    return initialization;
  };
}
