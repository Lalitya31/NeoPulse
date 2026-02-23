require('dotenv').config();
const https = require('https');

async function listModels() {
  try {
    console.log('🔍 Checking available models with your API key...\n');
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`;
    
    const data = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      }).on('error', reject);
    });
    
    if (data.models && data.models.length > 0) {
      console.log(`Found ${data.models.length} models:\n`);
      
      data.models.forEach((model, index) => {
        const modelName = model.name.replace('models/', '');
        console.log(`${index + 1}. ${modelName}`);
        if (model.displayName) console.log(`   Display: ${model.displayName}`);
        if (model.description) console.log(`   Description: ${model.description.substring(0, 80)}...`);
        if (model.supportedGenerationMethods) {
          console.log(`   Methods: ${model.supportedGenerationMethods.join(', ')}`);
        }
        console.log('');
      });
      
      // Check for video models
      const videoModels = data.models.filter(m => 
        m.name.toLowerCase().includes('veo') || 
        m.name.toLowerCase().includes('video') ||
        m.name.toLowerCase().includes('imagen')
      );
      
      if (videoModels.length > 0) {
        console.log('\n✅ Video/Image generation models found:');
        videoModels.forEach(m => console.log(`   - ${m.name.replace('models/', '')}`));
      } else {
        console.log('\n⚠️  No video generation models (Veo) found.');
        console.log('\n📋 Your options:');
        console.log('   1. Request Veo access: https://labs.google/veo');
        console.log('   2. Use text models with video descriptions (Gemini)');
        console.log('   3. Try Google Cloud Video Intelligence API');
        console.log('   4. Use alternative services (Runway, Pika, etc.)');
      }
    } else {
      console.log('⚠️  No models returned.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('403')) {
      console.error('\n💡 API key is invalid or doesn\'t have permission.');
      console.error('   Generate a new key at: https://aistudio.google.com/apikey');
    } else if (error.message.includes('429')) {
      console.error('\n💡 Rate limit exceeded. Wait a moment and try again.');
    }
  }
}

listModels();
