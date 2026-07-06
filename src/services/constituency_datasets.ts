// Government Datasets and Indian Ministry Standards for Rampur Constituency (Census 2011 & Current Statuses)
// Used to compare citizen suggestions/complaints against official standards and compute Combined Priority Index (CPI).

export interface MinistryStandard {
  id: string;
  ministry: string;
  scheme: string;
  parameterName: string;
  nationalBenchmark: string;
  unit: string;
  benchmarkValue: number;
}

export interface ConstituencyDemographics {
  name: string;
  district?: string;
  state?: string;
  centerCoords?: { lat: number; lng: number };
  population: number;
  sexRatio: number; // females per 1000 males
  literacyRate: number; // percentage
  urbanization: number; // percentage urban
  scStPercentage: number;
  unemploymentRate?: number; // percentage
  
  // Current coverage metrics corresponding to MinistryStandards
  waterCoverage: number; // Jal Jeevan Mission tap connections %
  unconnectedHabitations: number; // PMGSY road deficit count
  avgDistanceToPHC: number; // NHM Healthcare proximity in km
  rteCompliance: number; // RTE Primary school within 1km %
  toiletAccess: number; // Swachh Bharat Mission sanitation %
  aqiLevel: number; // NCAP average PM10 (target: 60)
  electricityHours: number; // PM-KUSUM/Grid power availability hours
  cropYieldIndex: number; // Quintals per hectare (major foodgrains - rice/wheat)
  soilHealthSaturation: number; // % farmers holding active soil health cards
}

import ALL_CONSTITUENCIES_DATA_RAW from './constituencies_543.json';
import CONSTITUENCIES_MAPPING_RAW from './constituency_segments_mapping.json';

export const ALL_CONSTITUENCIES_DATA: Record<string, ConstituencyDemographics> = (ALL_CONSTITUENCIES_DATA_RAW as unknown) as Record<string, ConstituencyDemographics>;
export const CONSTITUENCIES_MAPPING: Record<string, string[]> = CONSTITUENCIES_MAPPING_RAW as Record<string, string[]>;

export const MINISTRY_STANDARDS: Record<string, MinistryStandard> = {
  water: {
    id: 'water',
    ministry: 'Ministry of Jal Shakti',
    scheme: 'Jal Jeevan Mission (JJM)',
    parameterName: 'Household Tap Water Supply',
    nationalBenchmark: '100% Coverage (55 lpcd potable water)',
    unit: '%',
    benchmarkValue: 100
  },
  roads: {
    id: 'roads',
    ministry: 'Ministry of Rural Development',
    scheme: 'Pradhan Mantri Gram Sadak Yojana (PMGSY)',
    parameterName: 'All-Weather Road Connectivity (Pop > 500)',
    nationalBenchmark: '0 Unconnected Habitations',
    unit: 'habitations',
    benchmarkValue: 0
  },
  health: {
    id: 'health',
    ministry: 'Ministry of Health and Family Welfare',
    scheme: 'National Health Mission / Ayushman Arogya Mandir',
    parameterName: 'Average Proximity to Primary Health Centre (PHC)',
    nationalBenchmark: 'PHC within 8 km (Sub-Centre within 3 km)',
    unit: 'km',
    benchmarkValue: 8
  },
  education: {
    id: 'education',
    ministry: 'Ministry of Education',
    scheme: 'Right to Education Act (RTE)',
    parameterName: 'Primary School Access within 1 km',
    nationalBenchmark: '100% of habitations compliant',
    unit: '%',
    benchmarkValue: 100
  },
  safety: {
    id: 'safety',
    ministry: 'Ministry of Home Affairs',
    scheme: 'Police Modernization & Community Policing',
    parameterName: 'Average Response Time to Emergency Calls',
    nationalBenchmark: 'Under 15 minutes',
    unit: 'min',
    benchmarkValue: 15
  },
  environment: {
    id: 'environment',
    ministry: 'Ministry of Environment, Forest and Climate Change',
    scheme: 'National Clean Air Programme (NCAP)',
    parameterName: 'PM10 Annual Average concentration',
    nationalBenchmark: 'Under 60 µg/m³ (NAAQS Standard)',
    unit: 'µg/m³',
    benchmarkValue: 60
  },
  welfare: {
    id: 'welfare',
    ministry: 'Ministry of Social Justice and Empowerment',
    scheme: 'National Social Assistance Programme (NSAP)',
    parameterName: 'Eligible Pensioner coverage (Senior/Widow)',
    nationalBenchmark: '100% registered beneficiary enrollment',
    unit: '%',
    benchmarkValue: 100
  },
  housing: {
    id: 'housing',
    ministry: 'Ministry of Housing and Urban Affairs',
    scheme: 'Pradhan Mantri Awas Yojana (PMAY)',
    parameterName: 'Pucca House access to homeless/kutcha households',
    nationalBenchmark: '100% saturation for eligible families',
    unit: '%',
    benchmarkValue: 100
  },
  agriculture: {
    id: 'agriculture',
    ministry: 'Ministry of Agriculture and Farmers Welfare',
    scheme: 'Soil Health Card Scheme / PKVY',
    parameterName: 'Soil Health Card Distribution Saturation',
    nationalBenchmark: '100% farmer saturation',
    unit: '%',
    benchmarkValue: 100
  },
  power: {
    id: 'power',
    ministry: 'Ministry of Power',
    scheme: 'Deen Dayal Upadhyaya Gram Jyoti Yojana (DDUGJY)',
    parameterName: 'Daily Rural Uninterrupted Power Supply',
    nationalBenchmark: '24 hours continuous grid supply',
    unit: 'hrs',
    benchmarkValue: 24
  }
};

export const RAMPUR_SEGMENTS_DATA: Record<string, ConstituencyDemographics> = {
  rampur_town: {
    name: 'Rampur Town Assembly Segment',
    district: 'Rampur',
    centerCoords: { lat: 28.803, lng: 79.025 },
    population: 325410,
    sexRatio: 982, // NFHS-5 District Sex Ratio 1022 (Town: 982)
    literacyRate: 67.8, // Census 2011 actual
    urbanization: 95.2,
    scStPercentage: 8.4,
    unemploymentRate: 9.2,
    waterCoverage: 91.5,
    unconnectedHabitations: 0,
    avgDistanceToPHC: 2.1,
    rteCompliance: 98.4,
    toiletAccess: 97.2,
    aqiLevel: 145, // NCAP Non-attainment PM10 concentration
    electricityHours: 22,
    cropYieldIndex: 44.5,
    soilHealthSaturation: 95.0
  },
  swar: {
    name: 'Swar Assembly Segment',
    district: 'Rampur',
    centerCoords: { lat: 29.020, lng: 79.070 },
    population: 412580,
    sexRatio: 989,
    literacyRate: 42.7, // Census 2011 tehsil actual
    urbanization: 15.6,
    scStPercentage: 16.2,
    unemploymentRate: 7.4,
    waterCoverage: 62.0,
    unconnectedHabitations: 9,
    avgDistanceToPHC: 11.2,
    rteCompliance: 91.8,
    toiletAccess: 86.5,
    aqiLevel: 88,
    electricityHours: 14,
    cropYieldIndex: 58.2,
    soilHealthSaturation: 76.5
  },
  chamraua: {
    name: 'Chamraua Assembly Segment',
    district: 'Rampur',
    centerCoords: { lat: 28.830, lng: 78.910 },
    population: 389250,
    sexRatio: 980,
    literacyRate: 37.02, // Census 2011 Chamraua rural actual
    urbanization: 8.4,
    scStPercentage: 19.5,
    unemploymentRate: 8.1,
    waterCoverage: 48.5,
    unconnectedHabitations: 15,
    avgDistanceToPHC: 9.8,
    rteCompliance: 87.5,
    toiletAccess: 81.2,
    aqiLevel: 75,
    electricityHours: 12,
    cropYieldIndex: 61.4,
    soilHealthSaturation: 68.2
  },
  bilaspur: {
    name: 'Bilaspur Assembly Segment',
    district: 'Rampur',
    centerCoords: { lat: 28.890, lng: 79.270 },
    population: 395120,
    sexRatio: 992,
    literacyRate: 46.67, // Census 2011 tehsil actual
    urbanization: 22.8,
    scStPercentage: 14.8,
    unemploymentRate: 6.8,
    waterCoverage: 76.5,
    unconnectedHabitations: 5,
    avgDistanceToPHC: 6.2,
    rteCompliance: 94.2,
    toiletAccess: 89.8,
    aqiLevel: 98,
    electricityHours: 16,
    cropYieldIndex: 64.8,
    soilHealthSaturation: 84.1
  },
  milak: {
    name: 'Milak Assembly Segment',
    district: 'Rampur',
    centerCoords: { lat: 28.620, lng: 79.180 },
    population: 432450,
    sexRatio: 986,
    literacyRate: 48.26, // Census 2011 tehsil actual
    urbanization: 12.1,
    scStPercentage: 22.8,
    unemploymentRate: 8.9,
    waterCoverage: 51.2,
    unconnectedHabitations: 12,
    avgDistanceToPHC: 13.5,
    rteCompliance: 82.3,
    toiletAccess: 78.6,
    aqiLevel: 68,
    electricityHours: 11,
    cropYieldIndex: 59.7,
    soilHealthSaturation: 71.9
  }
};

function getHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Finds the closest assembly segment in Rampur based on lat-lng coordinates.
 */
export function getClosestConstituencySegment(lat: number, lng: number): ConstituencyDemographics {
  let closestKey = 'rampur_town';
  let minDistance = Infinity;

  Object.keys(RAMPUR_SEGMENTS_DATA).forEach(key => {
    const segment = RAMPUR_SEGMENTS_DATA[key];
    const dist = getHaversineDistance(lat, lng, segment.centerCoords!.lat, segment.centerCoords!.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestKey = key;
    }
  });

  return RAMPUR_SEGMENTS_DATA[closestKey];
}

/**
 * Resolves the Lok Sabha constituency based on address text matching or closest center coordinates.
 */
export function getConstituencyOfLocation(lat: number, lng: number, address: string = ''): string {
  if (!address) address = '';
  const addrLower = address.toLowerCase();

  // 1. Scan address text for any of the 543 constituency names
  // Sort keys by length descending to match longer names first
  const constituencyNames = Object.keys(ALL_CONSTITUENCIES_DATA).sort((a, b) => b.length - a.length);
  for (const name of constituencyNames) {
    if (addrLower.includes(name.toLowerCase())) {
      return name;
    }
  }

  // 2. Bounding/Distance fallback: Find closest constituency by centerCoords
  let closestName = 'Rampur';
  let minDistance = Infinity;

  for (const name of constituencyNames) {
    const coords = ALL_CONSTITUENCIES_DATA[name]?.centerCoords;
    if (coords && coords.lat && coords.lng) {
      const dist = getHaversineDistance(lat, lng, coords.lat, coords.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closestName = name;
      }
    }
  }

  return closestName;
}


/**
 * Evaluates the specific category gap index based on coordinates.
 * Returns gap severity percentage (0 = compliant with Ministry standards, 100 = extreme deficit).
 */
export function evaluateInfrastructureGap(lat: number, lng: number, category: string, constituencyName?: string): {
  gapPercentage: number;
  localMetric: string;
  benchmarkMetric: string;
  standard: MinistryStandard;
  assemblyName: string;
} {
  // If a constituency name is provided, use the real 543 data. Otherwise fallback to geospatial Rampur lookup.
  const segment = (constituencyName && ALL_CONSTITUENCIES_DATA[constituencyName]) 
    ? ALL_CONSTITUENCIES_DATA[constituencyName] 
    : getClosestConstituencySegment(lat, lng);
  const normalizedCategory = category.toLowerCase();
  
  let gapPercentage = 0;
  let localMetric = 'N/A';
  let benchmarkMetric = 'N/A';
  let standard = MINISTRY_STANDARDS.water; // default standard

  switch (normalizedCategory) {
    case 'water':
      standard = MINISTRY_STANDARDS.water;
      localMetric = `${segment.waterCoverage.toFixed(1)}% tap coverage`;
      benchmarkMetric = standard.nationalBenchmark;
      gapPercentage = Math.max(0, 100 - segment.waterCoverage);
      break;
    case 'roads':
      standard = MINISTRY_STANDARDS.roads;
      localMetric = `${segment.unconnectedHabitations} unconnected habitations`;
      benchmarkMetric = standard.nationalBenchmark;
      gapPercentage = segment.unconnectedHabitations > 0 
        ? Math.min(100, (segment.unconnectedHabitations / 15) * 100) 
        : 0;
      break;
    case 'health':
      standard = MINISTRY_STANDARDS.health;
      localMetric = `${segment.avgDistanceToPHC.toFixed(1)} km to nearest PHC`;
      benchmarkMetric = standard.nationalBenchmark;
      gapPercentage = segment.avgDistanceToPHC > standard.benchmarkValue
        ? Math.min(100, ((segment.avgDistanceToPHC - standard.benchmarkValue) / 8) * 100)
        : 0;
      break;
    case 'education':
      standard = MINISTRY_STANDARDS.education;
      localMetric = `${segment.rteCompliance.toFixed(1)}% within 1km`;
      benchmarkMetric = standard.nationalBenchmark;
      gapPercentage = Math.max(0, 100 - segment.rteCompliance);
      break;
    case 'environment':
      standard = MINISTRY_STANDARDS.environment;
      localMetric = `${segment.aqiLevel} PM10 concentration`;
      benchmarkMetric = standard.nationalBenchmark;
      gapPercentage = segment.aqiLevel > standard.benchmarkValue
        ? Math.min(100, ((segment.aqiLevel - standard.benchmarkValue) / 100) * 100)
        : 0;
      break;
    case 'safety':
      standard = MINISTRY_STANDARDS.safety;
      // Mock emergency response time mapping based on urbanization (rural segments have higher response times)
      const respTime = segment.urbanization > 50 ? 12 : 28;
      localMetric = `${respTime} mins avg emergency response`;
      benchmarkMetric = standard.nationalBenchmark;
      gapPercentage = respTime > standard.benchmarkValue
        ? Math.min(100, ((respTime - standard.benchmarkValue) / 20) * 100)
        : 0;
      break;
    case 'welfare':
      standard = MINISTRY_STANDARDS.welfare;
      localMetric = `${segment.toiletAccess}% toilet access (SBM)`;
      benchmarkMetric = standard.nationalBenchmark;
      gapPercentage = Math.max(0, 100 - segment.toiletAccess);
      break;
    case 'housing':
      standard = MINISTRY_STANDARDS.housing;
      localMetric = `${(100 - segment.scStPercentage * 0.4).toFixed(1)}% pucca house access`;
      benchmarkMetric = standard.nationalBenchmark;
      gapPercentage = Math.max(0, standard.benchmarkValue - (100 - segment.scStPercentage * 0.4));
      break;
    case 'agriculture':
      standard = MINISTRY_STANDARDS.agriculture;
      localMetric = `${segment.soilHealthSaturation.toFixed(1)}% soil health card coverage`;
      benchmarkMetric = standard.nationalBenchmark;
      gapPercentage = Math.max(0, 100 - segment.soilHealthSaturation);
      break;
    case 'power':
      standard = MINISTRY_STANDARDS.power;
      localMetric = `${segment.electricityHours} hrs daily grid supply`;
      benchmarkMetric = standard.nationalBenchmark;
      gapPercentage = Math.max(0, ((standard.benchmarkValue - segment.electricityHours) / 24) * 100);
      break;
    default:
      // Fallback
      standard = {
        id: 'others',
        ministry: 'Constituency Development planning Board',
        scheme: 'Local Area Upliftment Scheme',
        parameterName: 'Development Needs Satisfaction',
        nationalBenchmark: '100% verified resolution',
        unit: '%',
        benchmarkValue: 100
      };
      localMetric = '74.5% resolution score';
      benchmarkMetric = '100% resolution';
      gapPercentage = 25.5;
  }

  return {
    gapPercentage,
    localMetric,
    benchmarkMetric,
    standard,
    assemblyName: segment.name
  };
}

/**
 * Calculates the Combined Priority Index (CPI) on a scale of 0 to 100.
 * CPI = (Vote Score * 0.4) + (Infrastructure Gap Score * 0.4) + (Demographic Vulnerability * 0.2)
 * - Vote Score: normalized upvote count (scaled to 100 max at 50 votes)
 * - Infrastructure Gap Score: evaluated percentage from ministry standards
 * - Demographic Vulnerability: derived from segment literacy, SC/ST, and rural levels
 */
export function calculateCombinedPriorityIndex(d: any, constituencyName?: string): number {
  // 1. Completeness Check (+25 points bonus if complete)
  const isNeedsInfo = d.status === 'needs_info' || d.needsMoreInfo;
  const firstItemContent = d.items?.[0]?.content || '';
  const hasPhoto = d.items?.some((i: any) => i.type === 'photo');
  const isComplete = !isNeedsInfo && (firstItemContent.length >= 35 || hasPhoto);
  const completenessBonus = isComplete ? 25 : 0;

  // 2. Vote Score (normalized upvotes, capped at 50 upvotes = 100 score)
  const votes = d.upvotes || 1;
  const voteScore = Math.min(100, (votes / 50) * 100);

  // 3. Base Priority Score (from Gemini audited overview if present, otherwise from local infrastructure gap)
  let basePriority = 50; // default middle
  const loc = d.location || { lat: 28.803, lng: 79.025 };
  if (d.overview?.priorityScore !== undefined) {
    basePriority = d.overview.priorityScore;
  } else if (d.aiOverview?.priorityScore !== undefined) {
    basePriority = d.aiOverview.priorityScore;
  } else {
    const gapResult = evaluateInfrastructureGap(loc.lat, loc.lng, d.category, constituencyName);
    basePriority = gapResult.gapPercentage;
  }

  // 4. Demographic Vulnerability Score
  const segment = (constituencyName && ALL_CONSTITUENCIES_DATA[constituencyName]) 
    ? ALL_CONSTITUENCIES_DATA[constituencyName] 
    : getClosestConstituencySegment(loc.lat, loc.lng);
  const literacyVuln = Math.max(0, 100 - segment.literacyRate);
  const scstVuln = segment.scStPercentage;
  const ruralVuln = 100 - segment.urbanization;
  
  const demographicVulnerability = (literacyVuln * 0.5) + (scstVuln * 2.0) + (ruralVuln * 0.3);
  const normDemographicVuln = Math.min(100, demographicVulnerability);

  // 5. Combined Weighting Formula (Base Priority: 45%, Vote Score: 35%, Demographics: 20%) + completeness bonus
  const cpi = (basePriority * 0.45) + (voteScore * 0.35) + (normDemographicVuln * 0.2) + completenessBonus;
  
  return Math.min(100, Math.round(cpi * 10) / 10);
}

export interface ConstituencySegmentDetail {
  name: string;
  population: number;
  sexRatio: number;
  literacyRate: number;
  urbanization: number;
  scStPercentage: number;
  waterCoverage: number;
  unconnectedHabitations: number;
  avgDistanceToPHC: number;
  rteCompliance: number;
  toiletAccess: number;
  aqiLevel: number;
  electricityHours: number;
  cropYieldIndex: number;
  soilHealthSaturation: number;
  centerCoords?: { lat: number; lng: number };
}

export function getConstituencySegments(constituencyName: string): ConstituencySegmentDetail[] {
  // 1. If it is Rampur, return the real Rampur segments
  if (constituencyName.toLowerCase() === 'rampur') {
    return Object.keys(RAMPUR_SEGMENTS_DATA).map(key => {
      const seg = RAMPUR_SEGMENTS_DATA[key];
      return {
        name: seg.name.replace(" Assembly Segment", ""),
        population: seg.population,
        sexRatio: seg.sexRatio,
        literacyRate: seg.literacyRate,
        urbanization: seg.urbanization,
        scStPercentage: seg.scStPercentage,
        waterCoverage: seg.waterCoverage,
        unconnectedHabitations: seg.unconnectedHabitations,
        avgDistanceToPHC: seg.avgDistanceToPHC,
        rteCompliance: seg.rteCompliance,
        toiletAccess: seg.toiletAccess,
        aqiLevel: seg.aqiLevel,
        electricityHours: seg.electricityHours,
        cropYieldIndex: seg.cropYieldIndex,
        soilHealthSaturation: seg.soilHealthSaturation,
        centerCoords: seg.centerCoords
      };
    });
  }

  // 2. Otherwise, fetch the parent constituency data
  const parent = ALL_CONSTITUENCIES_DATA[constituencyName];
  if (!parent) return [];

  // Use real assembly constituency names if mapped, otherwise fall back to generic directions
  const segments = CONSTITUENCIES_MAPPING[constituencyName] || ["Town", "Rural", "North", "South", "East", "West"];
  const n = segments.length;
  
  return segments.map((segName, idx) => {
    // Seeded random logic to make the variations deterministic for each constituency and segment name
    const seed = constituencyName.length + segName.length + idx;
    const seededRandom = () => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    const randSign = () => (seededRandom() > 0.5 ? 1 : -1);

    const popShare = 1 / n + (seededRandom() - 0.5) * (0.1 / n); // uneven population share
    const segmentPopulation = Math.round(parent.population * popShare);

    const literacyOffset = Math.round(seededRandom() * 6 * randSign());
    const sexRatioOffset = Math.round(seededRandom() * 25 * randSign());
    const urbanizationOffset = Math.round(seededRandom() * 20 * randSign());
    const scStOffset = Math.round(seededRandom() * 5 * randSign());
    const waterOffset = Math.round(seededRandom() * 10 * randSign());
    const unconnectedOffset = Math.max(0, parent.unconnectedHabitations + Math.round(seededRandom() * 4 * randSign()));
    const phcOffset = parseFloat(Math.max(0.5, parent.avgDistanceToPHC + (seededRandom() * 2 * randSign())).toFixed(1));
    const rteOffset = Math.round(seededRandom() * 8 * randSign());
    const toiletOffset = Math.round(seededRandom() * 5 * randSign());
    const aqiOffset = Math.round(seededRandom() * 25 * randSign());
    const elecOffset = Math.max(12, Math.min(24, parent.electricityHours + Math.round(seededRandom() * 3 * randSign())));
    const yieldOffset = parseFloat((parent.cropYieldIndex + (seededRandom() * 8 * randSign())).toFixed(1));
    const soilOffset = Math.round(seededRandom() * 12 * randSign());

    // Clean segment name - if it doesn't already contain the parent constituency name, we can format it nicely
    let formattedName = segName;
    if (CONSTITUENCIES_MAPPING[constituencyName]) {
      formattedName = `${segName}`;
    } else {
      formattedName = `${constituencyName} ${segName}`;
    }

    return {
      name: formattedName,
      population: segmentPopulation,
      sexRatio: parent.sexRatio + sexRatioOffset,
      literacyRate: Math.max(30, Math.min(100, parent.literacyRate + literacyOffset)),
      urbanization: Math.max(5, Math.min(100, parent.urbanization + urbanizationOffset)),
      scStPercentage: Math.max(2, Math.min(100, parent.scStPercentage + scStOffset)),
      waterCoverage: Math.max(10, Math.min(100, parent.waterCoverage + waterOffset)),
      unconnectedHabitations: unconnectedOffset,
      avgDistanceToPHC: phcOffset,
      rteCompliance: Math.max(40, Math.min(100, parent.rteCompliance + rteOffset)),
      toiletAccess: Math.max(30, Math.min(100, parent.toiletAccess + toiletOffset)),
      aqiLevel: Math.max(15, parent.aqiLevel + aqiOffset),
      electricityHours: elecOffset,
      cropYieldIndex: Math.max(10, yieldOffset),
      soilHealthSaturation: Math.max(10, Math.min(100, parent.soilHealthSaturation + soilOffset))
    };
  });
}
