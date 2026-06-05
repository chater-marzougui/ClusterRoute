<a id="readme-top"></a>

---

# 🛠️ ClusterRoute

**A privacy-first web app that builds the shortest multi-stop errand route near you.**  
Built with ❤️ by <a href="https://github.com/chater-marzougui">Chater Marzougui</a>.

<br>
<div align="center">
  <a href="https://github.com/chater-marzougui/ClusterRoute">
    <img src="./public/favicon.png" alt="ClusterRoute Logo" width="140" height="140">
  </a>
  <h3>ClusterRoute</h3>
  <p align="center">
    <strong>Free-text place search, smart route optimization, and interactive map exploration — all in your browser.</strong>
    <br>
    <br>
    <a href="https://github.com/chater-marzougui/ClusterRoute/issues/new?labels=bug">Report Bug</a>
    ·
    <a href="https://github.com/chater-marzougui/ClusterRoute/issues/new?labels=enhancement">Request Feature</a>
  </p>
</div>

<br>

---

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about-the-project">About The Project</a></li>
    <li><a href="#-features">Features</a></li>
    <li><a href="#-getting-started">Getting Started</a></li>
    <li><a href="#-installation">Installation</a></li>
    <li><a href="#-usage">Usage</a></li>
    <li><a href="#-configuration">Configuration</a></li>
    <li><a href="#-contributing">Contributing</a></li>
    <li><a href="#-license">License</a></li>
    <li><a href="#-contact">Contact</a></li>
  </ol>
</details>

<div align="right">
  <a href="#readme-top">
    <img src="https://img.shields.io/badge/Back_to_Top-⬆️-blue?style=for-the-badge" alt="Back to Top">
  </a>
</div>

---

## About The Project

**🚀 ClusterRoute** helps you type natural errands like `ATM, coffee, pharmacy` and instantly get optimized route options around your location.

It uses:
- **Photon geocoding** (OpenStreetMap ecosystem) with **Nominatim fallback**
- **Dual parsing modes** (Gemini Flash Lite or local splitter)
- **Client-side route scoring** using Haversine distance
- **Interactive Leaflet maps** with route + candidate swapping

Everything runs in the browser, with no backend required.

## ✨ Features

- 🔍 **Free-text multi-stop search** with progressive result loading
- 🤖 **Flexible parsing** (`auto`, `gemini`, `local`) with optional Gemini API key
- 🗺️ **Interactive map controls** (street/satellite/dark, locate, zoom)
- 🔁 **Alternative stop swapping** directly from map popups or result cards
- 📍 **Top route suggestions** with total distance + walk/drive estimates
- 🌍 **Multilingual UI** (`en`, `fr`, `ar`) with RTL support
- 🔒 **Privacy-first design**: settings and key stored locally via `localStorage`

<div align="right">
  <a href="#readme-top">
    <img src="https://img.shields.io/badge/Back_to_Top-⬆️-blue?style=for-the-badge" alt="Back to Top">
  </a>
</div>

---

## ⚡ Getting Started

### Prerequisites

- **Node.js** 20+
- **npm** 10+
- A modern browser with geolocation support
- *(Optional)* Gemini API key for AI parsing mode

### 📦 Installation

1. Clone the repository
2. Enter the project folder
3. Install dependencies

```bash
git clone https://github.com/chater-marzougui/ClusterRoute.git
cd ClusterRoute
npm ci
```

<div align="right">
  <a href="#readme-top">
    <img src="https://img.shields.io/badge/Back_to_Top-⬆️-blue?style=for-the-badge" alt="Back to Top">
  </a>
</div>

---

## 📚 Usage

```bash
# Start local development
npm run dev

# Build production bundle
npm run build

# Run tests
npm run test

# Run lint checks
npm run lint
```

Once running, enter a query such as:
- `ATM, coffee, pharmacy`
- `bank then supermarket then gas station`

Use **Settings** to tune parsing mode, search radius, max options per stop, and distance unit.

<div align="right">
  <a href="#readme-top">
    <img src="https://img.shields.io/badge/Back_to_Top-⬆️-blue?style=for-the-badge" alt="Back to Top">
  </a>
</div>

---

## 🪛 Configuration

ClusterRoute is fully client-side. No `.env` file is required.

### In-app Settings

- **Parsing Mode**: `auto` / `gemini` / `local`
- **Gemini API Key**: optional; stored locally in browser storage
- **Search Radius**: 1–50 km
- **Max Options per Stop**: 3–20
- **Distance Unit**: km / miles
- **Theme**: light / dark / system
- **Language**: EN / FR / AR

### Local Storage Keys

- `clusterroute-settings`
- `clusterroute-history`

<div align="right">
  <a href="#readme-top">
    <img src="https://img.shields.io/badge/Back_to_Top-⬆️-blue?style=for-the-badge" alt="Back to Top">
  </a>
</div>

---

## 🤝 Contributing

Contributions are what make the open-source community amazing — any contribution is appreciated.

1. **Fork the Project**
2. **Create your Feature Branch** (`git checkout -b feature/AmazingFeature`)
3. **Commit your Changes** (`git commit -m 'Add some AmazingFeature'`)
4. **Push to the Branch**
5. **Open a Pull Request**

<div align="right">
  <a href="#readme-top">
    <img src="https://img.shields.io/badge/Back_to_Top-⬆️-blue?style=for-the-badge" alt="Back to Top">
  </a>
</div>

---

## 📃 License

Distributed under the **MIT License**. See `LICENSE` for more information.

<div align="right">
  <a href="#readme-top">
    <img src="https://img.shields.io/badge/Back_to_Top-⬆️-blue?style=for-the-badge" alt="Back to Top">
  </a>
</div>

---

## 📧 Contact

**Chater Marzougui**  
GitHub: [@chater-marzougui](https://github.com/chater-marzougui)

Project Link: https://github.com/chater-marzougui/ClusterRoute

---

## 🙏 Acknowledgments

- OpenStreetMap contributors
- Photon (komoot)
- Nominatim
- Google Gemini API
- React, Vite, Tailwind, Leaflet communities

<div align="right">
  <a href="#readme-top">
    <img src="https://img.shields.io/badge/Back_to_Top-⬆️-blue?style=for-the-badge" alt="Back to Top">
  </a>
</div>

---

ClusterRoute makes multi-stop planning simple: type naturally, compare routes, and move faster.
