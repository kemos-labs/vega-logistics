# Levered Beta Logistics - Implementation Plan

## Phase 1: Rebranding & Core Structure
- [ ] Rename app from "VEGA Logistics OS" to "Levered Beta Logistics"
- [ ] Rename "Autoclaw" to "Nexus Fleet" (niche, cool name for fleet intelligence)
- [ ] Update all metadata, titles, and branding throughout the app
- [ ] Update package.json and configuration files

## Phase 2: Internationalization (i18n) & Arabic/RTL Support
- [ ] Install i18next and react-i18next
- [ ] Create translation files (en.json, ar.json) with Modern Standard Arabic
- [ ] Implement language switcher in Header
- [ ] Add RTL layout support to Tailwind CSS
- [ ] Update layout.tsx to support dynamic `dir` attribute
- [ ] Update all components with i18n hooks
- [ ] Ensure proper text direction in all UI elements
- [ ] Test RTL rendering for all modules

## Phase 3: Feasibility Study Module
- [ ] Create new "Feasibility Study" tab in Nexus Fleet
- [ ] Implement startup-focused financial modeling
- [ ] Add risk assessment framework
- [ ] Create risk management plan generation
- [ ] Integrate with existing Monte Carlo simulations
- [ ] Add recommendations for new startups

## Phase 4: Export Functionality
- [ ] Install dependencies: jsPDF, xlsx, html-to-canvas
- [ ] Create export utilities for PDF generation
- [ ] Create export utilities for Excel generation
- [ ] Add export buttons to all major modules
- [ ] Implement screenshot/report generation
- [ ] Test export quality and formatting

## Phase 5: Free API Integration
- [ ] Integrate OpenWeatherMap API for weather impact on logistics
- [ ] Integrate Alpha Vantage for commodity price trends (optional)
- [ ] Create data fetching hooks with error handling
- [ ] Add caching to minimize API calls
- [ ] Display real-time data in relevant modules

## Phase 6: UI/UX Improvements
- [ ] Improve dashboard responsiveness
- [ ] Add dark mode enhancements
- [ ] Optimize performance for large datasets
- [ ] Improve accessibility (WCAG 2.1 AA)
- [ ] Add loading states and error boundaries

## Phase 7: Testing & Deployment
- [ ] Test all features in English and Arabic
- [ ] Verify RTL layout on all pages
- [ ] Test export functionality
- [ ] Performance testing
- [ ] Cross-browser testing

## Key Files to Modify
1. src/app/layout.tsx - Add RTL support
2. src/app/globals.css - Add RTL utilities
3. src/components/layout/Header.tsx - Add language switcher
4. src/components/layout/Sidebar.tsx - Update branding
5. src/components/saudi/AutoclawUnified.tsx → Rename to NexusFleet.tsx
6. src/lib/ - Add i18n utilities and export functions
7. package.json - Add new dependencies

## Dependencies to Add
- i18next
- react-i18next
- jspdf
- html2canvas
- xlsx

## Free APIs to Use
- OpenWeatherMap (1000 calls/day free)
- Alpha Vantage (25 requests/day free for commodity data)
