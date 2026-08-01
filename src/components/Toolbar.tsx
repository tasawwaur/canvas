import React, { useState, useEffect, useRef } from 'react';
import { Tool } from '../types';

type ToolbarProps = {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  scale: number;
  activeEmoji?: string;
  onEmojiSelect?: (emoji: string) => void;
};

type ToolGroupInfo = {
  name: string;
  tools: { id: Tool; label: string; icon: React.ReactNode }[];
};

const ICONS = {
  select: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7 18 3-7 7-3-18-8z" /></svg>,
  pan: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 2v7l-2-2m4-5v7l2-2m-8 6H2l2-2m-4 5h7l-2 2m8-6v7l-2-2m4-5v7l2-2m-4-6h7l-2-2m-5 4h7l-2 2" /></svg>,
  line: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20L20 4" /></svg>,
  polyline: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 20l6-6 4 4 6-12" /></svg>,
  rectangle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="6" width="16" height="12" /></svg>,
  circle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8" /></svg>,
  polygon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l9 6-3 11H6l-3-11z" /></svg>,
  freehand: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 15c3-6 7-6 10-2s8-4 8-10" /></svg>,
  plotBoundary: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" strokeDasharray="4 2" /></svg>,
  road: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 22V2M16 22V2M12 22v-4m0-4v-4m0-4V2" /></svg>,
  divider: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h16M12 4v16" /></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14m-5-5l5 5-5 5" /></svg>,
  label: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3M9 20h6M12 4v16" /></svg>,
  point: <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3" /></svg>,
  measure: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 15l4-4 4 4 4-4 6 6" /></svg>,
  gate: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22V2m16 20V2M4 12h16M4 6h16" /></svg>,
  tree: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22v-6m-4-6c0-4 8-4 8 0 0 2-2 3-4 6-2-3-4-4-4-6z" /></svg>,
  pole: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M8 6h8M8 12h8" /></svg>,
  waterTank: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="8" width="12" height="14" rx="2" /><path d="M8 8V6a2 2 0 014 0v2" /></svg>,
  park: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 22v-4a6 6 0 0112 0v4M12 18v-8M9 6a3 3 0 116 0" /></svg>,
  school: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22V10l8-6 8 6v12H4zm8-12v10M8 22v-4m8 4v-4" /></svg>,
  temple: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L4 10h16zM6 10v12h12V10M10 22v-6h4v6" /></svg>,
  mosque: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2c-2 2-4 5-4 8v12h8V10c0-3-2-6-4-8zM4 22v-8c0-2 2-4 4-4M20 22v-8c0-2-2-4-4-4" /></svg>,
  exportCrop: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2v16h16M2 6h16v16" /></svg>,
};

// Complete list of user-provided emojis and custom mapping symbols
const CUSTOM_EMOJIS = [
  { char: "🏡", label: "House" },
  { char: "🏘️", label: "Colony" },
  { char: "🏠", label: "Home" },
  { char: "🏢", label: "Building" },
  { char: "🏬", label: "Commercial" },
  { char: "🏪", label: "Shop" },
  { char: "🏗️", label: "Construction" },
  { char: "🧱", label: "Boundary Wall" },
  { char: "🛣️", label: "Road" },
  { char: "🛤️", label: "Path" },
  { char: "🌳", label: "Tree" },
  { char: "🌴", label: "Garden" },
  { char: "🌿", label: "Green Area" },
  { char: "🌲", label: "Park" },
  { char: "⛲", label: "Water Fountain" },
  { char: "💧", label: "Water" },
  { char: "🚰", label: "Water Tank" },
  { char: "⚡", label: "Electric" },
  { char: "💡", label: "Street Light" },
  { char: "🚧", label: "Development" },
  { char: "🚜", label: "Farm" },
  { char: "🌾", label: "Agriculture" },
  { char: "🪨", label: "Land" },
  { char: "📍", label: "Location" },
  { char: "📌", label: "Plot" },
  { char: "🗺️", label: "Map" },
  { char: "🧭", label: "North" },
  { char: "📐", label: "Measurement" },
  { char: "📏", label: "Scale" },
  { char: "📊", label: "Area" },
  { char: "📈", label: "Growth" },
  { char: "🏞️", label: "Open Land" },
  { char: "🏕️", label: "Site" },
  { char: "🚪", label: "Gate" },
  { char: "🚧", label: "Entry" },
  { char: "🅿️", label: "Parking" },
  { char: "🏥", label: "Hospital" },
  { char: "🏫", label: "School" },
  { char: "🕌", label: "Mosque" },
  { char: "🛕", label: "Temple" },
  { char: "⛪", label: "Church" },
  { char: "🛒", label: "Market" },
  { char: "💼", label: "Property Dealer" },
  { char: "🤝", label: "Deal" },
  { char: "💰", label: "Price" },
  { char: "💵", label: "Payment" },
  { char: "💎", label: "Premium Plot" },
  { char: "⭐", label: "VIP Plot" },
  { char: "👤", label: "Owner" },
  { char: "👥", label: "Customer" },
  { char: "📞", label: "Contact" },
  { char: "📱", label: "Mobile" },
  { char: "📄", label: "Registry" },
  { char: "📝", label: "Agreement" },
  { char: "📂", label: "Documents" },
  { char: "🗃️", label: "Records" },
  { char: "🖨️", label: "Print" },
  { char: "📤", label: "Export" },
  { char: "💾", label: "Save" },
  { char: "🔍", label: "Search" },
  { char: "🎯", label: "Selected Plot" },
  { char: "✅", label: "Available" },
  { char: "❌", label: "Sold" },
  { char: "🔒", label: "Reserved" },
  { char: "🟢", label: "Available Plot" },
  { char: "🟡", label: "Booked Plot" },
  { char: "🔴", label: "Sold Plot" },
  { char: "🚗", label: "Car Parking" },
  { char: "🚌", label: "Bus Stop" },
  { char: "🚦", label: "Junction" },
  { char: "🌉", label: "Bridge" },
  { char: "🏖️", label: "Open Space" },
  { char: "🎡", label: "Recreation" }
];

const GROUPS: ToolGroupInfo[] = [
  {
    name: 'Navigate',
    tools: [
      { id: 'select', label: 'Select', icon: ICONS.select },
      { id: 'pan', label: 'Pan', icon: ICONS.pan },
      { id: 'exportCrop', label: 'Crop Export Area', icon: ICONS.exportCrop },
    ],
  },
  {
    name: 'Draw',
    tools: [
      { id: 'line', label: 'Line', icon: ICONS.line },
      { id: 'polyline', label: 'Polyline', icon: ICONS.polyline },
      { id: 'rectangle', label: 'Rectangle', icon: ICONS.rectangle },
      { id: 'circle', label: 'Circle', icon: ICONS.circle },
      { id: 'polygon', label: 'Polygon', icon: ICONS.polygon },
      { id: 'freehand', label: 'Freehand', icon: ICONS.freehand },
    ],
  },
  {
    name: 'Property',
    tools: [
      { id: 'plotBoundary', label: 'Plot Boundary', icon: ICONS.plotBoundary },
      { id: 'road', label: 'Road', icon: ICONS.road },
      { id: 'divider', label: 'Divider', icon: ICONS.divider },
      { id: 'arrow', label: 'Arrow', icon: ICONS.arrow },
    ],
  },
  {
    name: 'Annotate',
    tools: [
      { id: 'label', label: 'Label', icon: ICONS.label },
      { id: 'point', label: 'Survey Point', icon: ICONS.point },
      { id: 'measure', label: 'Measure', icon: ICONS.measure },
    ],
  },
  {
    name: 'Symbols',
    tools: [
      { id: 'gate', label: 'Gate', icon: ICONS.gate },
      { id: 'tree', label: 'Tree', icon: ICONS.tree },
      { id: 'pole', label: 'Pole', icon: ICONS.pole },
      { id: 'waterTank', label: 'Water Tank', icon: ICONS.waterTank },
      { id: 'park', label: 'Park', icon: ICONS.park },
      { id: 'school', label: 'School', icon: ICONS.school },
      { id: 'temple', label: 'Temple', icon: ICONS.temple },
      { id: 'mosque', label: 'Mosque', icon: ICONS.mosque },
      { id: 'emoji', label: 'Emoji Symbols', icon: null } // Rendered dynamically
    ],
  },
];

export const Toolbar: React.FC<ToolbarProps> = ({ tool, onToolChange, scale, activeEmoji = '🏡', onEmojiSelect }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredLabel, setHoveredLabel] = useState('Select an emoji');
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Position calculation to bypass toolbar overflow-x clipping
  useEffect(() => {
    if (showPicker && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 6,
        left: Math.min(rect.left + window.scrollX, window.innerWidth - 340) // Keep on screen
      });
    }
  }, [showPicker]);

  // Filter emojis based on search query
  const filteredEmojis = CUSTOM_EMOJIS.filter(e => 
    e.char.includes(searchQuery) ||
    e.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // If tool changes from emoji, close the picker
  useEffect(() => {
    if (tool !== 'emoji') {
      setShowPicker(false);
    }
  }, [tool]);

  // Handle clicking outside to close the picker
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showPicker && !target.closest('.emoji-picker-container') && !target.closest('.emoji-picker-popover')) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showPicker]);

  // Helper to focus a tool button programmatically
  const focusToolButton = (toolId: Tool) => {
    setTimeout(() => {
      const el = document.getElementById(`tool-btn-${toolId}`);
      if (el) el.focus();
    }, 10);
  };

  // Keyboard navigation for tools inside the toolbar (Left/Right arrow cycles tools, Up/Down cycles groups)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Check if user is typing in the search bar of the emoji picker or text label prompt
    const target = e.target as HTMLElement;
    if (target.tagName.toLowerCase() === 'input' || target.tagName.toLowerCase() === 'textarea') {
      return; // Do not hijack search input navigation keys
    }

    const allTools: Tool[] = [];
    GROUPS.forEach(g => {
      g.tools.forEach(t => {
        allTools.push(t.id);
      });
    });

    const currentIndex = allTools.indexOf(tool);
    if (currentIndex === -1) return;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % allTools.length;
      const nextTool = allTools[nextIndex];
      onToolChange(nextTool);
      focusToolButton(nextTool);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + allTools.length) % allTools.length;
      const prevTool = allTools[prevIndex];
      onToolChange(prevTool);
      focusToolButton(prevTool);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      // Move to the next group
      let currentGroupIdx = GROUPS.findIndex(g => g.tools.some(t => t.id === tool));
      if (currentGroupIdx !== -1) {
        const nextGroupIdx = (currentGroupIdx + 1) % GROUPS.length;
        const nextTool = GROUPS[nextGroupIdx].tools[0].id;
        onToolChange(nextTool);
        focusToolButton(nextTool);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      // Move to the previous group
      let currentGroupIdx = GROUPS.findIndex(g => g.tools.some(t => t.id === tool));
      if (currentGroupIdx !== -1) {
        const prevGroupIdx = (currentGroupIdx - 1 + GROUPS.length) % GROUPS.length;
        const nextTool = GROUPS[prevGroupIdx].tools[0].id;
        onToolChange(nextTool);
        focusToolButton(nextTool);
      }
    }
  };

  return (
    <div className="toolbar" onKeyDown={handleKeyDown}>
      {GROUPS.map((group, i) => (
        <React.Fragment key={group.name}>
          <div className="tool-group">
            {group.tools.map((t) => {
              const isEmoji = t.id === 'emoji';
              const icon = isEmoji ? (
                <span style={{ fontSize: '17px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{activeEmoji}</span>
              ) : t.icon;
              const isActive = tool === t.id;

              const btn = (
                <button
                  key={t.id}
                  id={`tool-btn-${t.id}`}
                  ref={isEmoji ? buttonRef : undefined}
                  className={`tool-btn ${isActive ? 'tool-btn-active' : ''}`}
                  onClick={() => {
                    if (isEmoji) {
                      onToolChange('emoji');
                      setShowPicker(!showPicker);
                    } else {
                      onToolChange(t.id);
                      setShowPicker(false);
                    }
                  }}
                  title={t.label}
                  style={isEmoji ? { 
                    border: '1px dashed #f59e0b', 
                    background: 'rgba(245, 158, 11, 0.08)', 
                    width: 'auto', 
                    padding: '0 8px', 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  } : undefined}
                >
                  {icon}
                  {isEmoji && <span style={{ fontSize: '11px', fontWeight: 600, color: '#f59e0b', userSelect: 'none' }}>Custom Emojis</span>}
                  <span className="tool-tooltip">{t.label}</span>
                </button>
              );

              if (isEmoji) {
                return (
                  <div key={t.id} className="emoji-picker-container" style={{ display: 'inline-block', position: 'relative' }}>
                    {btn}
                    {showPicker && (
                      <div 
                        className="emoji-picker-popover"
                        style={{
                          position: 'fixed',
                          top: `${coords.top}px`,
                          left: `${coords.left}px`,
                          zIndex: 9999
                        }}
                      >
                        <div className="emoji-picker-header">🗺️ Map Symbols & Emojis</div>
                        <input
                          type="text"
                          placeholder="Search emoji (e.g. plot, road)..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="emoji-picker-search"
                          autoFocus
                        />
                        <div className="emoji-picker-categories" style={{ maxHeight: '250px' }}>
                          <div className="emoji-grid">
                            {filteredEmojis.map((em, idx) => (
                              <button
                                key={`${em.char}-${idx}`}
                                className={`emoji-item-btn ${activeEmoji === em.char ? 'emoji-item-btn-active' : ''}`}
                                onMouseEnter={() => setHoveredLabel(em.label)}
                                onMouseLeave={() => setHoveredLabel(em.label)}
                                onClick={() => {
                                  if (onEmojiSelect) onEmojiSelect(em.char);
                                  setShowPicker(false); // Close picker after select
                                }}
                              >
                                {em.char}
                              </button>
                            ))}
                            {filteredEmojis.length === 0 && (
                              <div style={{ gridColumn: 'span 7', padding: '10px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                                No emojis found
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="emoji-picker-footer">
                          🏷️ {hoveredLabel || 'Hover over an emoji'}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return btn;
            })}
          </div>
          {i < GROUPS.length - 1 && <div className="tool-separator" />}
        </React.Fragment>
      ))}
    </div>
  );
};
