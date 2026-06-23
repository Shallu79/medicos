export const departments = [
  'General Medicine',
  'Cardiology',
  'Diabetology',
  'Gynecology',
  'Pediatrics',
  'Orthopedics',
  'Dermatology',
  'Diagnostics',
];

export const languages = [
  'English',
  'Hindi',
  'Tamil',
  'Telugu',
  'Bengali',
  'Marathi',
  'Kannada',
  'Malayalam',
  'Gujarati',
  'Punjabi',
];

export const cities = [
  'Bengaluru',
  'Chennai',
  'Delhi',
  'Hyderabad',
  'Kolkata',
  'Mumbai',
  'Pune',
  'Lucknow',
  'Jaipur',
  'Ahmedabad',
];

export const medicineInventory = [
  {
    name: 'Paracetamol 650 mg',
    generic: 'Acetaminophen',
    category: 'Fever and pain',
    price: 28,
    stock: 'High',
    pharmacy: 'Apollo Partner Desk',
    city: 'Bengaluru',
  },
  {
    name: 'Metformin 500 mg',
    generic: 'Metformin Hydrochloride',
    category: 'Diabetes',
    price: 42,
    stock: 'Medium',
    pharmacy: 'Jan Aushadhi Counter',
    city: 'Delhi',
  },
  {
    name: 'Amlodipine 5 mg',
    generic: 'Amlodipine Besylate',
    category: 'Blood pressure',
    price: 36,
    stock: 'High',
    pharmacy: 'MedPlus Pickup',
    city: 'Hyderabad',
  },
  {
    name: 'ORS Sachet',
    generic: 'Oral Rehydration Salts',
    category: 'Dehydration',
    price: 18,
    stock: 'High',
    pharmacy: 'CareBridge Kiosk',
    city: 'Chennai',
  },
  {
    name: 'Cetirizine 10 mg',
    generic: 'Cetirizine',
    category: 'Allergy',
    price: 24,
    stock: 'Medium',
    pharmacy: 'Local Verified Chemist',
    city: 'Mumbai',
  },
  {
    name: 'Azithromycin 500 mg',
    generic: 'Azithromycin',
    category: 'Antibiotic',
    price: 86,
    stock: 'Doctor approval',
    pharmacy: 'Hospital Pharmacy',
    city: 'Pune',
  },
];

export const careGaps = [
  {
    title: 'One patient wallet',
    value: 'Documents, allergies, ABHA ID, visit history, and consent in one place.',
    tag: 'Trust',
  },
  {
    title: 'Visible queue token',
    value: 'Patients can see token status, department, and expected wait before arrival.',
    tag: 'Time',
  },
  {
    title: 'Generic price compare',
    value: 'Shows available generics and nearby stock before the patient travels.',
    tag: 'Cost',
  },
  {
    title: 'Language-first care',
    value: 'Captures preferred language for consent, instructions, and follow-up.',
    tag: 'Access',
  },
  {
    title: 'Post-visit reminders',
    value: 'Follow-up, medicine, lab, and vaccination nudges are grouped by family.',
    tag: 'Continuity',
  },
  {
    title: 'SOS-ready profile',
    value: 'Blood group, chronic conditions, and emergency note are ready for the desk.',
    tag: 'Urgent',
  },
];

export const reminderPlans = [
  { title: 'Diabetes review', cadence: 'Every 30 days', owner: 'Care coordinator' },
  { title: 'BP log check', cadence: 'Every 14 days', owner: 'Nurse desk' },
  { title: 'Lab report upload', cadence: 'After test date', owner: 'Patient family' },
  { title: 'Child vaccine due', cadence: 'Age based', owner: 'Pediatrics desk' },
];
