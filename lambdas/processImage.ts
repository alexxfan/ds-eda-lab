/* eslint-disable import/extensions, import/no-absolute-path */
import { SQSHandler } from "aws-lambda";
import {
  GetObjectCommand,
  PutObjectCommandInput,
  GetObjectCommandInput,
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "eu-west-1" })
);

const s3 = new S3Client();

export const handler: SQSHandler = async (event) => {
  console.log("Event ", JSON.stringify(event));
  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body); // Parse SQS message
    const snsMessage = JSON.parse(recordBody.Message); // Parse SNS message

    if (snsMessage.Records) {
      for (const messageRecord of snsMessage.Records) {
        const s3e = messageRecord.s3;
        const srcBucket = s3e.bucket.name;
        const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
        const eventName = messageRecord.eventName;

        try {
          if (eventName === "ObjectCreated:Put") {
            console.log(`Processing ObjectCreated for: ${srcKey}`);
            
            if (!srcKey.endsWith(".jpeg") && !srcKey.endsWith(".png")) {
              console.error(`Unsupported file type: ${srcKey} , please upload a JPEG or PNG file.`);
              throw new Error("Unsupported file type");
            }

            //add item to imagetable
            await ddbDocClient.send(
              new PutCommand({
                TableName: "ImageTable",
                Item: {
                  FileName: srcKey, //primary key
                },
              })
            );
            console.log(`Image ${srcKey} successfully added to ImageTable.`);
          } else if (eventName === "ObjectRemoved:Delete") {
            console.log(`Processing ObjectDeleted for: ${srcKey}`);

            //delete item from imagetable
            await ddbDocClient.send(
              new DeleteCommand({
                TableName: "ImageTable",
                Key: { FileName: srcKey },
              })
            );
            console.log(`Image ${srcKey} has successfully been deleted from ImageTable.`);
          }
        } catch (error) {
          console.error(`Error processing image ${srcKey}:`, error);
          throw error;
        }
      }
    }
  }
};
