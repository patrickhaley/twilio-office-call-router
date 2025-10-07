/**
 * Main forwarding function.
 * Triggered by: Studio Flow
 * - Looks up the destination number in office_data.json.
 * - If found, dials the destination with a whisper message.
 * - Sets a fallback action to the /voicemail function if the dial fails.
 * - If not found, plays an error and hangs up.
 */
exports.handler = async function(context, event, callback) {
  const twiml = new Twilio.twiml.VoiceResponse();
  
  // Data passed from the Studio Flow
  const calledNumber = event.calledNumber;
  const caller = event.caller;

  // Path to your private data file within this service
  const assetPath = '/office_data.json'; 
  
  try {
    const openAsset = Runtime.getAssets()[assetPath].open;
    const officeData = JSON.parse(openAsset());
    
    // Find the matching office using the Twilio number that was called
    const office = officeData[calledNumber];

    if (office) {
      // If a match is found, prepare to dial the office
      const dial = twiml.dial({
        callerId: caller,
        // If the call is busy or not answered, execute the /voicemail function
        action: `/voicemail?smsTarget=${encodeURIComponent(office.destination)}`
      });
      
      // Read the whisper TwiML Bin URL from your environment variables
      const whisperBinUrl = context.WHISPER_TWIML_BIN_URL;
      
      // Construct the final whisper URL with the office name
      const whisperUrl = `${whisperBinUrl}?officeName=${encodeURIComponent(office.officeName)}`;
      
      // Dial the office number and play the whisper message first
      dial.number({ url: whisperUrl }, office.destination);
      
    } else {
      // If no match is found, play an error message and hang up
      console.error(`No match found for ${calledNumber} in the JSON file.`);
      twiml.say({ voice: 'Google.en-US-Chirp3-HD-Kore' }, 'We\'re sorry, the number you have dialed is not in service. Please visit our website at www.example.com/contact.');
      twiml.hangup();
    }
  } catch (error) {
    // If any other error occurs, play a generic error and hang up
    console.error(`Error processing request: ${error}`);
    twiml.say({ voice: 'Google.en-US-Chirp3-HD-Kore' }, 'We are sorry, an internal error has occurred. Please visit our website at www.example.com/contact.');
    twiml.hangup();
  }

  // Return the final TwiML instructions
  return callback(null, twiml);
};