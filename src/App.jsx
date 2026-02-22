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
  Briefcase,
  CornerDownRight,
  Leaf,
  ArrowUp,
  Split
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
  const [showDirectionsPanel, setShowDirectionsPanel] = useState(false);
  const [originPlace, setOriginPlace] = useState(null); // 'CURRENT_LOCATION' or place object
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
  const [currentSpeed, setCurrentSpeed] = useState(0);

  // --- Voice Assistant State ---
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceStatus, setVoiceStatus] = useState(''); // 'listening' | 'processing' | 'done'
  const recognitionRef = useRef(null);
  const compassHeadingRef = useRef(null); // Magnetometer-based heading

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
  const originPickerRef = useRef(null);
  const destinationPickerRef = useRef(null);
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

        // Use watchPosition for real-time speed and coordinates
        const watchId = await Geolocation.watchPosition({
          enableHighAccuracy: true,
          timeout: 10000
        }, (pos) => {
          if (pos) {
            setCurrentCoords(pos.coords);
            // speed is in m/s, convert to km/h
            const speedKmH = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
            setCurrentSpeed(speedKmH);
          }
        });

        return watchId;
      } catch (e) {
        console.error("Hardware monitor error:", e);
      }
    };
    let watchIdPromise = monitorHardware();

    // 2b. Magnetometer Compass (DeviceOrientationEvent — much more accurate than GPS heading)
    const handleOrientation = (event) => {
      let heading = null;
      if (event.webkitCompassHeading !== undefined) {
        // iOS: webkitCompassHeading gives true north directly
        heading = event.webkitCompassHeading;
      } else if (event.absolute && event.alpha !== null) {
        // Android absolute orientation: convert alpha to compass bearing
        heading = 360 - event.alpha;
      } else if (event.alpha !== null) {
        heading = 360 - event.alpha;
      }
      if (heading !== null) compassHeadingRef.current = heading;
    };

    if (typeof DeviceOrientationEvent !== 'undefined') {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS 13+ requires explicit permission
        DeviceOrientationEvent.requestPermission().then(perm => {
          if (perm === 'granted') window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        }).catch(() => { });
      } else {
        window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
    }

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

    // 2c. Real-time Network Listener
    const networkListener = Network.addListener('networkStatusChange', status => {
      setNetworkStatus(status);
    });

    return () => {
      clearInterval(timer);
      subscription.unsubscribe();
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
      networkListener.remove();
      watchIdPromise.then(id => {
        if (id) Geolocation.clearWatch({ id });
      });
    };
  }, []);

  // --- Dynamic Map Camera Follow ---
  useEffect(() => {
    if (isNavigating && currentCoords && mapRef.current) {
      const { latitude, longitude, heading: gpsHeading } = currentCoords;
      const center = { lat: latitude, lng: longitude };

      // Update map center to user's location
      mapRef.current.center = center;

      // Update marker position
      if (markerRef.current) {
        markerRef.current.position = center;
      }

      // Prefer magnetometer heading (more accurate) over GPS heading
      const heading = compassHeadingRef.current ?? gpsHeading;
      if (heading !== null && heading !== undefined) {
        mapRef.current.heading = heading;
      }

      // Standardize tilt/zoom for driving perspective
      mapRef.current.tilt = 65;
      if (mapRef.current.zoom < 17) mapRef.current.zoom = 18;
    }
  }, [isNavigating, currentCoords]);

  // --- Voice Assistant (Web Speech API) ---
  const toggleVoiceAssistant = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice assistant not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setVoiceStatus('');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceStatus('listening');
      setVoiceTranscript('');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      setVoiceTranscript(transcript);
      setVoiceStatus('processing');

      // Speak acknowledgement
      const speak = (text) => {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 1.1;
        const voices = window.speechSynthesis.getVoices();
        const femaleVoice = voices.find(v => v.lang.startsWith('en') && (v.name.toLowerCase().includes('samantha') || v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('google us english'))) || voices.find(v => v.lang.startsWith('en'));
        if (femaleVoice) utter.voice = femaleVoice;
        window.speechSynthesis.speak(utter);
      };

      // Intent parsing
      if (transcript.includes('navigate to') || transcript.includes('go to') || transcript.includes('take me to') || transcript.includes('directions to')) {
        const dest = transcript.replace(/navigate to|go to|take me to|directions to/gi, '').trim();
        speak(`Searching for ${dest}`);
        setVoiceTranscript(`🗺️ Navigating to: "${dest}"`);
        // Use Places API (async) to find and route
        try {
          if (window.google?.maps?.Geocoder) {
            const geocoder = new window.google.maps.Geocoder();
            // Use the new promise-based API
            geocoder.geocode({ address: dest }).then(({ results }) => {
              if (results && results[0]) {
                const loc = results[0].geometry.location;
                const place = {
                  location: { lat: loc.lat(), lng: loc.lng() },
                  displayName: results[0].formatted_address,
                  formattedAddress: results[0].formatted_address
                };
                setSelectedPlace(place);
                fetchRoutes(place, travelMode, originPlace);
                if (mapRef.current) mapRef.current.center = { lat: loc.lat(), lng: loc.lng() };
                setShowDirectionsPanel(true);
                speak(`Route found to ${results[0].formatted_address.split(',')[0]}`);
              } else {
                speak(`Sorry, I couldn't find ${dest}. Try a more specific address.`);
                setVoiceTranscript(`❌ Location not found: "${dest}"`);
              }
            }).catch(() => {
              speak(`Sorry, there was an error finding ${dest}.`);
              setVoiceTranscript(`❌ Search failed`);
            });
          } else {
            speak('Maps service is still loading. Please try again in a moment.');
          }
        } catch (e) {
          speak('There was an error. Please try again.');
        }
      } else if (transcript.includes('go home') || transcript.includes('navigate home') || transcript.includes('take me home')) {
        if (deviceProfile.home) { routeToSavedLoc(deviceProfile.home); speak('Navigating to your home.'); setVoiceTranscript('🏠 Navigating home'); }
        else { speak('No home address saved.'); setVoiceTranscript('❌ No home address saved'); }
      } else if (transcript.includes('work') || transcript.includes('go to work') || transcript.includes('take me to work')) {
        if (deviceProfile.work) { routeToSavedLoc(deviceProfile.work); speak('Navigating to your work.'); setVoiceTranscript('🏢 Navigating to work'); }
        else { speak('No work address saved.'); setVoiceTranscript('❌ No work address saved'); }
      } else if (transcript.includes('stop') || transcript.includes('end navigation') || transcript.includes('cancel')) {
        endNavigation(); speak('Navigation ended.'); setVoiceTranscript('🛑 Navigation stopped');
      } else if (transcript.includes('music') || transcript.includes('spotify') || transcript.includes('play')) {
        setActiveTab('spotify'); speak('Opening Spotify.'); setVoiceTranscript('🎵 Opening Spotify');
      } else if (transcript.includes('maps') || transcript.includes('map')) {
        setActiveTab('maps'); speak('Switching to Maps.'); setVoiceTranscript('🗺️ Switching to Maps');
      } else {
        speak(`I heard: ${transcript}. Try saying navigate to a location, go home, or play music.`);
        setVoiceTranscript(`❓ "${transcript}" — try: "navigate to [place]"`);
      }

      setTimeout(() => setVoiceStatus('done'), 3000);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      setVoiceStatus('');
      setVoiceTranscript(`❌ Error: ${event.error}`);
      setTimeout(() => setVoiceTranscript(''), 3000);
    };

    recognition.onend = () => {
      setIsListening(false);
      setTimeout(() => setVoiceStatus(''), 4000);
    };

    recognition.start();
  };

  // --- Spotify Functions ---
  const loginToSpotify = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'spotify',
      options: {
        scopes: 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private user-library-read user-library-modify streaming user-read-email user-read-private',
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
      // Longer delay ensures script's internal modules (DRM/EME, playback-sdk) are fully wired
      setTimeout(() => {
        console.log("Spotify SDK: Web Playback SDK Ready callback (hardened)");
        if (!window.Spotify || !window.Spotify.Player) return;

        const player = new window.Spotify.Player({
          name: 'Android Auto Dashboard',
          getOAuthToken: cb => {
            const currentToken = tokenRef.current || spotifyToken;
            if (currentToken) {
              cb(currentToken);
            } else {
              console.warn("Spotify SDK: Invalid or empty token for authorization.");
            }
          },
          volume: 0.5
        });

        player.addListener('initialization_error', ({ message }) => {
          console.error("Init Error:", message);
          if (message.includes("scopes")) {
            setVoiceTranscript("⚠️ Spotify permissions out of date. Please Sign Out and Sign In again.");
          }
        });
        player.addListener('authentication_error', ({ message }) => {
          console.error("Auth Error:", message);
          if (message.includes("scopes")) {
            setVoiceTranscript("⚠️ Permission error. Please Sign Out/In.");
          }
        });
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
      }, 1200); // Longer delay so DRM/EME init finishes first
    };

    // Inject guards BEFORE the SDK script runs
    if (!window.__spotifySDKGuarded) {
      window.__spotifySDKGuarded = true;
      // Guard 1: indexOf crash
      const _origIndexOf = String.prototype.indexOf;
      String.prototype.indexOf = function (...args) {
        if (this == null) return -1;
        return _origIndexOf.apply(this, args);
      };
      // Guard 2: JSON.parse crash on "Too many requests" or non-JSON errors
      const _origParse = JSON.parse;
      JSON.parse = function (text, reviver) {
        if (typeof text !== 'string') return _origParse.apply(JSON, arguments);
        try {
          return _origParse.apply(JSON, arguments);
        } catch (e) {
          if (text.includes('Too many requests') || text.includes('rate limit') || text.startsWith('Too')) {
            console.warn("Spotify: Safely caught non-JSON rate limit response.");
            return { error: 'rate_limited', message: text };
          }
          throw e; // Let other parse errors bubble
        }
      };
    }

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
      // Persistent player strategy — keep player alive across re-renders
    };
  }, [spotifyToken, spotifyPlayer]);

  useEffect(() => {
    if (spotifyToken) {
      const interval = setInterval(() => {
        spotifyApi.getMyCurrentPlaybackState().then(state => {
          if (state && state.item) {
            setPlaybackState(normalizePlaybackState(state));
          }
        }).catch(err => {
          if (err.status === 401) logoutFromSpotify();
          if (err.status !== 429) console.error("Spotify playback error:", err);
        });
      }, 6000); // Slower polling to avoid 429
      return () => clearInterval(interval);
    }
  }, [spotifyToken]);

  useEffect(() => {
    if (spotifyToken) {
      spotifyApi.getUserPlaylists().then(data => {
        if (data && data.items) setPlaylists(data.items);
      }).catch(err => {
        if (err.status !== 429) console.error("Error fetching playlists:", err);
      });

      // Fetch Queue for "Up Next"
      const fetchQueue = async () => {
        try {
          const response = await fetch('https://api.spotify.com/v1/me/player/queue', {
            headers: { 'Authorization': `Bearer ${tokenRef.current || spotifyToken}` }
          });
          if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            if (data?.queue?.length > 0) {
              setUpNext(data.queue);
            } else {
              setUpNext(null);
            }
          }
        } catch (err) {
          // Silently ignore queue fetch failures
        }
      };
      fetchQueue();
      const qInterval = setInterval(fetchQueue, 45000); // Much slower queue polling
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
      const listener = (event) => handlePlaceChange(event, 'destination');
      picker.addEventListener('gmpx-placechange', listener);
      return () => { picker && picker.removeEventListener('gmpx-placechange', listener); };
    }
  }, [pickerRef.current]);

  useEffect(() => {
    const op = originPickerRef.current;
    if (op) {
      const listener = (event) => {
        const place = event.target.value;
        if (place && place.location) {
          setOriginPlace(place);
          if (selectedPlace) fetchRoutes(selectedPlace, travelMode, place);
        }
      };
      op.addEventListener('gmpx-placechange', listener);
      return () => { op && op.removeEventListener('gmpx-placechange', listener); };
    }
  }, [originPickerRef.current, selectedPlace, travelMode]);

  useEffect(() => {
    const dp = destinationPickerRef.current;
    if (dp) {
      const listener = (event) => handlePlaceChange(event, 'destination');
      dp.addEventListener('gmpx-placechange', listener);
      return () => { dp && dp.removeEventListener('gmpx-placechange', listener); };
    }
  }, [destinationPickerRef.current]);

  const handlePlaceChange = (e, type = 'destination') => {
    const picker = e.target;
    const place = picker.value;
    if (!place || !place.location) {
      if (type === 'destination') {
        setSelectedPlace(null);
        setRoutes([]);
        if (infoWindowRef.current) infoWindowRef.current.close();
      } else {
        setOriginPlace(null);
      }
      return;
    }

    if (type === 'destination') {
      setSelectedPlace(place);
    } else {
      setOriginPlace(place);
    }

    const mapEl = mapRef.current;
    if (!mapEl) return;

    if (place.viewport) {
      mapEl.innerMap.fitBounds(place.viewport);
      setTimeout(() => { mapEl.tilt = 45; }, 500);
    } else {
      mapEl.center = place.location;
      mapEl.zoom = 17;
      mapEl.tilt = 45;
    }

    if (markerRef.current && type === 'destination') {
      markerRef.current.position = place.location;
    }

    // Show InfoWindow only for destination
    if (type === 'destination') {
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
    }

    // Auto-fetch routes
    if (type === 'destination') {
      fetchRoutes(place, travelMode, originPlace);
    } else if (selectedPlace) {
      fetchRoutes(selectedPlace, travelMode, place);
    }
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

  const swapLocations = () => {
    if (originPlace && originPlace !== 'CURRENT_LOCATION' && selectedPlace) {
      const tempOrigin = originPlace;
      setOriginPlace(selectedPlace);
      setSelectedPlace(tempOrigin);
      fetchRoutes(tempOrigin, travelMode, selectedPlace);
    }
  };

  const fetchRoutes = async (place, mode, customOrigin = originPlace) => {
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
    let routeOrigin = { lat: currentCoords.latitude, lng: currentCoords.longitude };
    if (customOrigin && customOrigin !== 'CURRENT_LOCATION' && customOrigin.location) {
      routeOrigin = customOrigin.location;
    }

    service.route({
      origin: routeOrigin,
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

      const speak = () => {
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.rate = 1.1; // Slightly faster for automotive clarity
        utterance.pitch = 1.05; // Slightly higher pitch for female-leaning tone

        const voices = window.speechSynthesis.getVoices();
        // Look for common female-sounding voices across platforms
        const femaleVoice = voices.find(v =>
          v.lang.startsWith('en') &&
          (v.name.toLowerCase().includes('female') ||
            v.name.toLowerCase().includes('samantha') ||
            v.name.toLowerCase().includes('victoria') ||
            v.name.toLowerCase().includes('hazel') ||
            v.name.toLowerCase().includes('google us english') || // Google's default is often female-voiced
            v.name.toLowerCase().includes('premium'))
        ) || voices.find(v => v.lang.startsWith('en'));

        if (femaleVoice) utterance.voice = femaleVoice;

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      };

      if (window.speechSynthesis.getVoices().length > 0) {
        speak();
      } else {
        window.speechSynthesis.onvoiceschanged = speak;
      }
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
      <APILoader
        apiKey={GOOGLE_MAPS_API_KEY}
        solutionChannel="GMP_GCC_placeautocomplete_v1"
        libraries={['places', 'marker']}
      />

      {/* Left Vertical Navigation Bar */}
      <nav className="w-[100px] bg-black flex flex-col justify-between items-center py-6 z-[100] border-r border-[#1e1e1e]">

        {/* Top: Status & Clock */}
        <div className="flex flex-col items-center gap-1 mb-4">
          <div className="flex items-center gap-1 opacity-90 text-white">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M21 3L3 21h18V3z" /></svg>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z" /></svg>
          </div>
          <span className="text-[18px] font-bold text-white tracking-wide">{time.getHours() % 12 || 12}:{time.getMinutes().toString().padStart(2, '0')}</span>
          {!networkStatus.connected && (
            <div className="flex items-center gap-1 mt-1 px-2 py-0.5 bg-red-500/20 border border-red-500/40 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-red-500 uppercase tracking-tighter">Offline</span>
            </div>
          )}
        </div>

        {/* Middle: Stacked App Icons */}
        <div className="flex flex-col items-center gap-6 my-auto">
          {[
            { id: 'maps', icon: <GoogleMapsLogo size={42} className="drop-shadow-md" /> },
            { id: 'spotify', icon: <SpotifyLogo size={46} /> },
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
          <button
            onClick={toggleVoiceAssistant}
            className={`w-14 h-14 flex items-center justify-center rounded-full transition-all active:scale-95 relative
              ${isListening ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'text-white hover:bg-white/10'}`}
          >
            <Mic size={28} />
            {isListening && (
              <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-75"></span>
            )}
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

          {/* Active Navigation: Maneuver Bar (Official Horizontal Style) */}
          {isNavigating && navigationSteps.length > 0 && (
            <div className="absolute top-0 left-0 right-0 z-[100] px-6 py-6 flex justify-center pointer-events-none animate-in slide-in-from-top duration-700">
              <div className="flex flex-col items-start gap-2 max-w-[800px] w-full pointer-events-auto">
                {/* Primary Maneuver Bar */}
                <div className="bg-[#00703b] rounded-[28px] shadow-2xl flex items-center px-8 py-5 gap-8 w-full border border-white/5">
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0">
                    <ArrowUp size={44} strokeWidth={3} />
                  </div>
                  <div className="flex flex-col justify-center min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-[32px] font-black text-white leading-tight">towards</span>
                      <span className="text-[32px] font-bold text-white leading-tight truncate" dangerouslySetInnerHTML={{ __html: navigationSteps[activeStepIndex]?.instructions }} />
                    </div>
                    <span className="text-[24px] font-medium text-white/70 mt-0.5">{navigationSteps[activeStepIndex]?.distance.text}</span>
                  </div>
                </div>

                {/* "Then" Mini Card (Badge Style) */}
                {navigationSteps[activeStepIndex + 1] && (
                  <div className="bg-[#004d2c]/90 backdrop-blur-md rounded-2xl px-6 py-3 flex items-center gap-4 text-white shadow-xl border border-white/5 translate-x-2">
                    <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">Then</span>
                    <CornerDownRight size={20} className="text-white/80" />
                    <span className="text-lg font-bold truncate max-w-[300px]" dangerouslySetInnerHTML={{ __html: navigationSteps[activeStepIndex + 1]?.instructions }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Speedometer (Bottom Left Circular Gauge - Official Style) */}
          {isNavigating && (
            <div className="absolute bottom-10 left-10 z-[110] pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="bg-white rounded-full w-24 h-24 shadow-[0_12px_48px_-12px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center border-4 border-zinc-100 ring-4 ring-black/5">
                <span className="text-4xl font-black text-black leading-none">{currentSpeed}</span>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">km/h</span>
              </div>
            </div>
          )}

          {/* Active Navigation: Feature-Rich ETA Pill (Bottom Centered White Pill) */}
          {isNavigating && routes[selectedRouteIndex] && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-auto animate-in slide-in-from-bottom duration-700">
              <div className="bg-white rounded-full shadow-[0_24px_64px_-16px_rgba(0,0,0,0.5)] flex items-center p-2.5 min-w-[500px] gap-2 ring-1 ring-black/5">
                <button onClick={endNavigation} className="w-14 h-14 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-800 transition-all active:scale-90 shadow-sm">
                  <X size={28} strokeWidth={2.5} />
                </button>
                <div className="flex-1 flex items-center justify-center gap-8 py-2 px-8">
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-[28px] font-black text-[#1a7344] leading-none">{routes[selectedRouteIndex].legs[0].duration.text}</span>
                      <Leaf size={20} fill="#1a7344" className="text-[#1a7344]" />
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-zinc-500">
                      <span className="text-xs font-bold uppercase tracking-widest">{routes[selectedRouteIndex].legs[0].distance.text}</span>
                      <div className="w-1 h-1 rounded-full bg-zinc-300" />
                      <span className="text-xs font-bold uppercase tracking-widest">
                        {(() => {
                          const now = new Date();
                          const durationSec = routes[selectedRouteIndex].legs[0].duration.value;
                          now.setSeconds(now.getSeconds() + durationSec);
                          return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pr-2">
                  <button className="w-14 h-14 rounded-full bg-zinc-50 hover:bg-zinc-100 flex items-center justify-center text-zinc-600 transition-all active:scale-95 border border-zinc-100">
                    <Split size={24} />
                  </button>
                  <button onClick={() => setActiveStepIndex(p => Math.min(p + 1, navigationSteps.length - 1))} className="w-14 h-14 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 transition-all active:scale-95 italic font-black text-xs shadow-sm">SIM</button>
                </div>
              </div>
            </div>
          )}

          {/* Floating Map Search/Directions Card - Google Maps Style (White) */}
          <div className={`absolute top-6 left-6 w-[380px] max-h-[calc(100%-48px)] flex flex-col gap-3 transition-all duration-500 ${isNavigating ? 'opacity-0 pointer-events-none -translate-x-10' : 'z-50 pointer-events-none opacity-100'}`}>
            <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.22)] pointer-events-auto overflow-hidden flex flex-col">

              <div className="px-4 pt-4 pb-2 flex flex-col">
                {showDirectionsPanel ? (
                  <div className="flex flex-col animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Travel Modes - Google style pills */}
                    <div className="flex items-center gap-1.5 pb-4 border-b border-gray-100 mb-4">
                      {[
                        { id: 'DRIVING', icon: <Car size={18} />, label: 'Drive' },
                        { id: 'BICYCLING', icon: <Bike size={18} />, label: 'Cycle' },
                        { id: 'TRANSIT', icon: <BusFront size={18} />, label: 'Transit' },
                        { id: 'WALKING', icon: <Footprints size={18} />, label: 'Walk' }
                      ].map(mode => (
                        <button
                          key={mode.id}
                          onClick={() => { setTravelMode(mode.id); if (selectedPlace) fetchRoutes(selectedPlace, mode.id, originPlace); }}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold transition-all shrink-0 ${travelMode === mode.id
                            ? 'bg-[#e8f0fe] text-[#1967d2]'
                            : 'text-gray-500 hover:bg-gray-100'
                            }`}
                        >
                          {mode.icon}
                        </button>
                      ))}
                      <button className="ml-auto w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-full transition-colors" onClick={() => setShowDirectionsPanel(false)}><X size={18} /></button>
                    </div>

                    {/* Inputs Group - Google Maps Style */}
                    <div className="flex items-stretch gap-3 mb-1">
                      {/* Connection Line */}
                      <div className="flex flex-col items-center justify-between py-4 w-5 shrink-0 ml-1">
                        <div className="w-3 h-3 rounded-full border-2 border-gray-400"></div>
                        <div className="flex-1 border-l border-dashed border-gray-300 my-1"></div>
                        <MapPin size={16} className="text-[#ea4335] fill-[#ea4335]" />
                      </div>

                      <div className="flex-1 flex flex-col gap-2">
                        {/* Origin Input */}
                        <div className={`h-[50px] rounded-xl flex items-center gap-2 px-3 bg-gray-50 border ${!originPlace ? 'border-[#1a73e8]' : 'border-transparent'}`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="#9aa0a6" strokeWidth="2" /><path d="m21 21-4.35-4.35" stroke="#9aa0a6" strokeWidth="2" strokeLinecap="round" /></svg>
                          <div className="flex-1 overflow-hidden">
                            <gmpx-place-picker
                              ref={originPickerRef}
                              placeholder={originPlace === 'CURRENT_LOCATION' ? 'Your location' : 'Enter starting point'}
                              for-map="main-map"
                              style={{
                                width: '100%',
                                '--gmpx-color-surface': 'transparent',
                                '--gmpx-color-on-surface': '#202124',
                                '--gmpx-border-radius': '0',
                                '--gmpx-font-family': 'Google Sans, Inter, sans-serif',
                                '--gmpx-font-size-base': '0.95rem',
                                '--gmpx-placeholder-color': '#9aa0a6'
                              }}
                            ></gmpx-place-picker>
                          </div>
                        </div>
                        {/* Destination Input */}
                        <div className="h-[50px] rounded-xl flex items-center gap-2 px-3 bg-gray-50 border border-transparent">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="#9aa0a6" strokeWidth="2" /><path d="m21 21-4.35-4.35" stroke="#9aa0a6" strokeWidth="2" strokeLinecap="round" /></svg>
                          <div className="flex-1 overflow-hidden">
                            <gmpx-place-picker
                              ref={destinationPickerRef}
                              placeholder="Choose destination"
                              for-map="main-map"
                              style={{
                                width: '100%',
                                '--gmpx-color-surface': 'transparent',
                                '--gmpx-color-on-surface': '#202124',
                                '--gmpx-border-radius': '0',
                                '--gmpx-font-family': 'Google Sans, Inter, sans-serif',
                                '--gmpx-font-size-base': '0.95rem',
                                '--gmpx-placeholder-color': '#9aa0a6'
                              }}
                            ></gmpx-place-picker>
                          </div>
                        </div>
                      </div>

                      {/* Swap Button */}
                      <div className="flex items-center justify-center">
                        <button onClick={swapLocations} className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 border border-gray-200 transition-all active:scale-90">
                          <Split size={18} className="rotate-90" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Search Pill - Google Maps Style */}
                    <div className="h-14 rounded-xl flex items-center px-3 gap-3 bg-white border border-gray-200 shadow-sm mb-3 focus-within:shadow-md focus-within:border-[#1a73e8] transition-all">
                      <GoogleMapsLogo size={22} className="shrink-0" />
                      <div className="flex-1 overflow-hidden">
                        <gmpx-place-picker
                          ref={pickerRef}
                          placeholder="Search here"
                          for-map="main-map"
                          style={{
                            width: '100%',
                            '--gmpx-color-surface': 'transparent',
                            '--gmpx-color-on-surface': '#202124',
                            '--gmpx-border-radius': '0',
                            '--gmpx-font-family': 'Google Sans, Inter, sans-serif',
                            '--gmpx-font-size-base': '1rem',
                            '--gmpx-placeholder-color': '#9aa0a6'
                          }}
                        ></gmpx-place-picker>
                      </div>
                      <button onClick={() => setShowDirectionsPanel(true)} className="w-9 h-9 rounded-full bg-[#1a73e8] flex items-center justify-center text-white shrink-0 shadow hover:bg-[#1557b0] active:scale-95 transition-all">
                        <Navigation size={16} fill="white" className="-rotate-45" />
                      </button>
                    </div>
                  </>
                )}

                {/* Your Location quick pick */}
                {showDirectionsPanel && !originPlace && (
                  <div className="px-4 pb-3 pt-1 border-t border-gray-100">
                    <button onClick={() => { setOriginPlace('CURRENT_LOCATION'); if (selectedPlace) fetchRoutes(selectedPlace, travelMode, 'CURRENT_LOCATION'); }} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left w-full group">
                      <div className="w-10 h-10 rounded-full bg-[#e8f0fe] flex items-center justify-center shrink-0 text-[#1a73e8]">
                        <Navigation size={18} fill="#1a73e8" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[#202124] font-semibold text-sm">Your location</span>
                        <span className="text-[#80868b] text-xs">Use your current GPS position</span>
                      </div>
                    </button>
                  </div>
                )}

                {!showDirectionsPanel && !isNavigating && !selectedPlace && (deviceProfile.home || deviceProfile.work) && (
                  <div className="flex flex-col border-t border-gray-100 pt-1">
                    {deviceProfile.home && (
                      <button onClick={() => routeToSavedLoc(deviceProfile.home)} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                        <div className="w-10 h-10 rounded-full bg-[#fce8e6] flex items-center justify-center shrink-0">
                          <Home size={18} className="text-[#ea4335]" />
                        </div>
                        <div className="flex flex-col flex-1">
                          <span className="text-[#202124] font-semibold text-sm">Home</span>
                          <span className="text-[#80868b] text-xs">12 min · 4.2 mi</span>
                        </div>
                      </button>
                    )}
                    {deviceProfile.work && (
                      <button onClick={() => routeToSavedLoc(deviceProfile.work)} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                        <div className="w-10 h-10 rounded-full bg-[#e8f0fe] flex items-center justify-center shrink-0">
                          <Briefcase size={18} className="text-[#1a73e8]" />
                        </div>
                        <div className="flex flex-col flex-1">
                          <span className="text-[#202124] font-semibold text-sm">Work</span>
                          <span className="text-[#80868b] text-xs">28 min · 8.3 mi</span>
                        </div>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {selectedPlace && !isNavigating && (
                <div className="flex flex-col border-t border-gray-100 rounded-b-2xl overflow-hidden">
                  {/* Summary Block */}
                  {routes[selectedRouteIndex] && (
                    <div className="px-4 pt-4 pb-2">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-[28px] font-black text-[#1a73e8] leading-tight">{routes[selectedRouteIndex].legs[0].duration.text}</span>
                        <span className="text-sm font-bold text-gray-500">({routes[selectedRouteIndex].legs[0].distance.text})</span>
                      </div>
                      <p className="text-xs text-gray-400 mb-3">Fastest route · {(() => { const now = new Date(); now.setSeconds(now.getSeconds() + routes[selectedRouteIndex].legs[0].duration.value); return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); })()}</p>

                      {/* Start Button - Full width teal, prominent */}
                      <button
                        onClick={startNavigation}
                        className="w-full h-13 bg-[#1a73e8] hover:bg-[#1557b0] text-white py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-base shadow active:scale-95 transition-all mb-3"
                      >
                        <Navigation size={18} fill="white" className="-rotate-45" />
                        Start
                      </button>
                    </div>
                  )}

                  {/* Route List - Android Auto style horizontal cards */}
                  {routes.length > 1 && (
                    <div className="overflow-x-auto flex gap-2 px-4 pb-4" style={{ scrollbarWidth: 'none' }}>
                      {routes.map((route, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectRoute(idx)}
                          className={`flex-shrink-0 px-4 py-3 rounded-xl border-2 transition-all flex flex-col gap-0.5 min-w-[160px] text-left ${selectedRouteIndex === idx ? 'border-[#1a73e8] bg-[#e8f0fe]' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
                        >
                          <span className={`text-lg font-black leading-tight ${selectedRouteIndex === idx ? 'text-[#1a73e8]' : 'text-[#202124]'}`}>
                            {route.legs[0].duration.text}
                          </span>
                          <span className={`text-xs font-semibold truncate ${selectedRouteIndex === idx ? 'text-[#1557b0]' : 'text-gray-500'}`}>
                            via {route.summary}
                          </span>
                          <span className={`text-[11px] mt-0.5 ${selectedRouteIndex === idx ? 'text-[#1a73e8]/70' : 'text-gray-400'}`}>
                            {route.legs[0].distance.text}
                          </span>
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

        {/* Media Player Section (Secondary 30% Panel) - Full-bleed album art */}
        <div className="w-[30%] min-w-[320px] rounded-2xl overflow-hidden relative flex flex-col shadow-2xl transition-all duration-700 bg-black">

          {/* Full-bleed album art as background */}
          {playbackState?.item?.album?.images?.[0]?.url && (
            <>
              <img
                key={playbackState.item.album.images[0].url}
                src={playbackState.item.album.images[0].url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover transition-all duration-700"
                style={{ filter: 'brightness(0.35) saturate(1.1)' }}
              />
            </>
          )}

          {/* If no art or no token — dark fallback */}
          {!playbackState?.item && (
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1c1e] to-[#0a0a0a]" />
          )}

          {!spotifyToken ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 relative z-10 text-center">
              <img src="/spotify-logo.png" alt="Spotify" className="w-20 h-20 rounded-2xl shadow-lg mb-8 object-contain" />
              <h2 className="text-2xl font-bold text-white mb-2">Connect Spotify</h2>
              <p className="text-sm text-white/50 mb-8">Link your account to play music while you drive</p>
              <button onClick={loginToSpotify} className="w-full h-14 bg-[#1DB954] text-black font-extrabold rounded-full text-sm tracking-wide active:scale-95 transition-all flex items-center justify-center gap-3">
                <img src="/spotify-logo.png" alt="" className="w-6 h-6 object-contain" />
                LINK SPOTIFY
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col relative z-10 min-h-0">

              {/* Top Bar */}
              <div className="flex justify-between items-center px-5 pt-5 pb-3">
                <div className="flex items-center gap-2.5">
                  <img src="/spotify-logo.png" alt="Spotify" className="w-7 h-7 object-contain rounded-md" />
                  <span className="text-sm font-bold text-white/90 tracking-wide">Spotify</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSpotifyBrowser(!showSpotifyBrowser)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${showSpotifyBrowser ? 'bg-[#1DB954] text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  >
                    <LayoutGrid size={17} />
                  </button>
                </div>
              </div>

              {/* Main Media Content */}
              <div className="flex-1 flex flex-col min-h-0">
                <AnimatePresence mode="wait">
                  {!showSpotifyBrowser ? (
                    <motion.div
                      key="player"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex-1 flex flex-col px-5 pb-5 gap-4 min-h-0"
                    >
                      {playbackState?.item ? (
                        <div className="flex-1 flex flex-col min-h-0 gap-3">

                          {/* Small floating album art thumbnail (not full bleed duplicate) */}
                          <div className="flex-1 min-h-0 flex items-center justify-center">
                            <div className="w-48 h-48 rounded-2xl overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
                              <img src={playbackState.item.album.images[0].url} alt="Cover" className="w-full h-full object-cover" />
                            </div>
                          </div>

                          {/* Track Info */}
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <h1 className="text-xl font-bold text-white tracking-tight truncate leading-tight">
                                {playbackState.item.name}
                              </h1>
                              <p className="text-sm font-medium text-white/60 truncate mt-0.5">
                                {playbackState.item.artists.map(a => a.name).join(', ')}
                              </p>
                              <p className="text-xs text-white/40 truncate mt-0.5">
                                {playbackState.item.album.name}
                              </p>
                            </div>
                            <button
                              onClick={toggleLike}
                              className={`p-2.5 rounded-full transition-all active:scale-90 shrink-0 ${isLiked ? 'text-[#1DB954]' : 'text-white/50 hover:text-white'}`}
                            >
                              <Heart size={22} fill={isLiked ? "currentColor" : "none"} strokeWidth={1.5} />
                            </button>
                          </div>

                          {/* Progress Bar */}
                          <div className="space-y-1.5">
                            <div
                              onClick={handleSeek}
                              className="h-1.5 bg-white/20 rounded-full overflow-hidden relative cursor-pointer group"
                            >
                              <div
                                className="h-full bg-white rounded-full transition-all duration-1000"
                                style={{ width: `${(playbackState.progress_ms / playbackState.item.duration_ms) * 100}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[11px] font-bold text-white/40">
                              <span>{fmtMs(playbackState.progress_ms)}</span>
                              <span>{fmtMs(playbackState.item.duration_ms)}</span>
                            </div>
                          </div>

                          {/* Secondary Controls: Shuffle + Repeat */}
                          <div className="flex justify-between items-center px-1">
                            <button
                              onClick={() => spotifyApi.setShuffle(!playbackState.shuffle_state)}
                              className={`p-2 rounded-full transition-all active:scale-90 ${playbackState.shuffle_state ? 'text-[#1DB954]' : 'text-white/40 hover:text-white'}`}
                              title="Shuffle"
                            >
                              <Shuffle size={18} />
                            </button>

                            {/* Main Controls */}
                            <div className="flex items-center gap-4">
                              <button onClick={() => spotifyApi.skipToPrevious()} className="text-white/80 hover:text-white active:scale-95 transition-all">
                                <SkipBack size={26} fill="currentColor" />
                              </button>
                              <button
                                onClick={() => (playbackState.is_playing ? spotifyApi.pause() : spotifyApi.play())}
                                className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center active:scale-95 transition-all shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
                              >
                                {playbackState.is_playing
                                  ? <Pause size={28} fill="currentColor" />
                                  : <Play size={28} fill="currentColor" className="ml-1" />
                                }
                              </button>
                              <button onClick={() => spotifyApi.skipToNext()} className="text-white/80 hover:text-white active:scale-95 transition-all">
                                <SkipForward size={26} fill="currentColor" />
                              </button>
                            </div>

                            <button
                              onClick={() => {
                                const modes = [0, 1, 2];
                                const current = playbackState.repeat_state === 'off' ? 0 : playbackState.repeat_state === 'context' ? 1 : 2;
                                const next = modes[(current + 1) % 3];
                                spotifyApi.setRepeat(['off', 'context', 'track'][next]);
                              }}
                              className={`p-2 rounded-full transition-all active:scale-90 relative ${playbackState.repeat_state !== 'off' ? 'text-[#1DB954]' : 'text-white/40 hover:text-white'}`}
                              title="Repeat"
                            >
                              <Repeat size={18} />
                              {playbackState.repeat_state === 'track' && (
                                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-[#1DB954] text-black rounded-full text-[8px] font-black flex items-center justify-center leading-none">1</span>
                              )}
                            </button>
                          </div>

                          {/* Volume Slider */}
                          <div className="flex items-center gap-3 px-1">
                            <Volume2 size={15} className="text-white/40 shrink-0" />
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={playbackState.device?.volume_percent ?? 50}
                              onChange={(e) => spotifyApi.setVolume(parseInt(e.target.value))}
                              className="flex-1 h-1 accent-white cursor-pointer"
                              style={{ accentColor: '#1DB954' }}
                            />
                          </div>

                          {/* Up Next */}
                          {upNext && upNext[0] && (
                            <div className="flex items-center gap-3 bg-black/30 rounded-xl px-3 py-2.5 backdrop-blur-sm">
                              <div className="w-8 h-8 rounded-md overflow-hidden shrink-0">
                                <img src={upNext[0].album?.images?.[0]?.url} alt="" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Up Next</p>
                                <p className="text-xs text-white/80 font-semibold truncate">{upNext[0].name}</p>
                              </div>
                            </div>
                          )}

                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-6">
                          <img src="/spotify-logo.png" alt="Spotify" className="w-16 h-16 object-contain rounded-xl opacity-60" />
                          <p className="text-sm font-bold text-white/40 uppercase tracking-widest">{isPlayerReady ? 'Dashboard Ready' : 'Connecting...'}</p>
                          {isPlayerReady && !playbackState?.item && (
                            <button
                              onClick={transferPlayback}
                              className="px-8 py-4 bg-[#1DB954] text-black font-extrabold rounded-full text-sm transition-all active:scale-95"
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
                      className="flex-1 flex flex-col pt-2 pb-5 px-5 overflow-hidden min-h-0"
                    >
                      <h2 className="text-lg font-bold text-white mb-4">Your Library</h2>
                      <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1" style={{ scrollbarWidth: 'none' }}>
                        {playlists?.length > 0 ? (
                          playlists.map((pl) => (
                            <button
                              key={pl.id}
                              onClick={() => { spotifyApi.play({ context_uri: pl.uri }); setShowSpotifyBrowser(false); }}
                              className="flex items-center gap-3 p-3 rounded-xl bg-white/10 hover:bg-white/20 active:scale-[0.98] transition-all text-left"
                            >
                              <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-black/50">
                                <img src={pl.images?.[0]?.url} alt="" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate">{pl.name}</p>
                                <p className="text-xs font-medium text-white/50">{pl?.tracks?.total || 0} tracks</p>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-40">
                            <Music2 size={40} className="text-white" />
                            <p className="text-sm font-bold text-white">Loading playlists...</p>
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
// Official Spotify logo: green circle + three white curved bars
const SpotifyLogo = ({ size = 24 }) => (
  <div style={{ width: size, height: size }} className="flex items-center justify-center overflow-hidden shrink-0">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 168 168" width="100%" height="100%">
      <path fill="#1ED760" d="M84 0C37.6 0 0 37.6 0 84s37.6 84 84 84 84-37.6 84-84S130.4 0 84 0z" />
      <path fill="#fff" d="M120.3 120.5c-1.6 2.6-5 3.4-7.6 1.8-20.8-12.7-47-15.6-77.9-8.5-3 .7-5.9-1.2-6.6-4.1-.7-3 1.2-5.9 4.1-6.6 33.8-7.7 62.8-4.4 86.2 9.8 2.6 1.6 3.4 5 1.8 7.6zm10.7-23.8c-2 3.2-6.2 4.2-9.4 2.2-23.9-14.7-60.3-18.9-88.5-10.4-3.7 1.1-7.5-1-8.6-4.6-1.1-3.7 1-7.5 4.6-8.6 32.3-9.8 72.4-5 99.8 11.8 3.2 2 4.2 6.2 2.1 9.6zm.9-25c-28.6-17-75.7-18.6-103-10.3-4.4 1.3-9-1.2-10.3-5.5-1.3-4.4 1.2-9 5.5-10.3 31.3-9.5 83.3-7.7 116.1 11.9 4 2.4 5.3 7.5 2.9 11.5-2.3 3.9-7.4 5.2-11.2 2.7z" />
    </svg>
  </div>
);

const GoogleMapsLogo = ({ size = 24, className = "" }) => (
  <div style={{ width: size, height: size }} className={`flex items-center justify-center overflow-hidden shrink-0 ${className}`}>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="77.3 0 357.4 512" width="100%" height="100%">
      <path d="M310.1 8.5c-17-5.4-35.6-8.5-54.5-8.5C201.1 0 152 24.7 119.1 63.8l84.3 70.8z" style={{ fill: '#1a73e8' }} />
      <path d="M119.1 63.8C93.2 94.7 77.3 135 77.3 178.3c0 33.6 6.6 60.7 17.8 85.1l108.3-128.8z" style={{ fill: '#ea4335' }} />
      <path d="M256 110.2c37.9 0 68.4 30.5 68.4 68.4 0 16.6-6.2 32.1-16.2 44.1 0 0 53.8-64.2 106.3-126.5-21.7-41.8-59.2-73.5-104.4-87.8L203.4 134.6c12.8-14.7 31.3-24.4 52.6-24.4" style={{ fill: '#4285f4' }} />
      <path d="M256 246.7c-37.9 0-68.4-30.5-68.4-68.4 0-16.6 5.8-32.1 15.9-43.7L95.1 263.3c18.6 41 49.5 74.2 81.2 115.6l131.9-156.6c-12.8 15.1-31.3 24.4-52.2 24.4" style={{ fill: '#fbbc04' }} />
      <path d="M305.9 422.3c59.6-93.2 128.8-135.3 128.8-243.6 0-29.8-7.3-57.6-20.1-82.4L176.3 379c10.1 13.1 20.5 28.2 30.5 43.7 36.4 56.1 26.3 89.3 49.5 89.3s13.2-33.6 49.6-89.7" style={{ fill: '#34a853' }} />
    </svg>
  </div>
);

// --- Utils ---
const fmtMs = (ms) => {
  const min = Math.floor(ms / 60000);
  const sec = ((ms % 60000) / 1000).toFixed(0);
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
};
