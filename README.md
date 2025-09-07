# 🎵 SoundSnapper: AI-Powered Reality Remix

> Transform your camera captures into immersive audio-visual experiences using cutting-edge AI

[![Nano Banana Hackathon](https://img.shields.io/badge/Nano%20Banana-Hackathon%202025-yellow)](https://www.kaggle.com/competitions/banana/)
[![Gemini 2.5](https://img.shields.io/badge/Powered%20by-Gemini%202.5%20Flash-blue)](https://ai.google.dev/)
[![Fal AI](https://img.shields.io/badge/Transforms%20with-Fal%20AI-purple)](https://fal.ai/)
[![ElevenLabs](https://img.shields.io/badge/Audio%20by-ElevenLabs-green)](https://elevenlabs.io/)

## 🌟 What is SoundSnapper?

### ✨ Key Features

- 📸 **Real-time Camera Capture** with intuitive mobile interface
- 🤖 **AI Scene Analysis** using Gemini 2.5 Flash Image Preview
- 🎨 **Artistic Transformations** via Fal AI (Anime, Cyberpunk, Watercolor, etc.)
- 🎵 **Immersive Audio Generation** with ElevenLabs (ambient sounds + effects)
- 🔊 **Interactive Audio Controls** with volume adjustment
- 🔍 **Click-to-Zoom** preview functionality
- 📱 **Responsive Design** optimized for mobile and desktop

## 🚀 Live Demo

🌐 **[Try SoundSnapper Live No API](https://soundsnapper.vercel.app/)**

## 🎯 How It Works

```
📷 Camera Capture → 🧠 AI Analysis → 🎨 Visual Transformation → 🎵 Audio Generation
```

1. **Capture**: Take a photo using your device camera
2. **Analyze**: Gemini 2.5 Flash analyzes the scene and generates descriptions
3. **Transform**: Choose from artistic styles powered by Fal AI
4. **Experience**: Enjoy synchronized ambient sounds and effects via ElevenLabs

## 🛠️ Technical Stack

- **Frontend**: React 19 + TypeScript + Vite
- **AI Vision**: Google Gemini 2.5 Flash Image Preview
- **Image Transform**: Fal AI (gemini-25-flash-image/edit)
- **Audio**: ElevenLabs Text-to-Speech & Sound Generation
- **Styling**: Custom CSS with Glassmorphism design

## 🔧 Setup & Installation

### Prerequisites
- Node.js 18+ 
- API Keys for:
  - [Google Gemini API](https://ai.google.dev/)
  - [Fal AI](https://fal.ai/)
  - [ElevenLabs](https://elevenlabs.io/)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/soundsnapper.git
   cd soundsnapper
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Add your API keys to `.env.local`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
   FAL_API_KEY=your_fal_api_key_here
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

## 🎮 Usage

1. **Allow camera permissions** when prompted
2. **Snap a photo** using the camera button
3. **Wait for AI analysis** and sound generation
4. **Choose a transformation style** (Anime, Cyberpunk, etc.)
5. **Click Transform** to apply visual effects
6. **Adjust audio levels** using the volume controls
7. **Click the preview** to zoom and view full-size image

## 🏆 Competition Entry

This project was created for the **Google Nano Banana Hackathon 2025**, showcasing the power of:
- **Gemini 2.5 Flash Image Preview** (Nano Banana)
- **Fal AI** image transformation capabilities  
- **ElevenLabs** audio generation technology

## 🤝 Contributing

This is a hackathon submission, but feel free to:
- Report bugs
- Suggest improvements
- Star the repository if you like it!

## 📄 License

MIT License - feel free to use this code for your own projects!

## 🙏 Acknowledgments

- **Google** for Gemini 2.5 Flash Image Preview
- **Fal** for powerful image transformation APIs
- **ElevenLabs** for amazing audio generation capabilities
- **Nano Banana Hackathon** organizers for the opportunity

---

**Made with ❤️ for the Nano Banana Hackathon 2025** 🍌
