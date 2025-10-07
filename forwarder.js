// This code should be placed in a Twilio Function.
// Service: office-forwarding | Function Path: /forwarder

exports.handler = async function(context, event, callback) {
    // Create a new TwiML response object to build our instructions
    const twiml = new Twilio.twiml.VoiceResponse();
    
    // Get the phone numbers passed from the Studio Flow
    const calledNumber = event.calledNumber; // The Twilio number that was called
    const caller = event.caller;             // The customer's phone number
  
    // IMPORTANT: Update this path to match the Asset Path of your uploaded JSON file.
    const assetPath = '/office_data.json'; 
    
    try {
      // Open and read your JSON data file from Twilio Assets
      const openAsset = Runtime.getAssets()[assetPath].open;
      const officeData = JSON.parse(openAsset());
      
      // Look for the called Twilio number in your data file
      const office = officeData[calledNumber];
  
      // Check if a matching office was found
      if (office) {
        // If a match is found, log it and prepare to forward the call
        console.log(`Match found for ${calledNumber}: Forwarding to ${office.destination}`);
        
        const dial = twiml.dial({
          callerId: caller // Show the customer's number to the office
        });
        
        // This is the whisper logic. It generates a URL that plays a message.
        const whisperUrl = `https://handler.twilio.com/twiml/EHbb1005a76e7f8e8331a1985222b7d413?Message=This+is+a+call+for+${encodeURIComponent(office.officeName)}`;
        
        // Instruct Twilio to dial the office's destination number
        // and play the whisper message from the URL first.
        dial.number({ url: whisperUrl }, office.destination);
        
      } else {
        // If no match is found, inform the caller and end the call
        console.error(`No match found for ${calledNumber} in the JSON file.`);
        twiml.say('We\'re sorry, the number you have dialed is not in service.');
        twiml.hangup();
      }
    } catch (error) {
      // If any other error occurs (e.g., file not found), handle it gracefully
      console.error(`Error processing request: ${error}`);
      twiml.say('We are sorry, an internal error has occurred.');
      twiml.hangup();
    }
  
    // Return the final TwiML instructions to the Studio Flow to be executed
    return callback(null, twiml);
  };