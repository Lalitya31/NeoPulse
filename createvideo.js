require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function run() {
  try {
    console.log('🎬 Starting video generation with Google Veo...');
    console.log('🔑 API Key loaded:', process.env.GOOGLE_API_KEY ? '✓' : '✗');
    
    const prompt = `
Minimal cinematic healthcare studio environment with soft neutral lighting.

A smooth matte white pharmaceutical capsule pill resting on a flat surface.

The capsule fades as the surface reacts and a thin ECG heartbeat line draws across the plane.

The ECG reorganizes into behavioral data curves forming a daily routine timeline grid.

Four soft human silhouettes appear on nodes of the timeline performing calm breathing motion.

The timeline elevates and bends forming a minimal wireframe human torso.

A soft pulse travels upward.

Camera slowly pulls back revealing a clean healthcare interface below.
`;

    console.log('\n📝 Prompt loaded');
    console.log('⏳ Sending request to Google Veo 3.1 Fast API...');
    console.log('   This may take 1-5 minutes depending on video complexity\n');

    const model = genAI.getGenerativeModel({ 
      model: 'veo-3.1-fast-generate-preview'
    });

    const result = await model.generateContent({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 1,
        topK: 40,
        topP: 0.95,
      }
    });

    console.log('✅ Response received!');
    console.log('🔍 Processing response...');

    const response = await result.response;
    
    // Check for video data
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      const parts = candidate.content?.parts || [];
      
      for (const part of parts) {
        // Check for inline base64 video
        if (part.inlineData && part.inlineData.data) {
          console.log('\n✨ Video data found!');
          console.log('📦 Converting from base64...');
          
          const outputPath = path.join(__dirname, 'intro.mp4');
          const videoBuffer = Buffer.from(part.inlineData.data, 'base64');
          fs.writeFileSync(outputPath, videoBuffer);
          
          const sizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(2);
          console.log(`\n🎉 SUCCESS! Video saved as intro.mp4 (${sizeMB} MB)`);
          console.log(`📁 Location: ${outputPath}`);
          return;
        }
        
        // Check for file URI
        if (part.fileData && part.fileData.fileUri) {
          console.log('\n✨ Video URI found!');
          console.log('📥 File URI:', part.fileData.fileUri);
          console.log('\n⚠️  Note: Download from URI not implemented yet.');
          console.log('Copy the URI above and download manually.');
          return;
        }
      }
    }
    
    // If we're here, no video was found
    console.log('\n⚠️  No video data found in response');
    console.log('\nResponse structure:');
    console.log(JSON.stringify(response, null, 2));
    
  } catch (error) {
    console.error('\n\n❌ ERROR occurred:');
    console.error('Type:', error.constructor.name);
    console.error('Message:', error.message);
    
    if (error.response) {
      console.error('\nAPI Response:', JSON.stringify(error.response, null, 2));
    }
    
    // Helpful error messages
    if (error.message?.includes('API key')) {
      console.error('\n💡 Your API key may be invalid or missing.');
      console.error('   Check your .env file for GOOGLE_API_KEY');
    } else if (error.message?.includes('quota') || error.status === 429) {
      console.error('\n💡 API quota exceeded.');
      console.error('   Wait a bit or check your Google Cloud quota limits.');
    } else if (error.message?.includes('not found') || error.status === 404) {
      console.error('\n💡 Model "veo-3.1-fast-generate-preview" not found.');
      console.error('   Veo may require waitlist access or different model name.');
      console.error('   Available Veo models: veo-2.0, veo-3.0, veo-3.1');
    } else if (error.status === 403) {
      console.error('\n💡 Permission denied.');
      console.error('   Your API key may not have access to Veo yet.');
      console.error('   Request access at: https://ai.google.dev/');
    } else if (error.message?.includes('timeout')) {
      console.error('\n💡 Request timed out.');
      console.error('   Video generation can take several minutes.');
      console.error('   The video may still be processing on Google\'s servers.');
    }
    
    console.error('\n📚 For more info, visit: https://ai.google.dev/api/generate-content');
    process.exit(1);
  }
}

run();