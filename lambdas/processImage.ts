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
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "eu-west-1" })
);

const TABLE_NAME = "ImageTable";

const s3 = new S3Client();

export const handler: SQSHandler = async (event) => {
  console.log("Event ", JSON.stringify(event));
  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body); // Parse SQS message
    const snsMessage = JSON.parse(recordBody.Message); // Parse SNS message

    if (snsMessage.Records) {
      console.log("Record body ", JSON.stringify(snsMessage));
      for (const messageRecord of snsMessage.Records) {
        const s3e = messageRecord.s3;
        const srcBucket = s3e.bucket.name;
        // Object key may have spaces or unicode non-ASCII characters.
        const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));

        try {
          if (!srcKey.endsWith(".jpeg") && !srcKey.endsWith(".png")) {
            console.error(`File type must be JPEG or PNG for file`);
            throw new Error("Unsupported file type");
          }

          const params: GetObjectCommandInput = {
            Bucket: srcBucket,
            Key: srcKey,
          };
          await s3.send(new GetObjectCommand(params));
          console.log(`File successfully downloaded.`);

          await ddbDocClient.send(
            new PutCommand({
              TableName: TABLE_NAME,
              Item: {
                FileName: srcKey, //primary key
              },
            })
          );
          console.log(`File ${srcKey} added to DynamoDB.`);
        } catch (error) {
          console.error(`Error processing file ${srcKey}:`, error);
        }
      }
    }
  }
};
