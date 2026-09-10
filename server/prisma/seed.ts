import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing data...');
  await prisma.fieldReport.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.emergencyReport.deleteMany();
  await prisma.disasterAlert.deleteMany();
  await prisma.hospital.deleteMany();
  await prisma.shelter.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.safetyGuide.deleteMany();
  await prisma.weatherSnapshot.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding demo users...');
  const salt = await bcrypt.genSalt(10);
  const defaultPasswordHash = await bcrypt.hash('Password123!', salt);

  const citizen = await prisma.user.create({
    data: {
      name: 'Aarav Sharma',
      email: 'citizen@demo.com',
      passwordHash: defaultPasswordHash,
      role: 'CITIZEN',
      state: 'Maharashtra',
      district: 'Mumbai Suburban',
      phone: '+91 98201 11223',
    },
  });

  const districtOfficer = await prisma.user.create({
    data: {
      name: 'Dr. Rajesh Patil, IAS',
      email: 'district@demo.com',
      passwordHash: defaultPasswordHash,
      role: 'DISTRICT_OFFICER',
      state: 'Maharashtra',
      district: 'Mumbai Suburban',
      phone: '+91 22 2654 8900',
    },
  });

  const responder = await prisma.user.create({
    data: {
      name: 'Inspector Vikram Salunkhe (NDRF)',
      email: 'responder@demo.com',
      passwordHash: defaultPasswordHash,
      role: 'FIELD_RESPONDER',
      state: 'Maharashtra',
      district: 'Mumbai Suburban',
      phone: '+91 94220 88776',
    },
  });

  const healthOfficer = await prisma.user.create({
    data: {
      name: 'Dr. Sunita Deshmukh, MD',
      email: 'health@demo.com',
      passwordHash: defaultPasswordHash,
      role: 'HEALTH_OFFICER',
      state: 'Maharashtra',
      district: 'Mumbai Suburban',
      phone: '+91 22 2410 7000',
    },
  });

  const stateEoc = await prisma.user.create({
    data: {
      name: 'Smt. Ananya Sen, SEOC Director',
      email: 'state@demo.com',
      passwordHash: defaultPasswordHash,
      role: 'STATE_EOC',
      state: 'Maharashtra',
      district: 'Mumbai City',
      phone: '+91 22 2202 7990',
    },
  });

  const volunteer = await prisma.user.create({
    data: {
      name: 'Pooja Kulkarni (Civil Defence)',
      email: 'volunteer@demo.com',
      passwordHash: defaultPasswordHash,
      role: 'COMMUNITY_VOLUNTEER',
      state: 'Maharashtra',
      district: 'Mumbai Suburban',
      phone: '+91 98190 33445',
    },
  });

  console.log('Seeding disaster alerts...');
  await prisma.disasterAlert.createMany({
    data: [
      {
        title: 'Heavy Rainfall Warning (Assam & Meghalaya)',
        description: 'Intense precipitation with potential flash floods along the Brahmaputra basin and Barak valley. Low-lying habitations advised to stay vigilant.',
        hazardType: 'Flood',
        severity: 'WARNING',
        state: 'Assam',
        district: 'Kamrup Metropolitan',
        latitude: 26.1445,
        longitude: 91.7362,
        source: 'IMD & CWC National Flood Telemetry',
      },
      {
        title: 'Flood Watch (North Bihar & East UP)',
        description: 'Rising water levels observed across Kosi and Gandak rivers. Inundation watch in Supaul, Madhubani and Darbhanga floodplains.',
        hazardType: 'Flood',
        severity: 'WATCH',
        state: 'Bihar',
        district: 'Darbhanga',
        latitude: 26.1542,
        longitude: 85.8918,
        source: 'Central Water Commission (CWC)',
      },
      {
        title: 'Severe Heatwave Advisory (Central MP & Vidarbha)',
        description: 'Day maximum temperatures forecast between 44°C to 46°C. High wet-bulb index. Citizens urged to avoid midday direct exposure between 12 PM - 4 PM.',
        hazardType: 'Heatwave',
        severity: 'WARNING',
        state: 'Maharashtra',
        district: 'Nagpur',
        latitude: 21.1458,
        longitude: 79.0882,
        source: 'IMD Regional Meteorological Centre',
      },
      {
        title: 'Cyclonic Depression Monitoring (East Central Bay of Bengal)',
        description: 'Depression centered 420 km SSE of Paradip. Wind speeds estimated 45-55 km/h gusting to 65 km/h. Fishermen advised against venturing into deep sea.',
        hazardType: 'Cyclone',
        severity: 'WATCH',
        state: 'Odisha',
        district: 'Jagatsinghpur',
        latitude: 19.8245,
        longitude: 86.6872,
        source: 'IMD Cyclone Warning Division',
      },
      {
        title: 'High Tide & Coastal Surge Advisory (Mumbai Coast)',
        description: 'Astronomical spring high tide of 4.68 meters coupled with moderate rainfall anticipated. Sluice gates operational. Waterfront promenades restricted.',
        hazardType: 'Rain',
        severity: 'INFO',
        state: 'Maharashtra',
        district: 'Mumbai Suburban',
        latitude: 19.0760,
        longitude: 72.8777,
        source: 'MCGM Disaster Management Cell',
      },
      {
        title: 'Landslide Vulnerability Warning (Shimla & Mandi)',
        description: 'Continuous soil saturation along NH-5. Prone to rock falls and localized debris flows. Heavy transport restricted through sensitive hill slopes.',
        hazardType: 'Landslide',
        severity: 'WATCH',
        state: 'Himachal Pradesh',
        district: 'Shimla',
        latitude: 31.1048,
        longitude: 77.1734,
        source: 'Geological Survey of India & SDMA',
      },
    ],
  });

  console.log('Seeding hospitals...');
  await prisma.hospital.createMany({
    data: [
      {
        name: 'KEM Municipal General Hospital & Trauma Centre',
        district: 'Mumbai City',
        state: 'Maharashtra',
        totalBeds: 1800,
        availableBeds: 240,
        icuBeds: 120,
        availableIcuBeds: 18,
        oxygenStockDays: 7.5,
        contactPhone: '022-24107000',
        address: 'Acharya Donde Marg, Parel, Mumbai 400012',
        latitude: 19.0028,
        longitude: 72.8423,
      },
      {
        name: 'Dr. R. N. Cooper Municipal Hospital',
        district: 'Mumbai Suburban',
        state: 'Maharashtra',
        totalBeds: 750,
        availableBeds: 110,
        icuBeds: 60,
        availableIcuBeds: 12,
        oxygenStockDays: 6.2,
        contactPhone: '022-26207254',
        address: 'U 15, Bhaktivedanta Swami Marg, JVPD Scheme, Juhu, Mumbai 400056',
        latitude: 19.1084,
        longitude: 72.8364,
      },
      {
        name: 'Lilavati Hospital & Research Centre',
        district: 'Mumbai Suburban',
        state: 'Maharashtra',
        totalBeds: 320,
        availableBeds: 45,
        icuBeds: 40,
        availableIcuBeds: 6,
        oxygenStockDays: 8.0,
        contactPhone: '022-26751000',
        address: 'A-791, Bandra Reclamation, Bandra West, Mumbai 400050',
        latitude: 19.0515,
        longitude: 72.8295,
      },
      {
        name: 'Rajawadi Municipal General Hospital',
        district: 'Mumbai Suburban',
        state: 'Maharashtra',
        totalBeds: 600,
        availableBeds: 95,
        icuBeds: 45,
        availableIcuBeds: 9,
        oxygenStockDays: 5.4,
        contactPhone: '022-25115066',
        address: 'Chittaranjan Nagar, Rajawadi, Ghatkopar East, Mumbai 400077',
        latitude: 19.0833,
        longitude: 72.9090,
      },
      {
        name: 'Sassoon General Hospital & BJ Medical College',
        district: 'Pune',
        state: 'Maharashtra',
        totalBeds: 1300,
        availableBeds: 310,
        icuBeds: 85,
        availableIcuBeds: 22,
        oxygenStockDays: 9.0,
        contactPhone: '020-26128000',
        address: 'Near Pune Railway Station, Sangamvadi, Pune 411001',
        latitude: 18.5284,
        longitude: 73.8740,
      },
      {
        name: 'Gauhati Medical College and Hospital (GMCH)',
        district: 'Kamrup Metropolitan',
        state: 'Assam',
        totalBeds: 1200,
        availableBeds: 180,
        icuBeds: 70,
        availableIcuBeds: 14,
        oxygenStockDays: 6.8,
        contactPhone: '0361-2529457',
        address: 'Narakasur Hilltop, Bhangagarh, Guwahati 781032',
        latitude: 26.1554,
        longitude: 91.7709,
      },
    ],
  });

  console.log('Seeding shelters...');
  await prisma.shelter.createMany({
    data: [
      {
        name: 'Bandra Municipal School Community Relief Shelter',
        district: 'Mumbai Suburban',
        state: 'Maharashtra',
        capacity: 400,
        currentOccupancy: 120,
        amenities: 'Drinking Water, First Aid, Mobile Charging, Hot Meals, Baby Rations',
        contactPerson: 'Shri Anand Kadam (Welfare Officer)',
        contactPhone: '022-26421001',
        address: 'Hill Road, Near Bandra Police Station, Mumbai 400050',
        latitude: 19.0560,
        longitude: 72.8330,
      },
      {
        name: 'Andheri Sports Complex Regional Cyclone & Flood Shelter',
        district: 'Mumbai Suburban',
        state: 'Maharashtra',
        capacity: 1200,
        currentOccupancy: 80,
        amenities: 'High Elevation Gymnasiums, Emergency Power Generator, 24/7 Paramedic Station, Helipad Access',
        contactPerson: 'Inspector D. Joshi',
        contactPhone: '022-26733221',
        address: 'Veera Desai Road, Andheri West, Mumbai 400053',
        latitude: 19.1332,
        longitude: 72.8288,
      },
      {
        name: 'Kurla West Municipal Hall Shelter',
        district: 'Mumbai Suburban',
        state: 'Maharashtra',
        capacity: 350,
        currentOccupancy: 190,
        amenities: 'Inflatable Life Rafts Staging, Clean Water Storage, Dry Food Packets',
        contactPerson: 'Smt. Rekha More',
        contactPhone: '022-26501234',
        address: 'Near Kurla Station West, LBS Marg, Mumbai 400070',
        latitude: 19.0688,
        longitude: 72.8792,
      },
      {
        name: 'Dadar Sports Club Multipurpose Evacuation Center',
        district: 'Mumbai City',
        state: 'Maharashtra',
        capacity: 850,
        currentOccupancy: 210,
        amenities: 'Large Covered Pavilion, Medical Dispensary, Sanitation Blocks, Elderly Cots',
        contactPerson: 'Mahesh Shinde',
        contactPhone: '022-24145678',
        address: 'Shivaji Park Ground, Dadar West, Mumbai 400028',
        latitude: 19.0268,
        longitude: 72.8375,
      },
      {
        name: 'Thane Central Disaster Relief Center',
        district: 'Thane',
        state: 'Maharashtra',
        capacity: 600,
        currentOccupancy: 145,
        amenities: 'Water purification unit, Satellite connectivity, Emergency wireless broadcast',
        contactPerson: 'Sunil Jadhav',
        contactPhone: '022-25331122',
        address: 'Alok Naka, Near Commissionerate, Thane West 400601',
        latitude: 19.2183,
        longitude: 72.9781,
      },
    ],
  });

  console.log('Seeding disaster response resources...');
  await prisma.resource.createMany({
    data: [
      {
        name: '5th Battalion NDRF Quick Response Team',
        type: 'Rescue Battalion',
        district: 'Mumbai Suburban',
        state: 'Maharashtra',
        quantity: 6,
        availableQuantity: 4,
        status: 'READY',
        contactPhone: '022-26840000',
      },
      {
        name: 'High-Capacity Dewatering Pump Sets (1500 GPM)',
        type: 'Flood Mitigation',
        district: 'Mumbai Suburban',
        state: 'Maharashtra',
        quantity: 24,
        availableQuantity: 18,
        status: 'DEPLOYED_PARTIAL',
        contactPhone: '022-22694725',
      },
      {
        name: 'Motorized Inflatable Rescue Boats (Gemini Craft)',
        type: 'Water Rescue',
        district: 'Mumbai Suburban',
        state: 'Maharashtra',
        quantity: 16,
        availableQuantity: 12,
        status: 'READY',
        contactPhone: '022-26840000',
      },
      {
        name: 'Mobile Trauma & Critical Care Van',
        type: 'Medical Logistics',
        district: 'Mumbai Suburban',
        state: 'Maharashtra',
        quantity: 8,
        availableQuantity: 5,
        status: 'READY',
        contactPhone: '108',
      },
    ],
  });

  console.log('Seeding safety guides...');
  const guides = [
    {
      slug: 'earthquake',
      title: 'Earthquake Safety & Structural Precautions',
      hazardType: 'Earthquake',
      category: 'Seismic Hazard',
      summary: 'Essential procedures during high-magnitude tremors. Drop, Cover, Hold On rules and structural checks.',
      guidelineCount: 12,
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAC9huUXb35yEIVX_0rakf-AXk2HMm68lLjPVasHuavJX1wp4SnaA3138Kqg-exTcJLq7pzF-h3ADaYygI8rnsQv8aJBIhoyGd3gSnR4qTNN9oZMa-1YD2Dk6C1xcxDDWw15Fy5unNYGo8ibICQBPCY2yIi3cBfPe-KyVv429Yt1OzCPhHdCoAvPNM9UGdCS1My2lnTuy9auoZtlWwXRPVthIgL3bKXpibX_IaI6K9IGe5OKtGVeDuC',
      beforeSteps: JSON.stringify([
        'Secure tall cabinets, heavy appliances, and wall hangings with L-brackets and wall studs.',
        'Identify safe spots in each room: under sturdy dining tables, against interior walls, away from glass.',
        'Keep a family grab-and-go kit near the main exit containing torches, batteries, water, and first aid.',
        'Practice Drop, Cover, and Hold On family drills every 6 months.',
      ]),
      duringSteps: JSON.stringify([
        'DROP to the floor onto your hands and knees to prevent being knocked over.',
        'COVER your head and neck beneath a sturdy desk or table; if no shelter is available, cover against an interior wall.',
        'HOLD ON until shaking completely stops. Protect your eyes by pressing face against your arm.',
        'If outdoors, move into an open area away from electrical wires, brick chimneys, and high-rise facades.',
        'Do NOT use elevators; do NOT rush down stairwells while active tremors continue.',
      ]),
      afterSteps: JSON.stringify([
        'Check yourself and family members for injuries before assisting neighbors.',
        'Inspect LPG gas lines for smells; turn off main gas valves immediately if leaks are suspected.',
        'Expect aftershocks. Avoid entering visibly cracked or compromised masonry buildings.',
        'Use battery radio or official civil alerts for evacuation updates; keep phone lines open for emergencies.',
      ]),
      dos: JSON.stringify([
        'Drop immediately onto hands and knees.',
        'Cover head and neck under sturdy furniture.',
        'Shut off main gas valve and main circuit breaker if leaving.',
        'Listen to All India Radio or official DDMA broadcasts.',
      ]),
      donts: JSON.stringify([
        'Do NOT run outside during active shaking.',
        'Do NOT stand under heavy lighting or ceiling fans.',
        'Do NOT use elevators during or immediately after tremors.',
        'Do NOT light matchsticks or candles if gas odor is present.',
      ]),
      kitItems: JSON.stringify([
        'Battery-operated or hand-crank AM/FM radio',
        'Sturdy work gloves and dust masks (N95)',
        '3 days potable bottled water (3L per person/day)',
        'Waterproof pouch with Aadhaar, ration card, property deeds',
        'Whistle to signal search and rescue teams',
      ]),
      evacuationTriggers: JSON.stringify([
        'Deep foundation or load-bearing wall shear cracks wider than 5mm.',
        'Ruptured municipal water or sewage lines inside building.',
        'Official evacuation orders broadcast by Municipal Commissioner or Police.',
      ]),
    },
    {
      slug: 'flood',
      title: 'Flood & Severe Inundation Protocols',
      hazardType: 'Flood',
      category: 'Hydrological Hazard',
      summary: 'Basin warning stages, waterborne disease prevention, and timely vertical evacuation playbooks.',
      guidelineCount: 18,
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCSPPcGcBJa0epDaWYFFvyg9y713IMo3NFHA9dVypMpa40varswrCGIs0leYI1u9a6fiQf6rbSCKzgmN0uMrAf8pOah29SxVbLpT_EPwVwjDLd5LYttQjc5m4LUK7y_w5OL5bhoeeQmG8S6g9znlg1I9zfRdO8bmLdKiEAK-5J6ZwxWx_BLDw1PsGVC-zLVn9lu3q3quRg7Vs-yneHK5zDT9sFKDc9fdxsrOQGGoni4UtdTNFAOABwm',
      beforeSteps: JSON.stringify([
        'Know your local flood zone, river basin gauge levels, and nearest designated high-ground shelters.',
        'Elevate electrical switchboards and essential home appliances above historical flood lines.',
        'Clear domestic drains and perimeter gutters of plastic waste and silt buildup.',
        'Store important identity documents and dry medicines in sealed, buoyant waterproof containers.',
      ]),
      duringSteps: JSON.stringify([
        'Turn off main electricity switch and LPG cylinders before floodwater enters premises.',
        'Move vulnerable family members, pets, and valuables vertically to upper floors.',
        'Never walk, swim, or drive through flowing water; 15 cm of moving water can knock down an adult.',
        'Avoid contact with floodwater to prevent leptospirosis and electrical stray voltage.',
      ]),
      afterSteps: JSON.stringify([
        'Boil all drinking water vigorously for at least 10 minutes or use chlorine water tablets.',
        'Do not touch damp electrical appliances until certified dry by an electrician.',
        'Disinfect flooded premises with lime powder or bleaching solution to prevent bacterial outbreaks.',
        'Report open sewer manholes or dangling live wires immediately to municipal ward offices.',
      ]),
      dos: JSON.stringify([
        'Follow instructions from NDRF, SDRF, and ward marshals.',
        'Boil or chlorinate all water before consumption.',
        'Keep mobile devices charged on power banks while power remains active.',
        'Wear gumboots and tough clothing when navigating wet ground.',
      ]),
      donts: JSON.stringify([
        'Do NOT cross submerged bridges, causeways, or culverts.',
        'Do NOT consume food that has come into contact with floodwaters.',
        'Do NOT park vehicles under dilapidated trees or fragile retaining walls.',
        'Do NOT spread unverified social media voice notes regarding dam releases.',
      ]),
      kitItems: JSON.stringify([
        'Chlorine / Aquatabs water purification tablets',
        'ORS electrolyte sachets and antidiarrheal medicines',
        'Waterproof LED headlamp with spare rechargeable cells',
        'Heavy duty polythene sheeting and duct tape',
        'Life jackets or certified inflatable swimming rings',
      ]),
      evacuationTriggers: JSON.stringify([
        'Water level rising more than 15 cm/hour inside residential premises.',
        'Red alert stage breached on nearby river or nallah water level gauge.',
        'Direct loudspeaker instructions from police or NDRF rescue motorboats.',
      ]),
    },
    {
      slug: 'cyclone',
      title: 'Tropical Cyclone & Coastal Surge Guidelines',
      hazardType: 'Cyclone',
      category: 'Meteorological Hazard',
      summary: 'Storm classifications, eye-of-the-storm precautions, and post-landfall protection.',
      guidelineCount: 14,
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA376oGGGArcFKvEHw0SI9fl9POEW8Xd0F_RSCNESqmBQ18hmmwy2r-I31z--oRaCA7WmMTfwDvVtSeBFZia3wqqgMJ1xUH9u2FZ5F9S75myVeVuv5J20G7yc7YHuhf76gCZxk_AdLLoX9ased0WNvpYW1kGWAGEafxzTxggatdn5k3q06A7ZKpTPKvW-XlI_SOhUomu-hBjrRiszgWqKQqc7OflZDbTZYvwFr0YUs73flnGfvH_kl8',
      beforeSteps: JSON.stringify([
        'Trim fragile tree branches around your roof and inspect roof tin sheets.',
        'Tape window panes crosswise with duct tape to prevent glass splintering under gust loads.',
        'Anchor loose objects outdoors: water tanks, solar panels, air conditioner outdoor units.',
        'Relocate from low-lying beachfront thatched settlements to reinforced cyclone shelters.',
      ]),
      duringSteps: JSON.stringify([
        'Stay indoors in the safest, central room of the house away from external windows.',
        'Beware of the calm eye of the storm; wind reversals occur rapidly with equal or greater fury.',
        'Keep all doors and windows securely latched. Disconnect television antenna cables.',
        'Do not step out on waterfronts or jetties to film waves or high tides.',
      ]),
      afterSteps: JSON.stringify([
        'Do not venture outdoors until the IMD all-clear is officially broadcast.',
        'Beware of fallen high-tension electrical cables in puddles.',
        'Drive cautiously; roads may have fallen branches and weakened asphalt shoulders.',
        'Cooperate with relief teams distributing dry rations and clean water.',
      ]),
      dos: JSON.stringify([
        'Keep battery-powered radio tuned to regional All India Radio frequencies.',
        'Stay in the interior part of the house during gale force winds.',
        'Keep emergency numbers (112, 1078, 1070) written on a physical notebook.',
      ]),
      donts: JSON.stringify([
        'Do NOT believe rumors regarding sudden tsunami waves without official IMD alert.',
        'Do NOT step out during the lull in wind when the center passes overhead.',
        'Do NOT take shelter under loose tin roofs or metal sheds.',
      ]),
      kitItems: JSON.stringify([
        'Hammer, nails, and rope for emergency shutter repairs',
        'Waterproof matches and wax candles',
        'Prescription eye glasses and emergency cash in small denominations',
      ]),
      evacuationTriggers: JSON.stringify([
        'Dwelling within 5 km of coast under Super Cyclone or Extremely Severe Cyclone warning.',
        'Storm surge forecast exceeding 3 meters above astronomical tide.',
      ]),
    },
    {
      slug: 'heatwave',
      title: 'Extreme Heatwave & Thermal Stress Management',
      hazardType: 'Heatwave',
      category: 'Climatic Extreme',
      summary: 'Wet-bulb warnings, electrolytic balance, and protection for vulnerable demographics.',
      guidelineCount: 9,
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC3jdnz-x5p6Pg3PWRoW5IQlA2St5HJhQAG4EdAmfFngmTAnHTBQzgAG9VJSeIL2dC8pQGGBRSsnSHjhdQfacPbYhkEuY4euK6tpoGXi3LCnlW54_MVS6gPUgdF1E9Q5V39iijqmZ7fC5gqayoZmC-47VtrA7nF7x8QRW_6Ee_d6x4z-khWT_uJSFb_nZh6V5JTPcS6siAPfXPWEL_xxdrKH9rcLzqdOY12Q9uIl8ltSYKOX0rZ40b_',
      beforeSteps: JSON.stringify([
        'Install reflective curtains or khus mats on west-facing windows.',
        'Keep hydration supplies stocked: ORS, lemon water, buttermilk, coconut water.',
        'Check in on elderly neighbors, outdoor manual laborers, and infants regularly.',
      ]),
      duringSteps: JSON.stringify([
        'Avoid stepping outside between 12:00 PM and 4:00 PM during peak solar insolation.',
        'Wear loose, light-colored cotton clothing and cover your head with a white cloth or umbrella.',
        'Never leave children or pets locked inside a parked vehicle, even for 5 minutes.',
        'If experiencing dizziness, nausea, or absence of sweating, move to shade and cool with ice immediately.',
      ]),
      afterSteps: JSON.stringify([
        'Continue fluid intake even if you do not feel active thirst.',
        'Avoid caffeinated, carbonated, or excessively sugary drinks that promote dehydration.',
        'Provide shade and earthen water bowls for community animals and birds.',
      ]),
      dos: JSON.stringify([
        'Drink plenty of oral rehydration solution (ORS) or homemade salt-lemon water.',
        'Keep damp towels on forehead and neck during hot afternoons.',
        'Seek immediate hospitalization if someone faints or exhibits confusion (Heat Stroke).',
      ]),
      donts: JSON.stringify([
        'Do NOT engage in strenuous outdoor sports or heavy manual lifting during midday.',
        'Do NOT consume stale food or unhygienic cut roadside fruits in hot weather.',
      ]),
      kitItems: JSON.stringify([
        'ORS WHO-formula sachets (at least 10 packets)',
        'Compact digital thermometer to track body temperature',
        'Wide-brimmed cotton hat or light linen stole',
      ]),
      evacuationTriggers: JSON.stringify([
        'Prolonged blackout in high-density urban areas with wet-bulb temperature > 32°C.',
      ]),
    },
    {
      slug: 'landslide',
      title: 'Himalayan & Ghats Landslide Precautions',
      hazardType: 'Landslide',
      category: 'Geological Peril',
      summary: 'Hill slope warning cues, mudflow velocity, and safe egress paths.',
      guidelineCount: 11,
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCGAmQBTMud1gpQCvzq19Ad3Ocpnudq4SluCj73DOri-m_A9SAatY6RI4yNDWc-VWQeLQ4W_091NC6la1lSTi20Z3Eg-GnOIr21NJfO3WsKtanSpxnsoHsBl_lT4OPtWJxF0YCUyuDj-hQwQlyX_nPTSau2_jeoY61y-XiJU5-L5SFK7dEd285m9bGRtseEVGG-qoVG-gfGUw3U58FzMq7bNJ16O5UAmYvkvwQs_Als1gMq9r7ST6oh',
      beforeSteps: JSON.stringify([
        'Identify vulnerable slopes, retaining wall tilts, and sudden water seepages on hillsides.',
        'Keep clear of natural drainage gullies during heavy torrential hill downpours.',
        'Avoid building extensions directly on steep unsupported cuts without geotechnical approval.',
      ]),
      duringSteps: JSON.stringify([
        'Listen for unusual sounds: cracking trees, rolling boulders, or sudden muddy creek surges.',
        'If caught near a slide, run laterally away from the fall line towards ridgelines, not downhill.',
        'Curl into a tight ball and protect your head if debris cannot be outrun.',
      ]),
      afterSteps: JSON.stringify([
        'Stay away from the slide area; secondary collapses frequently follow initial slides.',
        'Check for injured or trapped persons without entering direct hazard zones.',
        'Report damaged culverts, ruptured water pipes, or roadway buckles to Border Roads Org (BRO) or PWD.',
      ]),
      dos: JSON.stringify([
        'Heed warnings issued by Geological Survey of India (GSI) and hill district authorities.',
        'Evacuate immediately if spring water turns muddy or ground fissures open up.',
      ]),
      donts: JSON.stringify([
        'Do NOT cross road sections covered with active falling pebbles or mud cascades.',
        'Do NOT excavate toe of slopes during the monsoon months.',
      ]),
      kitItems: JSON.stringify([
        'High-decibel survival whistle',
        'Trekking boots with deep lug soles for muddy terrain',
        'High-lumen rechargeable torch with strobe mode',
      ]),
      evacuationTriggers: JSON.stringify([
        'Spring water near foundations turning abruptly turbid or muddy.',
        'Doors and window frames sticking or jamming due to foundation shifting.',
      ]),
    },
    {
      slug: 'lightning',
      title: 'Thunderstorm & Lightning Strike Safety',
      hazardType: 'Lightning',
      category: 'Thunderstorm',
      summary: 'The 30-30 rule, rural farm safety, and lightning surge protection.',
      guidelineCount: 8,
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC_pdgF2-fx4gGEGP-y6bxZvlD7V1Z_S5IFPrhWSUjT0mZbIdNAp_pTc_G7gHvjdjGqbVeSkYYi5WZy_s3aQATTBi7KiP1aysUfOTrgCMP7zdjfL4tjIDNRHoBdX4epsMKX8maxM7PQaqlcLRm29RNBTCkxPP4G-VRn4GOBEsAaC77yJRx8ateufqYyboQtGycvEnAsmyiYXYTxD5vAyCngndQ4xu9bKN45YmZTuCmo2qe8oNvjbpwU',
      beforeSteps: JSON.stringify([
        'Check local weather radar and Damini Lightning App alert warnings before working in open fields.',
        'Install certified lightning arresters on high-rise structures and rural community centers.',
      ]),
      duringSteps: JSON.stringify([
        'Apply the 30-30 rule: If thunder is heard within 30 seconds of flash, go inside. Stay inside for 30 minutes after last thunder.',
        'If caught in the open with hair standing on end, crouch low on the balls of your feet with heels touching. Do NOT lie flat on the ground.',
        'Avoid tall isolated trees, open metal tractors, wire fences, and water bodies.',
        'Unplug sensitive electronic appliances and avoid wired landline telephones.',
      ]),
      afterSteps: JSON.stringify([
        'Lightning strike victims do NOT carry an electrical charge and are safe to touch immediately.',
        'Begin CPR immediately if victim is unresponsive or has stopped breathing; call 108/112.',
      ]),
      dos: JSON.stringify([
        'Seek shelter inside a fully enclosed concrete building or metal-topped vehicle.',
        'Crouch on balls of feet if caught in an open field.',
      ]),
      donts: JSON.stringify([
        'Do NOT take shelter under solitary tall trees in open farms or playgrounds.',
        'Do NOT hold metal tools, umbrellas with metal tips, or fishing rods.',
      ]),
      kitItems: JSON.stringify([
        'Damini app installed on mobile phone with GPS location enabled',
        'Surge protectors for primary household electronics',
      ]),
      evacuationTriggers: JSON.stringify([
        'Severe thunderstorm squall line approaching open agricultural cluster.',
      ]),
    },
    {
      slug: 'forest-fire',
      title: 'Wildland & Forest Fire Perimeter Defense',
      hazardType: 'Forest Fire',
      category: 'Ecological Fire',
      summary: 'Creating defensible space, smoke inhalation mitigation, and evacuation protocols.',
      guidelineCount: 10,
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBzoWipfoeJgjCorB-thNA9GIR1EcVYDUMLKrBYHCn24k0r04gxkHeLSA4l6njUb6MLxxHUmbvS-svdgunuXRKnYNFdcPPSICT8bdIuoFSlsaoOuVoTtmj_jS60GhhJ-Sl1uu8VkLpjtpjbtLp3WlgnwFfvwXi_gyhBfV_bZ0AR87-qPfRJGnxPajxvz5Ymi2ZfxEMt32A2-nqm3szUk46ET7Wp1jvnO36j06P4jWvhSmuVAAGcF3xq',
      beforeSteps: JSON.stringify([
        'Clear dry pine needles, leaves, and brush within a 30-meter perimeter of residential structures.',
        'Keep garden hoses connected and water storage tanks filled during dry fire seasons.',
      ]),
      duringSteps: JSON.stringify([
        'Evacuate immediately when forest department warns of approaching flank winds.',
        'Wear 100% natural cotton or wool clothing; avoid synthetics that melt under radiant heat.',
        'Cover nose and mouth with a damp cotton cloth or N95 mask to filter particulate smoke.',
      ]),
      afterSteps: JSON.stringify([
        'Check roof and attic spaces for hidden ember sparks that can smolder for hours.',
        'Avoid drinking water from surface streams exposed to heavy fire ash contamination.',
      ]),
      dos: JSON.stringify([
        'Create fire-breaks around rural settlements before dry summer months.',
        'Report unattended forest smoke columns immediately to Forest Range Officers (1926).',
      ]),
      donts: JSON.stringify([
        'Do NOT throw lit bidi or cigarette butts into dry roadside brush.',
        'Do NOT burn crop stubble or agricultural waste near woodland borders on windy days.',
      ]),
      kitItems: JSON.stringify([
        'N95 or P100 particulate respirator masks',
        'Heavy cotton work overalls and safety goggles',
      ]),
      evacuationTriggers: JSON.stringify([
        'Active crowning fire within 2 kilometers with shifting wind direction toward settlement.',
      ]),
    },
    {
      slug: 'drought',
      title: 'Severe Drought & Water Scarcity Protocols',
      hazardType: 'Drought',
      category: 'Chronic Hazard',
      summary: 'Groundwater conservation, rationing protocols, and livestock protection.',
      guidelineCount: 15,
      imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAUQVklikJjMOEA5sAjaWShlJH4MOofxj2v2-xRHbyUjE14eWVJXsAWNYZCqeU8XHMKwgFUC-PFY7rQRIWINUWS37wBIctCgh4iG0GuaoulD4_7k-A2cWx-tJf0IFo_tZuRYQJ5hXAbjQgNzPmvboXpUuXAbLOxosiiPMmC-SN1XvLY9oOjnc09934wYa-VrraGRgYIs7p9bqxsGZrGK5NaHfrkWJsfr1fLekT0jrc3skYPvQEdxtc7',
      beforeSteps: JSON.stringify([
        'Adopt rainwater harvesting recharge pits in residential and agricultural compounds.',
        'Implement drip and sprinkler irrigation to reduce evaporative agricultural losses.',
      ]),
      duringSteps: JSON.stringify([
        'Prioritize drinking and sanitary water usage over washing vehicles or gardening.',
        'Recycle greywater from kitchens and baths for toilet flushing and non-edible crops.',
        'Utilize community fodder camps (Chara Chavani) to protect livestock during severe scarcity.',
      ]),
      afterSteps: JSON.stringify([
        'Desilt local percolation tanks, village ponds, and check dams before the onset of monsoon.',
        'Diversify crops towards drought-tolerant millets (Jowar, Bajra, Ragi).',
      ]),
      dos: JSON.stringify([
        'Fix domestic tap leaks immediately; a dripping tap wastes up to 20 liters daily.',
        'Participate in village watershed development and soil conservation programs.',
      ]),
      donts: JSON.stringify([
        'Do NOT indulge in wasteful water consumption or hosepipe washing of sidewalks.',
        'Do NOT dig unpermitted borewells that deplete deep static aquifers.',
      ]),
      kitItems: JSON.stringify([
        'Food-grade sealed 50L potable water containers',
        'Water purification chlorine drops and TDS testing meter',
      ]),
      evacuationTriggers: JSON.stringify([
        'Total collapse of municipal tanker supplies or village drinking water wells.',
      ]),
    },
  ];

  for (const guide of guides) {
    await prisma.safetyGuide.create({
      data: guide,
    });
  }

  console.log('Seeding initial active emergency reports & incidents...');
  const report1 = await prisma.emergencyReport.create({
    data: {
      id: 'JG-2026-00104',
      citizenName: 'Sunil Rao',
      phone: '+91 98200 44551',
      locationName: 'Milan Subway, Santacruz West, Mumbai',
      latitude: 19.0833,
      longitude: 72.8415,
      emergencyType: 'Flood',
      urgency: 'High',
      peopleAffected: 6,
      description: 'Severe waterlogging under subway after cloudburst. Two auto-rickshaws stalled with elderly passengers stranded inside.',
      status: 'DISPATCHED',
    },
  });

  const incident1 = await prisma.incident.create({
    data: {
      reportId: report1.id,
      title: 'Waterlogging & Stranded Passengers at Milan Subway',
      description: 'Severe waterlogging under subway. 6 passengers trapped in two auto-rickshaws. Dewatering pumps and boat required.',
      emergencyType: 'Flood',
      urgency: 'High',
      status: 'ASSIGNED',
      district: 'Mumbai Suburban',
      state: 'Maharashtra',
      locationName: 'Milan Subway, Santacruz West, Mumbai',
      latitude: 19.0833,
      longitude: 72.8415,
      assignedToId: responder.id,
    },
  });

  await prisma.fieldReport.create({
    data: {
      incidentId: incident1.id,
      responderId: responder.id,
      responderName: responder.name,
      situationReport: 'NDRF team arrived at Milan Subway with inflatable raft. All 6 civilians safely evacuated to dry pavement. Mobile dewatering pump activated.',
      casualtiesRescued: 6,
      medicalRequired: false,
      notes: 'Traffic police alerted to divert vehicles towards SV Road flyover.',
      latitude: 19.0833,
      longitude: 72.8415,
    },
  });

  const report2 = await prisma.emergencyReport.create({
    data: {
      id: 'JG-2026-00218',
      citizenName: 'Meera Iyer',
      phone: '+91 98199 88123',
      locationName: 'LBS Marg, Kurla West, Mumbai',
      latitude: 19.0688,
      longitude: 72.8792,
      emergencyType: 'Infrastructure Damage',
      urgency: 'Moderate',
      peopleAffected: 2,
      description: 'Old banyan tree branch snapped and fallen onto low-tension electricity wires. Road partially blocked.',
      status: 'PENDING',
    },
  });

  await prisma.incident.create({
    data: {
      reportId: report2.id,
      title: 'Fallen Tree on Electrical Lines - LBS Marg Kurla',
      description: 'Tree snapped onto power cables causing localized sparks and road obstruction.',
      emergencyType: 'Infrastructure Damage',
      urgency: 'Moderate',
      status: 'NEW',
      district: 'Mumbai Suburban',
      state: 'Maharashtra',
      locationName: 'LBS Marg, Kurla West, Mumbai',
      latitude: 19.0688,
      longitude: 72.8792,
    },
  });

  console.log('Seeding baseline weather snapshot...');
  await prisma.weatherSnapshot.create({
    data: {
      location: 'Mumbai, Maharashtra',
      state: 'Maharashtra',
      district: 'Mumbai Suburban',
      temperature: 28.0,
      condition: 'Partly Cloudy',
      humidity: 78,
      windSpeed: 12.0,
      rainProbability: 20,
      aqi: 68,
      aqiStatus: 'Satisfactory',
    },
  });

  console.log('✅ Database successfully seeded!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
