export async function syncToMongo(eventType, payload) {
  const endpoint = import.meta.env.VITE_MONGO_SYNC_ENDPOINT;

  if (!endpoint) {
    return { skipped: true };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Medicos-Sync-Secret': import.meta.env.VITE_MONGO_SYNC_SECRET || '',
      },
      body: JSON.stringify({
        eventType,
        payload,
        syncedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Mongo sync failed with ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.warn(error);
    return { skipped: false, error: error.message };
  }
}
