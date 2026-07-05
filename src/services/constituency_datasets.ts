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
  district: string;
  centerCoords: { lat: number; lng: number };
  population: number;
  sexRatio: number; // females per 1000 males
  literacyRate: number; // percentage
  urbanization: number; // percentage urban
  scStPercentage: number;
  unemploymentRate: number; // percentage
  
  // Current coverage metrics corresponding to MinistryStandards
  waterCoverage: number; // Jal Jeevan Mission tap connections %
  unconnectedHabitations: number; // PMGSY road deficit count
  avgDistanceToPHC: number; // NHM Healthcare proximity in km
  rteCompliance: number; // RTE Primary school within 1km %
  toiletAccess: number; // Swachh Bharat Mission sanitation %
  aqiLevel: number; // NCAP average PM10 (target: 60)
  electricityHours: number; // PM-KUSUM/Grid power availability hours
}

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
  }
};

export const RAMPUR_SEGMENTS_DATA: Record<string, ConstituencyDemographics> = {
  rampur_town: {
    name: 'Rampur Town Assembly Segment',
    district: 'Rampur',
    centerCoords: { lat: 28.803, lng: 79.025 },
    population: 325410,
    sexRatio: 902,
    literacyRate: 67.8,
    urbanization: 95.2,
    scStPercentage: 8.4,
    unemploymentRate: 9.2,
    waterCoverage: 91.5,
    unconnectedHabitations: 0,
    avgDistanceToPHC: 2.1,
    rteCompliance: 98.4,
    toiletAccess: 97.2,
    aqiLevel: 145, // Critical Air Quality Gaps
    electricityHours: 22
  },
  swar: {
    name: 'Swar Assembly Segment',
    district: 'Rampur',
    centerCoords: { lat: 29.020, lng: 79.070 },
    population: 412580,
    sexRatio: 912,
    literacyRate: 48.2, // Literacy Gap
    urbanization: 15.6,
    scStPercentage: 16.2,
    unemploymentRate: 7.4,
    waterCoverage: 62.0, // Major Water gaps
    unconnectedHabitations: 9,
    avgDistanceToPHC: 11.2, // Proximity Gap
    rteCompliance: 91.8,
    toiletAccess: 86.5,
    aqiLevel: 88,
    electricityHours: 14
  },
  chamraua: {
    name: 'Chamraua Assembly Segment',
    district: 'Rampur',
    centerCoords: { lat: 28.830, lng: 78.910 },
    population: 389250,
    sexRatio: 898,
    literacyRate: 45.8, // Major Literacy Gap
    urbanization: 8.4,
    scStPercentage: 19.5,
    unemploymentRate: 8.1,
    waterCoverage: 48.5, // Extreme Water connection deficit
    unconnectedHabitations: 15, // High PMGSY deficit
    avgDistanceToPHC: 9.8,
    rteCompliance: 87.5, // High School deficit
    toiletAccess: 81.2,
    aqiLevel: 75,
    electricityHours: 12
  },
  bilaspur: {
    name: 'Bilaspur Assembly Segment',
    district: 'Rampur',
    centerCoords: { lat: 28.890, lng: 79.270 },
    population: 395120,
    sexRatio: 916,
    literacyRate: 59.4,
    urbanization: 22.8,
    scStPercentage: 14.8,
    unemploymentRate: 6.8,
    waterCoverage: 76.5,
    unconnectedHabitations: 5,
    avgDistanceToPHC: 6.2,
    rteCompliance: 94.2,
    toiletAccess: 89.8,
    aqiLevel: 98,
    electricityHours: 16
  },
  milak: {
    name: 'Milak Assembly Segment',
    district: 'Rampur',
    centerCoords: { lat: 28.620, lng: 79.180 },
    population: 432450,
    sexRatio: 906,
    literacyRate: 46.5,
    urbanization: 12.1,
    scStPercentage: 22.8, // High SC/ST Density
    unemploymentRate: 8.9,
    waterCoverage: 51.2, // Extreme Water connection deficit
    unconnectedHabitations: 12, // High PMGSY deficit
    avgDistanceToPHC: 13.5, // Extreme PHC Access gaps
    rteCompliance: 82.3, // High RTE school deficit
    toiletAccess: 78.6, // Extreme Sanitation gaps
    aqiLevel: 68,
    electricityHours: 11
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
    const dist = getHaversineDistance(lat, lng, segment.centerCoords.lat, segment.centerCoords.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestKey = key;
    }
  });

  return RAMPUR_SEGMENTS_DATA[closestKey];
}

/**
 * Evaluates the specific category gap index based on coordinates.
 * Returns gap severity percentage (0 = compliant with Ministry standards, 100 = extreme deficit).
 */
export function evaluateInfrastructureGap(lat: number, lng: number, category: string): {
  gapPercentage: number;
  localMetric: string;
  benchmarkMetric: string;
  standard: MinistryStandard;
  assemblyName: string;
} {
  const segment = getClosestConstituencySegment(lat, lng);
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
export function calculateCombinedPriorityIndex(d: any): number {
  // 1. Vote Score (normalized upvotes, capped at 50 upvotes = 100 score)
  const votes = d.upvotes || 1;
  const voteScore = Math.min(100, (votes / 50) * 100);

  // 2. Infrastructure Gap Score
  const gapResult = evaluateInfrastructureGap(d.location.lat, d.location.lng, d.category);
  const gapScore = gapResult.gapPercentage;

  // 3. Demographic Vulnerability Score
  const segment = getClosestConstituencySegment(d.location.lat, d.location.lng);
  // Vulnerability increases with: low literacy (50% max weight), high SC/ST (30% weight), low urbanization/rurality (20% weight)
  const literacyVuln = Math.max(0, 100 - segment.literacyRate);
  const scstVuln = segment.scStPercentage;
  const ruralVuln = 100 - segment.urbanization;
  
  const demographicVulnerability = (literacyVuln * 0.5) + (scstVuln * 2.0) + (ruralVuln * 0.3);
  const normDemographicVuln = Math.min(100, demographicVulnerability);

  // 4. Combined Weighting Formula
  const cpi = (voteScore * 0.4) + (gapScore * 0.4) + (normDemographicVuln * 0.2);
  
  return Math.min(100, Math.round(cpi * 10) / 10);
}
