import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutGrid,
  Settings as SettingsIcon,
  Battery,
  Wifi,
  Navigation,
  Music2,
  Phone,
  Mic,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Signal,
  X,
  Volume2,
  Cloud,
  LogOut,
  MapPin,
  Compass,
  Car,
  Bike,
  BusFront,
  Footprints,
  History,
  Shuffle,
  Repeat,
  Heart,
  User,
  Settings,
  Home,
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SpotifyWebApi from 'spotify-web-api-js';
import { createClient } from '@supabase/supabase-js';

// Capacitor Plugins
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { Geolocation } from '@capacitor/geolocation';

// Google Maps Extended Components (React Wrappers)
import { APILoader } from '@googlemaps/extended-component-library/react';

const spotifyApi = new SpotifyWebApi();

// --- Configuration from Environment ---
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Helper Components ---
const MarqueeText = ({ text, className }) => {
  return (
    <div className={`overflow-hidden whitespace-nowrap relative ${className}`}>
      <motion.div
        animate={{ x: [0, -100, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="inline-block"
      >
        {text}
      </motion.div>
    </div>
  );
};

const Visualizer = ({ isPlaying }) => {
  return (
    <div className="flex items-end gap-1 h-8">
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          animate={isPlaying ? { height: [8, 24, 12, 32, 8] } : { height: 8 }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
          className="w-1.5 bg-green-500 rounded-full"
        />
      ))}
    </div>
  );
};

export default function App() {
  // --- Auth & Config State ---
  const [spotifyToken, setSpotifyToken] = useState(null);
  const tokenRef = useRef(null);

  // --- Real-time Hardware State ---
  const [time, setTime] = useState(new Date());
  const [batteryInfo, setBatteryInfo] = useState({ batteryLevel: 1.0, isCharging: false });
  const [networkStatus, setNetworkStatus] = useState({ connected: true, connectionType: 'wifi' });
  const [currentCoords, setCurrentCoords] = useState(null);

  // --- UI State ---
  const [activeTab, setActiveTab] = useState('maps');
  const [showAppDrawer, setShowAppDrawer] = useState(false);
  const [playbackState, setPlaybackState] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [travelMode, setTravelMode] = useState('DRIVING');
  const [routes, setRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [navigationSteps, setNavigationSteps] = useState([]);
  const [spotifyPlayer, setSpotifyPlayer] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [showSpotifyBrowser, setShowSpotifyBrowser] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [upNext, setUpNext] = useState(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  const [deviceProfile, setDeviceProfile] = useState(() => {
    const saved = localStorage.getItem('android-auto-profile');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return { name: 'Driver', home: null, work: null, isGoogleLinked: false };
  });

  useEffect(() => {
    localStorage.setItem('android-auto-profile', JSON.stringify(deviceProfile));
  }, [deviceProfile]);

  // Refs for Maps Components
  const mapRef = useRef(null);
  const pickerRef = useRef(null);
  const markerRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const infoWindowRef = useRef(null);
  const homePickerRef = useRef(null);
  const workPickerRef = useRef(null);

  // --- Initialization ---
  useEffect(() => {
    // 1. Clock
    const timer = setInterval(() => setTime(new Date()), 10000);

    // 2. Hardware Monitors
    const monitorHardware = async () => {
      try {
        const bInfo = await Device.getBatteryInfo();
        setBatteryInfo(bInfo);
        const nStatus = await Network.getStatus();
        setNetworkStatus(nStatus);
        const pos = await Geolocation.getCurrentPosition();
        setCurrentCoords(pos.coords);
      } catch (e) {
        console.error("Hardware monitor error:", e);
      }
    };
    monitorHardware();

    // 3. Supabase Auth Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Supabase Auth Event:", event);
      if (session?.provider_token) {
        setSpotifyToken(session.provider_token);
        tokenRef.current = session.provider_token;
        spotifyApi.setAccessToken(session.provider_token);
      } else if (event === 'SIGNED_OUT') {
        setSpotifyToken(null);
        tokenRef.current = null;
        setPlaybackState(null);
      }
    });

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.provider_token) {
        setSpotifyToken(session.provider_token);
        tokenRef.current = session.provider_token;
        spotifyApi.setAccessToken(session.provider_token);
      }
    });

    // 4. Handle Supabase Auth Errors from URL Parms
    const query = new URLSearchParams(window.location.search);
    const errorDesc = query.get('error_description');
    if (errorDesc) {
      alert(`Supabase Auth Error: ${errorDesc.replace(/\+/g, ' ')}`);
      // Clean up URL to prevent repeat alerts
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }

    return () => {
      clearInterval(timer);
      subscription.unsubscribe();
    };
  }, []);

  // --- Spotify Functions ---
  const loginToSpotify = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'spotify',
      options: {
        scopes: 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private user-library-read user-library-modify',
        redirectTo: window.location.origin
      }
    });
    if (error) console.error("Login error:", error);
  };

  const transferPlayback = async () => {
    if (deviceId) {
      spotifyApi.transferMyPlayback([deviceId], { play: true }).catch(err => {
        console.error("Transfer error:", err);
        alert("Failed to activate dashboard player. Make sure you have Spotify Premium.");
      });
    }
  };

  const toggleLike = async () => {
    if (!playbackState?.item) return;
    try {
      if (isLiked) {
        await spotifyApi.removeFromMySavedTracks([playbackState.item.id]);
      } else {
        await spotifyApi.addToMySavedTracks([playbackState.item.id]);
      }
      setIsLiked(!isLiked);
    } catch (e) {
      console.error("Error toggling like:", e);
      setIsLiked(!isLiked); // Optimistic UI toggle
    }
  };

  const handleSeek = (e) => {
    if (!playbackState?.item) return;
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const seekMs = Math.round(percent * playbackState.item.duration_ms);
    spotifyApi.seek(seekMs).catch(err => console.error("Seek error:", err));
  };

  const logoutFromSpotify = async () => {
    await supabase.auth.signOut();
  };

  // --- Spotify Unified State Normalization ---
  const normalizePlaybackState = (rawState) => {
    if (!rawState) return null;

    // Check if it's SDK state (contains track_window)
    if (rawState.track_window) {
      const track = rawState.track_window.current_track;
      return {
        item: track ? {
          id: track.id,
          name: track.name,
          duration_ms: rawState.duration,
          artists: track.artists.map(a => ({ name: a.name })),
          album: { images: track.album.images.map(img => ({ url: img.url })) },
          uri: track.uri
        } : null,
        progress_ms: rawState.position,
        is_playing: !rawState.paused,
        shuffle_state: rawState.shuffle,
        repeat_state: rawState.repeat_mode === 0 ? 'off' : (rawState.repeat_mode === 1 ? 'context' : 'track'),
        is_sdk: true
      };
    }

    // Otherwise treat as Web API state (contains item)
    return {
      item: rawState.item,
      progress_ms: rawState.progress_ms,
      is_playing: rawState.is_playing,
      shuffle_state: rawState.shuffle_state,
      repeat_state: rawState.repeat_state,
      is_sdk: false
    };
  };

  // --- Spotify Web Playback SDK Integration ---
  useEffect(() => {
    if (!spotifyToken) return;

    // Define the ready callback BEFORE loading the script
    window.onSpotifyWebPlaybackSDKReady = () => {
      console.log("Spotify SDK: Web Playback SDK Ready callback triggered");
      if (window.Spotify && !spotifyPlayer) {
        const player = new window.Spotify.Player({
          name: 'Android Auto Dashboard',
          getOAuthToken: cb => {
            const currentToken = tokenRef.current || spotifyToken;
            if (typeof currentToken === 'string' && currentToken.length > 0) {
              cb(currentToken);
            } else {
              console.warn("Spotify SDK: Invalid or empty token for authorization.");
            }
          },
          volume: 0.5
        });

        player.addListener('initial_state_error', ({ message }) => { console.error("Initial State Error:", message); });
        player.addListener('authentication_error', ({ message }) => { console.error("Auth Error:", message); });
        player.addListener('account_error', ({ message }) => { console.error("Account Error:", message); });
        player.addListener('playback_error', ({ message }) => { console.error("Playback Error:", message); });

        player.addListener('ready', ({ device_id }) => {
          console.log('Spotify SDK: Ready with Device ID', device_id);
          setDeviceId(device_id);
          setIsPlayerReady(true);
        });

        player.addListener('not_ready', ({ device_id }) => {
          console.log('Spotify SDK: Device ID has gone offline', device_id);
          setIsPlayerReady(false);
        });

        player.addListener('player_state_changed', state => {
          if (!state) return;
          setPlaybackState(normalizePlaybackState(state));
        });

        player.connect();
        setSpotifyPlayer(player);
      }
    };

    // Load script only if not present
    if (!document.getElementById('spotify-player-sdk')) {
      const script = document.createElement("script");
      script.id = 'spotify-player-sdk';
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      document.body.appendChild(script);
    } else if (window.Spotify && !spotifyPlayer) {
      // If script is already there but player not initialized, trigger callback manually
      window.onSpotifyWebPlaybackSDKReady();
    }

    return () => {
      // Persistent player strategy
    };
  }, [spotifyToken, spotifyPlayer]);

  useEffect(() => {
    if (spotifyToken) {
      const interval = setInterval(() => {
        spotifyApi.getMyCurrentPlaybackState().then(state => {
          if (state && state.item) {
            setPlaybackState(normalizePlaybackState(state));
          }
        }).catch(err => console.error("Spotify playback error:", err));
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [spotifyToken]);

  useEffect(() => {
    if (spotifyToken) {
      spotifyApi.getUserPlaylists().then(data => {
        setPlaylists(data.items);
      }).catch(err => console.error("Error fetching playlists:", err));

      // Fetch Queue for "Up Next" (Manual fetch because library method is missing)
      const fetchQueue = async () => {
        try {
          const response = await fetch('https://api.spotify.com/v1/me/player/queue', {
            headers: { 'Authorization': `Bearer ${tokenRef.current || spotifyToken}` }
          });
          if (response.ok) {
            const data = await response.json();
            if (data?.queue?.[0]) {
              setUpNext(data.queue[0]);
            }
          }
        } catch (err) {
          console.error("Error fetching queue manually:", err);
        }
      };
      fetchQueue();
      const qInterval = setInterval(fetchQueue, 15000);
      return () => clearInterval(qInterval);
    }
  }, [spotifyToken, playbackState?.item?.id]);

  // --- Google Maps Logic ---
  useEffect(() => {
    if (mapRef.current) {
      const mapEl = mapRef.current;
      const coords = currentCoords ? { lat: currentCoords.latitude, lng: currentCoords.longitude } : { lat: 40.749933, lng: -73.98633 };

      // Use direct property assignment to avoid React stringification issues
      mapEl.center = coords;
      mapEl.zoom = 15;
      mapEl.tilt = 45; // Driver perspective tilt
      mapEl.mapId = "DEMO_MAP_ID"; // Required for advanced markers/styling

      // Enforce clean minimal UI
      mapEl.innerMap?.setOptions({
        disableDefaultUI: true,
        isFractionalZoomEnabled: true,
      });
    }
  }, [currentCoords]);
  useEffect(() => {
    const picker = pickerRef.current;
    if (picker) {
      const listener = (event) => {
        handlePlaceChange(event);
      };
      picker.addEventListener('gmpx-placechange', listener);
      return () => { picker && picker.removeEventListener('gmpx-placechange', listener); };
    }
  }, [pickerRef.current]);

  const handlePlaceChange = (e) => {
    const picker = e.target;
    const place = picker.value;
    if (!place || !place.location) {
      setSelectedPlace(null);
      setRoutes([]);
      if (infoWindowRef.current) infoWindowRef.current.close();
      return;
    }

    setSelectedPlace(place);
    const mapEl = mapRef.current;
    if (!mapEl) return;

    if (place.viewport) {
      mapEl.innerMap.fitBounds(place.viewport);
      setTimeout(() => { mapEl.tilt = 45; }, 500); // Re-apply tilt after fitBounds
    } else {
      mapEl.center = place.location;
      mapEl.zoom = 17;
      mapEl.tilt = 45;
    }

    if (markerRef.current) {
      markerRef.current.position = place.location;
    }

    // Show InfoWindow
    if (window.google && !infoWindowRef.current) {
      infoWindowRef.current = new window.google.maps.InfoWindow();
    }
    if (infoWindowRef.current) {
      infoWindowRef.current.setContent(`
        <div style="padding: 8px; color: #000;">
          <strong style="font-size: 14px;">${place.displayName || place.name}</strong><br/>
          <span style="font-size: 12px; opacity: 0.8;">${place.formattedAddress}</span>
        </div>
      `);
      infoWindowRef.current.open(mapEl.innerMap, markerRef.current);
    }

    // Auto-fetch routes when place changes
    fetchRoutes(place, travelMode);
  };

  const routeToSavedLoc = (savedLoc) => {
    if (!savedLoc) return;
    const manualPlace = {
      location: { lat: savedLoc.lat, lng: savedLoc.lng },
      displayName: savedLoc.name,
      formattedAddress: savedLoc.address,
    };
    setSelectedPlace(manualPlace);
    if (mapRef.current) {
      mapRef.current.center = manualPlace.location;
      mapRef.current.zoom = 17;
      if (markerRef.current) markerRef.current.position = manualPlace.location;
      fetchRoutes(manualPlace, 'DRIVING');
    }
  };

  const fetchRoutes = async (place, mode) => {
    if (!place || !place.location || !currentCoords) return;

    const { DirectionsService, DirectionsRenderer } = await google.maps.importLibrary("routes");

    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new DirectionsRenderer({
        map: mapRef.current.innerMap,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#3b82f6',
          strokeWeight: 14,
          strokeOpacity: 0.9,
          zIndex: 50
        }
      });
    }

    const service = new DirectionsService();
    service.route({
      origin: { lat: currentCoords.latitude, lng: currentCoords.longitude },
      destination: place.location,
      travelMode: mode, // TravelMode strings are accepted directly
      provideRouteAlternatives: true
    }, (result, status) => {
      if (status === 'OK') {
        const routeList = result.routes;
        setRoutes(routeList);
        setSelectedRouteIndex(0);
        setNavigationSteps(routeList[0].legs[0].steps);
        directionsRendererRef.current.setDirections(result);
        directionsRendererRef.current.setRouteIndex(0);
      }
    });
  };

  const selectRoute = (index) => {
    setSelectedRouteIndex(index);
    if (routes[index]) {
      setNavigationSteps(routes[index].legs[0].steps);
    }
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setRouteIndex(index);
    }
  };

  const startNavigation = () => {
    setIsNavigating(true);
    setActiveStepIndex(0);
    if (infoWindowRef.current) infoWindowRef.current.close();

    // MD3 Automotive Navigation Camera behavior
    if (mapRef.current) {
      mapRef.current.tilt = 60;
      mapRef.current.heading = 0;
      mapRef.current.zoom = 19;
    }
  };

  // --- Voice Navigation ---
  useEffect(() => {
    if (isNavigating && navigationSteps.length > 0 && activeStepIndex < navigationSteps.length) {
      const step = navigationSteps[activeStepIndex];
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = step.instructions;
      const textToSpeak = tempDiv.textContent || tempDiv.innerText || "";

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || voices.find(v => v.lang.startsWith('en'));
      if (englishVoice) utterance.voice = englishVoice;

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }, [isNavigating, navigationSteps, activeStepIndex]);

  // startNavigation refactored above into startNavigation (setter) and fetchRoutes (logic)

  const endNavigation = () => {
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] });
    }
    window.speechSynthesis.cancel();
    setIsNavigating(false);
    setSelectedPlace(null);
    setNavigationSteps([]);
    setActiveStepIndex(0);
    if (markerRef.current) markerRef.current.position = null;
    if (pickerRef.current) pickerRef.current.value = null;
  };

  const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans select-none antialiased">

      {/* Component Library Loader (v2 uses solutionChannel for compatibility) */}
      <APILoader apiKey={GOOGLE_MAPS_API_KEY} solutionChannel="GMP_GE_mapsandplacesautocomplete_v2" />

      {/* Left Vertical Navigation Bar */}
      <nav className="w-[100px] bg-black flex flex-col justify-between items-center py-6 z-[100] border-r border-[#1e1e1e]">

        {/* Top: Status & Clock */}
        <div className="flex flex-col items-center gap-1 mb-4">
          <div className="flex items-center gap-1 opacity-90 text-white">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M21 3L3 21h18V3z" /></svg>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z" /></svg>
          </div>
          <span className="text-[18px] font-bold text-white tracking-wide">{time.getHours() % 12 || 12}:{time.getMinutes().toString().padStart(2, '0')}</span>
        </div>

        {/* Middle: Stacked App Icons */}
        <div className="flex flex-col items-center gap-6 my-auto">
          {[
            { id: 'maps', icon: <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Google_Maps_icon_%282020%29.svg/1024px-Google_Maps_icon_%282020%29.svg.png" className="w-[42px] h-[42px] object-contain drop-shadow-md" alt="Maps" /> },
            { id: 'spotify', icon: <div className="bg-[#1DB954] rounded-full w-[46px] h-[46px] shadow-md flex items-center justify-center"><Music2 size={24} className="text-black" /></div> },
            { id: 'phone', icon: <div className="bg-white rounded-full w-[46px] h-[46px] shadow-md flex items-center justify-center"><Phone size={24} className="text-blue-500 fill-current" /></div> },
          ].map((app) => (
            <button
              key={app.id}
              onClick={() => { setActiveTab(app.id); setShowAppDrawer(false); }}
              className={`transition-transform duration-300 relative rounded-full flex items-center justify-center active:scale-95 ${activeTab === app.id ? 'scale-110 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'opacity-80 hover:opacity-100'}`}
            >
              {app.icon}
            </button>
          ))}
        </div>

        {/* Bottom: Mic and App Grid */}
        <div className="flex flex-col gap-6 items-center mt-4 pt-4 border-t border-[#1e1e1e] w-[60%]">
          <button onClick={() => setShowSettings(!showSettings)} className="w-14 h-14 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors active:scale-95">
            <Mic size={28} />
          </button>
          <button onClick={() => setShowAppDrawer(!showAppDrawer)} className="w-14 h-14 flex items-center justify-center rounded-3xl text-white hover:bg-white/10 transition-colors active:scale-95">
            <LayoutGrid size={28} />
          </button>
        </div>
      </nav>

      {/* Main Split Content Area */}
      <main className="flex-1 flex overflow-hidden p-3 gap-3 bg-[#0a0a0a]">

        {/* Map Section (Dominant 70% Width) */}
        <div className="w-[70%] relative rounded-2xl overflow-hidden shadow-md bg-[#121212]">
          <gmp-map
            ref={mapRef}
            id="main-map"
            map-id="DEMO_MAP_ID"
            style={{ width: '100%', height: '100%', '--gmp-font-family': 'Inter, sans-serif' }}
          >
            <gmp-advanced-marker ref={markerRef}></gmp-advanced-marker>
          </gmp-map>

          {/* Floating Map Search/Directions Card */}
          <div className="absolute top-6 left-6 w-[360px] max-h-[calc(100%-48px)] pointer-events-none flex flex-col gap-3 z-50">
            <div className="bg-[#2a2d32]/95 backdrop-blur-3xl rounded-[28px] shadow-2xl pointer-events-auto overflow-hidden flex flex-col border border-white/10">

              <div className="p-4 flex flex-col">
                {/* Search Pill */}
                <div className="bg-[#3b3e44] h-14 rounded-full flex items-center px-4 mb-4 focus-within:ring-2 focus-within:ring-blue-500/50 transition-all shadow-inner">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Google_Maps_icon_%282020%29.svg/1024px-Google_Maps_icon_%282020%29.svg.png" className="w-6 h-6 mr-3 drop-shadow-sm" alt="Maps" />
                  <div className="flex-1 overflow-hidden">
                    <gmpx-place-picker
                      ref={pickerRef}
                      placeholder="Search"
                      for-map="main-map"
                      style={{
                        width: '100%',
                        '--gmpx-color-surface': 'transparent',
                        '--gmpx-color-on-surface': '#ffffff',
                        '--gmpx-border-radius': '0',
                        '--gmpx-font-family': 'Inter, sans-serif',
                        '--gmpx-font-size-base': '1.05rem',
                        '--gmpx-placeholder-color': '#a1a1aa'
                      }}
                    ></gmpx-place-picker>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center ml-2 text-white/80 shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                  </div>
                </div>

                {/* Suggestions: Home & Work */}
                {!isNavigating && !selectedPlace && (deviceProfile.home || deviceProfile.work) && (
                  <div className="flex flex-col gap-1 px-1">
                    {deviceProfile.home && (
                      <button onClick={() => routeToSavedLoc(deviceProfile.home)} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/10 transition-colors text-left active:bg-white/20">
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-white">
                          <Home size={22} strokeWidth={2} />
                        </div>
                        <div className="flex flex-col flex-1 pb-1">
                          <span className="text-white font-semibold text-lg leading-tight">Home</span>
                          <span className="text-[#81c995] font-medium text-[13px] mt-0.5 tracking-wide">12 min • 4.2 mi</span>
                        </div>
                      </button>
                    )}
                    {deviceProfile.work && (
                      <button onClick={() => routeToSavedLoc(deviceProfile.work)} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/10 transition-colors text-left active:bg-white/20">
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-white">
                          <Briefcase size={22} strokeWidth={2} />
                        </div>
                        <div className="flex flex-col flex-1 pb-1">
                          <span className="text-white font-semibold text-lg leading-tight">Work</span>
                          <span className="text-[#fde293] font-medium text-[13px] mt-0.5 tracking-wide">28 min • 8.3 mi</span>
                        </div>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!isNavigating && selectedPlace && (
                <div className="flex flex-col">
                  <div className="flex gap-2 px-6 pb-6 mt-2">
                    {[
                      { id: 'DRIVING', icon: <Car size={20} /> },
                      { id: 'BICYCLING', icon: <Bike size={20} /> },
                      { id: 'TRANSIT', icon: <BusFront size={20} /> },
                      { id: 'WALKING', icon: <Footprints size={20} /> }
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => { setTravelMode(mode.id); fetchRoutes(selectedPlace, mode.id); }}
                        className={`flex-1 py-4 rounded-2xl flex items-center justify-center transition-all ${travelMode === mode.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'bg-white/5 text-zinc-500 hover:bg-white/10'}`}
                      >
                        {mode.icon}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedPlace && (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 max-h-[450px]">
                  {isNavigating ? (
                    <div className="flex flex-col gap-8">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-500 shadow-inner">
                          <Navigation size={28} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black text-blue-500 uppercase tracking-[0.2em] leading-none mb-2">Engaged</p>
                          <p className="text-xl font-black text-white tracking-tight truncate">{selectedPlace.displayName || selectedPlace.name}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-4">
                        {navigationSteps.slice(activeStepIndex, activeStepIndex + 3).map((step, idx) => (
                          <div key={idx} className={`flex gap-5 p-5 rounded-3xl border transition-all ${idx === 0 ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.15)]' : 'bg-white/5 border-white/5 opacity-60'}`}>
                            <div className="text-blue-500 font-black text-xs pt-1 opacity-50">{activeStepIndex + idx + 1}</div>
                            <div className="flex flex-col gap-1.5 min-w-0">
                              <p className="text-base font-bold text-white/90 leading-snug" dangerouslySetInnerHTML={{ __html: step.instructions }} />
                              <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">{step.distance.text}</span>
                            </div>
                          </div>
                        ))}
                        {activeStepIndex < navigationSteps.length - 1 && (
                          <button
                            onClick={() => setActiveStepIndex(prev => prev + 1)}
                            className="mt-2 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-sm transition-colors text-center"
                          >
                            Simulate Next Turn
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {routes.map((route, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectRoute(idx)}
                          className={`p-6 rounded-3xl border text-left transition-all ${selectedRouteIndex === idx ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-2xl font-black text-white">{route.legs[0].duration.text}</span>
                            <span className="text-[11px] font-black text-green-500 uppercase tracking-widest">{route.legs[0].distance.text}</span>
                          </div>
                          <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.2em]">via {route.summary}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Map Controls */}
          <div className="absolute right-6 bottom-6 flex flex-col gap-4 z-50">
            <div className="bg-[#2a2d32]/95 backdrop-blur-3xl p-2 rounded-full border border-white/10 flex flex-col items-center shadow-xl">
              <button className="w-12 h-12 flex items-center justify-center text-zinc-400 hover:text-white transition-all text-2xl active:bg-white/10 rounded-full" onClick={() => mapRef.current.innerMap.setZoom(mapRef.current.innerMap.getZoom() + 1)}>+</button>
              <div className="w-8 h-[1px] bg-white/10 my-1" />
              <button className="w-12 h-12 flex items-center justify-center text-zinc-400 hover:text-white transition-all text-2xl active:bg-white/10 rounded-full" onClick={() => mapRef.current.innerMap.setZoom(mapRef.current.innerMap.getZoom() - 1)}>−</button>
            </div>
            <button
              onClick={() => { if (currentCoords) mapRef.current.center = { lat: currentCoords.latitude, lng: currentCoords.longitude }; }}
              className="w-16 h-16 bg-[#2a2d32]/95 backdrop-blur-3xl border border-white/10 text-white rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all group"
            >
              <Navigation size={24} strokeWidth={2.5} className="rotate-45" />
            </button>
          </div>

        </div>

        {/* Media Player Section (Secondary 30% Panel) */}
        <div className="w-[30%] min-w-[320px] rounded-2xl overflow-hidden bg-[#1e1e1e] relative flex flex-col shadow-md transition-all duration-700">

          {/* Dynamic Full-Bleed Background Overlay */}
          {playbackState?.item && (
            <div
              className="absolute inset-0 opacity-60 transition-all duration-1000 pointer-events-none"
              style={{
                background: `radial-gradient(circle at 0% 0%, #${playbackState.item.id ? playbackState.item.id.slice(0, 6) : '1db954'}88 0%, transparent 60%),
                               radial-gradient(circle at 100% 100%, #${playbackState.item.id ? playbackState.item.id.slice(1, 7) : '1ed760'}44 0%, transparent 60%),
                               linear-gradient(180deg, rgba(0,0,0,0.8) 0%, #050505 100%)`
              }}
            />
          )}

          {!spotifyToken ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 relative z-10 text-center">
              <div className="w-24 h-24 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg mb-8">
                <Music2 size={48} className="text-black" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-6">Media Access</h2>
              <button onClick={loginToSpotify} className="w-full h-16 bg-white text-black font-extrabold rounded-xl text-sm tracking-wide active:scale-95 transition-all">LINK SPOTIFY</button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col p-12 relative z-10">

              <div className="flex justify-between items-center mb-6 px-6 pt-6">
                <div className="flex items-center gap-3">
                  <SpotifyLogo size={24} />
                  <span className="text-sm font-bold text-white opacity-90">Spotify</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSpotifyBrowser(!showSpotifyBrowser)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${showSpotifyBrowser ? 'bg-green-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  >
                    <LayoutGrid size={20} />
                  </button>
                </div>
              </div>

              {/* Main Media Content */}
              <div className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e]">
                <AnimatePresence mode="wait">
                  {!showSpotifyBrowser ? (
                    <motion.div
                      key="player"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="flex-1 flex flex-col p-6"
                    >
                      {playbackState?.item ? (
                        <div className="flex-1 flex flex-col min-h-0">

                          {/* Giant Artwork Anchor */}
                          <div className="flex-1 min-h-0 min-w-0 w-full rounded-2xl overflow-hidden shadow-lg relative group mb-6">
                            <img src={playbackState.item.album.images[0].url} alt="Cover" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e1e] to-transparent opacity-80 pointer-events-none" />
                          </div>

                          {/* Track Info (High Contrast) */}
                          <div className="flex justify-between items-end gap-4 mb-8">
                            <div className="flex-1 min-w-0">
                              <h1 className="text-2xl font-bold text-white tracking-tight truncate">
                                {playbackState.item.name}
                              </h1>
                              <p className="text-base font-medium text-zinc-400 truncate mt-1">{playbackState.item.artists[0].name}</p>
                            </div>
                            <button
                              onClick={toggleLike}
                              className={`p-3 rounded-full transition-all active:scale-90 ${isLiked ? 'text-green-500 bg-green-500/10' : 'text-zinc-400 bg-white/5 hover:text-white'}`}
                            >
                              <Heart size={24} fill={isLiked ? "currentColor" : "none"} strokeWidth={2} />
                            </button>
                          </div>

                          {/* Thick Progress Bar */}
                          <div className="space-y-3 mb-8">
                            <div
                              onClick={handleSeek}
                              className="h-6 bg-black/40 rounded-full overflow-hidden relative cursor-pointer group"
                            >
                              <motion.div
                                className="h-full bg-white transition-colors"
                                animate={{ width: `${(playbackState.progress_ms / playbackState.item.duration_ms) * 100}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs font-bold text-zinc-500">
                              <span>{fmtMs(playbackState.progress_ms)}</span>
                              <span>{fmtMs(playbackState.item.duration_ms)}</span>
                            </div>
                          </div>

                          {/* Jumbo Controls */}
                          <div className="flex justify-between items-center px-4">
                            <button onClick={() => spotifyApi.skipToPrevious()} className="p-4 text-white opacity-80 hover:opacity-100 active:scale-95 transition-all bg-white/5 rounded-full"><SkipBack size={32} fill="currentColor" /></button>
                            <button onClick={() => (playbackState.is_playing ? spotifyApi.pause() : spotifyApi.play())} className="w-24 h-24 bg-green-500 text-black rounded-full flex items-center justify-center active:scale-95 transition-all shadow-lg">
                              {playbackState.is_playing ? <Pause size={40} fill="currentColor" /> : <Play size={40} fill="currentColor" className="ml-1" />}
                            </button>
                            <button onClick={() => spotifyApi.skipToNext()} className="p-4 text-white opacity-80 hover:opacity-100 active:scale-95 transition-all bg-white/5 rounded-full"><SkipForward size={32} fill="currentColor" /></button>
                          </div>

                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-6">
                          <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-600">
                            <Music2 size={32} />
                          </div>
                          <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">{isPlayerReady ? 'Dashboard Ready' : 'Connecting...'}</p>
                          {isPlayerReady && !playbackState?.item && (
                            <button
                              onClick={transferPlayback}
                              className="px-8 py-4 bg-green-500 text-black font-extrabold rounded-xl text-sm transition-all"
                            >
                              START PLAYER
                            </button>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="browser"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex-1 flex flex-col pt-2 pb-6 px-6 overflow-hidden min-h-0 bg-[#1e1e1e]"
                    >
                      <h2 className="text-xl font-bold text-white mb-6">Recent Library</h2>

                      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-2">
                        {playlists?.length > 0 ? (
                          playlists.map((pl) => (
                            <button
                              key={pl.id}
                              onClick={() => { spotifyApi.play({ context_uri: pl.uri }); setShowSpotifyBrowser(false); }}
                              className="flex items-center gap-4 p-4 min-h-[80px] rounded-xl bg-white/5 border border-transparent hover:bg-white/10 active:scale-[0.98] transition-all text-left"
                            >
                              <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-black/50">
                                <img src={pl.images?.[0]?.url} alt="" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-base font-bold text-white truncate mb-0.5">{pl.name}</p>
                                <p className="text-xs font-medium text-zinc-400">{pl?.tracks?.total || 0} tracks</p>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-40">
                            <Music2 size={40} />
                            <p className="text-sm font-bold">Loading playlists...</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>
          )}
        </div>
      </main>

      {/* App Drawer Overlay */}
      <AnimatePresence>
        {showAppDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[200] bg-black/95 backdrop-blur-[80px] flex flex-col"
          >
            <div className="p-20 flex flex-col h-full">
              <div className="flex justify-between items-center mb-24">
                <div className="space-y-2">
                  <h2 className="text-8xl font-black text-white tracking-tighter">Apps</h2>
                  <p className="text-xl font-bold text-white/20 uppercase tracking-[0.4em]">Android Auto Tablet v1.0</p>
                </div>
                <button
                  onClick={() => setShowAppDrawer(false)}
                  className="w-24 h-24 flex items-center justify-center bg-white text-black rounded-full hover:scale-110 active:scale-95 transition-all shadow-2xl"
                >
                  <X size={48} />
                </button>
              </div>

              <div className="grid grid-cols-4 md:grid-cols-5 gap-12 overflow-y-auto custom-scrollbar pr-10">
                {[
                  { name: 'Navigation', icon: <Navigation size={56} />, bg: 'bg-white', text: 'text-black' },
                  { name: 'Music', icon: <Music2 size={56} />, bg: 'bg-green-500', text: 'text-black' },
                  { name: 'Messaging', icon: <Mic size={56} />, bg: 'bg-blue-600', text: 'text-white' },
                  { name: 'Phone', icon: <Phone size={56} />, bg: 'bg-zinc-800', text: 'text-green-500' },
                  { name: 'Status', icon: <X size={56} />, bg: 'bg-zinc-900', text: 'text-white' },
                ].map((app, index) => (
                  <motion.button
                    key={index}
                    whileHover={{ y: -10, scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowAppDrawer(false)}
                    className="flex flex-col items-center gap-6 group"
                  >
                    <div className={`w-32 h-32 rounded-2xl ${app.bg} ${app.text} flex items-center justify-center shadow-lg border border-white/5 transition-all duration-500 group-hover:shadow-white/10`}>
                      {app.icon}
                    </div>
                    <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest group-hover:text-white transition-colors">{app.name}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DeviceSettings show={showSettings} onClose={() => setShowSettings(false)} profile={deviceProfile} setProfile={setDeviceProfile} />

    </div>
  );
}

// --- Device Settings Modal ---
function DeviceSettings({ show, onClose, profile, setProfile }) {
  const homeRef = useRef(null);
  const workRef = useRef(null);

  useEffect(() => {
    const handlePlace = (type, e) => {
      const place = e.target.value;
      if (place && place.location) {
        setProfile(prev => ({
          ...prev, [type]: {
            name: place.displayName || place.name,
            lat: place.location.lat(),
            lng: place.location.lng(),
            address: place.formattedAddress
          }
        }));
      }
    };

    const hr = homeRef.current;
    const wr = workRef.current;

    if (hr) hr.addEventListener('gmpx-placechange', (e) => handlePlace('home', e));
    if (wr) wr.addEventListener('gmpx-placechange', (e) => handlePlace('work', e));

    return () => {
      if (hr) hr.removeEventListener('gmpx-placechange', handlePlace);
      if (wr) wr.removeEventListener('gmpx-placechange', handlePlace);
    };
  }, [show, setProfile]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[150] bg-black/80 backdrop-blur-2xl flex p-10 justify-center items-center">
          <div className="bg-[#111] border border-white/10 rounded-[3rem] p-12 w-full max-w-2xl shadow-2xl relative">
            <button onClick={onClose} className="absolute top-8 right-8 w-12 h-12 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center transition-all"><X size={24} /></button>
            <h2 className="text-4xl font-black text-white mb-8 flex items-center gap-4"><User size={40} className="text-purple-500" /> Device Profile</h2>

            <div className="space-y-8">
              <div className="bg-white/5 p-6 rounded-3xl border border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Google Account</h3>
                  <p className="text-sm text-zinc-400 font-medium">{profile.isGoogleLinked ? 'Linked to your digital life' : 'Link for calendar and saved places'}</p>
                </div>
                <button
                  onClick={() => setProfile(p => ({ ...p, isGoogleLinked: !p.isGoogleLinked }))}
                  className={`px-6 py-3 rounded-full font-bold transition-all ${profile.isGoogleLinked ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
                >
                  {profile.isGoogleLinked ? 'UNLINK' : 'LINK ACCOUNT'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><MapPin size={20} className="text-blue-500" /> Home Address</h3>
                  {profile.home ? (
                    <div className="flex justify-between items-start">
                      <div className="text-sm text-zinc-300 font-medium pr-4">{profile.home.address}</div>
                      <button onClick={() => setProfile(p => ({ ...p, home: null }))} className="text-red-500 p-2 bg-red-500/10 rounded-full hover:bg-red-500/20 transition-all"><X size={16} /></button>
                    </div>
                  ) : (
                    <div className="bg-white/5 p-2 rounded-xl focus-within:border-blue-500 transition-all border border-transparent">
                      <gmpx-place-picker ref={homeRef} placeholder="Search home..." for-map="main-map" style={{ width: '100%', '--gmpx-color-surface': 'transparent', '--gmpx-color-on-surface': '#ffffff', '--gmpx-border-radius': '0' }}></gmpx-place-picker>
                    </div>
                  )}
                </div>

                <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><MapPin size={20} className="text-orange-500" /> Work Address</h3>
                  {profile.work ? (
                    <div className="flex justify-between items-start">
                      <div className="text-sm text-zinc-300 font-medium pr-4">{profile.work.address}</div>
                      <button onClick={() => setProfile(p => ({ ...p, work: null }))} className="text-red-500 p-2 bg-red-500/10 rounded-full hover:bg-red-500/20 transition-all"><X size={16} /></button>
                    </div>
                  ) : (
                    <div className="bg-white/5 p-2 rounded-xl focus-within:border-orange-500 transition-all border border-transparent">
                      <gmpx-place-picker ref={workRef} placeholder="Search work..." for-map="main-map" style={{ width: '100%', '--gmpx-color-surface': 'transparent', '--gmpx-color-on-surface': '#ffffff', '--gmpx-border-radius': '0' }}></gmpx-place-picker>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// --- Logos ---
const SpotifyLogo = ({ size = 24 }) => (
  <div style={{ width: size, height: size }} className="flex items-center justify-center overflow-hidden">
    <img
      src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/1024px-Spotify_logo_without_text.svg.png"
      width={size}
      height={size}
      alt="Spotify"
      className="object-contain"
    />
  </div>
);

const GoogleMapsLogo = ({ size = 24 }) => (
  <div style={{ width: size, height: size }} className="flex items-center justify-center overflow-hidden">
    <img
      src="https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Google_Maps_icon_%282020%29.svg/1024px-Google_Maps_icon_%282020%29.svg.png"
      width={size}
      height={size}
      alt="Google Maps"
      className="object-contain"
    />
  </div>
);

// --- Utils ---
const fmtMs = (ms) => {
  const min = Math.floor(ms / 60000);
  const sec = ((ms % 60000) / 1000).toFixed(0);
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
};
