require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function generateImage() {
  try {
    console.log('🎨 Starting image generation with Gemini...');
    console.log('🔑 API Key loaded:', process.env.GOOGLE_API_KEY ? '✓' : '✗');
    
    const prompt = `
Create a minimal, clean wellness app interface screenshot:
- Soft neutral background (#F7F7F5)
- Clean typography showing "Today's Mood: Energized"
- Simple progress bar with athletic orange color
- Minimalist pharmaceutical capsule icon
- Healthcare professional aesthetic
- No gradients, no neon, no glassmorphism
`;

    console.log('\n📝 Prompt loaded');
    console.log('⏳ Sending request to Gemini Image API...\n');

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash-image'
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
    
    // Check for image data
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      const parts = candidate.content?.parts || [];
      
      for (const part of parts) {
        // Check for inline base64 image
        if (part.inlineData && part.inlineData.data) {
          console.log('\n✨ Image data found!');
          console.log('📦 Converting from base64...');
          
          const mimeType = part.inlineData.mimeType || 'image/png';
          const extension = mimeType.split('/')[1] || 'png';
          const outputPath = path.join(__dirname, `generated-image.${extension}`);
          
          const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
          fs.writeFileSync(outputPath, imageBuffer);
          
          const sizeKB = (imageBuffer.length / 1024).toFixed(2);
          console.log(`\n🎉 SUCCESS! Image saved (${sizeKB} KB)`);
          console.log(`📁 Location: ${outputPath}`);
          return;
        }
      }
    }
    
    console.log('\n⚠️  No image data found in response');
    console.log('\nResponse structure:');
    console.log(JSON.stringify(response, null, 2));
    
  } catch (error) {
    console.error('\n\n❌ ERROR occurred:');
    console.error('Type:', error.constructor.name);
    console.error('Message:', error.message);
    
    if (error.message?.includes('not found') || error.status === 404) {
      console.error('\n💡 Model not accessible with this API key.');
      console.error('   Try: gemini-2.0-flash-exp-image-generation');
    } else if (error.status === 403) {
      console.error('\n💡 Permission denied. Image generation may require approval.');
    }
    
    process.exit(1);
  }
}

generateImage();
