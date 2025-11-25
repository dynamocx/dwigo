import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius?: number; // in km, defaults to 15
}

// Predefined locations for Mid-Michigan
export const PRESET_LOCATIONS: Location[] = [
  {
    id: 'lansing',
    name: 'Lansing, MI',
    latitude: 42.7325,
    longitude: -84.5555,
    radius: 15,
  },
  {
    id: 'flint',
    name: 'Flint, MI',
    latitude: 43.0125,
    longitude: -83.6875,
    radius: 15,
  },
  {
    id: 'grand-blanc',
    name: 'Grand Blanc, MI',
    latitude: 42.9275,
    longitude: -83.6169,
    radius: 15,
  },
  {
    id: 'fenton',
    name: 'Fenton, MI',
    latitude: 42.7978,
    longitude: -83.7050,
    radius: 15,
  },
];

const STORAGE_KEY = 'dwigo_selected_location';

interface LocationContextType {
  selectedLocation: Location | null;
  setSelectedLocation: (location: Location | null) => void;
  useCurrentLocation: () => Promise<void>;
  isLocating: boolean;
  locationError: string | null;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const [selectedLocation, setSelectedLocationState] = useState<Location | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Load saved location from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Location;
        // Validate the saved location still exists in presets or is valid
        const isValid =
          PRESET_LOCATIONS.some((loc) => loc.id === parsed.id) ||
          (parsed.latitude && parsed.longitude);
        if (isValid) {
          setSelectedLocationState(parsed);
        } else {
          // Default to Lansing if saved location is invalid
          setSelectedLocationState(PRESET_LOCATIONS[0]);
        }
      } else {
        // Default to Lansing if nothing saved
        setSelectedLocationState(PRESET_LOCATIONS[0]);
      }
    } catch (error) {
      console.error('Failed to load saved location:', error);
      setSelectedLocationState(PRESET_LOCATIONS[0]);
    }
  }, []);

  const setSelectedLocation = (location: Location | null) => {
    setSelectedLocationState(location);
    if (location) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
      } catch (error) {
        console.error('Failed to save location:', error);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setLocationError(null);
  };

  const useCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        });
      });

      const location: Location = {
        id: 'current',
        name: 'My Location',
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        radius: 15,
      };

      setSelectedLocation(location);
    } catch (error) {
      const geolocationError = error as GeolocationPositionError;
      let errorMessage = 'Unable to get your location';
      if (geolocationError.code === GeolocationPositionError.PERMISSION_DENIED) {
        errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
      } else if (geolocationError.code === GeolocationPositionError.POSITION_UNAVAILABLE) {
        errorMessage = 'Location information unavailable.';
      } else if (geolocationError.code === GeolocationPositionError.TIMEOUT) {
        errorMessage = 'Location request timed out. Please try again.';
      }
      setLocationError(errorMessage);
      console.error('Geolocation error:', geolocationError);
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <LocationContext.Provider
      value={{
        selectedLocation,
        setSelectedLocation,
        useCurrentLocation,
        isLocating,
        locationError,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

