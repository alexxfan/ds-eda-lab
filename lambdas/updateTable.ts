import { SNSHandler } from "aws-lambda";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.REGION }));

export const handler: SNSHandler = async (event) => {
  console.log("SNS Event: ", JSON.stringify(event));

  for (const record of event.Records) {
    const message = JSON.parse(record.Sns.Message);
    const metadataType = record.Sns.MessageAttributes?.metadata_type?.Value;

    //check for valid metadata type
    if (!["Caption", "Date", "Photographer"].includes(metadataType)) {
      console.error(`Invalid metadata type: ${metadataType}`);
      continue;
    }

    try {
      await ddbClient.send(
        new UpdateCommand({
          TableName: "ImageTable",
          Key: { FileName: message.id }, //table items are called FileName (string)
          UpdateExpression: `SET #attr = :value`,
          ExpressionAttributeNames: { "#attr": metadataType },
          ExpressionAttributeValues: { ":value": message.value },
        })
      );
      console.log(`success, metadata was updated for ${message.id}`);
    } catch (error) {
      console.error(`Error updating metadata for ${message.id}:`, error);
    }
  }
};
