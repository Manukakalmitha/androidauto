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
  Heart
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

  // Refs for Maps Components
  const mapRef = useRef(null);
  const pickerRef = useRef(null);
  const markerRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const infoWindowRef = useRef(null);

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
            if (currentToken) {
              cb(currentToken);
            } else {
              console.warn("Spotify SDK: Token ref empty, cannot authorize.");
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

      // Fetch Queue for "Up Next"
      const fetchQueue = () => {
        spotifyApi.getUserQueue().then(data => {
          if (data?.queue?.[0]) {
            setUpNext(data.queue[0]);
          }
        }).catch(err => console.error("Error fetching queue:", err));
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
      mapEl.zoom = 13;
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
    } else {
      mapEl.center = place.location;
      mapEl.zoom = 17;
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

  const fetchRoutes = async (place, mode) => {
    if (!place || !place.location || !currentCoords) return;

    const { DirectionsService, DirectionsRenderer } = await google.maps.importLibrary("routes");

    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new DirectionsRenderer({
        map: mapRef.current.innerMap,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#3b82f6',
          strokeWeight: 8,
          strokeOpacity: 0.8
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
    if (infoWindowRef.current) infoWindowRef.current.close();
  };

  // startNavigation refactored above into startNavigation (setter) and fetchRoutes (logic)

  const endNavigation = () => {
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] });
    }
    setIsNavigating(false);
    setSelectedPlace(null);
    setNavigationSteps([]);
    if (markerRef.current) markerRef.current.position = null;
    if (pickerRef.current) pickerRef.current.value = null;
  };

  const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans select-none antialiased">

      {/* Component Library Loader */}
      <APILoader apiKey={GOOGLE_MAPS_API_KEY} solutionChannel="GMP_GE_mapsandplacesautocomplete_v2" />

      {/* Left Vertical Navigation Bar */}
      <nav className="w-24 bg-black border-r border-white/5 flex flex-col justify-between items-center py-10 z-[100] premium-shadow">
        <div className="flex flex-col gap-10 items-center">
          <button onClick={() => setShowAppDrawer(!showAppDrawer)} className={`w-16 h-16 flex items-center justify-center rounded-3xl transition-all ${showAppDrawer ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'bg-zinc-900 text-white/40 hover:text-white'}`}>
            <LayoutGrid size={32} />
          </button>

          <div className="flex flex-col gap-10 mt-6">
            {[
              { id: 'maps', icon: <Navigation size={34} />, color: 'text-blue-500' },
              { id: 'spotify', icon: <Music2 size={34} />, color: 'text-green-500' },
              { id: 'phone', icon: <Phone size={34} />, color: 'text-zinc-600' }
            ].map((app) => (
              <button
                key={app.id}
                onClick={() => { setActiveTab(app.id); setShowAppDrawer(false); }}
                className={`transition-all duration-300 ${activeTab === app.id ? app.color + ' scale-110 drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'text-zinc-800 hover:text-zinc-400'}`}
              >
                {app.icon}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-10 items-center">
          <button className="w-16 h-16 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-600 hover:text-white transition-all active:scale-90"><Mic size={32} /></button>
          <div className="flex flex-col items-center gap-1 opacity-40">
            <span className="text-[10px] font-black text-white tracking-widest">{formattedTime.split(' ')[0]}</span>
            <div className="w-4 h-0.5 bg-white/20 rounded-full" />
          </div>
        </div>
      </nav>

      {/* Main Split Content Area */}
      <main className="flex-1 flex overflow-hidden p-4 gap-4 bg-[#0a0a0a]">

        {/* Map Section (Left side - Floating Overlays) */}
        <div className="flex-[1.8] relative rounded-[3.5rem] overflow-hidden border border-white/5 bg-[#121212] premium-shadow">
          <gmp-map
            ref={mapRef}
            id="main-map"
            map-id="DEMO_MAP_ID"
            style={{ width: '100%', height: '100%', '--gmp-font-family': 'Inter, sans-serif' }}
          >
            <gmp-advanced-marker ref={markerRef}></gmp-advanced-marker>
          </gmp-map>

          {/* Floating Map Search/Directions Card */}
          <div className="absolute top-8 left-8 w-[440px] max-h-[calc(100%-64px)] pointer-events-none flex flex-col gap-4 z-50">
            <div className="bg-black/80 backdrop-blur-[40px] rounded-[3rem] border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.6)] pointer-events-auto overflow-hidden flex flex-col">
              <div className="p-8 border-b border-white/5 flex flex-col gap-6">
                <div className="flex items-center gap-4 bg-white/5 p-2 rounded-3xl border border-white/5 focus-within:border-blue-500/50 transition-all">
                  <Navigation size={24} className="text-blue-500 ml-4" />
                  <div className="flex-1">
                    <gmpx-place-picker
                      ref={pickerRef}
                      placeholder="Where to?"
                      for-map="main-map"
                      style={{
                        width: '100%',
                        '--gmpx-color-surface': 'transparent',
                        '--gmpx-color-on-surface': '#ffffff',
                        '--gmpx-border-radius': '0',
                        '--gmpx-font-family': 'Inter, sans-serif'
                      }}
                    ></gmpx-place-picker>
                  </div>
                </div>

                {!isNavigating && selectedPlace && (
                  <div className="flex gap-2">
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
                )}
              </div>

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
                        {navigationSteps.slice(0, 4).map((step, idx) => (
                          <div key={idx} className="flex gap-5 p-5 rounded-3xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-all">
                            <div className="text-blue-500 font-black text-xs pt-1 opacity-50">{idx + 1}</div>
                            <div className="flex flex-col gap-1.5 min-w-0">
                              <p className="text-base font-bold text-white/90 leading-snug" dangerouslySetInnerHTML={{ __html: step.instructions }} />
                              <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">{step.distance.text}</span>
                            </div>
                          </div>
                        ))}
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

              {selectedPlace && (
                <div className="p-8 bg-white/5 border-t border-white/5 backdrop-blur-3xl">
                  {!isNavigating ? (
                    <button
                      onClick={startNavigation}
                      className="w-full py-6 bg-blue-600 text-white font-black tracking-[0.2em] rounded-[2rem] flex items-center justify-center gap-4 active:scale-95 transition-all shadow-2xl shadow-blue-600/30 text-lg"
                    >
                      <Navigation size={26} fill="white" />
                      START TRIP
                    </button>
                  ) : (
                    <button
                      onClick={endNavigation}
                      className="w-full py-6 bg-red-600 text-white font-black tracking-[0.2em] rounded-[2rem] flex items-center justify-center gap-4 active:scale-95 transition-all shadow-2xl shadow-red-600/30 text-lg"
                    >
                      <X size={26} />
                      END TRIP
                    </button>
                  )
                  }
                </div>
              )}
            </div>
          </div>

          {/* Map Controls */}
          <div className="absolute right-10 bottom-10 flex flex-col gap-6 z-50">
            <div className="bg-black/90 backdrop-blur-2xl p-4 rounded-3xl border border-white/10 flex flex-col gap-8 items-center shadow-3xl">
              <button className="text-zinc-500 hover:text-white transition-all text-3xl font-light hover:scale-125" onClick={() => mapRef.current.innerMap.setZoom(mapRef.current.innerMap.getZoom() + 1)}>+</button>
              <div className="w-6 h-[1px] bg-white/10" />
              <button className="text-zinc-500 hover:text-white transition-all text-3xl font-light hover:scale-125" onClick={() => mapRef.current.innerMap.setZoom(mapRef.current.innerMap.getZoom() - 1)}>−</button>
            </div>
            <button
              onClick={() => { if (currentCoords) mapRef.current.center = { lat: currentCoords.latitude, lng: currentCoords.longitude }; }}
              className="w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-3xl active:scale-90 transition-all group"
            >
              <Navigation size={34} className="rotate-45 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>

        {/* Media Player Section (Right side - Split screen) */}
        <div className="flex-1 rounded-[3.5rem] overflow-hidden border border-white/5 bg-[#050505] relative flex flex-col premium-shadow transition-all duration-700">

          {/* Dynamic Full-Bleed Background Overlay */}
          {playbackState?.item && (
            <div
              className="absolute inset-0 opacity-40 transition-all duration-1000 pointer-events-none"
              style={{
                background: `radial-gradient(circle at 20% 20%, #${playbackState.item.id ? playbackState.item.id.slice(0, 6) : '1db954'}cc 0%, transparent 50%),
                             radial-gradient(circle at 80% 80%, #000 0%, #000 100%),
                             linear-gradient(180deg, rgba(0,0,0,0.8) 0%, #000 100%)`
              }}
            />
          )}

          {!spotifyToken ? (
            <div className="flex-1 flex flex-col items-center justify-center p-16 relative z-10 text-center">
              <div className="w-40 h-40 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_80px_rgba(34,197,94,0.4)] mb-12">
                <Music2 size={80} className="text-black" />
              </div>
              <h2 className="text-5xl font-black text-white mb-6 tracking-tighter">Stay Connected</h2>
              <button onClick={loginToSpotify} className="px-14 py-6 bg-white text-black font-black rounded-full text-xl tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-3xl">LINK SPOTIFY</button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col p-12 relative z-10">

              {/* Media Header */}
              <div className="flex justify-between items-center mb-12">
                <div className="flex items-center gap-4">
                  <SpotifyLogo size={40} />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-white tracking-[0.3em] uppercase leading-none">Spotify</span>
                    <span className="text-[9px] font-bold text-white/30 tracking-widest uppercase mt-1">Dash Player Alpha</span>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowSpotifyBrowser(!showSpotifyBrowser)}
                    className={`w-14 h-14 rounded-full border flex items-center justify-center transition-all ${showSpotifyBrowser ? 'bg-green-500 text-black border-none shadow-xl shadow-green-500/20' : 'bg-white/5 text-white border-white/5 hover:bg-white/10'}`}
                  >
                    <LayoutGrid size={24} />
                  </button>
                  <button onClick={logoutFromSpotify} className="w-14 h-14 rounded-full border border-white/5 bg-white/5 text-white/30 hover:text-white transition-all"><LogOut size={22} /></button>
                </div>
              </div>

              {/* Main Media Content */}
              <div className="flex-1 flex flex-col min-h-0">
                <AnimatePresence mode="wait">
                  {!showSpotifyBrowser ? (
                    <motion.div
                      key="player"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex-1 flex flex-col justify-center gap-12"
                    >
                      {playbackState?.item ? (
                        <div className="space-y-10">
                          <motion.div
                            layoutId="art"
                            className="w-full aspect-square rounded-[3.5rem] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.8)] border border-white/10 relative group mx-auto max-w-[420px]"
                          >
                            <img src={playbackState.item.album.images[0].url} alt="Cover" className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110" />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all pointer-events-none" />

                            {/* In-Art Visualizer */}
                            <div className="absolute bottom-10 left-10 z-20">
                              <Visualizer isPlaying={playbackState.is_playing} />
                            </div>
                          </motion.div>

                          <div className="space-y-4 px-6 relative">
                            <div className="flex justify-between items-start gap-8">
                              <div className="flex-1 min-w-0 text-left">
                                <h1 className="text-5xl font-black text-white tracking-tight leading-tight whitespace-nowrap overflow-hidden">
                                  {playbackState.item.name.length > 20 ? (
                                    <motion.div
                                      animate={{ x: [0, -100, 0] }}
                                      transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                                    >
                                      {playbackState.item.name}
                                    </motion.div>
                                  ) : playbackState.item.name}
                                </h1>
                                <p className="text-2xl font-bold text-white/40 tracking-tight mt-2">{playbackState.item.artists[0].name}</p>
                              </div>
                              <button
                                onClick={toggleLike}
                                className={`mt-2 transition-all duration-300 ${isLiked ? 'text-green-500 scale-125' : 'text-white/20 hover:text-white'}`}
                              >
                                <Heart size={44} fill={isLiked ? "currentColor" : "none"} strokeWidth={2.5} />
                              </button>
                            </div>
                          </div>

                          {/* Up Next Preview */}
                          {upNext && !showSpotifyBrowser && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="px-6 py-4 bg-white/5 rounded-3xl border border-white/5 flex items-center justify-between"
                            >
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Up Next</span>
                                <span className="text-sm font-bold text-white/60 truncate">{upNext.name} • {upNext.artists[0].name}</span>
                              </div>
                              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-white/10 opacity-60">
                                <img src={upNext.album.images[0].url} alt="" className="w-full h-full object-cover" />
                              </div>
                            </motion.div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-10">
                          <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center text-white/10 animate-pulse">
                            <Music2 size={64} />
                          </div>
                          <p className="text-xl font-black text-white/20 uppercase tracking-[0.4em]">{isPlayerReady ? 'Dashboard Active' : 'Waiting for Device'}</p>
                          {isPlayerReady && !playbackState?.item && (
                            <button
                              onClick={transferPlayback}
                              className="px-12 py-5 bg-green-500 text-black font-black rounded-full tracking-[0.2em] hover:scale-110 active:scale-95 transition-all"
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
                      initial={{ opacity: 0, x: 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -40 }}
                      className="flex-1 flex flex-col pt-4 overflow-hidden"
                    >
                      <div className="flex items-center gap-4 mb-8">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <h2 className="text-3xl font-black text-white tracking-tighter">Your Library</h2>
                      </div>

                      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4 pr-4">
                        {playlists?.length > 0 ? (
                          playlists.map((pl) => (
                            <button
                              key={pl.id}
                              onClick={() => { spotifyApi.play({ context_uri: pl.uri }); setShowSpotifyBrowser(false); }}
                              className="flex items-center gap-6 p-5 rounded-[2.5rem] bg-white/5 border border-white/5 hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98] transition-all group relative overflow-hidden"
                            >
                              <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-2xl border border-white/10 shrink-0">
                                <img src={pl.images?.[0]?.url} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                              </div>
                              <div className="text-left flex-1 min-w-0">
                                <p className="text-xl font-black text-white tracking-tight truncate mb-1">{pl.name}</p>
                                <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">{pl?.tracks?.total || 0} TRACKS</p>
                              </div>
                              <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-black opacity-0 group-hover:opacity-100 transition-all translate-x-10 group-hover:translate-x-0">
                                <Play size={28} fill="currentColor" className="ml-1" />
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center gap-6 opacity-20">
                            <Music2 size={64} />
                            <p className="font-black uppercase tracking-widest text-[10px]">Loading playlists...</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Persistent Playback Footer */}
              {playbackState?.item && (
                <div className="pt-10 space-y-10">
                  <div className="space-y-6">
                    <div
                      onClick={handleSeek}
                      className="h-3 bg-white/10 rounded-full overflow-hidden relative cursor-pointer group"
                    >
                      <motion.div
                        className="h-full bg-white shadow-[0_0_25px_rgba(255,255,255,0.4)] group-hover:bg-green-500 transition-colors"
                        animate={{ width: `${(playbackState.progress_ms / playbackState.item.duration_ms) * 100}%` }}
                      />
                      {/* Interaction Thumb */}
                      <motion.div
                        className="absolute h-6 w-6 bg-white rounded-full -top-1.5 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity"
                        animate={{ left: `calc(${(playbackState.progress_ms / playbackState.item.duration_ms) * 100}% - 12px)` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] font-black text-white/30 tracking-[0.2em]">
                      <span>{fmtMs(playbackState.progress_ms)}</span>
                      <span>{fmtMs(playbackState.item.duration_ms)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center px-6">
                    <button onClick={() => spotifyApi.setShuffle(!playbackState.shuffle_state)} className={`transition-all ${playbackState.shuffle_state ? 'text-green-500 scale-125' : 'text-white/20 hover:text-white'}`}><Shuffle size={28} /></button>
                    <div className="flex items-center gap-12">
                      <button onClick={() => spotifyApi.skipToPrevious()} className="text-white opacity-40 hover:opacity-100 hover:scale-125 active:scale-75 transition-all"><SkipBack size={48} fill="currentColor" /></button>
                      <button onClick={() => (playbackState.is_playing ? spotifyApi.pause() : spotifyApi.play())} className="w-28 h-28 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-[0_25px_60px_rgba(255,255,255,0.2)]">
                        {playbackState.is_playing ? <Pause size={56} fill="currentColor" /> : <Play size={56} fill="currentColor" className="ml-2" />}
                      </button>
                      <button onClick={() => spotifyApi.skipToNext()} className="text-white opacity-40 hover:opacity-100 hover:scale-125 active:scale-75 transition-all"><SkipForward size={48} fill="currentColor" /></button>
                    </div>
                    <button onClick={() => spotifyApi.setRepeat(playbackState.repeat_state === 'off' ? 'context' : 'off')} className={`transition-all ${playbackState.repeat_state !== 'off' ? 'text-green-500 scale-125' : 'text-white/20 hover:text-white'}`}><Repeat size={28} /></button>
                  </div>
                </div>
              )}

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

              <div className="grid grid-cols-4 md:grid-cols-5 gap-16 overflow-y-auto custom-scrollbar pr-10">
                {[
                  { name: 'Navigation', icon: <Navigation size={64} />, bg: 'bg-white', text: 'text-black' },
                  { name: 'Music', icon: <Music2 size={64} />, bg: 'bg-green-500', text: 'text-black' },
                  { name: 'Messaging', icon: <Mic size={64} />, bg: 'bg-blue-600', text: 'text-white' },
                  { name: 'Phone', icon: <Phone size={64} />, bg: 'bg-zinc-800', text: 'text-green-500' },
                  { name: 'Status', icon: <X size={64} />, bg: 'bg-zinc-900', text: 'text-white' },
                ].map((app, index) => (
                  <motion.button
                    key={index}
                    whileHover={{ y: -20, scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowAppDrawer(false)}
                    className="flex flex-col items-center gap-8 group"
                  >
                    <div className={`w-40 h-40 rounded-[3.5rem] ${app.bg} ${app.text} flex items-center justify-center shadow-3xl border border-white/5 transition-all duration-700 group-hover:shadow-white/5`}>
                      {app.icon}
                    </div>
                    <span className="text-sm font-black text-zinc-500 uppercase tracking-[0.4em] group-hover:text-white transition-colors">{app.name}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
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
