import { useState, useEffect, useRef } from 'react';
import { 
  Network, 
  Megaphone, 
  Database, 
  Award, 
  ArrowRight, 
  Sparkles,
  Trash2,
  Loader2,
  CheckCircle,
  Upload,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Info
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import { submitDemand, getNearbyHotspots, upvoteDemand } from './services/db';

// ISO 639-1 / Google Translate codes for the 22 Scheduled Indian Languages + English
const INDIAN_LANGUAGES = [
  { name: 'English', code: 'en' },
  { name: 'हिंदी (Hindi)', code: 'hi' },
  { name: 'বাংলা (Bengali)', code: 'bn' },
  { name: 'తెలుగు (Telugu)', code: 'te' },
  { name: 'मराठी (Marathi)', code: 'mr' },
  { name: 'தமிழ் (Tamil)', code: 'ta' },
  { name: 'ગુજરાતી (Gujarati)', code: 'gu' },
  { name: 'ಕನ್ನಡ (Kannada)', code: 'kn' },
  { name: 'മലയാളം (Malayalam)', code: 'ml' },
  { name: 'ଓଡ଼िଆ (Odia)', code: 'or' },
  { name: 'ਪੰਜਾਬੀ (Punjabi)', code: 'pa' },
  { name: 'অসমীয়া (Assamese)', code: 'as' },
  { name: 'اردو (Urdu)', code: 'ur' },
  { name: 'संस्कृतम् (Sanskrit)', code: 'sa' },
  { name: 'नेपाली (Nepali)', code: 'ne' },
  { name: 'सिंधी (Sindhi)', code: 'sd' },
  { name: 'कोंकणी (Konkani)', code: 'kok' },
  { name: 'डोगरी (Dogri)', code: 'doi' },
  { name: 'मैथिली (Maithili)', code: 'mai' },
  { name: 'मणिपुरी (Manipuri)', code: 'mni' },
  { name: 'बोडो (Bodo)', code: 'brx' },
  { name: 'संथाली (Santali)', code: 'sat' },
  { name: 'कश्मीरी (Kashmiri)', code: 'ks' }
];

// Helper to retrieve cookie by name
const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
};

// Helper to parse current translation language code from Google Translate cookie
const getActiveLangCode = () => {
  const val = getCookie('googtrans');
  if (val) {
    const parts = val.split('/');
    if (parts.length >= 3) {
      return parts[parts.length - 1].toLowerCase();
    }
  }
  return null;
};

// Helper to fetch the initial language code reliably
export const getInitialLanguage = () => {
  const cookieVal = getActiveLangCode();
  if (cookieVal) {
    localStorage.setItem('jansetu_lang', cookieVal);
    return cookieVal;
  }
  const localVal = localStorage.getItem('jansetu_lang');
  if (localVal) return localVal;
  return 'en';
};

// Language Dropdown Selector Component
export function LanguageSelector({ selectedLang, setSelectedLang }: { selectedLang: string; setSelectedLang: (code: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync active language code on mount
  useEffect(() => {
    const active = getInitialLanguage();
    setSelectedLang(active);
  }, [setSelectedLang]);

  // Programmatically sync Google Translate dropdown element with selectedLang state
  useEffect(() => {
    let attempts = 0;
    const interval = setInterval(() => {
      const selectElement = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
      if (selectElement) {
        const hasOption = Array.from(selectElement.options).some(opt => opt.value === selectedLang);
        if (hasOption) {
          if (selectElement.value !== selectedLang) {
            selectElement.value = selectedLang;
            selectElement.dispatchEvent(new Event('change'));
          }
          clearInterval(interval);
        }
      }
      attempts++;
      if (attempts > 30) {
        clearInterval(interval);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [selectedLang]);

  // Handle outside clicks to close the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const changeLanguage = (langCode: string) => {
    // 1. Store in localStorage for persistent UI state
    localStorage.setItem('jansetu_lang', langCode);
    setSelectedLang(langCode);

    // 2. Set the cookie at root path so Google Translate can read it on startup/transition
    document.cookie = `googtrans=/en/${langCode}; path=/;`;
    setIsOpen(false);

    // 3. Reload page to prevent React virtual DOM mismatches and apply fresh translation
    window.location.reload();
  };

  const currentLangName = INDIAN_LANGUAGES.find(l => l.code === selectedLang)?.name || 'English';

  return (
    <div className="lang-selector-container notranslate skiptranslate" ref={dropdownRef}>
      <button className="lang-btn" onClick={() => setIsOpen(!isOpen)}>
        <span>🌐 {currentLangName}</span>
      </button>
      {isOpen && (
        <div className="lang-dropdown">
          {INDIAN_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              className={`lang-item ${selectedLang === lang.code ? 'active' : ''}`}
              onClick={() => changeLanguage(lang.code)}
            >
              <span>{lang.name}</span>
              {selectedLang === lang.code && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Google Maps integration and loader hook
export function useGoogleMapsLoader(apiKey: string) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const google = (window as any).google;
    if (google && google.maps) {
      setIsLoaded(true);
      return;
    }

    const scriptId = 'google-maps-api-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const handleLoad = () => setIsLoaded(true);
    const handleError = () => setLoadError('Failed to load Google Maps.');

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = apiKey
        ? `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
        : `https://maps.googleapis.com/maps/api/js?libraries=places`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else {
      const googleCheck = (window as any).google;
      if (googleCheck && googleCheck.maps) {
        setIsLoaded(true);
      }
    }

    script.addEventListener('load', handleLoad);
    script.addEventListener('error', handleError);

    return () => {
      if (script) {
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
      }
    };
  }, [apiKey]);

  return { isLoaded, loadError };
}

interface Location {
  lat: number;
  lng: number;
}

interface LocationInsights {
  nearestSchool?: { name: string; distance: number };
  nearestHospital?: { name: string; distance: number };
}

function getHaversineDistance(loc1: { lat: number; lng: number }, loc2: { lat: number; lng: number }) {
  const R = 6371; // Earth's radius in km
  const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
  const dLng = (loc2.lng - loc1.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

interface GoogleMapComponentProps {
  apiKey: string;
  onLocationSelect: (loc: Location, address: string, insights?: LocationInsights) => void;
  selectedLocation: Location | null;
  nearbyHotspots: any[];
}

function GoogleMapComponent({ apiKey, onLocationSelect, selectedLocation, nearbyHotspots }: GoogleMapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const hotspotMarkersRef = useRef<any[]>([]);
  const { isLoaded, loadError } = useGoogleMapsLoader(apiKey);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    const google = (window as any).google;
    if (!google || !google.maps) return;

    const defaultCenter = selectedLocation || { lat: 20.5937, lng: 78.9629 };
    const defaultZoom = selectedLocation ? 15 : 5;

    const map = new google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#09081a' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#09081a' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#8e90b3' }] },
        { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#a5b4fc' }, { weight: 1.5 }] },
        { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#4f46e5' }, { weight: 1.0 }] },
        { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d5d6f2' }] },
        { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#a5a7cc' }] },
        { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0e0d24' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e1c38' }] },
        { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0c0b1f' }] },
        { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8e90b3' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#04030d' }] },
        { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4d4f7c' }] }
      ]
    });
    mapInstanceRef.current = map;

    const marker = new google.maps.Marker({
      map,
      draggable: true,
      animation: google.maps.Animation.DROP
    });
    markerRef.current = marker;

    if (selectedLocation) {
      marker.setPosition(selectedLocation);
    }

    const queryPlacesInsights = (latLng: any, addressStr: string) => {
      const googleObj = (window as any).google;
      const loc = { lat: typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat, lng: typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng };
      
      if (!googleObj || !googleObj.maps || !googleObj.maps.places || !mapInstanceRef.current) {
        onLocationSelect(loc, addressStr);
        return;
      }

      const service = new googleObj.maps.places.PlacesService(mapInstanceRef.current);
      const googleLatLng = typeof latLng.lat === 'function' ? latLng : new googleObj.maps.LatLng(loc.lat, loc.lng);
      
      const insights: LocationInsights = {};

      service.nearbySearch({
        location: googleLatLng,
        radius: 5000,
        type: 'school'
      }, (schoolResults: any, status1: any) => {
        if (status1 === googleObj.maps.places.PlacesServiceStatus.OK && schoolResults && schoolResults.length > 0) {
          const closest = schoolResults[0];
          const schoolLoc = { lat: closest.geometry.location.lat(), lng: closest.geometry.location.lng() };
          insights.nearestSchool = {
            name: closest.name,
            distance: getHaversineDistance(loc, schoolLoc)
          };
        }

        service.nearbySearch({
          location: googleLatLng,
          radius: 5000,
          type: 'hospital'
        }, (hospitalResults: any, status2: any) => {
          if (status2 === googleObj.maps.places.PlacesServiceStatus.OK && hospitalResults && hospitalResults.length > 0) {
            const closest = hospitalResults[0];
            const hospLoc = { lat: closest.geometry.location.lat(), lng: closest.geometry.location.lng() };
            insights.nearestHospital = {
              name: closest.name,
              distance: getHaversineDistance(loc, hospLoc)
            };
          }

          onLocationSelect(loc, addressStr, insights);
        });
      });
    };

    const handleGeocode = (latLng: any) => {
      setGeocoding(true);
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: latLng }, (results: any, status: any) => {
        setGeocoding(false);
        let address = '';
        if (status === 'OK' && results && results[0]) {
          address = results[0].formatted_address;
        } else {
          address = `Coordinates: ${latLng.lat().toFixed(5)}, ${latLng.lng().toFixed(5)}`;
        }
        queryPlacesInsights(latLng, address);
      });
    };

    map.addListener('click', (e: any) => {
      if (e.latLng) {
        marker.setPosition(e.latLng);
        handleGeocode(e.latLng);
      }
    });

    marker.addListener('dragend', () => {
      const pos = marker.getPosition();
      if (pos) {
        handleGeocode(pos);
      }
    });

    return () => {
      google.maps.event.clearInstanceListeners(map);
      google.maps.event.clearInstanceListeners(marker);
    };
  }, [isLoaded]);

  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current && selectedLocation) {
      mapInstanceRef.current.setCenter(selectedLocation);
      mapInstanceRef.current.setZoom(15);
      markerRef.current.setPosition(selectedLocation);
    }
  }, [selectedLocation]);

  // Handle drawing of nearby hotspot markers
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;
    const google = (window as any).google;
    if (!google) return;

    // Clear old hotspot markers
    hotspotMarkersRef.current.forEach(m => m.setMap(null));
    hotspotMarkersRef.current = [];

    // Create markers for nearby hotspots
    nearbyHotspots.forEach(hotspot => {
      if (selectedLocation && 
          Math.abs(hotspot.location.lat - selectedLocation.lat) < 0.0001 && 
          Math.abs(hotspot.location.lng - selectedLocation.lng) < 0.0001) {
        return;
      }

      const marker = new google.maps.Marker({
        position: hotspot.location,
        map: mapInstanceRef.current,
        title: `${hotspot.category.toUpperCase()}: ${hotspot.upvotes} upvotes`,
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png'
        }
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="color: #000; padding: 4px; font-family: sans-serif;">
            <strong style="text-transform: capitalize; color: #ef4444;">⚠️ ${hotspot.category} Request</strong>
            <p style="margin: 4px 0; font-size: 12px; font-weight: 500;">"${hotspot.items?.[0]?.content || hotspot.address}"</p>
            <span style="font-size: 11px; color: #6366f1; font-weight: 600;">👍 Supported by ${hotspot.upvotes} Citizens</span>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(mapInstanceRef.current, marker);
      });

      hotspotMarkersRef.current.push(marker);
    });
  }, [nearbyHotspots, isLoaded, selectedLocation]);

  const handleAutoDetect = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setGeocoding(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const loc = { lat: latitude, lng: longitude };
        
        const google = (window as any).google;
        if (google && google.maps) {
          const latLng = new google.maps.LatLng(latitude, longitude);
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: latLng }, (results: any, status: any) => {
            setGeocoding(false);
            let address = '';
            if (status === 'OK' && results && results[0]) {
              address = results[0].formatted_address;
            } else {
              address = `Coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
            }
            
            // Query places service
            const googleObj = (window as any).google;
            if (googleObj && googleObj.maps && googleObj.maps.places && mapInstanceRef.current) {
              const service = new googleObj.maps.places.PlacesService(mapInstanceRef.current);
              const insights: LocationInsights = {};
              
              service.nearbySearch({
                location: latLng,
                radius: 5000,
                type: 'school'
              }, (schoolResults: any, status1: any) => {
                if (status1 === googleObj.maps.places.PlacesServiceStatus.OK && schoolResults && schoolResults.length > 0) {
                  const closest = schoolResults[0];
                  const schoolLoc = { lat: closest.geometry.location.lat(), lng: closest.geometry.location.lng() };
                  insights.nearestSchool = {
                    name: closest.name,
                    distance: getHaversineDistance(loc, schoolLoc)
                  };
                }
                
                service.nearbySearch({
                  location: latLng,
                  radius: 5000,
                  type: 'hospital'
                }, (hospitalResults: any, status2: any) => {
                  if (status2 === googleObj.maps.places.PlacesServiceStatus.OK && hospitalResults && hospitalResults.length > 0) {
                    const closest = hospitalResults[0];
                    const hospLoc = { lat: closest.geometry.location.lat(), lng: closest.geometry.location.lng() };
                    insights.nearestHospital = {
                      name: closest.name,
                      distance: getHaversineDistance(loc, hospLoc)
                    };
                  }
                  onLocationSelect(loc, address, insights);
                });
              });
            } else {
              onLocationSelect(loc, address);
            }
          });
        } else {
          setGeocoding(false);
          onLocationSelect(loc, `Detected coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
      },
      (error) => {
        setGeocoding(false);
        alert(`Error detecting location: ${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (loadError) {
    return (
      <div className="map-error-card">
        <p>⚠️ Google Maps failed to load. Please enter a valid API Key below or check your network.</p>
        <button type="button" className="btn-auto-detect" onClick={handleAutoDetect} style={{ marginTop: '12px' }}>
          📍 Try Browser Auto-Detect Location
        </button>
      </div>
    );
  }

  return (
    <div className="map-container">
      {!isLoaded && <div className="map-loading-overlay">Loading Google Maps Canvas...</div>}
      <div ref={mapRef} className="map-canvas" style={{ width: '100%', height: '320px', borderRadius: '12px' }} />
      <div className="map-actions">
        <button type="button" className="btn-auto-detect" onClick={handleAutoDetect} disabled={geocoding}>
          {geocoding ? 'Detecting Location...' : '📍 Auto-Detect My Location'}
        </button>
      </div>
    </div>
  );
}

interface SubmissionItem {
  id: string;
  type: 'text' | 'audio' | 'photo';
  content: string;
  fileUrl?: string;
  fileName?: string;
  processing?: boolean;
  ocrText?: string;
  speechTranscript?: string;
}

interface ComplainantPortalProps {
  selectedLang: string;
  onBack: () => void;
}

const LANG_TO_SPEECH_LOCALE: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  ta: 'ta-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  or: 'or-IN',
  pa: 'pa-IN',
  as: 'as-IN',
  ur: 'ur-IN',
  sa: 'sa-IN',
  ne: 'ne-NP',
  sd: 'sd-IN',
  kok: 'kok-IN',
  doi: 'doi-IN',
  mai: 'mai-IN',
  mni: 'mni-IN',
  brx: 'brx-IN',
  sat: 'sat-IN',
  ks: 'ks-IN'
};

export function ComplainantPortal({ selectedLang, onBack }: ComplainantPortalProps) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  
  const [location, setLocation] = useState<Location | null>(null);
  const [address, setAddress] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('jansetu_gmaps_key') || 'AIzaSyAMU-m9NMhYgCFuizEReDHEThu2Yhwj2Lg');
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('jansetu_gemini_key') || 'AIzaSyAMU-m9NMhYgCFuizEReDHEThu2Yhwj2Lg');
  const [tempGeminiKey, setTempGeminiKey] = useState(geminiKey);
  const [showApiSettings, setShowApiSettings] = useState(false);

  // New structured metadata states
  const [category, setCategory] = useState('others');
  const [scope, setScope] = useState('street');
  const [insights, setInsights] = useState<LocationInsights | null>(null);
  const [nearbyHotspots, setNearbyHotspots] = useState<any[]>([]);
  const [ticketId, setTicketId] = useState('');
  const [aiIndicator, setAiIndicator] = useState<{ active: boolean; message: string }>({ active: false, message: '' });

  const [items, setItems] = useState<SubmissionItem[]>([]);
  const [textNote, setTextNote] = useState('');

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef('');

  // Success modal
  const [showSuccess, setShowSuccess] = useState(false);

  // Query hotspots when location changes
  useEffect(() => {
    if (location) {
      getNearbyHotspots(location.lat, location.lng).then(data => {
        setNearbyHotspots(data);
      });
    }
  }, [location]);

  const handleLocationSelect = (loc: Location, addr: string, locInsights?: LocationInsights) => {
    setLocation(loc);
    setAddress(addr);
    if (locInsights) {
      setInsights(locInsights);
    }
  };

  const handleSaveApiKeys = () => {
    localStorage.setItem('jansetu_gmaps_key', tempApiKey);
    localStorage.setItem('jansetu_gemini_key', tempGeminiKey);
    setApiKey(tempApiKey);
    setGeminiKey(tempGeminiKey);
    alert('API Settings saved. Reloading the page to apply...');
    window.location.reload();
  };

  const handleUpvote = async (id: string) => {
    const updatedVotes = await upvoteDemand(id);
    setNearbyHotspots(prev => prev.map(h => h.id === id ? { ...h, upvotes: updatedVotes } : h));
  };

  const callGeminiExtraction = async (textToAnalyze: string) => {
    const activeKey = localStorage.getItem('jansetu_gemini_key') || 'AIzaSyAMU-m9NMhYgCFuizEReDHEThu2Yhwj2Lg';
    if (!activeKey) return;

    setAiIndicator({ active: true, message: 'AI parsing text inputs...' });

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are the AI engine of Jansetu Citizen Complainant Portal. Analyze the following transcript of a citizen's complaint (submitted in their regional language, translated to English, or in English).
Extract:
1. The category: Choose exactly one from: "water", "roads", "education", "health", "power", "agriculture", "others".
2. The impact scope: Choose exactly one from: "household", "street", "ward", "constituency".

Format the output strictly as a JSON object:
{
  "category": "water",
  "scope": "street"
}

Transcript: "${textToAnalyze}"
JSON:`
            }]
          }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      const json = await response.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const result = JSON.parse(text);
        let matchCount = 0;
        if (result.category) {
          setCategory(result.category);
          matchCount++;
        }
        if (result.scope) {
          setScope(result.scope);
          matchCount++;
        }
        if (matchCount > 0) {
          setAiIndicator({ 
            active: true, 
            message: `✨ AI Auto-Synced: Set Category to "${result.category.toUpperCase()}" & Scope to "${result.scope.toUpperCase()}"` 
          });
          setTimeout(() => setAiIndicator({ active: false, message: '' }), 5000);
        } else {
          setAiIndicator({ active: false, message: '' });
        }
      }
    } catch (e) {
      console.error("Gemini AI extraction failed: ", e);
      setAiIndicator({ active: false, message: '' });
    }
  };

  const handleAddText = () => {
    if (!textNote.trim()) return;
    const content = textNote.trim();
    const newItem: SubmissionItem = {
      id: Date.now().toString(),
      type: 'text',
      content
    };
    setItems(prev => [...prev, newItem]);
    setTextNote('');
    callGeminiExtraction(content);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      // Programmatically turn off translation during recording to prevent live transcript nodes from getting corrupted
      const selectElement = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
      if (selectElement && selectElement.value !== 'en') {
        selectElement.value = 'en';
        selectElement.dispatchEvent(new Event('change'));
      }

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const finalTranscript = liveTranscriptRef.current;

        const newItem: SubmissionItem = {
          id: Date.now().toString(),
          type: 'audio',
          content: finalTranscript || 'Voice recording',
          fileUrl: audioUrl,
          speechTranscript: finalTranscript || '(No speech transcript generated)'
        };

        setItems(prev => [...prev, newItem]);
        setLiveTranscript('');
        liveTranscriptRef.current = '';

        stream.getTracks().forEach(track => track.stop());

        // Restore Google Translate back to selected language
        const restoreSelect = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
        const activeLang = getActiveLangCode() || selectedLang;
        if (restoreSelect && restoreSelect.value !== activeLang) {
          restoreSelect.value = activeLang;
          restoreSelect.dispatchEvent(new Event('change'));
        }

        if (finalTranscript) {
          callGeminiExtraction(finalTranscript);
        }
      };

      // Realtime transcription during recording using browser recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        let recognition = new SpeechRecognition();
        const activeLang = getActiveLangCode() || selectedLang;
        const startLang = LANG_TO_SPEECH_LOCALE[activeLang] || 'en-IN';
        const attemptedLangs = new Set<string>();
        let accumulatedText = '';

        const initRecognition = (langCode: string) => {
          attemptedLangs.add(langCode);
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = langCode;

          recognition.onresult = (event: any) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const transcript = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                accumulatedText += transcript + ' ';
              } else {
                interimTranscript += transcript;
              }
            }
            const currentText = accumulatedText + interimTranscript;
            setLiveTranscript(currentText.trim());
            liveTranscriptRef.current = currentText.trim();
          };

          recognition.onerror = (err: any) => {
            console.error('Speech recognition error:', err);
            if (err.error === 'language-not-supported') {
              let nextLang: string | null = null;
              
              if (langCode.includes('-')) {
                const short = langCode.split('-')[0];
                if (!attemptedLangs.has(short)) {
                  nextLang = short;
                }
              }
              
              if (!nextLang && !langCode.startsWith('hi') && !langCode.startsWith('en')) {
                if (!attemptedLangs.has('hi-IN')) {
                  nextLang = 'hi-IN';
                } else if (!attemptedLangs.has('hi')) {
                  nextLang = 'hi';
                }
              }
              
              if (!nextLang && !attemptedLangs.has('en-IN')) {
                nextLang = 'en-IN';
              }
              
              if (nextLang) {
                console.warn(`Language ${langCode} not supported. Trying fallback ${nextLang}`);
                try {
                  recognition.abort();
                } catch (e) {}

                recognition = new SpeechRecognition();
                initRecognition(nextLang);
                try {
                  recognition.start();
                } catch (e) {
                  console.error('Failed to start fallback recognition:', e);
                }
              } else {
                console.error('All speech recognition fallbacks exhausted.');
              }
            }
          };

          recognitionRef.current = recognition;
        };

        initRecognition(startLang);
        recognition.start();
      }

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Microphone access is required to record voice notes.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    files.forEach(file => {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
      const fileUrl = URL.createObjectURL(file);

      const newItem: SubmissionItem = {
        id,
        type: 'photo',
        content: '',
        fileUrl,
        fileName: file.name,
        processing: true
      };

      setItems(prev => [...prev, newItem]);

      // Trigger Tesseract OCR
      Tesseract.recognize(
        file,
        'eng+hin', // Scan for English and Hindi text
        {
          logger: m => console.log(m)
        }
      ).then(({ data: { text } }) => {
        const cleanedText = text.trim();
        setItems(prev => prev.map(item => {
          if (item.id === id) {
            return {
              ...item,
              ocrText: cleanedText,
              processing: false
            };
          }
          return item;
        }));
      }).catch(err => {
        console.error('OCR analysis failed:', err);
        setItems(prev => prev.map(item => {
          if (item.id === id) {
            return {
              ...item,
              ocrText: 'Failed to extract text.',
              processing: false
            };
          }
          return item;
        }));
      });
    });

    e.target.value = ''; // Reset input element
  };

  const handleDeleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const isSubmitDisabled = false;

  const SECTOR_CATEGORIES = [
    { id: 'water', label: 'Water & Sanitation', icon: '🚰' },
    { id: 'roads', label: 'Roads & Transport', icon: '🛣️' },
    { id: 'education', label: 'Education & Schools', icon: '🏫' },
    { id: 'health', label: 'Healthcare Clinics', icon: '🏥' },
    { id: 'power', label: 'Power & Electricity', icon: '⚡' },
    { id: 'agriculture', label: 'Agriculture & Irrigation', icon: '🌾' },
    { id: 'others', label: 'Others / General', icon: '📁' }
  ];

  const SCOPE_STEPS = [
    { id: 'household', label: 'Household', count: '👤 ~5 citizens affected' },
    { id: 'street', label: 'Neighborhood / Street', count: '👥 ~150 citizens affected' },
    { id: 'ward', label: 'Village / Ward', count: '🏘️ ~5,000 citizens affected' },
    { id: 'constituency', label: 'Constituency-wide', count: '🌐 ~100,000+ citizens affected' }
  ];

  const handleSubmit = async () => {
    if (isSubmitDisabled) return;

    const submissionData = {
      category,
      scope,
      location: location || { lat: 0, lng: 0 },
      address,
      items: items.map(item => ({
        type: item.type,
        content: item.content,
        fileUrl: item.fileUrl || '',
        speechTranscript: item.speechTranscript || ''
      })),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined
    };

    const id = await submitDemand(submissionData);
    setTicketId(id);
    setShowSuccess(true);
  };

  return (
    <div className="complainant-portal container">
      {/* Title block with back action */}
      <div className="portal-header">
        <button type="button" className="btn-back" onClick={onBack}>
          <ArrowLeft size={18} />
          <span>Back to Roles</span>
        </button>
        <h2>Citizen Complainant Portal</h2>
        <p className="portal-subtitle">Submit infrastructure and developmental demands directly into the constituency registry</p>
      </div>

      <div className="portal-grid">
        {/* Left Column: Contact and Location */}
        <div className="portal-col">
          
          {/* Section 1: Contact details */}
          <div className="form-card">
            <h3>1. Contact Details (Optional)</h3>
            <p className="section-help">Provide details if you wish to receive progress updates on your suggestion.</p>
            
            <div className="input-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="citizen@domain.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="input-group" style={{ marginTop: '14px' }}>
              <label>Mobile Number</label>
              <input
                type="tel"
                placeholder="+91 XXXXX XXXXX"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Section 2: Compulsory Map location */}
          <div className="form-card" style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>2. Map Selection (Compulsory)</h3>
              <button
                type="button"
                className="btn-toggle-settings"
                onClick={() => setShowApiSettings(!showApiSettings)}
              >
                {showApiSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                <span>API Settings</span>
              </button>
            </div>

            {showApiSettings && (
              <div className="api-key-panel">
                <div className="input-group">
                  <label>Google Maps API Key</label>
                  <input
                    type="text"
                    placeholder="AIzaSy..."
                    value={tempApiKey}
                    onChange={e => setTempApiKey(e.target.value)}
                  />
                </div>
                <div className="input-group" style={{ marginTop: '10px' }}>
                  <label>Google Gemini API Key (Google AI Studio)</label>
                  <input
                    type="text"
                    placeholder="AIzaSy..."
                    value={tempGeminiKey}
                    onChange={e => setTempGeminiKey(e.target.value)}
                  />
                </div>
                <button type="button" className="btn-add-action" style={{ marginTop: '12px', width: '100%' }} onClick={handleSaveApiKeys}>
                  Apply API Credentials
                </button>
                <p className="api-help">If empty, loads with default credentials for fast prototyping.</p>
              </div>
            )}

            <div className="address-display">
              <span className="address-label">📍 Pinplaced Location:</span>
              <p className={address ? 'address-text' : 'address-text placeholder'}>
                {address || 'No location selected yet. Click on the map or use Auto-Detect.'}
              </p>
            </div>

            <GoogleMapComponent
              apiKey={apiKey}
              onLocationSelect={handleLocationSelect}
              selectedLocation={location}
              nearbyHotspots={nearbyHotspots}
            />
          </div>

          {/* AI Local Insights Gap factsheet */}
          {insights && (
            <div className="insights-card notranslate">
              <div className="insights-header">
                <Sparkles size={16} />
                <h4>AI Local Insights & Infrastructure Gaps</h4>
              </div>
              <div className="insights-body">
                <div className="insight-row">
                  <span className="insight-title">🏫 Nearest Public School (Real Places Data):</span>
                  {insights.nearestSchool ? (
                    <div className="insight-value">
                      <strong>{insights.nearestSchool.name}</strong>
                      <span className="distance-badge">
                        {insights.nearestSchool.distance.toFixed(2)} km
                      </span>
                    </div>
                  ) : (
                    <span className="insight-no-data">Searching local databases...</span>
                  )}
                </div>
                <div className="insight-row" style={{ marginTop: '12px' }}>
                  <span className="insight-title">🏥 Nearest Public Hospital/Clinic (Real Places Data):</span>
                  {insights.nearestHospital ? (
                    <div className="insight-value">
                      <strong>{insights.nearestHospital.name}</strong>
                      <span className="distance-badge">
                        {insights.nearestHospital.distance.toFixed(2)} km
                      </span>
                    </div>
                  ) : (
                    <span className="insight-no-data">Searching local databases...</span>
                  )}
                </div>
                <div className="insight-gap-analysis" style={{ marginTop: '16px' }}>
                  <span className="gap-title">Sector Gap Rating:</span>
                  {(() => {
                    const schoolDist = insights.nearestSchool?.distance || 5;
                    const hospDist = insights.nearestHospital?.distance || 5;
                    const maxDist = Math.max(schoolDist, hospDist);
                    if (maxDist > 3.0) {
                      return <span className="rating-badge critical">🚨 Critically Deficient (High Infrastructure Gap)</span>;
                    } else if (maxDist > 1.5) {
                      return <span className="rating-badge warning">⚠️ Moderate (Needs Expansion)</span>;
                    } else {
                      return <span className="rating-badge optimal">✅ Good (Optimal Access)</span>;
                    }
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Nearby hotspots overlay votes */}
          {nearbyHotspots.length > 0 && (
            <div className="hotspots-card notranslate">
              <h4>⚠️ Existing Active Issues in this Area ({nearbyHotspots.length})</h4>
              <p className="hotspots-help">To prevent duplicate entries, you can support an existing complaint below:</p>
              <div className="hotspots-list">
                {nearbyHotspots.map(hotspot => (
                  <div key={hotspot.id} className="hotspot-item">
                    <div className="hotspot-info">
                      <span className="hotspot-badge" style={{ textTransform: 'capitalize' }}>
                        {hotspot.category === 'water' && '🚰'}
                        {hotspot.category === 'roads' && '🛣️'}
                        {hotspot.category === 'education' && '🏫'}
                        {hotspot.category === 'health' && '🏥'}
                        {hotspot.category === 'power' && '⚡'}
                        {hotspot.category === 'agriculture' && '🌾'}
                        {hotspot.category === 'others' && '📁'}
                        {hotspot.category}
                      </span>
                      <p className="hotspot-text">{"\"" + (hotspot.items[0]?.content || hotspot.address) + "\""}</p>
                    </div>
                    <button 
                      type="button" 
                      className="btn-upvote" 
                      onClick={() => handleUpvote(hotspot.id)}
                    >
                      👍 Support ({hotspot.upvotes})
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Evidence / attachments list */}
        <div className="portal-col">
          <div className="form-card h-full">
            <h3>3. Add Suggestion Details & Attach Evidence</h3>
            <p className="section-help">You can attach multiple entries. At least one attachment is required.</p>

            {/* AI sync status banner */}
            {aiIndicator.active && (
              <div className="ai-indicator-banner notranslate">
                <Sparkles size={14} />
                <span>{aiIndicator.message}</span>
              </div>
            )}

            {/* Visual Category Selector Grid */}
            <div className="input-box-sub" style={{ marginTop: '20px' }}>
              <label>Select Category Tag (AI Auto-detects)</label>
              <div className="category-grid notranslate">
                {SECTOR_CATEGORIES.map(cat => (
                  <div 
                    key={cat.id} 
                    className={'category-card ' + (category === cat.id ? 'active' : '')}
                    onClick={() => setCategory(cat.id)}
                  >
                    <span className="category-icon">{cat.icon}</span>
                    <span className="category-label">{cat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Impact Scope Slider */}
            <div className="input-box-sub" style={{ marginTop: '20px' }}>
              <label>Impact Scope (How many citizens are affected?)</label>
              <div className="scope-slider-container notranslate">
                <input 
                  type="range" 
                  min="0" 
                  max="3" 
                  value={SCOPE_STEPS.findIndex(s => s.id === scope)}
                  onChange={(e) => setScope(SCOPE_STEPS[parseInt(e.target.value)].id)}
                  className="scope-slider"
                />
                <div className="scope-labels-row">
                  {SCOPE_STEPS.map((step) => (
                    <span 
                      key={step.id} 
                      className={'scope-label ' + (scope === step.id ? 'active' : '')}
                      onClick={() => setScope(step.id)}
                    >
                      {step.label}
                    </span>
                  ))}
                </div>
                <div className="scope-info-box">
                  <strong>Estimated Impact:</strong> {SCOPE_STEPS.find(s => s.id === scope)?.count}
                </div>
              </div>
            </div>

            {/* Evidence inputs */}
            <div className="evidence-inputs" style={{ marginTop: '24px' }}>
              
              {/* Text Description Box */}
              <div className="input-box-sub">
                <label>Add Text Description</label>
                <div className="text-area-row">
                  <textarea
                    placeholder="Enter description of public infrastructure need (AI will auto-tag and set scope)..."
                    value={textNote}
                    onChange={e => setTextNote(e.target.value)}
                  />
                  <button type="button" className="btn-add-action" onClick={handleAddText} disabled={!textNote.trim()}>
                    Add Text
                  </button>
                </div>
              </div>

              {/* Audio Note Recorder */}
              <div className="input-box-sub" style={{ marginTop: '20px' }}>
                <label>Record Voice Note</label>
                <p className="voice-info">Syncs transcription with selected language. Currently: <strong>{selectedLang}</strong></p>
                <div className="voice-row">
                  <button
                    type="button"
                    className={'btn-record ' + (isRecording ? 'recording' : '')}
                    onClick={isRecording ? stopRecording : startRecording}
                  >
                    <span className="record-icon"></span>
                    <span>{isRecording ? 'Stop Recording' : 'Start Recording Voice Note'}</span>
                  </button>
                </div>
                {isRecording && (
                  <div className="voice-feedback notranslate">
                    <span className="pulse-circle"></span>
                    <span className="live-trans-preview notranslate">
                      {liveTranscript || 'Listening... speak now.'}
                    </span>
                  </div>
                )}
              </div>

              {/* Photo Evidence Upload */}
              <div className="input-box-sub" style={{ marginTop: '20px' }}>
                <label>Upload Photo Attachments</label>
                <p className="photo-info">Images containing text will be processed with OCR automatically.</p>
                <div className="photo-upload-zone">
                  <input
                    type="file"
                    id="evidence-photos"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleImageUpload}
                  />
                  <label htmlFor="evidence-photos" className="photo-upload-label">
                    <Upload size={24} />
                    <span>Click to Upload Images</span>
                  </label>
                </div>
              </div>

            </div>

            {/* List of attachments */}
            <div className="attachments-section" style={{ marginTop: '28px' }}>
              <h4>Attached Items ({items.length})</h4>
              {items.length === 0 ? (
                <div className="empty-attachments">
                  <Info size={18} />
                  <span>No attachments added yet. Write descriptions, upload photos, or record voice memos.</span>
                </div>
              ) : (
                <div className="attachments-list">
                  {items.map(item => (
                    <div key={item.id} className={'attachment-card ' + item.type}>
                      <div className="attachment-card-header">
                        <span className="item-badge">
                          {item.type === 'text' && '✍️ Text Description'}
                          {item.type === 'audio' && '🔊 Voice Note'}
                          {item.type === 'photo' && '🖼️ Photo Attachment'}
                        </span>
                        <button type="button" className="btn-delete" onClick={() => handleDeleteItem(item.id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div className="attachment-card-body">
                        {item.type === 'text' && (
                          <p className="text-content">{"\"" + item.content + "\""}</p>
                        )}

                        {item.type === 'audio' && (
                          <div className="audio-item-wrapper">
                            <audio src={item.fileUrl} controls className="audio-control-bar" />
                            {item.speechTranscript && (
                              <div className="speech-transcript-box notranslate">
                                <span className="box-title">Speech-to-Text Transcript:</span>
                                <p className="transcript-text notranslate">{"\"" + item.speechTranscript + "\""}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {item.type === 'photo' && (
                          <div className="photo-item-wrapper">
                            <img src={item.fileUrl} alt={item.fileName} className="photo-preview-thumbnail" />
                            <div className="photo-details">
                              <span className="photo-name">{item.fileName}</span>
                              {item.processing ? (
                                <div className="ocr-processing">
                                  <Loader2 className="spinner" size={14} />
                                  <span>Extracting text (OCR)...</span>
                                </div>
                              ) : (
                                item.ocrText && (
                                  <div className="ocr-text-box">
                                    <span className="box-title">Extracted Text (OCR):</span>
                                    <p className="ocr-text">{"\"" + item.ocrText + "\""}</p>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Submit verification bar */}
      <div className="submit-bar">
        <div className="checklist">
          <div className={'checklist-item ' + (location ? 'checked' : '')}>
            <span className="checkbox"></span>
            <span>Map Coordinates Placed</span>
          </div>
          <div className={'checklist-item ' + (items.length > 0 ? 'checked' : '')}>
            <span className="checkbox"></span>
            <span>Evidence Material Provided</span>
          </div>
        </div>

        <button
          type="button"
          className="btn-submit-proposal"
          disabled={isSubmitDisabled}
          onClick={handleSubmit}
        >
          <span>Submit Suggestion to Registry</span>
          <ArrowRight size={18} />
        </button>
      </div>

      {/* Submission Success Modal */}
      {showSuccess && (
        <div className="modal-overlay">
          <div className="modal-content text-center">
            <div className="modal-success-icon">
              <CheckCircle size={64} />
            </div>
            <h3>Demands Registered Successfully!</h3>
            <p className="modal-desc">
              Your suggestion has been logged. AI Engine will index, cluster, and present this to constituency officials.
            </p>

            <div className="modal-summary-card">
              <h4>Submission Summary</h4>
              <div className="summary-row">
                <span>Ticket Reference ID:</span>
                <strong>{ticketId}</strong>
              </div>
              <div className="summary-row">
                <span>Contact Info:</span>
                <strong>{email || phone ? (email + " " + phone).trim() : 'Anonymous'}</strong>
              </div>
              <div className="summary-row">
                <span>Coordinates:</span>
                <strong>{location ? location.lat.toFixed(5) + ", " + location.lng.toFixed(5) : 'N/A'}</strong>
              </div>
              <div className="summary-row">
                <span>Address:</span>
                <strong className="summary-address">{address}</strong>
              </div>
              <div className="summary-items-grid">
                <div className="grid-cell">
                  <strong>{items.filter(i => i.type === 'text').length}</strong>
                  <span>Texts</span>
                </div>
                <div className="grid-cell">
                  <strong>{items.filter(i => i.type === 'audio').length}</strong>
                  <span>Audios</span>
                </div>
                <div className="grid-cell">
                  <strong>{items.filter(i => i.type === 'photo').length}</strong>
                  <span>Photos</span>
                </div>
              </div>
              
              <div className="qr-container" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <img 
                  src={"https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=" + encodeURIComponent("https://jansetu.org/track/" + ticketId)}
                  alt="Track Ticket QR" 
                  style={{ width: '120px', height: '120px', borderRadius: '8px', border: '1px solid #4f46e5' }}
                />
                <span style={{ fontSize: '11px', color: '#8e90b3', fontWeight: '600' }}>Scan to track status on WhatsApp API</span>
              </div>
            </div>

            <button type="button" className="btn-modal-close" onClick={() => {
              setShowSuccess(false);
              setItems([]);
              setEmail('');
              setPhone('');
              setLocation(null);
              setAddress('');
              setCategory('others');
              setScope('street');
              setInsights(null);
              setNearbyHotspots([]);
              setTicketId('');
              onBack(); // Return to landing
            }}>
              Return to Portal Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function App() {
  const [selectedLang, setSelectedLang] = useState(getInitialLanguage);



  // Initialize Google Translate Widget dynamically
  useEffect(() => {
    // Define the global callback function for Google Translate Element Init
    (window as any).googleTranslateElementInit = () => {
      new (window as any).google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'en,hi,bn,te,mr,ta,gu,kn,ml,or,pa,as,ur,sa,ne,sd,kok',
        layout: (window as any).google.translate.TranslateElement.InlineLayout.SIMPLE,
        autoDisplay: false
      }, 'google_translate_element');
    };

    // Append Google Translate widget script script tag if it doesn't exist
    if (!document.getElementById('google-translate-script')) {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  return (
    <>
      {/* Hidden google translate widget anchor node */}
      <div id="google_translate_element" style={{ display: 'none' }}></div>

      {/* Navigation Header */}
      <header className="header">
        <div className="container header-container">
          <div className="logo-wrapper" onClick={() => window.location.href = '/'} style={{ cursor: 'pointer' }}>
            <div className="logo-icon">
              <Network size={20} strokeWidth={2.5} />
            </div>
            <span>Jansetu</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Custom Translation Component */}
            <LanguageSelector selectedLang={selectedLang} setSelectedLang={setSelectedLang} />
            
            <div className="status-badge">
              <span className="pulse-dot"></span>
              <span>AI Core Active</span>
            </div>
          </div>
        </div>
      </header>

      <main style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        {/* Hero Section */}
        <section className="hero container">
          <div className="hero-tagline">
            <Sparkles size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            Track 1: AI for Constituency Development Planning
          </div>
          <h1>
            Consolidating Citizen Feedback for <br />
            <span className="gradient-text">Data-Driven Governance</span>
          </h1>
          <p className="hero-description">
            Jansetu acts as a digital bridge between citizens and their leaders. We ingest multi-lingual submissions via voice, text, and photos, aggregate recurring local demands, and recommend high-priority infrastructure works.
          </p>
        </section>

        {/* Roles Selector Portal Grid */}
        <section className="role-section container">
          <div className="role-grid">
            
            {/* Portal 1: Complainant (Citizen) */}
            <div className="role-card card-citizen" id="portal-citizen" onClick={() => window.location.href = '/complainant.html'}>
              <div className="card-content">
                <div className="icon-box">
                  <Megaphone size={28} />
                </div>
                <span className="role-label">Portal Access</span>
                <h3 className="role-title">Complainant</h3>
                <p className="role-desc">
                  Submit local infrastructure suggestions and developmental needs via voice, text, or photos in your local language.
                </p>
              </div>
              <div className="card-action">
                <button className="role-btn" onClick={(e) => { e.stopPropagation(); window.location.href = '/complainant.html'; }}>
                  <span>Complainant</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>

            {/* Portal 2: Manager */}
            <div className="role-card card-manager" id="portal-manager" onClick={() => window.location.href = '/manager.html'}>
              <div className="card-content">
                <div className="icon-box">
                  <Database size={28} />
                </div>
                <span className="role-label">Aggregator Access</span>
                <h3 className="role-title">Manager</h3>
                <p className="role-desc">
                  Spot recurring public issues, check demographic alignment, analyze travel distances, and build proposal files.
                </p>
              </div>
              <div className="card-action">
                <button className="role-btn" onClick={(e) => { e.stopPropagation(); window.location.href = '/manager.html'; }}>
                  <span>Manager</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>

            {/* Portal 3: MP */}
            <div className="role-card card-mp" id="portal-mp" onClick={() => window.location.href = '/mp.html'}>
              <div className="card-content">
                <div className="icon-box">
                  <Award size={28} />
                </div>
                <span className="role-label">Decision Workspace</span>
                <h3 className="role-title">MP</h3>
                <p className="role-desc">
                  Evaluate objective AI rankings of development projects, match demand against public budget, and authorize projects.
                </p>
              </div>
              <div className="card-action">
                <button className="role-btn" onClick={(e) => { e.stopPropagation(); window.location.href = '/mp.html'; }}>
                  <span>MP</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>

          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container footer-content">
          <div className="footer-text">
            <strong>Jansetu</strong> — Bridging Citizens and Leaders through Intelligent Planning
          </div>
          <div className="footer-sub">
            Built for MP Constituency Development Planning • Smart India Hackathon Track 1 • All Rights Reserved
          </div>
        </div>
      </footer>
    </>
  );
}

export default App;
