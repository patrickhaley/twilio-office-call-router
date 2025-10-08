/**
 * Send SMS Notification function.
 * Triggered by: The 'recordingStatusCallback' from the /voicemail function.
 * - Receives the recording URL and the target number for the SMS.
 * - Sends an SMS with a link to the voicemail recording.
 */
exports.handler = async function(context, event, callback) {
  console.log("Send SMS function started.");
  console.log("Received event from recording callback:", JSON.stringify(event, null, 2));

  const fromNumber = event.To; 
  const toNumber = event.smsTarget;
  const recordingUrl = event.RecordingUrl;
  const callerNumber = event.CallFrom;
  const client = context.getTwilioClient();

  console.log(`Extracted variables - From: ${fromNumber}, To: ${toNumber}, Caller: ${callerNumber}`);

  const messageBody = `New GJ GARDNER HOMES Voicemail! You have a new message from ${callerNumber}. Listen here: ${recordingUrl}`;

  console.log(`Constructed SMS body: "${messageBody}"`);

  try {
    const message = await client.messages.create({
      to: toNumber,
      from: fromNumber,
      body: messageBody
    });
    console.log(`SMS successfully created with SID: ${message.sid}`);
  } catch (error) {
    console.error(`Failed to send SMS: ${error}`);
  }
  
  return callback(null, { status: "success" });
};