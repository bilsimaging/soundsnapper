
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, Modality } from "@google/genai";

// WARNING: For demonstration purposes, API keys are accessed via environment variables below.
// In a real application, these should be handled securely on a server-side backend
// to prevent exposure on the client.
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const FAL_API_KEY = process.env.FAL_API_KEY;

// --- CONFIGURATION ---
type Mood = 'Real' | 'Dreamy' | 'Sci-Fi' | 'Cartoon';
const MOODS: Mood[] = ['Real', 'Dreamy', 'Sci-Fi', 'Cartoon'];
const TRANSFORMATION_STYLES = ['Anime', 'Watercolor', 'Cyberpunk', 'Vintage Film', 'Low Poly 3D'];

const UNIVERSAL_PROMPT_TEMPLATE = (mood: Mood) => `You are an expert sound designer. Analyze the image to understand the environment. Act as a creative text-to-sound AI prompter.
First, provide a short, narrative description of the scene in one sentence, as if you are describing it to a user.
Second, provide a single, clear description for a background ambient sound, in a ${mood.toLowerCase()} style, based on the image. This will be used for a looping audio track.
Third, provide a creative, descriptive prompt for a single, primary sound effect for the scene, matching the ${mood.toLowerCase()} style, inspired by the image.

Ensure your entire output is a single, valid JSON object that strictly follows the provided schema.`;

const SFX_PROMPT_TEMPLATE = (scene: string, mood: Mood) => `You are a creative sound designer. The scene is: "${scene}". The mood is ${mood}. Generate a new, unique sound effect prompt that would fit this scene. Output ONLY the short prompt text, nothing else.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    sceneDescription: { type: Type.STRING, description: "A short, narrative description of the scene to be spoken to the user." },
    ambience: { type: Type.STRING, description: "A descriptive phrase for a text-to-sound model to generate a background ambient sound." },
    soundEffect: { type: Type.STRING, description: "A descriptive phrase for a primary sound effect for the scene." },
  },
  required: ["sceneDescription", "ambience", "soundEffect"],
};

const TRANSFORM_PROMPT_TEMPLATE = (mood: Mood, instruction: string) => `First, transform this image ${instruction}.
Second, acting as an expert sound designer, analyze the NEW image you are creating. The desired mood is ${mood}.
Provide a single, valid JSON object that strictly follows this schema:
${JSON.stringify(RESPONSE_SCHEMA, null, 2)}
The JSON should be the only text in your response.`;

type SoundData = {
    sceneDescription: string;
    ambience: string;
    soundEffect: string;
}

const FALLBACK_SOUNDS: SoundData = {
    sceneDescription: "I see something interesting. Let's listen to what this scene sounds like.",
    ambience: "Gentle ambient background with soft environmental sounds",
    soundEffect: "A subtle, atmospheric sound effect that matches the scene",
};

const LOADING_MESSAGES = {
  sound: [
    "Listening to the world...",
    "Composing a soundscape...",
    "Tuning the atmosphere...",
  ],
  transform: [
    "Remixing reality...",
    "Painting with pixels...",
    "Entering the portal...",
    "Bending the visual spectrum...",
  ]
};

// --- UTILITY ---
function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- AUDIO ---
const playTextToSpeech = async (text: string, voiceId = 'Xb7hH8MSUJpSbSDYk0k2') => {
    if (!ELEVENLABS_API_KEY || !text) return;
    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: { 'Accept': 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': ELEVENLABS_API_KEY },
            body: JSON.stringify({
                text: text, model_id: 'eleven_monolingual_v1',
                voice_settings: { stability: 0.5, similarity_boost: 0.5 }
            })
        });
        if (!response.ok) throw new Error(`ElevenLabs API failed with status: ${response.status}`);
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play();
    } catch (error) {
        console.error("Error playing text-to-speech:", error);
    }
};

// --- FAL AI IMAGE TRANSFORMATION ---
const transformImageWithFal = async (imageDataUrl: string, instruction: string): Promise<string | null> => {
    if (!FAL_API_KEY) {
        console.warn("FAL_API_KEY not found");
        return null;
    }
    
    try {
        console.log("Starting Fal AI transformation with instruction:", instruction);
        
        // Use the correct Fal AI Gemini 2.5 Flash Image Edit endpoint
        const response = await fetch('https://queue.fal.run/fal-ai/gemini-25-flash-image/edit', {
            method: 'POST',
            headers: {
                'Authorization': `Key ${FAL_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: `Transform this image: ${instruction}. Create a stylized version while maintaining the core elements.`,
                image_urls: [imageDataUrl], // Array of image URLs as per API spec
                num_images: 1,
                output_format: "jpeg"
            })
        });

        console.log("Fal AI response status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Fal AI API error:", errorText);
            throw new Error(`Fal AI API failed with status: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log("Fal AI result:", result);
        
        // Handle immediate response or queue
        if (result.images && result.images.length > 0) {
            console.log("Got immediate result from Fal AI");
            return result.images[0].url;
        }
        
        // Handle queue response
        if (result.request_id) {
            console.log("Fal AI queued, waiting for result...");
            
            // Use the status_url provided by Fal AI instead of constructing our own
            const statusUrl = result.status_url || `https://queue.fal.run/fal-ai/gemini-25-flash-image/requests/${result.request_id}`;
            
            // Poll for result with timeout
            const maxAttempts = 30; // 30 seconds max
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                
                try {
                    const resultResponse = await fetch(statusUrl, {
                        headers: {
                            'Authorization': `Key ${FAL_API_KEY}`
                        }
                    });
                    
                    if (resultResponse.ok) {
                        const finalResult = await resultResponse.json();
                        console.log(`Fal AI poll attempt ${attempt + 1}:`, finalResult);
                        
                        if (finalResult.status === 'COMPLETED') {
                            console.log("Fal AI completed, fetching result...");
                            
                            // Fetch the actual result from the response_url
                            const responseUrl = finalResult.response_url || result.response_url;
                            const resultDataResponse = await fetch(responseUrl, {
                                headers: {
                                    'Authorization': `Key ${FAL_API_KEY}`
                                }
                            });
                            
                            if (resultDataResponse.ok) {
                                const resultData = await resultDataResponse.json();
                                console.log("Fal AI final result data:", resultData);
                                
                                if (resultData.images && resultData.images.length > 0) {
                                    console.log("Fal AI transformation successful!");
                                    return resultData.images[0].url;
                                } else {
                                    throw new Error("No images found in completed result");
                                }
                            } else {
                                throw new Error(`Failed to fetch result data: ${resultDataResponse.status}`);
                            }
                        }
                        
                        if (finalResult.status === 'FAILED') {
                            throw new Error(`Fal AI processing failed: ${finalResult.error || 'Unknown error'}`);
                        }
                        
                        // Continue polling if status is IN_QUEUE or IN_PROGRESS
                        if (finalResult.status === 'IN_QUEUE' || finalResult.status === 'IN_PROGRESS') {
                            continue;
                        }
                    } else {
                        console.warn(`Polling attempt ${attempt + 1} failed with status: ${resultResponse.status}`);
                    }
                } catch (pollError) {
                    console.warn(`Polling attempt ${attempt + 1} failed:`, pollError);
                }
            }
            
            throw new Error("Fal AI transformation timeout");
        }

        throw new Error("Unexpected Fal AI response format");

    } catch (error) {
        console.error("Fal AI transformation failed:", error);
        return null;
    }
};

// Alternative Fal AI model as backup
const tryAlternativeFalModel = async (imageDataUrl: string, instruction: string): Promise<string | null> => {
    try {
        console.log("Trying Fal AI FLUX Dev model...");
        
        const response = await fetch('https://queue.fal.run/fal-ai/flux/dev', {
            method: 'POST',
            headers: {
                'Authorization': `Key ${FAL_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: `Transform this image: ${instruction}. Create a stylized version while maintaining the core elements of the scene.`,
                image_url: imageDataUrl,
                num_images: 1,
                output_format: "jpeg"
            })
        });

        if (!response.ok) {
            console.error("Alternative Fal AI model also failed");
            return null;
        }

        const result = await response.json();
        
        if (result.images && result.images.length > 0) {
            return result.images[0].url;
        }
        
        if (result.request_id) {
            // Simple polling for alternative model
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const resultResponse = await fetch(`https://queue.fal.run/fal-ai/flux/dev/requests/${result.request_id}`, {
                headers: {
                    'Authorization': `Key ${FAL_API_KEY}`
                }
            });
            
            if (resultResponse.ok) {
                const finalResult = await resultResponse.json();
                if (finalResult.images && finalResult.images.length > 0) {
                    return finalResult.images[0].url;
                }
            }
        }

        return null;
    } catch (error) {
        console.error("Alternative Fal AI model failed:", error);
        return null;
    }
};

// --- AI ---
let ai: GoogleGenAI;
try {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
} catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
}

// --- MAIN APP COMPONENT ---
const App = () => {
    // App State
    const [showSplash, setShowSplash] = useState(true);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isLoading, setIsLoading] = useState< 'sound' | 'transform' | false >(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [showHelp, setShowHelp] = useState<string | null>(null);

    // Media State
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [transformedImage, setTransformedImage] = useState<string | null>(null);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [showZoomedImage, setShowZoomedImage] = useState(false);

    // Sound State
    const [soundData, setSoundData] = useState<SoundData>(FALLBACK_SOUNDS);
    const [sfxDescription, setSfxDescription] = useState(FALLBACK_SOUNDS.soundEffect);
    const [currentMood, setCurrentMood] = useState<Mood>('Real');
    const [ambienceVolume, setAmbienceVolume] = useState(100);
    const [sfxVolume, setSfxVolume] = useState(100);
    const ambienceAudioRef = useRef<HTMLAudioElement | null>(null);
    const sfxAudioRef = useRef<HTMLAudioElement | null>(null);

    // Transform State
    const [activeStyle, setActiveStyle] = useState('');
    const [customPrompt, setCustomPrompt] = useState('');

    // --- EFFECTS ---

    // Splash screen timer
    useEffect(() => {
        const timer = setTimeout(() => setShowSplash(false), 2500);
        return () => clearTimeout(timer);
    }, []);

    // Online status listener
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Camera setup
    useEffect(() => {
        if (showSplash) return;
        let stream: MediaStream | null = null;
        const video = videoRef.current;
        if (!video) return;

        const setupCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                video.srcObject = stream;
                video.onloadedmetadata = () => video.play().catch(err => console.error("Video play failed:", err));
                video.onplaying = () => {
                    setIsCameraReady(true);
                    setShowHelp("Tap Snap! to capture the scene.");
                    setTimeout(() => setShowHelp(null), 5000);
                };
            } catch (err) {
                console.error("Camera access denied:", err);
            }
        };

        setupCamera();

        return () => {
            stream?.getTracks().forEach(track => track.stop());
            if (video) {
                video.srcObject = null;
                video.onplaying = null;
                video.onloadedmetadata = null;
            }
        };
    }, [showSplash]);

    // Loading message updater
    useEffect(() => {
      let interval: number;
      if (isLoading) {
        const messages = LOADING_MESSAGES[isLoading] || [];
        setLoadingMessage(getRandomItem(messages));
        interval = window.setInterval(() => {
          setLoadingMessage(getRandomItem(messages));
        }, 2000);
      }
      return () => clearInterval(interval);
    }, [isLoading]);

    // --- AUDIO ---
    const generateAndPlayAudio = async (text: string, type: 'ambience' | 'sfx') => {
        if (!ELEVENLABS_API_KEY || !text) return;
        const payload = {
            text: text, model_id: "eleven_text_to_sound_v2",
            ...(type === 'ambience' && { loop: true, duration_seconds: 10 })
        };

        try {
            const response = await fetch(`https://api.elevenlabs.io/v1/sound-generation`, {
                method: 'POST',
                headers: { 'Accept': 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': ELEVENLABS_API_KEY },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`ElevenLabs TTSound failed with status: ${response.status}`);
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            
            const audioRef = type === 'ambience' ? ambienceAudioRef : sfxAudioRef;
            const volume = type === 'ambience' ? ambienceVolume : sfxVolume;
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
            const audio = new Audio(audioUrl);
            audio.loop = type === 'ambience';
            audio.volume = volume / 100;
            audio.play();
            audioRef.current = audio;

        } catch (error) {
            console.error(`Error generating ${type} audio:`, error);
        }
    };

    // --- HANDLERS ---
    const handleSnap = async () => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg');
            setCapturedImage(dataUrl);
            setTransformedImage(null);
            await generateSounds(dataUrl);
            setShowHelp("Now, choose a style and transform your reality!");
            setTimeout(() => setShowHelp(null), 5000);
        }
    };
    
    const handleTransform = async () => {
        if (!capturedImage || (!activeStyle && !customPrompt)) return;
        
        setIsLoading('transform');
        
        try {
            const instruction = customPrompt || `Transform this image in a ${activeStyle} style`;
            
            // Try Fal AI first for image transformation
            try {
                const transformedImageUrl = await transformImageWithFal(capturedImage, instruction);
                if (transformedImageUrl) {
                    setTransformedImage(transformedImageUrl);
                    
                    // Generate new sounds for the transformed image
                    setTimeout(async () => {
                        try {
                            // Convert URL to base64 data URL for sound generation
                            const response = await fetch(transformedImageUrl);
                            const blob = await response.blob();
                            const reader = new FileReader();
                            reader.onload = async () => {
                                if (typeof reader.result === 'string') {
                                    await generateSounds(reader.result);
                                }
                            };
                            reader.readAsDataURL(blob);
                        } catch (soundError) {
                            console.error("Sound generation failed for transformed image:", soundError);
                        }
                    }, 100);
                    
                    return; // Success with Fal AI
                }
            } catch (falError) {
                console.warn("Fal AI transformation failed, trying Gemini:", falError);
            }
            
            // Fallback to Gemini if Fal AI fails
            const prompt = TRANSFORM_PROMPT_TEMPLATE(currentMood, instruction);
            const imagePart = { inlineData: { mimeType: 'image/jpeg', data: capturedImage.split(',')[1] } };
            const textPart = { text: prompt };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts: [imagePart, textPart] },
                config: { 
                    responseModalities: [Modality.IMAGE, Modality.TEXT]
                },
            });

            if (!response.candidates || response.candidates.length === 0) {
                throw new Error("No transformation generated");
            }

            let imageTransformed = false;
            let soundsGenerated = false;

            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && !imageTransformed) {
                    const newImage = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    setTransformedImage(newImage);
                    imageTransformed = true;
                    
                    // Generate new sounds for the transformed image
                    setTimeout(async () => {
                        try {
                            await generateSounds(newImage);
                        } catch (soundError) {
                            console.error("Sound generation failed for transformed image:", soundError);
                        }
                    }, 100);
                    
                } else if (part.text && !soundsGenerated) {
                    try {
                        const cleanedJson = part.text.replace(/```json\n?|\n?```/g, '').trim();
                        if (cleanedJson.startsWith('{') && cleanedJson.endsWith('}')) {
                            const parsed = JSON.parse(cleanedJson);
                            if (parsed.sceneDescription && parsed.ambience && parsed.soundEffect) {
                                setSoundData(parsed);
                                setSfxDescription(parsed.soundEffect);
                                await playTextToSpeech(parsed.sceneDescription);
                                await generateAndPlayAudio(parsed.ambience, 'ambience');
                                await generateAndPlayAudio(parsed.soundEffect, 'sfx');
                                soundsGenerated = true;
                            }
                        }
                    } catch (e) {
                        console.error("Failed to parse sound data from transform response:", e, "Received:", part.text);
                    }
                }
            }

            if (!imageTransformed) {
                throw new Error("No image was generated in the transformation");
            }

        } catch (error) {
            console.error("Image transformation failed:", error);
            let errorMessage = "Transformation failed. Please try again with a different style.";
            
            if (error.message && error.message.includes("Fal AI")) {
                errorMessage = "Image transformation service is busy. Please try again in a moment.";
            } else if (error.message && error.message.includes("timeout")) {
                errorMessage = "Transformation is taking longer than expected. Please try again.";
            } else if (error.message && error.message.includes("401")) {
                errorMessage = "API authentication failed. Please check your API keys.";
            }
            
            setShowHelp(errorMessage);
            setTimeout(() => setShowHelp(null), 4000);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleGenerateSfx = async () => {
        if (isLoading) return;
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: SFX_PROMPT_TEMPLATE(soundData.sceneDescription, currentMood),
            });
            const newSfx = response.text.trim();
            setSfxDescription(newSfx);
            await generateAndPlayAudio(newSfx, 'sfx');
        } catch (error) {
            console.error("SFX generation failed:", error);
        }
    };

    const generateSounds = async (imageDataUrl: string) => {
        if (!ai) return;
        setIsLoading('sound');
        try {
            const imagePart = { inlineData: { mimeType: 'image/jpeg', data: imageDataUrl.split(',')[1] } };
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [imagePart] },
                config: {
                    systemInstruction: UNIVERSAL_PROMPT_TEMPLATE(currentMood),
                    responseMimeType: "application/json",
                    responseSchema: RESPONSE_SCHEMA,
                },
            });

            const parsed = JSON.parse(response.text.trim());
            setSoundData(parsed);
            setSfxDescription(parsed.soundEffect);
            await playTextToSpeech(parsed.sceneDescription);
            await generateAndPlayAudio(parsed.ambience, 'ambience');
            await generateAndPlayAudio(parsed.soundEffect, 'sfx');
        } catch (error) {
            console.error("Sound generation failed:", error);
            setSoundData(FALLBACK_SOUNDS);
            await playTextToSpeech(FALLBACK_SOUNDS.sceneDescription);
        } finally {
            setIsLoading(false);
        }
    };

    const handleVolumeChange = (type: 'ambience' | 'sfx', direction: 'increase' | 'decrease') => {
        const step = 5;
        const volumeState = type === 'ambience' ? ambienceVolume : sfxVolume;
        const setVolumeState = type === 'ambience' ? setAmbienceVolume : setSfxVolume;
        const audioRef = type === 'ambience' ? ambienceAudioRef : sfxAudioRef;

        const newVolume = direction === 'increase'
            ? Math.min(100, volumeState + step)
            : Math.max(0, volumeState - step);
        
        setVolumeState(newVolume);
        if (audioRef.current) {
            audioRef.current.volume = newVolume / 100;
        }
    };
    
    const handleNewSnap = () => {
        setCapturedImage(null);
        setTransformedImage(null);
        if (ambienceAudioRef.current) {
            ambienceAudioRef.current.pause();
        }
        setShowHelp("Tap Snap! to capture the scene.");
        setTimeout(() => setShowHelp(null), 5000);
    };

    const renderContent = () => {
        if (showSplash) {
            return (
                <div className="splash-screen">
                    <div className="splash-content">
                        <h1>SoundSnapper</h1>
                        <p>Remix Your Reality.</p>
                    </div>
                </div>
            );
        }

        return (
            <>
                <video ref={videoRef} className={!isCameraReady ? 'hidden' : ''} muted playsInline />
                <canvas ref={canvasRef}></canvas>
                <div className="visualizer-overlay"></div>
                {capturedImage && <div className="interaction-overlay" onClick={handleGenerateSfx}></div>}
                
                <div className="status-indicator">
                    <div className={`status-dot ${isOnline ? 'online' : 'offline'}`}></div>
                    <span>{isOnline ? 'Online' : 'Offline'}</span>
                </div>

                {isLoading && (
                    <div className="center-message">
                        <div className="sound-loader">
                            <div></div><div></div><div></div><div></div><div></div>
                        </div>
                        <span>{loadingMessage}</span>
                    </div>
                )}

                {showHelp && <div className="help-notification">{showHelp}</div>}
                
                {capturedImage && (
                    <div className="preview-container" onClick={() => setShowZoomedImage(true)}>
                        <img src={transformedImage || capturedImage} alt="Transformed preview" />
                        <button className="close-preview-button" onClick={(e) => {
                            e.stopPropagation();
                            handleNewSnap();
                        }}>&times;</button>
                        <div className="zoom-hint">👆 Click to zoom</div>
                    </div>
                )}

                {/* Zoomed Image Modal */}
                {showZoomedImage && (
                    <div className="zoom-modal" onClick={() => setShowZoomedImage(false)}>
                        <div className="zoom-container">
                            <img src={transformedImage || capturedImage} alt="Zoomed view" />
                            <button className="zoom-close-button" onClick={() => setShowZoomedImage(false)}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )}

                {capturedImage && (
                    <div className="left-sidebar">
                        <div className="sound-panel">
                            <div className="sound-info">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 9V15C3 15.663 3.26339 16.2989 3.73223 16.7678C4.20107 17.2366 4.83696 17.5 5.5 17.5H6.5C7.16304 17.5 7.79893 17.2366 8.26777 16.7678C8.73661 16.2989 9 15.663 9 15V9C9 8.33696 8.73661 7.70107 8.26777 7.23223C7.79893 6.76339 7.16304 6.5 6.5 6.5H5.5C4.83696 6.5 4.20107 6.76339 3.73223 7.23223C3.26339 7.70107 3 8.33696 3 9Z" stroke="#98FB98" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M15 5V19" stroke="#98FB98" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 7V17" stroke="#98FB98" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 9V15" stroke="#98FB98" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18 9V15" stroke="#98FB98" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 11V13" stroke="#98FB98" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                <div className="sound-text">
                                    <h4>Ambience</h4>
                                    <p>{soundData.ambience || "Loading ambient sound description..."}</p>
                                </div>
                            </div>
                            <div className="panel-volume-controls">
                                <button className="panel-volume-button" onClick={() => handleVolumeChange('ambience', 'decrease')} disabled={!!isLoading}>-</button>
                                <span className="panel-volume-display">{ambienceVolume}</span>
                                <button className="panel-volume-button" onClick={() => handleVolumeChange('ambience', 'increase')} disabled={!!isLoading}>+</button>
                            </div>
                        </div>
                        <div className="sound-panel">
                            <div className="sound-info">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 5L6 9H2V15H6L11 19V5Z" stroke="#87CEFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M15.54 8.46C16.4774 9.39764 17.0039 10.6695 17.0039 11.995C17.0039 13.3205 16.4774 14.5924 15.54 15.53" stroke="#87CEFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                <div className="sound-text">
                                    <h4>Sound Effect</h4>
                                    <p>{sfxDescription || "Loading sound effect description..."}</p>
                                </div>
                            </div>
                            <div className="panel-volume-controls">
                                <button className="panel-volume-button" onClick={() => handleVolumeChange('sfx', 'decrease')} disabled={!!isLoading}>-</button>
                                <span className="panel-volume-display">{sfxVolume}</span>
                                <button className="panel-volume-button" onClick={() => handleVolumeChange('sfx', 'increase')} disabled={!!isLoading}>+</button>
                            </div>
                        </div>
                    </div>
                )}

                {capturedImage && (
                    <button className="transform-button" onClick={handleTransform} disabled={!!isLoading || (!activeStyle && !customPrompt)}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.572L16.5 21.75l-.398-1.178a3.375 3.375 0 00-2.455-2.456L12.75 18l1.178-.398a3.375 3.375 0 002.455-2.456L16.5 14.25l.398 1.178a3.375 3.375 0 002.456 2.456L20.25 18l-1.178.398a3.375 3.375 0 00-2.456 2.456z" /></svg>
                        Transform
                    </button>
                )}

                <div className="bottom-controls">
                    {!capturedImage ? (
                        <button className="snap-button" onClick={handleSnap} disabled={!!isLoading || !isCameraReady}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.776 48.776 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>
                            <span>Snap!</span>
                        </button>
                    ) : (
                        <div className="style-palette">
                            <div className="style-presets">
                                {TRANSFORMATION_STYLES.map(style => (
                                    <button key={style}
                                        className={`style-button ${activeStyle === style ? 'active' : ''}`}
                                        onClick={() => { setActiveStyle(style); setCustomPrompt(''); }}
                                        disabled={!!isLoading}>
                                        {style}
                                    </button>
                                ))}
                            </div>
                            <input type="text"
                                className="custom-prompt-input"
                                placeholder="Or type your own transformation..."
                                value={customPrompt}
                                onChange={(e) => { setCustomPrompt(e.target.value); setActiveStyle(''); }}
                                disabled={!!isLoading} />
                        </div>
                    )}
                </div>
            </>
        );
    }

    return (
        <div className="app-container">
            {renderContent()}
        </div>
    );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
