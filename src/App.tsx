import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, 
  Square, 
  RotateCcw, 
  MapPin, 
  Navigation, 
  DollarSign, 
  Zap, 
  Route, 
  Clock, 
  Pause, 
  Info,
  ChevronDown,
  ChevronUp,
  Skull,
  CandlestickChart,
  Flower,
  Car,
  Plus, // Icono para el botón de incremento
  Minus, // Icono para el botón de decremento
  FastForward, // Nuevo icono para parada rápida
  ShoppingBag // Nuevo icono para servicio de parada
} from 'lucide-react';

// [Otras interfaces y constantes como Position, TripData, RATES, etc. se mantienen igual]

interface Position {
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface TripData {
  distance: number;
  cost: number;
  waitingTime: number;
  isRunning: boolean;
  isPaused: boolean;
  rawDistance: number; // Distancia sin descuentos para mostrar en debug
}

interface TripType {
  id: string;
  name: string;
  description: string;
  fixedPrice?: number;
  distanceKm?: number;
  subTrips?: SubTrip[];
}

interface SubTrip {
  id: string;
  name: string;
  fixedPrice: number;
}

interface TripSummary {
  tripType: string;
  distance: number;
  waitingTime: number;
  cost: number;
  timestamp: string;
  isSorianaActive: boolean;
  petConfig: PetConfig;
  servicioEspecialConfig: ServicioEspecialConfig;
  personasExtrasConfig: PersonasExtrasConfig;
  numeroParadas: number;
  costoParadas: number; // Se asegura que el costo de paradas esté aquí
}

interface PetConfig {
  active: boolean;
  withCage: boolean | null;
  cost: number;
}

interface ServicioEspecialConfig {
  active: boolean;
  type: 'recoger' | 'comprar' | null;
  cost: number;
}

interface PersonasExtrasConfig {
  active: boolean;
  ninos: number;
  adultos: number;
  cost: number;
}
// Configuración de tarifas
const RATES = {
  baseFare: 50,
  waitingRate: 3, // MXN por minuto
  distanceRates: [
    { min: 0, max: 3.99, price: 50 },
    { min: 4, max: 4.99, price: 55 },
    { min: 5, max: 5.99, price: 60 },
    { min: 6, max: 6.99, price: 65 },
    { min: 7, max: 7.99, price: 70 },
    { min: 8, max: Infinity, basePrice: 80, extraRate: 16 }
  ],
  paradaRapida: 20, // Nuevo costo para parada rápida
  paradaServicio: 50 // Costo para servicio de parada
};

// Tipos de viaje
const TRIP_TYPES: TripType[] = [
  {
    id: 'normal',
    name: 'Viaje Altar Mayor',
    description: 'Tarifa por distancia recorrida'
  },
  {
    id: 'walmart',
    name: 'Al Mictlán Express',
    description: 'Ofrenda Central → Walmart Guzmán' /* Mantiene Walmart para funcionalidad */,
    distanceKm: 5.2,
    fixedPrice: 60
  },
  {
    id: 'tecnologico',
    name: 'Al Inframundo Tec',
    description: 'Ofrenda Central → Tec. Guzmán',
    distanceKm: 5.9,
    fixedPrice: 70
  },
  {
    id: 'cristoRey',
    name: 'Al Cerro de las Calaveras',
    description: 'Ofrenda Central → Cerro Cristo Rey',
    subTrips: [
      {
        id: 'cristoRey-cano',
        name: 'Camino al Caño',
        fixedPrice: 60
      },
      {
        id: 'cristoRey-mitad',
        name: 'Mitad del Sendero',
        fixedPrice: 70
      },
      {
        id: 'cristoRey-arriba',
        name: 'Cima de la Ofrenda',
        fixedPrice: 80
      }
    ]
  },
  {
    id: 'colmena',
    name: 'La Colmena del Inframundo',
    description: 'Precio base $120, +$10/km después de 4.9 km',
    fixedPrice: 120
  }
];

// Zonas de Soriana ($70 MXN) en orden alfabético
const SORIANA_ZONES = [
  'Américas',
  'Col. San José',
  'Emiliano Zapata',
  'Las Garzas',
  'Las Lomas',
  'Pueblos de Jalisco',
  'Valle de Zapotlan'
].sort();


// Función para calcular distancia entre dos puntos GPS (fórmula Haversine)
const calculateDistance = (pos1: Position, pos2: Position): number => {
  // Fórmula de Vincenty - Mucho más precisa para distancias cortas
  // Parámetros del elipsoide WGS84
  const a = 6378137; // Semi-eje mayor en metros
  const b = 6356752.314245; // Semi-eje menor en metros
  const f = 1 / 298.257223563; // Aplanamiento
  
  const lat1 = pos1.latitude * Math.PI / 180;
  const lat2 = pos2.latitude * Math.PI / 180;
  const deltaLon = (pos2.longitude - pos1.longitude) * Math.PI / 180;
  
  const L = deltaLon;
  const U1 = Math.atan((1 - f) * Math.tan(lat1));
  const U2 = Math.atan((1 - f) * Math.tan(lat2));
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);
  
  let lambda = L;
  let lambdaP;
  let iterLimit = 100;
  let cosSqAlpha, sinSigma, cos2SigmaM, cosSigma, sigma;
  
  do {
    const sinLambda = Math.sin(lambda);
    const cosLambda = Math.cos(lambda);
    sinSigma = Math.sqrt((cosU2 * sinLambda) * (cosU2 * sinLambda) +
      (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) * (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda));
    
    if (sinSigma === 0) return 0; // Puntos coincidentes
    
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha;
    
    if (isNaN(cos2SigmaM)) cos2SigmaM = 0; // Línea ecuatorial
    
    const C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
    lambdaP = lambda;
    lambda = L + (1 - C) * f * sinAlpha *
      (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
  } while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0);
  
  if (iterLimit === 0) {
    // Fallback a fórmula más simple si no converge
    const R = 6371000;
    const dLat = (pos2.latitude - pos1.latitude) * Math.PI / 180;
    const dLon = (pos2.longitude - pos1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(pos1.latitude * Math.PI / 180) * Math.cos(pos2.latitude * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  const uSq = cosSqAlpha * (a * a - b * b) / (b * b);
  const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma = B * sinSigma * (cos2SigmaM + B / 4 * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
    B / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));
  
  const distance = b * A * (sigma - deltaSigma);
  
  // Factor de corrección reducido ya que Vincenty es más preciso
  // Solo un pequeño ajuste para compensar el filtrado del GPS móvil
  const correctionFactor = 1.15; // Reducido del 40% al 15%
  
  return distance * correctionFactor;
};

// Componente principal de la aplicación
function App() {
  const [tripData, setTripData] = useState<TripData>({
    distance: 0,
    cost: RATES.baseFare,
    waitingTime: 0,
    isRunning: false,
    isPaused: false,
    rawDistance: 0
  });

  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'requesting' | 'available' | 'denied' | 'unavailable'>('requesting');
  const [selectedTripType, setSelectedTripType] = useState<TripType>(TRIP_TYPES[0]);
  const [selectedSubTrip, setSelectedSubTrip] = useState<SubTrip | null>(null);
  const [showTripTypeSelector, setShowTripTypeSelector] = useState(false);
  const [showSubTripSelector, setShowSubTripSelector] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [lastTripSummary, setLastTripSummary] = useState<TripSummary | null>(null);
  const [showRates, setShowRates] = useState(false);
  const [currentAddress, setCurrentAddress] = useState<string>(''); // No usada actualmente, pero se mantiene
  const [googleMapsReady, setGoogleMapsReady] = useState(false); // No usada actualmente, pero se mantiene
  const [totalWaitingTime, setTotalWaitingTime] = useState(0);
  const [showExtrasSelector, setShowExtrasSelector] = useState(false);
  const [serviciosExtrasActive, setServiciosExtrasActive] = useState(false); // No usada actualmente, pero se mantiene
  const [showPetSelector, setShowPetSelector] = useState(false);
  const [petConfig, setPetConfig] = useState<PetConfig>({
    active: false,
    withCage: null,
    cost: 0
  });
  const [showServicioEspecialSelector, setShowServicioEspecialSelector] = useState(false);
  const [servicioEspecialConfig, setServicioEspecialConfig] = useState<ServicioEspecialConfig>({
    active: false,
    type: 'recoger' as const,
    cost: 0
  });
  const [showFinalizarParada, setShowFinalizarParada] = useState(false); // No usada actualmente, pero se mantiene
  const [costoAcumuladoParadas, setCostoAcumuladoParadas] = useState(0);
  const [numeroParadas, setNumeroParadas] = useState(0);
  const [showPersonasExtrasSelector, setShowPersonasExtrasSelector] = useState(false);
  const [personasExtrasConfig, setPersonasExtrasConfig] = useState<PersonasExtrasConfig>({
    active: false,
    ninos: 0,
    adultos: 0,
    cost: 0
  });
  // Nuevo estado para el selector de tipo de parada
  const [showParadaSelector, setShowParadaSelector] = useState(false); 


  // Estado para el check de Soriana
  const [isSorianaActive, setIsSorianaActive] = useState(false);
  const [selectedSorianaZone, setSelectedSorianaZone] = useState<string | null>(null);

  // Estado para la simulación
  const [isSimulating, setIsSimulating] = useState(false);
  const simulationInterval = useRef<NodeJS.Timeout | null>(null);

  // Referencias para mantener estado en callbacks
  const isActiveRef = useRef(false);
  const lastPositionRef = useRef<Position | null>(null);
  const waitingStartTime = useRef<number | null>(null);
  const waitingInterval = useRef<NodeJS.Timeout | null>(null);

  // Función para calcular la tarifa
  const getBasePrice = (tripType: TripType): number => {
    if (selectedSubTrip && tripType.id === 'cristoRey') {
      return selectedSubTrip.fixedPrice;
    }
    return tripType.fixedPrice || RATES.baseFare;
  };

  // Función para manejar la adición de una parada (rápida o de servicio)
  const handleParadaAdd = (cost: number) => {
    setNumeroParadas(prev => prev + 1);
    // **CORRECCIÓN CLAVE:** Solo actualizar el costo acumulado, el useEffect se encargará de actualizar tripData.cost
    setCostoAcumuladoParadas(prev => prev + cost); 
    setShowParadaSelector(false); // Cerrar el selector

    // **IMPORTANTE:** Se eliminó la lógica de setTripData aquí para evitar problemas de asincronía.
    // El useEffect que depende de costoAcumuladoParadas se encargará de actualizar tripData.cost.
  };

  // Función para calcular la tarifa
  const calculateFare = useCallback((distanceKm: number, waitingMinutes: number, sorianaBonus: boolean = false, accumulatedStopsCost: number = costoAcumuladoParadas) => {
    // Calcular costo adicional de mascotas
    const petExtraFee = petConfig.active ? petConfig.cost : 0;

    // Calcular costo adicional de servicio especial
    const servicioEspecialFee = servicioEspecialConfig.active ? servicioEspecialConfig.cost : 0;

    // Calcular costo adicional de personas extras
    const personasExtrasFee = personasExtrasConfig.active ? personasExtrasConfig.cost : 0;
    
    // Si Soriana está activo Y se seleccionó una zona, el costo es fijo de $70 MXN
    if (sorianaBonus && selectedSorianaZone) {
      return accumulatedStopsCost + 70 + (waitingMinutes * RATES.waitingRate) + petExtraFee + servicioEspecialFee + personasExtrasFee;
    }

    // Lógica especial para Colmena
    if (selectedTripType.id === 'colmena') {
      let fare = 120;
      if (distanceKm > 4.9) {
        const kmExtra = distanceKm - 4.9;
        fare = 120 + (Math.ceil(kmExtra) * 10);
      }
      return accumulatedStopsCost + fare + (waitingMinutes * RATES.waitingRate) + petExtraFee + servicioEspecialFee + personasExtrasFee;
    }

    // Calcular extra de $5 MXN para viajes diferentes al normal después de 3.7 km
    // O si Soriana está activo sin zona seleccionada
    const tripTypeExtraFee = ((selectedTripType.id !== 'normal' || (sorianaBonus && !selectedSorianaZone)) && distanceKm >= 3.7) ? 5 : 0;

    // Determinar el precio base según el tipo de viaje
    let baseFareToUse = (selectedTripType.id === 'cristoRey' && selectedSubTrip)
      ? selectedSubTrip.fixedPrice
      : (selectedTripType.fixedPrice || RATES.baseFare);

    // Cálculo por distancia
    let fare = baseFareToUse;

    if (selectedTripType.id !== 'normal') {
      // Para viajes diferentes a "Viaje Normal": precio base + 10 MXN por km después de 5 km
      if (distanceKm > 5) {
        const extraKmAfter5 = distanceKm - 5;
        fare += extraKmAfter5 * 10;
      }
    } else {
      // Para "Viaje Normal": usar la tabla de tarifas por distancia
      for (const rate of RATES.distanceRates) {
        if (distanceKm >= rate.min && distanceKm <= rate.max) {
          if (rate.extraRate && distanceKm > 8) {
            const extraKm = distanceKm - 8;
            const adjustedBasePrice = (rate.basePrice! - RATES.baseFare) + baseFareToUse;
            fare = adjustedBasePrice + (extraKm * rate.extraRate);
          } else {
            const priceIncrease = rate.price! - RATES.baseFare;
            fare = baseFareToUse + priceIncrease;
          }
          break;
        }
      }
    }

    return accumulatedStopsCost + fare + (waitingMinutes * RATES.waitingRate) + petExtraFee + servicioEspecialFee + personasExtrasFee + tripTypeExtraFee;
  }, [selectedTripType, selectedSubTrip, petConfig, servicioEspecialConfig, personasExtrasConfig, costoAcumuladoParadas, selectedSorianaZone]);
  // NOTA: Se ha agregado 'costoAcumuladoParadas' a las dependencias.

  // Formatear tiempo
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Manejar nueva posición GPS
  const handlePositionUpdate = useCallback((position: Position) => {
    setCurrentPosition(position);
    setGpsStatus('available');

    // Verificamos la referencia 'en vivo' del estado activo
    if (isActiveRef.current && !tripData.isPaused) {
      if (lastPositionRef.current) {
        // La distancia se calcula en metros para mayor precisión.
        const newDistanceMeters = calculateDistance(lastPositionRef.current, position);
        
        // Umbral más alto para filtrar mejor el "ruido" GPS y evitar cálculos prematuros
        const THRESHOLD = 15; // Aumentado de 5 a 15 metros
        if (newDistanceMeters > THRESHOLD) {
          // Convertimos a km para sumar al total
          const newDistanceKm = newDistanceMeters / 1000;
          setTripData(prev => {
            const rawTotalDistance = prev.rawDistance + newDistanceKm;
            
            // Aplicar descuento de 0.125 km por cada kilómetro completado
            const completedKm = Math.floor(rawTotalDistance);
            const discount = completedKm * 0.125;
            const adjustedDistance = Math.max(0, rawTotalDistance - discount);
            
            const waitingMinutes = Math.floor(prev.waitingTime / 60);
            return {
              ...prev,
              rawDistance: rawTotalDistance,
              distance: adjustedDistance,
              cost: calculateFare(adjustedDistance, waitingMinutes, isSorianaActive)
            };
          });
          // SOLO actualizar la última posición cuando realmente se registra movimiento
          lastPositionRef.current = position;
        }
      } else {
        // Primera posición después de iniciar - establecer como punto de referencia
        lastPositionRef.current = position;
      }
    }
  }, [calculateFare, tripData.isPaused, isSorianaActive]);

  // Inicializar GPS
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const position: Position = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            timestamp: Date.now()
          };
          setCurrentPosition(position);
          lastPositionRef.current = position;
          setGpsStatus('available');
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            setGpsStatus('denied');
          } else {
            setGpsStatus('unavailable');
          }
        },
        { enableHighAccuracy: true }
      );
    } else {
      setGpsStatus('unavailable');
    }
  }, []);

  // Iniciar contador de tiempo de espera
  const startWaitingTimer = () => {
    waitingStartTime.current = Date.now();
    waitingInterval.current = setInterval(() => {
      if (waitingStartTime.current) {
        const elapsed = Math.floor((Date.now() - waitingStartTime.current) / 1000);
        const currentWaitingTime = totalWaitingTime + elapsed;
        setTripData(prev => ({
          ...prev,
          waitingTime: currentWaitingTime
        }));
      }
    }, 1000);
  };

  // Detener contador de tiempo de espera
  const stopWaitingTimer = () => {
    if (waitingInterval.current) {
      clearInterval(waitingInterval.current);
      waitingInterval.current = null;
    }
    
    // Acumular el tiempo de espera cuando se detiene el timer
    if (waitingStartTime.current) {
      const elapsed = Math.floor((Date.now() - waitingStartTime.current) / 1000);
      setTotalWaitingTime(prev => prev + elapsed);
    }
    
    waitingStartTime.current = null;
  };

  // Iniciar taxímetro
  const startTrip = () => {
    if (currentPosition) {
      isActiveRef.current = true;
      // NO establecer lastPositionRef aquí - se establecerá en la primera actualización
      lastPositionRef.current = null;
      
      // Resetear tiempo de espera acumulado
      setTotalWaitingTime(0);
      
      setTripData(prev => ({
        ...prev,
        distance: 0, // Asegurar que siempre inicie en 0
        rawDistance: 0, // También resetear distancia cruda
        waitingTime: 0,
        isRunning: true,
        isPaused: false
      }));

      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const position: Position = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            timestamp: Date.now()
          };
          handlePositionUpdate(position);
        },
        (error) => console.error('GPS Error:', error),
        {
          enableHighAccuracy: true,
          maximumAge: 500,
          timeout: 10000
        }
      );
      setWatchId(id);
    }
  };

  // Pausar/Reanudar taxímetro
  const togglePause = () => {
    setTripData(prev => {
      const newPaused = !prev.isPaused;
      
      if (newPaused) {
        // Pausar - iniciar contador de espera
        startWaitingTimer();
      } else {
        // Reanudar - detener contador de espera
        stopWaitingTimer();
      }
      
      return {
        ...prev,
        isPaused: newPaused
      };
    });
  };

  // Detener taxímetro
  const stopTrip = () => {
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }

    stopWaitingTimer();
    
    // Crear resumen del viaje (capturar estado de extras antes de resetear)
    const summary: TripSummary = {
      tripType: selectedTripType.name,
      distance: tripData.distance,
      waitingTime: tripData.waitingTime,
      cost: tripData.cost, // <--- ESTE VALOR YA INCLUYE EL costoAcumuladoParadas GRACIAS AL ULTIMO useEffect
      timestamp: new Date().toLocaleString(),
      isSorianaActive: isSorianaActive,
      petConfig: { ...petConfig },
      servicioEspecialConfig: { ...servicioEspecialConfig },
      personasExtrasConfig: { ...personasExtrasConfig },
      numeroParadas: numeroParadas,
      costoParadas: costoAcumuladoParadas // <--- GUARDAMOS EL COSTO DE PARADAS PARA EL DESGLOSE
    };
    
    setLastTripSummary(summary);
    setShowSummary(true);
    
    // Resetear datos del viaje
    isActiveRef.current = false;
    setTotalWaitingTime(0);
    
    // **CORRECCIÓN 1 Y 2: Reiniciar el tipo de viaje a "Viaje Altar Mayor" y el costo a la tarifa base.**
    const initialTripType = TRIP_TYPES[0];
    setSelectedTripType(initialTripType);
    setSelectedSubTrip(null);

    setTripData({
      distance: 0,
      rawDistance: 0,
      cost: RATES.baseFare, // Siempre a 50 MXN (tarifa base inicial)
      waitingTime: 0,
      isRunning: false,
      isPaused: false
    });

    // Resetear extras
    setServiciosExtrasActive(false);
    setPetConfig({
      active: false,
      withCage: null,
      cost: 0
    });
    setServicioEspecialConfig({
      active: false,
      type: null,
      cost: 0
    });
    setPersonasExtrasConfig({
      active: false,
      ninos: 0,
      adultos: 0,
      cost: 0
    });
    setIsSorianaActive(false);
    setSelectedSorianaZone(null);
    setCostoAcumuladoParadas(0);
    setNumeroParadas(0);

    lastPositionRef.current = currentPosition;
  };

  // Función para iniciar/detener simulación
  const toggleSimulation = () => {
    if (isSimulating) {
      if (simulationInterval.current) {
        clearInterval(simulationInterval.current);
        simulationInterval.current = null;
      }
      setIsSimulating(false);
    } else {
      setIsSimulating(true);
      simulationInterval.current = setInterval(() => {
        setTripData(prev => {
          const newDistance = prev.distance + 0.1;
          const waitingMinutes = Math.floor(prev.waitingTime / 60);
          return {
            ...prev,
            distance: newDistance,
            rawDistance: newDistance,
            cost: calculateFare(newDistance, waitingMinutes, isSorianaActive)
          };
        });
      }, 1000);
    }
  };

  // Limpiar simulación al desmontar
  useEffect(() => {
    return () => {
      if (simulationInterval.current) {
        clearInterval(simulationInterval.current);
      }
    };
  }, []);

  // Efecto para actualizar el costo cuando cambia el tipo de viaje (solo si no está corriendo)
  useEffect(() => {
    if (!tripData.isRunning) {
      // Recalcular el costo inicial usando la base + cualquier extra activo (como paradas anteriores)
      const waitingMinutes = Math.floor(tripData.waitingTime / 60);
      setTripData(prev => ({
        ...prev,
        cost: calculateFare(prev.distance, waitingMinutes, isSorianaActive)
      }));
    }
  }, [selectedTripType, selectedSubTrip, tripData.isRunning, calculateFare, isSorianaActive, tripData.distance, tripData.waitingTime]);

  // Efecto para actualizar el costo cuando cambia el tiempo de espera
  useEffect(() => {
    if (tripData.isRunning) {
      const waitingMinutes = Math.floor(tripData.waitingTime / 60);
      setTripData(prev => ({
        ...prev,
        cost: calculateFare(prev.distance, waitingMinutes, isSorianaActive)
      }));
    }
  }, [calculateFare, tripData.waitingTime, tripData.isRunning, isSorianaActive]);
  
  // Efecto CLAVE para actualizar el costo total cuando cambia CUALQUIER EXTRA (Incluyendo Paradas)
  // Este useEffect garantiza que tripData.cost siempre esté actualizado con costoAcumuladoParadas
  useEffect(() => {
    if (personasExtrasConfig.active || tripData.isRunning || petConfig.active || servicioEspecialConfig.active || isSorianaActive || costoAcumuladoParadas > 0) {
      const waitingMinutes = Math.floor(tripData.waitingTime / 60);
      setTripData(prev => ({
        ...prev,
        cost: calculateFare(prev.distance, waitingMinutes, isSorianaActive)
      }));
    }
  }, [calculateFare, personasExtrasConfig, petConfig, servicioEspecialConfig, isSorianaActive, costoAcumuladoParadas, tripData.isRunning, tripData.distance, tripData.waitingTime]);


  // **Funciones para manejar el incremento/decremento de pasajeros**
  const handlePassengerChange = (type: 'adultos' | 'ninos', delta: 1 | -1) => {
    setPersonasExtrasConfig(prev => {
      const newValue = Math.max(0, prev[type] + delta);
      const newAdultos = type === 'adultos' ? newValue : prev.adultos;
      const newNinos = type === 'ninos' ? newValue : prev.ninos;
      
      // Calcular el nuevo costo
      const newCost = (newAdultos * 20) + (newNinos * 10);
      
      return {
        active: (newAdultos > 0 || newNinos > 0),
        adultos: newAdultos,
        ninos: newNinos,
        cost: newCost
      };
    });
  };

  // Funciones de estado
  const getStatusColor = () => {
    if (tripData.isRunning) {
      return tripData.isPaused ? 'bg-orange-400' : 'bg-lime-400';
    }
    return gpsStatus === 'available' ? 'bg-purple-400' : 'bg-red-500';
  };

  const getStatusText = () => {
    if (tripData.isRunning) {
      return tripData.isPaused ? 'PAUSA - ESPERA DE ÁNIMAS' : 'RECORRIDO CON ÁNIMAS';
    }
    switch (gpsStatus) {
      case 'available': return 'GPS LISTO PARA EL VIAJE';
      case 'requesting': return 'BUSCANDO SENDEROS...';
      case 'denied': return 'ACCESO DENEGADO AL OTRO LADO';
      case 'unavailable': return 'BRÚJULA DESORIENTADA';
      default: return 'ESTADO DESCONOCIDO';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-red-900 p-4 font-sans text-white">
      <div className="max-w-md mx-auto">
        {/* Modal de resumen del viaje (Se mantiene igual) */}
        {showSummary && lastTripSummary && (
          <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-purple-900 to-red-900 border border-orange-400 rounded-xl p-6 max-w-sm w-full shadow-2xl">
              <div className="flex items-center justify-center mb-4">
                <Skull className="w-8 h-8 text-orange-400 mr-2" />
                <h2 className="text-2xl font-bold text-center text-white">
                  Registro del Viaje
                </h2>
              </div>
              
              <div className="space-y-4">
                <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg">
                  <div className="text-center">
                    <span className="text-orange-400 font-bold text-lg">{lastTripSummary.tripType}</span>
                  </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">Distancia recorrida:</span>
                    <span className="font-bold text-lg text-orange-400">{lastTripSummary.distance.toFixed(3)} km</span>
                  </div>

                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-300">Tiempo de espera:</span>
                    <span className="font-bold text-lg text-orange-400">{formatTime(lastTripSummary.waitingTime)}</span>
                  </div>

                  <div className="border-t border-gray-600 pt-3 mt-3">
                    <div className="space-y-2 mb-2">
                      {(() => {
                        const waitingMinutes = Math.floor(lastTripSummary.waitingTime / 60);
                        const waitingCost = waitingMinutes * RATES.waitingRate;
                        const petCost = lastTripSummary.petConfig.active ? lastTripSummary.petConfig.cost : 0;
                        const servicioEspecialCost = lastTripSummary.servicioEspecialConfig.active ? lastTripSummary.servicioEspecialConfig.cost : 0;
                        const personasExtrasCost = lastTripSummary.personasExtrasConfig.active ? lastTripSummary.personasExtrasConfig.cost : 0;

                        // Si es zona lejana de Soriana, el costo es fijo de $70
                        const hadSorianaZone = lastTripSummary.isSorianaActive &&
                          Math.abs(lastTripSummary.cost - (70 + lastTripSummary.costoParadas + waitingCost + petCost + servicioEspecialCost + personasExtrasCost)) < 1;

                        if (hadSorianaZone) {
                          // Costo Base Fijo de Soriana
                          return (
                            <>
                              {lastTripSummary.numeroParadas > 0 && (
                                <div className="flex justify-between items-center text-sm bg-purple-900/30 p-2 rounded">
                                  <span className="text-purple-300">Ofrendas en el camino ({lastTripSummary.numeroParadas} paradas):</span>
                                  <span className="text-white font-semibold">${lastTripSummary.costoParadas} MXN</span>
                                </div>
                              )}
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-300">🏪 Zona de los Muertos (costo fijo):</span>
                                <span className="text-white font-semibold">$70 MXN</span>
                              </div>
                              {waitingCost > 0 && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-gray-300">Espera de Ánimas:</span>
                                  <span className="text-white font-semibold">${waitingCost.toFixed(0)} MXN</span>
                                </div>
                              )}
                              {petCost > 0 && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-gray-300">🐾 Calavera Mascotil:</span>
                                  <span className="text-white font-semibold">${petCost} MXN</span>
                                </div>
                              )}
                              {servicioEspecialCost > 0 && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-gray-300">🌟 Servicio Especial:</span>
                                  <span className="text-white font-semibold">${servicioEspecialCost} MXN</span>
                                </div>
                              )}
                              {personasExtrasCost > 0 && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-gray-300">💀 Ánimas extras:</span>
                                  <span className="text-white font-semibold">${personasExtrasCost} MXN</span>
                                </div>
                              )}
                            </>
                          );
                        }
                        
                        // --- Lógica para Viaje Normal / Otras rutas ---

                        let baseFareToUse = (lastTripSummary.tripType.includes('Cerro de las Calaveras'))
                          ? (TRIP_TYPES.find(t => t.name === lastTripSummary.tripType)?.subTrips?.find(st => st.name === lastTripSummary.tripType)?.fixedPrice || RATES.baseFare)
                          : (TRIP_TYPES.find(t => t.name === lastTripSummary.tripType)?.fixedPrice || RATES.baseFare);
                        
                        let baseCost = baseFareToUse;
                        let tripTypeExtraFee = 0;

                        // Recalcular baseCost solo para desglose (ya que el total es lastTripSummary.cost)
                        if (lastTripSummary.tripType.includes('Colmena')) {
                            if (lastTripSummary.distance > 4.9) {
                                const kmExtra = lastTripSummary.distance - 4.9;
                                baseCost = 120 + (Math.ceil(kmExtra) * 10);
                            } else {
                                baseCost = 120;
                            }
                        }
                        else if (lastTripSummary.tripType !== 'Viaje Altar Mayor') {
                          if (lastTripSummary.distance > 5) {
                            const extraKmAfter5 = lastTripSummary.distance - 5;
                            baseCost += extraKmAfter5 * 10;
                          }
                        } else {
                          for (const rate of RATES.distanceRates) {
                            if (lastTripSummary.distance >= rate.min && lastTripSummary.distance <= rate.max) {
                              if (rate.extraRate && lastTripSummary.distance > 8) {
                                const extraKm = lastTripSummary.distance - 8;
                                const adjustedBasePrice = (rate.basePrice! - RATES.baseFare) + baseFareToUse;
                                baseCost = adjustedBasePrice + (extraKm * rate.extraRate);
                              } else {
                                const priceIncrease = rate.price! - RATES.baseFare;
                                baseCost = baseFareToUse + priceIncrease;
                              }
                              break;
                            }
                          }
                        }

                        if ((lastTripSummary.tripType !== 'Viaje Altar Mayor' || (lastTripSummary.isSorianaActive && !lastTripSummary.costoParadas)) && lastTripSummary.distance >= 3.7) {
                          tripTypeExtraFee = 5;
                        }
                        
                        // Restar el costo de paradas y extras para obtener la tarifa de la ruta limpia para el desglose
                        // Esto asegura que la tarifa de la ruta/sendero sea el valor correcto para ese concepto
                        const calculatedBaseFareForDisplay = lastTripSummary.cost - lastTripSummary.costoParadas - waitingCost - petCost - servicioEspecialCost - personasExtrasCost - tripTypeExtraFee;


                        return (
                          <>
                            {lastTripSummary.numeroParadas > 0 && (
                              <div className="flex justify-between items-center text-sm bg-purple-900/30 p-2 rounded">
                                <span className="text-purple-300">Ofrendas en el camino ({lastTripSummary.numeroParadas} paradas):</span>
                                <span className="text-white font-semibold">${lastTripSummary.costoParadas} MXN</span>
                              </div>
                            )}
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-300">Tarifa de ruta/sendero:</span>
                              <span className="text-white font-semibold">${calculatedBaseFareForDisplay.toFixed(2)} MXN</span>
                            </div>
                            {waitingCost > 0 && (
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-300">Espera de Ánimas:</span>
                                <span className="text-white font-semibold">${waitingCost.toFixed(0)} MXN</span>
                              </div>
                            )}
                            {petCost > 0 && (
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-300">🐾 Calavera Mascotil:</span>
                                <span className="text-white font-semibold">${petCost} MXN</span>
                              </div>
                            )}
                            {servicioEspecialCost > 0 && (
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-300">🌟 Servicio Especial:</span>
                                <span className="text-white font-semibold">${servicioEspecialCost} MXN</span>
                              </div>
                            )}
                            {personasExtrasCost > 0 && (
                                <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-300">💀 Ánimas extras:</span>
                                <span className="text-white font-semibold">${personasExtrasCost} MXN</span>
                              </div>
                            )}
                            {tripTypeExtraFee > 0 && (
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-300">Cargo por cruce (&gt;3.7 km):</span>
                                <span className="text-white font-semibold">${tripTypeExtraFee} MXN</span>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* Total */}
                      <div className="flex justify-between items-center mt-3 border-t border-orange-400/50 pt-3">
                        <span className="text-xl text-white">OFRENDA FINAL:</span>
                        <span className="text-3xl font-extrabold text-orange-400">${lastTripSummary.cost.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowSummary(false)}
                  className="w-full bg-orange-600 hover:bg-orange-500 text-gray-900 font-bold py-3 rounded-xl transition duration-200 shadow-lg"
                >
                  Regresar a los Vivos
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header (Se mantiene igual) */}
        <header className="mb-6">
          <h1 className="text-4xl font-extrabold text-white text-center mb-1 flex items-center justify-center">
            <Skull className="w-8 h-8 text-orange-400 mr-2" />
            Taxímetro de Ánimas
          </h1>
          <div className={`text-center py-1.5 px-3 rounded-full text-sm font-semibold text-gray-900 ${getStatusColor()}`}>
            <Flower className="w-4 h-4 inline-block mr-1 text-yellow-300" />
            {getStatusText()}
          </div>
        </header>

        {/* Display Principal (Se mantiene igual) */}
        <div className="bg-gray-800 p-6 rounded-2xl shadow-2xl mb-6 border border-gray-700">
          <div className="flex justify-between items-end mb-4">
            <div className="text-left">
              <span className="text-xs font-medium text-orange-400 uppercase">Distancia Recorrida</span>
              <p className="text-4xl font-bold text-white leading-none">
                {tripData.distance.toFixed(3)}
                <span className="text-lg font-normal text-gray-400 ml-1">km</span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-medium text-orange-400 uppercase">Tiempo de Espera</span>
              <p className="text-2xl font-bold text-white leading-none">
                {formatTime(tripData.waitingTime)}
              </p>
            </div>
          </div>

          <div className="text-center bg-black/50 p-3 rounded-xl border border-orange-400/50">
            <span className="text-xs font-medium text-orange-400 uppercase block">Ofrenda Total</span>
            <p className="text-6xl font-extrabold text-orange-400 mt-1">
              ${Math.ceil(tripData.cost).toFixed(0)}
              <span className="text-xl font-normal text-gray-400 ml-1">MXN</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              (Ofrenda Base: ${getBasePrice(selectedTripType).toFixed(2)})
            </p>
          </div>
        </div>

        {/* Controles de Viaje (Se mantiene igual) */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {tripData.isRunning ? (
            <>
              {/* Botón de Pausa/Reanudar */}
              <button
                onClick={togglePause}
                className={`flex flex-col items-center justify-center p-3 rounded-xl shadow-lg transition duration-200 ${tripData.isPaused ? 'bg-orange-600 hover:bg-orange-500' : 'bg-purple-600 hover:bg-purple-500'}`}
              >
                {tripData.isPaused ? (
                  <Play className="w-6 h-6 text-gray-900" />
                ) : (
                  <Pause className="w-6 h-6 text-white" />
                )}
                <span className={`text-xs mt-1 font-bold ${tripData.isPaused ? 'text-gray-900' : 'text-white'}`}>
                  {tripData.isPaused ? 'Receso de Ánimas' : 'Continuar Ruta'}
                </span>
              </button>
              
              {/* Botón de Finalizar Viaje */}
              <button
                onClick={stopTrip}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg transition duration-200"
              >
                <Square className="w-6 h-6" />
                <span className="text-xs mt-1 font-bold">Llegada al Destino</span>
              </button>
              
              {/* Botón de Simulación */}
              <button
                onClick={toggleSimulation}
                className={`flex flex-col items-center justify-center p-3 rounded-xl shadow-lg transition duration-200 ${isSimulating ? 'bg-lime-600 hover:bg-lime-500 text-gray-900' : 'bg-gray-600 hover:bg-gray-500 text-gray-300'}`}
              >
                <Zap className="w-6 h-6" />
                <span className="text-xs mt-1 font-bold">
                  {isSimulating ? 'SIMULANDO VIAJE' : 'Simular Senderos'}
                </span>
              </button>
            </>
          ) : (
            <>
              {/* Botón de Iniciar Viaje */}
              <button
                onClick={startTrip}
                className={`col-span-2 flex flex-col items-center justify-center p-3 rounded-xl shadow-lg transition duration-200 ${gpsStatus === 'available' ? 'bg-lime-600 hover:bg-lime-500 text-gray-900' : 'bg-gray-600 text-gray-300 cursor-not-allowed'}`}
                disabled={gpsStatus !== 'available'}
              >
                <Play className="w-8 h-8" />
                <span className="text-md mt-1 font-bold">INICIAR RUTA DE ÁNIMAS</span>
              </button>
              
              {/* Botón de Simulación (en modo inactivo) */}
              <button
                onClick={toggleSimulation}
                className={`flex flex-col items-center justify-center p-3 rounded-xl shadow-lg transition duration-200 ${isSimulating ? 'bg-lime-600 hover:bg-lime-500 text-gray-900' : 'bg-gray-600 hover:bg-gray-500 text-gray-300'}`}
              >
                <Zap className="w-6 h-6" />
                <span className="text-xs mt-1 font-bold">
                  {isSimulating ? 'SIMULANDO VIAJE' : 'Simular Senderos'}
                </span>
              </button>
            </>
          )}
        </div>

        {/* Paradas Intermedias (MODIFICADO) */}
        {tripData.isRunning && (
          <div className="bg-gray-800 p-4 rounded-xl shadow-lg mb-6 border border-gray-700 relative">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center">
              <CandlestickChart className="w-5 h-5 text-orange-400 mr-2" />
              Ofrendas en el Camino
            </h3>
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="text-gray-300">Número de Ofrendas:</span>
              <span className="font-bold text-white">{numeroParadas}</span>
            </div>
            <div className="flex justify-between items-center text-sm mb-4">
              <span className="text-gray-300">Costo Acumulado:</span>
              <span className="font-bold text-orange-400">${costoAcumuladoParadas.toFixed(0)} MXN</span>
            </div>
            
            <button
              onClick={() => setShowParadaSelector(true)}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-xl transition duration-200"
              disabled={showParadaSelector} // Deshabilitar si el selector está abierto
            >
              Añadir Ofrenda en Ruta
            </button>
            
            {/* Selector de Tipo de Parada (Modal/Panel) */}
            {showParadaSelector && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 rounded-xl z-10">
                <div className="bg-gray-700 p-4 rounded-lg w-full max-w-xs shadow-2xl border border-orange-400/50">
                  <h4 className="text-lg font-bold text-white mb-3 text-center">Tipo de Ofrenda:</h4>
                  <div className="space-y-3">
                    <button
                      onClick={() => handleParadaAdd(RATES.paradaRapida)}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-lime-600 hover:bg-lime-500 text-gray-900 font-bold transition duration-150"
                    >
                      <FastForward className="w-5 h-5" />
                      <span className="text-sm">Parada Rápida</span>
                      <span className="text-lg font-extrabold">+${RATES.paradaRapida}</span>
                    </button>
                    <button
                      onClick={() => handleParadaAdd(RATES.paradaServicio)}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition duration-150"
                    >
                      <ShoppingBag className="w-5 h-5" />
                      <span className="text-sm">Servicio de Parada</span>
                      <span className="text-lg font-extrabold">+${RATES.paradaServicio}</span>
                    </button>
                  </div>
                  <button
                    onClick={() => setShowParadaSelector(false)}
                    className="w-full mt-4 bg-gray-500 hover:bg-gray-600 text-white text-sm py-2 rounded-lg"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Sección de Tipo de Viaje (Se mantiene igual) */}
        <div className="bg-gray-800 p-4 rounded-xl shadow-lg mb-6 border border-gray-700">
          <div className="flex justify-between items-center cursor-pointer" onClick={() => setShowTripTypeSelector(prev => !prev)}>
            <div className="flex items-center">
              <Car className="w-5 h-5 text-purple-400 mr-2" />
              <span className="text-sm font-medium text-gray-300">Tipo de Ruta:</span>
            </div>
            <div className="flex items-center">
              <span className="text-md font-bold text-white mr-2">{selectedTripType.name}</span>
              {showTripTypeSelector ? <ChevronUp className="w-5 h-5 text-white" /> : <ChevronDown className="w-5 h-5 text-white" />}
            </div>
          </div>

          {showTripTypeSelector && (
            <div className="mt-3 border-t border-gray-700 pt-3 max-h-48 overflow-y-auto">
              <div className="space-y-2">
                {TRIP_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => {
                      setSelectedTripType(type);
                      setShowTripTypeSelector(false);
                      setSelectedSubTrip(null);
                      if (type.subTrips) {
                        setShowSubTripSelector(true);
                      }
                    }}
                    className={`w-full text-left p-2 rounded-lg transition duration-150 ${selectedTripType.id === type.id ? 'bg-purple-600 text-white font-semibold' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    disabled={tripData.isRunning}
                  >
                    <span className="block text-sm">{type.name}</span>
                    <span className="block text-xs opacity-70">{type.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selector de Subtipo de Viaje (Cristo Rey) */}
          {selectedTripType.subTrips && showSubTripSelector && (
            <div className="mt-3 border-t border-gray-700 pt-3">
              <p className="text-sm font-medium text-white mb-2">Selecciona Ruta Específica:</p>
              <div className="grid grid-cols-3 gap-2">
                {selectedTripType.subTrips.map(subTrip => (
                  <button
                    key={subTrip.id}
                    onClick={() => {
                      setSelectedSubTrip(subTrip);
                      setShowSubTripSelector(false);
                      setTripData(prev => ({ ...prev, cost: subTrip.fixedPrice || RATES.baseFare }));
                    }}
                    className={`p-2 rounded-lg text-center transition duration-150 ${selectedSubTrip?.id === subTrip.id ? 'bg-purple-600 text-white font-semibold' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    disabled={tripData.isRunning}
                  >
                    <span className="block text-xs">{subTrip.name}</span>
                    <span className="block text-sm font-bold">${subTrip.fixedPrice}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Checkbox de Soriana (Re-tematizado) (Se mantiene igual) */}
        <div className="bg-gray-800 p-4 rounded-xl shadow-lg mb-6 border border-gray-700">
          <div className="flex justify-between items-center cursor-pointer" onClick={() => {
            if (!tripData.isRunning) {
              setIsSorianaActive(prev => !prev);
              setSelectedSorianaZone(null);
            }
          }}>
            <div className="flex items-center">
              <Navigation className="w-5 h-5 text-red-400 mr-2" />
              <span className="text-sm font-medium text-gray-300">Ruta Especial (Zona de los Muertos $70)</span>
            </div>
            <input
              type="checkbox"
              checked={isSorianaActive}
              onChange={() => {} } // El cambio se maneja en el onClick del div
              className="form-checkbox h-5 w-5 text-red-600 bg-gray-700 border-gray-600 rounded"
              disabled={tripData.isRunning}
            />
          </div>

          {isSorianaActive && (
            <div className="mt-3 border-t border-gray-700 pt-3">
              <p className="text-sm font-medium text-white mb-2">Destino en la Zona de los Muertos:</p>
              <select
                value={selectedSorianaZone || ''}
                onChange={(e) => {
                  setSelectedSorianaZone(e.target.value === '' ? null : e.target.value);
                  // Opcionalmente recalcula la tarifa si el viaje no está corriendo
                  if (!tripData.isRunning) {
                    setTripData(prev => ({ ...prev, cost: 70 }));
                  }
                }}
                className="w-full bg-gray-700 text-white p-2 rounded-lg text-sm"
                disabled={tripData.isRunning}
              >
                <option value="">(Selecciona un panteón/barrio)</option>
                {SORIANA_ZONES.map(zone => (
                  <option key={zone} value={zone}>{zone}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        {/* Sección de Servicios Extras (Se mantiene igual) */}
        <div className="bg-gray-800 p-4 rounded-xl shadow-lg mb-6 border border-gray-700">
          <div className="flex justify-between items-center cursor-pointer" onClick={() => setShowExtrasSelector(prev => !prev)}>
            <div className="flex items-center">
              <DollarSign className="w-5 h-5 text-lime-400 mr-2" />
              <span className="text-sm font-medium text-gray-300">Ofrendas/Cargos Adicionales</span>
            </div>
            {showExtrasSelector ? <ChevronUp className="w-5 h-5 text-white" /> : <ChevronDown className="w-5 h-5 text-white" />}
          </div>

          {showExtrasSelector && (
            <div className="mt-3 border-t border-gray-700 pt-3 space-y-3">
              {/* Pet Selector */}
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <span className="text-sm text-white">🐾 Mascota Ánima (+${petConfig.withCage ? 20 : 30} MXN)</span>
                </div>
                <button
                  onClick={() => setShowPetSelector(prev => !prev)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${petConfig.active ? 'bg-lime-600 text-gray-900' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                  disabled={tripData.isRunning}
                >
                  {petConfig.active ? 'Activo' : 'Añadir'}
                </button>
              </div>

              {/* Pet Configuration Modal/Panel */}
              {showPetSelector && (
                <div className="bg-gray-700 p-3 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-300">¿Con su catrín/jaula especial?</span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setPetConfig({ active: true, withCage: true, cost: 20 });
                          setShowPetSelector(false);
                        }}
                        className={`px-3 py-1 text-xs rounded-full ${petConfig.withCage === true ? 'bg-purple-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                        disabled={tripData.isRunning}
                      >
                        Sí ($20)
                      </button>
                      <button
                        onClick={() => {
                          setPetConfig({ active: true, withCage: false, cost: 30 });
                          setShowPetSelector(false);
                        }}
                        className={`px-3 py-1 text-xs rounded-full ${petConfig.withCage === false ? 'bg-red-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                        disabled={tripData.isRunning}
                      >
                        No ($30)
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setPetConfig({ active: false, withCage: null, cost: 0 });
                      setShowPetSelector(false);
                    }}
                    className="w-full bg-red-700 text-white text-xs py-1 rounded"
                    disabled={tripData.isRunning}
                  >
                    Eliminar Ofrenda
                  </button>
                </div>
              )}

              {/* Servicio Especial Selector */}
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <span className="text-sm text-white">🌟 Encargo del Otro Lado (Recoger +$60 / Comprar +$70)</span>
                </div>
                <button
                  onClick={() => setShowServicioEspecialSelector(prev => !prev)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${servicioEspecialConfig.active ? 'bg-lime-600 text-gray-900' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                  disabled={tripData.isRunning}
                >
                  {servicioEspecialConfig.active ? 'Activo' : 'Añadir'}
                </button>
              </div>

              {/* Servicio Especial Configuration Modal/Panel */}
              {showServicioEspecialSelector && (
                <div className="bg-gray-700 p-3 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-300">Selecciona tipo de encargo:</span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setServicioEspecialConfig({ active: true, type: 'recoger', cost: 60 });
                          setShowServicioEspecialSelector(false);
                        }}
                        className={`px-3 py-1 text-xs rounded-full ${servicioEspecialConfig.type === 'recoger' ? 'bg-purple-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                        disabled={tripData.isRunning}
                      >
                        Recoger ($60)
                      </button>
                      <button
                        onClick={() => {
                          setServicioEspecialConfig({ active: true, type: 'comprar', cost: 70 });
                          setShowServicioEspecialSelector(false);
                        }}
                        className={`px-3 py-1 text-xs rounded-full ${servicioEspecialConfig.type === 'comprar' ? 'bg-purple-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                        disabled={tripData.isRunning}
                      >
                        Comprar ($70)
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setServicioEspecialConfig({ active: false, type: null, cost: 0 });
                      setShowServicioEspecialSelector(false);
                    }}
                    className="w-full bg-red-700 text-white text-xs py-1 rounded"
                    disabled={tripData.isRunning}
                  >
                    Eliminar Ofrenda
                  </button>
                </div>
              )}

              {/* Personas Extras Selector */}
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <span className="text-sm text-white">💀 Ánimas Extras (+ $20/Adulto, $10/Niño)</span>
                </div>
                <button
                  onClick={() => setShowPersonasExtrasSelector(prev => !prev)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${personasExtrasConfig.active ? 'bg-lime-600 text-gray-900' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                  disabled={tripData.isRunning}
                >
                  {personasExtrasConfig.active ? 'Activo' : 'Añadir'}
                </button>
              </div>

              {/* Personas Extras Configuration Panel (Modificado) */}
              {showPersonasExtrasSelector && (
                <div className="bg-gray-700 p-3 rounded-lg space-y-2">
                  
                  {/* Control de Adultos */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-300">Adultos Catrines ($20 c/u):</span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handlePassengerChange('adultos', -1)}
                        className={`p-1 rounded-full transition ${personasExtrasConfig.adultos > 0 && !tripData.isRunning ? 'bg-red-500 hover:bg-red-400' : 'bg-gray-600 cursor-not-allowed'}`}
                        disabled={personasExtrasConfig.adultos === 0 || tripData.isRunning}
                      >
                        <Minus className="w-4 h-4 text-white" />
                      </button>
                      <span className="w-6 text-center text-white font-bold text-sm">
                        {personasExtrasConfig.adultos}
                      </span>
                      <button
                        onClick={() => handlePassengerChange('adultos', 1)}
                        className={`p-1 rounded-full transition ${!tripData.isRunning ? 'bg-lime-500 hover:bg-lime-400' : 'bg-gray-600 cursor-not-allowed'}`}
                        disabled={tripData.isRunning}
                      >
                        <Plus className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Control de Niños */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-300">Calaveritas (Niños) ($10 c/u):</span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handlePassengerChange('ninos', -1)}
                        className={`p-1 rounded-full transition ${personasExtrasConfig.ninos > 0 && !tripData.isRunning ? 'bg-red-500 hover:bg-red-400' : 'bg-gray-600 cursor-not-allowed'}`}
                        disabled={personasExtrasConfig.ninos === 0 || tripData.isRunning}
                      >
                        <Minus className="w-4 h-4 text-white" />
                      </button>
                      <span className="w-6 text-center text-white font-bold text-sm">
                        {personasExtrasConfig.ninos}
                      </span>
                      <button
                        onClick={() => handlePassengerChange('ninos', 1)}
                        className={`p-1 rounded-full transition ${!tripData.isRunning ? 'bg-lime-500 hover:bg-lime-400' : 'bg-gray-600 cursor-not-allowed'}`}
                        disabled={tripData.isRunning}
                      >
                        <Plus className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>

                  <p className="text-right text-sm font-bold text-orange-400">Ofrenda Extra: ${personasExtrasConfig.cost} MXN</p>
                  <button
                    onClick={() => setShowPersonasExtrasSelector(false)}
                    className="w-full bg-purple-700 text-white text-xs py-1 rounded"
                  >
                    Guardar Ofrendas
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Sección de Tarifas (MODIFICADO para incluir la parada rápida) */}
        <div className="bg-gray-800 p-4 rounded-xl shadow-lg mb-6 border border-gray-700">
          <div className="flex justify-between items-center cursor-pointer" onClick={() => setShowRates(prev => !prev)}>
            <div className="flex items-center">
              <Info className="w-5 h-5 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-300">Guía de Ofrendas y Reglas del Mictlán</span>
            </div>
            {showRates ? <ChevronUp className="w-5 h-5 text-white" /> : <ChevronDown className="w-5 h-5 text-white" />}
          </div>

          {showRates && (
            <div className="mt-3 border-t border-gray-700 pt-3 space-y-3 text-sm text-gray-300">
              <p className="font-bold text-white">Ofrenda Base: ${RATES.baseFare} MXN</p>
              <p className="font-bold text-white">Costo por Espera de Ánimas: ${RATES.waitingRate} MXN/min</p>
              
              <h4 className="font-bold text-orange-400 mt-3">Ofrendas por Distancia (Ruta Altar Mayor):</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                {RATES.distanceRates.map((rate, index) => (
                  <li key={index}>
                    {rate.max === Infinity ? 
                      `> ${rate.min.toFixed(2)} km: Base $${rate.basePrice} + $${rate.extraRate}/km extra` : 
                      `${rate.min.toFixed(2)} - ${rate.max.toFixed(2)} km: $${rate.price} MXN`}
                  </li>
                ))}
              </ul>
              
              <h4 className="font-bold text-orange-400 mt-3">Reglas Adicionales del Inframundo:</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>**Descuento por Guía Espiritual (GPS):** Se aplica un descuento del **12.5%** a la distancia total recorrida (0.125 km por cada km completado) para compensar los desvíos del GPS.</li>
                <li>**Ofrendas Fijas:** Rutas específicas (e.g., Mictlán Express, Inframundo Tec) tienen ofrenda fija, pero el costo se usa como "ofrenda base" para extras.</li>
                <li>**Rutas Especiales/Zona de los Muertos (No Específica):** +$5 MXN si la distancia es $\ge 3.7$ km.</li>
                <li>**Calaveras Mascotiles (ACTUALIZADO):** Con catrín/jaula: **+$20**; Sin catrín/jaula: **+$30**.</li>
                <li>**Encargo del Otro Lado (ACTUALIZADO):** Recoger: **+$60**; Comprar: **+$70**.</li>
                <li>**Ánimas Extras (ACTUALIZADO):** Adultos Catrines **+$20**, Calaveritas (Niños) **+$10**.</li>
                <li>**Ofrenda en Camino - Rápida:** **+$20** MXN (solo bajan).</li>
                <li>**Ofrenda en Camino - Servicio:** **+$50** MXN (con espera/servicio).</li>
              </ul>
            </div>
          )}
        </div>
        
        {/* Debug GPS (Se mantiene igual) */}
        <footer className="mt-6 text-center text-xs text-gray-500">
          {currentPosition && (
            <p>
              GPS: Lat {currentPosition.latitude.toFixed(6)}, Lon {currentPosition.longitude.toFixed(6)}
            </p>
          )}
          {tripData.isRunning && (
            <p>
              Distancia Cruda: {tripData.rawDistance.toFixed(3)} km
            </p>
          )}
        
        </footer>
      </div>
    </div>
  );
}

export default App;