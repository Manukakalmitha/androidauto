import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
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
  Split,
  CircleChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SpotifyWebApi from 'spotify-web-api-js';
import { createClient } from '@supabase/supabase-js';

// Capacitor Plugins
import { registerPlugin } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { Geolocation } from '@capacitor/geolocation';

const NotificationPlugin = registerPlugin('NotificationPlugin');

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

import LandingPage from './LandingPage';

function Dashboard() {
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
  const [notifications, setNotifications] = useState([]);

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

    // 5. Notification Listener (Android Only)
    let notifListener = null;
    if (Capacitor.isPluginAvailable('NotificationPlugin')) {
      try {
        notifListener = NotificationPlugin.addListener('onNotificationReceived', (info) => {
          setNotifications(prev => [info, ...prev].slice(0, 5));
        });
      } catch (e) {
        console.warn("NotificationPlugin: Failed to add listener", e);
      }
    }

    return () => {
      clearInterval(timer);
      subscription.unsubscribe();
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
      networkListener.remove();
      watchIdPromise.then(id => {
        if (id) Geolocation.clearWatch({ id });
      });
      if (notifListener) notifListener.remove();
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

    // Load script immediately if token is available, or setup a watcher
    const loadSpotifySDK = () => {
      if (!document.getElementById('spotify-player-sdk')) {
        const script = document.createElement("script");
        script.id = 'spotify-player-sdk';
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);
      } else if (window.Spotify && !spotifyPlayer) {
        window.onSpotifyWebPlaybackSDKReady();
      }
    };

    if (spotifyToken) {
      loadSpotifySDK();
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
        setShowDirectionsPanel(true);
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
    setShowDirectionsPanel(false);
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
    <div className="h-screen w-screen bg-[#000] text-zinc-100 flex overflow-hidden font-sans select-none antialiased">

      {/* Modern Left Rail - Tablet Optimized */}
      <nav className="w-20 bg-[#000] border-r border-white/5 flex flex-col items-center py-6 gap-6 relative z-[100]">

        {/* Top: Branding/Logo */}
        <button
          onClick={() => setShowAppDrawer(true)}
          className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all active:scale-95 group shadow-xl"
        >
          <LayoutGrid size={24} className="text-zinc-500 group-hover:text-white transition-colors" />
        </button>

        {/* Middle: Core Apps */}
        <div className="flex-1 flex flex-col gap-4 mt-4">
          <button
            onClick={() => { setActiveTab('maps'); setShowAppDrawer(false); }}
            className={`aa-rail-btn ${activeTab === 'maps' ? 'bg-[#1a73e8] text-white shadow-lg shadow-blue-500/20' : 'hover:bg-white/5 text-zinc-500'}`}
          >
            <Navigation size={28} fill={activeTab === 'maps' ? "white" : "none"} strokeWidth={2.5} />
          </button>

          <button
            onClick={() => { setActiveTab('spotify'); setShowAppDrawer(false); }}
            className={`aa-rail-btn ${activeTab === 'spotify' ? 'bg-[#1DB954] text-black shadow-lg shadow-green-500/20' : 'hover:bg-white/5 text-zinc-500'}`}
          >
            <Music2 size={28} fill={activeTab === 'spotify' ? "black" : "none"} strokeWidth={2.5} />
          </button>

          <button
            className="aa-rail-btn hover:bg-white/5 text-zinc-500"
          >
            <Phone size={28} />
          </button>
        </div>

        {/* Bottom: Tools & Clock */}
        <div className="flex flex-col items-center gap-6">
          <button
            onClick={toggleVoiceAssistant}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${isListening ? 'bg-red-500 text-white shadow-lg shadow-red-500/50 scale-110' : 'hover:bg-white/5 text-zinc-500'}`}
          >
            <Mic size={28} />
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="w-12 h-12 rounded-full flex items-center justify-center hover:bg-white/5 text-zinc-500 transition-all active:scale-90"
          >
            <SettingsIcon size={24} />
          </button>

          <div className="flex flex-col items-center opacity-40">
            <span className="text-[13px] font-black tracking-tighter text-white">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
          </div>
        </div>
      </nav>

      {/* Component Library Loader */}
      <APILoader
        apiKey={GOOGLE_MAPS_API_KEY}
        solutionChannel="GMP_GCC_placeautocomplete_v1"
        libraries={['places', 'marker']}
      />

      <main className="flex-1 flex gap-4 p-4 min-w-0 bg-[#000]">

        {/* Primary Slot - Dynamic Content (Maps mostly) */}
        <div className="flex-1 aa-card relative">

          <gmp-map
            ref={mapRef}
            id="main-map"
            map-id="DEMO_MAP_ID"
            style={{ width: '100%', height: '100%', '--gmp-font-family': 'Inter, sans-serif' }}
          >
            <gmp-advanced-marker ref={markerRef}></gmp-advanced-marker>
          </gmp-map>

          {/* Active Navigation Maneuver Bar */}
          <AnimatePresence>
            {isNavigating && navigationSteps.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-6 left-6 right-6 z-50 pointer-events-none"
              >
                <div className="bg-[#00703b] rounded-[2rem] shadow-2xl flex items-center px-6 py-4 gap-6 w-full border border-white/5 pointer-events-auto">
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0">
                    <ArrowUp size={36} strokeWidth={3} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-2xl font-black text-white leading-tight truncate">
                      Towards <span dangerouslySetInnerHTML={{ __html: navigationSteps[activeStepIndex]?.instructions }} />
                    </span>
                    <span className="text-lg font-bold text-white/70">{navigationSteps[activeStepIndex]?.distance.text}</span>
                  </div>
                  <button onClick={endNavigation} className="ml-auto w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white pointer-events-auto hover:bg-white/20"><X size={24} /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Coolwalk Notification & Call Overlay */}
          <AnimatePresence>
            {notifications.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                className="absolute bottom-6 left-6 right-6 z-[200] pointer-events-none"
              >
                <div className={`backdrop-blur-3xl border rounded-[2.5rem] p-6 shadow-2xl flex items-center gap-6 pointer-events-auto max-w-[600px] mx-auto ${notifications[0].category === 'call' ? 'bg-green-600/90 border-green-400/20' : 'bg-[#1c1c1e]/90 border-white/10'}`}>
                  <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shrink-0 ${notifications[0].category === 'call' ? 'bg-white text-green-600 animate-bounce' : 'bg-blue-500/20 text-blue-400'}`}>
                    <Phone size={32} fill={notifications[0].category === 'call' ? 'currentColor' : 'none'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-black uppercase tracking-[0.2em] ${notifications[0].category === 'call' ? 'text-white/60' : 'text-blue-400'}`}>
                      {notifications[0].category === 'call' ? 'Incoming Call' : notifications[0].package?.split('.').pop() || 'Notification'}
                    </span>
                    <h3 className="text-white text-xl font-bold truncate leading-tight mt-1">{notifications[0].title}</h3>
                    <p className="text-white/60 text-sm truncate mt-0.5 font-medium">{notifications[0].text}</p>
                  </div>
                  <div className="flex gap-3">
                    {notifications[0].category === 'call' && (
                      <button className="w-12 h-12 rounded-full bg-white text-green-600 flex items-center justify-center shadow-lg active:scale-95 transition-all"><Phone size={24} fill="currentColor" /></button>
                    )}
                    <button onClick={() => setNotifications(prev => prev.slice(1))} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${notifications[0].category === 'call' ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                      <X size={24} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Simplified Map UI: "Where to?" Card */}
          {!isNavigating && (
            <div className="absolute top-6 left-6 w-[400px] z-50 pointer-events-none">
              <div className="bg-white/95 backdrop-blur-3xl rounded-[2.5rem] p-2 shadow-2xl pointer-events-auto border border-gray-100 ring-1 ring-black/5">
                <div className="flex items-center gap-3 h-14 px-5">
                  <GoogleMapsLogo size={28} />
                  <div className="flex-1 overflow-hidden">
                    <gmpx-place-picker
                      ref={pickerRef}
                      placeholder="Where to?"
                      for-map="main-map"
                      style={{ width: '100%', '--gmpx-color-surface': 'transparent', '--gmpx-border-radius': '0', '--gmpx-font-family': 'Google Sans, Inter, sans-serif' }}
                    ></gmpx-place-picker>
                  </div>
                  <button onClick={() => setShowDirectionsPanel(!showDirectionsPanel)} className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all ${showDirectionsPanel ? 'bg-red-500 text-white' : 'bg-[#1a73e8] text-white'}`}>
                    {showDirectionsPanel ? <X size={20} /> : <Navigation size={20} fill="white" className="-rotate-45" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Directions Panel Overlay */}
          <AnimatePresence>
            {showDirectionsPanel && selectedPlace && !isNavigating && (
              <motion.div
                initial={{ opacity: 0, x: -100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="absolute top-[100px] left-6 bottom-6 w-[400px] z-50 pointer-events-none"
              >
                <div className="bg-white/95 backdrop-blur-3xl rounded-[2.5rem] p-8 shadow-2xl pointer-events-auto border border-gray-100 ring-1 ring-black/5 flex flex-col h-full">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                      <MapPin size={32} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-2xl font-black text-gray-900 truncate leading-tight">{selectedPlace.displayName || selectedPlace.name}</h2>
                      <p className="text-sm font-medium text-gray-400 truncate">{selectedPlace.formattedAddress}</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar mb-8">
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.4em] ml-2">Choose Route</span>
                    {routes.length > 0 ? routes.map((route, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectRoute(idx)}
                        className={`w-full p-6 rounded-[2rem] border-2 transition-all text-left flex items-center justify-between group ${selectedRouteIndex === idx ? 'border-[#1a73e8] bg-blue-50/50' : 'border-gray-50 hover:border-gray-200'}`}
                      >
                        <div className="flex flex-col">
                          <span className={`text-2xl font-black leading-tight ${selectedRouteIndex === idx ? 'text-[#1a73e8]' : 'text-gray-900'}`}>{route.legs[0].duration.text}</span>
                          <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">{route.legs[0].distance.text}</span>
                        </div>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${selectedRouteIndex === idx ? 'bg-[#1a73e8] text-white scale-110 shadow-lg' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
                          {selectedRouteIndex === idx ? <ArrowUp size={20} /> : <div className="w-2 h-2 rounded-full bg-current" />}
                        </div>
                      </button>
                    )) : (
                      <div className="flex flex-col items-center justify-center py-20 opacity-20">
                        <History size={48} strokeWidth={1} />
                        <p className="mt-4 font-bold">Calculating routes...</p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={startNavigation}
                    disabled={routes.length === 0}
                    className="w-full py-6 bg-[#1a73e8] text-white rounded-[2rem] font-black text-2xl shadow-[0_20px_40px_-10px_rgba(26,115,232,0.4)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-50 disabled:scale-100"
                  >
                    Start Trip
                    <Navigation size={28} fill="white" className="-rotate-45" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation ETA Overlay (Simplified Pill) */}
          <AnimatePresence>
            {isNavigating && routes[selectedRouteIndex] && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-auto"
              >
                <div className="bg-white rounded-[2rem] shadow-2xl flex items-center px-8 py-3 gap-6 border border-gray-100 ring-1 ring-black/5">
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-black text-[#1a7344] leading-tight">{routes[selectedRouteIndex].legs[0].duration.text}</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{routes[selectedRouteIndex].legs[0].distance.text}</span>
                  </div>
                  <div className="w-[1px] h-8 bg-gray-100" />
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-black text-gray-800 leading-tight">
                      {(() => {
                        const now = new Date();
                        const durationSec = routes[selectedRouteIndex].legs[0].duration.value;
                        now.setSeconds(now.getSeconds() + durationSec);
                        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      })()}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Arrival</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Persistent Map Controls */}
          <div className="absolute right-6 bottom-6 flex flex-col gap-4 z-40">
            <button
              onClick={() => { if (currentCoords) mapRef.current.center = { lat: currentCoords.latitude, lng: currentCoords.longitude }; }}
              className="w-16 h-16 bg-white text-[#1a73e8] rounded-[2rem] flex items-center justify-center shadow-2xl border border-gray-100 active:scale-95 transition-all"
            >
              <CircleChevronUp size={32} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Secondary Slot - Media & System Info */}
        <div className="w-[380px] flex flex-col gap-4">

          {/* Spotify Premium Card */}
          <div className="flex-1 aa-card flex flex-col relative overflow-hidden group">
            {playbackState?.item?.album?.images?.[0]?.url && (
              <img src={playbackState.item.album.images[0].url} className="absolute inset-0 w-full h-full object-cover blur-[100px] opacity-40 saturate-150 transition-opacity duration-1000" />
            )}

            <div className="p-6 flex-1 flex flex-col relative z-20 min-h-0">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#1DB954] flex items-center justify-center">
                    <SpotifyLogo size={14} className="text-black" />
                  </div>
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Playing on Spotify</span>
                </div>
                <button onClick={() => setShowSpotifyBrowser(!showSpotifyBrowser)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all"><LayoutGrid size={20} /></button>
              </div>

              <AnimatePresence mode="wait">
                {!showSpotifyBrowser ? (
                  <motion.div key="player" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col gap-8">
                    {playbackState?.item ? (
                      <>
                        <div className="aspect-square rounded-[2rem] overflow-hidden shadow-2xl border border-white/5 relative group-hover:scale-[1.02] transition-transform duration-500">
                          <img src={playbackState.item.album.images[0].url} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                        </div>
                        <div className="space-y-1">
                          <h2 className="text-2xl font-bold text-white leading-tight truncate tracking-tight">{playbackState.item.name}</h2>
                          <p className="text-lg font-medium text-[#1DB954] truncate opacity-90">{playbackState.item.artists[0]?.name}</p>
                        </div>
                        <div className="mt-auto flex items-center justify-between px-2">
                          <button onClick={() => spotifyApi.skipToPrevious()} className="text-white/60 hover:text-white transition-transform active:scale-90"><SkipBack size={36} fill="currentColor" /></button>
                          <button
                            onClick={() => (playbackState.is_playing ? spotifyApi.pause() : spotifyApi.play())}
                            className="w-24 h-24 bg-white text-black rounded-full flex items-center justify-center shadow-2xl active:scale-90 hover:scale-105 transition-all"
                          >
                            {playbackState.is_playing ? <Pause size={44} fill="currentColor" /> : <Play size={44} fill="currentColor" className="ml-1" />}
                          </button>
                          <button onClick={() => spotifyApi.skipToNext()} className="text-white/60 hover:text-white transition-transform active:scale-90"><SkipForward size={36} fill="currentColor" /></button>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center gap-6">
                        <div className="opacity-20 flex flex-col items-center">
                          <Music2 size={100} strokeWidth={1} />
                          <p className="mt-6 font-black uppercase tracking-[0.4em] text-xs text-center">Media Hub Ready</p>
                        </div>
                        {!spotifyToken && (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={loginToSpotify}
                            className="px-8 py-3 bg-[#1DB954] text-black rounded-full font-bold shadow-lg hover:shadow-[#1DB954]/20 transition-all flex items-center gap-2"
                          >
                            <SpotifyLogo size={20} className="text-black" />
                            Connect Spotify
                          </motion.button>
                        )}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div key="browser" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col min-h-0">
                    <h3 className="text-xl font-bold mb-4 tracking-tight">Your Playlists</h3>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {playlists?.map(pl => (
                        <button key={pl.id} onClick={() => { spotifyApi.play({ context_uri: pl.uri }); setShowSpotifyBrowser(false); }} className="w-full flex items-center gap-4 p-4 rounded-3xl bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all text-left group/pl">
                          <img src={pl.images?.[0]?.url} className="w-14 h-14 rounded-2xl object-cover shadow-lg group-hover/pl:scale-105 transition-transform" />
                          <div className="min-w-0 flex-1">
                            <p className="font-bold truncate text-base">{pl.name}</p>
                            <p className="text-xs text-white/40 font-medium">{pl.tracks?.total} tracks</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Connected Hub Widget */}
          <div className="h-[220px] aa-card p-6 flex flex-col justify-between group overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[80px] rounded-full group-hover:bg-blue-500/20 transition-all duration-1000" />
            <div className="flex justify-between items-start relative z-10">
              <div>
                <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Connectivity</span>
                <div className="flex items-center gap-4 mt-3">
                  <Signal size={24} className={networkStatus.connected ? "text-blue-500" : "text-white/10"} />
                  <Wifi size={24} className={networkStatus.activeType === 'wifi' ? "text-blue-500" : "text-white/10"} />
                  <div className="w-px h-6 bg-white/5" />
                  <div className={`flex items-center gap-1.5 ${batteryInfo.isCharging ? "text-green-500" : "text-white/60"}`}>
                    <Battery size={24} />
                    <span className="text-xs font-black">94%</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end mb-1">
                  <Cloud size={28} className="text-blue-400" />
                  <span className="text-2xl font-black">22°</span>
                </div>
                <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Sunny · Cupertino</span>
              </div>
            </div>
            <div className="flex items-end justify-between relative z-10">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">System Node</span>
                <span className="text-lg font-bold mt-1 tracking-tight">Android Tablet Pro</span>
              </div>
              <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)] animate-pulse"></div>
            </div>
          </div>

        </div>
      </main>

      {/* Immersive App Drawer */}
      <AnimatePresence>
        {showAppDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[200] bg-black/95 backdrop-blur-[100px] flex flex-col"
          >
            <div className="p-16 flex flex-col h-full max-w-[1200px] mx-auto w-full">
              <div className="flex justify-between items-end mb-16">
                <div className="space-y-2">
                  <h2 className="text-7xl font-black text-white tracking-tighter">Launcher</h2>
                  <p className="text-sm font-black text-white/20 uppercase tracking-[1em]">Android Tablet Edition</p>
                </div>
                <button
                  onClick={() => setShowAppDrawer(false)}
                  className="w-20 h-20 flex items-center justify-center bg-white text-black rounded-full hover:scale-110 active:scale-95 transition-all shadow-2xl"
                >
                  <X size={40} />
                </button>
              </div>

              <div className="grid grid-cols-4 md:grid-cols-5 gap-12 overflow-y-auto custom-scrollbar pr-4">
                {[
                  { name: 'Maps', icon: <Navigation size={56} fill="white" />, bg: 'bg-[#1a73e8]', text: 'text-white', id: 'maps' },
                  { name: 'Spotify', icon: <SpotifyLogo size={56} />, bg: 'bg-[#1DB954]', text: 'text-black', id: 'spotify' },
                  { name: 'Calls', icon: <Phone size={56} />, bg: 'bg-[#34a853]', text: 'text-white', id: 'phone' },
                  { name: 'Assistant', icon: <Mic size={56} />, bg: 'bg-[#4285f4]', text: 'text-white', id: 'assistant' },
                  { name: 'Settings', icon: <SettingsIcon size={56} />, bg: 'bg-zinc-800', text: 'text-white', id: 'settings' },
                ].map((app, index) => (
                  <motion.button
                    key={index}
                    whileHover={{ y: -12, scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      if (app.id === 'settings') { setShowSettings(true); setShowAppDrawer(false); }
                      else { setActiveTab(app.id); setShowAppDrawer(false); }
                    }}
                    className="flex flex-col items-center gap-6 group"
                  >
                    <div className={`w-36 h-36 rounded-[2.5rem] ${app.bg} ${app.text} flex items-center justify-center shadow-2xl border border-white/5 transition-all duration-500 group-hover:shadow-[0_20px_60px_-15px_rgba(255,255,255,0.1)]`}>
                      {app.icon}
                    </div>
                    <span className="text-xs font-black text-white/40 uppercase tracking-[0.3em] group-hover:text-white transition-colors">{app.name}</span>
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

export default function App() {
  // --- Routing State ---
  const [currentRoute, setCurrentRoute] = useState(window.location.hash === '#/app' ? 'app' : 'landing');

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentRoute(window.location.hash === '#/app' ? 'app' : 'landing');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateToApp = () => {
    window.location.hash = '/app';
    setCurrentRoute('app');
  };

  if (currentRoute === 'landing') {
    return <LandingPage onEnterApp={navigateToApp} />;
  }

  return <Dashboard />;
}

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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[300] bg-black/80 backdrop-blur-3xl flex p-10 justify-center items-center">
          <div className="bg-[#1c1c1e] border border-white/10 rounded-[3rem] p-12 w-full max-w-2xl shadow-2xl relative">
            <button onClick={onClose} className="absolute top-8 right-8 w-14 h-14 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center transition-all active:scale-95"><X size={28} /></button>
            <h2 className="text-4xl font-black text-white mb-10 tracking-tight flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-400">
                <SettingsIcon size={28} />
              </div>
              Settings
            </h2>

            <div className="space-y-8">
              <div className="space-y-4">
                <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] ml-2">Quick Access</span>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
                    <Home size={24} className="text-blue-400 mb-3" />
                    <h4 className="font-bold text-white">Home</h4>
                    <div className="bg-white/5 p-2 rounded-xl mt-2">
                      <gmpx-place-picker ref={homeRef} placeholder="Search home..." for-map="main-map" style={{ width: '100%', '--gmpx-color-surface': 'transparent', '--gmpx-color-on-surface': '#ffffff', '--gmpx-border-radius': '0' }}></gmpx-place-picker>
                    </div>
                  </div>
                  <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
                    <Briefcase size={24} className="text-purple-400 mb-3" />
                    <h4 className="font-bold text-white">Work</h4>
                    <div className="bg-white/5 p-2 rounded-xl mt-2">
                      <gmpx-place-picker ref={workRef} placeholder="Search work..." for-map="main-map" style={{ width: '100%', '--gmpx-color-surface': 'transparent', '--gmpx-color-on-surface': '#ffffff', '--gmpx-border-radius': '0' }}></gmpx-place-picker>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] ml-2">App Configuration</span>
                <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                      <LayoutGrid size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white">Google Services</h4>
                      <p className="text-xs text-zinc-500">Connected to Maps & Places</p>
                    </div>
                  </div>
                  <div className="w-12 h-6 bg-blue-500 rounded-full flex items-center px-1">
                    <div className="w-4 h-4 bg-white rounded-full ml-auto" />
                  </div>
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
