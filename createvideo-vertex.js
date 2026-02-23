require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');

// Note: Veo models require Vertex AI with billing enabled
// Standard AI Studio API keys may not work

const API_KEY = process.env.GOOGLE_API_KEY;
const PROJECT_ID = process.env.GOOGLE_PROJECT_ID || 'YOUR_PROJECT_ID';
const LOCATION = 'us-central1'; // Veo region

async function generateVideoVertexAI() {
  try {
    console.log('🎬 Starting video generation with Veo 3.1 Fast...');
    console.log('🔑 API Key loaded:', API_KEY ? '✓' : '✗');
    console.log('📦 Project ID:', PROJECT_ID);
    console.log('\n⚠️  NOTE: Veo requires Vertex AI with billing enabled\n');
    
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

    console.log('📝 Prompt ready');
    console.log('⏳ Sending request to Vertex AI...');
    
    // Vertex AI endpoint for Veo
    const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/veo-3.1-fast-generate-preview:predict`;
    
    const requestBody = JSON.stringify({
      instances: [{
        prompt: prompt
      }],
      parameters: {
        sampleCount: 1
      }
    });

    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    console.log('🌐 Endpoint:', endpoint);
    console.log('📤 Sending request...\n');

    const response = await makeRequest(endpoint, options, requestBody);
    
    console.log('✅ Response received!');
    console.log('📦 Response:', JSON.stringify(response, null, 2).substring(0, 500));
    
    // Handle the response - Veo returns a long-running operation
    if (response.name) {
      console.log('\n✨ Video generation started!');
      console.log('🔄 Operation ID:', response.name);
      console.log('\n⏳ Video is being generated (this takes 1-5 minutes)...');
      
      // Poll the operation
      await pollOperation(response.name);
      
    } else if (response.predictions && response.predictions[0]) {
      // Direct video data
      const prediction = response.predictions[0];
      
      if (prediction.bytesBase64Encoded) {
        console.log('\n✨ Video data received!');
        const outputPath = path.join(__dirname, 'intro.mp4');
        const videoBuffer = Buffer.from(prediction.bytesBase64Encoded, 'base64');
        fs.writeFileSync(outputPath, videoBuffer);
        
        const sizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(2);
        console.log(`\n🎉 SUCCESS! Video saved as intro.mp4 (${sizeMB} MB)`);
        console.log(`📁 Location: ${outputPath}`);
      } else if (prediction.gcsUri) {
        console.log('\n✨ Video uploaded to GCS!');
        console.log('📁 GCS URI:', prediction.gcsUri);
        console.log('\n💡 Download from Google Cloud Storage using gsutil or Cloud Console');
      }
    } else {
      console.log('\n⚠️  Unexpected response format');
      console.log(JSON.stringify(response, null, 2));
    }
    
  } catch (error) {
    console.error('\n\n❌ ERROR occurred:');
    console.error('Message:', error.message);
    
    if (error.statusCode === 401 || error.statusCode === 403) {
      console.error('\n💡 Authentication failed.');
      console.error('   Veo requires OAuth 2.0 token, not API key.');
      console.error('\n📋 Steps to fix:');
      console.error('   1. Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install');
      console.error('   2. Run: gcloud auth application-default login');
      console.error('   3. Set up billing in Google Cloud Console');
      console.error('   4. Enable Vertex AI API');
      console.error('\n💡 Or use Google AI Studio with Gemini models instead of Veo');
    } else if (error.statusCode === 404) {
      console.error('\n💡 Model or project not found.');
      console.error('   Set GOOGLE_PROJECT_ID in .env file');
      console.error('   Ensure Vertex AI is enabled for your project');
    } else if (error.statusCode === 429) {
      console.error('\n💡 Rate limit exceeded. Wait and retry.');
    }
    
    process.exit(1);
  }
}

function makeRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          const error = new Error(`HTTP ${res.statusCode}: ${data}`);
          error.statusCode = res.statusCode;
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function pollOperation(operationName) {
  const maxAttempts = 60; // 5 minutes
  
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
    
    process.stdout.write(`\r⏱️  Checking status... ${i + 1}/${maxAttempts} (${(i + 1) * 5}s elapsed)`);
    
    try {
      // Check operation status
      const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/${operationName}`;
      const options = {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      };
      
      const operation = await makeRequest(endpoint, options);
      
      if (operation.done) {
        console.log('\n\n✅ Video generation complete!');
        
        if (operation.response && operation.response.bytesBase64Encoded) {
          const outputPath = path.join(__dirname, 'intro.mp4');
          const videoBuffer = Buffer.from(operation.response.bytesBase64Encoded, 'base64');
          fs.writeFileSync(outputPath, videoBuffer);
          
          const sizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(2);
          console.log(`🎉 Video saved as intro.mp4 (${sizeMB} MB)`);
          console.log(`📁 Location: ${outputPath}`);
        } else if (operation.response && operation.response.gcsUri) {
          console.log('📁 Video location:', operation.response.gcsUri);
        }
        
        return;
      }
    } catch (err) {
      // Continue polling
    }
  }
  
  console.log('\n\n⏰ Timeout: Video is still processing after 5 minutes');
  console.log('Check Google Cloud Console for status');
}

generateVideoVertexAI();
