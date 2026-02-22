import React from 'react';
import { motion } from 'framer-motion';
import { Download, Car, Smartphone, Map, Music, Settings, Gauge, ShieldCheck, Zap } from 'lucide-react';

const LandingPage = ({ onEnterApp }) => {
    const screenshots = [
        { src: '/dashboard_main.png', title: 'Smart Dashboard', desc: 'Real-time maps and connectivity status.' },
        { src: '/music_feature.png', title: 'Media Hub', desc: 'Seamless Spotify integration and media controls.' },
        { src: '/dashboard_night.png', title: 'Night Mode', desc: 'Sleek, dark-themed UI optimized for low light.' },
    ];

    const features = [
        { icon: <Map className="w-6 h-6" />, title: 'Advanced Navigation', desc: 'Precise location tracking and search powered by Google Maps.' },
        { icon: <Music className="w-6 h-6" />, title: 'Spotify Integration', desc: 'Control your music and playlists without leaving the dashboard.' },
        { icon: <ShieldCheck className="w-6 h-6" />, title: 'Universal Connectivity', desc: 'Supports a wide range of Android head units and tablets.' },
        { icon: <Zap className="w-6 h-6" />, title: 'High Performance', desc: 'Lightweight and optimized for stable, lag-free performance.' },
    ];

    return (
        <div className="min-h-screen bg-[#09090b] text-white selection:bg-blue-500/30 overflow-x-hidden">
            {/* Navigation */}
            <nav className="fixed top-0 inset-x-0 h-20 z-50 glass border-b border-white/5 px-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                        <Car className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">Android Auto Pro</span>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={onEnterApp}
                        className="hidden md:block text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                    >
                        Launch Web App
                    </button>
                    <a
                        href="/androidauto-v1.4.apk"
                        download
                        className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-zinc-200 transition-all active:scale-95"
                    >
                        <Download className="w-4 h-4" />
                        Download APK
                    </a>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-40 pb-20 px-6 container mx-auto text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <span className="inline-block px-4 py-1.5 bg-blue-600/10 text-blue-500 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
                        Version 1.4 now live
                    </span>
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
                        The Evolution of <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600">
                            In-Car Intelligence
                        </span>
                    </h1>
                    <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-12">
                        Experience the most powerful, customizable, and sleekest Android Auto alternative ever built for tablets and head units.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={onEnterApp}
                            className="w-full sm:w-auto px-8 py-4 bg-blue-600 rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all premium-shadow active:scale-95"
                        >
                            Experience Web Live
                        </button>
                        <a
                            href="/androidauto-v1.4.apk"
                            download
                            className="w-full sm:w-auto px-8 py-4 glass rounded-2xl font-bold text-lg border border-white/10 hover:bg-white/5 transition-all active:scale-95"
                        >
                            Download APK
                        </a>
                    </div>
                </motion.div>
            </section>

            {/* Product Snapshots */}
            <section className="py-20 px-6">
                <div className="container mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {screenshots.map((item, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                viewport={{ once: true }}
                                className="group relative"
                            >
                                <div className="aa-card aspect-video relative group-hover:scale-[1.02] transition-transform duration-500">
                                    <img src={item.src} alt={item.title} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                                        <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                                        <p className="text-sm text-zinc-300">{item.desc}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-20 px-6 bg-[#0c0c0e]">
                <div className="container mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold mb-4">Engineered for the Road</h2>
                        <p className="text-zinc-500">Powerful features optimized for safety and accessibility while driving.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((feature, idx) => (
                            <div key={idx} className="p-8 rounded-[2rem] bg-zinc-900/40 border border-white/5 hover:border-blue-500/50 transition-colors group">
                                <div className="w-12 h-12 bg-blue-600/10 text-blue-500 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                                <p className="text-zinc-400 leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Download CTA */}
            <section className="py-32 px-6 text-center">
                <div className="container mx-auto glass p-12 md:p-24 rounded-[3.5rem] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
                    <h2 className="text-4xl md:text-6xl font-black mb-8">Ready to transform Your Drive?</h2>
                    <p className="text-zinc-400 text-lg mb-12 max-w-xl mx-auto">
                        Get the stable APK build v1.4 and start using the ultimate dashboard on any Android device today.
                    </p>
                    <a
                        href="/androidauto-v1.4.apk"
                        download
                        className="inline-flex items-center gap-3 px-10 py-5 bg-white text-black rounded-[2rem] font-black text-xl hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                    >
                        <Download className="w-6 h-6" />
                        Download APK v1.4
                    </a>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-6 border-t border-white/5 text-center text-zinc-500 text-sm">
                <p>© 2026 Manuka. All rights reserved. Powered by React + Vite.</p>
            </footer>
        </div>
    );
};

export default LandingPage;
