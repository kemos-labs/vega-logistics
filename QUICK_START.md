# Levered Beta Logistics - Quick Start Guide

## 🚀 Getting Started

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser
# Navigate to http://localhost:3000
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

---

## 🌍 Language & RTL Support

### Switch Language

1. **Click the language switcher** in the top-right corner of the header
2. **Select EN or العربية** (Arabic)
3. **Page reloads** with the selected language
4. **Your preference is saved** automatically

### Features

- **English (EN)**: Professional, modern interface with Inter font
- **Arabic (AR)**: Modern Standard Arabic with Cairo font, full RTL layout
- **Persistent**: Language choice saved in localStorage
- **Automatic RTL**: Layout automatically adjusts for Arabic

---

## 📊 Core Modules

### 1. Command Center (Executive Dashboard)
- Real-time KPIs and financial metrics
- Fleet status overview
- Ghost Growth Index
- Financial snapshot

**Access**: Click "Command Center" in sidebar or press `⌘1`

### 2. Nexus Fleet (Fleet Intelligence)
- Rented fleet cost analysis
- Break-even calculations
- Zone management
- Driver optimization
- Monte Carlo simulations
- Investor metrics

**Access**: Click "Nexus Fleet" in sidebar or press `⌘2`

### 3. Ghost Growth Detection
- Growth anomaly detection
- 6-month trend analysis
- Risk indicators
- Operational density insights

**Access**: Click "Ghost Growth" in sidebar or press `⌘3`

### 4. Fleet Operations Map
- Real-time vehicle tracking
- Zone visualization
- Vehicle details and status
- Route optimization

**Access**: Click "Fleet Map" in sidebar or press `⌘4`

### 5. Risk Management
- Advanced risk assessment
- Financial stress testing
- Scenario analysis
- Risk mitigation strategies

**Access**: Click "Risk Manager" in sidebar or press `⌘5`

### 6. 3D Risk Analytics
- 3D surface visualization
- Multi-dimensional risk analysis
- Interactive data exploration

**Access**: Click "3D Analytics" in sidebar or press `⌘6`

### 7. Feasibility Study (NEW!)
- Startup risk assessment
- Financial projections (24 months)
- Capital requirements
- Risk management plan
- Export to PDF/Excel

**Access**: Click "Feasibility Study" in sidebar

---

## 📈 Feasibility Study Module

### Purpose
Comprehensive startup analysis tool for new logistics ventures in Saudi Arabia.

### How to Use

1. **Navigate** to "Feasibility Study" module
2. **Adjust Parameters** in the left panel:
   - Fleet size and van costs
   - Monthly operating expenses
   - Revenue expectations
   - Delivery targets
3. **View Real-Time Results**:
   - Break-even timeline
   - Payback period
   - Profitability score
   - Risk assessment
4. **Review Recommendations** for optimization
5. **Export Report**:
   - Click "Export to PDF" for comprehensive report
   - Click "Export to Excel" for financial data

### Key Metrics

| Metric | Meaning |
|--------|---------|
| Break-Even Months | Time to reach profitability |
| Payback Period | Months to recover initial investment |
| Profitability Score | 0-100 viability rating |
| Risk Level | Low / Medium / High / Critical |

### Risk Factors Analyzed

- Market demand sustainability
- Profitability adequacy
- Investment recovery timeline
- Capital reserve sufficiency
- Driver availability & retention
- Market competition
- Regulatory compliance

---

## 💾 Export Features

### PDF Export

```
1. Navigate to any module with export capability
2. Click "Export to PDF" button
3. File downloads automatically as "report.pdf"
4. Opens in your default PDF viewer
```

### Excel Export

```
1. Navigate to Feasibility Study or data module
2. Click "Export to Excel" button
3. File downloads as "export.xlsx"
4. Open in Microsoft Excel or compatible software
5. Data organized in multiple sheets for analysis
```

### Screenshot Export

```
1. Click "Export Screenshot" (where available)
2. PNG file downloads automatically
3. High-resolution (2x scale) for presentations
```

---

## ⚙️ Configuration

### Language Preference

Language is automatically saved to browser's localStorage. To reset:

```javascript
// In browser console
localStorage.removeItem('language');
location.reload();
```

### API Integration (Future)

The app is prepared for real-time data integration:

- **OpenWeatherMap API**: Weather impact on logistics
- **Alpha Vantage API**: Commodity price trends
- **Fuel Price APIs**: Real-time fuel costs

---

## 🎨 Customization

### Theme Colors

Edit `src/app/globals.css` to customize the color scheme:

```css
:root {
  --accent-blue: #3b82f6;
  --accent-green: #22c55e;
  --accent-red: #ef4444;
  /* ... more colors ... */
}
```

### Fonts

- **English**: Inter (Professional, modern)
- **Arabic**: Cairo (Optimized for Arabic)

Edit `src/components/layout/ClientLayout.tsx` to change fonts.

---

## 🔧 Development

### Project Structure

```
src/
├── app/                          # Next.js app directory
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Main page
│   └── globals.css              # Global styles
├── components/
│   ├── layout/                  # Layout components
│   ├── dashboard/               # Dashboard components
│   ├── feasibility/             # Feasibility study
│   ├── saudi/                   # Saudi-specific modules
│   ├── fleet/                   # Fleet management
│   ├── ghost/                   # Ghost growth
│   └── risk/                    # Risk analysis
├── lib/
│   ├── i18n.ts                  # i18n configuration
│   ├── exportUtils.ts           # Export functions
│   ├── feasibilityEngine.ts     # Feasibility analysis
│   └── ...other utilities
└── hooks/                        # Custom React hooks
public/
└── locales/                      # Translation files
    ├── en/translation.json
    └── ar/translation.json
```

### Adding Translations

1. Edit `public/locales/en/translation.json` for English
2. Edit `public/locales/ar/translation.json` for Arabic
3. Use `useTranslation()` hook in components:

```typescript
import { useTranslation } from 'react-i18next';

export default function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t('app.name')}</h1>;
}
```

### Adding New Modules

1. Create component in `src/components/`
2. Add module type to `Module` type in `src/app/page.tsx`
3. Add to `moduleTitles` object
4. Add render case in `renderModule()` function
5. Add navigation item in `Sidebar.tsx`

---

## 📱 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘1` or `Ctrl+1` | Command Center |
| `⌘2` or `Ctrl+2` | Nexus Fleet |
| `⌘3` or `Ctrl+3` | Ghost Growth |
| `⌘4` or `Ctrl+4` | Fleet Map |
| `⌘5` or `Ctrl+5` | Risk Manager |
| `⌘6` or `Ctrl+6` | 3D Analytics |

---

## 🐛 Troubleshooting

### Language Not Switching

**Solution**: Clear browser cache and localStorage

```javascript
localStorage.clear();
location.reload();
```

### Build Errors

**Solution**: Clean and reinstall

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Port Already in Use

**Solution**: Use different port

```bash
npm run dev -- -p 3001
```

---

## 📚 Documentation

- **IMPROVEMENTS.md** - Detailed list of all improvements
- **IMPLEMENTATION_PLAN.md** - Implementation roadmap
- **README.md** - Original project documentation

---

## 🤝 Support

For issues or questions:

1. Check the documentation files above
2. Review the code comments in relevant files
3. Check the translation files for language-related issues
4. Verify build status with `npm run build`

---

## 📝 Version History

### v0.3.0 (Current)
- ✅ Rebranded to Levered Beta Logistics
- ✅ Added Arabic/RTL support
- ✅ Implemented Feasibility Study module
- ✅ Added PDF/Excel export
- ✅ Language switcher in header
- ✅ Full i18n infrastructure

### v0.2.0
- Original VEGA Logistics OS release

---

## 🎯 Next Steps

1. **Customize** the app with your branding
2. **Translate** additional strings as needed
3. **Integrate** real-time APIs for live data
4. **Deploy** to production
5. **Monitor** and optimize performance

---

**Happy logistics planning! 🚀**

For more information, see the detailed documentation in the project root.
