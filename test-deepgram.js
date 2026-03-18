require('dotenv').config();
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');

async function testDeepgram() {
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key || key.startsWith('your_')) {
        console.error('❌ Error: Invalid or missing DEEPGRAM_API_KEY in .env');
        console.error('Current Key:', key);
        return;
    }

    console.log('🔄 Testing Deepgram Connection...');
    console.log(`🔑 Key found (length: ${key.length})`);

    try {
        const deepgram = createClient(key);

        // Attempt to open a live connection
        const connection = deepgram.listen.live({
            model: "nova-2",
            language: "ja",
            smart_format: true,
            encoding: "linear16",
            sample_rate: 16000
        });

        connection.on(LiveTranscriptionEvents.Open, () => {
            console.log('✅ Success! Connected to Deepgram Nova-2 (Japanese).');
            console.log('The API Key and Network connection are working correctly.');
            connection.finish(); // Close immediately
            process.exit(0);
        });

        connection.on(LiveTranscriptionEvents.Error, (err) => {
            console.error('❌ Deepgram Connection Error:', err);
            process.exit(1);
        });

        connection.on(LiveTranscriptionEvents.Close, () => {
            console.log('Connection closed.');
        });

        // Timeout if no connection after 5 seconds
        setTimeout(() => {
            console.error('❌ Timeout: Could not connect to Deepgram within 5 seconds.');
            process.exit(1);
        }, 5000);

    } catch (error) {
        console.error('❌ Unexpected Error:', error);
    }
}

testDeepgram();
