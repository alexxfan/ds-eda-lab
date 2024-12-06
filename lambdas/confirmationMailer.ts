import { SQSHandler, DynamoDBStreamHandler } from "aws-lambda";
import { SES_EMAIL_FROM, SES_EMAIL_TO, SES_REGION } from "../env";
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from "@aws-sdk/client-ses";

const BUCKET_NAME = process.env.BUCKET_NAME!; 

if (!SES_EMAIL_TO || !SES_EMAIL_FROM || !SES_REGION || !BUCKET_NAME) {
  throw new Error(
    "Please add the SES_EMAIL_TO, SES_EMAIL_FROM and SES_REGION environment variables in an env.js file located in the root directory"
  );
}

type ContactDetails = {
  name: string;
  email: string;
  message: string;
};

const client = new SESClient({ region: SES_REGION});


//uses dynamodb stream instead of sns message
export const handler: DynamoDBStreamHandler = async (event) => {
  console.log("DynamoDB Stream Event: ", JSON.stringify(event));

  for (const record of event.Records) {
    if (record.eventName === "INSERT") { 
      const newImage = record.dynamodb?.NewImage; //get image from DynamoDB stream
      const fileName = newImage?.FileName?.S; //get file name from the DynamoDB stream 

      try {
        const emailParams = sendEmailParams({
          name: "The Photo Album",
          email: SES_EMAIL_FROM,
          message: `We have received your uploaded Image. The URL is s3://${BUCKET_NAME}/${fileName}`,
        });

        await client.send(new SendEmailCommand(emailParams));
        console.log(`The confirmation email was sent successfully for file: ${fileName}`);
      } catch (error) {
        console.error("Error while sending the confirmation email: ", error);
      }
    }
  }
};

function sendEmailParams({ name, email, message }: ContactDetails) {
  const parameters: SendEmailCommandInput = {
    Destination: {
      ToAddresses: [SES_EMAIL_TO],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: getHtmlContent({ name, email, message }),
        },
        // Text: {.           // For demo purposes
        //   Charset: "UTF-8",
        //   Data: getTextContent({ name, email, message }),
        // },
      },
      Subject: {
        Charset: "UTF-8",
        Data: `New image Upload`,
      },
    },
    Source: SES_EMAIL_FROM,
  };
  return parameters;
}

function getHtmlContent({ name, email, message }: ContactDetails) {
  return `
    <html>
      <body>
        <h2>Sent from: </h2>
        <ul>
          <li style="font-size:18px">👤 <b>${name}</b></li>
          <li style="font-size:18px">✉️ <b>${email}</b></li>
        </ul>
        <p style="font-size:18px">${message}</p>
      </body>
    </html> 
  `;
}

 // For demo purposes - not used here.
 function getTextContent({ name, email, message }: ContactDetails) {
  return `
    Received an Email. 📬
    Sent from:
        👤 ${name}
        ✉️ ${email}
    ${message}
  `;
}