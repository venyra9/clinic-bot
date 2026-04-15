// server.js
const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 🔧 PASTE YOUR KEYS HERE
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';
const GOOGLE_VISION_KEY = 'YOUR_GOOGLE_VISION_KEY';
const TWILIO_ACCOUNT_SID = 'YOUR_TWILIO_SID';
const TWILIO_AUTH_TOKEN = 'YOUR_TWILIO_TOKEN';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.post('/webhook', async (req, res) => {
  const phoneNumber = req.body.From;        // Who sent the message
  const imageUrl = req.body.MediaUrl0;      // The photo they sent

  if (!imageUrl) {
    return res.send('<Response><Message>Please send a photo!</Message></Response>');
  }

  try {
    // 1. Download the image as base64
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      auth: { username: TWILIO_ACCOUNT_SID, password: TWILIO_AUTH_TOKEN }
    });
    const base64Image = Buffer.from(imageResponse.data).toString('base64');

    // 2. Send to Google Vision OCR
    const visionResponse = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_KEY}`,
      {
        requests: [{
          image: { content: base64Image },
          features: [{ type: 'TEXT_DETECTION' }]
        }]
      }
    );

    const extractedText = visionResponse.data.responses[0]
      ?.fullTextAnnotation?.text || 'No text found';

    // 3. Save to Supabase
    await supabase.from('messages').insert({
      phone_number: phoneNumber,
      extracted_text: extractedText,
      image_url: imageUrl
    });

    // 4. Reply to the patient
    res.send(`<Response><Message>✅ Received! Extracted text:\n\n${extractedText.slice(0, 200)}</Message></Response>`);

  } catch (error) {
    console.error(error);
    res.send('<Response><Message>Sorry, something went wrong. Please try again.</Message></Response>');
  }
});

app.get('/', (req, res) => res.send('Clinic bot is running!'));

app.listen(3000, () => console.log('Server running on port 3000'));
