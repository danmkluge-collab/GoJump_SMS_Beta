require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:4000';
// QR codes link to the React client, not the API server
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const QR_DIR = path.join(__dirname, '../public/qr');

const LOCATIONS = [
  { name: 'GoJump Oceanside',  slug: 'oceanside',  timezone: 'America/Los_Angeles', address: 'Oceanside, CA' },
  { name: 'GoJump Hawaii',     slug: 'hawaii',     timezone: 'Pacific/Honolulu',    address: 'Oahu, HI' },
  { name: 'GoJump Las Vegas',  slug: 'las-vegas',  timezone: 'America/Los_Angeles', address: 'Las Vegas, NV' },
  { name: 'GoJump New York',   slug: 'new-york',   timezone: 'America/New_York',    address: 'New York, NY' },
];

async function generateQR(slug) {
  if (!fs.existsSync(QR_DIR)) fs.mkdirSync(QR_DIR, { recursive: true });
  const url = `${CLIENT_URL}/report?location=${slug}`;
  const filePath = path.join(QR_DIR, `${slug}.png`);
  await QRCode.toFile(filePath, url, { width: 400, margin: 2 });
  console.log(`  QR saved: ${filePath}`);
  return `/public/qr/${slug}.png`;
}

async function main() {
  console.log('🌱 Seeding GoJump SMS database...\n');

  const locationRecords = {};
  for (const loc of LOCATIONS) {
    let record = await prisma.location.findUnique({ where: { slug: loc.slug } });
    if (!record) {
      record = await prisma.location.create({ data: loc });
    }
    const qrCodeUrl = await generateQR(loc.slug);
    await prisma.location.update({ where: { id: record.id }, data: { qrCodeUrl } });
    locationRecords[loc.slug] = record;
    console.log(`  ✓ Location: ${loc.name}`);
  }

  const oceanside = locationRecords['oceanside'];
  const hawaii    = locationRecords['hawaii'];
  const lasVegas  = locationRecords['las-vegas'];
  const newYork   = locationRecords['new-york'];

  const pw = await bcrypt.hash('GoJump2024!', 12);

  const usersData = [
    { name: 'Admin User',            email: 'admin@gojumpamerica.com',     role: 'admin',  locationId: null },
    { name: 'Alex Chen (S&TA)',      email: 'sta.oceanside@gojump.com',    role: 's_ta',   locationId: oceanside.id },
    { name: 'Jordan Lee (Staff)',    email: 'staff.oceanside@gojump.com',  role: 'staff',  locationId: oceanside.id },
    { name: 'Malia Fonoti (S&TA)',   email: 'sta.hawaii@gojump.com',       role: 's_ta',   locationId: hawaii.id },
    { name: 'Kai Nakamura (Staff)',  email: 'staff.hawaii@gojump.com',     role: 'staff',  locationId: hawaii.id },
    { name: 'Ryan Torres (S&TA)',    email: 'sta.lasvegas@gojump.com',     role: 's_ta',   locationId: lasVegas.id },
    { name: 'Sam Rivera (Staff)',    email: 'staff.lasvegas@gojump.com',   role: 'staff',  locationId: lasVegas.id },
    { name: 'Jamie Park (S&TA)',     email: 'sta.newyork@gojump.com',      role: 's_ta',   locationId: newYork.id },
    { name: 'Drew Walsh (Staff)',    email: 'staff.newyork@gojump.com',    role: 'staff',  locationId: newYork.id },
  ];

  const userRecords = {};
  for (const u of usersData) {
    let user = await prisma.user.findUnique({ where: { email: u.email } });
    if (!user) {
      user = await prisma.user.create({ data: { ...u, passwordHash: pw } });
    }
    userRecords[u.email] = user;
    console.log(`  ✓ User: ${u.name} [${u.role}]`);
  }

  // §5.25 — Designate Admin as Accountable Executive
  const adminUser = userRecords['admin@gojumpamerica.com'];
  await prisma.user.update({
    where: { id: adminUser.id },
    data: {
      isAccountableExecutive: true,
      aeAuthorityStatement: 'As Accountable Executive, I hold final authority and accountability for the implementation and maintenance of the GoJump America Safety Management System across all locations. I am responsible for ensuring adequate resources are allocated for safety, and I accept ultimate responsibility for the effectiveness of the SMS in accordance with 14 CFR Part 5.',
    },
  });

  const aeDesignationDate = new Date('2024-01-01');
  for (const loc of [oceanside, hawaii, lasVegas, newYork]) {
    await prisma.location.update({
      where: { id: loc.id },
      data: {
        accountableExecutiveUserId: adminUser.id,
        aeDesignationDate,
        aeDesignationDocumentUrl: '/documents/ae-designation-2024.pdf',
      },
    });
  }
  console.log('  ✓ Accountable Executive designated: Admin User (§5.25)');

  // AE Designation document (§5.25)
  const existingAeDoc = await prisma.document.findFirst({ where: { title: 'Accountable Executive Designation — GoJump America' } });
  if (!existingAeDoc) {
    await prisma.document.create({
      data: {
        locationId: null, // global document, applies to all locations
        title: 'Accountable Executive Designation — GoJump America',
        type: 'Safety Policy',
        version: '1.0',
        status: 'Active',
        effectiveDate: aeDesignationDate,
        approvedById: adminUser.id,
        regulatoryRefs: JSON.stringify(['§5.25', '§5.21', '§5.23']),
        fileUrl: '/documents/ae-designation-2024.pdf',
      },
    });
  }

  // SMS Safety Policy document (§5.21)
  const existingPolicyDoc = await prisma.document.findFirst({ where: { title: 'GoJump America Safety Management System Policy' } });
  if (!existingPolicyDoc) {
    await prisma.document.create({
      data: {
        locationId: null,
        title: 'GoJump America Safety Management System Policy',
        type: 'Safety Policy',
        version: '2.0',
        status: 'Active',
        effectiveDate: aeDesignationDate,
        approvedById: adminUser.id,
        regulatoryRefs: JSON.stringify(['§5.21', '§5.23', '§5.25', '§5.27']),
        fileUrl: null,
      },
    });
  }
  console.log('  ✓ AE Designation and Safety Policy documents seeded (§5.25)');

  // Pre-populate risk register for each location
  const standingHazards = [
    {
      hazardIdLabel: 'H-001',
      description: 'Weather – Low Cloud / Ceiling Below Jump Minimums',
      likelihood: 'Frequent', consequence: 'Major', riskRating: 'High',
      controls: 'Weather briefing required before all jump operations. S&TA has authority to halt operations. METARs checked every 30 minutes.',
      revisedLikelihood: 'Occasional', revisedConsequence: 'Minor', revisedRating: 'Medium',
      regulatoryRefs: JSON.stringify(['§5.5','§5.7','§5.91']),
      alarpJustification: 'All reasonably practicable weather monitoring controls are in place. Mandatory 30-minute METAR checks, S&TA halt authority, and minimum ceiling standards have reduced likelihood from Frequent to Occasional and consequence from Major to Minor. Further reduction would require prohibitive forecast technology or permanent weather-protected operations not feasible for outdoor skydiving.',
    },
    {
      hazardIdLabel: 'H-002',
      description: 'Wind Exceeds Operational Limits (surface or upper winds)',
      likelihood: 'Occasional', consequence: 'Major', riskRating: 'High',
      controls: 'Wind limits posted at manifest. Tandem limit 14 kts surface, students 12 kts. Operations suspended when limits exceeded. Pilot has final authority.',
      revisedLikelihood: 'Remote', revisedConsequence: 'Minor', revisedRating: 'Low',
      regulatoryRefs: JSON.stringify(['§5.5','§5.7','§5.91']),
      alarpJustification: 'ALARP achieved. Strict published wind limits, mandatory cessation of operations when exceeded, and pilot final authority reduce risk to Low. Residual risk is the occurrence of unexpected gusts between measurement intervals — further reduction not reasonably practicable.',
    },
    {
      hazardIdLabel: 'H-003',
      description: 'Reserve Parachute Deployment / Gear Malfunction',
      likelihood: 'Remote', consequence: 'Catastrophic', riskRating: 'High',
      controls: 'All gear inspected by FAA-certified rigger per 14 CFR Part 65. Gear checks pre-flight by instructor. AAD installed on all student gear.',
      revisedLikelihood: 'Improbable', revisedConsequence: 'Major', revisedRating: 'Medium',
      regulatoryRefs: JSON.stringify(['§5.5','§5.7','§5.91','§5.95']),
      alarpJustification: 'Residual risk is Medium (Improbable × Major). Controls are as stringent as FAA regulations permit: certified rigger inspection, mandatory AADs on student gear, pre-flight checks. Further risk reduction is constrained by physical probability limits of equipment failure and the nature of parachute sport. ALARP principle satisfied.',
    },
    {
      hazardIdLabel: 'H-004',
      description: 'Aircraft Mechanical Failure / Emergency Landing',
      likelihood: 'Remote', consequence: 'Catastrophic', riskRating: 'High',
      controls: '100-hr inspections current. Pre-flight checklist mandatory. Pilot trained in emergency procedures. ERP activated on any aircraft emergency.',
      revisedLikelihood: 'Improbable', revisedConsequence: 'Major', revisedRating: 'Medium',
      regulatoryRefs: JSON.stringify(['§5.5','§5.7','§5.17']),
      alarpJustification: 'Residual risk is Medium (Improbable × Major). Aircraft maintenance complies with 14 CFR Part 43 and manufacturer requirements. Additional controls (100-hr inspections, mandatory pre-flights, ERP) exceed minimum regulatory requirements. Residual risk is the irreducible mechanical failure probability inherent to aviation. ALARP demonstrated.',
    },
    {
      hazardIdLabel: 'H-005',
      description: 'Student/Tandem Passenger Medical Emergency',
      likelihood: 'Occasional', consequence: 'Major', riskRating: 'High',
      controls: 'Medical screening form completed for all students. AED on site. CPR-certified staff on duty at all times. EMS contact numbers posted at manifest.',
      revisedLikelihood: 'Remote', revisedConsequence: 'Minor', revisedRating: 'Low',
      regulatoryRefs: JSON.stringify(['§5.17','§5.91']),
      alarpJustification: 'ALARP achieved. Medical screening eliminates known at-risk participants, on-site AED and CPR capability provides immediate response. Residual risk reduced to Low. Further reduction would require medical personnel on site for every jump — not proportionate to risk given Low residual rating.',
    },
  ];

  for (const loc of [oceanside, hawaii, lasVegas, newYork]) {
    for (const hazard of standingHazards) {
      const existing = await prisma.riskRegister.findFirst({
        where: { locationId: loc.id, hazardIdLabel: hazard.hazardIdLabel },
      });
      if (!existing) {
        await prisma.riskRegister.create({
          data: {
            locationId: loc.id,
            responsibleUserId: null,
            riskAcceptedById: adminUser.id,
            riskAcceptedAt: aeDesignationDate,
            riskAcceptanceNotes: 'Initial risk acceptance by Accountable Executive upon SMS establishment.',
            ...hazard,
          },
        });
      }
    }
    console.log(`  ✓ Risk register seeded: ${loc.name}`);
  }

  // Sample hazard reports
  const sampleReports = [
    {
      locationId: oceanside.id, reporterName: null, isAnonymous: true,
      type: 'Weather', severity: 'High', status: 'In_Review',
      description: 'Cloud ceiling dropped to 1,500 AGL unexpectedly during afternoon operations. Jump run was already in progress.',
      regulatoryRefs: JSON.stringify(['§5.91']),
    },
    {
      locationId: oceanside.id, reporterName: 'John Smith', isAnonymous: false,
      type: 'Equipment', severity: 'Critical', status: 'Mitigated',
      description: 'Reserve pilot chute spring found to be fatigued during routine inspection. Gear removed from service immediately.',
      regulatoryRefs: JSON.stringify(['§5.91','§5.95']),
    },
    {
      locationId: hawaii.id, reporterName: null, isAnonymous: true,
      type: 'Human_Factors', severity: 'Medium', status: 'Open',
      description: 'Instructor fatigue observed during late afternoon loads. Worked 12+ hours.',
      regulatoryRefs: JSON.stringify(['§5.91']),
    },
    {
      locationId: lasVegas.id, reporterName: 'Maria Santos', isAnonymous: false,
      type: 'Operational', severity: 'Medium', status: 'Closed',
      description: 'Manifest error resulted in student jumping without complete paperwork on file.',
      regulatoryRefs: JSON.stringify([]),
    },
    {
      locationId: newYork.id, reporterName: null, isAnonymous: true,
      type: 'Aircraft', severity: 'High', status: 'Open',
      description: 'Unusual engine vibration reported by pilot during climb. Aircraft grounded pending inspection.',
      regulatoryRefs: JSON.stringify(['§5.17','§5.91']),
    },
  ];

  for (const r of sampleReports) {
    await prisma.hazardReport.create({ data: r });
  }
  console.log('  ✓ Sample hazard reports created');

  // ERP contacts for each location
  const erpContactSets = {
    [oceanside.id]: [
      { role: 'Owner / General Manager', name: 'Chris GoJump',    phone: '760-555-0100', email: 'owner@gojumpamerica.com',        priority: 1 },
      { role: 'Safety & Training Advisor', name: 'Alex Chen',     phone: '760-555-0101', email: 'sta.oceanside@gojump.com',       priority: 2 },
      { role: 'Chief Pilot',              name: 'Capt. Mike Davis', phone: '760-555-0102', email: 'pilot@gojumpoceanside.com',   priority: 3 },
      { role: 'Head Rigger',              name: "Pat O'Brien",    phone: '760-555-0103', email: 'rigger@gojumpoceanside.com',     priority: 4 },
    ],
    [hawaii.id]: [
      { role: 'Safety & Training Advisor', name: 'Malia Fonoti',  phone: '808-555-0100', email: 'sta.hawaii@gojump.com',          priority: 1 },
      { role: 'Chief Pilot',              name: 'Capt. Lani Hale', phone: '808-555-0101', email: 'pilot@gojumphawaii.com',        priority: 2 },
    ],
    [lasVegas.id]: [
      { role: 'Safety & Training Advisor', name: 'Ryan Torres',   phone: '702-555-0100', email: 'sta.lasvegas@gojump.com',        priority: 1 },
      { role: 'Chief Pilot',              name: 'Capt. Sarah Kim', phone: '702-555-0101', email: 'pilot@gojumplasvegas.com',      priority: 2 },
    ],
    [newYork.id]: [
      { role: 'Safety & Training Advisor', name: 'Jamie Park',    phone: '718-555-0100', email: 'sta.newyork@gojump.com',         priority: 1 },
      { role: 'Chief Pilot',              name: 'Capt. Tony Ricci', phone: '718-555-0101', email: 'pilot@gojumpnewyork.com',      priority: 2 },
    ],
  };

  for (const [locId, contacts] of Object.entries(erpContactSets)) {
    for (const c of contacts) {
      await prisma.erpContact.create({ data: { locationId: locId, ...c } });
    }
  }
  console.log('  ✓ ERP contacts seeded');

  // §5.23 — Safety Accountability Matrix (global, no locationId)
  const accountabilityData = [
    {
      position: 'Accountable Executive',
      smsRole: 'admin',
      responsibilities: 'Ultimate authority for SMS; provide financial and human resources for safety; approve and sign safety policy; accept High/Critical residual risks; review SMS performance annually; ensure regulatory compliance.',
      authority: 'Final authority on all safety decisions; can halt operations; approve resource allocation for safety.',
    },
    {
      position: 'Safety & Training Advisor (S&TA)',
      smsRole: 's_ta',
      responsibilities: 'Day-to-day SMS management; investigate all hazard reports; conduct risk assessments; accept Medium residual risks; chair safety committee meetings; maintain hazard register; deliver safety training; report safety performance to AE.',
      authority: 'Can halt jump operations for safety reasons; accept Medium residual risk; assign corrective actions to staff.',
    },
    {
      position: 'Chief Pilot',
      smsRole: 'staff',
      responsibilities: 'Aircraft operational safety; ensure pre-flight checklists completed; weather go/no-go authority for flight operations; report all aircraft anomalies; maintain pilot currency; brief jumpers on aircraft emergency procedures.',
      authority: 'Final authority on all flight-related safety decisions; can refuse any load for safety reasons.',
    },
    {
      position: 'Instructor / Jump Master',
      smsRole: 'staff',
      responsibilities: 'Student safety briefings; tandem/AFF equipment pre-checks; report unsafe conditions immediately; ensure student fitness for jumping; follow all SOPs; participate in safety training.',
      authority: 'Can refuse to jump with a student for safety reasons; report hazards to S&TA.',
    },
    {
      position: 'Head Rigger',
      smsRole: 'staff',
      responsibilities: 'Equipment airworthiness; maintain packing records per 14 CFR Part 65; inspect all student gear; report gear deficiencies immediately; ensure AADs are armed and serviceable.',
      authority: 'Can ground any gear for airworthiness concerns; authority over all packing decisions.',
    },
    {
      position: 'All Employees',
      smsRole: 'staff',
      responsibilities: 'Report all hazards and safety concerns via the hazard reporting system; participate in safety training; follow all SOPs and safety procedures; support just culture principles; never operate equipment they are not trained or certified to use.',
      authority: 'Right to refuse unsafe tasks without reprisal (just culture guarantee).',
    },
  ];

  for (const entry of accountabilityData) {
    const existing = await prisma.safetyAccountability.findFirst({ where: { position: entry.position, locationId: null } });
    if (!existing) {
      await prisma.safetyAccountability.create({ data: { ...entry, locationId: null } });
    }
  }
  console.log('  ✓ Safety accountability matrix seeded');

  // Default KPIs for all locations (§5.75 with indicator type)
  const defaultKpis = [
    { name: 'Reserve Deployments per 1,000 Jumps', frequency: 'Monthly',   targetValue: 1.5,  measureMethod: 'Count reserve deployments / total jumps × 1000', regulatoryRefs: JSON.stringify(['§5.75']), indicatorType: 'lagging', alertThreshold: 1.5, alertDirection: 'above', dataSource: 'Jump manifest log' },
    { name: 'Average Days to Close Incident',       frequency: 'Monthly',   targetValue: 14,   measureMethod: 'Sum of (close - open) / count closed incidents',   regulatoryRefs: JSON.stringify(['§5.75']), indicatorType: 'lagging', alertThreshold: 14,  alertDirection: 'above', dataSource: 'Incident reports module' },
    { name: 'Open High/Critical Hazards',           frequency: 'Monthly',   targetValue: 0,    measureMethod: 'Count risk register items rated High or Critical with no controls', regulatoryRefs: JSON.stringify(['§5.75']), indicatorType: 'lagging', alertThreshold: 0, alertDirection: 'above', dataSource: 'Hazard register' },
    { name: 'Safety Reports Submitted',             frequency: 'Monthly',   targetValue: 5,    measureMethod: 'Count hazard reports submitted this period',        regulatoryRefs: JSON.stringify(['§5.75']), indicatorType: 'leading', alertThreshold: 2, alertDirection: 'below', dataSource: 'Hazard reporting system' },
    { name: 'ERP Exercise Compliance',              frequency: 'Quarterly', targetValue: 1,    measureMethod: 'Boolean — 1 if exercise completed within 6 months, 0 if not', regulatoryRefs: JSON.stringify(['§5.17']), indicatorType: 'leading', alertThreshold: 0, alertDirection: 'below', dataSource: 'ERP exercises log' },
  ];

  for (const loc of [oceanside, hawaii, lasVegas, newYork]) {
    for (const kpi of defaultKpis) {
      await prisma.kpi.create({ data: { ...kpi, locationId: loc.id, currentValue: null } });
    }
  }
  console.log('  ✓ Default KPIs seeded');

  // §5.27 — Emergency Response Plan document
  const existingErpDoc = await prisma.document.findFirst({ where: { title: 'Emergency Response Plan (ERP) — GoJump America' } });
  if (!existingErpDoc) {
    await prisma.document.create({
      data: {
        locationId: null,
        title: 'Emergency Response Plan (ERP) — GoJump America',
        type: 'Emergency Response',
        version: '1.2',
        status: 'Active',
        effectiveDate: new Date('2024-03-01'),
        approvedById: adminUser.id,
        regulatoryRefs: JSON.stringify(['§5.27', '§5.17']),
        fileUrl: null,
      },
    });
  }

  // SMS Manual document
  const existingSmsManual = await prisma.document.findFirst({ where: { title: 'GoJump America SMS Manual — 14 CFR Part 5' } });
  if (!existingSmsManual) {
    await prisma.document.create({
      data: {
        locationId: null,
        title: 'GoJump America SMS Manual — 14 CFR Part 5',
        type: 'SMS Manual',
        version: '3.1',
        status: 'Active',
        effectiveDate: aeDesignationDate,
        approvedById: adminUser.id,
        regulatoryRefs: JSON.stringify(['§5.1', '§5.3', '§5.21', '§5.51', '§5.71', '§5.91']),
        fileUrl: null,
      },
    });
  }

  // Standard Operating Procedures document
  const existingSopDoc = await prisma.document.findFirst({ where: { title: 'Standard Operating Procedures — Jump Operations' } });
  if (!existingSopDoc) {
    await prisma.document.create({
      data: {
        locationId: null,
        title: 'Standard Operating Procedures — Jump Operations',
        type: 'SOP',
        version: '2.4',
        status: 'Active',
        effectiveDate: new Date('2024-06-01'),
        approvedById: adminUser.id,
        regulatoryRefs: JSON.stringify(['§5.51', '§5.91']),
        fileUrl: null,
      },
    });
  }
  console.log('  ✓ SMS Manual, ERP, and SOP documents seeded (§5.21, §5.27)');

  // Sample safety committee meeting
  await prisma.meeting.create({
    data: {
      locationId: oceanside.id,
      date: new Date('2026-05-01'),
      attendees: JSON.stringify(['Alex Chen', 'Jordan Lee', 'Capt. Mike Davis']),
      agenda: '1. Review Q1 hazard reports\n2. Risk register update — H-003 controls review\n3. ERP drill scheduling',
      notes: 'Three open hazard reports reviewed. H-003 controls deemed adequate after rigger certification audit. ERP drill scheduled for May 15.',
      actionItems: JSON.stringify([
        { id: 1, description: 'Schedule ERP full drill', assignedTo: 'Alex Chen', dueDate: '2026-05-15', status: 'Open' },
        { id: 2, description: 'Update H-002 control measures documentation', assignedTo: 'Jordan Lee', dueDate: '2026-05-20', status: 'Open' },
      ]),
    },
  });
  console.log('  ✓ Sample safety meeting seeded');

  console.log('\n✅ Seed complete!\n');
  console.log('📋 Test credentials (password: GoJump2024!):');
  console.log('   admin@gojumpamerica.com        [admin — all locations]');
  console.log('   sta.oceanside@gojump.com       [s_ta — Oceanside]');
  console.log('   staff.oceanside@gojump.com     [staff — Oceanside]');
  console.log('   sta.hawaii@gojump.com          [s_ta — Hawaii]');
  console.log('   sta.lasvegas@gojump.com        [s_ta — Las Vegas]');
  console.log('   sta.newyork@gojump.com         [s_ta — New York]');
  console.log('\n🔗 QR report forms:');
  console.log(`   ${PUBLIC_BASE_URL}/report?location=oceanside`);
  console.log(`   ${PUBLIC_BASE_URL}/report?location=hawaii`);
  console.log(`   ${PUBLIC_BASE_URL}/report?location=las-vegas`);
  console.log(`   ${PUBLIC_BASE_URL}/report?location=new-york`);
}

main()
  .catch((e) => { console.error('Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
