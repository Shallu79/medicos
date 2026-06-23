# CareBridge Medicos

CareBridge Medicos is a patient-facing healthcare workflow demo for India: patient wallet, appointment token booking, medical locker, medicine availability, SOS profile, care reminders, and feedback. The app writes to Appwrite Databases when configured, and uses local browser storage only as a development fallback.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## Appwrite manual setup

1. Create an Appwrite project.
2. Add a Web platform for `localhost` while developing.
3. Create a database, for example `medicos`.
4. Create these collections in that database. Some Appwrite console versions call this layer tables; the IDs below match `.env.example`.

| Collection ID | Purpose |
| --- | --- |
| `patients` | Patient wallet and consent |
| `appointments` | Token bookings and queue status |
| `prescriptions` | Medical locker metadata |
| `medicine_requests` | Medicine search and availability requests |
| `emergency_alerts` | SOS-ready patient profile |
| `feedback` | Trust and feedback capture |

5. Add permissions for development: allow authenticated users to create and read rows. The app creates an anonymous Appwrite session before saving. For production, replace anonymous access with phone/email OTP auth and document-level permissions.
6. Create a Storage bucket with ID `prescriptions`. Allow authenticated users to create and read files during development.
7. Copy the Appwrite endpoint, project ID, database ID, collection IDs, and bucket ID into `.env`.

### Collection attributes

Use Appwrite string columns unless a different type is shown.

#### `patients`

| Column | Type | Size |
| --- | --- | --- |
| `name` | string | 120 |
| `phone` | string | 30 |
| `age` | integer | - |
| `gender` | string | 30 |
| `city` | string | 80 |
| `language` | string | 50 |
| `abhaId` | string | 80 |
| `symptoms` | string | 2000 |
| `allergies` | string | 600 |
| `chronicConditions` | string | 1000 |
| `consent` | boolean | - |
| `priority` | string | 30 |
| `createdAt` | string | 60 |

#### `appointments`

| Column | Type | Size |
| --- | --- | --- |
| `patientName` | string | 120 |
| `phone` | string | 30 |
| `department` | string | 80 |
| `mode` | string | 50 |
| `slot` | string | 80 |
| `notes` | string | 1000 |
| `token` | string | 30 |
| `status` | string | 50 |
| `priority` | string | 30 |
| `createdAt` | string | 60 |

#### `prescriptions`

| Column | Type | Size |
| --- | --- | --- |
| `patientName` | string | 120 |
| `phone` | string | 30 |
| `doctor` | string | 120 |
| `medicines` | string | 2000 |
| `notes` | string | 2000 |
| `fileName` | string | 200 |
| `fileId` | string | 80 |
| `createdAt` | string | 60 |

#### `medicine_requests`

| Column | Type | Size |
| --- | --- | --- |
| `query` | string | 160 |
| `city` | string | 80 |
| `urgency` | string | 40 |
| `genericAccepted` | boolean | - |
| `matches` | string | 3000 |
| `createdAt` | string | 60 |

#### `emergency_alerts`

| Column | Type | Size |
| --- | --- | --- |
| `patientName` | string | 120 |
| `phone` | string | 30 |
| `bloodGroup` | string | 10 |
| `location` | string | 300 |
| `note` | string | 1000 |
| `status` | string | 80 |
| `createdAt` | string | 60 |

#### `feedback`

| Column | Type | Size |
| --- | --- | --- |
| `patientName` | string | 120 |
| `rating` | integer | - |
| `category` | string | 80 |
| `comment` | string | 1200 |
| `createdAt` | string | 60 |

## MongoDB sync setup

MongoDB is optional and should not be called directly from the browser. Use the small Node service in `server/mongo-sync` to mirror Appwrite-created events into MongoDB for reporting, dashboards, exports, or BI.

```bash
cd server/mongo-sync
npm install
cp .env.example .env
npm run dev
```

Then set these in the root `.env`:

```bash
VITE_MONGO_SYNC_ENDPOINT=http://localhost:7071/sync
VITE_MONGO_SYNC_SECRET=change-this-secret
```

In `server/mongo-sync/.env`, set:

```bash
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.example.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=medicos
MONGO_SYNC_SECRET=change-this-secret
ALLOWED_ORIGIN=http://localhost:5173
```

The sync service stores events in MongoDB collection `appwrite_events`.

## Production notes

- Replace anonymous sessions with phone OTP, email OTP, or staff login before using real patient data.
- Keep Appwrite and MongoDB secrets out of the browser. Only public Appwrite project config belongs in Vite env vars.
- Add consent text that matches your clinic or hospital policy.
- Treat the triage label as queue support, not medical diagnosis.
- Review Indian healthcare data privacy obligations before storing real patient records.
