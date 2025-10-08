/**
 * Main forwarding function.
 * Triggered by: Studio Flow
 * - Looks up the destination number in office_data.json.
 * - If found, dials the destination with a whisper message.
 * - Sets a fallback action to the /voicemail function if the dial fails.
 * - If not found, plays an error and hangs up.
 */
exports.handler = async function(context, event, callback) {
  // CONSOLE LOG: Announce that the function has started.
  console.log("Forwarder function started.");
  
  // CONSOLE LOG: Print the entire event object passed from Studio.
  console.log("Received event from Studio:", JSON.stringify(event, null, 2));

  const twiml = new Twilio.twiml.VoiceResponse();
  
  const calledNumber = event.calledNumber;
  const caller = event.caller;
  const assetPath = '/office_data.json'; 
  
  try {
    const openAsset = Runtime.getAssets()[assetPath].open;
    const officeData = JSON.parse(openAsset());
    const office = officeData[calledNumber];

    // CONSOLE LOG: Show the result of the JSON lookup. Will be 'undefined' if no match is found.
    console.log("Result from office data lookup:", office);

    if (office) {
      const dial = twiml.dial({
        callerId: caller,
        action: `/voicemail?smsTarget=${encodeURIComponent(office.destination)}`,
        record: 'record-from-answer-dual'
      });
      
      const whisperBinUrl = context.WHISPER_TWIML_BIN_URL;
      const whisperUrl = `${whisperBinUrl}?officeName=${encodeURIComponent(office.officeName)}`;
      dial.number({ url: whisperUrl }, office.destination);
      
    } else {
      console.error(`No match found for ${calledNumber} in the JSON file.`);
      twiml.say({ voice: 'Google.en-US-Chirp3-HD-Kore' }, 'We\'re sorry, the number you have dialed is not in service. Please visit our website at www.example.com/contact.');
      twiml.hangup();
    }
  } catch (error) {
    console.error(`Error processing request: ${error}`);
    twiml.say({ voice: 'Google.en-US-Chirp3-HD-Kore' }, 'We are sorry, an internal error has occurred. Please visit our website at www.example.com/contact.');
    twiml.hangup();
  }

  // CONSOLE LOG: Show the final TwiML before returning.
  console.log("Generated TwiML:", twiml.toString());
  return callback(null, twiml);
};