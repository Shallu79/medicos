import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Cloud,
  Database,
  FileText,
  HeartPulse,
  IndianRupee,
  Languages,
  Lock,
  LogOut,
  MapPin,
  MessageSquare,
  Pencil,
  PhoneCall,
  Pill,
  Search,
  Send,
  ShieldCheck,
  Stethoscope,
  UploadCloud,
  Users,
  WifiOff,
} from 'lucide-react';
import './App.css';
import {
  appwriteStatus,
  createRecord,
  getCurrentUser,
  getUserRole,
  isCareWorker,
  listRecent,
  signInPatient,
  signOutPatient,
  signUpPatient,
  updateRecord,
  uploadPrescriptionFile,
} from './lib/appwrite';
import { careGaps, cities, departments, languages, medicineInventory, reminderPlans } from './lib/demoData';

const initialPatient = {
  name: '',
  phone: '',
  age: '',
  gender: 'Female',
  city: 'Bengaluru',
  language: 'Hindi',
  abhaId: '',
  symptoms: '',
  allergies: '',
  chronicConditions: '',
  consent: true,
};

const initialAppointment = {
  patientName: '',
  phone: '',
  department: 'General Medicine',
  mode: 'Clinic visit',
  slot: 'Today 5:30 PM',
  notes: '',
};

const initialPrescription = {
  patientName: '',
  phone: '',
  doctor: '',
  medicines: '',
  notes: '',
};

const initialEmergency = {
  patientName: '',
  phone: '',
  bloodGroup: 'O+',
  location: '',
  note: '',
};

const navItems = [
  { id: 'overview', patientLabel: 'Home', careLabel: 'Command', icon: Activity },
  { id: 'patient', patientLabel: 'My Health', careLabel: 'Patients', icon: Users },
  { id: 'appointments', patientLabel: 'Book Visit', careLabel: 'Tokens', icon: CalendarClock },
  { id: 'locker', patientLabel: 'Reports', careLabel: 'Locker', icon: FileText },
  { id: 'medicines', patientLabel: 'Medicines', careLabel: 'Medicines', icon: Pill },
  { id: 'emergency', patientLabel: 'SOS Card', careLabel: 'SOS', icon: PhoneCall },
  { id: 'feedback', patientLabel: 'Feedback', careLabel: 'Trust', icon: MessageSquare },
];

const emptyEditingRecords = {
  patients: null,
  appointments: null,
  prescriptions: null,
  medicineRequests: null,
  emergencyAlerts: null,
  feedback: null,
};

const tableViews = {
  patients: 'patient',
  appointments: 'appointments',
  prescriptions: 'locker',
  medicineRequests: 'medicines',
  emergencyAlerts: 'emergency',
  feedback: 'feedback',
};

const AUTHORIZED_PATH = '/authorized';

function isAuthorizedRoute() {
  if (typeof window === 'undefined') {
    return false;
  }

  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(window.location.search);

  return path === AUTHORIZED_PATH || params.get('portal') === 'authorized' || window.location.hash === '#authorized';
}

function isPortalUserAllowed(user, authorizedPortal) {
  if (!user) {
    return true;
  }

  return authorizedPortal ? isCareWorker(user) : !isCareWorker(user);
}

function getPortalAccessMessage(authorizedPortal) {
  return authorizedPortal
    ? 'Authorized access requires an owner-approved staff or admin account.'
    : 'This entrance is for patient accounts. Use the owner-issued authorized link for care team access.';
}

function asBoolean(value) {
  return value === true || value === 'true' || value === 'on';
}

function getCarePriority(symptoms = '') {
  const text = symptoms.toLowerCase();
  const critical = ['chest pain', 'breath', 'unconscious', 'stroke', 'bleeding', 'seizure'];
  const high = ['fever', 'pregnan', 'child', 'vomit', 'dizzy', 'infection', 'sugar'];

  if (critical.some((word) => text.includes(word))) {
    return {
      level: 'Urgent',
      tone: 'danger',
      note: 'Escalate to emergency or local urgent care. This is not a diagnosis.',
    };
  }

  if (high.some((word) => text.includes(word))) {
    return {
      level: 'Priority',
      tone: 'warn',
      note: 'Book a same-day doctor review when possible. This is not a diagnosis.',
    };
  }

  return {
    level: 'Routine',
    tone: 'calm',
    note: 'Suitable for normal queue planning unless symptoms change.',
  };
}

function makeToken(department) {
  const prefix = department
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
  return `${prefix}-${Math.floor(100 + Math.random() * 899)}`;
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function getHelpfulError(error) {
  if (error?.message === 'Failed to fetch') {
    return `Failed to reach Appwrite. Add "${window.location.hostname}" in Appwrite Project -> Platforms, then restart the app.`;
  }

  if (error?.message?.toLowerCase().includes('permission')) {
    return 'Appwrite permissions need setup: allow users to Create rows, and allow staff/authorized/admin/owner labels to Read and Update rows.';
  }

  return error?.message || 'Something went wrong.';
}

function App() {
  const [activeView, setActiveView] = useState('overview');
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('signin');
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [patient, setPatient] = useState(initialPatient);
  const [appointment, setAppointment] = useState(initialAppointment);
  const [prescription, setPrescription] = useState(initialPrescription);
  const [prescriptionFile, setPrescriptionFile] = useState(null);
  const [medicineSearch, setMedicineSearch] = useState({
    query: '',
    city: 'Bengaluru',
    urgency: 'Today',
    genericAccepted: true,
  });
  const [emergency, setEmergency] = useState(initialEmergency);
  const [feedback, setFeedback] = useState({
    patientName: '',
    rating: 5,
    category: 'Wait time',
    comment: '',
  });
  const [records, setRecords] = useState({
    patients: [],
    appointments: [],
    prescriptions: [],
    medicineRequests: [],
    emergencyAlerts: [],
    feedback: [],
  });
  const [editingRecords, setEditingRecords] = useState(emptyEditingRecords);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  const authorizedPortal = useMemo(() => isAuthorizedRoute(), []);
  const userRole = useMemo(() => getUserRole(currentUser), [currentUser]);
  const canManageAll = useMemo(() => isCareWorker(currentUser), [currentUser]);
  const carePriority = useMemo(() => getCarePriority(patient.symptoms), [patient.symptoms]);
  const latestPatient = records.patients[0];
  const activePatient = latestPatient || patient;

  const medicineMatches = useMemo(() => {
    const query = medicineSearch.query.toLowerCase().trim();
    return medicineInventory.filter((item) => {
      const searchable = `${item.name} ${item.generic} ${item.category}`.toLowerCase();
      const cityMatch = item.city === medicineSearch.city || item.stock === 'Doctor approval';
      return (!query || searchable.includes(query)) && cityMatch;
    });
  }, [medicineSearch]);

  const careBrief = useMemo(() => {
    const appointmentCount = records.appointments.length;
    const hasLocker = records.prescriptions.length > 0;
    const emergencyReady = records.emergencyAlerts.length > 0;
    const language = activePatient.language || patient.language;

    if (canManageAll) {
      return [
        `${records.patients.length} patient wallet record${records.patients.length === 1 ? '' : 's'} visible to your care team role.`,
        `${appointmentCount} token request${appointmentCount === 1 ? '' : 's'} available for queue management.`,
        hasLocker ? 'Prescription locker history is available for clinical review.' : 'No prescription locker records yet.',
        emergencyReady ? 'SOS profiles are ready for staff desk review.' : 'No SOS profile records yet.',
      ];
    }

    return [
      `${activePatient.name || 'New patient'} prefers ${language}.`,
      appointmentCount ? `${appointmentCount} token request stored.` : 'No token request yet.',
      hasLocker ? 'Medical locker has prescription history.' : 'Medical locker needs first upload.',
      emergencyReady ? 'SOS profile is available for desk review.' : 'SOS profile is not ready.',
    ];
  }, [activePatient, canManageAll, patient.language, records]);

  async function refreshRecords(user = currentUser) {
    if (!user) {
      setRecords({
        patients: [],
        appointments: [],
        prescriptions: [],
        medicineRequests: [],
        emergencyAlerts: [],
        feedback: [],
      });
      return;
    }

    const [
      patients,
      appointments,
      prescriptions,
      medicineRequests,
      emergencyAlerts,
      feedbackRows,
    ] = await Promise.all([
      listRecent('patients', user),
      listRecent('appointments', user),
      listRecent('prescriptions', user),
      listRecent('medicineRequests', user),
      listRecent('emergencyAlerts', user),
      listRecent('feedback', user),
    ]);

    setRecords({
      patients,
      appointments,
      prescriptions,
      medicineRequests,
      emergencyAlerts,
      feedback: feedbackRows,
    });
  }

  useEffect(() => {
    let mounted = true;

    getCurrentUser()
      .then(async (user) => {
        if (user && !isPortalUserAllowed(user, authorizedPortal)) {
          await signOutPatient();
          if (mounted) {
            setCurrentUser(null);
            setToast(getPortalAccessMessage(authorizedPortal));
          }
          return;
        }

        if (mounted) {
          setCurrentUser(user);
        }
      })
      .catch(() => {
        if (mounted) {
          setCurrentUser(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setAuthLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [authorizedPortal]);

  useEffect(() => {
    if (!currentUser) {
      refreshRecords(null);
      return;
    }

    refreshRecords(currentUser).catch((error) => {
      console.warn(error);
      setToast(getHelpfulError(error));
    });
  }, [currentUser]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function patchState(setter) {
    return (event) => {
      const { name, type, checked, value } = event.target;
      setter((current) => ({
        ...current,
        [name]: type === 'checkbox' ? checked : value,
      }));
    };
  }

  function handlePortalChange(nextAuthorizedPortal) {
    if (nextAuthorizedPortal === authorizedPortal) {
      return;
    }

    window.location.assign(nextAuthorizedPortal ? AUTHORIZED_PATH : '/');
  }

  function clearEditingRecord(tableName) {
    setEditingRecords((current) => ({
      ...current,
      [tableName]: null,
    }));
  }

  function beginEditRecord(tableName, row) {
    if (!canManageAll) {
      return;
    }

    setEditingRecords((current) => ({
      ...current,
      [tableName]: row,
    }));

    if (tableViews[tableName]) {
      setActiveView(tableViews[tableName]);
    }

    if (tableName === 'patients') {
      setPatient({
        name: row.name || '',
        phone: row.phone || '',
        age: row.age || '',
        gender: row.gender || 'Female',
        city: row.city || 'Bengaluru',
        language: row.language || 'Hindi',
        abhaId: row.abhaId || '',
        symptoms: row.symptoms || '',
        allergies: row.allergies || '',
        chronicConditions: row.chronicConditions || '',
        consent: asBoolean(row.consent),
      });
    }

    if (tableName === 'appointments') {
      setAppointment({
        patientName: row.patientName || '',
        phone: row.phone || '',
        department: row.department || 'General Medicine',
        mode: row.mode || 'Clinic visit',
        slot: row.slot || '',
        notes: row.notes || '',
      });
    }

    if (tableName === 'prescriptions') {
      setPrescription({
        patientName: row.patientName || '',
        phone: row.phone || '',
        doctor: row.doctor || '',
        medicines: row.medicines || '',
        notes: row.notes || '',
      });
      setPrescriptionFile(null);
    }

    if (tableName === 'medicineRequests') {
      setMedicineSearch({
        query: row.query || '',
        city: row.city || 'Bengaluru',
        urgency: row.urgency || 'Today',
        genericAccepted: asBoolean(row.genericAccepted),
      });
    }

    if (tableName === 'emergencyAlerts') {
      setEmergency({
        patientName: row.patientName || '',
        phone: row.phone || '',
        bloodGroup: row.bloodGroup || 'O+',
        location: row.location || '',
        note: row.note || '',
      });
    }

    if (tableName === 'feedback') {
      setFeedback({
        patientName: row.patientName || '',
        rating: row.rating || 5,
        category: row.category || 'Wait time',
        comment: row.comment || '',
      });
    }

    setToast('Record ready to edit.');
  }

  async function saveWithToast(work, message) {
    setSaving(true);
    try {
      await work();
      await refreshRecords();
      setToast(message);
    } catch (error) {
      console.error(error);
      setToast(getHelpfulError(error));
    } finally {
      setSaving(false);
    }
  }

  async function saveRecord(tableName, data, createMessage, updateMessage) {
    const editingRow = editingRecords[tableName];

    await saveWithToast(async () => {
      if (editingRow?.$id) {
        await updateRecord(tableName, editingRow.$id, data, currentUser);
        clearEditingRecord(tableName);
        return;
      }

      await createRecord(tableName, data, currentUser);
    }, editingRow ? updateMessage : createMessage);
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const isSignup = authMode === 'signup' && !authorizedPortal;
      const authAction = isSignup ? signUpPatient : signInPatient;
      const user = await authAction(authForm);

      if (!isPortalUserAllowed(user, authorizedPortal)) {
        await signOutPatient();
        setCurrentUser(null);
        setToast(getPortalAccessMessage(authorizedPortal));
        return;
      }

      setCurrentUser(user);
      setToast(
        isSignup
          ? 'Patient account created.'
          : authorizedPortal
            ? 'Authorized workspace opened.'
            : 'Patient login successful.',
      );
    } catch (error) {
      console.error(error);
      setToast(getHelpfulError(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSaving(true);

    try {
      await signOutPatient();
      setCurrentUser(null);
      setActiveView('overview');
      setToast('Logged out.');
    } catch (error) {
      console.error(error);
      setToast('Logout failed.');
    } finally {
      setSaving(false);
    }
  }

  function hydrateFromPatient() {
    const name = patient.name || activePatient.name || '';
    const phone = patient.phone || activePatient.phone || '';
    setAppointment((current) => ({ ...current, patientName: name, phone }));
    setPrescription((current) => ({ ...current, patientName: name, phone }));
    setEmergency((current) => ({ ...current, patientName: name, phone }));
    setFeedback((current) => ({ ...current, patientName: name }));
  }

  async function handlePatientSubmit(event) {
    event.preventDefault();

    if (!patient.consent) {
      setToast('Consent is required before saving patient data.');
      return;
    }

    await saveRecord(
      'patients',
      {
        ...patient,
        age: Number(patient.age || 0),
        priority: carePriority.level,
      },
      'Patient wallet saved.',
      'Patient wallet updated.',
    );
    hydrateFromPatient();
  }

  async function handleAppointmentSubmit(event) {
    event.preventDefault();
    const priority = getCarePriority(patient.symptoms);
    const editingAppointment = editingRecords.appointments;
    await saveRecord(
      'appointments',
      {
        ...appointment,
        patientName: appointment.patientName || patient.name,
        phone: appointment.phone || patient.phone,
        token: editingAppointment?.token || makeToken(appointment.department),
        status: editingAppointment?.status || 'Booked',
        priority: priority.level,
      },
      'Care token booked.',
      'Care token updated.',
    );
  }

  async function handlePrescriptionSubmit(event) {
    event.preventDefault();
    const editingPrescription = editingRecords.prescriptions;
    await saveWithToast(async () => {
      const uploadedFile = prescriptionFile
        ? await uploadPrescriptionFile(prescriptionFile, currentUser)
        : null;
      const data = {
        ...prescription,
        patientName: prescription.patientName || patient.name,
        phone: prescription.phone || patient.phone,
        fileName: prescriptionFile?.name || editingPrescription?.fileName || '',
        fileId: uploadedFile?.$id || editingPrescription?.fileId || '',
      };

      if (editingPrescription?.$id) {
        await updateRecord('prescriptions', editingPrescription.$id, data, currentUser);
        clearEditingRecord('prescriptions');
      } else {
        await createRecord('prescriptions', data, currentUser);
      }
      setPrescriptionFile(null);
    }, editingPrescription ? 'Medical locker record updated.' : 'Medical locker updated.');
  }

  async function handleMedicineSubmit(event) {
    event.preventDefault();
    await saveRecord(
      'medicineRequests',
      {
        ...medicineSearch,
        matches: JSON.stringify(
          medicineMatches.slice(0, 4).map((item) => ({
            name: item.name,
            generic: item.generic,
            price: item.price,
            pharmacy: item.pharmacy,
            stock: item.stock,
          })),
        ),
      },
      'Medicine request saved.',
      'Medicine request updated.',
    );
  }

  async function handleEmergencySubmit(event) {
    event.preventDefault();
    const editingEmergency = editingRecords.emergencyAlerts;
    await saveRecord(
      'emergencyAlerts',
      {
        ...emergency,
        patientName: emergency.patientName || patient.name,
        phone: emergency.phone || patient.phone,
        status: editingEmergency?.status || 'Ready for care desk',
      },
      'SOS profile saved.',
      'SOS profile updated.',
    );
  }

  async function handleFeedbackSubmit(event) {
    event.preventDefault();
    await saveRecord(
      'feedback',
      {
        ...feedback,
        rating: Number(feedback.rating),
      },
      'Feedback captured.',
      'Feedback updated.',
    );
  }

  if (authLoading) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand auth-brand">
            <div className="brand-mark">
              <HeartPulse size={24} />
            </div>
            <div>
              <h1>CareBridge</h1>
              <span>Loading secure patient portal</span>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    return (
      <>
        <AuthGate
          authForm={authForm}
          authMode={authMode}
          authorizedPortal={authorizedPortal}
          onChange={patchState(setAuthForm)}
          onModeChange={setAuthMode}
          onPortalChange={handlePortalChange}
          onSubmit={handleAuthSubmit}
          saving={saving}
        />
        {toast && <div className="toast">{toast}</div>}
      </>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <HeartPulse size={24} />
          </div>
          <div>
            <h1>CareBridge</h1>
            <span>Medicos India</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="CareBridge sections">
          {navItems.map((item) => {
            const Icon = item.icon;
            const label = canManageAll ? item.careLabel : item.patientLabel;
            return (
              <button
                className={activeView === item.id ? 'nav-item active' : 'nav-item'}
                key={item.id}
                type="button"
                title={label}
                onClick={() => setActiveView(item.id)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="connection-card">
          {appwriteStatus.configured ? <Cloud size={18} /> : <WifiOff size={18} />}
          <div>
            <strong>{appwriteStatus.configured ? 'Appwrite live' : 'Demo storage'}</strong>
            <span>
              {appwriteStatus.configured
                ? canManageAll
                  ? 'Care team access'
                  : 'Private patient rows'
                : 'Local private demo'}
            </span>
          </div>
        </div>

        <div className="authority-card">
          {canManageAll ? <ShieldCheck size={18} /> : <Lock size={18} />}
          <div>
            <strong>{currentUser.name || (canManageAll ? 'Authorized account' : 'Patient account')}</strong>
            <span>{userRole === 'admin' ? 'Owner/admin' : canManageAll ? 'Authorized staff' : 'Patient'} | {currentUser.email || 'Signed in locally'}</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{canManageAll ? 'Authorized clinic workspace' : 'Private patient portal'}</p>
            <h2>
              {canManageAll
                ? 'Review and update every patient record from one controlled workspace.'
                : 'Your health profile, visits, reports, medicines, SOS card, and feedback.'}
            </h2>
          </div>
          <div className="top-actions">
            <button type="button" className="icon-button" title="Use latest patient" onClick={hydrateFromPatient}>
              <Users size={18} />
            </button>
            <button type="button" className="primary-button" onClick={() => setActiveView('patient')}>
              <ShieldCheck size={18} />
              {canManageAll ? 'Add patient' : 'My health profile'}
            </button>
            <button type="button" className="icon-button" title="Log out" onClick={handleSignOut} disabled={saving}>
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <section className="metric-grid" aria-label="Care metrics">
          <Metric label={canManageAll ? 'Patient records' : 'My profiles'} value={records.patients.length} icon={Users} tone="teal" />
          <Metric label={canManageAll ? 'Queue tokens' : 'My visits'} value={records.appointments.length} icon={CalendarClock} tone="blue" />
          <Metric label={canManageAll ? 'Locker files' : 'My reports'} value={records.prescriptions.length} icon={FileText} tone="amber" />
          <Metric label={canManageAll ? 'SOS profiles' : 'SOS cards'} value={records.emergencyAlerts.length} icon={PhoneCall} tone="rose" />
        </section>

        {activeView === 'overview' && (
          <section className="view-grid">
            <Panel title={canManageAll ? 'Care Brief' : 'My Care Brief'} icon={Stethoscope}>
              <div className="brief-list">
                {careBrief.map((item) => (
                  <div className="brief-item" key={item}>
                    <CheckCircle2 size={18} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className={`priority-strip ${carePriority.tone}`}>
                <AlertTriangle size={18} />
                <div>
                  <strong>{carePriority.level} triage</strong>
                  <span>{carePriority.note}</span>
                </div>
              </div>
            </Panel>

            <Panel title={canManageAll ? 'Care Map' : 'Visit Map'} icon={MapPin}>
              <div className="care-map">
                <div className="map-station main">Clinic desk</div>
                <div className="map-station lab">Diagnostics</div>
                <div className="map-station pharmacy">Medicine</div>
                <div className="map-station follow">Follow-up</div>
              </div>
              <div className="route-list">
                <span>Check-in</span>
                <span>Token</span>
                <span>Doctor</span>
                <span>Pharmacy</span>
              </div>
            </Panel>

            <Panel title={canManageAll ? 'Experience Gaps Solved' : 'What You Can Do Here'} icon={Database} wide>
              <div className="gap-grid">
                {careGaps.map((gap) => (
                  <article className="gap-item" key={gap.title}>
                    <span>{gap.tag}</span>
                    <h3>{gap.title}</h3>
                    <p>{gap.value}</p>
                  </article>
                ))}
              </div>
            </Panel>

            <Panel title={canManageAll ? 'Continuity Plan' : 'My Follow-Up Plan'} icon={BellRing} wide>
              <div className="reminder-grid">
                {reminderPlans.map((plan) => (
                  <div className="reminder-row" key={plan.title}>
                    <div>
                      <strong>{plan.title}</strong>
                      <span>{plan.owner}</span>
                    </div>
                    <b>{plan.cadence}</b>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title={canManageAll ? 'Authorized Access' : 'Privacy Model'} icon={Lock} wide>
              <div className="authority-grid">
                {canManageAll ? (
                  <>
                    <div className="authority-item">
                      <strong>Patient accounts</strong>
                      <span>Each patient account can only load rows where its own account is the owner.</span>
                    </div>
                    <div className="authority-item">
                      <strong>Authorized accounts</strong>
                      <span>Accounts labeled staff or authorized enter through the authorized link and can review all patient rows.</span>
                    </div>
                    <div className="authority-item">
                      <strong>Owner accounts</strong>
                      <span>Accounts labeled admin or owner use the same authorized link with full operational access.</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="authority-item">
                      <strong>Your account</strong>
                      <span>This portal loads only medical rows owned by your login.</span>
                    </div>
                    <div className="authority-item">
                      <strong>Other patients</strong>
                      <span>Other patient accounts cannot open your wallet, token, locker, SOS, or feedback rows.</span>
                    </div>
                    <div className="authority-item">
                      <strong>Clinic team</strong>
                      <span>Owner-approved clinic accounts use a separate authorized link for care coordination.</span>
                    </div>
                  </>
                )}
              </div>
            </Panel>
          </section>
        )}

        {activeView === 'patient' && (
          <section className="two-column">
            <Panel title={canManageAll ? 'Patient Wallet' : 'My Health Profile'} icon={Users}>
              <form className="form-grid" onSubmit={handlePatientSubmit}>
                <TextField label="Full name" name="name" value={patient.name} onChange={patchState(setPatient)} required />
                <TextField label="Mobile number" name="phone" value={patient.phone} onChange={patchState(setPatient)} required />
                <TextField label="Age" name="age" value={patient.age} type="number" onChange={patchState(setPatient)} />
                <SelectField label="Gender" name="gender" value={patient.gender} onChange={patchState(setPatient)} options={['Female', 'Male', 'Other']} />
                <SelectField label="City" name="city" value={patient.city} onChange={patchState(setPatient)} options={cities} />
                <SelectField label="Language" name="language" value={patient.language} onChange={patchState(setPatient)} options={languages} />
                <TextField label="ABHA ID" name="abhaId" value={patient.abhaId} onChange={patchState(setPatient)} />
                <TextField label="Allergies" name="allergies" value={patient.allergies} onChange={patchState(setPatient)} />
                <label className="field full">
                  <span>Symptoms or concern</span>
                  <textarea name="symptoms" value={patient.symptoms} onChange={patchState(setPatient)} rows="4" required />
                </label>
                <label className="field full">
                  <span>Chronic conditions</span>
                  <textarea name="chronicConditions" value={patient.chronicConditions} onChange={patchState(setPatient)} rows="3" />
                </label>
                <label className="check-row full">
                  <input name="consent" type="checkbox" checked={patient.consent} onChange={patchState(setPatient)} />
                  <span>Patient consent received for digital storage and care coordination.</span>
                </label>
                <button className="primary-button full" type="submit" disabled={saving}>
                  <ShieldCheck size={18} />
                  {editingRecords.patients
                    ? 'Update patient wallet'
                    : canManageAll ? 'Save patient wallet' : 'Save my health profile'}
                </button>
                {editingRecords.patients && (
                  <button className="secondary-button full" type="button" onClick={() => clearEditingRecord('patients')}>
                    Cancel edit
                  </button>
                )}
              </form>
            </Panel>

            <Panel title={canManageAll ? 'All Patients' : 'My Saved Profile'} icon={Activity}>
              <RecordList
                empty={canManageAll ? 'No patient wallets yet.' : 'No health profile saved yet.'}
                rows={records.patients}
                onEdit={canManageAll ? (row) => beginEditRecord('patients', row) : null}
                render={(row) => (
                  <>
                    <strong>{row.name || 'Unnamed patient'}</strong>
                    <span>{row.city} | {row.language} | {row.priority || 'Routine'}</span>
                  </>
                )}
              />
            </Panel>
          </section>
        )}

        {activeView === 'appointments' && (
          <section className="two-column">
            <Panel title={canManageAll ? 'Token Booking' : 'Book My Visit'} icon={CalendarClock}>
              <form className="form-grid" onSubmit={handleAppointmentSubmit}>
                <TextField label="Patient name" name="patientName" value={appointment.patientName} onChange={patchState(setAppointment)} required />
                <TextField label="Mobile number" name="phone" value={appointment.phone} onChange={patchState(setAppointment)} required />
                <SelectField label="Department" name="department" value={appointment.department} onChange={patchState(setAppointment)} options={departments} />
                <SelectField label="Mode" name="mode" value={appointment.mode} onChange={patchState(setAppointment)} options={['Clinic visit', 'Teleconsult', 'Home sample', 'Second opinion']} />
                <TextField label="Preferred slot" name="slot" value={appointment.slot} onChange={patchState(setAppointment)} />
                <label className="field full">
                  <span>Notes for desk</span>
                  <textarea name="notes" value={appointment.notes} onChange={patchState(setAppointment)} rows="3" />
                </label>
                <button className="primary-button full" type="submit" disabled={saving}>
                  <CalendarClock size={18} />
                  {editingRecords.appointments ? 'Update token' : canManageAll ? 'Book token' : 'Book my visit'}
                </button>
                {editingRecords.appointments && (
                  <button className="secondary-button full" type="button" onClick={() => clearEditingRecord('appointments')}>
                    Cancel edit
                  </button>
                )}
              </form>
            </Panel>

            <Panel title={canManageAll ? 'Recent Tokens' : 'My Visits'} icon={Activity}>
              <RecordList
                empty={canManageAll ? 'No token requests yet.' : 'No visits booked yet.'}
                rows={records.appointments}
                onEdit={canManageAll ? (row) => beginEditRecord('appointments', row) : null}
                render={(row) => (
                  <>
                    <strong>{row.token || 'Token pending'} | {row.department}</strong>
                    <span>{row.patientName} | {row.slot} | {row.mode}</span>
                  </>
                )}
              />
            </Panel>
          </section>
        )}

        {activeView === 'locker' && (
          <section className="two-column">
            <Panel title={canManageAll ? 'Medical Locker' : 'My Reports'} icon={FileText}>
              <form className="form-grid" onSubmit={handlePrescriptionSubmit}>
                <TextField label="Patient name" name="patientName" value={prescription.patientName} onChange={patchState(setPrescription)} required />
                <TextField label="Mobile number" name="phone" value={prescription.phone} onChange={patchState(setPrescription)} required />
                <TextField label="Doctor or clinic" name="doctor" value={prescription.doctor} onChange={patchState(setPrescription)} />
                <label className="field upload-field">
                  <span>Prescription file</span>
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setPrescriptionFile(event.target.files?.[0] || null)} />
                </label>
                <label className="field full">
                  <span>Medicines listed</span>
                  <textarea name="medicines" value={prescription.medicines} onChange={patchState(setPrescription)} rows="3" />
                </label>
                <label className="field full">
                  <span>Care instructions</span>
                  <textarea name="notes" value={prescription.notes} onChange={patchState(setPrescription)} rows="3" />
                </label>
                <button className="primary-button full" type="submit" disabled={saving}>
                  <UploadCloud size={18} />
                  {editingRecords.prescriptions ? 'Update locker record' : canManageAll ? 'Save to locker' : 'Save my report'}
                </button>
                {editingRecords.prescriptions && (
                  <button className="secondary-button full" type="button" onClick={() => clearEditingRecord('prescriptions')}>
                    Cancel edit
                  </button>
                )}
              </form>
            </Panel>

            <Panel title={canManageAll ? 'Locker History' : 'My Report History'} icon={FileText}>
              <RecordList
                empty={canManageAll ? 'No locker files yet.' : 'No reports saved yet.'}
                rows={records.prescriptions}
                onEdit={canManageAll ? (row) => beginEditRecord('prescriptions', row) : null}
                render={(row) => (
                  <>
                    <strong>{row.fileName || 'Prescription note'}</strong>
                    <span>{row.patientName} | {row.doctor || 'Doctor not set'}</span>
                  </>
                )}
              />
            </Panel>
          </section>
        )}

        {activeView === 'medicines' && (
          <section className="two-column">
            <Panel title={canManageAll ? 'Medicine Finder' : 'Find My Medicines'} icon={Pill}>
              <form className="form-grid" onSubmit={handleMedicineSubmit}>
                <TextField label="Medicine or condition" name="query" value={medicineSearch.query} onChange={patchState(setMedicineSearch)} />
                <SelectField label="City" name="city" value={medicineSearch.city} onChange={patchState(setMedicineSearch)} options={cities} />
                <SelectField label="Need by" name="urgency" value={medicineSearch.urgency} onChange={patchState(setMedicineSearch)} options={['Now', 'Today', 'This week']} />
                <label className="check-row">
                  <input name="genericAccepted" type="checkbox" checked={medicineSearch.genericAccepted} onChange={patchState(setMedicineSearch)} />
                  <span>Show generic options.</span>
                </label>
                <button className="primary-button full" type="submit" disabled={saving}>
                  <Search size={18} />
                  {editingRecords.medicineRequests ? 'Update request' : canManageAll ? 'Save request' : 'Save my medicine request'}
                </button>
                {editingRecords.medicineRequests && (
                  <button className="secondary-button full" type="button" onClick={() => clearEditingRecord('medicineRequests')}>
                    Cancel edit
                  </button>
                )}
              </form>
              <div className="medicine-list">
                {medicineMatches.length ? (
                  medicineMatches.map((item) => (
                    <div className="medicine-row" key={`${item.name}-${item.city}`}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.generic} | {item.pharmacy}</span>
                      </div>
                      <div className="price-chip">
                        <IndianRupee size={16} />
                        {formatMoney(item.price)}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="empty-copy">No matching medicine stock in the sample list.</p>
                )}
              </div>
            </Panel>

            <Panel title={canManageAll ? 'Saved Requests' : 'My Medicine Requests'} icon={Pill}>
              <RecordList
                empty={canManageAll ? 'No medicine requests yet.' : 'No medicine requests saved yet.'}
                rows={records.medicineRequests}
                onEdit={canManageAll ? (row) => beginEditRecord('medicineRequests', row) : null}
                render={(row) => (
                  <>
                    <strong>{row.query || 'Medicine request'}</strong>
                    <span>{row.city} | {row.urgency}</span>
                  </>
                )}
              />
            </Panel>
          </section>
        )}

        {activeView === 'emergency' && (
          <section className="two-column">
            <Panel title={canManageAll ? 'SOS Profile' : 'My SOS Card'} icon={PhoneCall}>
              <form className="form-grid" onSubmit={handleEmergencySubmit}>
                <TextField label="Patient name" name="patientName" value={emergency.patientName} onChange={patchState(setEmergency)} required />
                <TextField label="Mobile number" name="phone" value={emergency.phone} onChange={patchState(setEmergency)} required />
                <SelectField label="Blood group" name="bloodGroup" value={emergency.bloodGroup} onChange={patchState(setEmergency)} options={['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']} />
                <TextField label="Location or landmark" name="location" value={emergency.location} onChange={patchState(setEmergency)} required />
                <label className="field full">
                  <span>Emergency note</span>
                  <textarea name="note" value={emergency.note} onChange={patchState(setEmergency)} rows="4" />
                </label>
                <div className="safety-note full">
                  <AlertTriangle size={18} />
                  <span>For real emergencies, contact local emergency services immediately.</span>
                </div>
                <button className="danger-button full" type="submit" disabled={saving}>
                  <PhoneCall size={18} />
                  {editingRecords.emergencyAlerts ? 'Update SOS profile' : canManageAll ? 'Save SOS profile' : 'Save my SOS card'}
                </button>
                {editingRecords.emergencyAlerts && (
                  <button className="secondary-button full" type="button" onClick={() => clearEditingRecord('emergencyAlerts')}>
                    Cancel edit
                  </button>
                )}
              </form>
            </Panel>

            <Panel title={canManageAll ? 'Ready Profiles' : 'My SOS History'} icon={Activity}>
              <RecordList
                empty={canManageAll ? 'No SOS profiles yet.' : 'No SOS card saved yet.'}
                rows={records.emergencyAlerts}
                onEdit={canManageAll ? (row) => beginEditRecord('emergencyAlerts', row) : null}
                render={(row) => (
                  <>
                    <strong>{row.patientName} | {row.bloodGroup}</strong>
                    <span>{row.location} | {row.status}</span>
                  </>
                )}
              />
            </Panel>
          </section>
        )}

        {activeView === 'feedback' && (
          <section className="two-column">
            <Panel title={canManageAll ? 'Trust Capture' : 'My Feedback'} icon={MessageSquare}>
              <form className="form-grid" onSubmit={handleFeedbackSubmit}>
                <TextField label="Patient name" name="patientName" value={feedback.patientName} onChange={patchState(setFeedback)} required />
                <SelectField label="Category" name="category" value={feedback.category} onChange={patchState(setFeedback)} options={['Wait time', 'Doctor clarity', 'Medicine cost', 'Cleanliness', 'Follow-up']} />
                <label className="field">
                  <span>Rating</span>
                  <input name="rating" type="range" min="1" max="5" value={feedback.rating} onChange={patchState(setFeedback)} />
                  <b>{feedback.rating}/5</b>
                </label>
                <label className="field full">
                  <span>Comment</span>
                  <textarea name="comment" value={feedback.comment} onChange={patchState(setFeedback)} rows="4" />
                </label>
                <button className="primary-button full" type="submit" disabled={saving}>
                  <Send size={18} />
                  {editingRecords.feedback ? 'Update feedback' : canManageAll ? 'Save feedback' : 'Send my feedback'}
                </button>
                {editingRecords.feedback && (
                  <button className="secondary-button full" type="button" onClick={() => clearEditingRecord('feedback')}>
                    Cancel edit
                  </button>
                )}
              </form>
            </Panel>

            <Panel title={canManageAll ? 'Patient Voice' : 'My Feedback History'} icon={Languages}>
              <RecordList
                empty={canManageAll ? 'No feedback yet.' : 'No feedback sent yet.'}
                rows={records.feedback}
                onEdit={canManageAll ? (row) => beginEditRecord('feedback', row) : null}
                render={(row) => (
                  <>
                    <strong>{row.rating}/5 | {row.category}</strong>
                    <span>{row.patientName} | {row.comment || 'No comment'}</span>
                  </>
                )}
              />
            </Panel>
          </section>
        )}
      </section>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function AuthGate({
  authForm,
  authMode,
  authorizedPortal,
  onChange,
  onModeChange,
  onPortalChange,
  onSubmit,
  saving,
}) {
  const isSignup = authMode === 'signup' && !authorizedPortal;
  const authPoints = authorizedPortal
    ? [
        { icon: ShieldCheck, copy: 'Only owner-created email/password accounts enter here.' },
        { icon: Lock, copy: 'Only labeled accounts can open the clinic-wide workspace.' },
        { icon: Users, copy: 'Approved users can review patient records for care coordination.' },
      ]
    : [
        { icon: Lock, copy: 'Your login opens only your saved medical records.' },
        { icon: CalendarClock, copy: 'Tokens and prescriptions stay tied to your account.' },
        { icon: ShieldCheck, copy: 'Consent is saved with your private medical wallet.' },
      ];

  return (
    <main className="auth-shell">
      <section className="auth-layout">
        <div className="auth-copy">
          <div className="brand auth-brand">
            <div className="brand-mark">
              <HeartPulse size={24} />
            </div>
            <div>
              <h1>CareBridge</h1>
              <span>Medicos India</span>
            </div>
          </div>
          <p className="eyebrow">{authorizedPortal ? 'Owner-issued access' : 'Secure healthcare access'}</p>
          <h2>{authorizedPortal ? 'Authorized care team workspace.' : 'Your private medical wallet starts here.'}</h2>
          <div className="auth-points">
            {authPoints.map(({ icon: Icon, copy }) => (
              <div key={copy}>
                <Icon size={18} />
                <span>{copy}</span>
              </div>
            ))}
          </div>
        </div>

        <form className="auth-card" onSubmit={onSubmit}>
          <div className="portal-switch" aria-label="Choose access type">
            <span>Who are you?</span>
            <div>
              <button
                className={authorizedPortal ? 'portal-option' : 'portal-option active'}
                type="button"
                onClick={() => onPortalChange(false)}
              >
                <Users size={17} />
                Patient
              </button>
              <button
                className={authorizedPortal ? 'portal-option active' : 'portal-option'}
                type="button"
                onClick={() => onPortalChange(true)}
              >
                <ShieldCheck size={17} />
                Authorized
              </button>
            </div>
          </div>

          {authorizedPortal ? (
            <div className="auth-badge">
              <ShieldCheck size={18} />
              <span>Authorized entrance</span>
            </div>
          ) : (
            <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
              <button
                className={authMode === 'signin' ? 'auth-tab active' : 'auth-tab'}
                type="button"
                onClick={() => onModeChange('signin')}
              >
                Login
              </button>
              <button
                className={authMode === 'signup' ? 'auth-tab active' : 'auth-tab'}
                type="button"
                onClick={() => onModeChange('signup')}
              >
                Create account
              </button>
            </div>
          )}

          {isSignup && (
            <label className="field">
              <span>Full name</span>
              <input name="name" value={authForm.name} onChange={onChange} required />
            </label>
          )}

          <label className="field">
            <span>Email</span>
            <input name="email" type="email" value={authForm.email} onChange={onChange} required />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              name="password"
              type="password"
              value={authForm.password}
              minLength="8"
              onChange={onChange}
              required
            />
          </label>

          <button className="primary-button full" type="submit" disabled={saving}>
            <Lock size={18} />
            {authorizedPortal ? 'Open authorized workspace' : isSignup ? 'Create account' : 'Login'}
          </button>

          {authorizedPortal ? (
            <p className="auth-hint">
              Create this user in Appwrite Auth, then add label staff, authorized, admin, or owner.
            </p>
          ) : (
            <p className="auth-hint">
              New here? Create an account to keep your records private.
            </p>
          )}
        </form>
      </section>
    </main>
  );
}

function Metric({ label, value, icon: Icon, tone }) {
  return (
    <article className={`metric ${tone}`}>
      <Icon size={20} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function Panel({ title, icon: Icon, children, wide = false }) {
  return (
    <section className={wide ? 'panel wide' : 'panel'}>
      <div className="panel-heading">
        <div>
          <Icon size={19} />
          <h3>{title}</h3>
        </div>
      </div>
      {children}
    </section>
  );
}

function TextField({ label, name, value, onChange, type = 'text', required = false }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} type={type} value={value} onChange={onChange} required={required} />
    </label>
  );
}

function SelectField({ label, name, value, onChange, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} value={value} onChange={onChange}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function RecordList({ rows, render, empty, onEdit }) {
  if (!rows.length) {
    return <p className="empty-copy">{empty}</p>;
  }

  return (
    <div className="record-list">
      {rows.map((row) => (
        <div className="record-row" key={row.$id}>
          <div className="record-main">
            {render(row)}
          </div>
          {onEdit && (
            <button className="secondary-button record-action" type="button" onClick={() => onEdit(row)}>
              <Pencil size={15} />
              Edit
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default App;
