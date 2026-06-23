import { Account, Client, Databases, ID, Query, Storage } from 'appwrite';
import { syncToMongo } from './mongoSync';

const config = {
  endpoint: import.meta.env.VITE_APPWRITE_ENDPOINT,
  projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID,
  databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID,
  collections: {
    patients:
      import.meta.env.VITE_APPWRITE_PATIENTS_COLLECTION_ID ||
      import.meta.env.VITE_APPWRITE_PATIENTS_TABLE_ID ||
      'patients',
    appointments:
      import.meta.env.VITE_APPWRITE_APPOINTMENTS_COLLECTION_ID ||
      import.meta.env.VITE_APPWRITE_APPOINTMENTS_TABLE_ID ||
      'appointments',
    prescriptions:
      import.meta.env.VITE_APPWRITE_PRESCRIPTIONS_COLLECTION_ID ||
      import.meta.env.VITE_APPWRITE_PRESCRIPTIONS_TABLE_ID ||
      'prescriptions',
    medicineRequests:
      import.meta.env.VITE_APPWRITE_MEDICINE_REQUESTS_COLLECTION_ID ||
      import.meta.env.VITE_APPWRITE_MEDICINE_REQUESTS_TABLE_ID || 'medicine_requests',
    emergencyAlerts:
      import.meta.env.VITE_APPWRITE_EMERGENCY_ALERTS_COLLECTION_ID ||
      import.meta.env.VITE_APPWRITE_EMERGENCY_ALERTS_TABLE_ID || 'emergency_alerts',
    feedback:
      import.meta.env.VITE_APPWRITE_FEEDBACK_COLLECTION_ID ||
      import.meta.env.VITE_APPWRITE_FEEDBACK_TABLE_ID ||
      'feedback',
  },
  bucketId: import.meta.env.VITE_APPWRITE_PRESCRIPTIONS_BUCKET_ID || 'prescriptions',
};

const client = new Client();

if (config.endpoint && config.projectId) {
  client.setEndpoint(config.endpoint).setProject(config.projectId);
}

const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);
const localPrefix = 'carebridge-medicos';

export const appwriteStatus = {
  configured: Boolean(config.endpoint && config.projectId && config.databaseId),
  endpoint: config.endpoint,
  projectId: config.projectId,
  databaseId: config.databaseId,
};

async function ensureSession() {
  if (!appwriteStatus.configured) {
    return null;
  }

  try {
    return await account.get();
  } catch (error) {
    return account.createAnonymousSession();
  }
}

function getLocalRows(tableName) {
  const raw = localStorage.getItem(`${localPrefix}.${tableName}`);
  return raw ? JSON.parse(raw) : [];
}

function setLocalRows(tableName, rows) {
  localStorage.setItem(`${localPrefix}.${tableName}`, JSON.stringify(rows));
}

function normalizeRow(row) {
  return {
    ...row,
    $id: row.$id || row.id || ID.unique(),
    $createdAt: row.$createdAt || row.createdAt || new Date().toISOString(),
  };
}

function sanitizeData(data) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      if (value === undefined || value === null) {
        return [key, ''];
      }

      if (typeof value === 'object' && !(value instanceof File)) {
        return [key, JSON.stringify(value)];
      }

      return [key, value];
    }),
  );
}

export async function createRecord(tableName, data) {
  const rowData = sanitizeData({
    ...data,
    createdAt: new Date().toISOString(),
  });

  if (appwriteStatus.configured && config.collections[tableName]) {
    await ensureSession();
    const row = await databases.createDocument(
      config.databaseId,
      config.collections[tableName],
      ID.unique(),
      rowData,
    );
    await syncToMongo(`${tableName}.created`, row);
    return normalizeRow(row);
  }

  const localRow = normalizeRow(rowData);
  const nextRows = [localRow, ...getLocalRows(tableName)];
  setLocalRows(tableName, nextRows);
  await syncToMongo(`${tableName}.created`, localRow);
  return localRow;
}

export async function listRecent(tableName, limit = 12) {
  if (appwriteStatus.configured && config.collections[tableName]) {
    await ensureSession();
    const response = await databases.listDocuments(config.databaseId, config.collections[tableName], [
      Query.orderDesc('$createdAt'),
      Query.limit(limit),
    ]);
    return (response.documents || []).map(normalizeRow);
  }

  return getLocalRows(tableName)
    .sort((a, b) => new Date(b.$createdAt) - new Date(a.$createdAt))
    .slice(0, limit)
    .map(normalizeRow);
}

export async function uploadPrescriptionFile(file) {
  if (!file) {
    return null;
  }

  if (appwriteStatus.configured && config.bucketId) {
    await ensureSession();
    return storage.createFile(config.bucketId, ID.unique(), file);
  }

  return {
    $id: `local-file-${Date.now()}`,
    name: file.name,
    sizeOriginal: file.size,
  };
}
