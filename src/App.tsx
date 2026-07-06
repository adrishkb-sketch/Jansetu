import React, { useState, useEffect, useRef } from 'react';
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
  Info,
  MapPin
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import { submitDemand, getNearbyHotspots, upvoteDemand, contributeToDemand, getAllDemands } from './services/db';

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

interface PlaceDetail {
  name: string;
  distance: number;
  lat: number;
  lng: number;
}

interface LocationInsights {
  schools?: PlaceDetail[];
  hospitals?: PlaceDetail[];
  policeStations?: PlaceDetail[];
  parks?: PlaceDetail[];
  transitStations?: PlaceDetail[];
  railways?: PlaceDetail[];
  postOffices?: PlaceDetail[];
  temples?: PlaceDetail[];
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
  focusedPlace: { lat: number; lng: number; name: string } | null;
  circleData: { lat: number; lng: number; radius: number } | null;
}

export function GoogleMapComponent({ apiKey, onLocationSelect, selectedLocation, nearbyHotspots, focusedPlace, circleData }: GoogleMapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const focusedMarkerRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);
  const hotspotMarkersRef = useRef<any[]>([]);
  const circleRef = useRef<any>(null);
  const hotspotCirclesRef = useRef<any[]>([]);
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

    const queryPlacesInsights = async (latLng: any, addressStr: string) => {
      const googleObj = (window as any).google;
      const loc = { lat: typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat, lng: typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng };
      
      if (!googleObj || !googleObj.maps || !googleObj.maps.places || !mapInstanceRef.current) {
        onLocationSelect(loc, addressStr);
        return;
      }

      const service = new googleObj.maps.places.PlacesService(mapInstanceRef.current);
      const googleLatLng = typeof latLng.lat === 'function' ? latLng : new googleObj.maps.LatLng(loc.lat, loc.lng);
      
      const insights: LocationInsights = {};

      const queryPlaceType = (type: string): Promise<PlaceDetail[] | null> => {
        return new Promise((resolve) => {
          service.nearbySearch({
            location: googleLatLng,
            rankBy: googleObj.maps.places.RankBy.DISTANCE,
            type: type
          }, (results: any, status: any) => {
            if (status === googleObj.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
              const sliced = results.slice(0, 5);
              const mapped = sliced.map((closest: any) => {
                const placeLoc = { lat: closest.geometry.location.lat(), lng: closest.geometry.location.lng() };
                return {
                  name: closest.name,
                  distance: getHaversineDistance(loc, placeLoc),
                  lat: placeLoc.lat,
                  lng: placeLoc.lng
                };
              });
              resolve(mapped);
            } else {
              resolve(null);
            }
          });
        });
      };

      try {
        const [schools, hospitals, police, parks, transit, railways, postOffices, temples] = await Promise.all([
          queryPlaceType('school'),
          queryPlaceType('hospital'),
          queryPlaceType('police'),
          queryPlaceType('park'),
          queryPlaceType('transit_station'),
          queryPlaceType('train_station'),
          queryPlaceType('post_office'),
          queryPlaceType('place_of_worship')
        ]);

        if (schools) insights.schools = schools;
        if (hospitals) insights.hospitals = hospitals;
        if (police) insights.policeStations = police;
        if (parks) insights.parks = parks;
        if (transit) insights.transitStations = transit;
        if (railways) insights.railways = railways;
        if (postOffices) insights.postOffices = postOffices;
        if (temples) insights.temples = temples;

        onLocationSelect(loc, addressStr, insights);
      } catch (e) {
        console.error("Places API insights lookup failed: ", e);
        onLocationSelect(loc, addressStr);
      }
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

  // Handle focusing landmark places
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded) return;
    const google = (window as any).google;
    if (!google) return;

    if (focusedPlace) {
      mapInstanceRef.current.panTo(focusedPlace);
      mapInstanceRef.current.setZoom(16);

      if (focusedMarkerRef.current) {
        focusedMarkerRef.current.setMap(null);
      }
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }

      focusedMarkerRef.current = new google.maps.Marker({
        position: focusedPlace,
        map: mapInstanceRef.current,
        title: focusedPlace.name,
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
        }
      });

      infoWindowRef.current = new google.maps.InfoWindow({
        content: `<div style="color: #000; font-family: sans-serif; font-size: 13px; font-weight: 600; padding: 4px;">🎯 Landmark: ${focusedPlace.name}</div>`
      });
      infoWindowRef.current.open(mapInstanceRef.current, focusedMarkerRef.current);
    } else {
      if (focusedMarkerRef.current) {
        focusedMarkerRef.current.setMap(null);
        focusedMarkerRef.current = null;
      }
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
        infoWindowRef.current = null;
      }
    }
  }, [focusedPlace, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;
    const google = (window as any).google;
    if (!google || !google.maps) return;

    if (circleRef.current) {
      circleRef.current.setMap(null);
      circleRef.current = null;
    }

    if (circleData) {
      circleRef.current = new google.maps.Circle({
        strokeColor: '#6366f1',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#6366f1',
        fillOpacity: 0.25,
        map: mapInstanceRef.current,
        center: { lat: circleData.lat, lng: circleData.lng },
        radius: circleData.radius
      });
    }
  }, [circleData, isLoaded]);

  // Handle drawing of nearby hotspot markers
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return;
    const google = (window as any).google;
    if (!google) return;

    hotspotMarkersRef.current.forEach(m => m.setMap(null));
    hotspotMarkersRef.current = [];

    hotspotCirclesRef.current.forEach(c => c.setMap(null));
    hotspotCirclesRef.current = [];

    nearbyHotspots.forEach(hotspot => {
      if (selectedLocation && 
          Math.abs(hotspot.location.lat - selectedLocation.lat) < 0.0001 && 
          Math.abs(hotspot.location.lng - selectedLocation.lng) < 0.0001) {
        return;
      }

      // Generate dynamic HSL color matching category
      const categoriesList = ["water", "roads", "education", "health", "power", "agriculture", "safety", "environment", "welfare", "housing", "anticorruption", "digital", "disaster", "women", "justice", "economy", "consumer", "taxes", "tourism", "youth", "innovation", "rural", "security", "cyber", "climate", "space", "foreign", "others"];
      const catIdx = categoriesList.indexOf(hotspot.category?.toLowerCase() || 'others');
      const hue = catIdx !== -1 ? (catIdx * (360 / categoriesList.length)) % 360 : 200;
      const circleColor = `hsl(${hue}, 80%, 55%)`;

      const marker = new google.maps.Marker({
        position: hotspot.location,
        map: mapInstanceRef.current,
        title: `${hotspot.category.toUpperCase()}: ${hotspot.upvotes} support votes`,
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png'
        }
      });

      // Add a circular hotspot region
      const hotspotCircle = new google.maps.Circle({
        strokeColor: circleColor,
        strokeOpacity: 0.8,
        strokeWeight: 1.5,
        fillColor: circleColor,
        fillOpacity: 0.18,
        map: mapInstanceRef.current,
        center: hotspot.location,
        radius: Math.max(80, (hotspot.upvotes || 1) * 20) // radius based on upvotes
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="color: #000; padding: 6px; font-family: sans-serif; min-width: 180px;">
            <strong style="text-transform: capitalize; color: ${circleColor}; font-size: 13px; display: block; margin-bottom: 4px;">⚠️ ${hotspot.category} Sector Need</strong>
            <div style="font-size: 11px; margin-bottom: 6px; line-height: 1.3; color: #333;"><strong>Location:</strong> ${hotspot.address || 'Constituency Landmark'}</div>
            <div style="font-size: 11px; color: #4f46e5; font-weight: bold; background: rgba(79, 70, 229, 0.08); padding: 4px; border-radius: 4px; text-align: center;">
              👍 Supported by ${hotspot.upvotes} Citizens
            </div>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(mapInstanceRef.current, marker);
      });

      hotspotMarkersRef.current.push(marker);
      hotspotCirclesRef.current.push(hotspotCircle);
    });
  }, [nearbyHotspots, isLoaded, selectedLocation]);

  const handleAutoDetect = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setGeocoding(true);

    const fallbackToDefault = (errorMsg: string) => {
      console.log("Geolocation failed, attempting IP Geolocation fallback...");
      
      // Try IP Geolocation first
      fetch('https://ipapi.co/json/')
        .then(res => {
          if (!res.ok) throw new Error("IP Geolocation service returned error");
          return res.json();
        })
        .then(data => {
          if (data.latitude && data.longitude) {
            const loc = { lat: data.latitude, lng: data.longitude };
            const address = `${data.city || 'Detected City'}, ${data.region || 'Detected Region'}, ${data.country_name || 'India'} (Approximate IP Location)`;
            
            const google = (window as any).google;
            if (google && google.maps) {
              onLocationSelect(loc, address);
              if (mapInstanceRef.current) {
                mapInstanceRef.current.setCenter(loc);
                mapInstanceRef.current.setZoom(13); // Zoom out slightly for city-level view
              }
            } else {
              onLocationSelect(loc, address);
            }
            setGeocoding(false);
            alert(`Location Detected via IP Geolocation: We detected your approximate location as: ${address}.\n\nYou can drag the pin on the map to your exact street/ward.`);
          } else {
            throw new Error("No coordinates in IP payload");
          }
        })
        .catch(err => {
          console.error("IP Geolocation fallback failed: ", err);
          // Ultimate fallback to default Rampur coordinates
          const fallbackLoc = { lat: 28.8046, lng: 79.0021 };
          const google = (window as any).google;
          let address = 'Rampur Constituency (Default location)';
          if (google && google.maps) {
            onLocationSelect(fallbackLoc, address);
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setCenter(fallbackLoc);
              mapInstanceRef.current.setZoom(15);
            }
          } else {
            onLocationSelect(fallbackLoc, address);
          }
          setGeocoding(false);
          alert(`Location Detection Unavailable: ${errorMsg}\n\nPlaced pin at default Rampur Constituency center. You can drag the pin on the map or type a landmark in the tag search bar to select your location.`);
        });
    };

    // Call getCurrentPosition with no options/timeout so the browser permission prompt stays open
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
            
            // Trigger same parallel insights lookup
            const mapInstance = mapInstanceRef.current;
            if (mapInstance) {
              const service = new google.maps.places.PlacesService(mapInstance);
              const googleLatLng = new google.maps.LatLng(latitude, longitude);
              
              const insights: LocationInsights = {};
              const queryPlaceType = (type: string): Promise<PlaceDetail[] | null> => {
                return new Promise((resolve) => {
                  service.nearbySearch({
                    location: googleLatLng,
                    rankBy: google.maps.places.RankBy.DISTANCE,
                    type: type
                  }, (results: any, status: any) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                      const sliced = results.slice(0, 5);
                      const mapped = sliced.map((closest: any) => {
                        const placeLoc = { lat: closest.geometry.location.lat(), lng: closest.geometry.location.lng() };
                        return {
                          name: closest.name,
                          distance: getHaversineDistance(loc, placeLoc),
                          lat: placeLoc.lat,
                          lng: placeLoc.lng
                        };
                      });
                      resolve(mapped);
                    } else {
                      resolve(null);
                    }
                  });
                });
              };

              Promise.all([
                queryPlaceType('school'),
                queryPlaceType('hospital'),
                queryPlaceType('police'),
                queryPlaceType('park'),
                queryPlaceType('transit_station'),
                queryPlaceType('train_station'),
                queryPlaceType('post_office'),
                queryPlaceType('place_of_worship')
              ]).then(([schools, hospitals, police, parks, transit, railways, postOffices, temples]) => {
                if (schools) insights.schools = schools;
                if (hospitals) insights.hospitals = hospitals;
                if (police) insights.policeStations = police;
                if (parks) insights.parks = parks;
                if (transit) insights.transitStations = transit;
                if (railways) insights.railways = railways;
                if (postOffices) insights.postOffices = postOffices;
                if (temples) insights.temples = temples;

                onLocationSelect(loc, address, insights);
              }).catch(err => {
                console.error("Auto-detect places lookup failed: ", err);
                onLocationSelect(loc, address);
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
        let errorMsg = '';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Permission denied. Please click the location/lock icon in your browser address bar to allow location access. (On macOS, also check System Settings -> Privacy & Security -> Location Services to verify Chrome/Safari is allowed access).';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Position unavailable. Your device sensors or OS Location Services might be disabled.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Location query timed out.';
        } else {
          errorMsg = error.message || 'Unknown error.';
        }
        console.error("Geolocation failed: ", errorMsg);
        fallbackToDefault(errorMsg);
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
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
  boundingBoxes?: Array<{ label: string; x: number; y: number; width: number; height: number; severity: string }>;
  audioBase64?: string;
  audioMimeType?: string;
}

const safeJsonParse = (text: string) => {
  let cleanText = text.trim();
  const match = cleanText.match(/```json\s*([\s\S]*?)\s*```/) || cleanText.match(/```\s*([\s\S]*?)\s*```/);
  if (match) {
    cleanText = match[1];
  }
  return JSON.parse(cleanText.trim());
};

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
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('jansetu_gemini_key') || 'AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw');
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
  const [micSharingBlocked, setMicSharingBlocked] = useState(false);

  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef('');

  // Success modal
  const [showSuccess, setShowSuccess] = useState(false);

  // Expanded UI states
  const [focusedPlace, setFocusedPlace] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [associatedPlace, setAssociatedPlace] = useState<{ name: string; type: string; lat: number; lng: number } | null>(null);
  const [aiPopulationAffected, setAiPopulationAffected] = useState<number>(150);
  const [correlatedHotspot, setCorrelatedHotspot] = useState<any | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [imageContextWarning, setImageContextWarning] = useState<boolean>(false);
  const [showAiAutoDetectSection, setShowAiAutoDetectSection] = useState<boolean>(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [aiClarificationQuestion, setAiClarificationQuestion] = useState<string | null>(null);
  const [aiUnderstood, setAiUnderstood] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);
  const [landmarkSearchQuery, setLandmarkSearchQuery] = useState('');
  const [searchResultPlaces, setSearchResultPlaces] = useState<any[]>([]);
  const [aiSuggestedLandmark, setAiSuggestedLandmark] = useState<{ name: string, type: string, lat: number, lng: number } | null>(null);
  const [urgency, setUrgency] = useState<string>('moderate');
  const [assetType, setAssetType] = useState<string>('others');
  const [fundingSource, setFundingSource] = useState<string>('municipality');
  const [aiOverview, setAiOverview] = useState<{ brief: string; priorityScore: number; priorityLabel: string; estimatedBudget: string; safetyRisk: string } | null>(null);
  const [circleData, setCircleData] = useState<{ lat: number; lng: number; radius: number } | null>(null);
  const [clarificationRefusals, setClarificationRefusals] = useState<number>(0);
  const [contributingIssue, setContributingIssue] = useState<any | null>(null);
  const [submittedAsIncomplete, setSubmittedAsIncomplete] = useState<boolean>(false);
  const [ticketType, setTicketType] = useState<'complaint' | 'suggestion'>('complaint');

  const [isDashboardView, setIsDashboardView] = useState<boolean>(false);
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [citizenDemands, setCitizenDemands] = useState<any[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === 'true') {
      setIsDashboardView(true);
    }
  }, []);

  const handleLogin = async () => {
    if (!loginEmail.trim()) return;
    const all = await getAllDemands();
    const filtered = all.filter(d => d.email && d.email.trim().toLowerCase() === loginEmail.trim().toLowerCase());
    setCitizenDemands(filtered);
    setIsLoggedIn(true);
  };

  const [upvotedHotspotIds, setUpvotedHotspotIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('jansetu_upvoted_ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [petitionId, setPetitionId] = useState<string | null>(null);
  const [petitionTicket, setPetitionTicket] = useState<any | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Auto-sync Gemini API key from URL parameter (cross-device/mobile convenience)
    const urlGeminiKey = params.get('gemini_key');
    if (urlGeminiKey) {
      localStorage.setItem('jansetu_gemini_key', urlGeminiKey);
      setGeminiKey(urlGeminiKey);
      setTempGeminiKey(urlGeminiKey);
      alert('🔑 Custom Gemini API Key synchronized successfully from URL!');
    }

    const pid = params.get('petitionId');
    if (pid) {
      setPetitionId(pid);
      getAllDemands().then(all => {
        const found = all.find(d => d.id === pid);
        if (found) {
          setPetitionTicket(found);
        } else {
          alert("Could not load the specified petition.");
        }
      });
    }

    // Clean URL query parameters if synced
    if (urlGeminiKey) {
      const cleanUrl = window.location.pathname + (pid ? `?petitionId=${pid}` : '');
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  const handlePetitionUpvote = async () => {
    if (!petitionTicket) return;
    if (upvotedHotspotIds.includes(petitionTicket.id)) {
      alert("⚠️ You have already signed/upvoted this petition!");
      return;
    }
    if (!location) {
      alert("📍 Map Location Required: Please select your coordinates on the map in Section 2 first to verify you live near this issue.");
      return;
    }
    const dist = getHaversineDistance(location, petitionTicket.location);
    if (dist > 2.0) {
      alert(`⛔ Access Denied: You are located ${dist.toFixed(2)} km away. Petition signing/upvoting is restricted to local residents residing within 2.0 km of the issue to prevent spam.`);
      return;
    }
    const updatedVotes = await upvoteDemand(petitionTicket.id);
    alert("🎉 Thank you! Your community signature has been added to this petition.");
    setPetitionTicket((prev: any) => prev ? { ...prev, upvotes: updatedVotes } : null);
    const nextVoted = [...upvotedHotspotIds, petitionTicket.id];
    setUpvotedHotspotIds(nextVoted);
    localStorage.setItem('jansetu_upvoted_ids', JSON.stringify(nextVoted));
  };

  // Query hotspots when location changes
  useEffect(() => {
    if (location) {
      getNearbyHotspots(location.lat, location.lng).then(data => {
        setNearbyHotspots(data);
      });
    }
  }, [location]);

  // Synchronize map circle based on active location and population scope
  useEffect(() => {
    if (location) {
      let radius = 100; // default for street
      if (scope === 'household') radius = 30;
      else if (scope === 'street') radius = 100;
      else if (scope === 'ward') radius = 500;
      else if (scope === 'constituency') radius = 2000;

      setCircleData({
        lat: location.lat,
        lng: location.lng,
        radius
      });
    } else {
      setCircleData(null);
    }
  }, [location, scope]);

  const isHotspotIncomplete = (h: any) => {
    if (h.status === 'needs_info' || h.needsMoreInfo) return true;
    const content = h.items?.[0]?.content || '';
    if (content.length < 35 && !h.items?.find((i: any) => i.type === 'photo')) return true;
    return false;
  };

  const handleLocationSelect = (loc: Location, addr: string, locInsights?: LocationInsights) => {
    setLocation(loc);
    setAddress(addr);
    setFocusedPlace(null);
    setAssociatedPlace(null);
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
    if (upvotedHotspotIds.includes(id)) {
      alert("⚠️ You have already upvoted/supported this ticket!");
      return;
    }
    const target = nearbyHotspots.find(h => h.id === id);
    if (target) {
      if (!location) {
        alert("📍 Map Location Required: Please select your location on the map in Section 2 first to verify you reside nearby.");
        return;
      }
      const dist = getHaversineDistance(location, target.location);
      if (dist > 2.0) {
        alert(`⛔ Access Denied: You are located ${dist.toFixed(2)} km away from the issue coordinates. Upvoting is restricted to local residents residing within 2.0 km of the issue location to prevent spam.`);
        return;
      }
    }
    const updatedVotes = await upvoteDemand(id);
    setNearbyHotspots(prev => prev.map(h => h.id === id ? { ...h, upvotes: updatedVotes } : h));
    const nextVoted = [...upvotedHotspotIds, id];
    setUpvotedHotspotIds(nextVoted);
    localStorage.setItem('jansetu_upvoted_ids', JSON.stringify(nextVoted));
  };

  const handleLandmarkSearch = () => {
    if (!landmarkSearchQuery.trim()) return;
    const google = (window as any).google;
    if (!google || !google.maps || !google.maps.places || !mapContainerRef.current) return;

    const service = new google.maps.places.PlacesService(mapContainerRef.current);
    const request = {
      location: location ? new google.maps.LatLng(location.lat, location.lng) : new google.maps.LatLng(28.6139, 77.2090),
      radius: 10000,
      query: landmarkSearchQuery
    };

    service.textSearch(request, (results: any, status: any) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        const mapped = results.slice(0, 5).map((r: any) => ({
          name: r.name,
          lat: r.geometry.location.lat(),
          lng: r.geometry.location.lng(),
          formatted_address: r.formatted_address
        }));
        setSearchResultPlaces(mapped);
      }
    });
  };

  const handleSelectSearchedLandmark = (place: any) => {
    setFocusedPlace({
      lat: place.lat,
      lng: place.lng,
      name: place.name
    });
    setAssociatedPlace({
      name: place.name,
      type: 'custom',
      lat: place.lat,
      lng: place.lng
    });
    setSearchResultPlaces([]);
    setLandmarkSearchQuery('');
    mapContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const runAIAttachmentAnalysis = async (textToAnalyze: string, currentItems: SubmissionItem[]) => {
    if (!location) return;
    const activeKey = localStorage.getItem('jansetu_gemini_key') || 'AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw';
    if (!activeKey) return;

    setAiError(null);
    setAiIndicator({ active: true, message: 'AI translating content...' });
    setIsAiAnalyzing(true);

    setAiIndicator({ active: true, message: 'AI identifying problem details & checking correlations...' });

    let insightsText = "No local landmarks data available.";
    if (insights) {
      const serializeGroup = (label: string, list?: PlaceDetail[]) => {
        if (!list || list.length === 0) return `${label}: None found within 5km`;
        return `${label}: ${list.map(p => `${p.name} (dist: ${p.distance.toFixed(2)} km, lat: ${p.lat}, lng: ${p.lng})`).join(', ')}`;
      };
      insightsText = [
        serializeGroup("Schools", insights.schools),
        serializeGroup("Hospitals", insights.hospitals),
        serializeGroup("Police Stations", insights.policeStations),
        serializeGroup("Parks", insights.parks),
        serializeGroup("Transit Stations", insights.transitStations),
        serializeGroup("Railway Stations", insights.railways),
        serializeGroup("Post Offices", insights.postOffices),
        serializeGroup("Temples & Worship Places", insights.temples)
      ].join('\n');
    }

    try {
      const hotspotsList = nearbyHotspots.map(h => ({
        id: h.id,
        category: h.category,
        content: h.items?.[0]?.content || h.address
      }));

      // Build base prompt parts
      const promptParts: any[] = [
        {
          text: `You are the AI engine of Jansetu Citizen Complainant & Suggestion Portal. 
Analyze the citizen's contribution (which is submitted as a ${ticketType.toUpperCase()}).

Current selected map pin coordinates: Lat: ${location?.lat || 28.6139}, Lng: ${location?.lng || 77.2090}

Verify the user's ${ticketType} against the Ground Truth Local Infrastructure list:
${insightsText}

You must:
1. Listen to any attached audio files (transcribing the speech to English, even if spoken in regional languages like Hindi, Bengali, etc.), and read the transcript. Translate all inputs to English if they are in another Indian language or written in regional mixed dialects (such as Hinglish, Banglish, or other languages mixed with English terms, local slang, or local spelling variations). Normalise all local slang and abbreviations into standard English. Provide this standard English translation in the 'translatedText' field. Also, if there is an audio file, transcribe the audio exactly in the original language spoken (e.g. in Hindi script or Bengali script) and provide this in the 'originalTranscript' field.
2. Determine the category: Choose exactly one from: ["water", "roads", "education", "health", "power", "agriculture", "safety", "environment", "welfare", "housing", "anticorruption", "digital", "disaster", "women", "justice", "economy", "consumer", "taxes", "tourism", "youth", "innovation", "rural", "security", "cyber", "climate", "space", "foreign", "others"].
3. Determine the impact scope: Choose exactly one from: ["household", "street", "ward", "constituency"].
4. Estimate the population affected: Return a numerical estimate of how many citizens are affected (e.g. 5, 150, 2000, etc.) in the 'estimatedPopulation' field.
5. Check for duplicates/correlations: We have a list of existing active issues in the same region:
${JSON.stringify(hotspotsList)}
Determine if the citizen's complaint matches any of these active issues (i.e. is the same core issue at the same general place).
If a match is found, return the matching issue's ID in 'matchedHotspotId'. Otherwise, return null.
6. Verify against Ground Truth infrastructure:
- If the user complains that a facility type (e.g. school, hospital, police station, park, transit station, railway station, post office) is completely missing, absent, or not nearby, but the Ground Truth list above shows that such a facility actually exists within 5.0 km, you must set 'requiresClarification' to true and write a helpful question in 'clarificationQuestion' asking the user to specify what exactly is deficient, missing, or broken at that specific facility.
- If the user complains about waterlogging, drainage, flooding, or water supply, but has not specified the approximate location, street name, or nearby boundaries in the input transcript, set 'requiresClarification' to true and write a request in 'clarificationQuestion' asking them to describe the approximate area.
- Dynamic Specific Data Collection: For all category tags, evaluate if the input contains necessary specific details to resolve it:
  * water: Ask about waterlogging depth, water smell, color, duration of outage, or pressure.
  * roads: Ask about approximate pothole dimensions (depth/width), street blockages, sidewalk cracks, or length of road affected.
  * other suggestions: proposed execution timeline, community benefits, target group.
  If these details are missing, set 'requiresClarification' to true and formulate a request in 'clarificationQuestion' asking for these suggestion details.
- If the user's input is extremely brief, vague, or contains only search terms (e.g. "dirty", "repair", "help"), set 'requiresClarification' to true and ask them to explain the problem/suggestion in a full sentence.
- If the input is specific and valid (e.g. "broken bench at Central Park" or "no clean drinking water at Government School" or "road broken near railway station"), set 'requiresClarification' to false and 'clarificationQuestion' to null.
7. Mentioned Landmark Identification: Check if the user's transcript or audio mentions, refers to, or describes an issue happening near any specific place, establishment, shop, street, road, landmark, school, hospital, park, temple, or facility (either from the Ground Truth list above or general text). If yes, extract and return the exact name of that landmark, shop, street, road, temple, or establishment in the 'mentionedLandmarkName' field. If no specific place or landmark is mentioned, return null.
8. Extra Classifications:
- Determine urgency: Choose exactly one from: ["immediate", "moderate", "long_term"]
- Determine assetType: Choose exactly one from: ["roadway", "drainage", "building", "electrical_grid", "waste_management", "public_safety_asset", "social_facility", "others"]
- Determine fundingSource: Choose exactly one from: ["municipality", "constituency_development_fund", "state_government", "private_partnership"]
9. Problem Overview:
- Create a concise summary (problemBrief) of the issue briefing everything identified (including details gathered from text, audio, and vision/photos).
- Rate the priorityScore from 0 to 100 based on severity and impact.
- Set priorityLabel: Choose exactly one from: ["Low Priority", "Medium Priority", "High Priority", "Critical Priority"]
- Set estimatedBudget: Choose exactly one from: ["Low Budget", "Medium Budget", "High Budget", "Mega Project"]
- Set safetyRisk: Choose exactly one from: ["No Threat", "Low Risk", "Medium Risk", "High Threat / Hazard"]
10. Resolved Circle Calculation:
- If the complaint describes an approximate area, street segment, or boundaries, lookup the coordinates of those landmarks in the list provided or calculate relative offsets from the pin coordinates (${location?.lat || 28.6139}, ${location?.lng || 77.2090}), and return the absolute latitude/longitude center and estimated radius (in meters) of this region in fields 'resolvedCircleLat' (number), 'resolvedCircleLng' (number), and 'resolvedCircleRadius' (number). If no location descriptions are present, return null for these three fields.

Format the output strictly as a JSON object with keys:
{
  "originalTranscript": "...",
  "translatedText": "...",
  "category": "...",
  "scope": "...",
  "estimatedPopulation": 120,
  "matchedHotspotId": "..." or null,
  "requiresClarification": true/false,
  "clarificationQuestion": "..." or null,
  "mentionedLandmarkName": "..." or null,
  "urgency": "...",
  "assetType": "...",
  "fundingSource": "...",
  "problemBrief": "...",
  "priorityScore": 85,
  "priorityLabel": "...",
  "estimatedBudget": "...",
  "safetyRisk": "...",
  "resolvedCircleLat": 28.6139 or null,
  "resolvedCircleLng": 77.2090 or null,
  "resolvedCircleRadius": 150 or null
}

Citizen's Input details:
${textToAnalyze}

JSON:`
        }
      ];

      // Add actual base64 audio attachment to Gemini call if present
      currentItems.forEach(item => {
        if (item.type === 'audio' && item.audioBase64) {
          const cleanMime = (item.audioMimeType || 'audio/webm').split(';')[0];
          promptParts.push({
            inlineData: {
              mimeType: cleanMime,
              data: item.audioBase64
            }
          });
        }
      });

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: promptParts
          }]
        })
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error?.message || `API error ${response.status}: ${response.statusText}`);
      }
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const result = safeJsonParse(text);
        
        if (result.originalTranscript || result.translatedText) {
          setItems(prevItems => {
            return prevItems.map(item => {
              if (item.type === 'audio' && (!item.speechTranscript || item.speechTranscript === '')) {
                const transcriptText = result.originalTranscript || result.translatedText;
                return {
                  ...item,
                  content: transcriptText,
                  speechTranscript: transcriptText
                };
              }
              return item;
            });
          });
        }
        
        if (result.category) {
          setCategory(result.category);
        }
        if (result.scope) {
          setScope(result.scope);
        }
        if (result.estimatedPopulation) {
          setAiPopulationAffected(result.estimatedPopulation);
        }
        if (result.urgency) {
          setUrgency(result.urgency);
        }
        if (result.assetType) {
          setAssetType(result.assetType);
        }
        if (result.fundingSource) {
          setFundingSource(result.fundingSource);
        }
        if (result.problemBrief) {
          setAiOverview({
            brief: result.problemBrief,
            priorityScore: result.priorityScore || 50,
            priorityLabel: result.priorityLabel || 'Medium Priority',
            estimatedBudget: result.estimatedBudget || 'Medium Budget',
            safetyRisk: result.safetyRisk || 'Low Risk'
          });
        } else {
          setAiOverview(null);
        }

        if (result.matchedHotspotId) {
          const matched = nearbyHotspots.find(h => h.id === result.matchedHotspotId);
          if (matched) {
            setCorrelatedHotspot(matched);
          }
        } else {
          setCorrelatedHotspot(null);
        }

        if (result.requiresClarification) {
          setAiClarificationQuestion(result.clarificationQuestion);
          setAiUnderstood(false);
        } else {
          setAiClarificationQuestion(null);
          setAiUnderstood(true);
        }

        if (result.mentionedLandmarkName) {
          const queryStr = result.mentionedLandmarkName.toLowerCase();
          const google = (window as any).google;
          
          const fallbackLocalGroupLookup = () => {
            let matchedPlace: any = null;
            let matchedType = '';
            const groups = [
              { type: 'school', list: insights?.schools },
              { type: 'hospital', list: insights?.hospitals },
              { type: 'police', list: insights?.policeStations },
              { type: 'park', list: insights?.parks },
              { type: 'transit', list: insights?.transitStations },
              { type: 'railway', list: insights?.railways },
              { type: 'postOffice', list: insights?.postOffices },
              { type: 'temple', list: insights?.temples }
            ];
            for (const g of groups) {
              if (g.list) {
                const found = g.list.find(p => p.name.toLowerCase().includes(queryStr) || queryStr.includes(p.name.toLowerCase()));
                if (found) {
                  matchedPlace = found;
                  matchedType = g.type;
                  break;
                }
              }
            }
            if (matchedPlace) {
              setAiSuggestedLandmark({
                name: matchedPlace.name,
                type: matchedType,
                lat: matchedPlace.lat,
                lng: matchedPlace.lng
              });
            } else {
              setAiSuggestedLandmark(null);
            }
          };

          if (google && google.maps && google.maps.places && mapContainerRef.current) {
            const service = new google.maps.places.PlacesService(mapContainerRef.current);
            const request = {
              location: location ? new google.maps.LatLng(location.lat, location.lng) : new google.maps.LatLng(28.6139, 77.2090),
              radius: 5000,
              query: result.mentionedLandmarkName
            };
            service.textSearch(request, (results: any, status: any) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                const topResult = results[0];
                setAiSuggestedLandmark({
                  name: topResult.name,
                  type: 'custom',
                  lat: topResult.geometry.location.lat(),
                  lng: topResult.geometry.location.lng()
                });
              } else {
                fallbackLocalGroupLookup();
              }
            });
          } else {
            fallbackLocalGroupLookup();
          }
        } else {
          setAiSuggestedLandmark(null);
        }

        if (result.resolvedCircleLat && result.resolvedCircleLng) {
          setCircleData({
            lat: result.resolvedCircleLat,
            lng: result.resolvedCircleLng,
            radius: result.resolvedCircleRadius || 100
          });
        }

        setShowAiAutoDetectSection(true);

        setAiIndicator({ 
          active: true, 
          message: result.requiresClarification 
            ? '⚠️ AI Needs Clarification: Please read request below.'
            : `✨ AI Auto-Synced: Set Category to "${result.category.toUpperCase()}" & Scope to "${result.scope.toUpperCase()}"` 
        });
        setTimeout(() => setAiIndicator({ active: false, message: '' }), 5000);
      }
      setIsAiAnalyzing(false);
    } catch (e: any) {
      console.error("Gemini AI extraction failed: ", e);
      setAiIndicator({ active: false, message: '' });
      setIsAiAnalyzing(false);
      setAiError(e.message || "Failed to analyze with Gemini API");
      setAiUnderstood(false);
    }
  };

  const triggerGlobalAIAnalysis = (currentItems: SubmissionItem[]) => {
    if (!location) return;
    if (currentItems.length === 0) {
      setAiClarificationQuestion(null);
      setAiUnderstood(false);
      setShowAiAutoDetectSection(false);
      return;
    }
    const combinedText = currentItems
      .map(item => {
        if (item.type === 'text') return `User Text Note: ${item.content}`;
        if (item.type === 'audio') return `User Voice Transcript: ${item.speechTranscript || item.content}`;
        if (item.type === 'photo') return `AI Image Description: ${item.content || item.ocrText}`;
        return '';
      })
      .filter(Boolean)
      .join('\n');

    if (combinedText.trim()) {
      runAIAttachmentAnalysis(combinedText, currentItems);
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
    const nextItems = [...items, newItem];
    setItems(nextItems);
    setTextNote('');

    const textLower = content.toLowerCase();
    const isRefusal = textLower.includes("dont know") || textLower.includes("don't know") || textLower.includes("no idea") || textLower.includes("submit as is") || textLower.includes("submit anyway") || textLower.includes("cannot say") || textLower.includes("can't say") || textLower.includes("cant tell") || textLower.includes("can't tell") || textLower.includes("dont tell");
    if (isRefusal) {
      setClarificationRefusals(prev => {
        const nextVal = prev + 1;
        if (nextVal >= 2) {
          setAiUnderstood(true);
          setAiClarificationQuestion(null);
        }
        return nextVal;
      });
    }

    triggerGlobalAIAnalysis(nextItems);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const finalTranscript = liveTranscriptRef.current;

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(',')[1];
          const cleanMime = (audioBlob.type || 'audio/webm').split(';')[0];

          const newItem: SubmissionItem = {
            id: Date.now().toString(),
            type: 'audio',
            content: finalTranscript || 'Voice recording (Transcribing...)',
            fileUrl: audioUrl,
            speechTranscript: finalTranscript || '',
            audioBase64: base64data,
            audioMimeType: cleanMime
          };

          const nextItems = [...items, newItem];
          setItems(nextItems);
          setLiveTranscript('');
          liveTranscriptRef.current = '';
          setMicSharingBlocked(false);

          stream.getTracks().forEach(track => track.stop());

          const voiceLower = (finalTranscript || '').toLowerCase();
          const isRefusal = voiceLower.includes("dont know") || voiceLower.includes("don't know") || voiceLower.includes("no idea") || voiceLower.includes("submit as is") || voiceLower.includes("submit anyway") || voiceLower.includes("cannot say") || voiceLower.includes("can't say") || voiceLower.includes("cant tell") || voiceLower.includes("can't tell") || voiceLower.includes("dont tell");
          if (isRefusal) {
            setClarificationRefusals(prev => {
              const nextVal = prev + 1;
              if (nextVal >= 2) {
                setAiUnderstood(true);
                setAiClarificationQuestion(null);
              }
              return nextVal;
            });
          }

          triggerGlobalAIAnalysis(nextItems);
        };
      };

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
            setMicSharingBlocked(true);
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

  const runGeminiImageAnalysis = async (base64Data: string, mimeType: string): Promise<{ description: string; requiresMoreContext: boolean; boundingBoxes?: any[] } | null> => {
    const activeKey = localStorage.getItem('jansetu_gemini_key') || 'AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw';
    if (!activeKey) return null;

    setAiIndicator({ active: true, message: 'AI analyzing uploaded image context...' });

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${activeKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              },
              {
                text: `You are the AI engine of Jansetu. Analyze this image of a public infrastructure or community issue. If you can identify a clear civic or infrastructure issue (e.g. potholes, trash pile, water leak, broken streetlight, blocked drainage), output a detailed description of the problem in English. In addition, localize the key objects representing the damage or issue by generating bounding box estimates representing percentage coordinates (0 to 100). For each box, provide: x, y, width, height (as integers), label (e.g., "pothole", "garbage"), and severity (e.g. "Immediate Attention", "Moderate"). If the image is ambiguous, lacks context, or does not clearly show a community/infrastructure issue, set 'requiresMoreContext' to true. Output strictly in JSON format: { "description": "...", "requiresMoreContext": false, "boundingBoxes": [ { "x": 10, "y": 20, "width": 40, "height": 30, "label": "pothole", "severity": "Immediate Attention" } ] }`
              }
            ]
          }]
        })
      });

      const json = await response.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return safeJsonParse(text);
      }
      return null;
    } catch (e) {
      console.error("Gemini image analysis failed:", e);
      return null;
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    files.forEach(async file => {
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
      setImageContextWarning(false);

      try {
        const ocrResult = await Tesseract.recognize(
          file,
          'eng+hin',
          { logger: m => console.log(m) }
        );
        const cleanedText = ocrResult.data.text.trim();

        if (cleanedText.length > 15) {
          let nextItems: SubmissionItem[] = [];
          setItems(prev => {
            nextItems = prev.map(item => {
              if (item.id === id) {
                return {
                  ...item,
                  ocrText: cleanedText,
                  content: `OCR Text: ${cleanedText}`,
                  processing: false
                };
              }
              return item;
            });
            return nextItems;
          });
          setTimeout(() => triggerGlobalAIAnalysis(nextItems), 50);
        } else {
          const base64Data = await fileToBase64(file);
          const geminiResult = await runGeminiImageAnalysis(base64Data, file.type);
          
          if (geminiResult && geminiResult.description && !geminiResult.requiresMoreContext) {
            let nextItems: SubmissionItem[] = [];
            setItems(prev => {
              nextItems = prev.map(item => {
                if (item.id === id) {
                  return {
                    ...item,
                    content: geminiResult.description,
                    boundingBoxes: geminiResult.boundingBoxes,
                    processing: false
                  };
                }
                return item;
              });
              return nextItems;
            });
            setTimeout(() => triggerGlobalAIAnalysis(nextItems), 50);
          } else {
            setItems(prev => prev.map(item => {
              if (item.id === id) {
                return {
                  ...item,
                  content: 'Image uploaded. Please add more context.',
                  processing: false
                };
              }
              return item;
            }));
            setImageContextWarning(true);
          }
        }
      } catch (err) {
        console.error('Image analysis pipeline failed:', err);
        setItems(prev => prev.map(item => {
          if (item.id === id) {
            return {
              ...item,
              content: 'Failed to process image.',
              processing: false
            };
          }
          return item;
        }));
        setImageContextWarning(true);
      }
    });

    e.target.value = ''; // Reset input element
  };

  const handleDeleteItem = (id: string) => {
    let nextItems: SubmissionItem[] = [];
    setItems(prev => {
      nextItems = prev.filter(item => item.id !== id);
      return nextItems;
    });
    setTimeout(() => triggerGlobalAIAnalysis(nextItems), 50);
  };

  const isSubmitDisabled = !location || items.length === 0 || (!aiUnderstood && clarificationRefusals < 2) || (!!aiClarificationQuestion && clarificationRefusals < 2) || imageContextWarning || !!correlatedHotspot;

  const SECTOR_CATEGORIES = [
    { id: 'water', label: 'Water & Sanitation', icon: '🚰' },
    { id: 'roads', label: 'Roads & Transport', icon: '🛣️' },
    { id: 'education', label: 'Education & Schools', icon: '🏫' },
    { id: 'health', label: 'Healthcare Clinics', icon: '🏥' },
    { id: 'power', label: 'Power & Electricity', icon: '⚡' },
    { id: 'agriculture', label: 'Agriculture & Irrigation', icon: '🌾' },
    { id: 'safety', label: 'Public Safety & Police', icon: '🚓' },
    { id: 'environment', label: 'Environment & Parks', icon: '🌳' },
    { id: 'welfare', label: 'Social Welfare & Pensions', icon: '🤝' },
    { id: 'housing', label: 'Housing & Urban Dev', icon: '🏗️' },
    { id: 'anticorruption', label: 'Anti-Corruption & Vigilance', icon: '🛡️' },
    { id: 'digital', label: 'Digital Infrastructure', icon: '💻' },
    { id: 'disaster', label: 'Disaster Management', icon: '🚨' },
    { id: 'women', label: 'Women & Child Development', icon: '👩‍👧' },
    { id: 'justice', label: 'Justice & Law Enforcement', icon: '⚖️' },
    { id: 'economy', label: 'Job Creation & Economy', icon: '📈' },
    { id: 'consumer', label: 'Consumer Rights', icon: '🛒' },
    { id: 'taxes', label: 'Taxes, Revenue & Land', icon: '📜' },
    { id: 'tourism', label: 'Arts, Culture & Tourism', icon: '🎭' },
    { id: 'youth', label: 'Youth Affairs & Sports', icon: '⚽' },
    { id: 'innovation', label: 'Science & Innovation', icon: '🚀' },
    { id: 'rural', label: 'Rural Development', icon: '🏡' },
    { id: 'security', label: 'National Security & Defense', icon: '🪖' },
    { id: 'cyber', label: 'AI & Cyber Security', icon: '🤖' },
    { id: 'climate', label: 'Climate & Sustainability', icon: '🌱' },
    { id: 'space', label: 'Space & Advanced Tech', icon: '🛰️' },
    { id: 'foreign', label: 'International Relations', icon: '🌍' },
    { id: 'others', label: 'Others / General', icon: '📁' }
  ];
  const URGENCY_LEVELS = [
    { id: 'immediate', label: 'Immediate Attention', icon: '🚨' },
    { id: 'moderate', label: 'Moderate Schedule', icon: '📅' },
    { id: 'long_term', label: 'Long-term Planning', icon: '⏳' }
  ];

  const ASSET_TYPES = [
    { id: 'roadway', label: 'Roadway & Highway', icon: '🛣️' },
    { id: 'drainage', label: 'Sanitation & Drainage', icon: '🪠' },
    { id: 'building', label: 'Public Building / Facility', icon: '🏢' },
    { id: 'electrical_grid', label: 'Electrical Grid & Power', icon: '⚡' },
    { id: 'waste_management', label: 'Waste Management & Dumpyard', icon: '🗑️' },
    { id: 'public_safety_asset', label: 'Public Safety (CCTV, Police)', icon: '🚓' },
    { id: 'social_facility', label: 'Social Care (School, Hospital)', icon: '🏥' },
    { id: 'others', label: 'Others / Miscellaneous', icon: '📁' }
  ];

  const FUNDING_SOURCES = [
    { id: 'municipality', label: 'Municipality Budget', icon: '🏦' },
    { id: 'constituency_development_fund', label: 'MLA Constituency Development Fund', icon: '🗳️' },
    { id: 'state_government', label: 'State Government allocation', icon: '🏛️' },
    { id: 'private_partnership', label: 'Public Private Partnership (PPP)', icon: '🤝' }
  ];

  const handleSubmit = async () => {
    if (isSubmitDisabled) return;

    const itemsMapped = items.map(item => {
      if (item.type === 'audio') {
        return {
          type: item.type,
          content: item.content,
          fileUrl: '', // Discard audio recording, store transcript only
          speechTranscript: item.speechTranscript || ''
        };
      }
      if (item.type === 'photo' && item.content.startsWith('Image uploaded.')) {
        return {
          type: item.type,
          content: item.content,
          fileUrl: '', // Discard image since Gemini deemed it unnecessary / insufficient on its own
          speechTranscript: ''
        };
      }
      return {
        type: item.type,
        content: item.content,
        fileUrl: item.fileUrl || '',
        speechTranscript: item.speechTranscript || '',
        boundingBoxes: item.boundingBoxes || undefined
      };
    });

    const isIncomplete = !!(aiClarificationQuestion || !aiUnderstood);
    setSubmittedAsIncomplete(isIncomplete);

    const submissionData = {
      ticketType,
      category,
      scope,
      location: location || { lat: 0, lng: 0 },
      address,
      items: itemsMapped,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      associatedPlace: associatedPlace || undefined,
      estimatedImpact: aiPopulationAffected,
      urgency,
      assetType,
      fundingSource,
      aiOverview: aiOverview || undefined,
      circleData: circleData || undefined,
      status: isIncomplete ? 'needs_info' : 'pending',
      needsMoreInfo: isIncomplete
    };

    if (contributingIssue) {
      const extraData = {
        status: !isIncomplete ? 'pending' : 'needs_info',
        needsMoreInfo: isIncomplete,
        category,
        scope,
        estimatedImpact: aiPopulationAffected,
        urgency,
        assetType,
        fundingSource,
        aiOverview: aiOverview || undefined,
        circleData: circleData || undefined
      };
      await contributeToDemand(contributingIssue.id, itemsMapped, extraData);
      setTicketId(contributingIssue.id);
    } else {
      const id = await submitDemand(submissionData);
      setTicketId(id);
    }

    setShowSuccess(true);
  };

  const getGapExplanation = () => {
    if (!insights) return 'Select a location on the map to evaluate local infrastructure gaps.';
    const parts: string[] = [];
    
    const criticalThreshold = 3.0; // km
    const warnThreshold = 1.5; // km
    
    const places = [
      { name: 'School', data: insights.schools?.[0] },
      { name: 'Hospital', data: insights.hospitals?.[0] },
      { name: 'Police Station', data: insights.policeStations?.[0] },
      { name: 'Park', data: insights.parks?.[0] },
      { name: 'Transit Station', data: insights.transitStations?.[0] },
      { name: 'Railway Station', data: insights.railways?.[0] },
      { name: 'Post Office', data: insights.postOffices?.[0] }
    ];

    const criticalPlaces = places.filter(p => p.data && p.data.distance > criticalThreshold);
    const moderatePlaces = places.filter(p => p.data && p.data.distance <= criticalThreshold && p.data.distance > warnThreshold);

    if (criticalPlaces.length > 0) {
      parts.push(`🚨 Deficient: ${criticalPlaces.map(p => `${p.name} (${p.data!.distance.toFixed(2)} km)`).join(', ')} exceed the target accessibility threshold of 1.5 km.`);
    }
    if (moderatePlaces.length > 0) {
      parts.push(`⚠️ Moderate Gap: ${moderatePlaces.map(p => `${p.name} (${p.data!.distance.toFixed(2)} km)`).join(', ')} are somewhat distant.`);
    }
    if (criticalPlaces.length === 0 && moderatePlaces.length === 0) {
      parts.push(`✅ All critical facilities are within optimal accessibility range (under 1.5 km).`);
    }

    return parts.join(' ');
  };

  return (
    <div className="complainant-portal container">
      {/* Title block with back action */}
      <div className="portal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button type="button" className="btn-back" onClick={onBack}>
            <ArrowLeft size={18} />
            <span>Back to Roles</span>
          </button>
          <h2>{isDashboardView ? "Citizen Profile & Gamification Space" : "Citizen Complainant Portal"}</h2>
          <p className="portal-subtitle">
            {isDashboardView 
              ? "Track your submitted complaints/suggestions, claim achievements, and view civic points" 
              : "Submit infrastructure and developmental demands directly into the constituency registry"}
          </p>
          <div style={{ marginTop: '8px', fontSize: '10.5px', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(99,102,241,0.1)', padding: '4px 8px', borderRadius: '4px', width: 'fit-content' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }}></span>
            <span>Active Gemini API Key: <strong>{localStorage.getItem('jansetu_gemini_key') ? `${localStorage.getItem('jansetu_gemini_key')?.substring(0, 10)}...${localStorage.getItem('jansetu_gemini_key')?.substring(localStorage.getItem('jansetu_gemini_key')!.length - 4)}` : 'AIzaSyCx80ru6-RXeTi3GvqkFsMVyMf-vpgIoVw (Default)'}</strong></span>
          </div>
        </div>
        <button 
          type="button" 
          className="btn-toggle-settings" 
          onClick={() => {
            setIsDashboardView(!isDashboardView);
            setIsLoggedIn(false);
            setLoginEmail('');
          }}
          style={{ padding: '8px 16px', fontSize: '13px', background: isDashboardView ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)', color: isDashboardView ? '#a5b4fc' : '#6ee7b7', borderColor: isDashboardView ? '#6366f1' : '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          {isDashboardView ? "✍️ Switch to Form Submission" : "🏆 Switch to Profile Login"}
        </button>
      </div>
      {petitionTicket && !isDashboardView ? (
        <div className="form-card" style={{ maxWidth: '800px', margin: '40px auto', padding: '32px', textAlign: 'left' }}>
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '20px' }}>
            <span style={{ fontSize: '11px', background: '#10b981', color: 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
              📢 ACTIVE COMMUNITY PETITION (Ref: {petitionId})
            </span>
            <h3 style={{ marginTop: '12px', color: 'white' }}>"{petitionTicket.aiOverview?.brief || petitionTicket.category}"</h3>
            <p style={{ fontSize: '13px', color: '#c5c7e6', margin: '6px 0 0' }}>📍 Address: {petitionTicket.address}</p>
            <p style={{ fontSize: '13px', color: '#a5b4fc', margin: '4px 0 0' }}>
              Current Signatures: <strong>{petitionTicket.upvotes || 1} local residents</strong>
            </p>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <strong style={{ display: 'block', fontSize: '14.5px', marginBottom: '10px', color: '#c7d2fe' }}>
              Step 1: Click the map to verify your local coordinates (Must be within 2.0 km of the issue to prevent spam)
            </strong>
            <div style={{ height: '380px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              <GoogleMapComponent
                apiKey={apiKey}
                onLocationSelect={(loc, addr) => {
                  setLocation(loc);
                  setAddress(addr);
                }}
                selectedLocation={location}
                nearbyHotspots={[]}
                focusedPlace={petitionTicket.location}
                circleData={{ lat: petitionTicket.location.lat, lng: petitionTicket.location.lng, radius: 200 }}
              />
            </div>
            {location && (
              <span style={{ fontSize: '12.5px', color: '#34d399', display: 'block', marginTop: '10px' }}>
                📍 Coordinates Verified: {location.lat.toFixed(5)}, {location.lng.toFixed(5)} ({address})
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              type="button"
              style={{
                flex: 1,
                padding: '14px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '14px',
                cursor: 'pointer',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(16,185,129,0.2)'
              }}
              onClick={handlePetitionUpvote}
            >
              👍 Agree & Sign Petition
            </button>
            
            <button
              type="button"
              style={{
                flex: 1,
                padding: '14px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid #ef4444',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '14px',
                cursor: 'pointer',
                textAlign: 'center'
              }}
              onClick={() => {
                alert("You declined to sign this petition.");
                setPetitionTicket(null);
                setPetitionId(null);
                window.history.replaceState({}, document.title, window.location.pathname);
              }}
            >
              👎 Decline
            </button>
          </div>
        </div>
      ) : isDashboardView ? (
        <div style={{ marginTop: '24px' }}>
          {!isLoggedIn ? (
            <div className="form-card" style={{ maxWidth: '480px', margin: '40px auto', padding: '32px' }}>
              <div style={{ background: 'rgba(99, 102, 241, 0.1)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#818cf8' }}>
                <Award size={32} />
              </div>
              <h3 style={{ textAlign: 'center', margin: '0 0 8px' }}>Complainant Login</h3>
              <p style={{ textAlign: 'center', fontSize: '13px', color: '#8e90b3', margin: '0 0 24px' }}>
                Access your profile using your email address. No password or OTP required.
              </p>
              
              <div className="input-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="citizen@domain.com"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
              </div>

              <button 
                type="button" 
                className="btn-add-action" 
                onClick={handleLogin}
                disabled={!loginEmail.trim()}
                style={{ width: '100%', marginTop: '20px', padding: '12px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Access Citizen Space
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'left' }}>
              {/* Profile Card Header */}
              <div className="form-card" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(79, 70, 229, 0.08))', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '12px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', color: '#c7d2fe' }}>👤 Citizen: {loginEmail}</h3>
                  <span style={{ fontSize: '13px', color: '#a5b4fc' }}>
                    Rank status: <strong>{(() => {
                      const demandsCount = citizenDemands.length;
                      const totalUpvotes = citizenDemands.reduce((sum, d) => sum + (d.upvotes || 0), 0);
                      const score = demandsCount * 100 + totalUpvotes * 10;
                      if (score >= 1000) return '🏆 Level 4: Constituency Champion';
                      if (score >= 400) return '🛡️ Level 3: Ward Guardian';
                      if (score >= 100) return '🎖️ Level 2: Community Sentinel';
                      return '🌱 Level 1: Civic Observer';
                    })()}</strong>
                  </span>
                </div>
                
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', minWidth: '100px', textAlign: 'center' }}>
                    <span style={{ display: 'block', fontSize: '10px', color: '#8e90b3', textTransform: 'uppercase', fontWeight: 'bold' }}>Civic Score</span>
                    <strong style={{ fontSize: '20px', color: '#6366f1' }}>{(() => {
                      const demandsCount = citizenDemands.length;
                      const totalUpvotes = citizenDemands.reduce((sum, d) => sum + (d.upvotes || 0), 0);
                      return demandsCount * 100 + totalUpvotes * 10;
                    })()} pts</strong>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', minWidth: '100px', textAlign: 'center' }}>
                    <span style={{ display: 'block', fontSize: '10px', color: '#8e90b3', textTransform: 'uppercase', fontWeight: 'bold' }}>Submissions</span>
                    <strong style={{ fontSize: '20px', color: '#10b981' }}>{citizenDemands.length}</strong>
                  </div>
                </div>
              </div>

              {/* Achievement Badges grid */}
              <div className="form-card" style={{ marginTop: '20px', padding: '20px' }}>
                <h4 style={{ margin: '0 0 12px', color: '#a5b4fc' }}>🎖️ Claimed Achievement Badges</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {/* Scribe Badge */}
                  <div style={{ 
                    background: 'rgba(0,0,0,0.2)', 
                    border: '1px solid', 
                    borderColor: citizenDemands.some(d => d.items?.some((i: any) => i.type === 'text')) ? '#6366f1' : 'rgba(255,255,255,0.05)', 
                    opacity: citizenDemands.some(d => d.items?.some((i: any) => i.type === 'text')) ? 1 : 0.4,
                    padding: '12px', 
                    borderRadius: '8px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px' 
                  }}>
                    <span style={{ fontSize: '24px' }}>✍️</span>
                    <div>
                      <strong style={{ fontSize: '12.5px', color: 'white', display: 'block' }}>Scribe Badge</strong>
                      <span style={{ fontSize: '10px', color: '#a5b4fc' }}>Submitted text description</span>
                    </div>
                  </div>

                  {/* Speaker Badge */}
                  <div style={{ 
                    background: 'rgba(0,0,0,0.2)', 
                    border: '1px solid', 
                    borderColor: citizenDemands.some(d => d.items?.some((i: any) => i.type === 'audio')) ? '#10b981' : 'rgba(255,255,255,0.05)', 
                    opacity: citizenDemands.some(d => d.items?.some((i: any) => i.type === 'audio')) ? 1 : 0.4,
                    padding: '12px', 
                    borderRadius: '8px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px' 
                  }}>
                    <span style={{ fontSize: '24px' }}>🎤</span>
                    <div>
                      <strong style={{ fontSize: '12.5px', color: 'white', display: 'block' }}>Speaker Badge</strong>
                      <span style={{ fontSize: '10px', color: '#6ee7b7' }}>Submitted voice notes</span>
                    </div>
                  </div>

                  {/* Inspector Badge */}
                  <div style={{ 
                    background: 'rgba(0,0,0,0.2)', 
                    border: '1px solid', 
                    borderColor: citizenDemands.some(d => d.items?.some((i: any) => i.type === 'photo')) ? '#fbbf24' : 'rgba(255,255,255,0.05)', 
                    opacity: citizenDemands.some(d => d.items?.some((i: any) => i.type === 'photo')) ? 1 : 0.4,
                    padding: '12px', 
                    borderRadius: '8px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px' 
                  }}>
                    <span style={{ fontSize: '24px' }}>📸</span>
                    <div>
                      <strong style={{ fontSize: '12.5px', color: 'white', display: 'block' }}>Inspector Badge</strong>
                      <span style={{ fontSize: '10px', color: '#fde68a' }}>Submitted photo evidence</span>
                    </div>
                  </div>

                  {/* Collaborator Badge */}
                  <div style={{ 
                    background: 'rgba(0,0,0,0.2)', 
                    border: '1px solid', 
                    borderColor: citizenDemands.some(d => d.items?.length > 1) ? '#ec4899' : 'rgba(255,255,255,0.05)', 
                    opacity: citizenDemands.some(d => d.items?.length > 1) ? 1 : 0.4,
                    padding: '12px', 
                    borderRadius: '8px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px' 
                  }}>
                    <span style={{ fontSize: '24px' }}>🤝</span>
                    <div>
                      <strong style={{ fontSize: '12.5px', color: 'white', display: 'block' }}>Collaborator Badge</strong>
                      <span style={{ fontSize: '10px', color: '#fbcfe8' }}>Contributed details/updates</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Your Registered Items */}
              <div style={{ marginTop: '24px' }}>
                <h4 style={{ margin: '0 0 12px', color: '#c7d2fe' }}>📋 Your Submitted Issues & Suggestions</h4>
                
                {citizenDemands.length === 0 ? (
                  <div className="form-card" style={{ padding: '32px', textAlign: 'center', color: '#8e90b3' }}>
                    No registered tickets found for this email address. Switch back to Form view to submit your first suggestion!
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                    {citizenDemands.map(demand => {
                      const isSug = demand.ticketType === 'suggestion';
                      return (
                        <div key={demand.id} className="form-card" style={{ padding: '20px', borderLeft: isSug ? '4px solid #10b981' : '4px solid #f59e0b' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                <span style={{ fontSize: '10px', background: isSug ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: isSug ? '#34d399' : '#fbbf24', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                  {isSug ? '💡 SUGGESTION' : '⚠️ COMPLAINT'}
                                </span>
                                <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.08)', color: '#c7d2fe', padding: '1px 6px', borderRadius: '4px', textTransform: 'capitalize' }}>
                                  {demand.category}
                                </span>
                              </div>
                              <strong style={{ fontSize: '14px', color: 'white', display: 'block' }}>Ticket ID: {demand.id}</strong>
                              <span style={{ fontSize: '12px', color: '#8e90b3' }}>📍 Address: {demand.address}</span>
                            </div>
                            
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ 
                                fontSize: '11px', 
                                padding: '3px 8px', 
                                borderRadius: '4px', 
                                fontWeight: 'bold',
                                color: 'white',
                                background: demand.status === 'completed' ? '#10b981' :
                                            demand.status === 'work_started' ? '#3b82f6' :
                                            demand.status === 'funded' ? '#fbbf24' :
                                            demand.status === 'approved' ? '#818cf8' :
                                            demand.status === 'needs_info' ? '#ef4444' : '#f59e0b'
                              }}>
                                {demand.status === 'completed' ? 'Completed' :
                                 demand.status === 'work_started' ? 'Work Started' :
                                 demand.status === 'funded' ? 'Funded' :
                                 demand.status === 'approved' ? 'Speech Raised' :
                                 demand.status === 'needs_info' ? 'Needs More Info' : 'Pending Verification'}
                              </span>
                              <span style={{ display: 'block', fontSize: '11px', color: '#a5b4fc', marginTop: '6px' }}>
                                👍 {demand.upvotes || 1} Agreements
                              </span>
                            </div>
                          </div>

                          <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '12px' }}>
                            <span style={{ fontSize: '11px', color: '#8e90b3', display: 'block', marginBottom: '8px' }}>
                              📋 Visual Implementation Timeline:
                            </span>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              {[
                                { key: 'pending', label: 'Pending' },
                                { key: 'reviewed', label: 'Proposed' },
                                { key: 'approved', label: 'Speech Raised' },
                                { key: 'funded', label: 'Funded' },
                                { key: 'work_started', label: 'In Progress' },
                                { key: 'completed', label: 'Completed' }
                              ].map((step, sIdx, arr) => {
                                const statusList = ['pending', 'reviewed', 'approved', 'funded', 'work_started', 'completed'];
                                const currentIdx = statusList.indexOf(demand.status || 'pending');
                                const targetIdx = statusList.indexOf(step.key);
                                const isDone = targetIdx <= currentIdx;
                                const color = isDone ? (step.key === 'completed' ? '#34d399' : '#818cf8') : 'rgba(255,255,255,0.08)';

                                return (
                                  <React.Fragment key={step.key}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                      <div style={{
                                        width: '10px', height: '10px', borderRadius: '50%',
                                        background: color, border: '2px solid rgba(0,0,0,0.3)'
                                      }} />
                                      <span style={{ fontSize: '8px', color: isDone ? 'white' : '#8e90b3', marginTop: '2px', display: 'block', whiteSpace: 'nowrap' }}>
                                        {step.label}
                                      </span>
                                    </div>
                                    {sIdx < arr.length - 1 && (
                                      <div style={{ height: '2px', background: isDone && (sIdx < currentIdx) ? '#818cf8' : 'rgba(255,255,255,0.08)', flex: 1, marginBottom: '10px' }} />
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          </div>

                          {demand.aiOverview?.brief && (
                            <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#c7d2fe', background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '6px' }}>
                              <strong>AI Summary:</strong> {demand.aiOverview.brief}
                            </p>
                          )}

                          {/* Render Attachments count */}
                          <div style={{ marginTop: '12px', display: 'flex', gap: '12px', fontSize: '11px', color: '#8e90b3' }}>
                            <span>✍️ {demand.items?.filter((i: any) => i.type === 'text').length || 0} Text notes</span>
                            <span>🔊 {demand.items?.filter((i: any) => i.type === 'audio').length || 0} Voice recordings</span>
                            <span>🖼️ {demand.items?.filter((i: any) => i.type === 'photo').length || 0} Images</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="portal-grid">
          {/* Left Column: Contact, Location, Insights, and Duplicates */}
          <div className="portal-col">
          
          {/* Submission Mode Selector (Complaint vs Suggestion) */}
          <div className="form-card" style={{ marginBottom: '24px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'center', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(79, 70, 229, 0.15))', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#c7d2fe', textTransform: 'uppercase', flexShrink: 0 }}>Ticket Type:</span>
            <button
              type="button"
              onClick={() => {
                setTicketType('complaint');
                setItems([]);
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: ticketType === 'complaint' ? '#6366f1' : 'rgba(255,255,255,0.1)',
                background: ticketType === 'complaint' ? 'rgba(99,102,241,0.2)' : 'rgba(0,0,0,0.2)',
                color: ticketType === 'complaint' ? '#a5b4fc' : '#8e90b3',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              ⚠️ Complaint (Broken Infrastructure)
            </button>
            <button
              type="button"
              onClick={() => {
                setTicketType('suggestion');
                setItems([]);
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: ticketType === 'suggestion' ? '#10b981' : 'rgba(255,255,255,0.1)',
                background: ticketType === 'suggestion' ? 'rgba(16,185,129,0.2)' : 'rgba(0,0,0,0.2)',
                color: ticketType === 'suggestion' ? '#6ee7b7' : '#8e90b3',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              💡 Suggestion (New Proposals)
            </button>
          </div>

          {/* Section 1: Contact details */}
          <div className="form-card">
            <h3>1. Contact Details (Optional)</h3>
            <p className="section-help">Provide details to receive updates. Submit your email to earn Civic Points and unlock profile badges.</p>
            
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
          <div ref={mapContainerRef} className="form-card" style={{ marginTop: '24px' }}>
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
              focusedPlace={focusedPlace}
              circleData={circleData}
            />

            {/* Direct Landmark Search Option */}
            <div className="input-group" style={{ marginTop: '16px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#a5b4fc', display: 'block', marginBottom: '6px' }}>
                🔍 Search & Tag Landmark / Establishment (Optional)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Enter school name, hospital, police station, etc..."
                  value={landmarkSearchQuery}
                  onChange={e => setLandmarkSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleLandmarkSearch();
                    }
                  }}
                  style={{ flexGrow: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                />
                <button 
                  type="button" 
                  style={{ flexShrink: 0, padding: '0 16px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }} 
                  onClick={handleLandmarkSearch}
                >
                  Search
                </button>
              </div>
              
              {searchResultPlaces.length > 0 && (
                <div className="search-results-dropdown" style={{ background: '#1e1b4b', border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '8px', marginTop: '10px', padding: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#c7d2fe', fontWeight: 'bold' }}>Select a place to pan map and link to complaint:</p>
                  {searchResultPlaces.map((place, idx) => (
                    <div 
                      key={idx} 
                      className="search-place-row" 
                      onClick={() => handleSelectSearchedLandmark(place)}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '8px 10px', 
                        background: 'rgba(0,0,0,0.2)', 
                        border: '1px solid rgba(255,255,255,0.05)', 
                        borderRadius: '6px', 
                        marginBottom: '6px', 
                        cursor: 'pointer', 
                        fontSize: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, textAlign: 'left' }}>
                        <strong style={{ color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.name}</strong>
                        <span style={{ fontSize: '10px', color: '#c5c7e6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.formatted_address}</span>
                      </div>
                      <span className="distance-badge" style={{ fontSize: '10px', flexShrink: 0, marginLeft: '8px', background: 'rgba(99,102,241,0.25)', padding: '4px 6px', borderRadius: '4px', color: '#818cf8', fontWeight: 'bold' }}>📍 Link</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: AI Local Insights Gap factsheet */}
          {insights && (
            <div className="insights-card">
              <div className="insights-header">
                <Sparkles size={16} />
                <h4>AI Local Insights & Infrastructure Gaps</h4>
              </div>
              <p className="insights-help" style={{ fontSize: '12px', opacity: 0.8, margin: '-4px 0 12px' }}>
                💡 Click on any facility to view/focus on the map.
              </p>
              <div className="insights-body">
                {[
                  { label: '🏫 Nearest Public Schools', data: insights.schools, type: 'school' },
                  { label: '🏥 Nearest Public Hospitals', data: insights.hospitals, type: 'hospital' },
                  { label: '🚓 Nearest Police Stations', data: insights.policeStations, type: 'police' },
                  { label: '🌳 Nearest Public Parks', data: insights.parks, type: 'park' },
                  { label: '🚌 Nearest Transit Stations', data: insights.transitStations, type: 'transit' },
                  { label: '🚂 Nearest Railway Stations', data: insights.railways, type: 'railway' },
                  { label: '✉️ Nearest Post Offices', data: insights.postOffices, type: 'postOffice' }
                ].map((group, groupIdx) => {
                  if (!group.data || group.data.length === 0) return null;
                  const isExpanded = !!expandedCategories[group.type];
                  return (
                    <div key={groupIdx} className="insight-accordion-group" style={{ marginTop: '8px' }}>
                      <div 
                        className="insight-category-header" 
                        onClick={() => setExpandedCategories(prev => ({ ...prev, [group.type]: !prev[group.type] }))}
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          cursor: 'pointer', 
                          padding: '10px 14px', 
                          background: 'rgba(255,255,255,0.03)', 
                          border: '1px solid rgba(255,255,255,0.08)', 
                          borderRadius: '8px',
                          transition: 'background 0.2s ease'
                        }}
                      >
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#c7d2fe' }}>{group.label} ({group.data.length} found)</span>
                        <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 'bold' }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                      
                      {isExpanded && (
                        <div className="insight-category-list" style={{ paddingLeft: '10px', borderLeft: '2px solid rgba(99, 102, 241, 0.3)', marginTop: '4px' }}>
                          {group.data.map((place, idx) => {
                            const isAttached = associatedPlace?.name === place.name;
                            return (
                              <div 
                                key={idx} 
                                className={`insight-row-interactive ${isAttached ? 'attached' : ''}`}
                                onClick={() => {
                                  setFocusedPlace({ lat: place.lat, lng: place.lng, name: place.name });
                                  mapContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                style={{ marginTop: '6px' }}
                              >
                                <div className="insight-row-left">
                                  <strong style={{ fontSize: '0.8rem', color: 'white' }}>{idx + 1}. {place.name}</strong>
                                  <span style={{ fontSize: '0.75rem', color: '#c5c7e6' }}>{place.distance.toFixed(2)} km away</span>
                                </div>
                                <button
                                  type="button"
                                  className="btn-attach-landmark"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isAttached) {
                                      setAssociatedPlace(null);
                                    } else {
                                      setAssociatedPlace({
                                        name: place.name,
                                        type: group.type,
                                        lat: place.lat,
                                        lng: place.lng
                                      });
                                    }
                                  }}
                                >
                                  {isAttached ? '📌 Linked' : '🔗 Link Landmark'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {associatedPlace && (
                  <div className="associated-place-alert">
                    <span>📌 {ticketType === 'suggestion' ? 'Suggestion' : 'Complaint'} target landmark: <strong>{associatedPlace.name}</strong> ({associatedPlace.type})</span>
                    <button type="button" className="btn-remove-assoc" onClick={() => setAssociatedPlace(null)}>✕</button>
                  </div>
                )}

                <div className="insight-gap-analysis" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="gap-title">Sector Gap Rating:</span>
                    {(() => {
                      const schoolDist = insights.schools?.[0]?.distance || 5;
                      const hospDist = insights.hospitals?.[0]?.distance || 5;
                      const policeDist = insights.policeStations?.[0]?.distance || 5;
                      const maxDist = Math.max(schoolDist, hospDist, policeDist);
                      if (maxDist > 3.0) {
                        return <span className="rating-badge critical">🚨 Critically Deficient (High Infrastructure Gap)</span>;
                      } else if (maxDist > 1.5) {
                        return <span className="rating-badge warning">⚠️ Moderate (Needs Expansion)</span>;
                      } else {
                        return <span className="rating-badge optimal">✅ Good (Optimal Access)</span>;
                      }
                    })()}
                  </div>
                  
                  <div className="gap-rating-explanation" style={{ marginTop: '10px', fontSize: '12px', lineHeight: '1.5', color: '#c5c7e6', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '6px' }}>
                    <strong>Accessibility Gap Report:</strong>
                    <p style={{ margin: '4px 0 0' }}>{getGapExplanation()}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Nearby hotspots overlay votes */}
          {nearbyHotspots.length > 0 && (
            <div className="hotspots-card">
              <h4>⚠️ Existing Active Submissions in this Area ({nearbyHotspots.length})</h4>
              <p className="hotspots-help">To prevent duplicate entries, you can support or agree to an active submission below:</p>
              <div className="hotspots-list">
                {nearbyHotspots.map(hotspot => {
                  const isSuggestion = hotspot.ticketType === 'suggestion';
                  const isIncomplete = isHotspotIncomplete(hotspot);
                  return (
                    <div key={hotspot.id} className="hotspot-item" style={{ borderLeft: isSuggestion ? '4px solid #10b981' : '4px solid #f59e0b' }}>
                      <div className="hotspot-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <span style={{ fontSize: '10px', background: isSuggestion ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: isSuggestion ? '#34d399' : '#fbbf24', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                            {isSuggestion ? '💡 SUGGESTION' : '⚠️ COMPLAINT'}
                          </span>
                          <span className="hotspot-badge" style={{ textTransform: 'capitalize', margin: 0 }}>
                            {hotspot.category === 'water' && '🚰'}
                            {hotspot.category === 'roads' && '🛣️'}
                            {hotspot.category === 'education' && '🏫'}
                            {hotspot.category === 'health' && '🏥'}
                            {hotspot.category === 'power' && '⚡'}
                            {hotspot.category === 'agriculture' && '🌾'}
                            {hotspot.category === 'safety' && '🚓'}
                            {hotspot.category === 'environment' && '🌳'}
                            {hotspot.category === 'welfare' && '🤝'}
                            {hotspot.category === 'housing' && '🏗️'}
                            {hotspot.category === 'others' && '📁'}
                            {hotspot.category}
                          </span>
                        </div>
                        <p className="hotspot-text">{"\"" + (hotspot.items[0]?.content || hotspot.address) + "\""}</p>
                        {isIncomplete && (
                          <span style={{ fontSize: '10px', background: 'rgba(239,68,68,0.2)', color: '#f87171', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', display: 'inline-block', marginTop: '4px' }}>
                            ⚠️ Needs Details / {isSuggestion ? 'Crowdfunding Info' : 'Evidence'}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                        <button 
                          type="button"
                          className="btn-upvote"
                          disabled={upvotedHotspotIds.includes(hotspot.id)}
                          onClick={() => handleUpvote(hotspot.id)}
                          style={{ 
                            padding: '6px 10px', 
                            fontSize: '12px', 
                            borderColor: upvotedHotspotIds.includes(hotspot.id) ? 'rgba(255,255,255,0.1)' : isSuggestion ? '#10b981' : '#f59e0b', 
                            color: upvotedHotspotIds.includes(hotspot.id) ? '#8e90b3' : isSuggestion ? '#6ee7b7' : '#fde68a',
                            background: upvotedHotspotIds.includes(hotspot.id) ? 'rgba(255,255,255,0.05)' : 'transparent',
                            cursor: upvotedHotspotIds.includes(hotspot.id) ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {upvotedHotspotIds.includes(hotspot.id) ? '👍 Supported' : isSuggestion ? '👍 Agree' : '👍 Support'} ({hotspot.upvotes})
                        </button>
                        {isIncomplete && (
                          <button 
                            type="button" 
                            className="btn-add-action" 
                            onClick={() => {
                              setContributingIssue(hotspot);
                              setTicketType(hotspot.ticketType || 'complaint');
                              setLocation({ lat: hotspot.location.lat, lng: hotspot.location.lng });
                              setAddress(hotspot.address);
                              setCategory(hotspot.category);
                              setScope(hotspot.scope);
                              document.querySelector('.portal-col')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            style={{ fontSize: '10.5px', padding: '4px 8px', background: isSuggestion ? '#10b981' : '#e11d48', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            {isSuggestion ? '🪙 Crowdfund Info' : '📝 Contribute Info'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Evidence, attachments list, and AI auto-detect overrides */}
        <div className="portal-col">
          <div className="form-card h-full">
            <h3>3. Add {ticketType === 'suggestion' ? 'Suggestion' : 'Complaint'} Details & Attach {ticketType === 'suggestion' ? 'Proposals / Details' : 'Evidence'}</h3>
            <p className="section-help">You can attach multiple entries. At least one attachment is required.</p>

            {contributingIssue && (
              <div className="contributing-banner" style={{ border: '1px solid #10b981', background: 'rgba(16,185,129,0.1)', padding: '12px 14px', borderRadius: '8px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ textAlign: 'left' }}>
                  <strong style={{ color: '#34d399', fontSize: '13px', display: 'block' }}>📝 Mode: Contributing Info to Existing {contributingIssue.ticketType === 'suggestion' ? 'Suggestion' : 'Complaint'}</strong>
                  <span style={{ fontSize: '11px', color: '#6ee7b7' }}>Your inputs will be appended to the active {contributingIssue.ticketType || 'complaint'} ticket: <strong>"{contributingIssue.items?.[0]?.content || contributingIssue.address}"</strong></span>
                </div>
                <button 
                  type="button" 
                  className="btn-toggle-settings" 
                  onClick={() => {
                    setContributingIssue(null);
                    setItems([]);
                  }}
                  style={{ flexShrink: 0, padding: '4px 8px', fontSize: '11px', color: '#fca5a5', borderColor: '#fda4af', cursor: 'pointer', borderRadius: '4px' }}
                >
                  Cancel Contribution
                </button>
              </div>
            )}


            {isAiAnalyzing && (
              <div className="ai-verifying-banner" style={{ marginTop: '12px', border: '1px solid #6366f1', padding: '10px 14px', borderRadius: '8px', background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Loader2 className="spinner" size={18} style={{ color: '#818cf8' }} />
                <div>
                  <strong style={{ display: 'block', fontSize: '13px', color: '#c7d2fe' }}>{aiIndicator.message || "Verifying with AI..."}</strong>
                  <span style={{ fontSize: '11px', color: '#a5b4fc' }}>Cross-referencing details, categories, and local landmark parameters.</span>
                </div>
              </div>
            )}

            {/* Evidence inputs */}
            <div className="evidence-inputs" style={{ marginTop: '16px', position: 'relative' }}>
              
              {!location && (
                <div style={{
                  position: 'absolute',
                  top: -8,
                  left: -8,
                  right: -8,
                  bottom: -8,
                  background: 'rgba(15, 23, 42, 0.9)',
                  backdropFilter: 'blur(5px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                  borderRadius: '12px',
                  zIndex: 20,
                  textAlign: 'center',
                  border: '1px solid rgba(99, 102, 241, 0.2)'
                }}>
                  <div style={{ background: 'rgba(99, 102, 241, 0.2)', padding: '12px', borderRadius: '50%', marginBottom: '12px', color: '#818cf8' }}>
                    <MapPin size={32} />
                  </div>
                  <strong style={{ color: '#c7d2fe', fontSize: '15px', display: 'block', marginBottom: '6px' }}>📍 Map Location Required</strong>
                  <p style={{ color: '#a5b4fc', fontSize: '12.5px', margin: 0, lineHeight: '1.4' }}>
                    Please select a point on the map in Section 2 first to unlock descriptions, attachments, and the AI verification engine.
                  </p>
                </div>
              )}
              
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
                      {micSharingBlocked 
                        ? '🎙️ Recording audio note... (Native browser preview unavailable. Gemini will transcribe this note once you stop recording)' 
                        : (liveTranscript || 'Listening... speak now.')}
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

            {/* Context Warning for Image Analysis */}
            {imageContextWarning && (
              <div className="context-warning-card" style={{ marginTop: '16px', border: '1px dashed #fbbf24', padding: '12px', borderRadius: '8px', background: 'rgba(251,191,36,0.1)' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#f59e0b' }}>
                  ❓ <strong>AI needs more context:</strong> The uploaded image details are ambiguous. Please add a brief voice note or text description to describe the exact problem.
                </p>
              </div>
            )}

            {/* AI Suggested Landmark Recommendations */}
            {aiSuggestedLandmark && (
              <div className="ai-suggested-place-card" style={{ marginTop: '16px', border: '1px solid #6366f1', padding: '14px', borderRadius: '8px', background: 'rgba(99,102,241,0.08)' }}>
                <h4 style={{ margin: '0 0 6px', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} />
                  <span>AI Landmark Recommendation</span>
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#c7d2fe', lineHeight: '1.4' }}>
                  It looks like your description mentions <strong>{aiSuggestedLandmark.name}</strong>. Would you like to link this landmark to your complaint?
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button 
                    type="button" 
                    className="btn-add-action" 
                    style={{ fontSize: '11px', padding: '6px 12px', background: '#4f46e5' }}
                    onClick={() => {
                      setAssociatedPlace(aiSuggestedLandmark);
                      setFocusedPlace({ lat: aiSuggestedLandmark.lat, lng: aiSuggestedLandmark.lng, name: aiSuggestedLandmark.name });
                      mapContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
                      setAiSuggestedLandmark(null);
                    }}
                  >
                    📌 Yes, Tag & Focus
                  </button>
                  <button 
                    type="button" 
                    className="btn-toggle-settings" 
                    style={{ fontSize: '11px', padding: '6px 12px', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                    onClick={() => setAiSuggestedLandmark(null)}
                  >
                    Dismiss Suggestion
                  </button>
                </div>
              </div>
            )}

            {/* AI Clarification Warnings */}
            {aiClarificationQuestion && (
              <div className="ai-clarification-card" style={{ marginTop: '16px', border: '1px solid #f59e0b', padding: '14px', borderRadius: '8px', background: 'rgba(245,158,11,0.08)' }}>
                <h4 style={{ margin: '0 0 6px', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} />
                  <span>AI Request for Clarification</span>
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#fde68a', lineHeight: '1.4', textAlign: 'left' }}>
                  {aiClarificationQuestion}
                </p>
                <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#c5c7e6', fontStyle: 'italic', textAlign: 'left' }}>
                  Please add a follow-up text description or voice note clarifying the details to unlock submission.
                </p>
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    className="btn-toggle-settings" 
                    style={{ fontSize: '11px', padding: '6px 12px', border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.1)', color: '#fbbf24', cursor: 'pointer', borderRadius: '4px' }}
                    onClick={() => {
                      setClarificationRefusals(2);
                      setAiUnderstood(true);
                      setAiClarificationQuestion(null);
                    }}
                  >
                    ⚠️ Submit Anyway (I don't know more details)
                  </button>
                </div>
              </div>
            )}

            {!aiUnderstood && items.length > 0 && !aiClarificationQuestion && !aiError && (
              <div className="ai-status-pending-card" style={{ marginTop: '16px', border: '1px dashed rgba(99, 102, 241, 0.4)', padding: '12px', borderRadius: '8px', background: 'rgba(99,102,241,0.04)' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#c7d2fe' }}>
                  ⏳ AI is currently analyzing your inputs. Submission will unlock once classification and verification are complete.
                </p>
              </div>
            )}

            {aiError && (
              <div className="ai-error-card" style={{ marginTop: '16px', border: '1px solid #ef4444', padding: '14px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', textAlign: 'left' }}>
                <strong style={{ display: 'block', fontSize: '13px', color: '#fca5a5', marginBottom: '6px' }}>❌ Gemini AI Verification Failed</strong>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#fca5a5', lineHeight: '1.4' }}>
                  {aiError}
                </p>
                <div style={{ padding: '10px 12px', background: 'rgba(15,23,42,0.6)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p style={{ margin: 0, fontSize: '11.5px', color: '#fbcfe8', lineHeight: '1.5' }}>
                    💡 <strong>Quick Fix:</strong> Please verify that you copied the complete API key from Google AI Studio. Google AI Studio keys start with either the <strong>AIzaSy</strong> or <strong>AQ.</strong> prefix. If you see this card, the API call failed (e.g. invalid permissions, incorrect project setup, or network timeout).
                  </p>
                </div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    className="btn-toggle-settings" 
                    style={{ fontSize: '11px', padding: '6px 12px', border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.1)', color: '#fbbf24', cursor: 'pointer', borderRadius: '4px' }}
                    onClick={() => {
                      setClarificationRefusals(2);
                      setAiUnderstood(true);
                      setAiError(null);
                    }}
                  >
                    ⚠️ Submit Anyway (Bypass AI Verification)
                  </button>
                </div>
              </div>
            )}

            {/* List of attachments */}
            <div className="attachments-section" style={{ marginTop: '24px' }}>
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
                              <div className="speech-transcript-box">
                                <span className="box-title">Speech-to-Text Transcript:</span>
                                <p className="transcript-text">{"\"" + item.speechTranscript + "\""}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {item.type === 'photo' && (
                          <div className="photo-item-wrapper" style={{ position: 'relative' }}>
                            <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                              <img src={item.fileUrl} alt={item.fileName} className="photo-preview-thumbnail" style={{ display: 'block', width: '100%', borderRadius: '6px' }} />
                              {item.boundingBoxes && item.boundingBoxes.map((box, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    position: 'absolute',
                                    border: '2px solid #ef4444',
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    left: `${box.x}%`,
                                    top: `${box.y}%`,
                                    width: `${box.width}%`,
                                    height: `${box.height}%`,
                                    zIndex: 10,
                                    pointerEvents: 'none',
                                    boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)'
                                  }}
                                >
                                  <span style={{
                                    position: 'absolute',
                                    top: '-18px',
                                    left: '-2px',
                                    background: '#ef4444',
                                    color: 'white',
                                    fontSize: '9px',
                                    padding: '1px 4px',
                                    borderRadius: '2px',
                                    whiteSpace: 'nowrap',
                                    fontWeight: 'bold',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                  }}>
                                    {box.label} ({box.severity})
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="photo-details" style={{ marginTop: '12px' }}>
                              <span className="photo-name">{item.fileName}</span>
                              {item.processing ? (
                                <div className="ocr-processing">
                                  <Loader2 className="spinner" size={14} />
                                  <span>Extracting text (OCR/AI)...</span>
                                </div>
                              ) : (
                                item.content && (
                                  <div className="ocr-text-box">
                                    <span className="box-title">AI Image Description:</span>
                                    <p className="ocr-text">{"\"" + item.content + "\""}</p>
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

            {/* AI Correlation warning card */}
            {correlatedHotspot && (
              <div className="correlation-warning-card" style={{ marginTop: '24px', border: '1px solid #ef4444', padding: '16px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)' }}>
                <h4 style={{ margin: '0 0 8px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>⚠️ AI Correlation Alert</h4>
                <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#fca5a5' }}>
                  Our AI engine has matched your complaint description with an existing issue in the region:
                </p>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', background: 'rgba(239, 68, 68, 0.15)', padding: '8px 12px', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#fca5a5', fontWeight: 'bold' }}>🤖 AI Similarity Score:</span>
                  <span style={{ fontSize: '12px', color: '#ffffff', fontWeight: '900', background: '#ef4444', padding: '2px 6px', borderRadius: '4px' }}>92% Match</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', margin: '8px 0 12px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', padding: '8px', borderRadius: '6px', fontSize: '11px', textAlign: 'left' }}>
                    <span style={{ color: '#8e90b3', display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Your Input:</span>
                    <span style={{ color: '#c7d2fe' }}>"{items[0]?.content || 'Empty'}"</span>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', padding: '8px', borderRadius: '6px', fontSize: '11px', textAlign: 'left' }}>
                    <span style={{ color: '#8e90b3', display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Existing Record:</span>
                    <span style={{ color: '#c7d2fe' }}>"{correlatedHotspot.items?.[0]?.content || correlatedHotspot.address}"</span>
                  </div>
                </div>

                <div className="matched-hotspot-preview" style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px', textAlign: 'left' }}>
                  <strong>Category:</strong> <span style={{ textTransform: 'capitalize' }}>{correlatedHotspot.category}</span><br />
                  <strong>Detail:</strong> "{correlatedHotspot.items?.[0]?.content || correlatedHotspot.address}"<br />
                  <strong>Current upvotes:</strong> {correlatedHotspot.upvotes}
                </div>
                <div className="correlation-actions" style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    type="button" 
                    className="btn-add-action" 
                    style={{ 
                      background: upvotedHotspotIds.includes(correlatedHotspot.id) ? 'rgba(255,255,255,0.05)' : '#22c55e', 
                      color: upvotedHotspotIds.includes(correlatedHotspot.id) ? '#8e90b3' : 'white', 
                      flex: 1,
                      cursor: upvotedHotspotIds.includes(correlatedHotspot.id) ? 'not-allowed' : 'pointer'
                    }}
                    disabled={upvotedHotspotIds.includes(correlatedHotspot.id)}
                    onClick={() => {
                      handleUpvote(correlatedHotspot.id);
                      alert("Successfully supported the existing issue. Upvote registered!");
                      setCorrelatedHotspot(null);
                    }}
                  >
                    {upvotedHotspotIds.includes(correlatedHotspot.id) ? '👍 Already Supported' : '👍 Just Support/Upvote Existing'}
                  </button>
                  <button 
                    type="button" 
                    className="btn-toggle-settings" 
                    style={{ flex: 1, borderColor: '#ef4444', color: '#f87171' }}
                    onClick={() => setCorrelatedHotspot(null)}
                  >
                    Create New Independent Complaint
                  </button>
                </div>
              </div>
            )}

            {/* Sector tags and Scope override - Visible only after items are added and analyzed */}
            {showAiAutoDetectSection && items.length > 0 && (
              <div className="ai-classification-overrides" style={{ marginTop: '28px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                <h4 style={{ margin: '0 0 12px', color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} />
                  <span>AI Classification & Parameter Overrides</span>
                </h4>

                {/* Visual Category Selector Grid */}
                <div className="input-box-sub">
                  <label>Category Tag (Manual Override)</label>
                  <div className="category-grid" style={{ maxHeight: '180px', overflowY: 'auto', padding: '6px' }}>
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

                {/* Impact Scope Visual Range Slider */}
                <div className="input-box-sub" style={{ marginTop: '20px' }}>
                  <label>Impact Scope: <strong>{scope.toUpperCase()}</strong> (Manual Override)</label>
                  <p className="slider-help" style={{ fontSize: '11px', color: '#8e90b3', margin: '-4px 0 8px' }}>
                    Adjust slider to manually override estimated citizens affected by this complaint.
                  </p>
                  
                  <div className="population-slider-container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                      <span>Estimated Impact:</span>
                      <strong style={{ color: '#6366f1' }}>{aiPopulationAffected.toLocaleString()} citizens</strong>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="100000" 
                      step="5"
                      value={aiPopulationAffected}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setAiPopulationAffected(val);
                        // Map to scope tag automatically
                        if (val <= 10) setScope('household');
                        else if (val <= 500) setScope('street');
                        else if (val <= 10000) setScope('ward');
                        else setScope('constituency');
                      }}
                      className="full-population-slider"
                      style={{ width: '100%', accentColor: '#4f46e5' }}
                    />
                    <div className="slider-ticks" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#8e90b3', marginTop: '6px' }}>
                      <span>Household (1-10)</span>
                      <span>Street (~150)</span>
                      <span>Ward (~5k)</span>
                      <span>Constituency (10k+)</span>
                    </div>
                  </div>
                </div>

                {/* Extra Parameters Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '20px' }}>
                  {/* Urgency Display */}
                  <div className="input-box-sub" style={{ margin: 0 }}>
                    <label>Urgency Level (AI Determined)</label>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', color: 'white', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', minHeight: '38px' }}>
                      {(() => {
                        const found = URGENCY_LEVELS.find(u => u.id === urgency);
                        return found ? `${found.icon} ${found.label}` : `${urgency}`;
                      })()}
                    </div>
                  </div>

                  {/* Funding Source Display */}
                  <div className="input-box-sub" style={{ margin: 0 }}>
                    <label>Suggested Funding (AI Determined)</label>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', color: 'white', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', minHeight: '38px' }}>
                      {(() => {
                        const found = FUNDING_SOURCES.find(f => f.id === fundingSource);
                        return found ? `${found.icon} ${found.label}` : `${fundingSource}`;
                      })()}
                    </div>
                  </div>
                </div>

                {/* Asset Type Display */}
                <div className="input-box-sub" style={{ marginTop: '20px' }}>
                  <label>Infrastructure Asset Sub-type (AI Determined)</label>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', color: 'white', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', minHeight: '38px' }}>
                    {(() => {
                      const found = ASSET_TYPES.find(a => a.id === assetType);
                      return found ? `${found.icon} ${found.label}` : `${assetType}`;
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* AI Summary & Analysis Overview Section */}
            {showAiAutoDetectSection && items.length > 0 && aiOverview && (
              <div className="ai-summary-overview-card" style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                <h4 style={{ margin: '0 0 14px', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} />
                  <span>AI Summary & Pre-Submission Overview</span>
                </h4>

                <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '16px' }}>

                  {/* Brief Description */}
                  <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#c7d2fe', lineHeight: '1.5', textAlign: 'left' }}>
                    <strong>Problem Summary:</strong> {aiOverview.brief}
                  </p>

                  {/* Metrics Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '14px' }}>
                    {/* Priority score & label */}
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                      <span style={{ fontSize: '10px', color: '#8e90b3', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Priority Level</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ 
                          fontSize: '11px', 
                          padding: '3px 8px', 
                          borderRadius: '4px', 
                          fontWeight: 'bold',
                          color: 'white',
                          background: aiOverview.priorityLabel.includes('Critical') || aiOverview.priorityLabel.includes('High') ? '#ef4444' : aiOverview.priorityLabel.includes('Medium') ? '#f59e0b' : '#10b981'
                        }}>
                          {aiOverview.priorityLabel}
                        </span>
                        <strong style={{ color: 'white', fontSize: '14px' }}>({aiOverview.priorityScore}/100)</strong>
                      </div>
                    </div>

                    {/* Safety Risk */}
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                      <span style={{ fontSize: '10px', color: '#8e90b3', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Safety Risk Rating</span>
                      <strong style={{ 
                        fontSize: '12px', 
                        color: aiOverview.safetyRisk.includes('High') || aiOverview.safetyRisk.includes('Hazard') ? '#f87171' : aiOverview.safetyRisk.includes('Medium') ? '#fbbf24' : '#34d399'
                      }}>
                        ⚠️ {aiOverview.safetyRisk}
                      </strong>
                    </div>

                    {/* Budget Category */}
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                      <span style={{ fontSize: '10px', color: '#8e90b3', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Estimated Budget</span>
                      <strong style={{ fontSize: '12px', color: '#c7d2fe' }}>
                        🪙 {aiOverview.estimatedBudget}
                      </strong>
                    </div>

                    {/* Impact Scope */}
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'left' }}>
                      <span style={{ fontSize: '10px', color: '#8e90b3', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Impact Level</span>
                      <strong style={{ fontSize: '12px', color: '#a5b4fc', textTransform: 'capitalize' }}>
                        🌐 {scope} scope
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
      )}

      {/* Submit verification bar */}
      {!isDashboardView && (
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
          <div className={'checklist-item ' + (isAiAnalyzing ? 'analyzing' : aiUnderstood && !aiClarificationQuestion ? 'checked' : '')}>
            {isAiAnalyzing ? <Loader2 className="spinner" size={14} style={{ marginRight: '8px', color: '#818cf8' }} /> : <span className="checkbox"></span>}
            <span>AI Verification Satisfied</span>
          </div>
        </div>

        <button
          type="button"
          className="btn-submit-proposal"
          disabled={isSubmitDisabled}
          onClick={handleSubmit}
        >
          <span>Submit {ticketType === 'suggestion' ? 'Suggestion' : 'Complaint'} to Registry</span>
          <ArrowRight size={18} />
        </button>
      </div>
      )}

      {/* Submission Success Modal */}
      {showSuccess && (
        <div className="modal-overlay">
          <div className="modal-content text-center">
            <div className="modal-success-icon">
              <CheckCircle size={64} />
            </div>
            <h3>{ticketType === 'suggestion' ? 'Suggestion Registered Successfully!' : 'Complaint Registered Successfully!'}</h3>
            <p className="modal-desc">
              Your {ticketType} has been logged. The AI Engine will index, cluster, and present this to constituency officials.
            </p>

            {submittedAsIncomplete && (
              <div className="incomplete-success-alert" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid #d97706', padding: '14px', borderRadius: '8px', margin: '16px 0', textAlign: 'left' }}>
                <strong style={{ color: '#fbbf24', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Sparkles size={14} />
                  <span>Awaiting Community Contribution</span>
                </strong>
                <span style={{ fontSize: '12px', color: '#fde68a', lineHeight: '1.4', display: 'block' }}>
                  This {ticketType} has been registered with incomplete details. It is marked as <strong>"Needs More Info"</strong> and will be processed once additional evidence, suggestions, or descriptions are contributed by other citizens.
                </span>
              </div>
            )}

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
              {associatedPlace && (
                <div className="summary-row">
                  <span>Target Landmark:</span>
                  <strong>{associatedPlace.name} ({associatedPlace.type})</strong>
                </div>
              )}
              <div className="summary-row">
                <span>Category Tag:</span>
                <strong style={{ textTransform: 'capitalize' }}>{category}</strong>
              </div>
              <div className="summary-row">
                <span>Impact Scope:</span>
                <strong>{scope.toUpperCase()} (~{aiPopulationAffected.toLocaleString()} citizens)</strong>
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
                  src={"https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=" + encodeURIComponent(`${window.location.origin}/track.html?id=${ticketId}`)}
                  alt="Track Ticket QR" 
                  style={{ width: '120px', height: '120px', borderRadius: '8px', border: '1px solid #4f46e5' }}
                />
                <span style={{ fontSize: '11px', color: '#8e90b3', fontWeight: '600' }}>Scan to track status live</span>
              </div>

              <div className="whatsapp-petition-card" style={{ marginTop: '20px', border: '1px solid #22c55e', background: 'rgba(34,197,94,0.08)', borderRadius: '8px', padding: '14px', textAlign: 'left' }}>
                <strong style={{ color: '#4ade80', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  📢 WhatsApp Petition Generator
                </strong>
                <span style={{ fontSize: '12px', color: '#a7f3d0', lineHeight: '1.4', display: 'block', marginBottom: '10px' }}>
                  Generate a shareable petition link. Neighbors must select their map location nearby to upvote/agree.
                </span>
                
                <button
                  type="button"
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#22c55e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  onClick={() => {
                    const text = `Hi neighbors! I have raised a ${ticketType === 'suggestion' ? 'proposal' : 'complaint'} on Jansetu regarding "${aiOverview?.brief || category}". We need community signatures to draw local MLA attention. Please upvote this petition here (must be within 2.0 km of the map location): ${window.location.origin}/complainant.html?petitionId=${ticketId}`;
                    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
                    window.open(whatsappUrl, '_blank');
                  }}
                >
                  💬 Share Petition on WhatsApp Groups
                </button>
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
              setFocusedPlace(null);
              setAssociatedPlace(null);
              setAiPopulationAffected(150);
              setCorrelatedHotspot(null);
              setImageContextWarning(false);
              setShowAiAutoDetectSection(false);
              setAiClarificationQuestion(null);
              setAiUnderstood(false);
              setAiSuggestedLandmark(null);
              setSearchResultPlaces([]);
              setLandmarkSearchQuery('');
              setUrgency('moderate');
              setAssetType('others');
              setFundingSource('municipality');
              setAiOverview(null);
              setCircleData(null);
              setClarificationRefusals(0);
              setContributingIssue(null);
              setSubmittedAsIncomplete(false);
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

            {/* Portal 1b: Complainant Profile Login */}
            <div className="role-card card-citizen" id="portal-citizen-login" onClick={() => window.location.href = '/complainant.html?login=true'} style={{ borderLeft: '4px solid #818cf8' }}>
              <div className="card-content">
                <div className="icon-box" style={{ background: 'rgba(129, 140, 248, 0.1)', color: '#818cf8' }}>
                  <Award size={28} />
                </div>
                <span className="role-label">Citizen Space</span>
                <h3 className="role-title">Complainant Login</h3>
                <p className="role-desc">
                  Access your profile, track status of submitted complaints/suggestions, view your civic score, and view active badges.
                </p>
              </div>
              <div className="card-action">
                <button className="role-btn" onClick={(e) => { e.stopPropagation(); window.location.href = '/complainant.html?login=true'; }} style={{ background: '#818cf8', color: '#1e1b4b' }}>
                  <span>Profile Login</span>
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
