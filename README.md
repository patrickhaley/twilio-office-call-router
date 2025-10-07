# Twilio Scalable Office Call Forwarding

This project provides a scalable, centralized system for forwarding calls from main Twilio numbers to various office locations or departments. It includes a dynamic "whisper message" that announces the lead source to the office staff and features an intelligent fallback to a voicemail system that notifies the office via SMS.

The core benefit of this architecture is that all routing logic and configuration is centralized. Adding or updating office phone numbers is done by editing a single data file, and the whisper and voicemail messages are managed in one place.

---

## Architecture Overview

This system uses a combination of Twilio products to create a flexible and resilient call routing engine.

1.  **Twilio Studio Flow:** A single, universal flow acts as the entry point. Its only job is to trigger the main Twilio Function.
2.  **Twilio Service (Functions & Assets):** A serverless service that bundles the core components:
    * **Functions:** Three distinct Node.js functions handle the call logic:
        * `/forwarder`: The main function that looks up the office, records the call, and attempts to connect it.
        * `/voicemail`: A fallback function that plays a greeting and records a message if the office doesn't answer.
        * `/send-sms`: A background function that sends an SMS with the recording link after a voicemail is left.
    * **The Asset:** A private JSON file (`office_data.json`) that acts as a directory, mapping Twilio numbers to their destinations.
    * **Environment Variables:** Securely stores configuration data, like the URL for the whisper message TwiML Bin.
3.  **TwiML Bin:** Hosts the specific TwiML code for the whisper message that is played to your staff.

---

## Setup and Deployment

Follow these steps to set up the entire system in your Twilio account.

### Step 1: Prepare Your Office Data File

This JSON file is the source of truth for your call routing.

1.  Create a file named `office_data.json` on your local computer.
2.  Add your office data using the main Twilio number (in E.164 format) as the key. The `destination` number should be SMS-capable to receive voicemail notifications.

    ```json
    {
      "+17042001111": {
        "destination": "+17045551212",
        "officeName": "Charlotte Office"
      },
      "+19803002222": {
        "destination": "+19808675309",
        "officeName": "The Sales Department"
      }
    }
    ```

### Step 2: Create the Whisper Message TwiML Bin

This hosts the message your staff will hear before the call is connected.

1.  In your Twilio Console, go to **Developer tools** > **TwiML Bins**.
2.  Click **Create new TwiML Bin**.
3.  Give it a **FRIENDLY NAME**, like `whisper-handler`.
4.  In the **TWIML** box, paste your specific whisper message code:

    ```xml
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="Google.en-US-Chirp3-HD-Kore" language="en-US">
        This is a new lead for {{officeName}}. Your call will be connected in 3...2...1...
      </Say>
    </Response>
    ```
5.  Click **Create**.
6.  After the page reloads, **copy the URL** of this TwiML Bin. You will need it in the next step.

### Step 3: Create and Configure the Twilio Service

This service bundles your logic, data, and configuration.

1.  In your Twilio Console, navigate to **Developer tools** > **Functions and Webhooks**.
2.  Click **Create service**. Name the service `office-forwarding` and click **Next**.
3.  **Add Environment Variable:**
    * In the left sidebar of your new service, click **Settings** > **Environment Variables**.
    * Click **Add** and create a new variable:
        * **KEY:** `WHISPER_TWIML_BIN_URL`
        * **VALUE:** Paste the TwiML Bin URL you copied in Step 2.
    * Click **Save**.
4.  **Upload Data File:**
    * In the left sidebar, click **Assets** (under the "Add +" button if the section is not visible).
    * Click the **Add +** button and select **Upload File**.
    * Choose the `office_data.json` file you created in Step 1.
5.  **Add the Functions:**
    * Click the **Add +** button and select **Add Function**. Create the three functions below, pasting the corresponding code into each.

    **5a. Add the Main `/forwarder` Function**
    * **Path:** `/forwarder`
    * **Code:**
        ```javascript
        exports.handler = async function(context, event, callback) {
          const twiml = new Twilio.twiml.VoiceResponse();
          const calledNumber = event.calledNumber;
          const caller = event.caller;
          const assetPath = '/office_data.json'; 
          
          try {
            const openAsset = Runtime.getAssets()[assetPath].open;
            const officeData = JSON.parse(openAsset());
            const office = officeData[calledNumber];
        
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
              twiml.say({ voice: 'Polly.Joanna' }, 'We\'re sorry, the number you have dialed is not in service.');
              twiml.hangup();
            }
          } catch (error) {
            console.error(`Error processing request: ${error}`);
            twiml.say({ voice: 'Polly.Joanna' }, 'We are sorry, an internal error has occurred.');
            twiml.hangup();
          }
        
          return callback(null, twiml);
        };
        ```

    **5b. Add the `/voicemail` Function**
    * **Path:** `/voicemail`
    * **Code:**
        ```javascript
        exports.handler = async function(context, event, callback) {
          const twiml = new Twilio.twiml.VoiceResponse();
        
          twiml.say({ voice: 'Polly.Joanna' }, 
            'We are sorry, no one is available to take your call. Please leave a message after the beep.'
          );
        
          twiml.record({
            recordingStatusCallback: `/send-sms?smsTarget=${encodeURIComponent(event.smsTarget)}`,
            recordingStatusCallbackEvent: 'completed'
          });
        
          twiml.hangup();
        
          return callback(null, twiml);
        };
        ```

    **5c. Add the `/send-sms` Function**
    * **Path:** `/send-sms`
    * **Code:**
        ```javascript
        exports.handler = async function(context, event, callback) {
          const fromNumber = event.To; 
          const toNumber = event.smsTarget;
          const recordingUrl = event.RecordingUrl;
          const client = context.getTwilioClient();
        
          const messageBody = `New Voicemail! You have a new message from ${event.CallFrom}. Listen here: ${recordingUrl}`;
        
          await client.messages.create({
            to: toNumber,
            from: fromNumber,
            body: messageBody
          });
          
          return callback(null, { status: "success" });
        };
        ```

6.  **Deploy:** Click the **Deploy All** button at the bottom of the screen.

### Step 4: Import and Configure the Studio Flow

1.  In your Twilio Console, navigate to **Studio** and create a new flow named **Universal Office Forwarder**, selecting **Import from JSON**.
2.  Paste the following JSON into the text box:

    ```json
    {
      "description": "Universal flow to forward calls to offices or departments via a Function.",
      "states": [
        { "name": "Trigger_1", "type": "trigger", "transitions": [ { "event": "incomingCall", "next": "Run_Forwarder_Function" } ], "properties": { "offset": { "x": 0, "y": 0 } } },
        { "name": "Run_Forwarder_Function", "type": "run-function", "transitions": [], "properties": { "service_sid": "Zxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", "function_sid": "Zxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", "parameters": [ { "value": "{{trigger.call.To}}", "key": "calledNumber" }, { "value": "{{trigger.call.From}}", "key": "caller" } ], "offset": { "x": 0, "y": 200 } } }
      ], "initial_state": "Trigger_1", "flags": { "allow_concurrent_calls": true }
    }
    ```
3.  After importing, click the **Run_Forwarder_Function** widget.
4.  In the configuration panel, select your `office-forwarding` **Service** and `/forwarder` **Function**.
5.  **Publish** the flow.

### Step 5: Final Configuration

1.  Navigate to **Phone Numbers** in your console.
2.  For each main number you use, configure **A CALL COMES IN** to use **Studio Flow** and select your **Universal Office Forwarder** flow.

---

## Maintenance

* **To add/change an office number:** Edit your local `office_data.json` file, then re-upload it to your Twilio Service Assets (replacing the old one) and click **Deploy All**.
* **To change the whisper message:** Edit the `whisper-handler` TwiML Bin and click **Save**.
* **To change the voicemail greeting:** Edit the code in the `/voicemail` function and click **Deploy All**.
* **To change the SMS notification text:** Edit the code in the `/send-sms` function and click **Deploy All**.

---

## Testing the System

You can simulate an incoming customer call using the Twilio REST API and a `curl` command. This allows you to test the entire flow using just one phone, which will act as the "office."

### Step 1: Preparation

Before running a test, make sure you have the following ready.

**A. Gather Your Credentials & Numbers**
You will need:
* **Account SID:** Found on your [Twilio Console Dashboard](https://twilio.com/console).
* **Auth Token:** Also on the dashboard (click "Show").
* **A `From` Number:** Any Twilio number you own. The API will use this as the Caller ID.
* **The `To` Number:** The specific Twilio marketing number you want to test.

**B. Prepare Your `office_data.json` File**
Ensure the number you're testing is configured to forward to your personal mobile phone for the duration of the test.
1.  Open your `office_data.json` file.
2.  Find the entry for the number you are testing and set its `destination` to your mobile number in E.164 format.
    ```json
    {
      "+19786259195": {
        "destination": "+1YOUR_MOBILE_NUMBER",
        "officeName": "API Test"
      }
    }
    ```
3.  Upload the updated file to your `office-forwarding` service and click **Deploy All**.

**C. Create the Test Caller TwiML Bin**
This TwiML Bin provides the initial instructions for the API call. Its only job is to start the call and wait, acting as the automated "customer."
1.  In your Twilio Console, go to **Developer tools** > **TwiML Bins**.
2.  Click **Create new TwiML Bin** and name it `api-test-caller`.
3.  Paste the following TwiML and click **Create**:
    ```xml
    <Response>
        <Say>Starting test call. Please wait.</Say>
        <Pause length="30"/>
    </Response>
    ```
4.  After the page reloads, **copy the URL** of this new TwiML Bin.

### Step 2: Running the Test

Open your computer's terminal and use the following `curl` command. Replace all the placeholder values with your actual information.

```bash
curl -X POST [https://api.twilio.com/2010-04-01/Accounts/ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/Calls.json](https://api.twilio.com/2010-04-01/Accounts/ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/Calls.json) \
--data-urlencode "From=+1TWILIO_FROM_NUMBER" \
--data-urlencode "To=+1TWILIO_NUMBER_TO_TEST" \
--data-urlencode "Url=YOUR_TEST_TWIML_BIN_URL" \
-u "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx":"your_auth_token"
```

**Placeholder Guide:**

- `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`: Your Account SID (used in two places).
- `your_auth_token`: Your Auth Token.
- `+1TWILIO_FROM_NUMBER`: The Twilio number the call will come from.
- `+1TWILIO_NUMBER_TO_TEST`: The marketing number you are testing.
- `YOUR_TEST_TWIML_BIN_URL`: The URL of the api-test-caller TwiML Bin you just created.

**Test Case A: Office Answers (Testing Whisper & Recording)**
1. **Action:** Run the `curl` command. When your mobile phone rings, answer it.
2. **Expected Result:** You should immediately hear the whisper message ("This is a new lead for API Test..."). After the whisper, the call will connect to silence. Hearing the whisper is the sign of success. The call will also be recorded.

**Test Case B: Office Doesn't Answer (Testing Voicemail & SMS)**
1. **Action:** Run the `curl` command. When your mobile phone rings, press the 'Decline' button.
2. **Expected Result:** The call will stop ringing. A minute or so later, you should receive an SMS notification with the link to the new voicemail recording. Receiving the SMS is the sign of success.
