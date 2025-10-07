# Twilio Scalable Office Call Forwarding

This project provides a scalable, centralized system for forwarding calls from main Twilio numbers to various office locations, departments, or teams. It includes a dynamic "whisper message" that announces the call's context to the staff member before connecting the call.

The core benefit of this architecture is that adding, removing, or updating office phone numbers is done by editing a single data file and redeploying the service, requiring **no changes** to the Studio Flow logic.

---

## Architecture Overview

This system uses a combination of Twilio products to create a flexible and maintainable call routing engine.

1.  **Twilio Studio Flow:** A single, universal flow acts as the entry point for all incoming calls. Its only job is to trigger the Twilio Function.
2.  **Twilio Service (Functions & Assets):** A serverless service that bundles two key components:
    * **The Function:** A Node.js function containing the core routing logic.
    * **The Asset:** A private JSON file (`office_data.json`) that acts as a directory, mapping Twilio numbers to their destinations.

The workflow is as follows:
**Incoming Call** → **Studio Flow** → **Run Function** → **Read Private JSON Asset (within the same service)** → **Generate TwiML** → **Forward Call with Whisper**

---

## Setup and Deployment

Follow these steps to set up the entire system in your Twilio account.

### Step 1: Prepare Your Office Data File

First, create the JSON file on your local computer that will serve as your routing directory.

1.  Create a file named `office_data.json`.
2.  Add your office data using the main Twilio number (in E.164 format) as the key.

    ```json
    {
      "+17042001111": {
        "destination": "+17045551212",
        "officeName": "Charlotte Office"
      },
      "+19803002222": {
        "destination": "+19808675309",
        "officeName": "Sales Department"
      }
    }
    ```

### Step 2: Create and Deploy the Twilio Service

Next, create the serverless service that will contain both your data file (Asset) and your logic (Function).

1.  In your Twilio Console, navigate to **Developer tools** > **Functions and Webhooks**.
2.  Click **Create service**. Name the service `office-forwarding` and click **Next**.
3.  Inside your new service, click the **Add +** button and select **Upload File**.
    * Choose the `office_data.json` file you just created.
    * The file will be uploaded as a **Private** asset, which is correct.
4.  Click the **Add +** button again and select **Add Function**.
    * Name the new function path `/forwarder`.
5.  Replace all the code in the function with the following:

    ```javascript
    // functions/forwarder.js
    
    exports.handler = async function(context, event, callback) {
      const twiml = new Twilio.Response();
      const calledNumber = event.calledNumber;
      const caller = event.caller;
    
      // This path corresponds to the private asset uploaded to this Service.
      const assetPath = '/office_data.json'; 
      
      try {
        const openAsset = Runtime.getAssets()[assetPath].open;
        const officeData = JSON.parse(openAsset());
        const office = officeData[calledNumber];
    
        if (office) {
          const dial = twiml.dial({ callerId: caller });
          const whisperUrl = `https://handler.twilio.com/twiml/EHbb1005a76e7f8e8331a1985222b7d413?Message=This+is+a+call+for+${encodeURIComponent(office.officeName)}`;
          dial.number({ url: whisperUrl }, office.destination);
        } else {
          console.error(`No match found for ${calledNumber} in the JSON file.`);
          twiml.say('We\'re sorry, the number you have dialed is not in service.');
          twiml.hangup();
        }
      } catch (error) {
        console.error(`Error processing request: ${error}`);
        twiml.say('We are sorry, an internal error has occurred.');
        twiml.hangup();
      }
    
      return callback(null, twiml);
    };
    ```

6.  Click the **Deploy All** button at the bottom of the screen. Wait for the deployment to complete.

### Step 3: Import and Configure the Studio Flow

The final step is to set up the simple flow that triggers your service.

1.  In your Twilio Console, navigate to **Studio** and create a new flow named **Universal Office Forwarder**. Start by selecting the **Import from JSON** option.
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
4.  In the configuration panel, use the dropdowns to select your `office-forwarding` **Service** and `/forwarder` **Function**. The **Environment** will default to the service's domain and does not need to be changed.
5.  **Publish** the flow.

### Step 4: Final Configuration

1.  Navigate to **Phone Numbers** in your console.
2.  For each main number you use, configure **A CALL COMES IN** to use **Studio Flow** and select your **Universal Office Forwarder** flow.

---

## Maintenance

To add, update, or remove an office:
1.  Edit the `office_data.json` file on your local computer.
2.  In your `office-forwarding` service in the Twilio Console, delete the old asset and upload the new version.
3.  Click **Deploy All** to make the changes live.