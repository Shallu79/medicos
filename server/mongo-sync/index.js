import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { MongoClient } from 'mongodb';

const app = express();
const port = Number(process.env.PORT || 7071);
const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || 'medicos';
const syncSecret = process.env.MONGO_SYNC_SECRET;
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';

if (!mongoUri) {
  throw new Error('MONGODB_URI is required.');
}

const client = new MongoClient(mongoUri);

app.use(
  cors({
    origin: allowedOrigin,
  }),
);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'medicos-mongo-sync' });
});

app.post('/sync', async (request, response) => {
  if (syncSecret && request.header('X-Medicos-Sync-Secret') !== syncSecret) {
    response.status(401).json({ error: 'Invalid sync secret.' });
    return;
  }

  const { eventType, payload, syncedAt } = request.body || {};

  if (!eventType || !payload) {
    response.status(400).json({ error: 'eventType and payload are required.' });
    return;
  }

  const db = client.db(databaseName);
  const result = await db.collection('appwrite_events').insertOne({
    eventType,
    payload,
    syncedAt: syncedAt || new Date().toISOString(),
    receivedAt: new Date(),
  });

  response.status(201).json({ ok: true, id: result.insertedId });
});

await client.connect();

app.listen(port, () => {
  console.log(`Mongo sync service listening on http://localhost:${port}`);
});
