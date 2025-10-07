/**
 * Send SMS Notification function.
 * Triggered by: The 'recordingStatusCallback' from the /voicemail function.
 * - Receives the recording URL and the target number for the SMS.
 * - Sends an SMS with a link to the voicemail recording.
 */
exports.handler = async function(context, event, callback) {
    // The Twilio number that originally received the call
    const fromNumber = event.To; 
    
    // The office's phone number, passed through from the previous functions
    const toNumber = event.smsTarget;
    
    // The URL of the new voice recording
    const recordingUrl = event.RecordingUrl;
    
    // The customer's phone number
    const callerNumber = event.CallFrom;
    
    const client = context.getTwilioClient();
  
    const messageBody = `New Voicemail! You have a new message from ${callerNumber}. Listen here: ${recordingUrl}`;
  
    // Use the Twilio client to send the SMS
    await client.messages.create({
      to: toNumber,
      from: fromNumber,
      body: messageBody
    });
    
    // Respond to the webhook to confirm success
    return callback(null, { status: "success" });
  };