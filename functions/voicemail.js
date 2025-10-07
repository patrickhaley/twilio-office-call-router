/**
 * Voicemail function.
 * Triggered by: The 'action' attribute of the <Dial> in the /forwarder function.
 * - Plays a greeting to the caller.
 * - Records their message.
 * - When the recording is ready, it triggers the /send-sms function.
 */
exports.handler = async function(context, event, callback) {
    const twiml = new Twilio.twiml.VoiceResponse();
  
    // Play the voicemail greeting
    twiml.say({ voice: 'Google.en-US-Chirp3-HD-Kore' }, 
      'We are sorry, no one is available to take your call. Please leave a message after the beep.'
    );
  
    // Record the message and set a callback to run when the recording is ready
    twiml.record({
      recordingStatusCallback: `/send-sms?smsTarget=${encodeURIComponent(event.smsTarget)}`,
      recordingStatusCallbackEvent: 'completed'
    });
  
    // Hang up the call after the recording
    twiml.hangup();
  
    return callback(null, twiml);
  };