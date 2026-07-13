"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
// Import Phosphor Icons
import {
  Sparkle as PhSparkles,
  Cpu as PhCpu,
  House as PhHouse,
  User as PhUser,
  Gear as PhGear,
  ArrowRight as PhArrowRight,
  Lock as PhLock,
  Compass as PhCompass,
} from "@phosphor-icons/react";

// Import Lucide Icons
import {
  Sparkles as LuSparkles,
  Cpu as LuCpu,
  Home as LuHome,
  User as LuUser,
  Settings as LuSettings,
  ArrowRight as LuArrowRight,
  Lock as LuLock,
  Compass as LuCompass,
  Search as LuSearch,
  Check as LuCheck,
  Copy as LuCopy,
  Info as LuInfo,
  SlidersHorizontal as LuSliders,
  LayoutDashboard as LuLayout,
} from "lucide-react";

// Import Radix Icons
import {
  BlendingModeIcon as RxBlendingMode,
  ActivityLogIcon as RxActivityLog,
  HomeIcon as RxHome,
  PersonIcon as RxPerson,
  GearIcon as RxGear,
  ArrowRightIcon as RxArrowRight,
  LockClosedIcon as RxLock,
  DrawingPinIcon as RxDrawingPin,
} from "@radix-ui/react-icons";

// Import Heroicons
import {
  SparklesIcon as HiSparkles,
  CpuChipIcon as HiCpu,
  HomeIcon as HiHome,
  UserIcon as HiUser,
  Cog8ToothIcon as HiGear,
  ArrowRightIcon as HiArrowRight,
  LockClosedIcon as HiLock,
  MapIcon as HiCompass,
} from "@heroicons/react/24/outline";

// Define the Icon item interface
interface IconItem {
  id: string;
  name: string;
  category: "Navigation" | "Actions" | "System" | "Design";
  library: "Phosphor" | "Lucide" | "Radix" | "Heroicons";
  importPath: string;
  usage: string;
  component: React.ComponentType<any>;
}

export default function Home() {
  // Preset Icon definitions
  const icons: IconItem[] = [
    // Phosphor Icons
    {
      id: "ph-sparkles",
      name: "Sparkles",
      category: "Design",
      library: "Phosphor",
      importPath: `import { Sparkles } from "@phosphor-icons/react";`,
      usage: "<Sparkles size={24} weight=\"regular\" />",
      component: PhSparkles,
    },
    {
      id: "ph-cpu",
      name: "CPU",
      category: "System",
      library: "Phosphor",
      importPath: `import { Cpu } from "@phosphor-icons/react";`,
      usage: "<Cpu size={24} weight=\"regular\" />",
      component: PhCpu,
    },
    {
      id: "ph-house",
      name: "House",
      category: "Navigation",
      library: "Phosphor",
      importPath: `import { House } from "@phosphor-icons/react";`,
      usage: "<House size={24} weight=\"regular\" />",
      component: PhHouse,
    },
    {
      id: "ph-user",
      name: "User",
      category: "Actions",
      library: "Phosphor",
      importPath: `import { User } from "@phosphor-icons/react";`,
      usage: "<User size={24} weight=\"regular\" />",
      component: PhUser,
    },
    {
      id: "ph-gear",
      name: "Gear",
      category: "System",
      library: "Phosphor",
      importPath: `import { Gear } from "@phosphor-icons/react";`,
      usage: "<Gear size={24} weight=\"regular\" />",
      component: PhGear,
    },
    {
      id: "ph-arrowright",
      name: "Arrow Right",
      category: "Navigation",
      library: "Phosphor",
      importPath: `import { ArrowRight } from "@phosphor-icons/react";`,
      usage: "<ArrowRight size={24} weight=\"regular\" />",
      component: PhArrowRight,
    },
    {
      id: "ph-lock",
      name: "Lock",
      category: "System",
      library: "Phosphor",
      importPath: `import { Lock } from "@phosphor-icons/react";`,
      usage: "<Lock size={24} weight=\"regular\" />",
      component: PhLock,
    },
    {
      id: "ph-compass",
      name: "Compass",
      category: "Navigation",
      library: "Phosphor",
      importPath: `import { Compass } from "@phosphor-icons/react";`,
      usage: "<Compass size={24} weight=\"regular\" />",
      component: PhCompass,
    },
    // Lucide Icons
    {
      id: "lu-sparkles",
      name: "Sparkles",
      category: "Design",
      library: "Lucide",
      importPath: `import { Sparkles } from "lucide-react";`,
      usage: "<Sparkles size={24} strokeWidth={2} />",
      component: LuSparkles,
    },
    {
      id: "lu-cpu",
      name: "CPU",
      category: "System",
      library: "Lucide",
      importPath: `import { Cpu } from "lucide-react";`,
      usage: "<Cpu size={24} strokeWidth={2} />",
      component: LuCpu,
    },
    {
      id: "lu-home",
      name: "Home",
      category: "Navigation",
      library: "Lucide",
      importPath: `import { Home } from "lucide-react";`,
      usage: "<Home size={24} strokeWidth={2} />",
      component: LuHome,
    },
    {
      id: "lu-user",
      name: "User",
      category: "Actions",
      library: "Lucide",
      importPath: `import { User } from "lucide-react";`,
      usage: "<User size={24} strokeWidth={2} />",
      component: LuUser,
    },
    {
      id: "lu-settings",
      name: "Settings",
      category: "System",
      library: "Lucide",
      importPath: `import { Settings } from "lucide-react";`,
      usage: "<Settings size={24} strokeWidth={2} />",
      component: LuSettings,
    },
    {
      id: "lu-arrowright",
      name: "Arrow Right",
      category: "Navigation",
      library: "Lucide",
      importPath: `import { ArrowRight } from "lucide-react";`,
      usage: "<ArrowRight size={24} strokeWidth={2} />",
      component: LuArrowRight,
    },
    {
      id: "lu-lock",
      name: "Lock",
      category: "System",
      library: "Lucide",
      importPath: `import { Lock } from "lucide-react";`,
      usage: "<Lock size={24} strokeWidth={2} />",
      component: LuLock,
    },
    {
      id: "lu-compass",
      name: "Compass",
      category: "Navigation",
      library: "Lucide",
      importPath: `import { Compass } from "lucide-react";`,
      usage: "<Compass size={24} strokeWidth={2} />",
      component: LuCompass,
    },
    // Radix Icons
    {
      id: "rx-blendingmode",
      name: "Blending Mode",
      category: "Design",
      library: "Radix",
      importPath: `import { BlendingModeIcon } from "@radix-ui/react-icons";`,
      usage: "<BlendingModeIcon width={24} height={24} />",
      component: RxBlendingMode,
    },
    {
      id: "rx-activitylog",
      name: "Activity Log",
      category: "System",
      library: "Radix",
      importPath: `import { ActivityLogIcon } from "@radix-ui/react-icons";`,
      usage: "<ActivityLogIcon width={24} height={24} />",
      component: RxActivityLog,
    },
    {
      id: "rx-home",
      name: "Home",
      category: "Navigation",
      library: "Radix",
      importPath: `import { HomeIcon } from "@radix-ui/react-icons";`,
      usage: "<HomeIcon width={24} height={24} />",
      component: RxHome,
    },
    {
      id: "rx-person",
      name: "Person",
      category: "Actions",
      library: "Radix",
      importPath: `import { PersonIcon } from "@radix-ui/react-icons";`,
      usage: "<PersonIcon width={24} height={24} />",
      component: RxPerson,
    },
    {
      id: "rx-gear",
      name: "Gear",
      category: "System",
      library: "Radix",
      importPath: `import { GearIcon } from "@radix-ui/react-icons";`,
      usage: "<GearIcon width={24} height={24} />",
      component: RxGear,
    },
    {
      id: "rx-arrowright",
      name: "Arrow Right",
      category: "Navigation",
      library: "Radix",
      importPath: `import { ArrowRightIcon } from "@radix-ui/react-icons";`,
      usage: "<ArrowRightIcon width={24} height={24} />",
      component: RxArrowRight,
    },
    {
      id: "rx-lock",
      name: "Lock Closed",
      category: "System",
      library: "Radix",
      importPath: `import { LockClosedIcon } from "@radix-ui/react-icons";`,
      usage: "<LockClosedIcon width={24} height={24} />",
      component: RxLock,
    },
    {
      id: "rx-drawingpin",
      name: "Drawing Pin",
      category: "Actions",
      library: "Radix",
      importPath: `import { DrawingPinIcon } from "@radix-ui/react-icons";`,
      usage: "<DrawingPinIcon width={24} height={24} />",
      component: RxDrawingPin,
    },
    // Heroicons
    {
      id: "hi-sparkles",
      name: "Sparkles",
      category: "Design",
      library: "Heroicons",
      importPath: `import { SparklesIcon } from "@heroicons/react/24/outline";`,
      usage: "<SparklesIcon className=\"w-6 h-6\" />",
      component: HiSparkles,
    },
    {
      id: "hi-cpu",
      name: "CPU Chip",
      category: "System",
      library: "Heroicons",
      importPath: `import { CpuChipIcon } from "@heroicons/react/24/outline";`,
      usage: "<CpuChipIcon className=\"w-6 h-6\" />",
      component: HiCpu,
    },
    {
      id: "hi-home",
      name: "Home",
      category: "Navigation",
      library: "Heroicons",
      importPath: `import { HomeIcon } from "@heroicons/react/24/outline";`,
      usage: "<HomeIcon className=\"w-6 h-6\" />",
      component: HiHome,
    },
    {
      id: "hi-user",
      name: "User",
      category: "Actions",
      library: "Heroicons",
      importPath: `import { UserIcon } from "@heroicons/react/24/outline";`,
      usage: "<UserIcon className=\"w-6 h-6\" />",
      component: HiUser,
    },
    {
      id: "hi-gear",
      name: "Cog 8 Tooth",
      category: "System",
      library: "Heroicons",
      importPath: `import { Cog8ToothIcon } from "@heroicons/react/24/outline";`,
      usage: "<Cog8ToothIcon className=\"w-6 h-6\" />",
      component: HiGear,
    },
    {
      id: "hi-arrowright",
      name: "Arrow Right",
      category: "Navigation",
      library: "Heroicons",
      importPath: `import { ArrowRightIcon } from "@heroicons/react/24/outline";`,
      usage: "<ArrowRightIcon className=\"w-6 h-6\" />",
      component: HiArrowRight,
    },
    {
      id: "hi-lock",
      name: "Lock Closed",
      category: "System",
      library: "Heroicons",
      importPath: `import { LockClosedIcon } from "@heroicons/react/24/outline";`,
      usage: "<LockClosedIcon className=\"w-6 h-6\" />",
      component: HiLock,
    },
    {
      id: "hi-compass",
      name: "Map (Compass Alt)",
      category: "Navigation",
      library: "Heroicons",
      importPath: `import { MapIcon } from "@heroicons/react/24/outline";`,
      usage: "<MapIcon className=\"w-6 h-6\" />",
      component: HiCompass,
    },
  ];

  // States
  const [selectedLibrary, setSelectedLibrary] = useState<string>("All");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [iconSize, setIconSize] = useState<number>(28);
  const [strokeWidth, setStrokeWidth] = useState<number>(2);
  const [iconColor, setIconColor] = useState<{ name: string; hex: string }>({
    name: "Violet Glow",
    hex: "#a78bfa",
  });
  const [selectedIcon, setSelectedIcon] = useState<IconItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<string | null>(null); // "import" or "usage"

  // Color options
  const colorOptions = [
    { name: "Default White", hex: "#f4f4f5" },
    { name: "Violet Glow", hex: "#a78bfa" },
    { name: "Cyan Ice", hex: "#67e8f9" },
    { name: "Emerald Emerald", hex: "#6ee7b7" },
    { name: "Rose Gold", hex: "#fda4af" },
    { name: "Amber Sparks", hex: "#fcd34d" },
  ];

  // Filtered icons
  const filteredIcons = icons.filter((icon) => {
    const matchesLibrary =
      selectedLibrary === "All" || icon.library === selectedLibrary;
    const matchesCategory =
      selectedCategory === "All" || icon.category === selectedCategory;
    const matchesSearch =
      icon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      icon.library.toLowerCase().includes(searchQuery.toLowerCase()) ||
      icon.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLibrary && matchesCategory && matchesSearch;
  });

  // Toast handler
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  // Clipboard copy helper
  const copyToClipboard = (text: string, type: "import" | "usage") => {
    navigator.clipboard.writeText(text);
    setIsCopied(type);
    triggerToast(`Copied ${type === "import" ? "import statement" : "JSX usage"} to clipboard!`);
    setTimeout(() => {
      setIsCopied(null);
    }, 1500);
  };

  // Select an initial icon
  useEffect(() => {
    if (icons.length > 0 && !selectedIcon) {
      setSelectedIcon(icons[0]);
    }
  }, []);

  // Helper to render icon component with active states
  const renderIconComponent = (icon: IconItem, customSize?: number) => {
    const Component = icon.component;
    const size = customSize || iconSize;

    if (icon.library === "Phosphor") {
      let weight: "light" | "regular" | "bold" = "regular";
      if (strokeWidth === 1) weight = "light";
      if (strokeWidth === 3) weight = "bold";
      return <Component size={size} weight={weight} color={iconColor.hex} className="transition-all duration-300" />;
    }

    if (icon.library === "Lucide") {
      return <Component size={size} strokeWidth={strokeWidth} color={iconColor.hex} className="transition-all duration-300" />;
    }

    if (icon.library === "Radix") {
      return (
        <Component
          style={{ width: `${size}px`, height: `${size}px`, color: iconColor.hex }}
          className="transition-all duration-300"
        />
      );
    }

    if (icon.library === "Heroicons") {
      return (
        <Component
          style={{ width: `${size}px`, height: `${size}px`, color: iconColor.hex }}
          strokeWidth={strokeWidth}
          className="transition-all duration-300"
        />
      );
    }

    return null;
  };

  const getLibraryBrandColor = (lib: string) => {
    switch (lib) {
      case "Phosphor":
        return "from-amber-500/20 to-amber-600/5 border-amber-500/30 text-amber-300";
      case "Lucide":
        return "from-violet-500/20 to-violet-600/5 border-violet-500/30 text-violet-300";
      case "Radix":
        return "from-rose-500/20 to-rose-600/5 border-rose-500/30 text-rose-300";
      case "Heroicons":
        return "from-cyan-500/20 to-cyan-600/5 border-cyan-500/30 text-cyan-300";
      default:
        return "from-zinc-500/20 to-zinc-600/5 border-zinc-500/30 text-zinc-300";
    }
  };

  const getLibraryBorderColorHover = (lib: string) => {
    switch (lib) {
      case "Phosphor":
        return "hover:border-amber-500/50 hover:shadow-amber-500/5";
      case "Lucide":
        return "hover:border-violet-500/50 hover:shadow-violet-500/5";
      case "Radix":
        return "hover:border-rose-500/50 hover:shadow-rose-500/5";
      case "Heroicons":
        return "hover:border-cyan-500/50 hover:shadow-cyan-500/5";
      default:
        return "hover:border-zinc-500/50";
    }
  };

  return (
    <div className="flex-1 w-full min-h-screen bg-zinc-950 text-zinc-100 flex flex-col relative">
      
      {/* Decorative Glows */}
      <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] rounded-full bg-cyan-600/5 blur-[100px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="DiaPalace Logo"
            width={38}
            height={38}
            className="object-contain"
            priority
          />
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-50 via-zinc-100 to-zinc-400">
              DiaPalace <span className="text-sm font-semibold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-cyan-400">Icon Studio</span>
            </h1>
            <p className="text-xs text-zinc-500">Premium design library integration</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Phosphor
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
            Lucide
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Radix
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            Heroicons
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-8 relative z-10">
        
        {/* Intro Hero Section */}
        <section className="glass-panel rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-violet-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col gap-3 max-w-xl text-center md:text-left">
            <div className="inline-flex self-center md:self-start px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/20">
              Next.js + Bun Project Active
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
              Sharp & Elegant <br className="hidden sm:inline" />
              Icon Library Showcase
            </h2>
            <p className="text-zinc-400 text-sm md:text-base leading-relaxed">
              Explore the four high-end icon sets selected for maximum UI sharpness. Adjust properties in real-time, copy clean import structures, and view render quality.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 w-full md:w-auto min-w-[280px]">
            <div 
              onClick={() => setSelectedLibrary("Phosphor")}
              className="glass-panel p-4 rounded-2xl flex flex-col justify-between h-24 hover:bg-zinc-900/60 cursor-pointer transition-all border border-zinc-800/80 hover:border-amber-500/30 group"
            >
              <div className="text-zinc-500 text-xs font-medium group-hover:text-amber-400 transition-colors">Phosphor Set</div>
              <div className="text-2xl font-bold text-white flex items-center justify-between">
                <span>8</span>
                <PhSparkles className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div 
              onClick={() => setSelectedLibrary("Lucide")}
              className="glass-panel p-4 rounded-2xl flex flex-col justify-between h-24 hover:bg-zinc-900/60 cursor-pointer transition-all border border-zinc-800/80 hover:border-violet-500/30 group"
            >
              <div className="text-zinc-500 text-xs font-medium group-hover:text-violet-400 transition-colors">Lucide Set</div>
              <div className="text-2xl font-bold text-white flex items-center justify-between">
                <span>8</span>
                <LuSparkles className="w-5 h-5 text-violet-400" />
              </div>
            </div>
            <div 
              onClick={() => setSelectedLibrary("Radix")}
              className="glass-panel p-4 rounded-2xl flex flex-col justify-between h-24 hover:bg-zinc-900/60 cursor-pointer transition-all border border-zinc-800/80 hover:border-rose-500/30 group"
            >
              <div className="text-zinc-500 text-xs font-medium group-hover:text-rose-400 transition-colors">Radix Set</div>
              <div className="text-2xl font-bold text-white flex items-center justify-between">
                <span>8</span>
                <RxBlendingMode className="w-5 h-5 text-rose-400" />
              </div>
            </div>
            <div 
              onClick={() => setSelectedLibrary("Heroicons")}
              className="glass-panel p-4 rounded-2xl flex flex-col justify-between h-24 hover:bg-zinc-900/60 cursor-pointer transition-all border border-zinc-800/80 hover:border-cyan-500/30 group"
            >
              <div className="text-zinc-500 text-xs font-medium group-hover:text-cyan-400 transition-colors">Heroicons Set</div>
              <div className="text-2xl font-bold text-white flex items-center justify-between">
                <span>8</span>
                <HiSparkles className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard Grid and Customizer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left panel: Filters, Search, Icon Grid (8 columns) */}
          <div className="lg:col-span-8 flex flex-col gap-6 w-full">
            
            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-zinc-900/40 border border-zinc-900 p-4 rounded-2xl">
              
              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search icons..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl py-2 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              {/* Library filter tabs */}
              <div className="flex gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800/60 overflow-x-auto no-scrollbar w-full sm:w-auto">
                {["All", "Phosphor", "Lucide", "Radix", "Heroicons"].map((lib) => (
                  <button
                    key={lib}
                    onClick={() => setSelectedLibrary(lib)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedLibrary === lib
                        ? "bg-zinc-800 text-white shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {lib}
                  </button>
                ))}
              </div>
            </div>

            {/* Category selection */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {["All", "Navigation", "Actions", "System", "Design"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 ${
                    selectedCategory === cat
                      ? "bg-violet-600/10 border-violet-500/30 text-violet-300"
                      : "bg-zinc-950/40 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:border-zinc-800"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Icon Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredIcons.length > 0 ? (
                filteredIcons.map((icon) => {
                  const isSelected = selectedIcon?.id === icon.id;
                  return (
                    <div
                      key={icon.id}
                      onClick={() => setSelectedIcon(icon)}
                      className={`glass-panel p-5 rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 ${
                        isSelected
                          ? "border-violet-500/60 bg-violet-600/[0.04] shadow-lg shadow-violet-500/[0.02]"
                          : "border-zinc-800/80 bg-zinc-900/20"
                      } ${getLibraryBorderColorHover(icon.library)}`}
                    >
                      <div className="h-16 flex items-center justify-center">
                        {renderIconComponent(icon, 32)}
                      </div>
                      <div className="flex flex-col items-center gap-1.5 w-full">
                        <span className="text-xs font-semibold text-zinc-200 text-center truncate w-full">
                          {icon.name}
                        </span>
                        <div className="flex items-center justify-between w-full mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r border font-medium ${getLibraryBrandColor(icon.library)}`}>
                            {icon.library}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-medium">
                            {icon.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-16 text-center text-zinc-500 text-sm glass-panel rounded-2xl">
                  No icons found matching your filters.
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Live Customizer and Code Inspector (4 columns) */}
          <div className="lg:col-span-4 flex flex-col gap-6 w-full">
            
            {/* Customizer Settings Card */}
            <div className="glass-panel p-6 rounded-3xl shadow-xl flex flex-col gap-6 border border-zinc-800/50">
              <div className="flex items-center gap-2 border-b border-zinc-900 pb-4">
                <LuSliders className="w-4 h-4 text-violet-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live Customizer</h3>
              </div>

              {/* Slider for Size */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-400">Icon Size</span>
                  <span className="text-violet-400">{iconSize}px</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="48"
                  value={iconSize}
                  onChange={(e) => setIconSize(Number(e.target.value))}
                  className="w-full accent-violet-500 h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Slider for Stroke Width */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-400">Stroke Weight</span>
                  <span className="text-violet-400">{strokeWidth}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="1"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(Number(e.target.value))}
                  className="w-full accent-violet-500 h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer"
                />
                <p className="text-[10px] text-zinc-500">Applies to Lucide, Heroicons, and Phosphor weight states.</p>
              </div>

              {/* Color Customizer */}
              <div className="flex flex-col gap-3">
                <span className="text-zinc-400 text-xs font-semibold">Glow Color Variant</span>
                <div className="grid grid-cols-6 gap-2">
                  {colorOptions.map((opt) => (
                    <button
                      key={opt.name}
                      onClick={() => setIconColor(opt)}
                      title={opt.name}
                      style={{ backgroundColor: opt.hex }}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        iconColor.hex === opt.hex
                          ? "border-white scale-110 shadow-lg"
                          : "border-transparent hover:scale-105"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                  Active Hex: <span className="text-zinc-300">{iconColor.hex}</span>
                </span>
              </div>
            </div>

            {/* Selected Icon details / Code Copy Card */}
            {selectedIcon ? (
              <div className="glass-panel p-6 rounded-3xl shadow-xl flex flex-col gap-6 border border-zinc-800/50">
                <div className="flex items-center gap-2 border-b border-zinc-900 pb-4">
                  <LuInfo className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Icon Inspector</h3>
                </div>

                {/* Big Preview Box */}
                <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-zinc-950 border border-zinc-900 relative group overflow-hidden">
                  <div className="absolute top-2 right-2 text-[10px] font-semibold text-zinc-600">Preview</div>
                  <div className="relative z-10 flex items-center justify-center h-24 w-24 rounded-full bg-zinc-900/40 border border-zinc-800/40 shadow-inner group-hover:scale-105 transition-transform duration-300">
                    {renderIconComponent(selectedIcon, Math.max(36, iconSize))}
                  </div>
                </div>

                {/* Info Metadata */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-950/40 p-3 rounded-xl border border-zinc-900">
                  <div>
                    <div className="text-zinc-500 font-medium">Icon Name</div>
                    <div className="text-zinc-200 font-semibold">{selectedIcon.name}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 font-medium">Source Package</div>
                    <div className="text-zinc-200 font-semibold">{selectedIcon.library}</div>
                  </div>
                </div>

                {/* Import Statement Box */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-zinc-400">1. ES6 Import Code</span>
                    <button
                      onClick={() => copyToClipboard(selectedIcon.importPath, "import")}
                      className="text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                    >
                      {isCopied === "import" ? (
                        <>
                          <LuCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 text-[11px]">Copied</span>
                        </>
                      ) : (
                        <>
                          <LuCopy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-3 font-mono text-[11px] text-zinc-300 overflow-x-auto whitespace-pre no-scrollbar">
                    {selectedIcon.importPath}
                  </div>
                </div>

                {/* JSX Usage Box */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-zinc-400">2. Component JSX Usage</span>
                    <button
                      onClick={() => copyToClipboard(selectedIcon.usage, "usage")}
                      className="text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                    >
                      {isCopied === "usage" ? (
                        <>
                          <LuCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 text-[11px]">Copied</span>
                        </>
                      ) : (
                        <>
                          <LuCopy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-3 font-mono text-[11px] text-zinc-300 overflow-x-auto whitespace-pre no-scrollbar">
                    {selectedIcon.usage}
                  </div>
                </div>
              </div>
            ) : null}

          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="w-full py-6 mt-12 border-t border-zinc-900 text-center text-xs text-zinc-600 relative z-10 bg-zinc-950">
        <p>© 2026 DiaPalace Icon Studio. Powered by Next.js, Bun, Phosphor Icons, Lucide React, Radix, and Heroicons.</p>
      </footer>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-zinc-900 border border-violet-500/30 text-zinc-100 shadow-2xl shadow-violet-500/10 animate-fade-in-up duration-300 text-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
