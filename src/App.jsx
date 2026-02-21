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
  Search,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Signal,
  Bell,
  X,
  Volume2,
  Cloud,
  LogOut,
  MapPin,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SpotifyWebApi from 'spotify-web-api-js';

// Capacitor Plugins
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { Geolocation } from '@capacitor/geolocation';

// Google Maps Extended Components (React Wrappers)
import { APILoader, PlacePicker } from '@googlemaps/extended-component-library/react';

const spotifyApi = new SpotifyWebApi();

// --- Configuration from Environment ---
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;

export default function App() {
  // --- Auth & Config State ---
  const [spotifyToken, setSpotifyToken] = useState(null);

  // --- Real-time Hardware State ---
  const [time, setTime] = useState(new Date());
  const [batteryInfo, setBatteryInfo] = useState({ batteryLevel: 1.0, isCharging: false });
  const [networkStatus, setNetworkStatus] = useState({ connected: true, connectionType: 'wifi' });
  const [currentCoords, setCurrentCoords] = useState(null);

  // --- UI State ---
  const [activeTab, setActiveTab] = useState('maps');
  const [showAppDrawer, setShowAppDrawer] = useState(false);
  const [playbackState, setPlaybackState] = useState(null);

  // Refs for Maps Components
  const mapRef = useRef(null);
  const pickerRef = useRef(null);
  const markerRef = useRef(null);

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

    // 3. Spotify Token Handling (Implicit Grant)
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    if (token) {
      setSpotifyToken(token);
      spotifyApi.setAccessToken(token);
      window.location.hash = ''; // Clear token from URL
    }

    return () => clearInterval(timer);
  }, []);

  // --- Spotify Functions ---
  const loginToSpotify = () => {
    const redirectUri = window.location.origin + '/';
    const scopes = [
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-currently-playing',
      'playlist-read-private',
      'user-library-read'
    ].join('%20');
    window.location.href = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${scopes}&response_type=token&show_dialog=true`;
  };

  useEffect(() => {
    if (spotifyToken) {
      const interval = setInterval(() => {
        spotifyApi.getMyCurrentPlaybackState().then(state => {
          setPlaybackState(state);
        }).catch(err => console.error("Spotify playback error:", err));
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [spotifyToken]);

  // --- Google Maps Logic ---
  const handlePlaceChange = (e) => {
    const picker = e.target;
    const place = picker.value;
    if (!place || !place.location) return;

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
  };

  const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans select-none antialiased p-2 gap-2">

      {/* Component Library Loader */}
      <APILoader apiKey={GOOGLE_MAPS_API_KEY} solutionChannel="GMP_GE_mapsandplacesautocomplete_v2" />

      {/* Functional Sidebar */}
      <nav className="w-20 flex flex-col justify-between items-center py-8 bg-[#0a0a0a] rounded-[2.5rem] border border-white/5 z-[100] shadow-2xl">
        <div className="flex flex-col gap-10 items-center">
          <button
            onClick={() => setShowAppDrawer(!showAppDrawer)}
            className={`w-14 h-14 flex items-center justify-center rounded-2xl transition-all active:scale-90 ${showAppDrawer ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'bg-zinc-800/40 text-white/50 hover:bg-zinc-800'}`}
          >
            <LayoutGrid size={28} />
          </button>

          <div className="flex flex-col gap-4 items-center">
            {[
              { id: 'maps', icon: <Navigation size={30} /> },
              { id: 'spotify', icon: <Music2 size={30} /> },
              { id: 'phone', icon: <Phone size={30} /> }
            ].map((app) => (
              <button
                key={app.id}
                onClick={() => { setActiveTab(app.id); setShowAppDrawer(false); }}
                className={`w-14 h-14 flex items-center justify-center rounded-2xl transition-all duration-300 ${activeTab === app.id ? 'bg-zinc-800 text-white border border-white/10 shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {app.icon}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6 items-center">
          <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-zinc-800/10 text-zinc-800">
            <SettingsIcon size={26} />
          </div>
          <button className="w-14 h-14 flex items-center justify-center rounded-full bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 active:scale-90 transition-all shadow-blue-500/10">
            <Mic size={28} strokeWidth={2.5} />
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <div className="flex-1 flex flex-col gap-2 relative">

        {/* System Bar */}
        <div className="h-6 flex justify-end items-center px-8 gap-5 text-zinc-500 text-[10px] font-black tracking-[0.2em]">
          <div className="flex items-center gap-2">
            <Signal size={14} className={networkStatus.connected ? 'text-white' : 'text-red-500'} />
            <span className="uppercase">{networkStatus.connectionType}</span>
          </div>
          <div className="flex items-center gap-2">
            <Battery size={14} className={batteryInfo.isCharging ? 'text-green-400' : 'text-white'} />
            <span>{Math.round((batteryInfo.batteryLevel || 1) * 100)}%</span>
          </div>
          <span className="text-white ml-2 text-xs tracking-tighter">{formattedTime}</span>
        </div>

        {/* Dynamic Split Layout */}
        <div className="flex-1 flex gap-2 overflow-hidden">

          {/* Advanced Map Container */}
          <div className={`transition-all duration-700 ease-in-out relative rounded-[3rem] overflow-hidden border border-white/5 bg-[#121212] ${activeTab === 'maps' ? 'flex-[2.5]' : 'flex-1'}`}>
            <gmp-map
              ref={mapRef}
              center={currentCoords ? { lat: currentCoords.latitude, lng: currentCoords.longitude } : { lat: 40.749933, lng: -73.98633 }}
              zoom="13"
              map-id="DEMO_MAP_ID"
              style={{ width: '100%', height: '100%', '--gmp-font-family': 'Inter, sans-serif' }}
            >
              <div slot="control-block-start-inline-start" className="p-8 w-full max-w-sm">
                <PlacePicker
                  ref={pickerRef}
                  placeholder="Search Destinations..."
                  onPlaceChange={handlePlaceChange}
                  style={{
                    width: '100%',
                    '--gmpx-color-surface': '#1a1a1a',
                    '--gmpx-color-on-surface': '#ffffff',
                    '--gmpx-border-radius': '1.5rem',
                    '--gmpx-font-family': 'Inter, sans-serif'
                  }}
                />
              </div>
              <gmp-advanced-marker ref={markerRef}></gmp-advanced-marker>
            </gmp-map>

            {/* Float Stats Overlay */}
            <div className="absolute bottom-8 left-8 flex gap-4 pointer-events-none z-10">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-black/90 backdrop-blur-3xl rounded-[2.5rem] p-6 border border-white/10 flex items-center gap-6 premium-shadow pointer-events-auto"
              >
                <div className="bg-blue-600 p-4 rounded-3xl shadow-[0_15px_30px_-5px_rgba(37,99,235,0.4)]">
                  <Navigation size={28} className="text-white" />
                </div>
                <div>
                  <h4 className="font-black text-xl text-white tracking-tight">Active Navigation</h4>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.3em] mt-1">{networkStatus.connected ? 'GPS Ready' : 'Searching...'}</p>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Media/Info Card */}
          <div className={`transition-all duration-700 ease-in-out flex flex-col gap-2 ${activeTab === 'maps' ? 'flex-1' : 'flex-[2]'}`}>

            {/* Functional Spotify Card */}
            <div className="flex-1 rounded-[3rem] bg-[#050505] border border-white/5 overflow-hidden flex flex-col p-8 premium-shadow relative group">
              {!spotifyToken ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center">
                  <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center animate-pulse">
                    <Music2 size={48} className="text-green-500" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-white px-4 leading-tight">Connect Your Spotify</h3>
                    <p className="text-zinc-500 text-sm font-medium">Real-world playback and playlists</p>
                  </div>
                  <button
                    onClick={loginToSpotify}
                    className="bg-green-500 text-black font-black px-12 py-5 rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl"
                  >
                    SIGN IN
                  </button>
                </div>
              ) : (
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <SpotifyLogo size={32} />
                      <span className="text-[10px] font-black text-green-500 tracking-[0.3em] uppercase">Connected</span>
                    </div>
                    <button onClick={() => setSpotifyToken(null)} className="text-zinc-600 hover:text-white"><LogOut size={20} /></button>
                  </div>

                  {playbackState?.item ? (
                    <div className="space-y-8">
                      <motion.div
                        layoutId="albumArt"
                        className="w-48 h-48 mx-auto rounded-[3rem] overflow-hidden shadow-3xl border border-white/5"
                      >
                        <img src={playbackState.item.album.images[0].url} alt="Album" className="w-full h-full object-cover" />
                      </motion.div>

                      <div className="text-center space-y-1">
                        <h3 className="font-black text-2xl text-white tracking-tight line-clamp-1">{playbackState.item.name}</h3>
                        <p className="text-sm text-zinc-500 font-bold uppercase tracking-widest">{playbackState.item.artists[0].name}</p>
                      </div>

                      <div className="flex flex-col gap-3 px-4">
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]"
                            animate={{ width: `${(playbackState.progress_ms / playbackState.item.duration_ms) * 100}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-700 font-black tracking-widest">
                          <span>{fmtMs(playbackState.progress_ms)}</span>
                          <span>{fmtMs(playbackState.item.duration_ms)}</span>
                        </div>
                      </div>

                      <div className="flex justify-center items-center gap-10">
                        <button onClick={() => spotifyApi.skipToPrevious()} className="text-zinc-500 hover:text-white transition-all active:scale-75"><SkipBack size={32} fill="currentColor" /></button>
                        <button
                          onClick={() => playbackState.is_playing ? spotifyApi.pause() : spotifyApi.play()}
                          className="w-20 h-20 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-3xl"
                        >
                          {playbackState.is_playing ? <Pause size={40} fill="currentColor" /> : <Play size={40} fill="currentColor" className="ml-2" />}
                        </button>
                        <button onClick={() => spotifyApi.skipToNext()} className="text-zinc-500 hover:text-white transition-all active:scale-75"><SkipForward size={32} fill="currentColor" /></button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                      <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-700">
                        <Play size={40} />
                      </div>
                      <p className="text-zinc-600 text-sm font-bold uppercase tracking-[0.2em]">Open Spotify on Device</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Live Context Card */}
            <div className="h-32 bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] flex items-center justify-between px-10">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-zinc-900 rounded-3xl flex items-center justify-center text-blue-500">
                  <MapPin size={28} />
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Global Position</p>
                  <p className="text-sm font-black text-white truncate max-w-[120px]">
                    {currentCoords ? `${currentCoords.latitude.toFixed(4)}, ${currentCoords.longitude.toFixed(4)}` : 'Wait for GPS...'}
                  </p>
                </div>
              </div>
              <div className="h-12 w-[1px] bg-white/5" />
              <div className="text-center space-y-0.5">
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Heading</p>
                <Compass size={24} className="text-white mx-auto" />
              </div>
            </div>
          </div>
        </div>

        {/* Global Nav Bar Handle */}
        <div className="h-2 flex justify-center items-center py-4">
          <div className="w-40 h-2 bg-white/5 rounded-full" />
        </div>

      </div>

      {/* Launcher Overlay */}
      <AnimatePresence>
        {showAppDrawer && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="absolute inset-4 z-[200] bg-black/95 backdrop-blur-[60px] rounded-[4rem] border border-white/10 p-20 flex flex-col shadow-[0_0_120px_rgba(0,0,0,0.9)]"
          >
            <div className="flex justify-between items-center mb-20">
              <h2 className="text-6xl font-black text-white tracking-tighter">Applications</h2>
              <button
                onClick={() => setShowAppDrawer(false)}
                className="w-20 h-20 flex items-center justify-center bg-zinc-800/50 rounded-full text-white/40 hover:text-white transition-all shadow-xl"
              >
                <X size={40} />
              </button>
            </div>

            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-x-12 gap-y-20">
              {[
                { name: 'Navigation', icon: <Navigation size={56} />, bg: 'bg-white' },
                { name: 'Spotify Music', icon: <Music2 size={56} />, bg: 'bg-black' },
                { name: 'Phone Calls', icon: <Phone size={56} />, bg: 'bg-green-600', text: 'text-white' },
                { name: 'Weather', icon: <Cloud size={56} />, bg: 'bg-blue-500', text: 'text-white' },
                { name: 'Settings', icon: <SettingsIcon size={56} />, bg: 'bg-zinc-700', text: 'text-zinc-300' },
                { name: 'Hardware', icon: <Battery size={56} />, bg: 'bg-zinc-800', text: 'text-white' },
              ].map((app, index) => (
                <motion.button
                  key={index}
                  whileHover={{ y: -15, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowAppDrawer(false)}
                  className="flex flex-col items-center gap-6 group"
                >
                  <div className={`w-32 h-32 rounded-[3.5rem] ${app.bg} ${app.text} flex items-center justify-center shadow-3xl border border-white/5 transition-all duration-500`}>
                    {app.icon}
                  </div>
                  <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.4em] group-hover:text-white transition-colors">{app.name}</span>
                </motion.button>
              ))}
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
