/**
 * Voicemail function.
 * Triggered by: The 'action' attribute of the <Dial> in the /forwarder function.
 * - Plays a greeting to the caller.
 * - Records their message.
 * - When the recording is ready, it triggers the /send-sms function.
 */
exports.handler = async function(context, event, callback) {
  console.log("Voicemail function started.");
  console.log("Received event from Dial action:", JSON.stringify(event, null, 2));

  const twiml = new Twilio.twiml.VoiceResponse();
  const smsTarget = event.smsTarget;

  console.log(`Target number for SMS notification: ${smsTarget}`);

  twiml.say({ voice: 'Google.en-US-Chirp3-HD-Kore' }, 
    'We are sorry, no one is available to take your call. Please leave a message after the beep.'
  );

  twiml.record({
    recordingStatusCallback: `/send-sms?smsTarget=${encodeURIComponent(smsTarget)}`,
    recordingStatusCallbackEvent: 'completed'
  });

  twiml.hangup();

  console.log("Generated TwiML:", twiml.toString());
  return callback(null, twiml);
};