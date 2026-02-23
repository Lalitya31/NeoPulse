# Veo Video Generation - Important Info

## Problem
Veo models (veo-2.0, veo-3.0, veo-3.1) use **Vertex AI** which requires:
- ✗ NOT compatible with AI Studio API keys
- ✓ Requires Google Cloud Project with billing enabled
- ✓ Requires OAuth 2.0 authentication (not API key)
- ✓ Uses `predictLongRunning` method (different SDK)

## Your Options

### Option 1: Use Gemini with Image Generation (RECOMMENDED)
Your API key already has access to:
- **gemini-2.0-flash-exp-image-generation** (generates images, not video)
- **gemini-2.5-flash-image** (image generation)
- **gemini-3-pro-image-preview** (image generation)

### Option 2: Set Up Vertex AI for Veo (Complex)
1. Create Google Cloud Project
2. Enable billing  
3. Enable Vertex AI API
4. Install: `npm install @google-cloud/aiplatform`
5. Authenticate: `gcloud auth application-default login`
6. Use createvideo-vertex.js script

### Option 3: Use Alternative Services
- **Runway Gen-3**: https://runwayml.com/
- **Pika Labs**: https://pika.art/
- **LumaAI Dream Machine**: https://lumalabs.ai/

## Quick Test with Gemini Image

Want to test image generation with your current API key instead?
Run: `node createimage.js`

## Cost Warning
Veo on Vertex AI costs:
- ~$0.10-0.20 per second of video
- 5-second video = ~$0.50-1.00
- Requires credit card on file
