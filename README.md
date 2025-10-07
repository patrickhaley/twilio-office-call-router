# Twilio Scalable Office Call Forwarding

This project provides a scalable, centralized system for forwarding calls from main Twilio numbers to various office locations, departments, or teams. It includes a dynamic "whisper message" that announces the call's context to the staff member before connecting the call.

The core benefit of this architecture is that adding, removing, or updating office phone numbers is done by editing a single data file, requiring **no changes** to the call logic or Twilio Studio Flow.

---

## Architecture Overview

This system uses a combination of Twilio products to create a flexible and maintainable call routing engine.

1.  **Twilio Studio Flow:** A single, universal flow acts as the entry point for all incoming calls. Its only job is to trigger the Twilio Function.
2.  **Twilio Function:** A serverless Node.js function that contains the core logic. It reads the office data file, finds the correct location to forward the call to, and generates TwiML instructions on the fly.
3.  **Twilio Assets:** A simple JSON file (`office_data.json`) is hosted on Twilio Assets. This file acts as a directory, mapping the main Twilio numbers to the destination number and office name.

The workflow is as follows:
**Incoming Call** → **Studio Flow** → **Run Function** → **Read JSON Asset** → **Generate TwiML** → **Forward Call with Whisper**

---

## Features

* **Scalable:** Manage hundreds of office or department numbers with one system.
* **Centralized Management:** All forwarding rules are stored in a single `office_data.json` file.
* **Dynamic Whisper Message:** The whisper message is generated automatically using the `officeName` from the data file (e.g., "This is a call for the Sales Department").
* **No Redeployment Needed:** Adding or changing a location's number only requires updating the JSON file, not the code or the Studio Flow.

---

## Setup and Deployment

Follow these steps to set up the entire system in your Twilio account.

### Step 1: Create the Office Data File

This JSON file is the source of truth for your call routing.

1.  Create a file named `office_data.json`.
2.  Add your office data using the main Twilio number as the key.

    ```json
    {
      "+17042001111": {
        "destination": "+17045551212",
        "officeName": "Charlotte Office"
      },
      "+19803002222": {
        "destination": "+19808675309",
        "officeName": "Sales Department"
      },
      "+18005550199": {
        "destination": "+13365550100",
        "officeName": "Support Team"
      }
    }
    ```

3.  In your Twilio Console, navigate to **Developer tools** > **Assets**.
4.  Upload the `office_data.json` file.
5.  After uploading, click on the file and copy its **ASSET PATH** (e.g., `/office_data.json`). You will need this for the next step.

### Step 2: Deploy the Twilio Function

This function contains the core routing logic.

1.  In your Twilio Console, navigate to **Developer tools** > **Functions and Webhooks**.
2.  Create a new **Service** named `office-forwarding`.
3.  Inside the service, **Add +** a new **Function**. Name it `/forwarder`.
4.  In the **Dependencies** section, add a new dependency:
    * **NAME:** `got`
    * **VERSION:** `11.8.5`
5.  Replace all the code in the function with the following. **Remember to update the `assetPath` variable** with the path you copied in the previous step.

    ```javascript
    // functions/forwarder.js

    exports.handler = async function(context, event, callback) {
      const twiml = new Twilio.Response();
      const calledNumber = event.calledNumber;
      const caller = event.caller;
    
      // IMPORTANT: Update this with your Asset Path from Step 1
      const assetPath = '/office_data.json'; 
      
      try {
        const openAsset = Runtime.getAssets()[assetPath].open;
        const officeData = JSON.parse(openAsset());
        const office = officeData[calledNumber];

        if (office) {
          console.log(`Match found for ${calledNumber}: Forwarding to ${office.destination}`);
          const dial = twiml.dial({ callerId: caller });
          
          // Generate a TwiML URL for the whisper message
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

6.  Click **Save** and then **Deploy All**.

### Step 3: Import the Studio Flow

This simple flow triggers your function.

1.  In your Twilio Console, navigate to **Studio**.
2.  Click **Create a flow**.
3.  Name the flow **Universal Office Forwarder** and click **Next**.
4.  Select the **Import from JSON** option and click **Next**.
5.  Paste the following JSON into the text box and click **Next**.

    ```json
    {
      "description": "Universal flow to forward calls to offices or departments via a Function.",
      "states": [
        {
          "name": "Trigger_1",
          "type": "trigger",
          "transitions": [
            {
              "event": "incomingCall",
              "next": "Run_Forwarder_Function"
            }
          ],
          "properties": {
            "offset": {
              "x": 0,
              "y": 0
            }
          }
        },
        {
          "name": "Run_Forwarder_Function",
          "type": "run-function",
          "transitions": [],
          "properties": {
            "service_sid": "Zxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            "function_sid": "Zxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
            "parameters": [
              {
                "value": "{{trigger.call.To}}",
                "key": "calledNumber"
              },
              {
                "value": "{{trigger.call.From}}",
                "key": "caller"
              }
            ],
            "offset": {
              "x": 0,
              "y": 200
            }
          }
        }
      ],
      "initial_state": "Trigger_1",
      "flags": {
        "allow_concurrent_calls": true
      }
    }
    ```

6.  After importing, click the **Run_Forwarder_Function** widget.
7.  In the configuration panel on the right, use the dropdowns to select your `office-forwarding` **Service** and `/forwarder` **Function**.
8.  **Publish** the flow.

### Step 4: Final Configuration

1.  Navigate to **Phone Numbers** in your console.
2.  For each marketing or main number you use, configure **A CALL COMES IN** to use **Studio Flow** and select your **Universal Office Forwarder** flow.

---

## Maintenance

To add, update, or remove an office, department, or team, simply:
1.  Edit the `office_data.json` file on your local computer.
2.  Navigate to **Twilio Assets**.
3.  Delete the old file and upload the new version with the same name.

The changes will take effect immediately for all subsequent calls.