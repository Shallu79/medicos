import { Account, Client, Databases, ID, Permission, Query, Role, Storage } from 'appwrite';
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
const localUserKey = `${localPrefix}.currentUser`;

export const appwriteStatus = {
  configured: Boolean(config.endpoint && config.projectId && config.databaseId),
  endpoint: config.endpoint,
  projectId: config.projectId,
  databaseId: config.databaseId,
};

export function getUserRole(user) {
  const labels = user?.labels || [];

  if (labels.includes('admin')) {
    return 'admin';
  }

  if (labels.includes('staff')) {
    return 'staff';
  }

  return 'patient';
}

export function isCareWorker(user) {
  return ['staff', 'admin'].includes(getUserRole(user));
}

export async function getCurrentUser() {
  if (!appwriteStatus.configured) {
    const raw = localStorage.getItem(localUserKey);
    return raw ? JSON.parse(raw) : null;
  }

  return account.get();
}

export async function signUpPatient({ name, email, password }) {
  if (!appwriteStatus.configured) {
    const localUser = {
      $id: `local-user-${email.toLowerCase()}`,
      name,
      email,
      prefs: { role: 'patient' },
    };
    localStorage.setItem(localUserKey, JSON.stringify(localUser));
    return localUser;
  }

  await account.create(ID.unique(), email, password, name);
  await account.createEmailPasswordSession(email, password);
  await account.updatePrefs({ role: 'patient' });
  return account.get();
}

export async function signInPatient({ email, password }) {
  if (!appwriteStatus.configured) {
    const localLabels = email.toLowerCase().includes('staff')
      ? ['staff']
      : email.toLowerCase().includes('admin')
        ? ['admin']
        : [];
    const localUser = {
      $id: `local-user-${email.toLowerCase()}`,
      name: email.split('@')[0],
      email,
      labels: localLabels,
      prefs: { role: 'patient' },
    };
    localStorage.setItem(localUserKey, JSON.stringify(localUser));
    return localUser;
  }

  await account.createEmailPasswordSession(email, password);
  return account.get();
}

export async function signOutPatient() {
  if (!appwriteStatus.configured) {
    localStorage.removeItem(localUserKey);
    return;
  }

  await account.deleteSession('current');
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

function getPrivatePermissions(userId) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.read(Role.label('staff')),
    Permission.update(Role.label('staff')),
    Permission.read(Role.label('admin')),
    Permission.update(Role.label('admin')),
  ];
}

export async function createRecord(tableName, data, currentUser) {
  if (!currentUser?.$id) {
    throw new Error('Please log in before saving medical records.');
  }

  const rowData = sanitizeData({
    ...data,
    ownerId: currentUser.$id,
    ownerRole: getUserRole(currentUser),
    createdAt: new Date().toISOString(),
  });

  if (appwriteStatus.configured && config.collections[tableName]) {
    const row = await databases.createDocument(
      config.databaseId,
      config.collections[tableName],
      ID.unique(),
      rowData,
      getPrivatePermissions(currentUser.$id),
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

export async function listRecent(tableName, currentUser, limit = 12) {
  if (!currentUser?.$id) {
    return [];
  }

  if (appwriteStatus.configured && config.collections[tableName]) {
    const queries = [Query.orderDesc('$createdAt'), Query.limit(limit)];

    if (!isCareWorker(currentUser)) {
      queries.unshift(Query.equal('ownerId', currentUser.$id));
    }

    const response = await databases.listDocuments(
      config.databaseId,
      config.collections[tableName],
      queries,
    );
    return (response.documents || []).map(normalizeRow);
  }

  const rows = isCareWorker(currentUser)
    ? getLocalRows(tableName)
    : getLocalRows(tableName).filter((row) => row.ownerId === currentUser.$id);

  return rows
    .sort((a, b) => new Date(b.$createdAt) - new Date(a.$createdAt))
    .slice(0, limit)
    .map(normalizeRow);
}

export async function uploadPrescriptionFile(file, currentUser) {
  if (!file) {
    return null;
  }

  if (!currentUser?.$id) {
    throw new Error('Please log in before uploading prescription files.');
  }

  if (appwriteStatus.configured && config.bucketId) {
    return storage.createFile(config.bucketId, ID.unique(), file, getPrivatePermissions(currentUser.$id));
  }

  return {
    $id: `local-file-${Date.now()}`,
    name: file.name,
    sizeOriginal: file.size,
  };
}
